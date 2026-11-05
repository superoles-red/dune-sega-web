import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {loadAssetImage,loadAssetJSON,runAssetPool,ASSET_CONCURRENCY,AssetLoadError} from '../web/asset-loader.mjs';
import {NativeArt} from '../web/native-ui.mjs';

function imageFactory(plans=['ok']){
 const instances=[],urls=[];let active=0,peak=0;
 class FakeImage {
  constructor(){instances.push(this);this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}
  set src(value){this.url=String(value);urls.push(this.url);this.plan=plans[Math.min(instances.length-1,plans.length-1)];this.running=true;active++;peak=Math.max(peak,active);if(this.plan==='network')queueMicrotask(()=>{this.end();this.onerror?.({});});}
  get src(){return this.url;}
  end(){if(this.running){this.running=false;active--;}}
  decode(){return new Promise((resolve,reject)=>{
   if(this.plan==='network'||this.plan==='hang')return;
   queueMicrotask(()=>{this.end();if(this.plan==='decode')reject(Error('transient decode error'));else if(this.plan==='invalid')resolve();else{this.complete=true;this.naturalWidth=1;this.naturalHeight=2;if(this.plan==='safari')reject(Error('Safari decode rejected loaded PNG'));else resolve();}});
  });}
  removeAttribute(name){assert.equal(name,'src');this.removed=true;this.end();}
 }
 return {ImageCtor:FakeImage,instances,urls,get active(){return active;},get peak(){return peak;}};
}
test('lazy image jobs are bounded and returned in input order, including all retries',async()=>{
 let active=0,peak=0,started=0;const jobs=Array.from({length:55},(_,index)=>async()=>{started++;active++;peak=Math.max(peak,active);await delay(index%3);active--;return index;});
 assert.equal(started,0);const result=await runAssetPool(jobs,{concurrency:6});assert.equal(peak,6);assert.equal(active,0);assert.deepEqual(result,Array.from({length:55},(_,index)=>index));assert.deepEqual(await runAssetPool([]),[]);
});
test('a failed job stops scheduling new jobs and reports the original asset error',async()=>{
 let started=0;const failure=new AssetLoadError('broken.png',3,Error('decode'));const jobs=Array.from({length:20},(_,index)=>async()=>{started++;if(index===1)throw failure;await delay(2);});
 await assert.rejects(runAssetPool(jobs,{concurrency:3}),error=>error===failure);await delay(5);assert.equal(started,3,'unscheduled work must not start after a terminal error');
});
test('successful images keep HTMLImageElement identity and the first original URL',async()=>{
 const f=imageFactory(),image=await loadAssetImage('./chrome/tiny.png',{...f,retryDelayMs:0});assert.equal(image,f.instances[0]);assert.deepEqual(f.urls,['./chrome/tiny.png']);assert.equal(image.onload,null);assert.equal(image.onerror,null);assert.equal(image.removed,undefined);assert.equal(image.naturalWidth,1);
});
test('transient network and decode errors retry fresh images with cache-busting queries',async()=>{
 const f=imageFactory(['network','decode','ok']),sleeps=[];const image=await loadAssetImage('./chrome/tiny.png?lang=ru#pixel',{...f,sleep:async ms=>sleeps.push(ms)});
 assert.equal(image,f.instances[2]);assert.deepEqual(f.urls,['./chrome/tiny.png?lang=ru#pixel','./chrome/tiny.png?lang=ru&dune-image-retry=1#pixel','./chrome/tiny.png?lang=ru&dune-image-retry=2#pixel']);assert.deepEqual(sleeps,[120,240]);assert(f.instances[0].removed);assert(f.instances[1].removed);assert.equal(f.active,0);
});
test('Safari decode rejection accepts an independently complete positive-size PNG without retry',async()=>{
 const f=imageFactory(['safari']);const image=await loadAssetImage('cash-window-clean-right.png',{...f,retryDelayMs:0});assert.equal(image,f.instances[0]);assert.equal(f.urls.length,1);assert.equal(image.complete,true);assert.equal(image.naturalWidth,1);assert.equal(image.removed,undefined);
});
test('decode-less browsers use load events and reject load events without usable pixels',async()=>{
 const instances=[];class LoadImage{constructor(){instances.push(this);}set src(url){this.url=url;queueMicrotask(()=>{this.complete=true;this.naturalWidth=2;this.naturalHeight=3;this.onload();});}}
 assert.equal(await loadAssetImage('old-browser.png',{ImageCtor:LoadImage}),instances[0]);
 class EmptyImage{set src(url){queueMicrotask(()=>{this.complete=true;this.naturalWidth=0;this.naturalHeight=0;this.onload();});}}
 await assert.rejects(loadAssetImage('empty.png',{ImageCtor:EmptyImage,retryDelayMs:0,sleep:async()=>{}}),error=>error instanceof AssetLoadError&&error.url==='empty.png'&&error.attempts===3);
});
test('corrupt PNG and stalled loads have finite attempts, filename errors, and detached listeners',async()=>{
 for(const mode of ['invalid','hang']){
  const f=imageFactory([mode]);await assert.rejects(loadAssetImage('./parts/broken-'+mode+'.png',{...f,timeoutMs:5,retryDelayMs:0}),error=>error instanceof AssetLoadError&&error.attempts===3&&error.message.includes('broken-'+mode+'.png'));
  assert.equal(f.instances.length,3);assert.equal(f.active,0);for(const image of f.instances){assert.equal(image.onload,null);assert.equal(image.onerror,null);assert.equal(image.removed,true);}
 }
});
test('a synchronous Image constructor error is bounded and names its source',async()=>{
 let attempts=0;class BrokenImage{constructor(){attempts++;throw Error('image allocation failed');}}
 await assert.rejects(loadAssetImage('allocation.png',{ImageCtor:BrokenImage,sleep:async()=>{}}),error=>error.message.includes('allocation.png')&&error.cause.message==='image allocation failed');assert.equal(attempts,3);
});
test('manifest loading checks HTTP status and retries network/JSON failures finitely',async()=>{
 const calls=[],plans=[()=>Promise.reject(Error('network')),()=>({ok:false,status:503,json(){assert.fail('must not parse non-OK response');}}),()=>({ok:true,json:async()=>({parts:{native:true}})})];
 const result=await loadAssetJSON('./manifest.json',{fetcher:async(url,{signal})=>{assert(signal instanceof AbortSignal);calls.push(url);return plans[calls.length-1]();},sleep:async()=>{}});assert.deepEqual(result,{parts:{native:true}});assert.deepEqual(calls,['./manifest.json','./manifest.json?dune-image-retry=1','./manifest.json?dune-image-retry=2']);
 await assert.rejects(loadAssetJSON('bad.json',{fetcher:async()=>({ok:true,json:async()=>{throw Error('invalid JSON');}}),sleep:async()=>{}}),error=>error instanceof AssetLoadError&&error.url==='bad.json'&&error.attempts===3);
});
test('a stalled manifest request times out, aborts transport, and never hangs the loader',async()=>{
 const signals=[];await assert.rejects(loadAssetJSON('stalled.json',{fetcher:(_url,{signal})=>(signals.push(signal),new Promise(()=>{})),timeoutMs:4,retryDelayMs:0}),error=>error.message.includes('stalled.json')&&error.attempts===3);assert.equal(signals.length,3);assert(signals.every(signal=>signal.aborted));
});
test('NativeArt queues shop, screen, and both locale images in the same bounded pool with exact lookup keys',async()=>{
 const previousFetch=globalThis.fetch,previousImage=globalThis.Image;let active=0,peak=0;const sources=[];
 class Image{constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}set src(url){this.url=String(url);sources.push(this.url);active++;peak=Math.max(peak,active);}get src(){return this.url;}async decode(){await delay(1);active--;this.complete=true;this.naturalWidth=2;this.naturalHeight=2;}}
 const shop={parts:Object.fromEntries(Array.from({length:15},(_,i)=>['part'+i,{path:'shop'+i+'.png'}])),fonts:{font:{path:'shop0.png'}},animations:{blink:{states:[{path:'shop1.png'}]}}},screen={parts:{panel:{path:'screen.png'}},fonts:{},animations:{}};
 globalThis.Image=Image;globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('shop-layout-kit')?shop:screen});
 let languageLoaded=false;const art={images:new Map(),ready:false,language:{async load(){languageLoaded=true;this.manifest={languages:[{font:{maskPath:'en-font.png',shadowPath:'en-shadow.png'},commands:{exit:'en-exit.png'}},{font:{maskPath:'ru-font.png',shadowPath:'ru-shadow.png'},commands:{exit:'ru-exit.png',same:'en-exit.png'}}]};}}};
 try{assert.equal(await NativeArt.prototype.load.call(art,{atlas:false}),art);assert.equal(languageLoaded,true);assert.equal(art.ready,true);assert.equal(peak,ASSET_CONCURRENCY);assert.equal(active,0);assert.equal(art.images.size,22);assert.equal(sources.length,22,'duplicate native and locale paths must load once');assert(art.images.get('shop:shop0.png') instanceof Image);assert(art.images.get('screen:screen.png') instanceof Image);assert(art.images.get('locale:en-font.png') instanceof Image);assert(art.images.get('locale:ru-font.png') instanceof Image);}finally{globalThis.fetch=previousFetch;globalThis.Image=previousImage;}
});
test('parallel metadata loading remains unready and names the failed manifest',async()=>{
 const previousFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:false,status:404});let languageLoads=0;const art={ready:true,images:new Map(),language:{async load(){languageLoads++;}}};
 try{await assert.rejects(NativeArt.prototype.load.call(art),error=>error.name==='AssetLoadError'&&error.attempts===3&&/manifest\.json/.test(error.message));assert.equal(art.ready,false);assert.equal(languageLoads,1);}finally{globalThis.fetch=previousFetch;}
});
