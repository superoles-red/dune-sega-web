import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BrowserFeatures,isAppleMobile,SOURCE_URL,downloadSave,pickSaveFile} from '../web/browser-features.mjs';

function events(properties={}){
 const listeners=new Map();return Object.assign({listeners,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(callback);},removeEventListener(type,callback){listeners.get(type)?.delete(callback);},dispatch(type,event={}){for(const callback of [...(listeners.get(type)||[])])callback(event);}},properties);
}
function environment(){
 const messages=[],opens=[],win=events({matchMedia:()=>({matches:false}),open:(...args)=>opens.push(args)}),doc=events({documentElement:{}}),nav={userAgent:'Desktop browser',platform:'MacIntel',maxTouchPoints:0};
 const worker=events({state:'activated',postMessage:message=>messages.push(message)}),registration={active:worker};
 let registrations=0,lookups=0;
 nav.serviceWorker=events({async getRegistration(){lookups++;return registration;},async register(){registrations++;return registration;}});
 const feature=new BrowserFeatures({win,doc,nav});
 return {feature,win,doc,nav,worker,registration,messages,opens,get registrations(){return registrations;},get lookups(){return lookups;}};
}
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

test('constructor only inspects an existing offline registration; it never registers, persists, or downloads',async()=>{
 const e=environment();let persisted=0;e.nav.storage={persist:async()=>{persisted++;return true;}};
 assert.equal(e.registrations,0);assert.equal(e.lookups,1);assert.equal(persisted,0);await tick();
 assert.equal(e.registrations,0);assert.equal(persisted,0);assert.deepEqual(e.messages,[{type:'DUNE_OFFLINE_STATUS'}]);
});
test('fullscreen request and exit reach native API synchronously during the initiating click',async()=>{
 const e=environment(),calls=[];e.doc.documentElement.requestFullscreen=function(){assert.equal(this,e.doc.documentElement);calls.push('enter');return Promise.resolve();};
 const entering=e.feature.fullscreen();assert.deepEqual(calls,['enter'],'no await may precede the fullscreen API');assert.equal(await entering,'entered');
 e.doc.fullscreenElement=e.doc.documentElement;e.doc.exitFullscreen=function(){assert.equal(this,e.doc);calls.push('exit');return Promise.resolve();};
 const exiting=e.feature.fullscreen();assert.deepEqual(calls,['enter','exit']);assert.equal(await exiting,'exited');
});
test('prefixed Safari fullscreen is supported, rejection propagates, and iPhone gets home-screen help',async()=>{
 const e=environment();let entered=0;e.doc.documentElement.webkitRequestFullscreen=()=>{entered++;};assert.equal(await e.feature.fullscreen(),'entered');assert.equal(entered,1);
 e.doc.webkitFullscreenElement=e.doc.documentElement;let exited=0;e.doc.webkitExitFullscreen=()=>exited++;assert.equal(await e.feature.fullscreen(),'exited');assert.equal(exited,1);
 e.doc.webkitFullscreenElement=null;e.doc.documentElement.webkitRequestFullscreen=()=>Promise.reject(Error('permission'));await assert.rejects(e.feature.fullscreen(),/permission/);
 delete e.doc.documentElement.webkitRequestFullscreen;assert.equal(await e.feature.fullscreen(),'unsupported');e.nav.userAgent='iPhone Safari';assert.equal(await e.feature.fullscreen(),'apple-help');
});
test('standalone detection covers iPhone and touch-capable iPad desktop UA, without treating every Mac as iPad',()=>{
 assert(isAppleMobile({userAgent:'iPhone'}));assert(isAppleMobile({userAgent:'iPad'}));assert(isAppleMobile({userAgent:'Desktop',platform:'MacIntel',maxTouchPoints:5}));assert(!isAppleMobile({userAgent:'Desktop',platform:'MacIntel',maxTouchPoints:0}));assert(!isAppleMobile({userAgent:'Android',platform:'Linux',maxTouchPoints:5}));
 const e=environment();e.nav.standalone=true;const installed=new BrowserFeatures(e);assert.equal(installed.snapshot().installed,true);
 const media=environment();media.win.matchMedia=query=>({matches:query==='(display-mode: standalone)'});assert.equal(new BrowserFeatures(media).snapshot().installed,true);
});
test('install prompt is explicit, synchronous, one-use, and user dismissal is preserved',async()=>{
 const e=environment();let prevented=0,prompted=0;const prompt={preventDefault:()=>prevented++,prompt:()=>{prompted++;return Promise.resolve();},userChoice:Promise.resolve({outcome:'dismissed'})};
 e.win.dispatch('beforeinstallprompt',prompt);assert.equal(prevented,1);assert.equal(prompted,0);assert.equal(e.feature.snapshot().canInstall,true);
 const choice=e.feature.install();assert.equal(prompted,1,'must prompt during current user activation');assert.equal(await choice,'cancelled');assert.equal(e.feature.snapshot().canInstall,false);assert.equal(await e.feature.install(),'install-help');assert.equal(prompted,1);
});
test('accepted installation is followed by actual appinstalled state; unavailable installation gives platform help',async()=>{
 const e=environment();e.win.dispatch('beforeinstallprompt',{preventDefault(){},prompt:()=>Promise.resolve(),userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal(await e.feature.install(),'accepted');assert.equal(e.feature.snapshot().installed,false,'accepting a prompt is not installation proof');e.win.dispatch('appinstalled');assert.equal(e.feature.snapshot().installed,true);assert.equal(await e.feature.install(),'installed');
 const iphone=environment();iphone.nav.userAgent='iPhone';assert.equal(await iphone.feature.install(),'apple-help');assert.equal(iphone.registrations,0);
});
test('subscribers observe capability changes and can unsubscribe without registering a worker',()=>{
 const e=environment(),states=[],remove=e.feature.subscribe(state=>states.push(state));e.doc.fullscreenElement={};e.doc.dispatch('fullscreenchange');assert.equal(states.at(-1).fullscreen,true);remove();e.doc.fullscreenElement=null;e.doc.dispatch('fullscreenchange');assert.equal(states.length,1);assert.equal(e.registrations,0);
});
test('unsupported offline mode fails safely without claiming ready or initiating registration',async()=>{
 const feature=new BrowserFeatures({win:events(),doc:events({documentElement:{}}),nav:{}});await assert.rejects(feature.prepareOffline(),/offline-unsupported/);assert.equal(feature.snapshot().status,'error');assert.equal(feature.snapshot().preparing,false);assert.equal(feature.pending,null);
});
test('offline preparation registers only explicitly, coalesces requests, and survives denied persistent storage',async()=>{
 const e=environment();let resolve,options;e.nav.storage={persist:()=>Promise.reject(Error('denied'))};e.nav.serviceWorker.register=(url,config)=>{assert.equal(url,'./service-worker.js');options=config;return new Promise(done=>{resolve=done;});};
 const first=e.feature.prepareOffline(),second=e.feature.prepareOffline();await tick();assert.equal(e.feature.snapshot().preparing,true);assert.equal(typeof resolve,'function');assert.deepEqual(options,{scope:'./',updateViaCache:'none'});const pending=e.feature.pending;assert(pending);
 resolve(e.registration);await Promise.all([first,second]);assert.equal(e.feature.snapshot().status,'ready');assert.equal(e.feature.snapshot().persistent,false);assert.equal(e.feature.pending,null);
});
test('offline installing worker waits until cache installation finishes; failure never announces ready',async t=>{
 const timeouts=[];t.mock.method(globalThis,'setTimeout',(fn)=>{timeouts.push(fn);return 1;});t.mock.method(globalThis,'clearTimeout',()=>{});
 const e=environment();e.worker.state='installing';e.registration.installing=e.worker;e.registration.active=null;
 const operation=e.feature.prepareOffline();await tick();assert.equal(e.feature.snapshot().status,'downloading');assert.equal(e.worker.listeners.get('statechange').size,1);
 e.worker.state='installed';e.worker.dispatch('statechange');await operation;assert.equal(e.feature.snapshot().status,'ready');assert.equal(e.worker.listeners.get('statechange').size,0);
 const bad=environment();bad.worker.state='installing';bad.registration.installing=bad.worker;bad.registration.active=null;const failed=bad.feature.prepareOffline();const rejected=assert.rejects(failed,/offline-download-failed/);await tick();bad.worker.state='redundant';bad.worker.dispatch('statechange');await rejected;assert.equal(bad.feature.snapshot().status,'error');
});
test('offline timeout resets pending/preparing and can be retried',async t=>{
 let timeout;t.mock.method(globalThis,'setTimeout',fn=>(timeout=fn,1));t.mock.method(globalThis,'clearTimeout',()=>{});
 const e=environment();e.worker.state='installing';e.registration.installing=e.worker;e.registration.active=null;const operation=e.feature.prepareOffline(),rejected=assert.rejects(operation,/offline-timeout/);await tick();timeout();await rejected;assert.equal(e.feature.pending,null);assert.equal(e.feature.snapshot().preparing,false);
 e.worker.state='activated';e.registration.installing=null;e.registration.active=e.worker;await e.feature.prepareOffline();assert.equal(e.feature.snapshot().status,'ready');
});
test('only offline progress messages update status; ready cache reports are reflected to UI',()=>{
 const e=environment();e.nav.serviceWorker.dispatch('message',{data:{type:'other',status:'ready'}});assert.equal(e.feature.snapshot().status,'idle');
 e.nav.serviceWorker.dispatch('message',{data:{type:'DUNE_OFFLINE_PROGRESS',status:'downloading',loaded:10,total:100,bytes:1000,totalBytes:9000,version:'v1'}});assert.equal(e.feature.snapshot().preparing,true);assert.equal(e.feature.snapshot().loaded,10);
 e.nav.serviceWorker.dispatch('message',{data:{type:'DUNE_OFFLINE_PROGRESS',status:'ready',loaded:100,total:100,version:'v1'}});assert.equal(e.feature.snapshot().preparing,false);assert.equal(e.feature.snapshot().status,'ready');
});
test('source action opens the actual public repository without an opener',()=>{const e=environment();e.feature.openSource();assert.deepEqual(e.opens,[[SOURCE_URL,'_blank','noopener,noreferrer']]);});

function documentForFiles(){
 const elements=[],removed=[],clicks=[],doc={body:{append:element=>elements.push(element)},createElement(tag){const element=events({tag,style:{},click(){clicks.push(this);},remove(){removed.push(this);}});return element;}};
 return {doc,elements,removed,clicks};
}
test('file picker opens immediately, ignores cancellation, and supplies one selected File then cleans up',()=>{
 const e=documentForFiles(),files=[],input=pickSaveFile(file=>files.push(file),{doc:e.doc});assert.equal(e.clicks[0],input);assert.equal(input.type,'file');assert.match(input.accept,/application\/json/);assert.equal(files.length,0);
 const file={name:'backup.json'};input.files=[file];input.dispatch('change');assert.deepEqual(files,[file]);assert(e.removed.includes(input));
 const other=pickSaveFile(file=>files.push(file),{doc:e.doc});other.dispatch('cancel');assert.equal(files.length,1);assert(e.removed.includes(other));
});
test('regular save download creates one Blob link and later releases its URL',async t=>{
 const timers=[];t.mock.method(globalThis,'setTimeout',(fn,delay)=>(timers.push({fn,delay}),1));
 const e=documentForFiles(),created=[],revoked=[],url={createObjectURL:blob=>(created.push(blob),'blob:save'),revokeObjectURL:href=>revoked.push(href)};
 assert.equal(await downloadSave({text:'{"save":true}',filename:'backup.json'},{nav:{userAgent:'Desktop'},doc:e.doc,url}),true);assert.equal(created.length,1);assert.equal(await created[0].text(),'{"save":true}');assert.equal(e.clicks.length,1);assert.equal(e.clicks[0].download,'backup.json');assert.equal(e.clicks[0].href,'blob:save');assert.equal(e.removed.length,1);assert.deepEqual(revoked,[]);assert.equal(timers[0].delay,60000);timers[0].fn();assert.deepEqual(revoked,['blob:save']);
});
test('iPhone share uses Files-compatible File immediately; dismissal does not create an unwanted download',async()=>{
 const e=documentForFiles(),calls=[];const nav={userAgent:'iPhone',canShare:({files})=>files.length===1,share:options=>(calls.push(options),Promise.resolve())};
 const shared=downloadSave({text:'{}',filename:'backup.json'},{nav,doc:e.doc});assert.equal(calls.length,1);assert.equal(calls[0].files[0].name,'backup.json');assert.equal(await shared,true);assert.equal(e.clicks.length,0);
 nav.share=()=>Promise.reject(Object.assign(Error('cancelled'),{name:'AbortError'}));assert.equal(await downloadSave({text:'{}',filename:'backup.json'},{nav,doc:e.doc}),false);assert.equal(e.clicks.length,0);
});
test('unsupported or failed iPhone file sharing falls back to a normal download',async t=>{
 t.mock.method(globalThis,'setTimeout',()=>1);for(const canShare of [()=>false,()=>true]){
  const e=documentForFiles(),url={createObjectURL:()=> 'blob:save',revokeObjectURL(){}};const nav={userAgent:'iPhone',canShare,share:()=>Promise.reject(Error('sharing not available'))};assert.equal(await downloadSave({text:'{}',filename:'backup.json'},{nav,doc:e.doc,url}),true);assert.equal(e.clicks.length,1);
 }
});
