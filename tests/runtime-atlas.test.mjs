import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atlasEntries,loadRuntimeAtlas} from '../web/runtime-atlas.mjs';
import {NativeArt} from '../web/native-ui.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const read=path=>JSON.parse(readFileSync(new URL('../web/'+path,import.meta.url),'utf8'));

function expectedSources(shop,screen,languages){
 const expected=new Map();
 for(const [group,folder,catalogue]of [['shop','shop-layout-kit',shop],['screen','screen-assets',screen]]){
  const files=new Set([...Object.values(catalogue.parts).map(p=>p.path),...Object.values(catalogue.fonts).map(f=>f?.path),...Object.values(catalogue.animations||{}).flatMap(a=>(a.states||[]).map(s=>s.path))].filter(Boolean));
  for(const path of files)expected.set(group+':'+path,'ui-assets/'+folder+'/'+path);
 }
 for(const language of languages.languages)for(const path of [language.font?.maskPath,language.font?.shadowPath,...Object.values(language.commands||{})].filter(Boolean))expected.set('locale:'+path,'language-assets/'+path);
 return expected;
}
function fixture(){
 const shop={parts:{bevel:{path:'bevel.png'},fill:{path:'fill.png'}},fonts:{ui:{path:'bevel.png'}},animations:{blink:{states:[{path:'fill.png'}]}}};
 const screen={parts:{art:{path:'art.png'}},fonts:{},animations:{}};
 const languages={languages:[{code:'en',font:{maskPath:'en-mask.png',shadowPath:'en-shadow.png'},commands:{'exit-enabled':'en-exit.png'}},{code:'ru',font:{maskPath:'ru-mask.png',shadowPath:'ru-shadow.png',glyphs:{}},commands:{'exit-enabled':'ru-exit.png','stop-enabled':'en-exit.png'}}]};
 const expected=expectedSources(shop,screen,languages),manifest={version:1,path:'runtime-atlas.png',width:64,height:32,assets:{}};let i=0;
 for(const [key,source]of expected)manifest.assets[key]={source,rect:[i++*5,2,2+i%3,3]};
 return {shop,screen,languages,expected,manifest};
}

// The browser decoder and canvas are boundaries. Catalogue loading, atlas
// validation, fallback scheduling, key publication and progress are real code.
async function browserFixture(f,options,run){
 const previous={fetch:globalThis.fetch,Image:globalThis.Image,document:globalThis.document,window:globalThis.window,createImageBitmap:globalThis.createImageBitmap},calls={fetch:[],images:[],canvases:[]};
 const doc={documentElement:{},createElement(type){assert.equal(type,'canvas');const canvas={width:0,height:0},context={imageSmoothingEnabled:true,drawImage(...args){context.args=args;}};canvas.context=context;canvas.getContext=(...args)=>{canvas.contextRequest=args;return options.noContextAt===calls.canvases.indexOf(canvas)?null:context;};calls.canvases.push(canvas);return canvas;}};
 class Image {
  constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}
  set src(value){this.url=String(value);calls.images.push(this);}
  get src(){return this.url;}
  async decode(){
   await Promise.resolve();const atlas=this.url.includes('runtime-atlas.png');
   if(atlas&&options.failAtlasImage||!atlas&&options.failOriginalImage)throw Error('transport unavailable');
   this.complete=true;this.naturalWidth=atlas?f.manifest.width+(options.wrongAtlasWidth?1:0):2;this.naturalHeight=atlas?f.manifest.height:3;
  }
  removeAttribute(name){assert.equal(name,'src');this.removed=true;}
 }
 globalThis.Image=Image;globalThis.document=doc;globalThis.window={addEventListener(){}};globalThis.createImageBitmap=undefined;
 globalThis.fetch=async url=>{
  const value=String(url);calls.fetch.push(value);
  const suffix=value.split('?')[0],body=suffix.endsWith('/shop-layout-kit/manifest.json')?f.shop:suffix.endsWith('/screen-assets/manifest.json')?f.screen:suffix.endsWith('/runtime-atlas.json')?f.manifest:suffix.endsWith('/language-assets/manifest.json')?f.languages:suffix.endsWith('/en.json')?{strings:{}}:suffix.endsWith('/ru.json')?{strings:{},bySourceText:{}}:suffix.endsWith('/locale-story-ru.json')?{strings:{},bySourceText:{},sentences:{}}:null;
  assert(body,'unexpected asset '+value);if(options.failAtlasJSON&&suffix.endsWith('/runtime-atlas.json'))return {ok:false,status:503};
  return {ok:true,json:async()=>clone(body)};
 };
 try{return await run({calls,doc,Image});}finally{Object.assign(globalThis,previous);}
}

