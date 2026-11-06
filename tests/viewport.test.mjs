import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAppViewport,measureAppViewport,showFullscreenControl,isIPhone} from '../web/viewport.mjs';

function events(extra={}){
 const listeners=new Map();return Object.assign({listeners,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},emit(type){for(const fn of [...(listeners.get(type)||[])])fn();}},extra);
}
function environment({width=390,height=844,visualHeight=height,iphone=false,standalone=false,screenWidth=390,screenHeight=844,safeTop=59,safeBottom=34}={}){
 const styles=new Map(),raf=new Map(),timers=new Map(),modes=new Map();let id=0;
 const nav={userAgent:iphone?'Mozilla iPhone Safari':'Desktop browser',standalone};
 const visualViewport=events({width,height:visualHeight,scale:1,offsetTop:0});
 const root={style:{setProperty:(key,value)=>styles.set(key,value)},dataset:{},clientWidth:width,clientHeight:height};
 const doc=events({documentElement:root,activeElement:null,hidden:false});
 const win=events({innerWidth:width,innerHeight:height,devicePixelRatio:3,screen:{width:screenWidth,height:screenHeight},visualViewport,
  requestAnimationFrame:fn=>{const key=++id;raf.set(key,fn);return key;},cancelAnimationFrame:key=>raf.delete(key),
  setTimeout:fn=>{const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key),
  matchMedia:query=>{if(!modes.has(query))modes.set(query,events({matches:false}));return modes.get(query);},
  getComputedStyle:()=>({getPropertyValue:key=>key==='--app-safe-top'?safeTop+'px':key==='--app-safe-bottom'?safeBottom+'px':''}),
 });
 const frame=()=>{const callbacks=[...raf.values()];raf.clear();for(const fn of callbacks)fn();};
 const settle=()=>{const callbacks=[...timers.values()];timers.clear();for(const fn of callbacks)fn();};
 return {win,doc,nav,styles,root,raf,timers,modes,frame,settle};
}

