// Native PNG composition only. Game actions stay in the original runtime.
import {GameLanguage} from './i18n.mjs?v=20261115-offline-menu';
import {loadAssetImage,loadAssetJSON,runAssetPool} from './asset-loader.mjs?v=20261113-feedback';
import {loadRuntimeAtlas} from './runtime-atlas.mjs?v=20261113-feedback';
export class NativeArt {
 constructor({storage}={}){this.images=new Map();this.alpha=new Map();this.inkAtlases=new Map();this.flags=new Map();this.buttonViews=new Set();this.pressedViews=new Set();this.language=new GameLanguage({storage});this.ready=false;this.language.onChange(()=>{for(const v of this.buttonViews)v.draw();});for(const ev of ['pointerup','pointercancel'])window.addEventListener(ev,()=>{for(const v of [...this.pressedViews])v.release();},true);}
 async load({onProgress=()=>{},atlas=true}={}){
  this.ready=false;const base='./ui-assets/';
  onProgress({stage:'catalogue',loaded:0,total:0});
  [this.kit,this.skin]=await Promise.all([...['shop-layout-kit/manifest.json','screen-assets/manifest.json'].map(p=>loadAssetJSON(base+p)),this.language.load()]);
  const expected=new Map();for(const [group,m] of [['shop',this.kit],['screen',this.skin]]){
   const folder=group==='shop'?'shop-layout-kit/':'screen-assets/';
   const paths=[...Object.values(m.parts).map(p=>p.path),...Object.values(m.fonts).filter(f=>f?.path).map(f=>f.path),...Object.values(m.animations||{}).flatMap(a=>(a.states||[]).map(s=>s.path))].filter(p=>typeof p==='string'&&p.length);
   for(const path of new Set(paths))expected.set(group+':'+path,'ui-assets/'+folder+path);
  }
  const localePaths=new Set(this.language.manifest.languages.flatMap(locale=>[locale.font?.maskPath,locale.font?.shadowPath,...Object.values(locale.commands||{})].filter(Boolean)));
  for(const path of localePaths)expected.set('locale:'+path,'language-assets/'+path);
  onProgress({stage:'graphics',loaded:0,total:expected.size});
  let packed=false;
  if(atlas)try{const images=await loadRuntimeAtlas(expected,{onProgress});for(const [key,image]of images)this.images.set(key,image);packed=true;}catch{onProgress({stage:'graphics',loaded:0,total:expected.size});}
  if(!packed){let loaded=0;await runAssetPool([...expected].map(([key,path])=>async()=>{const image=await loadAssetImage(new URL('./'+path,import.meta.url));this.images.set(key,image);onProgress({stage:'graphics',loaded:++loaded,total:expected.size});}));}
  this.ready=true;onProgress({stage:'graphics',loaded:expected.size,total:expected.size});return this;
 }
 displayText(value){return this.language?.text(value)??String(value??'');}
 command(key,disabled=false){const locale=this.language?.manifest?.languages.find(l=>l.code===this.language.code),path=locale?.commands?.[key+'-'+(disabled?'disabled':'enabled')];return path?this.images.get('locale:'+path):null;}
 commandLabel(key,disabled=false){
  const id='command:'+this.language?.code+':'+key+':'+disabled;if(this.alpha.has(id))return this.alpha.get(id);const image=this.command(key,disabled);if(!image)return null;
  const can=document.createElement('canvas');can.width=28;can.height=12;const c=can.getContext('2d',{willReadFrequently:true});c.drawImage(image,2,6,28,12,0,0,28,12);const data=c.getImageData(0,0,28,12),sample=document.createElement('canvas');sample.width=32;sample.height=24;const sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(image,0,0);const bg=sc.getImageData(16,4,1,1).data;
  for(let i=0;i<data.data.length;i+=4)if(data.data[i]===bg[0]&&data.data[i+1]===bg[1]&&data.data[i+2]===bg[2])data.data[i+3]=0;
  c.putImageData(data,0,0);this.alpha.set(id,can);return can;
 }
 flag(code){
  if(this.flags.has(code))return this.flags.get(code);const can=document.createElement('canvas');can.width=24;can.height=16;const c=can.getContext('2d');
  // Three-bit Mega Drive channel values and integer pixels; the frame around
  // this small new country marker is the game's actual command-button PNG.
  const fill=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  if(code==='ru'){fill('#fff',0,0,24,5);fill('#0000b6',0,5,24,6);fill('#b60000',0,11,24,5);}
  else{fill('#0000b6',0,0,24,16);for(let x=0;x<24;x++){const y=Math.floor(x*16/24);fill('#fff',x,y-1,1,3);fill('#fff',x,14-y,1,3);fill('#b60000',x,y,1,1);fill('#b60000',x,15-y,1,1);}fill('#fff',0,5,24,6);fill('#fff',9,0,6,16);fill('#b60000',0,7,24,2);fill('#b60000',11,0,2,16);}
  this.flags.set(code,can);return can;
 }
 inkAtlas(image,ink){
  if(!ink||!image)return image;const id=(image.src||'native')+':'+ink.join(',');if(this.inkAtlases.has(id))return this.inkAtlases.get(id);
  const can=document.createElement('canvas');can.width=image.width;can.height=image.height;const c=can.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const data=c.getImageData(0,0,can.width,can.height);
  for(let i=0;i<data.data.length;i+=4)if(data.data[i+3]&&(data.data[i]||data.data[i+1]||data.data[i+2])){data.data[i]=ink[0];data.data[i+1]=ink[1];data.data[i+2]=ink[2];}
  c.putImageData(data,0,0);this.inkAtlases.set(id,can);return can;
 }
 part(id,group='shop'){const m=group==='shop'?this.kit:this.skin;return this.images.get(group+':'+m.parts[id]?.path);}
 image(path,group='screen'){return this.images.get(group+':'+path);}
 blit(c,img,x,y,scale=1){if(img)c.drawImage(img,x,y,img.width*scale,img.height*scale);}
 repeat(c,img,x,y,w,h,unit=1){if(!img||w<=0||h<=0)return;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
  // Straight1px profiles and uniform samples may be extruded without distortion.
  if(img.width===1||img.height===1||img.width===8&&img.height===8){const p=c.createPattern(img,'repeat');p.setTransform(new DOMMatrix([unit,0,0,unit,x,y]));c.fillStyle=p;c.fillRect(x,y,w,h);}
  else for(let yy=y;yy<y+h;yy+=img.height*unit)for(let xx=x;xx<x+w;xx+=img.width*unit)this.blit(c,img,xx,yy,unit);
  c.restore();
 }
 toneImage(image,tone){
  if(!image||!['confirm','attack'].includes(tone))return image;this.tonedParts??=new WeakMap();let tones=this.tonedParts.get(image);if(!tones){tones=new Map();this.tonedParts.set(image,tones);}if(tones.has(tone))return tones.get(tone);
  const can=document.createElement('canvas');can.width=image.width;can.height=image.height;const c=can.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const data=c.getImageData(0,0,can.width,can.height);
  // Move native violet shades to green/red using the same channel values.
  // Neutral highlights, black shadows and every original edge pixel stay intact.
  const d=data.data;for(let i=0;i<d.length;i+=4)if(d[i]===d[i+1]&&d[i+2]>d[i+1]){const base=d[i],accent=d[i+2];d[i]=tone==='attack'?accent:base;d[i+1]=tone==='confirm'?accent:base;d[i+2]=base;}
  c.putImageData(data,0,0);tones.set(tone,can);return can;
 }
 frame(c,name,x,y,w,h,{group='shop',unit=1,fill=true,tone=null}={}){
  const m=(group==='shop'?this.kit:this.skin).modules[name];if(!m)return;const p=m.pieces,[ll,tt,rr,bb]=m.insets,[l,t,r,b]=[ll,tt,rr,bb].map(v=>v*unit),pic=k=>this.toneImage(this.part(p[k],group),tone);
  if(fill&&!m.frameOnly&&p.fill)this.repeat(c,pic('fill'),x+l,y+t,w-l-r,h-t-b,unit);
  this.repeat(c,pic('top'),x+l,y,w-l-r,t,unit);this.repeat(c,pic('bottom'),x+l,y+h-b,w-l-r,b,unit);this.repeat(c,pic('left'),x,y+t,l,h-t-b,unit);this.repeat(c,pic('right'),x+w-r,y+t,r,h-t-b,unit);
  this.blit(c,pic('tl'),x,y,unit);this.blit(c,pic('tr'),x+w-r,y,unit);this.blit(c,pic('bl'),x,y+h-b,unit);this.blit(c,pic('br'),x+w-r,y+h-b,unit);
 }
 glass(c,name,x,y,w){const p=this.kit.modules[name].pieces,a=this.part(p.left),b=this.part(p.right);this.blit(c,a,x,y);this.repeat(c,this.part(p.middle),x+a.width,y,w-a.width-b.width,a.height);this.blit(c,b,x+w-b.width,y);}
 text(c,value,x,y,{scale=1,align='left',maxWidth=Infinity,shadow=false,transparent=false,preserveCase=false,translate=true,ink=null}={}){
  const f=(preserveCase?(shadow?this.skin.fonts.textShadow:this.skin.fonts.textMask):null)||(shadow?this.skin.fonts.uiShadow:null)||(transparent?this.skin.fonts.uiMask:null)||this.skin.fonts.ui;
  const img=this.inkAtlas(this.images.get('screen:'+f.path),ink);let s=translate?this.displayText(value):String(value??'');if(!preserveCase)s=s.toUpperCase();
  if(Number.isFinite(maxWidth))s=s.slice(0,Math.max(0,Math.floor(maxWidth/(8*scale))));if(align==='center')x-=s.length*4*scale;else if(align==='right')x-=s.length*8*scale;
  const extra=this.language?.font,extraImage=extra&&this.inkAtlas(this.images.get('locale:'+(shadow?extra.shadowPath:extra.maskPath)),ink);
  for(let i=0;i<s.length;i++){const code=s.charCodeAt(i),local=code>126&&extra?.glyphs[code],g=local||f.glyphs[code]||f.glyphs[63]||f.glyphs[32],source=local&&extraImage?extraImage:img;if(source)c.drawImage(source,g.x,g.y,8,8,Math.round(x+i*8*scale),Math.round(y),8*scale,8*scale);}
 }
 alphaFor(id,group='shop'){
  const key=group+':'+id;if(this.alpha.has(key))return this.alpha.get(key);const img=this.part(id,group);if(!img)return null;const can=document.createElement('canvas');can.width=img.width;can.height=img.height;const c=can.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);const data=c.getImageData(0,0,img.width,img.height);const out={canvas:can,ctx:c,data};this.alpha.set(key,out);return out;
 }
 livePart(id,frame,group='shop'){const p=(group==='shop'?this.kit:this.skin).parts[id],mask=this.alphaFor(id,group);if(!mask||!p?.sourceRect||!frame?.valid)return this.part(id,group);const [x,y,w,h]=p.sourceRect,d=mask.data.data;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const from=((y+yy)*320+x+xx)*4,to=(yy*w+xx)*4;d[to]=frame.data.data[from];d[to+1]=frame.data.data[from+1];d[to+2]=frame.data.data[from+2];}
  mask.ctx.putImageData(mask.data,0,0);return mask.canvas;
 }
 decorate(button,label,options={}){
  button._nativeArtView?.dispose();
  button.classList.add('native-button');const can=document.createElement('canvas');can.setAttribute('aria-hidden','true');button.replaceChildren(can);let pressed=false,disposed=false,current=label,opts={...options},pulsePhase=null,pulseStart=0,pulseRaf=0,lastPaint='';
  button.setAttribute('aria-label',this.displayText(options.ariaLabel||String(label)));
  const draw=()=>{if(disposed||!this.ready)return;const box=button.getBoundingClientRect();if(box.width<1||box.height<1)return;const dpr=Math.min(devicePixelRatio||1,3),phase=pressed?0:pulsePhase,focus=button.matches(':focus-visible'),paint=JSON.stringify([box.width,box.height,dpr,String(current),opts.disabled,opts.back,opts.image,opts.subtitle,opts.large,opts.tone,phase,focus]);
   const localPaint=paint+':'+this.language?.revision;if(localPaint===lastPaint)return;lastPaint=localPaint;button.setAttribute('aria-label',this.displayText(opts.ariaLabel||String(current)));const pw=Math.round(box.width*dpr),ph=Math.round(box.height*dpr);if(can.width!==pw)can.width=pw;if(can.height!==ph)can.height=ph;const c=can.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,box.width,box.height);c.imageSmoothingEnabled=false;const w=box.width,h=box.height,u=Math.min(2,h/24);
   this.frame(c,opts.disabled?'command-skin-disabled':'command-skin-normal',0,0,w,h,{group:'screen',unit:u,tone:opts.disabled?null:opts.tone});
   let left=12;if(opts.back){const img=this.part('back-menu-arrow-native','screen')||this.part('back-glyph-native','screen');if(img){const s=Math.min(1.6,(h-12)/16);this.blit(c,img,10,(h-16*s)/2,s);left=10+16*s+6;}}else if(opts.image||opts.flag){const img=opts.flag?this.flag(opts.flag):this.part(opts.image,'screen');if(img){const s=Math.min((h-12)/img.height,w*.28/img.width);this.blit(c,img,12,(h-img.height*s)/2,s);left=24+img.width*s;}}
   const subtitleWidth=opts.back||opts.image||opts.flag?w-left-8:w-12;
   const subtitle=this.displayText(opts.subtitle||''),ss=Math.max(.8,Math.min(1.5,Math.min(w-16,subtitleWidth)/(Math.max(1,subtitle.length)*8))),gap=subtitle?4:0,subHeight=subtitle?8*ss:0,label=opts.translate===false?String(current):this.displayText(current);
   const scale=Math.min(opts.large?4:2,(w-left-10)/(Math.max(1,label.length)*8),(h-12-gap-subHeight)/8);
   const hasShadow=!!this.skin.fonts.uiShadow;const tx=opts.back||opts.image||opts.flag?left+(w-left-8)/2:w/2,ty=(h-8*scale-gap-subHeight)/2;
   if(!hasShadow){const textW=label.length*8*scale;this.repeat(c,this.part('native-black'),tx-textW/2-3,ty-2,textW+6,8*scale+4);}
   this.text(c,label,tx,ty,{scale,align:'center',shadow:hasShadow,translate:false});if(subtitle)this.text(c,subtitle,tx,ty+8*scale+gap,{scale:ss,align:'center',transparent:true,maxWidth:subtitleWidth,translate:false});
   if(phase!==null||focus)this.frame(c,'command-focus-'+(phase??0),0,0,w,h,{group:'screen',unit:1.5,fill:false});
  };
  const stopPulse=()=>{if(pulseRaf)cancelAnimationFrame(pulseRaf);pulseRaf=0;pulsePhase=null;};
  const pulseTick=now=>{pulseRaf=0;if(disposed||pulsePhase===null)return;const elapsed=now-pulseStart;
   if(elapsed>=200){pulsePhase=null;draw();return;}
   const next=[0,1,2,1][Math.max(0,Math.floor(elapsed/50))];if(next!==pulsePhase){pulsePhase=next;draw();}pulseRaf=requestAnimationFrame(pulseTick);
  };
  const view={draw,
   press:()=>{if(disposed||button.disabled)return;stopPulse();pressed=true;this.pressedViews.add(view);draw();},
   release:()=>{if(disposed)return;const changed=pressed||pulsePhase!==null;pressed=false;this.pressedViews.delete(view);stopPulse();if(changed)draw();},
   pulse:()=>{if(disposed||button.disabled)return;const now=performance.now();if(pulsePhase!==null&&now-pulseStart<1)return;stopPulse();pressed=false;this.pressedViews.delete(view);pulseStart=now;pulsePhase=0;draw();pulseRaf=requestAnimationFrame(pulseTick);},
   update:(next,nextOpts={})=>{if(disposed)return;const changed=current!==next||Object.keys(nextOpts).some(k=>opts[k]!==nextOpts[k]);current=next;opts={...opts,...nextOpts};const aria=this.displayText(opts.ariaLabel||String(next));if(button.getAttribute('aria-label')!==aria)button.setAttribute('aria-label',aria);if(changed)draw();},
   dispose:()=>{if(disposed)return;disposed=true;stopPulse();observer.disconnect();for(const [ev,listener]of listeners)button.removeEventListener(ev,listener);this.buttonViews.delete(view);this.pressedViews.delete(view);if(button._nativeArtView===view)delete button._nativeArtView;}
  };
  const down=e=>{if(e.button===0&&e.isPrimary!==false)view.press();},release=()=>view.release(),blur=()=>{view.release();draw();};
  const listeners=[['pointerdown',down],['pointerup',release],['pointercancel',release],['lostpointercapture',release],['blur',blur],['focus',draw]];
  for(const [ev,listener]of listeners)button.addEventListener(ev,listener);
  const observer=new ResizeObserver(draw);observer.observe(button);button._nativeArtView=view;this.buttonViews.add(view);draw();return view;
 }
}

