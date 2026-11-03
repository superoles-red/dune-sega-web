import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {NativeAudioBridge} from '../web/native-audio.mjs';
import {verifyAudioLoader} from './verify_audio_loader.mjs';
const source=fs.readFileSync(new URL('../web/native-audio-worklet.js',import.meta.url),'utf8');
function processor(rate=48000,options={}){
  let Type;const reports=[];
  class Base{constructor(){this.port={postMessage:v=>reports.push(v)};}}
  vm.runInNewContext(source,{AudioWorkletProcessor:Base,sampleRate:rate,Int16Array,registerProcessor:(name,type)=>{assert.equal(name,'dune-native-pcm');Type=type;}});
  const p=new Type({processorOptions:options});p.reports=reports;
  p.send=d=>p.port.onmessage({data:d});
  p.pcm=(a,epoch=p.epoch)=>p.send({type:'pcm',frames:a.length/2,samples:a.buffer,epoch});
  p.render=(n=128)=>{const a=[new Float32Array(n),new Float32Array(n)];assert.equal(p.process([], [a]),true);return a;};
  return p;
}
function signal(n,start=0){const a=new Int16Array(n*2);for(let i=0;i<n;i++){a[i*2]=((i+start)*37%60000)-30000;a[i*2+1]=30000-((i+start)*41%60000);}return a;}

test('48000Hz worklet conserves every normal PCM sample, stereo order and variable render-quantum size',()=>{
  const p=processor(),all=signal(96000);let sent=0,read=0;
  // Deliberately feed20ms packets and vary the render quantum.
  p.pcm(all.slice(0,5760*2));sent=5760;
  for(let turn=0;read<96000-6000;turn++){
    const n=[128,64,160,256][turn%4];
    while(sent-read<6000&&sent<96000){let end=Math.min(sent+960,96000);p.pcm(all.slice(sent*2,end*2));sent=end;}
    const [l,r]=p.render(n);
    for(let i=0;i<n;i++){assert.equal(l[i],all[(read+i)*2]/32768);assert.equal(r[i],all[(read+i)*2+1]/32768);}
    read+=n;
  }
  assert.equal(p.metrics.consumedFrames,read);assert.equal(p.metrics.underrunFrames,0);assert.equal(p.metrics.discardedFrames,0);assert.equal(p.metrics.overflowEvents,0);
});

test('120ms preroll absorbs100ms producer stall; true starvation fades once, re-buffers, never sustains last note',()=>{
  const p=processor();p.pcm(signal(4800));assert.ok(p.render(480).every(c=>c.every(x=>x===0)));assert.equal(p.metrics.prerollFrames,480);assert.equal(p.metrics.underrunFrames,0);
  p.pcm(signal(960,4800));p.render(4800);assert.equal(p.metrics.underrunFrames,0);assert.equal(p.count,960);
  p.render(1024);assert.equal(p.metrics.underrunEvents,1);assert.equal(p.metrics.underrunFrames,64);
  assert.ok(p.render(256).every(c=>c.every(x=>x===0)));assert.equal(p.metrics.underrunEvents,1);
  p.pcm(signal(5760));p.render(128);assert.equal(p.metrics.underrunEvents,1);assert.equal(p.primed,true);
});

test('flush epochs isolate load/pause and reject old packets; bounded overflow never grows beyond320ms',()=>{
  const p=processor();p.pcm(signal(6000));p.send({type:'flush',epoch:3});p.pcm(signal(10000),0);assert.equal(p.count,0);
  p.pcm(signal(6000),3);p.send({type:'playing',playing:false});assert.equal(p.count,0);assert.ok(p.render(128).every(c=>c.every(x=>x===0)));
  p.send({type:'playing',playing:true});for(let i=0;i<100;i++)p.pcm(signal(1024),3);
  assert.ok(p.count<=15360);assert.ok(p.metrics.discardedFrames>0);assert.ok(p.metrics.overflowEvents>0);
  p.pcm(signal(30000),3);assert.equal(p.count,15360);assert.ok(p.metrics.discardedFrames>30000);
});

test('44100Hz context uses fixed clock-ratio interpolation without adaptive pitch/tempo or native clock changes',()=>{
  const p=processor(44100),a=signal(12000);p.pcm(a);
  const [l,r]=p.render(4410);for(let i=0;i<4410;i++){
    const at=i*48000/44100,base=Math.floor(at),f=at-base;
    const expect=(channel)=>(a[base*2+channel]*(1-f)+a[(base+1)*2+channel]*f)/32768;
    assert.ok(Math.abs(l[i]-expect(0))<1e-6);assert.ok(Math.abs(r[i]-expect(1))<1e-6);
  }
  assert.ok(Math.abs(p.metrics.consumedFrames-4800)<=1);assert.equal(p.metrics.underrunFrames,0);
});

function bridgeMock({failModule=false,available=true}={}){
  let calls=[],nodes=[],nativeEpoch=6;const script={connected:true,disconnect(){this.connected=false;calls.push('disconnectSDL');},connect(){assert.equal(this.connected,false);this.connected=true;calls.push('connectSDL');}};
  let resumeResolve;const context={state:'running',sampleRate:48000,baseLatency:.01,destination:{},audioWorklet:{async addModule(){calls.push('module');if(failModule)throw Error('no module');}},resume(){calls.push('resume');return new Promise(r=>{resumeResolve=()=>{this.state='running';r();};});}};
  const Module={SDL2:available?{audioContext:context,audio:{scriptProcessorNode:script}}:undefined,HEAPU8:new Uint8Array(4096),_dune_web_audio_worklet:on=>{calls.push(`route${on}`);if(on)Module.nativeAudioBridge.flush(++nativeEpoch);return 1;}};
  globalThis.AudioWorkletNode=class{constructor(){this.messages=[];this.port={postMessage:(d)=>this.messages.push(d)};nodes.push(this);}connect(){calls.push('connectWorklet');}disconnect(){calls.push('disconnectWorklet');}};
  let now=0;const bridge=new NativeAudioBridge({Module,now:()=>now});
  return {bridge,Module,context,script,calls,nodes,resolve:()=>resumeResolve(),tick:ms=>{now+=ms;}};
}

