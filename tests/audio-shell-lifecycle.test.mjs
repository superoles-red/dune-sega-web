import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const shell=fs.readFileSync(new URL('../web/shell.js',import.meta.url),'utf8');
function registration(prefix){
 const line=shell.split('\n').find(line=>line.startsWith(prefix));
 assert.ok(line,'actual shell registration exists: '+prefix);return line;
}
function lifecycle({hidden=false,qa=false,ready=true}={}){
 const calls=[],handlers={window:new Map(),document:new Map()};
 const document={hidden,addEventListener:(event,callback)=>handlers.document.set(event,callback)};
 const context={document,window:{addEventListener:(event,callback)=>handlers.window.set(event,callback)},
  nativeAudio:{setPageActive:active=>calls.push(['audio',active])},ready,qaMode:qa,
  cancelGesture:()=>calls.push(['cancel']),pollState:()=>calls.push(['poll']),saveGame:silent=>calls.push(['save',silent]),
  Module:{_dune_web_set_hidden:hidden=>calls.push(['native-hidden',hidden])}};
 vm.runInNewContext([
  registration("document.addEventListener('visibilitychange'"),
  registration("window.addEventListener('pagehide'"),
  registration("for(const event of ['pageshow','focus'])")
 ].join('\n'),context);
 return {calls,document,fire:(target,event)=>{assert.ok(handlers[target].has(event));handlers[target].get(event)();}};
}

test('actual visibility handler closes output before save/native hidden, and foreground preserves the native hidden contract',()=>{
 const t=lifecycle();t.document.hidden=true;t.fire('document','visibilitychange');
 assert.deepEqual(t.calls,[['audio',false],['cancel'],['poll'],['save',true],['native-hidden',1]]);
 t.calls.length=0;t.document.hidden=false;t.fire('document','visibilitychange');
 assert.deepEqual(t.calls,[['audio',true],['native-hidden',0]]);
});

test('actual pagehide closes audio even before document.hidden changes; BFCache pageshow/focus recover only visible output',()=>{
 const t=lifecycle();assert.equal(t.document.hidden,false);t.fire('window','pagehide');
 assert.deepEqual(t.calls,[['audio',false],['cancel'],['poll'],['save',true]]);
 t.calls.length=0;t.fire('window','pageshow');t.fire('window','focus');assert.deepEqual(t.calls,[['audio',true],['audio',true]]);
 t.calls.length=0;t.document.hidden=true;t.fire('window','pageshow');t.fire('window','focus');assert.deepEqual(t.calls,[['audio',false],['audio',false]]);
});

test('actual hidden QA lifecycle still gates audio and cancels gestures without saving a technical fixture',()=>{
 const t=lifecycle({hidden:true,qa:true,ready:false});t.fire('document','visibilitychange');t.fire('window','pagehide');
 assert.deepEqual(t.calls,[['audio',false],['cancel'],['audio',false],['cancel']]);
});

test('actual shell initializes output visibility before engine startup, including a cold hidden page',()=>{
 const start=shell.indexOf('const nativeAudio=new NativeAudioBridge('),end=shell.indexOf('\nfunction startEngine()',start);
 assert.ok(start>=0&&end>start);const initialization=shell.slice(start,end).replaceAll('import.meta.url',JSON.stringify('https://private.invalid/dune-sega-web/shell.js'));
 for(const hidden of [false,true]){
  const calls=[];
  class Audio {constructor(){calls.push(['construct']);}setPageActive(active){calls.push(['active',active]);}}
  vm.runInNewContext(initialization,{NativeAudioBridge:Audio,Module:{},URL,document:{hidden}});
  assert.deepEqual(calls,[['construct'],['active',!hidden]]);
 }
});

test('actual gesture helper uses current activation when available, with a synchronous legacy-Safari fallback',()=>{
 const start=shell.indexOf('function resumeAudio()'),end=shell.indexOf('\nfunction tell(',start);assert.ok(start>=0&&end>start);
 for(const [navigator,expected] of [[{userActivation:{isActive:true}},true],[{userActivation:{isActive:false}},false],[{},true]]){
  const calls=[];let returned=false;
  const context={navigator,nativeAudio:{resume(options){assert.equal(returned,false,'browser resume remains in the original input turn');calls.push(options.trusted);return Promise.resolve();}}};
  vm.createContext(context);vm.runInContext(shell.slice(start,end),context);context.resumeAudio();returned=true;
  assert.deepEqual(calls,[expected]);
 }
});
