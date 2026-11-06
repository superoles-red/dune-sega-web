import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OfflineUpdater} from '../web/update-game.mjs';
function events(properties={}){const listeners=new Map();return Object.assign({addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatch(type,e={}){for(const fn of [...(listeners.get(type)||[])])fn(e);}},properties);}
function fixture(){
 class MessageChannel{constructor(){this.port1={close(){}};this.port2={close(){},postMessage:value=>queueMicrotask(()=>this.port1.onmessage?.({data:value}))};}}
 const states=[],calls=[],messages=[];
 const worker=events({state:'installed',reply:'applying',postMessage(data,ports){const {type}=data;calls.push(type);messages.push(data);if(type==='DUNE_OFFLINE_STATUS')ports[0].postMessage({type:'DUNE_OFFLINE_PROGRESS',status:'ready',loaded:440,total:440,version:'latest'});else{ports[0].postMessage({type:'DUNE_UPDATE_RESULT',status:this.reply,version:'latest',count:2});if(this.reply==='applying')queueMicrotask(()=>{this.state='activated';this.dispatch('statechange');});}}});
 const registration={waiting:worker,update:async()=>calls.push('update')};
 const nav={serviceWorker:events({register:async(...args)=>(calls.push(args),registration)})};
 const updater=new OfflineUpdater({nav,win:{MessageChannel},onState:s=>states.push(s)});
 return{updater,nav,worker,registration,states,calls,messages};
}
test('recovery checks the network and exact candidate marker before enabling apply',async()=>{
 const f=fixture();assert.equal(await f.updater.prepare(),'latest');assert.equal(f.states.at(-1).status,'ready');
 assert.deepEqual(f.calls[0],['./service-worker.js',{scope:'./',updateViaCache:'none'}]);assert.equal(f.calls[1],'update');assert.equal(f.calls.at(-1),'DUNE_OFFLINE_STATUS');
 assert(!f.calls.includes('DUNE_APPLY_UPDATE'),'opening a recovery page cannot replace a playing client');
 assert.equal(await f.updater.apply(),true);assert.equal(f.states.at(-1).status,'done');assert.equal(f.worker.state,'activated');
});
test('other game tabs block apply without unregistering or deleting any storage',async()=>{
 const f=fixture();await f.updater.prepare();f.worker.reply='blocked';assert.equal(await f.updater.apply(),false);assert.deepEqual(f.states.at(-1),{status:'blocked',count:2});
 assert.equal(f.worker.state,'installed');f.worker.reply='applying';assert.equal(await f.updater.apply(),true);
});
test('one explicit Restart carries the preceding package and existing client versions without closing their games',async()=>{
 const f=fixture(),pins={'older-tab':'older-release'};
 f.registration.active={postMessage(data,ports){assert.equal(data.type,'DUNE_OFFLINE_STATUS');ports[0].postMessage({type:'DUNE_OFFLINE_PROGRESS',status:'ready',version:'previous',clientVersions:pins});}};
 await f.updater.prepare();assert.equal(await f.updater.apply({restart:true}),true);
 assert.deepEqual(f.messages.at(-1),{type:'DUNE_APPLY_UPDATE',restart:true,previousVersion:'previous',clientVersions:pins});
 assert.equal(f.states.at(-1).status,'done');
});
test('Restart also accepts the legacy worker status before client pinning was added',async()=>{
 const f=fixture();f.registration.active={postMessage(data,ports){ports[0].postMessage({type:'DUNE_OFFLINE_PROGRESS',status:'ready',version:'legacy'});}};
 await f.updater.prepare();await f.updater.apply({restart:true});
 assert.deepEqual(f.messages.at(-1),{type:'DUNE_APPLY_UPDATE',restart:true,previousVersion:'legacy',clientVersions:{}});
});
test('Restart cannot activate a package if the preceding active package cannot be verified',async()=>{
 const f=fixture();f.registration.active={postMessage(data,ports){ports[0].postMessage({type:'DUNE_OFFLINE_PROGRESS',status:'downloading',version:'previous'});}};
 await f.updater.prepare();await assert.rejects(f.updater.apply({restart:true}),/incomplete/);
 assert(!f.calls.includes('DUNE_APPLY_UPDATE'));assert.equal(f.worker.state,'installed');
});
test('reopening recovery after successful activation also works with only the active worker',async()=>{
 const f=fixture();f.worker.state='activated';f.registration.active=f.worker;f.registration.waiting=null;
 assert.equal(await f.updater.prepare(),'latest');assert.equal(await f.updater.apply(),true);assert.equal(f.states.at(-1).status,'done');
});
test('automatic recovery applies after verification, but defers safely if another game is open',async()=>{
 const f=fixture();assert.equal(await f.updater.start({automatic:true}),true);assert.deepEqual(f.calls.slice(-2),['DUNE_OFFLINE_STATUS','DUNE_APPLY_UPDATE']);assert.equal(f.states.at(-1).status,'done');
 const blocked=fixture();blocked.worker.reply='blocked';assert.equal(await blocked.updater.start({automatic:true}),false);assert.equal(blocked.states.at(-1).status,'blocked');assert.equal(blocked.worker.state,'installed');
 const manual=fixture();await manual.updater.start();assert(!manual.calls.includes('DUNE_APPLY_UPDATE'));
});
test('network update failure cannot pass off the old active package as current',async()=>{
 const f=fixture();f.registration.update=async()=>{throw Error('offline');};await assert.rejects(f.updater.prepare(),/offline/);assert(!f.calls.includes('DUNE_OFFLINE_STATUS'));assert(!f.states.some(s=>s.status==='ready'));
});
test('incomplete candidate and rejected activation never show success',async()=>{
 const f=fixture();f.worker.postMessage=({type},ports)=>ports[0].postMessage({type:'DUNE_OFFLINE_PROGRESS',status:'downloading',loaded:1,total:440,version:'latest'});await assert.rejects(f.updater.prepare(),/incomplete/);
 const other=fixture();await other.updater.prepare();other.worker.reply='denied';await assert.rejects(other.updater.apply(),/denied/);assert(!other.states.some(s=>s.status==='done'));
});
test('an installing candidate is awaited without claiming an early ready broadcast',async()=>{
 const f=fixture();f.worker.state='installing';f.registration.installing=f.worker;f.registration.waiting=null;
 const operation=f.updater.prepare();await Promise.resolve();await Promise.resolve();assert(!f.states.some(s=>s.status==='ready'));
 f.worker.state='installed';f.worker.dispatch('statechange');await operation;assert.equal(f.states.at(-1).status,'ready');
});