test('the shipped atlas contains exactly the independent current shop/screen/locale catalogue',()=>{
 const manifest=read('ui-assets/runtime-atlas.json'),expected=expectedSources(read('ui-assets/shop-layout-kit/manifest.json'),read('ui-assets/screen-assets/manifest.json'),read('language-assets/manifest.json'));
 const entries=atlasEntries(manifest,expected,manifest.width,manifest.height);
 assert.equal(entries.length,294);assert.equal(expected.size,294);assert.equal(new Set(entries.map(e=>e[0])).size,expected.size);
 for(const [key,source,rect]of entries){assert.equal(source,expected.get(key));assert.deepEqual(rect,manifest.assets[key].rect);}
});

test('missing, extra, wrong-source and out-of-bounds crops fail before any canvas is created',()=>{
 const f=fixture(),first=[...f.expected.keys()][0];
 for(const edit of [m=>delete m.assets[first],m=>m.assets.extra={source:'extra.png',rect:[0,0,1,1]},m=>m.assets[first].source='other.png',m=>m.assets[first].rect=[-1,0,1,1],m=>m.assets[first].rect=[0,0,0,1],m=>m.assets[first].rect=[0,0,1,0],m=>m.assets[first].rect=[63,0,2,1],m=>m.assets[first].rect=[0,31,1,2],m=>m.assets[first].rect=[.5,0,1,1],m=>m.assets[first].rect=[0,0,1],m=>m.assets[first].rect=[0,0,1,1,2]]){
  const manifest=clone(f.manifest);edit(manifest);assert.throws(()=>atlasEntries(manifest,f.expected,64,32),/native graphics/i);
 }
 for(const edit of [m=>m.version=2,m=>m.path='other.png',m=>m.width=63,m=>m.height=31]){const manifest=clone(f.manifest);edit(manifest);assert.throws(()=>atlasEntries(manifest,f.expected,64,32),/dimensions/i);}
 for(const [width,height]of [[0,32],[64,0],[2049,32],[64,2049]]){const manifest={...f.manifest,width,height};assert.throws(()=>atlasEntries(manifest,f.expected,width,height),/dimensions/i);}
});

test('atlas decoding returns original-size canvases with exact crop calls, source identities and complete progress',async()=>{
 const f=fixture();await browserFixture(f,{},async({calls,doc})=>{
  const progress=[],images=await loadRuntimeAtlas(f.expected,{doc,onProgress:s=>progress.push({...s})});
  assert.equal(calls.images.length,1);assert.equal(calls.fetch.length,1);assert.match(calls.images[0].url,/runtime-atlas\.png\?v=/);
  assert.equal(images.size,f.expected.size);assert.equal(calls.canvases.length,f.expected.size);
  let n=0;for(const [key,path]of f.expected){const image=images.get(key),[x,y,w,h]=f.manifest.assets[key].rect;assert.equal(image,calls.canvases[n++]);assert.equal(image.width,w);assert.equal(image.height,h);assert.deepEqual(image.contextRequest,['2d',{willReadFrequently:true}],'fallback static sources request CPU backing');assert.equal(image.context.imageSmoothingEnabled,false);assert.deepEqual(image.context.args,[calls.images[0],x,y,w,h,0,0,w,h]);assert.equal(image.src,new URL('../web/'+path,import.meta.url).href);}
  assert.deepEqual(progress,Array.from({length:f.expected.size},(_,i)=>({stage:'graphics',loaded:i+1,total:f.expected.size})));
 });
});

