import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const template=await readFile(new URL('../web/service-worker.js',import.meta.url),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fixtures=new Map([['index.html','<html>game</html>'],['shell.js','game();'],['engine/dune_web.wasm','wasm'],['native-audio-worklet.js','audio();']]);
const entries=[...fixtures].map(([path,data])=>({path,bytes:Buffer.byteLength(data),sha256:hash(data)}));
function host({version='new',corrupt=null,fail=null,old=true,transient=null,timeoutPath=null,noAbortController=false,windows=[],packageFiles=fixtures,storage=null}={}){
 const listeners={},messages=[],network=[],data=storage||new Map(),attempts=new Map(),scope='https://example.test/dune-sega-web/';
 // The timeout test advances only the hung resource's clock. Accelerating
 // every real30s deadline to1ms also races legitimate Response/crypto work
 // under parallel suite load, which says nothing about the worker's deadline.
 let fetchingPath,timerId=0;
 const timers=new Map(),timerWaiters=new Map(),firedDeadlines=[],abortedPaths=[];
 const deadlineClock={
  next(path){
   const timer=[...timers.values()].find(timer=>timer.path===path);
   return timer?Promise.resolve(timer):new Promise(resolve=>timerWaiters.set(path,resolve));
  },
  fire(timer){assert.ok(timers.delete(timer.id),'deadline is active and fires only once');firedDeadlines.push(timer);timer.callback();},
  fired:firedDeadlines,
 };
 const scheduleDeadline=(callback,ms)=>{
  const timer={id:++timerId,path:fetchingPath,ms,callback};timers.set(timer.id,timer);
  const resolve=timerWaiters.get(timer.path);if(resolve){timerWaiters.delete(timer.path);resolve(timer);}
  return timer.id;
 };
 const prefix='dune-sega-offline:/dune-sega-web/:';
 if(old&&!data.has(prefix+'old'))data.set(prefix+'old',new Map([['preserved',new Response('old')]]));
 if(!data.has('unrelated-site-cache'))data.set('unrelated-site-cache',new Map());
 const cacheFor=name=>({async put(key,response){if(fail==='put')throw Error('quota');data.get(name).set(String(key),response.clone());},async match(key){if(fail==='match')throw Error('cache match denied');return data.get(name).get(String(key))?.clone();}});
 let cacheEnumerations=0;
 const caches={async keys(){cacheEnumerations++;return [...data.keys()];},async open(name){if(fail==='open')throw Error('cache open denied');if(!data.has(name))data.set(name,new Map());return cacheFor(name);},async delete(name){return data.delete(name);}};
 let activations=0;
 const self={registration:{scope},skipWaiting:async()=>{activations++;},clients:{async matchAll(){return windows;}},addEventListener:(name,fn)=>listeners[name]=fn};
 windows.forEach(client=>client.postMessage??=(m=>messages.push(m)));
 // Progress listeners need not be a game window.
 if(!windows.length)windows.push({id:'observer',url:scope+'update.html',postMessage:m=>messages.push(m)});
 const fetch=async (request,options)=>{
  const url=typeof request==='string'?request:request.url;network.push({url,options});
  const path=new URL(url).pathname.replace('/dune-sega-web/','');
  fetchingPath=path;
  const count=(attempts.get(path)||0)+1;attempts.set(path,count);
  if(path===timeoutPath)return new Promise((_,reject)=>options.signal?.addEventListener('abort',()=>{abortedPaths.push(path);reject(Error('aborted'));},{once:true}));
  if(transient?.path===path&&count<=transient.count){
   if(transient.kind==='network')throw TypeError('Load failed');
   if(transient.kind==='http')return new Response('try again',{status:500});
   if(transient.kind==='corrupt')return new Response('stale cached bytes');
  }
  if(path===fail)throw TypeError('Load failed');
  if(!packageFiles.has(path))throw Error('not allowed '+path);
  return new Response(path===corrupt?'tampered':packageFiles.get(path));
 };
 const packageEntries=[...packageFiles].map(([path,data])=>({path,bytes:Buffer.byteLength(data),sha256:hash(data)}));
 const script=template.replace('__DUNE_CACHE_VERSION__',version).replace('/*__DUNE_PRECACHE__*/ []',JSON.stringify(packageEntries));
 const restartWorker=()=>runInNewContext(script,{self,caches,fetch,crypto:webcrypto,URL,Response,Uint8Array,console,
  AbortController:noAbortController?undefined:AbortController,
  setTimeout:timeoutPath?scheduleDeadline:setTimeout,
  clearTimeout:timeoutPath?id=>timers.delete(id):clearTimeout});
 restartWorker();
 const event=async(name,values={})=>{
  let promise;listeners[name]({...values,waitUntil:p=>promise=p,respondWith:p=>promise=p});
  return promise?await promise:undefined;
 };
 return {event,data,messages,network,attempts,scope,prefix,cacheName:prefix+version,deadlineClock,abortedPaths,windows,restartWorker,get activations(){return activations;},get cacheEnumerations(){return cacheEnumerations;}};
}
function seedPrevious(h,{name='old',files=fixtures,complete=true,prefix=h.prefix,markerVersion=name}={}){
 const contents=new Map([...files].map(([path,data])=>[h.scope+path,new Response(data,{headers:{'Content-Type':path.endsWith('.wasm')?'application/wasm':'application/octet-stream'}})]));
 if(complete)contents.set(h.scope+'__offline_ready__',new Response(JSON.stringify({version:markerVersion,files:files.size})));
 h.data.set(prefix+name,contents);return contents;
}

test('complete verified package installs without replacing a running worker',async()=>{
 const h=host();await h.event('install');
 assert.equal(h.network.length,entries.length);
 assert.equal(h.data.get(h.cacheName).size,entries.length+1);
 assert.equal(h.messages.at(-1).status,'ready');
 assert.equal(h.messages.at(-1).bytes,entries.reduce((n,e)=>n+e.bytes,0));
 assert.ok(h.data.has(h.prefix+'old'),'old worker cache survives install');
 assert.equal(h.activations,0,'installation cannot take over a running game');assert.ok(!template.includes('self.clients.claim('));
 await h.event('activate');
 assert.ok(!h.data.has(h.prefix+'old'));assert.ok(h.data.has('unrelated-site-cache'));
});

test('unchanged assets, including a large WASM response, are verified and copied without network downloads',async()=>{
 const packageFiles=new Map(fixtures);packageFiles.set('engine/dune_web.wasm',Buffer.alloc(128*1024,0x5a));
 const h=host({packageFiles}),old=seedPrevious(h,{files:packageFiles});await h.event('install');
 assert.equal(h.network.length,0,'all new-release hashes match the preceding complete package');
 assert.equal(h.cacheEnumerations,1,'candidate caches are discovered once per install');
 assert.equal(h.data.get(h.cacheName).size,packageFiles.size+1);assert.equal(h.messages.at(-1).status,'ready');
 assert.equal(h.messages.at(-1).loaded,packageFiles.size);assert.equal(h.messages.at(-1).bytes,[...packageFiles.values()].reduce((n,b)=>n+Buffer.byteLength(b),0));
 for(const [path,bytes] of packageFiles){
  const copied=h.data.get(h.cacheName).get(h.scope+path),preceding=old.get(h.scope+path);
  assert.equal(hash(Buffer.from(await copied.clone().arrayBuffer())),hash(bytes));
  assert.equal(hash(Buffer.from(await preceding.clone().arrayBuffer())),hash(bytes),'copying leaves old bytes intact');
 }
 assert.equal(h.data.get(h.cacheName).get(h.scope+'engine/dune_web.wasm').headers.get('Content-Type'),'application/wasm');
 assert.ok(h.data.has(h.prefix+'old'));assert.equal(h.activations,0);
});

test('changed or corrupt cached bytes fall back to verified network downloads even with a complete marker',async()=>{
 const oldFiles=new Map(fixtures);oldFiles.set('index.html','old');oldFiles.set('engine/dune_web.wasm','xxxx');
 const h=host(),old=seedPrevious(h,{files:oldFiles});await h.event('install');
 assert.deepEqual(h.network.map(({url})=>new URL(url).pathname.replace('/dune-sega-web/','')).sort(),['engine/dune_web.wasm','index.html']);
 for(const path of ['engine/dune_web.wasm','index.html'])assert.equal(await h.data.get(h.cacheName).get(h.scope+path).clone().text(),fixtures.get(path));
 assert.equal(await old.get(h.scope+'engine/dune_web.wasm').clone().text(),'xxxx','rejected old bytes are never repaired in place');
 assert.equal(h.messages.at(-1).status,'ready');
});

test('markerless, mismatched-marker and foreign-scope caches cannot supply reusable assets',async()=>{
 const h=host({old:false}),incomplete=seedPrevious(h,{name:'partial',complete:false}),mismatched=seedPrevious(h,{name:'mismatch',markerVersion:'different'}),foreign=seedPrevious(h,{name:'foreign',prefix:'dune-sega-offline:/another-game/:'});
 await h.event('install');assert.equal(h.network.length,entries.length);assert.equal(h.cacheEnumerations,1);
 for(const [name,contents]of [[h.prefix+'partial',incomplete],[h.prefix+'mismatch',mismatched],['dune-sega-offline:/another-game/:foreign',foreign]]){
  assert.equal(h.data.get(name),contents,'unusable/foreign packages remain untouched');
  assert.equal(await contents.get(h.scope+'engine/dune_web.wasm').clone().text(),'wasm');
 }
 assert.equal(h.messages.at(-1).status,'ready');
});

test('a failed changed download removes only its new candidate after reusing old verified assets',async()=>{
 const h=host({fail:'shell.js'}),oldFiles=new Map(fixtures);oldFiles.set('shell.js','preceding shell');const old=seedPrevious(h,{files:oldFiles});
 await assert.rejects(()=>h.event('install'),/after 3 attempts: shell.js/);
 assert.equal(h.attempts.get('shell.js'),3);assert.equal(h.network.length,3,'other unchanged files were copied from the complete cache');
 assert.ok(!h.data.has(h.cacheName));assert.equal(h.data.get(h.prefix+'old'),old);assert.ok(old.has(h.scope+'__offline_ready__'));
 assert.equal(await old.get(h.scope+'shell.js').clone().text(),'preceding shell');assert.equal(h.messages.at(-1).status,'error');assert.equal(h.activations,0);
});

test('corrupt bytes or failed download never replace last working offline package',async()=>{
 for(const options of [{corrupt:'engine/dune_web.wasm'},{fail:'shell.js'},{fail:'put'}]){
  const h=host(options);await assert.rejects(()=>h.event('install'));
  assert.ok(h.data.has(h.prefix+'old'));assert.ok(!h.data.has(h.cacheName));
  assert.equal(h.messages.at(-1).status,'error');
 }
});

test('early CacheStorage errors report their detail before any download and still reject install',async()=>{
 for(const [fail,message] of [['open','cache open denied'],['match','cache match denied']]){
  const h=host({fail});await assert.rejects(()=>h.event('install'),new RegExp(message));
  assert.equal(h.network.length,0);assert.ok(h.data.has(h.prefix+'old'));
  assert.equal(h.messages.at(-1).status,'error');assert.equal(h.messages.at(-1).loaded,0);
  assert.equal(h.messages.at(-1).total,entries.length);
  assert.equal(h.messages.at(-1).message,'Error: '+message);
 }
});

test('transient network/HTTP/integrity failures retry cache-busted URLs and store only verified canonical bytes',async()=>{
 for(const kind of ['network','http','corrupt']){
  const h=host({transient:{path:'shell.js',kind,count:1}});await h.event('install');
  const calls=h.network.filter(x=>new URL(x.url).pathname.endsWith('/shell.js'));
  assert.equal(calls.length,2);assert.equal(new URL(calls[0].url).search,'');
  assert.equal(new URL(calls[1].url).searchParams.get('__dune_asset'),hash(fixtures.get('shell.js')));
  assert.equal(new URL(calls[1].url).searchParams.get('__dune_retry'),'1');
  assert.equal(await h.data.get(h.cacheName).get(h.scope+'shell.js').clone().text(),fixtures.get('shell.js'));
  assert.ok(![...h.data.get(h.cacheName).keys()].some(key=>key.includes('__dune_retry')));
  assert.equal(h.messages.at(-1).status,'ready');
 }
});

test('permanent HTTP/network/corrupt failures are bounded at three attempts and preserve previous offline cache',async()=>{
 for(const options of [{transient:{path:'shell.js',kind:'http',count:99}},{fail:'shell.js'},{corrupt:'shell.js'}]){
  const h=host(options);await assert.rejects(()=>h.event('install'),/after 3 attempts: shell.js/);
  assert.equal(h.attempts.get('shell.js'),3);assert.ok(h.data.has(h.prefix+'old'));assert.ok(!h.data.has(h.cacheName));
  assert.equal(h.messages.at(-1).status,'error');assert.match(h.messages.at(-1).message,/shell.js/);
 }
});

test('hung fetches have a finite deadline and three attempts with or without AbortController',{timeout:10000},async()=>{
 for(const noAbortController of [false,true]){
  const h=host({timeoutPath:'shell.js',noAbortController});
  const rejected=assert.rejects(()=>h.event('install'),/after 3 attempts: shell.js/);
  for(let attempt=1;attempt<=3;attempt++){
   const timer=await h.deadlineClock.next('shell.js');
   assert.equal(timer.ms,30000,'each hung attempt has the actual finite production deadline');
   assert.equal(h.attempts.get('shell.js'),attempt,'a new fetch is required before each timeout');
   h.deadlineClock.fire(timer);
  }
  await rejected;
  assert.equal(h.attempts.get('shell.js'),3);assert.ok(h.data.has(h.prefix+'old'));assert.ok(!h.data.has(h.cacheName));
  assert.deepEqual(h.deadlineClock.fired.map(timer=>timer.path),['shell.js','shell.js','shell.js']);
  assert.deepEqual(h.abortedPaths,noAbortController?[]:['shell.js','shell.js','shell.js']);
  for(const path of fixtures.keys())if(path!=='shell.js')assert.equal(h.attempts.get(path),1,'successful resources never time out or retry');
 }
});

test('offline navigation and versioned module/worklet requests use only this coherent scope',async()=>{
 const h=host();await h.event('install');h.network.length=0;
 for(const [url,mode,expected] of [
  [h.scope+'?v=future','navigate',fixtures.get('index.html')],
  [h.scope+'index.html?old=1','navigate',fixtures.get('index.html')],
  [h.scope+'shell.js?v=20261103-safari6','cors',fixtures.get('shell.js')],
  [h.scope+'native-audio-worklet.js?x=1','cors',fixtures.get('native-audio-worklet.js')],
  [h.scope+'engine/dune_web.wasm','cors',fixtures.get('engine/dune_web.wasm')],
 ]){
  const response=await h.event('fetch',{request:{url,method:'GET',mode}});
  assert.equal(await response.text(),expected);
 }
 assert.equal(h.network.length,0);
 for(const request of [
  {url:'https://other.test/shell.js',method:'GET'},
  {url:'https://example.test/another-app/shell.js',method:'GET'},
  {url:h.scope+'not-in-package.png',method:'GET'},
  {url:h.scope+'shell.js',method:'POST'},
 ])assert.equal(await h.event('fetch',{request}),undefined);
 assert.equal(h.data.get(h.cacheName).size,entries.length+1,'no runtime/unbounded caching');
});

test('offline ready status is false until all files and completion marker exist',async()=>{
 const h=host({old:false});const replies=[];
 const ask=()=>h.event('message',{data:{type:'DUNE_OFFLINE_STATUS'},ports:[{postMessage:m=>replies.push(m)}]});
 await ask();assert.equal(replies.at(-1).status,'downloading');
 await h.event('install');await ask();assert.equal(replies.at(-1).status,'ready');
 assert.equal(replies.at(-1).total,entries.length);
 const incomplete=host();await assert.rejects(()=>incomplete.event('activate'));
 assert.ok(incomplete.data.has(incomplete.prefix+'old'),'incomplete candidate cannot evict working version');
});

test('only the standalone updater can apply a verified package, with all game windows closed',async()=>{
 const h=host();await h.event('install');const replies=[];
 const apply=source=>h.event('message',{data:{type:'DUNE_APPLY_UPDATE'},source,ports:[{postMessage:value=>replies.push(value)}]});
 await apply({id:'unknown'});assert.equal(replies.at(-1).status,'denied');assert.equal(h.activations,0);
 h.windows.push({id:'playing',url:h.scope+'?v=old',postMessage(){}});
 await apply({id:'playing'});assert.equal(replies.at(-1).status,'denied');
 await apply({id:'observer'});assert.equal(replies.at(-1).status,'blocked');assert.equal(replies.at(-1).count,1);assert.equal(h.activations,0);
 // A navigation or hidden/uncontrolled game tab also blocks activation.
 h.windows.push({id:'other',url:h.scope+'index.html',postMessage(){}});
 await apply({id:'observer'});assert.equal(replies.at(-1).count,2);
 h.windows.splice(1);await apply({id:'observer'});assert.equal(replies.at(-1).status,'applying');assert.equal(h.activations,1);
 assert.ok(h.data.has(h.prefix+'old'),'applying never deletes the preceding cache before activation');
 const incomplete=host(),out=[];await incomplete.event('message',{data:{type:'DUNE_APPLY_UPDATE'},source:{id:'observer'},ports:[{postMessage:value=>out.push(value)}]});
 assert.equal(out.at(-1).status,'incomplete');assert.equal(incomplete.activations,0);
});

test('activation retains older packages if a game window appeared after the update check',async()=>{
 const h=host();await h.event('install');h.windows.push({id:'race',url:h.scope+'?v=old',postMessage(){}});await h.event('activate');
 assert.ok(h.data.has(h.prefix+'old'));assert.ok(h.data.has(h.cacheName));
});

async function applyPackage(h,data={},source='observer'){
 const replies=[];await h.event('message',{data:{type:'DUNE_APPLY_UPDATE',...data},source:{id:source},ports:[{postMessage:value=>replies.push(value)}]});return replies.at(-1);
}
async function packageStatus(h){
 const replies=[];await h.event('message',{data:{type:'DUNE_OFFLINE_STATUS'},ports:[{postMessage:value=>replies.push(value)}]});return replies.at(-1);
}
async function cachedFetch(h,path,{clientId,mode='cors',resultingClientId}={}){
 const response=await h.event('fetch',{clientId,resultingClientId,request:{url:h.scope+path,method:'GET',mode}});return response?.text();
}
test('explicit restart activates with other windows and pins their old lazy assets without claiming or reloading them',async()=>{
 const h=host(),oldFiles=new Map(fixtures);oldFiles.set('shell.js','old shell');oldFiles.set('removed-from-new.js','old lazy chunk');
 oldFiles.set('icons/old-only.png','old icon pixels');
 const old=seedPrevious(h,{files:oldFiles});await h.event('install');
 const sent=[];h.windows.push({id:'playing',url:h.scope+'?v=old',postMessage:m=>sent.push(m)});
 assert.equal((await applyPackage(h)).status,'blocked');assert.equal(h.activations,0,'background automatic apply still waits');
 assert.equal((await applyPackage(h,{restart:true,previousVersion:'old',clientVersions:{}})).status,'applying');
 assert.equal(h.activations,1);await h.event('activate');
 assert.equal(h.data.get(h.prefix+'old'),old,'the preceding complete cache survives');
 assert.equal(await cachedFetch(h,'shell.js?v=old',{clientId:'playing'}),'old shell');
 assert.equal(await cachedFetch(h,'removed-from-new.js?v=old',{clientId:'playing'}),'old lazy chunk','old-only lazy paths do not fall through to the new manifest');
 assert.equal(await cachedFetch(h,'icons/old-only.png?v=old',{clientId:'playing'}),'old icon pixels','old-only graphical assets stay in the same pinned package');
 assert(!sent.some(m=>/reload|close|navigate/i.test(m.type)),'other windows only receive offline progress');
 const status=await packageStatus(h);assert.equal(status.clientVersions.playing,'old');
 assert(!template.includes('self.clients.claim('));
});
test('explicit activation without visible games keeps the reserved-document fallback across worker restart',async()=>{
 const h=host(),oldFiles=new Map(fixtures);oldFiles.set('shell.js','preceding shell');oldFiles.set('icons/old-only.png','preceding icon');
 seedPrevious(h,{files:oldFiles});seedPrevious(h,{name:'unreferenced'});await h.event('install');
 assert.equal((await applyPackage(h,{restart:true,previousVersion:'old',clientVersions:{}})).status,'applying');
 await h.event('activate');
 assert(h.data.has(h.prefix+'old'),'the preceding fallback survives even with no visible game windows');
 assert(!h.data.has(h.prefix+'unreferenced'),'unreferenced owned caches can still be collected');
 h.restartWorker();h.windows.push({id:'reserved-old',url:h.scope,postMessage(){}});
 assert.equal(await cachedFetch(h,'shell.js?v=old',{clientId:'reserved-old'}),'preceding shell');
 assert.equal(await cachedFetch(h,'icons/old-only.png?v=old',{clientId:'reserved-old'}),'preceding icon');
 const status=await packageStatus(h);assert.equal(status.clientVersions['reserved-old'],'old');
 assert(h.data.has('unrelated-site-cache'),'another site cache is never collected');
});
test('new navigations use the new package while old-client pins survive worker termination',async()=>{
 const h=host(),oldFiles=new Map(fixtures);oldFiles.set('shell.js','old shell');seedPrevious(h,{files:oldFiles});await h.event('install');
 h.windows.push({id:'playing',url:h.scope+'index.html',postMessage(){}});
 await applyPackage(h,{restart:true,previousVersion:'old',clientVersions:{playing:'old'}});await h.event('activate');
 assert.equal(await cachedFetch(h,'index.html?updated=new',{mode:'navigate',clientId:'observer',resultingClientId:'fresh'}),fixtures.get('index.html'));
 h.windows.push({id:'fresh',url:h.scope+'index.html?updated=new',postMessage(){}});
 assert.equal(await cachedFetch(h,'shell.js?v=new',{clientId:'fresh'}),'game();');
 h.restartWorker();
 assert.equal(await cachedFetch(h,'shell.js?v=old',{clientId:'playing'}),'old shell');
 assert.equal(await cachedFetch(h,'shell.js?v=new',{clientId:'fresh'}),'game();');
 const status=await packageStatus(h);assert.equal(status.clientVersions.playing,'old');assert.equal(status.clientVersions.fresh,'new');
});
test('activation resnapshots racing windows, and previous package status supports legacy first upgrades',async()=>{
 const h=host(),oldFiles=new Map(fixtures);oldFiles.set('shell.js','legacy shell');seedPrevious(h,{files:oldFiles});await h.event('install');
 // A legacy worker returns only version, so the updater supplies an empty map.
 await applyPackage(h,{restart:true,previousVersion:'old',clientVersions:{}});
 h.windows.push({id:'race',url:h.scope+'index.html',postMessage(){}});await h.event('activate');
 assert.equal(await cachedFetch(h,'shell.js?v=old',{clientId:'race'}),'legacy shell');
 assert.equal(await cachedFetch(h,'shell.js?v=old',{clientId:'reserved-old-document'}),'legacy shell','a document completing around activation uses the preceding package');
 assert(h.data.has(h.prefix+'old'));
});
test('multiple update generations retain each live client package and new navigation advances only that client',async()=>{
 const first=host({version:'middle'}),oldFiles=new Map(fixtures);oldFiles.set('shell.js','first generation');seedPrevious(first,{files:oldFiles});await first.event('install');
 first.windows.push({id:'oldest',url:first.scope,postMessage(){}});
 await applyPackage(first,{restart:true,previousVersion:'old',clientVersions:{}});await first.event('activate');
 await cachedFetch(first,'index.html',{mode:'navigate',resultingClientId:'middle-tab'});first.windows.push({id:'middle-tab',url:first.scope,postMessage(){}});
 const before=await packageStatus(first),newFiles=new Map(fixtures);newFiles.set('shell.js','latest generation');
 const latest=host({version:'latest',storage:first.data,windows:first.windows,packageFiles:newFiles});await latest.event('install');
 await applyPackage(latest,{restart:true,previousVersion:before.version,clientVersions:before.clientVersions});await latest.event('activate');latest.restartWorker();
 assert.equal(await cachedFetch(latest,'shell.js',{clientId:'oldest'}),'first generation');
 assert.equal(await cachedFetch(latest,'shell.js',{clientId:'middle-tab'}),'game();');
 await cachedFetch(latest,'index.html',{mode:'navigate',clientId:'oldest',resultingClientId:'restarted-tab'});latest.windows.push({id:'restarted-tab',url:latest.scope,postMessage(){}});
 assert.equal(await cachedFetch(latest,'shell.js',{clientId:'restarted-tab'}),'latest generation');
 assert(latest.data.has(latest.prefix+'old'));assert(latest.data.has(latest.prefix+'middle'));
});
test('explicit restart refuses untrusted sources, incomplete packages and invalid previous-client pins',async()=>{
 const h=host();seedPrevious(h);await h.event('install');h.windows.push({id:'playing',url:h.scope,postMessage(){}});
 for(const source of ['unknown','playing'])assert.equal((await applyPackage(h,{restart:true,previousVersion:'old',clientVersions:{}},source)).status,'denied');
 for(const data of [{restart:true},{restart:true,previousVersion:'missing',clientVersions:{}},{restart:true,previousVersion:'old',clientVersions:{playing:'missing'}},{restart:true,previousVersion:'../foreign',clientVersions:{}}])assert.equal((await applyPackage(h,data)).status,'incomplete');
 assert.equal(h.activations,0);assert(h.data.has(h.prefix+'old'));
 const incomplete=host();assert.equal((await applyPackage(incomplete,{restart:true,previousVersion:'old',clientVersions:{}})).status,'incomplete');assert.equal(incomplete.activations,0);
});

test('recovery page and script always escape the cache, even if present in a prior manifest',async()=>{
 const h=host();await h.event('install');
 for(const name of ['update.html','update-game.mjs'])assert.equal(await h.event('fetch',{request:{url:h.scope+name,method:'GET',mode:'navigate'}}),undefined);
 const root=fileURLToPath(new URL('..',import.meta.url));
 const output=execFileSync('python3',['-c',String.raw`
import json,sys
from pathlib import Path
sys.path.insert(0,'tools')
from build_publication import add_offline_worker
p={'service-worker.js':Path('web/service-worker.js').read_bytes(),'index.html':b'game','update.html':b'updater','update-game.mjs':b'update script'}
add_offline_worker(p)
print(p['service-worker.js'].decode())
`],{cwd:root,encoding:'utf8'});
 assert.deepEqual(JSON.parse(output.match(/const PRECACHE = (.*);/)[1]).map(x=>x.path),['index.html']);
});

test('builder pins every runtime file without worker/release cycle and changes version with bytes',()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const output=execFileSync('python3',['-c',String.raw`
import json,sys
from pathlib import Path
sys.path.insert(0,'tools')
from build_publication import add_offline_worker
template=Path('web/service-worker.js').read_bytes()
def build(value):
 p={'service-worker.js':template,'index.html':value,'engine/a.wasm':b'wasm','.nojekyll':b'','release.json':b'not runtime'}
 add_offline_worker(p)
 return p['service-worker.js'].decode()
print(json.dumps([build(b'first'),build(b'first'),build(b'changed')]))
`],{cwd:root,encoding:'utf8'});
 const [a,b,c]=JSON.parse(output);assert.equal(a,b);assert.notEqual(a,c);
 assert.ok(!a.includes('__DUNE_CACHE_VERSION__'));assert.ok(!a.includes('/*__DUNE_PRECACHE__*/'));
 const manifest=JSON.parse(a.match(/const PRECACHE = (.*);/)[1]);
 assert.deepEqual(manifest.map(x=>x.path),['engine/a.wasm','index.html']);
 assert.equal(manifest.find(x=>x.path==='index.html').sha256,hash('first'));
});

test('install manifest is scope-relative with actual original-derived PNG icons',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../web/app.webmanifest',import.meta.url),'utf8'));
 for(const key of ['id','scope','start_url'])assert.equal(manifest[key],'./');
 assert.equal(manifest.display,'standalone');
 const proof=JSON.parse(await readFile(new URL('../web/icons/provenance.json',import.meta.url),'utf8'));
 const source=await readFile(new URL('../'+proof.source,import.meta.url));assert.equal(hash(source),proof.sourceSha256);
 for(const icon of manifest.icons){
  const bytes=await readFile(new URL('../web/'+icon.src,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const side=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),side);assert.equal(bytes.readUInt32BE(20),side);
  assert.equal(hash(bytes),proof.files[icon.src.split('/').at(-1)].sha256);
 }
});
