import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../web/startup.js',import.meta.url),'utf8').trim();
const fontData=JSON.parse(html.match(/<script id="startup-font"[^>]*>(.*?)<\/script>/s)[1]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// Decode the actual embedded native font PNGs, rather than making every draw
// succeed with an invented glyph. Both production atlases are 8-bit RGBA PNGs.
function decodePNG(bytes){
 assert.equal(bytes.subarray(1,4).toString(),'PNG');const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.equal(bytes[24],8);assert.equal(bytes[25],6);
 const chunks=[];for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at),type=bytes.subarray(at+4,at+8).toString();if(type==='IDAT')chunks.push(bytes.subarray(at+8,at+8+length));at+=length+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,rgba=Buffer.alloc(stride*height);
 const paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
 for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
  const filter=raw[y*(stride+1)],value=raw[y*(stride+1)+1+x],at=y*stride+x,left=x>=4?rgba[at-4]:0,up=y?rgba[at-stride]:0,corner=y&&x>=4?rgba[at-stride-4]:0;
  const add=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,corner):assert.fail('Unsupported PNG filter');rgba[at]=(value+add)&255;
 }
 return {width,height,rgba};
}
class Element{
 constructor(id,tag,attributes,contents=''){
  this.id=id;this.tagName=tag.toUpperCase();this.attributes=new Map();this.hidden=/\shidden(?:\s|>|$)/.test(attributes);this.style={};this.dataset={};this.events=new Map();this.textContent=contents;
  const classes=new Set((attributes.match(/\bclass="([^"]*)"/)?.[1]||'').split(/\s+/).filter(Boolean));this.classList={add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)};
  for(const match of attributes.matchAll(/\b([\w-]+)="([^"]*)"/g)){this.attributes.set(match[1],match[2]);if(match[1].startsWith('data-'))this.dataset[match[1].slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=match[2];}
 }
 setAttribute(key,value){this.attributes.set(key,String(value));}
 getAttribute(key){return this.attributes.get(key)??null;}
 addEventListener(name,fn){this.events.set(name,fn);}
 removeEventListener(name,fn){if(this.events.get(name)===fn)this.events.delete(name);}
 click(){if(!this.hidden)this.events.get('click')?.({target:this});}
}
class Canvas extends Element{
 constructor(...args){super(...args);this._width=300;this._height=150;this.draws=[];this.allDraws=[];this.rgba=Buffer.alloc(300*150*4);this.context={imageSmoothingEnabled:true,drawImage:(...args)=>this.draw(...args)};}
 reset(){this.draws=[];this.rgba=Buffer.alloc(this._width*this._height*4);}
 set width(value){this._width=value;this.reset();}get width(){return this._width;}
 set height(value){this._height=value;this.reset();}get height(){return this._height;}
 getContext(){return this.context;}
 draw(image,sx,sy,sw,sh,dx,dy,dw,dh){
  assert.deepEqual([sw,sh,dw,dh],[8,8,8,8],'startup preserves native eight-pixel glyph cells');assert(sx>=0&&sy>=0&&sx+sw<=image.width&&sy+sh<=image.height);
  const call={image,sx,sy,dx,dy};this.draws.push(call);this.allDraws.push(call);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const src=((sy+y)*image.width+sx+x)*4,dest=((dy+y)*this.width+dx+x)*4;image.rgba.copy(this.rgba,dest,src,src+4);}
 }
 paintedText(){return this.draws.map(({image,sx,sy})=>Object.entries(fontData[image.locale].glyphs).find(([,g])=>g.x===sx&&g.y===sy)?.[0]).map(code=>String.fromCharCode(Number(code)).toUpperCase()).join('');}
}
function boot({language='en',storageDenied=false,search=''}={}){
 const nodes=new Map(),frames=new Map(),timers=new Map(),images=[],events=new Map(),reads=[];let frameId=0,reloads=0;
 for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>([^<]*)/g)){
  const [,tag,attrs,id,contents]=match;nodes.set(id,tag==='canvas'?new Canvas(id,tag,attrs,contents):new Element(id,tag,attrs,contents));
 }
 nodes.get('startup-font').textContent=JSON.stringify(fontData);
 const links=[...html.matchAll(/<link\b([^>]*\bdata-ui-style="[^"]*"[^>]*)>/g)].map(([,attrs],index)=>new Element('style-'+index,'link',attrs));
 class Image{
  constructor(){images.push(this);}
  set src(value){this.url=value;assert.match(value,/^data:image\/png;base64,/,'startup font never waits for a remote image/font request');const bytes=Buffer.from(value.split(',')[1],'base64');Object.assign(this,decodePNG(bytes));this.locale=Object.keys(fontData).find(key=>fontData[key].image===value);}
 }
 const window={addEventListener:(type,fn)=>events.set(type,fn)},location={search,reload(){reloads++;}};
 const context={window,document:{getElementById:id=>nodes.get(id)||null,querySelectorAll:selector=>{assert.equal(selector,'link[data-ui-style]');return links;}},Image,URLSearchParams,location,
  localStorage:{getItem(key){reads.push(key);if(storageDenied)throw Error('storage blocked');return language;},setItem(){assert.fail('startup must never write progress or language');}},
  requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout(fn,delay){assert.equal(delay,15000,'only the bounded stylesheet deadline may use a timer');const id=++frameId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),setInterval(){assert.fail('startup must not start an idle timer');},
 };
 runInNewContext(script,context,{filename:'startup.js'});
 const frame=()=>{const callbacks=[...frames.values()];frames.clear();for(const fn of callbacks)fn();};
 const load=locale=>{const image=images.find(i=>i.locale===locale);assert(image);image.onload();};
 const loadFonts=()=>{load('en');load('ru');frame();};
 const styleEvent=(index,type)=>{const link=links[index];assert(link);if(type==='error')events.get('error')?.({target:link});runInNewContext('(function(){'+link.getAttribute('on'+type)+'}).call(link)',{link});link.events.get(type)?.({target:link});};
 return {nodes,images,reads,frames,timers,links,api:window.duneStartup,frame,load,loadFonts,styleEvent,get reloads(){return reloads;},error:event=>events.get('error')?.(event)};
}

test('first HTML exposes loading before modules or any font/engine preparation and embeds the exact controller',()=>{
 const launch=html.match(/<div\b[^>]*id="launch"[^>]*>/)[0];assert(!/\shidden(?:\s|>)/.test(launch));assert.match(launch,/role="status"/);
 const begin=html.indexOf('<!-- BEGIN GENERATED STARTUP -->'),module=html.indexOf('<script type="module"');assert(begin>html.indexOf('id="launch"'));assert(module>begin);assert(html.includes('<script>\n'+script+'\n</script>'));
 const h=boot();assert.equal(h.nodes.get('launch').hidden,false);assert.equal(h.nodes.get('boot-label').textContent,'LOADING DUNE');assert.equal(h.nodes.get('boot-text').textContent,'PREPARING GRAPHICS');assert(!h.nodes.get('boot-label').classList.contains('boot-accessible'));assert.equal(h.nodes.get('boot-heading').hidden,true);
 h.frame();assert.equal(h.nodes.get('launch').hidden,false);assert(!h.nodes.get('boot-label').classList.contains('boot-accessible'),'fallback is visible with font images still unavailable');assert.equal(h.frames.size,0);assert.equal(h.timers.size,0,'the first readable frame does not wait on a style timer');
});
test('embedded English and Russian bitmap images match the real source fonts exactly',()=>{
 const skin=JSON.parse(readFileSync(new URL('../web/ui-assets/screen-assets/manifest.json',import.meta.url))),locales=JSON.parse(readFileSync(new URL('../web/language-assets/manifest.json',import.meta.url)));
 const paths={en:new URL('../web/ui-assets/screen-assets/'+skin.fonts.uiShadow.path,import.meta.url),ru:new URL('../web/language-assets/'+locales.languages.find(l=>l.code==='ru').font.shadowPath,import.meta.url)};
 for(const locale of ['en','ru'])assert.equal(sha(Buffer.from(fontData[locale].image.split(',')[1],'base64')),sha(readFileSync(paths[locale])));
 const h=boot();h.loadFonts();for(const id of ['boot-heading','boot-bitmap']){const c=h.nodes.get(id);assert(c.rgba.some((value,index)=>index%4===3&&value>0),'real glyph pixels are rasterized');assert.equal(c.context.imageSmoothingEnabled,false);}
 assert.equal(h.nodes.get('boot-heading').paintedText(),'LOADING DUNE');assert.equal(h.nodes.get('boot-bitmap').paintedText(),'PREPARING GRAPHICS');assert.equal(h.frames.size,0);
});
test('actual graphics counts drive the progress bar and bitmap text without invented progress or extra idle paints',()=>{
 const h=boot();h.loadFonts();h.api.progress({stage:'graphics',loaded:146,total:293});h.frame();
 const bar=h.nodes.get('boot-progress'),canvas=h.nodes.get('boot-bitmap');assert.equal(bar.getAttribute('aria-valuenow'),'146');assert.equal(bar.getAttribute('aria-valuemax'),'293');assert.equal(parseFloat(h.nodes.get('boot-fill').style.width),146/293*100);assert.equal(canvas.paintedText(),'GRAPHICS 146 / 293');assert(!bar.classList.contains('boot-indeterminate'));
 const drawn=canvas.allDraws.length;h.api.progress({stage:'graphics',loaded:146,total:293});h.frame();assert.equal(canvas.allDraws.length,drawn,'unchanged count does not paint again');
 h.api.engine();h.frame();assert.equal(canvas.allDraws.length,drawn,'engine status cannot rewind counted graphics progress');h.api.progress({stage:'graphics',loaded:293,total:293});h.frame();assert.equal(h.nodes.get('boot-fill').style.width,'100%');assert.equal(canvas.paintedText(),'GRAPHICS 293 / 293');assert.equal(h.frames.size,0);
});
test('engine preparation is readable before graphics totals exist',()=>{
 const h=boot();h.loadFonts();h.api.engine();h.frame();assert.equal(h.nodes.get('boot-bitmap').paintedText(),'PREPARING GAME');assert(h.nodes.get('boot-progress').classList.contains('boot-indeterminate'));assert.equal(h.frames.size,0);
});
test('stored Russian renders original Cyrillic glyphs and keeps text fallback until both inline atlases decode',()=>{
 const h=boot({language:'ru'});assert.deepEqual(h.reads,['dune-sega-language-v1']);assert.equal(h.nodes.get('boot-label').textContent,'ЗАГРУЗКА DUNE');assert.equal(h.nodes.get('boot-retry').textContent,'ПОВТОРИТЬ');
 h.load('en');h.frame();assert(!h.nodes.get('boot-label').classList.contains('boot-accessible'),'an English-first image decode cannot hide unpainted Cyrillic');assert.equal(h.nodes.get('boot-heading').hidden,true);
 h.load('ru');h.frame();assert.equal(h.nodes.get('boot-heading').paintedText(),'ЗАГРУЗКА DUNE');assert.equal(h.nodes.get('boot-bitmap').paintedText(),'ПОДГОТОВКА ГРАФИКИ');assert(h.nodes.get('boot-heading').draws.some(d=>d.image.locale==='ru'));assert(h.nodes.get('boot-heading').rgba.some((value,index)=>index%4===3&&value>0));
 h.api.progress({stage:'graphics',loaded:9,total:293});h.frame();assert.equal(h.nodes.get('boot-bitmap').paintedText(),'ГРАФИКА 9 / 293');
});
test('blocked storage and unknown saved language safely keep the visible English loader',()=>{
 for(const options of [{storageDenied:true},{language:'de'}]){const h=boot(options);assert.equal(h.nodes.get('boot-label').textContent,'LOADING DUNE');h.loadFonts();assert.equal(h.nodes.get('boot-heading').paintedText(),'LOADING DUNE');assert.equal(h.nodes.get('launch').hidden,false);}
});
test('module load failure paints the native error glyphs, stops progress and offers a real retry',()=>{
 for(const language of ['en','ru']){
  const h=boot({language});h.loadFonts();h.api.progress({stage:'graphics',loaded:2,total:293});h.error({target:{tagName:'SCRIPT'}});h.frame();
  assert.equal(h.nodes.get('launch').hidden,false);assert.equal(h.nodes.get('launch').dataset.bootState,'error');assert.equal(h.nodes.get('boot-progress').hidden,true);assert.equal(h.nodes.get('boot-retry').hidden,false);
  assert.equal(h.nodes.get('boot-heading').paintedText(),language==='ru'?'НЕ УДАЛОСЬ ЗАГРУЗИТЬ ИГРУ':'COULD NOT LOAD THE GAME');assert.equal(h.nodes.get('boot-bitmap').paintedText(),language==='ru'?'ПРОВЕРЬТЕ ПОДКЛЮЧЕНИЕ И ПОВТОРИТЕ ПОПЫТКУ':'CHECK YOUR CONNECTION AND TRY AGAIN');assert(h.nodes.get('boot-bitmap').rgba.some((value,index)=>index%4===3&&value>0));
  const count=h.nodes.get('boot-bitmap').allDraws.length;h.api.progress({stage:'graphics',loaded:293,total:293});h.api.engine();h.api.finish();h.frame();assert.equal(h.nodes.get('boot-bitmap').allDraws.length,count);assert.equal(h.nodes.get('launch').hidden,false,'failure cannot be dismissed by a later art/engine success callback');
  h.nodes.get('boot-retry').click();assert.equal(h.reloads,1);
 }
});
test('shell runtime failure is caught while unrelated image errors keep the usable loader in place',()=>{
 const h=boot();h.error({target:{tagName:'IMG'}});assert.equal(h.nodes.get('launch').dataset.bootState,'loading');h.error({filename:'https://example.test/shell.js?v=test'});assert.equal(h.nodes.get('launch').dataset.bootState,'error');
});
test('completion hides the loader once and later errors/progress/late image callbacks cannot cover gameplay',()=>{
 const h=boot();h.api.finish();assert.equal(h.nodes.get('launch').hidden,true);assert.equal(h.frames.size,0);h.loadFonts();h.error({target:{tagName:'SCRIPT'}});h.api.fail();h.api.engine();h.api.progress({stage:'graphics',loaded:3,total:293});h.frame();
 assert.equal(h.nodes.get('launch').hidden,true);assert.equal(h.nodes.get('boot-heading').allDraws.length,0);assert.equal(h.nodes.get('boot-retry').hidden,true);assert.equal(h.frames.size,0);
});
test('legacy route retains manual Start and does not auto-enter or replace the old native launch flow',()=>{
 const h=boot({search:'?legacy'});assert.equal(h.nodes.get('launch').dataset.bootState,'legacy');assert.equal(h.nodes.get('start').hidden,false);assert.equal(h.nodes.get('boot-progress').hidden,true);assert.equal(h.nodes.get('boot-text').textContent,'SEGA GENESIS · USA');
 h.loadFonts();h.api.progress({stage:'graphics',loaded:293,total:293});h.api.engine();h.api.fail();h.frame();assert.equal(h.nodes.get('launch').hidden,false);assert.equal(h.nodes.get('start').hidden,false);assert.equal(h.nodes.get('boot-heading').allDraws.length,0);assert.equal(h.frames.size,0);
});

test('nonblocking style links permit native-font loading paint before either UI stylesheet arrives',()=>{
 const h=boot();assert.equal(h.links.length,2);for(const link of h.links){assert.equal(link.getAttribute('media'),'print');assert.equal(link.getAttribute('fetchpriority'),'high');assert.equal(link.dataset.uiStyle,'pending');}
 h.loadFonts();assert.equal(h.nodes.get('boot-heading').paintedText(),'LOADING DUNE');assert.equal(h.nodes.get('boot-bitmap').paintedText(),'PREPARING GRAPHICS');assert.equal(h.nodes.get('launch').hidden,false);assert.equal(h.timers.size,0);
});
test('stylesReady coalesces the two real link events and cannot publish the interface before both apply',async()=>{
 const h=boot();h.loadFonts();const waiting=h.api.stylesReady();assert.equal(h.api.stylesReady(),waiting);assert.equal(h.timers.size,1);h.frame();assert.equal(h.nodes.get('boot-bitmap').paintedText(),'PREPARING INTERFACE');let ready=false;waiting.then(()=>{ready=true;});
 h.styleEvent(0,'load');await Promise.resolve();assert.equal(ready,false);assert.equal(h.links[0].media,'all');assert.equal(h.nodes.get('launch').hidden,false);
 h.styleEvent(1,'load');await waiting;assert.equal(ready,true);assert.equal(h.links[1].media,'all');assert.equal(h.timers.size,0);for(const link of h.links)assert.equal(link.events.size,0);
 h.api.finish();assert.equal(h.nodes.get('launch').hidden,true);
});
test('already-loaded styles resolve immediately without a timer and keep the same readiness promise',async()=>{
 const h=boot();h.styleEvent(0,'load');h.styleEvent(1,'load');const waiting=h.api.stylesReady();assert.equal(h.api.stylesReady(),waiting);assert.equal(h.timers.size,0);await waiting;assert.equal(h.nodes.get('launch').dataset.bootState,'loading');
});
test('stylesheet failure before or during the wait exposes retry and never publishes an unstyled interface',async()=>{
 for(const failedBeforeWait of [false,true]){
  const h=boot();h.loadFonts();if(failedBeforeWait)h.styleEvent(0,'error');const waiting=h.api.stylesReady(),rejected=assert.rejects(waiting,/stylesheet failed/);if(!failedBeforeWait)h.styleEvent(0,'error');await rejected;h.frame();
  assert.equal(h.nodes.get('launch').dataset.bootState,'error');assert.equal(h.nodes.get('boot-heading').paintedText(),'COULD NOT LOAD THE GAME');assert.equal(h.nodes.get('boot-retry').hidden,false);assert.equal(h.timers.size,0);h.api.finish();assert.equal(h.nodes.get('launch').hidden,false);
 }
});
test('a stalled stylesheet has one finite deadline and late success cannot dismiss its error',async()=>{
 const h=boot();h.loadFonts();const waiting=h.api.stylesReady(),rejected=assert.rejects(waiting,/stylesheet load timed out/);assert.equal(h.timers.size,1);const timeout=[...h.timers.values()][0];timeout();await rejected;h.frame();assert.equal(h.timers.size,0);
 h.styleEvent(0,'load');h.styleEvent(1,'load');h.api.finish();assert.equal(h.nodes.get('launch').hidden,false);assert.equal(h.nodes.get('boot-retry').hidden,false);for(const link of h.links)assert.equal(link.events.size,0);
});
