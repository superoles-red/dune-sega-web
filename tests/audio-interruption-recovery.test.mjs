import assert from 'node:assert/strict';
import test from 'node:test';
import {NativeAudioBridge} from '../web/native-audio.mjs';

const healthWindowMs = 1250;
const resumeTimeoutMs = 200;
const settle = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return {promise, resolve};
}

class FakeAudioContext extends EventTarget {
  constructor(state = 'running') {
    super();
    this.state = state;
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
    this.suspendCalls = 0;
    this.resumeCalls = 0;
    this.closeCalls = 0;
    this.scripts = [];
    this.moduleReady = Promise.resolve();
    this.audioWorklet = {addModule: () => this.moduleReady};
    this.onSuspend = () => { this.setState('suspended'); };
    this.onResume = () => { this.setState('running'); };
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    queueMicrotask(() => this.dispatchEvent(new Event('statechange')));
  }

  suspend() {
    this.suspendCalls++;
    return Promise.resolve(this.onSuspend());
  }

  resume() {
    this.resumeCalls++;
    return Promise.resolve(this.onResume());
  }

  close() {
    this.closeCalls++;
    this.setState('closed');
    return Promise.resolve();
  }

  createScriptProcessor(bufferSize, inputChannels, outputChannels) {
    assert.equal(inputChannels, 0);
    assert.equal(outputChannels, 2);
    const context = this;
    const script = {
      bufferSize,
      connected: false,
      connect(destination) {
        assert.equal(destination, context.destination, 'a ScriptProcessor belongs to its original context');
        this.connected = true;
      },
      disconnect() { this.connected = false; },
    };
    this.scripts.push(script);
    return script;
  }
}

function fixture(t, options = {}) {
  t.mock.timers.enable({apis: ['setTimeout']});
  const savedNode = globalThis.AudioWorkletNode;
  const nodes = [];
  const created = [];
  const routes = [];
  let nativeEpoch = 0;
  let wallTime = 0;
  let inGesture = false;
  let renderFrames = 0;
  let nextReport = 500;
  globalThis.AudioWorkletNode = class {
    constructor(context) {
      this.context = context;
      this.connected = false;
      this.messages = [];
      this.port = {postMessage: message => this.messages.push(message), close() {}};
      nodes.push(this);
    }
    connect(destination) {
      assert.equal(destination, this.context.destination);
      this.connected = true;
    }
    disconnect() { this.connected = false; }
  };
  t.after(() => {
    if (savedNode === undefined) delete globalThis.AudioWorkletNode;
    else globalThis.AudioWorkletNode = savedNode;
  });

  const audioSession = new EventTarget();
  audioSession.state = 'active';
  Object.defineProperty(audioSession, 'type', {
    get: () => 'auto',
    set: () => assert.fail('recovery must preserve the existing iOS audio session type'),
  });
  const original = new FakeAudioContext();
  const originalScript = original.createScriptProcessor(2048, 0, 2);
  const process = () => {};
  originalScript.onaudioprocess = process;
  originalScript.connect(original.destination);
  const Module = {
    SDL2: {audioContext: original, audio: {scriptProcessorNode: originalScript}},
    HEAPU8: new Uint8Array(800 * 4),
    _dune_web_audio_worklet(enabled) {
      routes.push(enabled);
      if (enabled) Module.nativeAudioBridge.flush(++nativeEpoch);
      return 1;
    },
  };
  const bridge = new NativeAudioBridge({
    Module,
    recoverInterruptions: true,
    audioSession,
    now: () => wallTime,
    healthWindowMs,
    resumeTimeoutMs,
    createContext(sampleRate) {
      assert.equal(inGesture, true, 'create a replacement in the trusted input task');
      assert.equal(sampleRate, original.sampleRate, 'retain SDL sample rate after recovery');
      const context = new FakeAudioContext('suspended');
      const resume = context.resume.bind(context);
      context.resume = () => {
        assert.equal(inGesture, true, 'unlock the replacement before the trusted input task ends');
        return resume();
      };
      if (options.moduleReady) context.moduleReady = options.moduleReady;
      created.push(context);
      return context;
    },
  });

  const tick = ms => {
    wallTime += ms;
    t.mock.timers.tick(ms);
  };
  const feed = async (ms, {clock = true, render = true} = {}) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      const context = Module.SDL2.audioContext;
      if (clock && context.state === 'running') context.currentTime += 0.05;
      if (render && context.state === 'running') renderFrames += 2205;
      tick(50);
      if (render && context.state === 'running' && wallTime >= nextReport) {
        nextReport = wallTime + 500;
        nodes.findLast(node => node.connected)?.port.onmessage?.({
          data: {type: 'metrics', epoch: bridge.epoch, outputFrames: renderFrames},
        });
      }
      assert.equal(bridge.pushPCM(0, 800), true, 'the active bridge owns each incoming PCM batch');
      await settle();
    }
  };
  const tap = () => {
    inGesture = true;
    try { return bridge.resume({trusted: true, repair: true}); }
    finally { inGesture = false; }
  };
  const session = state => {
    audioSession.state = state;
    audioSession.dispatchEvent(new Event('statechange'));
  };
  return {bridge, Module, original, originalScript, process, nodes, created, routes, tick, feed, tap, session};
}