test('bridge makes one owned PCM transfer and switches SDL off only after ready; fallback reconnects once',async()=>{
  const t=bridgeMock();assert.equal(await t.bridge.start(),true);assert.equal(await t.bridge.start(),true);assert.equal(t.script.connected,false);assert.equal(t.calls.filter(x=>x==='route1').length,1);
  t.Module.HEAPU8.set([0,128,255,127],16);assert.equal(t.bridge.pushPCM(16,1),true);t.Module.HEAPU8.fill(0);assert.deepEqual([...new Uint8Array(t.nodes[0].messages.at(-1).samples)],[0,128,255,127]);
  t.tick(100);t.bridge.pushPCM(16,1);assert.equal(t.bridge.snapshot().producerGapsOver80ms,1);
  t.nodes[0].onprocessorerror();assert.equal(t.script.connected,true);assert.equal(t.bridge.ready,false);assert.equal(t.calls.filter(x=>x==='connectSDL').length,1);assert.ok(t.calls.includes('route0'));
});

test('unsupported/module failure keeps SDL connected, start may retry after SDL opens, gesture resumes coalesce',async()=>{
  const failed=bridgeMock({failModule:true});assert.equal(await failed.bridge.start(),false);assert.equal(failed.script.connected,true);assert.equal(failed.calls.includes('disconnectSDL'),false);
  const t=bridgeMock({available:false});assert.equal(await t.bridge.start(),false);t.Module.SDL2={audioContext:t.context,audio:{scriptProcessorNode:t.script}};assert.equal(await t.bridge.start(),true);
  t.context.state='suspended';const a=t.bridge.resume(),b=t.bridge.resume();assert.equal(a,b);assert.equal(t.calls.filter(x=>x==='resume').length,1);t.resolve();await a;await t.bridge.resume();assert.equal(t.calls.filter(x=>x==='resume').length,1);
});


test('ten seconds at cold suspended startup never enters MessagePort; gesture resume gets a C-owned fresh epoch and only fresh preroll',async()=>{
  const t=bridgeMock();t.context.state='suspended';assert.equal(await t.bridge.start(),true);
  // Setup must not create an untrusted unresolved resume() promise which would
  // suppress a later real user gesture on an autoplay-restricted browser.
  assert.equal(t.calls.includes('resume'),false);
  const before=t.nodes[0].messages.filter(m=>m.type==='pcm').length,oldEpoch=t.bridge.epoch;
  for(let i=0;i<600;i++){t.tick(1000/60);assert.equal(t.bridge.pushPCM(0,800),true);}
  assert.equal(t.nodes[0].messages.filter(m=>m.type==='pcm').length,before);
  assert.equal(t.bridge.snapshot().suspendedDiscardedFrames,480000);
  assert.equal(t.bridge.snapshot().suspendedPackets,600);
  const resume=t.bridge.resume();assert.equal(t.bridge.epoch,oldEpoch+1);assert.equal(t.bridge.snapshot().resumeEpochFlushes,1);
  t.resolve();await resume;assert.equal(t.bridge.epoch,oldEpoch+1);
  for(let i=0;i<8;i++)assert.equal(t.bridge.pushPCM(0,800),true);
  const p=processor();for(const message of t.nodes[0].messages)p.send(message);
  assert.equal(p.epoch,t.bridge.epoch);assert.equal(p.count,6400);assert.ok(p.count<15360);
  p.render(128);assert.equal(p.primed,true);assert.equal(p.metrics.receivedFrames,6400);assert.equal(p.metrics.underrunFrames,0);
  assert.equal(t.calls.filter(c=>c==='route1').length,2);
});


test('browser suspension after active playback discards only output and refreshes native epoch on external resume',async()=>{
  const t=bridgeMock();assert.equal(await t.bridge.start(),true);t.bridge.pushPCM(0,800);
  const epoch=t.bridge.epoch;t.context.state='suspended';t.bridge.syncContext();
  for(let i=0;i<100;i++)t.bridge.pushPCM(0,800);
  assert.equal(t.nodes[0].messages.filter(m=>m.type==='pcm').length,1);
  t.context.state='running';t.bridge.syncContext();assert.equal(t.bridge.epoch,epoch+1);
  t.bridge.pushPCM(0,800);
  const p=processor();for(const message of t.nodes[0].messages)p.send(message);
  assert.equal(p.count,800);assert.equal(p.epoch,epoch+1);assert.equal(p.primed,false);
  assert.equal(t.bridge.snapshot().suspendedDiscardedFrames,80000);
});


test('generated EM_JS ABI guard executes32PCM frames and rejects the actual pointer-name parser regression',()=>{
  const tail='function em_web_audio_flush_js(epoch){var b=Module["nativeAudioBridge"];if(b&&b.flush)b.flush(epoch)}function em_web_audio_playing_js(playing){var b=Module["nativeAudioBridge"];if(b&&b.setPlaying)b.setPlaying(!!playing)}';
  const body='{var b=Module["nativeAudioBridge"];return b&&b.pushPCM?+b.pushPCM(p,n):0}';
  assert.equal(verifyAudioLoader('function em_web_audio_push(p,n)'+body+tail).pcmFrames,32);
  assert.throws(()=>verifyAudioLoader('function em_web_audio_push(int16_tp,n)'+body+tail),/p is not defined/);
});
