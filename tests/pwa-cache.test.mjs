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
function host({version='new',corrupt=null,fail=null,old=true,transient=null,timeoutPath=null,noAbortController=false}={}){
 const listeners={},messages=[],network=[],data=new Map(),attempts=new Map(),scope='https://example.test/dune-sega-web/';
 const prefix='dune-sega-offline:/dune-sega-web/:';
 if(old)data.set(prefix+'old',new Map([['preserved',new Response('old')]]));
 data.set('unrelated-site-cache',new Map());
 const cacheFor=name=>({async put(key,response){if(fail==='put')throw Error('quota');data.get(name).set(String(key),response.clone());},async match(key){if(fail==='match')throw Error('cache match denied');return data.get(name).get(String(key))?.clone();}});
 const caches={async keys(){return [...data.keys()];},async open(name){if(fail==='open')throw Error('cache open denied');if(!data.has(name))data.set(name,new Map());return cacheFor(name);},async delete(name){return data.delete(name);}};
 const self={registration:{scope},clients:{async matchAll(){return [{postMessage:m=>messages.push(m)}];}},addEventListener:(name,fn)=>listeners[name]=fn};
 const fetch=async (request,options)=>{
  const url=typeof request==='string'?request:request.url;network.push({url,options});
  const path=new URL(url).pathname.replace('/dune-sega-web/','');
  const count=(attempts.get(path)||0)+1;attempts.set(path,count);
  if(path===timeoutPath)return new Promise((_,reject)=>options.signal?.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
  if(transient?.path===path&&count<=transient.count){
   if(transient.kind==='network')throw TypeError('Load failed');
   if(transient.kind==='http')return new Response('try again',{status:500});
   if(transient.kind==='corrupt')return new Response('stale cached bytes');
  }
  if(path===fail)throw TypeError('Load failed');
  if(!fixtures.has(path))throw Error('not allowed '+path);
  return new Response(path===corrupt?'tampered':fixtures.get(path));
 };
 const script=template.replace('__DUNE_CACHE_VERSION__',version).replace('/*__DUNE_PRECACHE__*/ []',JSON.stringify(entries));
 runInNewContext(script,{self,caches,fetch,crypto:webcrypto,URL,Response,Uint8Array,console,
  AbortController:noAbortController?undefined:AbortController,
  setTimeout:timeoutPath?(fn,ms)=>setTimeout(fn,Math.min(ms,1)):setTimeout,clearTimeout});
 const event=async(name,values={})=>{
  let promise;listeners[name]({...values,waitUntil:p=>promise=p,respondWith:p=>promise=p});
  return promise?await promise:undefined;
 };
 return {event,data,messages,network,attempts,scope,prefix,cacheName:prefix+version};
}

test('complete verified package installs without replacing a running worker',async()=>{
 const h=host();await h.event('install');
 assert.equal(h.network.length,entries.length);
 assert.equal(h.data.get(h.cacheName).size,entries.length+1);
 assert.equal(h.messages.at(-1).status,'ready');
 assert.equal(h.messages.at(-1).bytes,entries.reduce((n,e)=>n+e.bytes,0));
 assert.ok(h.data.has(h.prefix+'old'),'old worker cache survives install');
 assert.ok(!template.includes('self.skipWaiting('));assert.ok(!template.includes('self.clients.claim('));
 await h.event('activate');
 assert.ok(!h.data.has(h.prefix+'old'));assert.ok(h.data.has('unrelated-site-cache'));
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

test('hung fetches have a finite deadline and three attempts with or without AbortController',async()=>{
 for(const noAbortController of [false,true]){
  const h=host({timeoutPath:'shell.js',noAbortController});await assert.rejects(()=>h.event('install'),/after 3 attempts: shell.js/);
  assert.equal(h.attempts.get('shell.js'),3);assert.ok(h.data.has(h.prefix+'old'));assert.ok(!h.data.has(h.cacheName));
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