async function startPlaying(t, options) {
  const f = fixture(t, options);
  assert.equal(await f.bridge.start(), true);
  await f.feed(1500);
  assert.equal(f.original.suspendCalls, 0, 'healthy playback does not trigger recovery');
  assert.equal(f.nodes[0].connected, true);
  return f;
}

async function interruptWithHangingResume(f) {
  const hanging = deferred();
  f.original.onResume = () => hanging.promise;
  f.original.setState('interrupted');
  await settle();
  const firstTap = f.tap();
  await settle();
  f.tick(resumeTimeoutMs + 1);
  await settle();
  assert.equal(await firstTap, false);
  assert.equal(f.created.length, 0, 'try to resume the current context before replacing it');
  return hanging;
}

test('a foreground context reporting running with a frozen clock attempts one soft restart, then replaces on a tap', async t => {
  const f = await startPlaying(t);
  const epoch = f.bridge.epoch;
  await f.bridge.setPageActive(false);
  await f.bridge.setPageActive(true);
  await f.feed(healthWindowMs * 4, {clock: false, render: false});
  assert.equal(f.original.suspendCalls, 1, 'bounded suspend/resume before graph replacement');
  assert.ok(f.original.resumeCalls >= 1);
  assert.equal(f.created.length, 0, 'foreground checks do not create extra contexts');
  await f.tap();
  assert.equal(f.Module.SDL2.audioContext, f.created[0]);
  assert.ok(f.bridge.epoch > epoch);
  assert.equal(f.nodes.filter(node => node.connected).length, 1);
  assert.equal(f.original.closeCalls, 1);
});

test('one soft restart returns healthy audio to the original graph when the platform recovers', async t => {
  const f = await startPlaying(t);
  const epoch = f.bridge.epoch;
  await f.bridge.setPageActive(false);
  await f.bridge.setPageActive(true);
  for (let elapsed = 0; !f.original.suspendCalls && elapsed < healthWindowMs * 2; elapsed += 50) {
    await f.feed(50, {clock: false, render: false});
  }
  assert.equal(f.original.suspendCalls, 1);
  await f.feed(healthWindowMs * 2);
  await f.tap();
  assert.equal(f.Module.SDL2.audioContext, f.original);
  assert.equal(f.created.length, 0);
  assert.equal(f.original.suspendCalls, 1);
  assert.ok(f.bridge.epoch > epoch);
  const packet = f.nodes[0].messages.at(-1);
  assert.equal(packet.type, 'pcm');
  assert.equal(packet.epoch, f.bridge.epoch);
});

test('a live context clock with frozen AudioWorklet output is detected even while the native game keeps producing PCM', async t => {
  const f = await startPlaying(t);
  const clockBefore = f.original.currentTime;
  await f.feed(healthWindowMs * 4, {clock: true, render: false});
  assert.ok(f.original.currentTime > clockBefore);
  await f.tap();
  assert.ok(f.nodes.length > 1, 'stalled rendering gets a replacement playback graph');
  assert.equal(f.nodes[0].connected, false);
  assert.equal(f.nodes.filter(node => node.connected).length, 1);
});