test('the preferred bitmap path preserves exact source crops without allocating any canvas contexts',async()=>{
 const f=fixture();await browserFixture(f,{},async({calls,doc})=>{
  const allocated=[],requests=[],progress=[];
  const bitmapFactory=async function(...args){assert.equal(this,globalThis);requests.push(args);await Promise.resolve();const bitmap={width:args[3],height:args[4],closeCalls:0,close(){this.closeCalls++;}};allocated.push(bitmap);return bitmap;};
  const images=await loadRuntimeAtlas(f.expected,{doc,bitmapFactory,onProgress:s=>progress.push({...s})});
  assert.equal(calls.canvases.length,0,'immutable source graphics must not allocate independent 2D render targets');assert.equal(calls.images.length,1);assert.equal(images.size,f.expected.size);
  let n=0;for(const [key,path]of f.expected){const bitmap=images.get(key),rect=f.manifest.assets[key].rect;assert.equal(bitmap,allocated[n]);assert.deepEqual(requests[n++],[calls.images[0],...rect]);assert.equal(bitmap.width,rect[2]);assert.equal(bitmap.height,rect[3]);assert.equal(bitmap.src,new URL('../web/'+path,import.meta.url).href);assert.equal(bitmap.closeCalls,0,'published bitmaps remain alive for native rendering');}
  assert.deepEqual(progress,Array.from({length:f.expected.size},(_,i)=>({stage:'graphics',loaded:i+1,total:f.expected.size})));
 });
});

test('real NativeArt uses the browser bitmap capability and publishes only its complete source map',async()=>{
 const f=fixture();await browserFixture(f,{},async({calls,Image})=>{
  const allocated=[],progress=[];globalThis.createImageBitmap=async function(_image,_x,_y,width,height){const bitmap={width,height,close(){assert.fail('successful published bitmap must remain alive');}};allocated.push(bitmap);return bitmap;};
  const art=new NativeArt();await art.load({onProgress:s=>progress.push({...s,ready:art.ready,images:art.images.size})});
  assert.equal(art.ready,true);assert.equal(allocated.length,f.expected.size);assert.equal(calls.canvases.length,0);assert.equal(calls.images.length,1);assert.equal(art.images.size,f.expected.size);
  assert.deepEqual([...art.images.values()],allocated);assert([...art.images.values()].every(image=>!(image instanceof Image)));assert(progress.slice(0,-1).every(s=>!s.ready&&s.images===0));assert.equal(progress.at(-1).ready,true);
  assert.equal(art.part('bevel').src,new URL('../web/ui-assets/shop-layout-kit/bevel.png',import.meta.url).href);assert(art.command('exit'));
 });
});

test('failed bitmap creation closes every prior crop before NativeArt starts original-PNG fallback',async()=>{
 const f=fixture();await browserFixture(f,{},async({calls,Image})=>{
  const allocated=[],closed=[],progress=[];let attempts=0;
  globalThis.createImageBitmap=async function(_image,_x,_y,width,height){if(++attempts===3)throw Error('bitmap allocation unavailable');const bitmap={width,height,close(){closed.push({bitmap,originalsStarted:calls.images.filter(image=>!image.url.includes('runtime-atlas.png')).length});}};allocated.push(bitmap);return bitmap;};
  const art=new NativeArt();await art.load({onProgress:s=>progress.push({...s,ready:art.ready})});
  assert.equal(attempts,3);assert.equal(allocated.length,2);assert.deepEqual(closed.map(c=>c.bitmap),allocated);assert(closed.every(c=>c.originalsStarted===0),'partial GPU resources are released before the replacement cohort is loaded');assert.equal(calls.canvases.length,0);
  assert.equal(art.ready,true);assert([...art.images.values()].every(image=>image instanceof Image),'a rejected atlas cannot mix stale bitmap crops into the fallback');assert.equal(art.images.size,f.expected.size);
  assert.equal(progress.filter(s=>s.stage==='graphics'&&s.loaded===0).length,2);assert(progress.slice(0,-1).every(s=>!s.ready));
 });
});

test('a failed bitmap progress observer releases all allocated crops and propagates the original error',async()=>{
 const f=fixture();await browserFixture(f,{},async({calls,doc})=>{
  const allocated=[],closed=[],failure=Error('progress unavailable'),bitmapFactory=async(_image,_x,_y,width,height)=>{const bitmap={width,height,close(){closed.push(bitmap);}};allocated.push(bitmap);return bitmap;};
  await assert.rejects(loadRuntimeAtlas(f.expected,{doc,bitmapFactory,onProgress:s=>{if(s.loaded===2)throw failure;}}),error=>error===failure);
  assert.equal(allocated.length,2);assert.deepEqual(closed,allocated);assert.equal(calls.canvases.length,0);
 });
});

