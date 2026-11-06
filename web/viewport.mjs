// Browser geometry and control visibility only. No game state or clocks are read.
const dimension=value=>Number.isFinite(value)&&value>0?value:0;
const close=(a,b)=>Math.abs(a-b)<=2;
export const isIPhone=(nav=globalThis.navigator)=>/iPhone|iPod/i.test(nav?.userAgent||'');
const media=(win,query)=>{try{return !!win?.matchMedia?.(query).matches;}catch{return false;}};
const editable=element=>!!element&&(element.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName||''));

export function showFullscreenControl({nav=globalThis.navigator,state={},displayFullscreen=false}={}){
 // An iPhone web app already has its own standalone window. Its browser tabs
 // do not offer this document fullscreen action, so never expose a dead button.
 if(isIPhone(nav))return false;
 return !!(state.fullscreen||state.canFullscreen&&!displayFullscreen);
}

export function measureAppViewport({win=globalThis.window,doc=globalThis.document,nav=globalThis.navigator}={}){
 const root=doc?.documentElement,v=win?.visualViewport;
 let width=dimension(win?.innerWidth)||dimension(root?.clientWidth)||dimension(v?.width);
 const layoutHeight=dimension(win?.innerHeight)||dimension(root?.clientHeight)||dimension(v?.height);
 let height=layoutHeight,source='window';
 const unzoomed=!v||!Number.isFinite(v.scale)||Math.abs(v.scale-1)<.01;
 // Browser bars and the on-screen keyboard can resize only the visual viewport.
 // Keep the application inside that visible rectangle, without treating a page
 // pinch as a new native game size.
 if(unzoomed&&dimension(v?.width)&&dimension(v?.height)&&close(width,v.width)){
  width=Math.min(width,v.width);height=Math.min(height,v.height+Math.max(0,Number(v.offsetTop)||0));source='visual-viewport';
 }
 if(!width||!height)return null;
 const standalone=!!nav?.standalone||media(win,'(display-mode: standalone)')||media(win,'(display-mode: fullscreen)');
 let topInset=0;
 if(isIPhone(nav)&&standalone&&unzoomed&&width<height&&!editable(doc?.activeElement)){
  const screen=win?.screen,sw=dimension(screen?.width),sh=dimension(screen?.height);
  let top=0,bottom=0;
  try{const style=win?.getComputedStyle?.(root);top=parseFloat(style?.getPropertyValue('--app-safe-top'))||0;bottom=parseFloat(style?.getPropertyValue('--app-safe-bottom'))||0;}catch{}
  // Some standalone iPhone versions report a portrait layout shorter than the
  // physical CSS screen by one status/home-indicator inset. Correct only that
  // narrowly bounded case: no address bars, keyboard, zoom or rotated/stale width.
  const allowance=Math.min(128,Math.max(64,top+bottom+2)),gap=sh-height;
  if(sw&&sh>sw&&close(width,sw)&&sh>=layoutHeight&&gap>0&&gap<=allowance){height=sh;source='iphone-standalone-screen';}
  // black-translucent standalone windows draw beneath the iPhone status bar.
  // Reserve that strip in the native canvas only: HTML screens already own
  // their safe-area padding. A bounded fallback covers startup env() settling;
  // six extra CSS pixels keep the native HUD below the status bar's lower fade.
  const fallback=Math.max(height,sh)>=812?47:20;
  topInset=Math.min(96,height-1,(top>0?top:fallback)+6);
 }
 return {width:Math.round(width*100)/100,height:Math.round(height*100)/100,
  topInset:Math.round(topInset*100)/100,bottomOffset:Math.round((layoutHeight-height)*100)/100,source,standalone};
}

export function bindAppViewport({win=globalThis.window,doc=globalThis.document,nav=globalThis.navigator,onResize=()=>{}}={}){
 const root=doc.documentElement,remove=[];let queued=null,settle=null,last='',stopped=false;
 const raf=fn=>win.requestAnimationFrame(fn),cancel=id=>win.cancelAnimationFrame?.(id);
 const refresh=()=>{
  queued=null;if(stopped)return;
  const size=measureAppViewport({win,doc,nav});if(!size)return;
  const key=[size.width,size.height,size.topInset,size.bottomOffset,size.source,size.standalone].join(':');if(key===last)return;last=key;
  root.style.setProperty('--app-viewport-width',size.width+'px');root.style.setProperty('--app-viewport-height',size.height+'px');root.style.setProperty('--app-viewport-bottom-offset',size.bottomOffset+'px');
  root.style.setProperty('--app-canvas-top',size.topInset+'px');root.style.setProperty('--app-canvas-height',(size.height-size.topInset)+'px');
  root.dataset.viewportSource=size.source;root.dataset.appStandalone=String(size.standalone);root.dataset.iphonePortraitInset=String(size.topInset>0);onResize(size);
 };
 const schedule=()=>{if(!stopped&&queued===null)queued=raf(refresh);};
 const settled=()=>{schedule();if(settle!==null)win.clearTimeout(settle);settle=win.setTimeout(()=>{settle=null;schedule();},250);};
 const listen=(target,type,callback)=>{if(!target?.addEventListener)return;target.addEventListener(type,callback,{passive:true});remove.push(()=>target.removeEventListener(type,callback));};
 listen(win,'resize',schedule);listen(win,'orientationchange',settled);listen(win,'pageshow',settled);
 listen(win.visualViewport,'resize',schedule);listen(win.visualViewport,'scroll',schedule);
 listen(doc,'visibilitychange',()=>{if(!doc.hidden)settled();});
 listen(doc,'fullscreenchange',settled);listen(doc,'webkitfullscreenchange',settled);
 for(const query of ['(display-mode: standalone)','(display-mode: fullscreen)']){
  let mode;try{mode=win.matchMedia?.(query);}catch{}
  if(mode?.addEventListener)listen(mode,'change',settled);
  else if(mode?.addListener){mode.addListener(settled);remove.push(()=>mode.removeListener(settled));}
 }
 settled();
 return {refresh:schedule,dispose(){stopped=true;for(const off of remove)off();if(queued!==null)cancel(queued);if(settle!==null)win.clearTimeout(settle);queued=settle=null;}};
}