test('an in-page audio session interruption gates PCM and attempts recovery on release without a visibility change', async t => {
  const f = await startPlaying(t);
  const node = f.nodes[0];
  const before = node.messages.filter(message => message.type === 'pcm').length;
  f.session('interrupted');
  await settle();
  await f.tap();
  await f.feed(300, {clock: false, render: false});
  assert.equal(node.messages.filter(message => message.type === 'pcm').length, before);
  assert.equal(f.original.resumeCalls, 0, 'do not start playback while the phone owns the audio session');
  f.session('active');
  await settle();
  await f.feed(700);
  assert.ok(node.messages.filter(message => message.type === 'pcm').length > before);
  assert.equal(f.created.length, 0);
});

test('a trusted retry replaces an interrupted context whose resume never resolves and preserves native pause', async t => {
  const module = deferred();
  const f = await startPlaying(t, {moduleReady: module.promise});
  const hanging = await interruptWithHangingResume(f);
  const replacement = f.tap();
  assert.equal(f.created.length, 1);
  f.bridge.setPlaying(false);
  module.resolve();
  await replacement;
  const fresh = f.created[0];
  const script = f.Module.SDL2.audio.scriptProcessorNode;
  const worklet = f.nodes.at(-1);
  assert.equal(f.Module.SDL2.audioContext, fresh);
  assert.equal(f.original.closeCalls, 1);
  assert.equal(f.originalScript.connected, false);
  assert.equal(script, fresh.scripts[0]);
  assert.equal(script.bufferSize, f.originalScript.bufferSize);
  assert.equal(script.onaudioprocess, f.process);
  assert.equal(script.connected, false, 'SDL stays disconnected while the worklet owns playback');
  assert.equal(f.bridge.playing, false);
  assert.equal(worklet.messages.filter(message => message.type === 'playing').at(-1)?.playing, false);
  hanging.resolve();
  await settle();
  assert.equal(f.Module.SDL2.audioContext, fresh, 'stale resume completion cannot touch the replacement');
  f.bridge.setPlaying(true);
  f.bridge.pushPCM(0, 800);
  assert.equal(worklet.messages.at(-1)?.type, 'pcm');
  assert.equal(worklet.messages.at(-1)?.epoch, f.bridge.epoch);
});

test('hiding again during a replacement discards the candidate and its delayed module result', async t => {
  const module = deferred();
  const f = await startPlaying(t, {moduleReady: module.promise});
  await interruptWithHangingResume(f);
  const pending = f.tap();
  assert.equal(f.created.length, 1);
  await f.bridge.setPageActive(false);
  const countAfterHide = f.routes.length;
  module.resolve();
  await pending;
  await settle();
  assert.equal(f.Module.SDL2.audioContext, f.original);
  assert.equal(f.original.closeCalls, 0);
  assert.equal(f.created[0].closeCalls, 1);
  assert.equal(f.routes.length, countAfterHide, 'an obsolete candidate must not publish a fresh native route');
  assert.equal(f.nodes[0].messages.filter(message => message.type === 'playing').at(-1)?.playing, false);
  assert.equal(f.nodes.filter(node => node.connected).length, 1);
});

test('a late suspend from a canceled restart gets one automatic resume on the foreground page', async t => {
  const f = await startPlaying(t);
  const suspend = deferred();
  f.original.onSuspend = () => suspend.promise.then(() => f.original.setState('suspended'));

  await f.bridge.setPageActive(false);
  const restarting = f.bridge.setPageActive(true);
  assert.equal(f.original.suspendCalls, 1);
  await f.bridge.setPageActive(false);
  await restarting;
  await f.bridge.setPageActive(true);
  const attempts = f.original.resumeCalls;
  suspend.resolve();
  await settle();

  assert.equal(f.original.state, 'running');
  assert.equal(f.original.resumeCalls, attempts + 1);
  await f.feed(healthWindowMs * 2);
  assert.equal(f.original.resumeCalls, attempts + 1, 'do not continuously restart a recovered context');
  assert.equal(f.nodes[0].messages.at(-1)?.type, 'pcm');
  assert.equal(f.created.length, 0);
});