export class LiveNativeFrame {
 constructor(){this.canvas=document.createElement('canvas');this.canvas.width=320;this.canvas.height=224;this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});this.data=this.ctx.createImageData(320,224);this.valid=false;}
 update(Module,ptr,width=320,height=224){
  const bytes=width*height*3;this.changed=false;
  if(!ptr||width<1||width>320||height<1||height>240||!Module.HEAPU8||ptr+bytes>Module.HEAPU8.length)return false;
  let changed=!this.valid;
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.data=this.ctx.createImageData(width,height);changed=true;}
  const s=Module.HEAPU8.subarray(ptr,ptr+bytes),d=this.data.data;
  for(let i=0,j=0;i<s.length;i+=3,j+=4){if(d[j]!==s[i]||d[j+1]!==s[i+1]||d[j+2]!==s[i+2]||d[j+3]!==255)changed=true;d[j]=s[i];d[j+1]=s[i+1];d[j+2]=s[i+2];d[j+3]=255;}
  if(changed){this.ctx.putImageData(this.data,0,0);this.revision=(this.revision||0)+1;}
  this.changed=changed;this.valid=true;return true;
 }
 crop(c,rect,x,y,w=rect.w,h=rect.h){if(this.valid)c.drawImage(this.canvas,rect.x,rect.y,rect.w,rect.h,x,y,w,h);}
 glyph(c,rect,to){if(!this.valid)return;let lo=rect.w,hi=-1;const d=this.data.data;for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++){const p=(y*this.canvas.width+x)*4;if(d[p]||d[p+1]||d[p+2]){lo=Math.min(lo,x-rect.x);hi=Math.max(hi,x-rect.x);}}if(hi<lo)return;lo=Math.max(0,lo-1);hi=Math.min(rect.w-1,hi+1);const width=hi-lo+1,s=Math.min(1,to.w/width),h=rect.h*s;this.crop(c,{x:rect.x+lo,y:rect.y,w:width,h:rect.h},to.x+to.w-width*s,to.y+(to.h-h)/2,width*s,h);}
}

export function dragScroll(element){
 let p=null,suppressUntil=0;const down=e=>{if(e.button!==0||!e.isPrimary)return;suppressUntil=0;p={id:e.pointerId,x:e.clientX,y:e.clientY,top:element.scrollTop,dragged:false,mouse:e.pointerType==='mouse'};};
 const move=e=>{if(!p||p.id!==e.pointerId||p.mouse&&e.buttons===0)return;const dy=e.clientY-p.y;if(Math.hypot(e.clientX-p.x,dy)>8){p.dragged=true;suppressUntil=performance.now()+400;}if(p.dragged&&p.mouse&&element.scrollHeight>element.clientHeight){e.preventDefault();element.setPointerCapture(e.pointerId);element.scrollTop=p.top-dy;}};
 const end=()=>{if(p?.dragged)suppressUntil=performance.now()+400;p=null;};const click=e=>{if(e.detail&&performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}};
 element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move,{passive:false});element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);element.addEventListener('click',click,true);
 return ()=>{element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',end);element.removeEventListener('click',click,true);};
}