test('a decoded atlas with mismatched intrinsic size or unavailable crop canvas cannot publish partial images',async()=>{
 for(const options of [{wrongAtlasWidth:true},{noContextAt:1}])await browserFixture(fixture(),options,async({doc,calls})=>{
  const f=fixture(),progress=[];await assert.rejects(loadRuntimeAtlas(f.expected,{doc,onProgress:s=>progress.push(s)}),/dimensions|canvas/i);
  assert.equal(progress.length,options.wrongAtlasWidth?0:1);assert.equal(calls.canvases.length,options.wrongAtlasWidth?0:2);
 });
});

test('NativeArt loads the real language/catalogue path and publishes the atlas only at complete readiness',async()=>{
 const f=fixture();await browserFixture(f,{},async({calls,Image})=>{
  const art=new NativeArt(),progress=[];assert.equal(art.ready,false);
  assert.equal(await art.load({onProgress:s=>progress.push({...s,ready:art.ready,images:art.images.size})}),art);
  assert.equal(art.ready,true);assert.equal(art.images.size,f.expected.size);assert.equal(calls.images.length,1,'all native files share one decoded PNG');
  assert.equal(calls.fetch.length,7,'two native catalogues, four language JSONs and one atlas catalogue');
  assert.equal(art.part('bevel'),art.images.get('shop:bevel.png'));assert.equal(art.part('art','screen'),art.images.get('screen:art.png'));
  assert(!(art.part('bevel') instanceof Image));assert(art.command('exit'));assert.equal(art.language.code,'en');
  assert(progress.slice(0,-1).every(s=>!s.ready));assert(progress.slice(0,-1).every(s=>s.images===0),'a partial atlas never becomes a usable NativeArt map');
  assert.deepEqual(progress.at(-1),{stage:'graphics',loaded:f.expected.size,total:f.expected.size,ready:true,images:f.expected.size});
 });
});

test('failed atlas image or manifest transport falls back to the unchanged individual PNGs',async()=>{
 for(const options of [{failAtlasImage:true},{failAtlasJSON:true}])await browserFixture(fixture(),options,async({calls,Image})=>{
  const f=fixture(),art=new NativeArt(),progress=[];await art.load({onProgress:s=>progress.push({...s,ready:art.ready})});
  assert.equal(art.ready,true);assert.equal(art.images.size,f.expected.size);
  const individual=calls.images.filter(image=>!image.url.includes('runtime-atlas.png'));assert.equal(individual.length,f.expected.size);assert.equal(new Set(individual.map(image=>image.url)).size,f.expected.size);
  for(const [key,path]of f.expected){const image=art.images.get(key);assert(image instanceof Image);assert.equal(image.url,new URL('../web/'+path,import.meta.url).href);}
  assert(progress.filter(s=>s.stage==='graphics'&&s.loaded===0).length>=2,'fallback resets its actual progress');assert(progress.slice(0,-1).every(s=>!s.ready));
 });
});

test('a partial failed atlas does not mix crops into fallback or mark failed original images ready',async()=>{
 await browserFixture(fixture(),{noContextAt:1},async({calls,Image})=>{
  const art=new NativeArt(),progress=[];await art.load({onProgress:s=>progress.push({...s,ready:art.ready})});
  assert.equal(art.ready,true);assert.equal(calls.canvases.length,2);assert([...art.images.values()].every(image=>image instanceof Image));assert(progress.some(s=>s.loaded===1&&!s.ready));assert.equal(progress.filter(s=>s.loaded===0&&s.stage==='graphics').length,2);
 });
 await browserFixture(fixture(),{noContextAt:1,failOriginalImage:true},async()=>{
  const art=new NativeArt(),progress=[];await assert.rejects(art.load({onProgress:s=>progress.push({...s,ready:art.ready})}),/Cannot load asset/);
  assert.equal(art.ready,false);assert(progress.every(s=>!s.ready));
 });
});
