// Deterministic DOM/RAF boundary tests. No game runtime or browser is loaded.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NativeArt} from '../web/native-ui.mjs';

let now=0,nextRaf=1;const raf=new Map(),observers=[];
class Target {
 constructor(){this.events=new Map();this.attrs=new Map();this.disabled=false;this.focusVisible=false;this.box={width:220,height:56};this.classList={add(){}};}
 addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
 removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
 dispatch(name,values={}){for(const fn of [...this.events.get(name)||[]])fn({button:0,isPrimary:true,...values});}
 setAttribute(name,value){this.attrs.set(name,value);}
 getAttribute(name){return this.attrs.get(name)??null;}
 replaceChildren(...children){this.children=children;}
 getBoundingClientRect(){return this.box;}
 matches(selector){assert.equal(selector,':focus-visible');return this.focusVisible;}
}
const context={setTransform(){},clearRect(){},imageSmoothingEnabled:false};
globalThis.window=new Target();globalThis.devicePixelRatio=1;
globalThis.document={createElement(name){assert.equal(name,'canvas');return {width:0,height:0,setAttribute(){},getContext(){return context;}};}};
globalThis.ResizeObserver=class {constructor(cb){this.cb=cb;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
globalThis.performance={now:()=>now};
globalThis.requestAnimationFrame=cb=>{const id=nextRaf++;raf.set(id,cb);return id;};
globalThis.cancelAnimationFrame=id=>raf.delete(id);
const tick=at=>{now=at;const pending=[...raf];for(const [id,cb]of pending){raf.delete(id);cb(at);}};
const art=new NativeArt();art.ready=true;art.skin={fonts:{uiShadow:{}}};
let painted=[];art.frame=(ctx,name)=>painted.push(name);art.text=()=>{};
const focus=()=>painted.filter(n=>n.startsWith('command-focus-'));
const paintCount=()=>painted.length;
const button=new Target(),view=art.decorate(button,'CONTINUE',{selected:true});
assert.equal(button._nativeArtView,view);
assert.deepEqual(focus(),[],'a selected option must never become a permanent selection frame');
assert.equal(button.events.get('click')?.size||0,0,'the shared shell owns clicks/game actions');
const count=paintCount();view.draw();view.update('CONTINUE',{selected:false});
assert.equal(paintCount(),count,'unchanged visible content must not reset or repaint the canvas');

painted=[];button.dispatch('pointerdown');
assert.deepEqual(focus(),['command-focus-0'],'pointer press paints immediately without waiting for RAF');
assert.equal(art.pressedViews.size,1);
window.dispatch('pointerup');
assert.equal(art.pressedViews.size,0);assert.equal(painted.at(-1),'command-skin-normal');

painted=[];view.pulse();view.pulse();
assert.deepEqual(focus(),['command-focus-0']);assert.equal(raf.size,1,'one click cannot create two animation chains');
tick(49);assert.deepEqual(focus(),['command-focus-0']);
tick(50);tick(100);tick(150);
assert.deepEqual(focus(),['command-focus-0','command-focus-1','command-focus-2','command-focus-1']);
tick(199);assert.equal(raf.size,1);tick(200);
assert.equal(raf.size,0);assert.equal(painted.at(-1),'command-skin-normal','the click pulse ends without a persistent frame');

now=250;view.pulse();assert.equal(raf.size,1);view.press();
assert.equal(raf.size,0,'a new press replaces an older pulse');
view.release();assert.equal(painted.at(-1),'command-skin-normal');
button.dispatch('pointerdown',{button:2});button.dispatch('pointerdown',{isPrimary:false});
assert.equal(art.pressedViews.size,0,'secondary or nonprimary pointers never hold feedback');
button.disabled=true;view.press();view.pulse();assert.equal(raf.size,0);assert.equal(art.pressedViews.size,0);button.disabled=false;

painted=[];button.focusVisible=true;button.dispatch('focus');
assert.deepEqual(focus(),['command-focus-0'],'keyboard focus-visible retains an accessible native focus indicator');
button.focusVisible=false;button.dispatch('blur');assert.equal(painted.at(-1),'command-skin-normal');
now=300;view.pulse();assert.equal(raf.size,1);view.dispose();
assert.equal(raf.size,0);assert.equal(button._nativeArtView,undefined);assert.equal(art.buttonViews.size,0);assert.equal(art.pressedViews.size,0);assert(observers[0].disconnected);
assert.equal([...button.events.values()].reduce((n,s)=>n+s.size,0),0,'dispose removes every local listener');
const disposedPaints=paintCount();view.press();view.release();view.pulse();view.update('STALE');view.draw();tick(700);assert.equal(paintCount(),disposedPaints);

const old=art.decorate(button,'OLD'),replacement=art.decorate(button,'NEW');
assert.equal(button._nativeArtView,replacement);assert.equal(art.buttonViews.size,1);old.dispose();assert.equal(button._nativeArtView,replacement,'disposing a superseded view cannot remove its replacement');
replacement.dispose();assert.equal(art.buttonViews.size,0);

const native=JSON.parse(readFileSync(new URL('../web/ui-assets/screen-assets/manifest.json',import.meta.url)));
for(const phase of [0,1,2])assert(native.modules['command-focus-'+phase]?.frameOnly,'feedback uses existing original PNG frame modules');
console.log('PASS native button press/release,200ms PNG pulse,focus-visible,oneRAF,unchanged paint and lifecycle cleanup');