test('desktop viewport uses CSS pixels, never devicePixelRatio, with window/document fallback',()=>{
 const e=environment({width:1280,height:720});delete e.win.visualViewport;
 assert.deepEqual(measureAppViewport(e),{width:1280,height:720,topInset:0,bottomOffset:0,source:'window',standalone:false});
 e.win.innerHeight=0;assert.equal(measureAppViewport(e).height,720);
 e.win.innerWidth=e.doc.documentElement.clientWidth=0;assert.equal(measureAppViewport(e),null);
});
test('browser bars resize the application to the visual viewport and lift its fixed bottom controls',()=>{
 const e=environment({height:844,visualHeight:724,iphone:true});
 assert.deepEqual(measureAppViewport(e),{width:390,height:724,topInset:0,bottomOffset:120,source:'visual-viewport',standalone:false});
});
test('iPhone standalone portrait fills one bounded status/home-indicator gap',()=>{
 const e=environment({height:785,visualHeight:785,iphone:true,standalone:true});
 assert.deepEqual(measureAppViewport(e),{width:390,height:844,topInset:65,bottomOffset:-59,source:'iphone-standalone-screen',standalone:true});
 e.win.getComputedStyle=()=>({getPropertyValue:()=>''});assert.equal(measureAppViewport(e).height,844,'ordinary status-bar delta is bounded even while env values settle');
 e.win.innerHeight=e.win.visualViewport.height=844;assert.equal(measureAppViewport(e).source,'visual-viewport');
});
test('standalone display-mode detection also covers iOS when navigator.standalone is absent',()=>{
 const e=environment({height:810,iphone:true});delete e.nav.standalone;e.win.matchMedia('(display-mode: standalone)').matches=true;
 assert.equal(measureAppViewport(e).height,844);assert.equal(measureAppViewport(e).standalone,true);
});
test('installed portrait iPhone canvas adds six pixels below the measured status bar without shortening the app or adding a bottom gap',()=>{
 for(const [width,height,top]of [[428,926,47],[390,844,59]]){
  const e=environment({width,height,screenWidth:width,screenHeight:height,iphone:true,standalone:true,safeTop:top}),sizes=[];
  const binding=bindAppViewport({...e,onResize:size=>sizes.push(size)});e.frame();
  const size=sizes[0];assert.equal(size.height,height);assert.equal(size.topInset,top+6,'small clearance keeps credits below the status bar fade');
  assert.equal(e.styles.get('--app-viewport-height'),height+'px','HTML screens retain their existing whole-app rectangle');
  assert.equal(e.styles.get('--app-canvas-top'),(top+6)+'px');assert.equal(e.styles.get('--app-canvas-height'),(height-top-6)+'px');
  assert.equal(parseFloat(e.styles.get('--app-canvas-top'))+parseFloat(e.styles.get('--app-canvas-height')),height,'native canvas ends at the physical app bottom');
  assert.equal(e.root.dataset.iphonePortraitInset,'true');binding.dispose();
 }
});
test('only installed portrait iPhones use the bounded status-bar fallback while env values settle',()=>{
 const modern=environment({width:428,height:926,screenWidth:428,screenHeight:926,iphone:true,standalone:true,safeTop:0});assert.equal(measureAppViewport(modern).topInset,53);
 const classic=environment({width:375,height:667,screenWidth:375,screenHeight:667,iphone:true,standalone:true,safeTop:0});assert.equal(measureAppViewport(classic).topInset,26);
 for(const e of [environment({iphone:true}),environment({standalone:true}),environment({width:844,height:390,iphone:true,standalone:true})])assert.equal(measureAppViewport(e).topInset,0);
});
test('safe-area settling changes native canvas size once even if the app size stays the same',()=>{
 const e=environment({iphone:true,standalone:true,safeTop:47}),sizes=[],binding=bindAppViewport({...e,onResize:size=>sizes.push(size)});e.frame();
 e.win.getComputedStyle=()=>({getPropertyValue:key=>key==='--app-safe-top'?'59px':key==='--app-safe-bottom'?'34px':''});binding.refresh();e.frame();
 assert.equal(sizes.length,2);assert.equal(sizes[0].height,sizes[1].height);assert.equal(e.styles.get('--app-canvas-height'),'779px');
 binding.refresh();e.frame();assert.equal(sizes.length,2,'unchanged status inset does not trigger another native resize');binding.dispose();
});
test('regular iPhone browsers, Android, iPad, mismatched width and landscape do not get a screen-height correction',()=>{
 const regular=environment({height:785,iphone:true});assert.equal(measureAppViewport(regular).height,785);
 for(const userAgent of ['Android Chrome','iPad Safari','Macintosh Safari']){
  const e=environment({height:785,standalone:true});e.nav.userAgent=userAgent;assert.equal(measureAppViewport(e).height,785);assert.equal(measureAppViewport(e).topInset,0);
 }
 const narrow=environment({width:360,height:785,iphone:true,standalone:true});assert.equal(measureAppViewport(narrow).height,785);
 const landscape=environment({width:844,height:390,iphone:true,standalone:true});assert.equal(measureAppViewport(landscape).height,390);
});
test('keyboard focus, larger unexplained gaps and page pinch cannot force the canvas to screen height',()=>{
 const e=environment({height:810,iphone:true,standalone:true});e.doc.activeElement={tagName:'INPUT'};assert.equal(measureAppViewport(e).height,810);
 e.doc.activeElement={isContentEditable:true};assert.equal(measureAppViewport(e).height,810);e.doc.activeElement=null;
 e.win.innerHeight=e.win.visualViewport.height=600;assert.equal(measureAppViewport(e).height,600);
 e.win.innerHeight=810;e.win.visualViewport.height=405;e.win.visualViewport.scale=2;assert.equal(measureAppViewport(e).height,810);
});
test('fullscreen is hidden on iPhone/iPod but genuine iPad/desktop/Android fullscreen remains available',()=>{
 for(const userAgent of ['iPhone Safari','iPhone CriOS','iPod']){
  const nav={userAgent};assert(isIPhone(nav));assert.equal(showFullscreenControl({nav,state:{canFullscreen:true}}),false);
 }
 for(const userAgent of ['iPad Safari','MacIntel Safari','Android Chrome']){
  const nav={userAgent};assert(!isIPhone(nav));assert.equal(showFullscreenControl({nav,state:{canFullscreen:true}}),true);
 }
});
test('unsupported and already-fullscreen app windows have no useless expand button, while API fullscreen retains exit',()=>{
 const nav={userAgent:'Android'};
 assert.equal(showFullscreenControl({nav,state:{canFullscreen:false}}),false);
 assert.equal(showFullscreenControl({nav,state:{canFullscreen:true},displayFullscreen:true}),false);
 assert.equal(showFullscreenControl({nav,state:{canFullscreen:true,fullscreen:true},displayFullscreen:true}),true);
});
test('viewport resize bursts coalesce into one browser frame and no idle render loop',()=>{
 const e=environment(),sizes=[],binding=bindAppViewport({...e,onResize:size=>sizes.push(size)});
 for(let i=0;i<20;i++){e.win.emit('resize');e.win.visualViewport.emit('resize');}
 assert.equal(e.raf.size,1);e.frame();assert.equal(sizes.length,1);assert.equal(e.styles.get('--app-viewport-height'),'844px');assert.equal(e.styles.get('--app-viewport-width'),'390px');assert.equal(e.raf.size,0);
 e.settle();e.frame();assert.equal(sizes.length,1,'settling unchanged geometry sends no duplicate native resize');assert.equal(e.raf.size,0);assert.equal(e.timers.size,0);
 e.win.visualViewport.height=724;e.win.visualViewport.emit('resize');e.frame();assert.equal(sizes.length,2);assert.equal(e.styles.get('--app-viewport-bottom-offset'),'120px');
 binding.dispose();
});
test('orientation and resume receive one delayed settling sample without a permanent timer',()=>{
 const e=environment({iphone:true,standalone:true}),sizes=[],binding=bindAppViewport({...e,onResize:size=>sizes.push(size)});e.frame();e.settle();e.frame();
 e.win.emit('orientationchange');e.win.emit('pageshow');assert.equal(e.timers.size,1);e.frame();
 e.win.innerWidth=e.win.visualViewport.width=844;e.win.innerHeight=e.win.visualViewport.height=390;
 e.settle();e.frame();assert.equal(sizes.at(-1).width,844);assert.equal(sizes.at(-1).height,390);assert.equal(e.timers.size,0);
 assert.equal(sizes.at(-1).topInset,0);assert.equal(e.root.dataset.iphonePortraitInset,'false');assert.equal(e.styles.get('--app-canvas-top'),'0px');assert.equal(e.styles.get('--app-canvas-height'),'390px');
 e.doc.hidden=true;e.doc.emit('visibilitychange');assert.equal(e.raf.size,0);
 e.doc.hidden=false;e.doc.emit('visibilitychange');assert.equal(e.raf.size,1);e.frame();e.settle();e.frame();assert.equal(e.timers.size,0);
 binding.dispose();
});
test('fullscreen and display-mode events recompute the same layout rectangle',()=>{
 const e=environment({iphone:true,height:785}),sizes=[],binding=bindAppViewport({...e,onResize:size=>sizes.push(size)});e.frame();assert.equal(sizes.at(-1).height,785);
 e.win.matchMedia('(display-mode: standalone)').matches=true;e.win.matchMedia('(display-mode: standalone)').emit('change');e.frame();assert.equal(sizes.at(-1).height,844);assert.equal(e.root.dataset.appStandalone,'true');
 e.doc.emit('fullscreenchange');e.doc.emit('webkitfullscreenchange');assert.equal(e.raf.size,1);
 binding.dispose();
});
test('dispose removes resize/media listeners and cancels queued callbacks',()=>{
 const e=environment(),sizes=[],binding=bindAppViewport({...e,onResize:size=>sizes.push(size)});assert.equal(e.raf.size,1);assert.equal(e.timers.size,1);binding.dispose();
 assert.equal(e.raf.size,0);assert.equal(e.timers.size,0);for(const target of [e.win,e.doc,e.win.visualViewport,...e.modes.values()])for(const listeners of target.listeners.values())assert.equal(listeners.size,0);
 e.win.emit('resize');e.frame();e.settle();assert.equal(sizes.length,0);
});
