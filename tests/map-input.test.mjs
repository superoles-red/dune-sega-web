import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMapInput} from '../web/map-input.mjs';
import {MapGestures} from '../web/gestures.mjs';
class Canvas{
 constructor(){this.listeners=new Map();this.captured=new Set();this.kinds=new Map();this.captures=0;this.releases=0;}
 addEventListener(name,fn,options){const list=this.listeners.get(name)??[];list.push({fn,capture:options===true||!!options?.capture});this.listeners.set(name,list);}
 getBoundingClientRect(){return {left:20,top:30};}
 setPointerCapture(id){this.captured.add(id);this.captures++;}
 releasePointerCapture(id){if(!this.captured.delete(id))return;this.releases++;this.emit('lostpointercapture',{pointerId:id,pointerType:this.kinds.get(id)});}
 emit(name,properties={}){
  const e={type:name,pointerId:1,pointerType:'mouse',button:0,buttons:0,clientX:120,clientY:130,defaultPrevented:false,immediateStopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.immediateStopped=true;},...properties};
  this.kinds.set(e.pointerId,e.pointerType);
  for(const {fn}of [...(this.listeners.get(name)??[])].sort((a,b)=>+b.capture-+a.capture)){fn(e);if(e.immediateStopped)break;}
  return e;
 }
}
function setup(options={}){
 const canvas=new Canvas(),calls={begin:[],end:[],tap:[],command:[],pan:[],zoom:[],hover:[],cancel:0,placeStart:0,placeCancel:0,placeEnd:0,miniMove:[]};let input;
 const gestures=new MapGestures({canPanAt:()=>options.world!==false,minimapStart:()=>!!options.minimap,minimapMove:(...p)=>calls.miniMove.push(p),tap:(...p)=>calls.tap.push(p),pan:(...p)=>calls.pan.push(p),zoom:(...p)=>calls.zoom.push(p),placementStart:()=>{calls.placeStart++;return !!options.place;},placementMove(){},placementEnd:()=>calls.placeEnd++,placementCancel:()=>calls.placeCancel++});
 input=bindMapInput(canvas,{begin:(id,p,kind)=>{calls.begin.push({id,...p,kind});if(options.disabled)return false;gestures.down({id,...p,kind});return true;},move:(id,p)=>gestures.move({id,...p}),end:(id,p)=>{calls.end.push({id,...p});gestures.up({id,...p});},command:(p,kind)=>calls.command.push({p,kind}),cancel:()=>{calls.cancel++;input.reset();gestures.cancel();},hover:p=>calls.hover.push(p)},{pointerEvents:options.pointerEvents!==false});
 return {canvas,calls,gestures,input};
}
test('actual Safari pointerup→lostcapture→compatmouseup commits one tap even with buttons0',()=>{
 const {canvas,calls,input}=setup();for(const name of ['pointerdown','mousedown','pointerup','lostpointercapture','mouseup','click'])canvas.emit(name,name==='lostpointercapture'?{clientX:0,clientY:0}:{});
 assert.equal(calls.begin.length,1);assert.deepEqual(calls.tap,[[100,100,'mouse']]);assert.equal(calls.end.length,1);assert.equal(calls.cancel,0);assert.equal(input.activeCount,0);
});
test('Chrome compatibility ordering also commits one tap; same-target SDL bubble listeners see no events',()=>{
 const {canvas,calls}=setup();let sdl=0;for(const name of ['mousedown','mousemove','mouseup','click'])canvas.addEventListener(name,()=>sdl++,false);
 for(const name of ['pointerdown','mousedown','pointermove','mousemove','pointerup','mouseup','lostpointercapture','click'])canvas.emit(name);
 assert.equal(calls.tap.length,1);assert.equal(calls.begin.length,1);assert.equal(calls.cancel,0);assert.equal(sdl,0);
});
test('compatibility mouse events alone never become a second pointer stream',()=>{
 const {canvas,calls}=setup();for(const name of ['mousedown','mousemove','mouseup','click'])canvas.emit(name);
 assert.equal(calls.begin.length,0);assert.equal(calls.tap.length,0);assert.equal(calls.hover.length,0);
});
test('mouse pan uses CSS-local positions once and never commits a command on release',()=>{
 const {canvas,calls}=setup();canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:140,buttons:1});canvas.emit('mousemove',{clientX:140});canvas.emit('pointerup',{clientX:140});canvas.emit('mouseup',{clientX:140});
 assert.deepEqual(calls.pan,[[20,0]]);assert.equal(calls.tap.length,0);assert.equal(calls.cancel,0);
});
test('unexpected capture loss cancels once; late pointerup and compatmouseup do not commit',()=>{
 const {canvas,calls,input}=setup();canvas.emit('pointerdown');canvas.emit('lostpointercapture');canvas.emit('pointerup');canvas.emit('mouseup');
 assert.equal(calls.cancel,1);assert.equal(calls.tap.length,0);assert.equal(input.activeCount,0);
});
test('pointercancel aborts original placement once without a placement confirmation',()=>{
 const {canvas,calls}=setup({place:true});canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:150,buttons:1});canvas.emit('pointercancel');canvas.emit('pointerup');
 assert.equal(calls.placeCancel,1);assert.equal(calls.placeEnd,0);assert.equal(calls.tap.length,0);assert.equal(calls.cancel,1);
});
test('touch pinch and subsequent one-finger pan preserve gesture recognition without taps',()=>{
 const {canvas,calls,input}=setup();canvas.emit('pointerdown',{pointerId:11,pointerType:'touch',clientX:100});canvas.emit('pointerdown',{pointerId:12,pointerType:'touch',clientX:140});canvas.emit('pointermove',{pointerId:12,pointerType:'touch',clientX:180});canvas.emit('pointerup',{pointerId:11,pointerType:'touch',clientX:100});canvas.emit('pointermove',{pointerId:12,pointerType:'touch',clientX:190});canvas.emit('pointerup',{pointerId:12,pointerType:'touch',clientX:190});
 assert.equal(calls.zoom.filter(p=>p[0]!==1).length,1);assert.equal(calls.zoom.reduce((scale,p)=>scale*p[0],1),2);assert.deepEqual(calls.pan,[[20,0],[10,0]]);assert.equal(calls.tap.length,0);assert.equal(calls.cancel,0);assert.equal(input.activeCount,0);
});
test('pen down/up uses the same direct release; raw touch compatibility is prevented',()=>{
 const {canvas,calls}=setup();canvas.emit('pointerdown',{pointerType:'pen'});canvas.emit('pointerup',{pointerType:'pen'});assert.equal(calls.tap.length,1);assert.equal(calls.begin[0].kind,'pen');assert.equal(canvas.emit('touchstart').defaultPrevented,true);
});
test('minimap press/drag/release remains a camera action with no contextual A tap',()=>{
 const {canvas,calls}=setup({minimap:true,world:false});canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:160});canvas.emit('pointerup',{clientX:160});assert.ok(calls.miniMove.length>=1);assert.equal(calls.tap.length,0);assert.equal(calls.pan.length,0);
});
test('middle mouse is ignored and right mouse releases only the command callback',()=>{
 const {canvas,calls,input}=setup();for(const button of [1,2]){canvas.emit('pointerdown',{button});canvas.emit('pointerup',{button});canvas.emit('mousedown',{button});canvas.emit('mouseup',{button});}assert.equal(calls.begin.length,0);assert.equal(calls.tap.length,0);assert.equal(calls.command.length,1);assert.equal(input.activeCount,0);
});
test('legacy mouse-only fallback is enabled only when Pointer Events are unavailable',()=>{
 const {canvas,calls,input}=setup({pointerEvents:false});canvas.emit('pointerdown');canvas.emit('mousedown');canvas.emit('mousemove');canvas.emit('mouseup');assert.equal(calls.begin.length,1);assert.equal(calls.begin[0].id,'mouse');assert.equal(calls.tap.length,1);assert.equal(canvas.captures,0);assert.equal(input.activeCount,0);
});
test('blocked UI/reset cannot leave held capture or generate a later tap',()=>{
 const disabled=setup({disabled:true});disabled.canvas.emit('pointerdown');disabled.canvas.emit('pointerup');assert.equal(disabled.calls.tap.length,0);assert.equal(disabled.input.activeCount,0);assert.equal(disabled.canvas.captures,0);
 const {canvas,calls,input,gestures}=setup();canvas.emit('pointerdown');input.reset();gestures.cancel();canvas.emit('pointerup');assert.equal(calls.tap.length,0);assert.equal(calls.cancel,0);assert.equal(input.activeCount,0);
});
test('pointer hover reports CSS-local coordinates once, ignoring compatibility mousemove',()=>{
 const {canvas,calls}=setup();canvas.emit('pointermove',{clientX:90,clientY:110});canvas.emit('mousemove',{clientX:90,clientY:110});assert.deepEqual(calls.hover,[{x:70,y:80}]);
});
test('hover identifies the actual pointer source on hybrid touch/mouse devices',()=>{
 for(const pointerEvents of [true,false]){
  const canvas=new Canvas(),hover=[];
  bindMapInput(canvas,{begin(){},move(){},end(){},cancel(){},hover:(p,kind)=>hover.push({p,kind})},{pointerEvents});
  if(pointerEvents){
   canvas.emit('pointermove',{pointerType:'touch'});canvas.emit('pointermove',{pointerType:'pen'});canvas.emit('pointermove',{pointerType:'mouse'});
   assert.deepEqual(hover,[{p:{x:100,y:100},kind:'pen'},{p:{x:100,y:100},kind:'mouse'}]);
  }else{canvas.emit('mousemove');assert.deepEqual(hover,[{p:{x:100,y:100},kind:'mouse'}]);}
 }
});


test('PUBLIC Safari phantom unpressed hover between stationary down/up stays one tap and cannot begin placement',()=>{
 for(const place of [false,true]){const {canvas,calls,input}=setup({place});
  canvas.emit('pointerdown',{clientX:475,clientY:460,buttons:0});
  canvas.emit('pointermove',{clientX:770,clientY:612,button:-1,buttons:0});
  canvas.emit('pointerup',{clientX:475,clientY:460,buttons:0});
  canvas.emit('lostpointercapture',{clientX:0,clientY:0,buttons:0});
  assert.deepEqual(calls.tap,[[455,430,'mouse']]);assert.equal(calls.pan.length,0);assert.equal(calls.placeStart,0);assert.equal(calls.placeEnd,0);assert.equal(calls.hover.length,0);assert.equal(calls.cancel,0);assert.equal(input.activeCount,0);
 }
});
test('AX mouse drag with unpressed moves still pans once from the final release position',()=>{
 const {canvas,calls}=setup();canvas.emit('pointerdown');canvas.emit('pointermove',{clientX:770,clientY:612,buttons:0});assert.equal(calls.pan.length,0);canvas.emit('pointerup',{clientX:220,clientY:130,buttons:0});assert.deepEqual(calls.pan,[[100,0]]);assert.equal(calls.tap.length,0);
});
test('pen movement with buttons0 remains a live drag; the unpressed guard applies to mouse only',()=>{
 const {canvas,calls}=setup();canvas.emit('pointerdown',{pointerType:'pen'});canvas.emit('pointermove',{pointerType:'pen',clientX:140,buttons:0});assert.deepEqual(calls.pan,[[20,0]]);canvas.emit('pointerup',{pointerType:'pen',clientX:140});assert.equal(calls.tap.length,0);
});
test('right pointer release commits once before Safari capture loss and suppresses all compatibility events',()=>{
 const {canvas,calls,input}=setup();for(const name of ['pointerdown','mousedown','pointerup','mouseup','click','dblclick','auxclick','contextmenu'])canvas.emit(name,{button:2});
 assert.deepEqual(calls.command,[{p:{x:100,y:100},kind:'mouse'}]);assert.equal(calls.begin.length,0);assert.equal(calls.end.length,0);assert.equal(calls.cancel,0);assert.equal(canvas.releases,1);assert.equal(input.activeCount,0);
});
test('right drag, including a return to origin or a moved release, never commands or hovers',()=>{
 for(const pointerEvents of [true,false])for(const returnToOrigin of [true,false]){
  const {canvas,calls,input}=setup({pointerEvents}),prefix=pointerEvents?'pointer':'mouse';
  canvas.emit(prefix+'down',{button:2});canvas.emit(prefix+'move',{button:-1,buttons:2,clientX:145});
  canvas.emit(prefix+'up',{button:2,clientX:returnToOrigin?120:145});
  assert.equal(calls.command.length,0);assert.equal(calls.begin.length,0);assert.equal(calls.hover.length,0);assert.equal(calls.pan.length,0);assert.equal(calls.cancel,1);assert.equal(input.activeCount,0);
 }
});
test('right drag threshold is eight CSS pixels and release position catches AX drags with unpressed moves',()=>{
 for(const pointerEvents of [true,false])for(const delta of [8,9]){
  const {canvas,calls}=setup({pointerEvents}),prefix=pointerEvents?'pointer':'mouse';
  canvas.emit(prefix+'down',{button:2});canvas.emit(prefix+'move',{clientX:770,buttons:0});canvas.emit(prefix+'up',{button:2,clientX:120+delta});
  assert.equal(calls.command.length,delta===8?1:0);assert.equal(calls.hover.length,0);
 }
});
test('right cancel, unexpected loss and outer blur/reset consume ownership without a late command',()=>{
 for(const action of ['pointercancel','lostpointercapture','blur']){
  const {canvas,calls,input,gestures}=setup();canvas.emit('pointerdown',{button:2});
  if(action==='blur'){input.reset();gestures.cancel();}else canvas.emit(action,{button:2});
  canvas.emit('pointerup',{button:2});canvas.emit('mouseup',{button:2});
  assert.equal(calls.command.length,0);assert.equal(calls.cancel,action==='blur'?0:1);assert.equal(input.activeCount,0);
 }
 const {canvas,calls,input}=setup({pointerEvents:false});canvas.emit('mousedown',{button:2});input.reset();canvas.emit('mouseup',{button:2});assert.equal(calls.command.length,0);
});
test('wrong-button release cannot commit held right pointer or fallback mouse',()=>{
 for(const pointerEvents of [true,false]){
  const {canvas,calls,input}=setup({pointerEvents}),prefix=pointerEvents?'pointer':'mouse';
  canvas.emit(prefix+'down',{button:2});canvas.emit(prefix+'up',{button:0});assert.equal(input.activeCount,1);assert.equal(calls.command.length,0);
  canvas.emit(prefix+'up',{button:2});assert.equal(calls.command.length,1);assert.equal(input.activeCount,0);
 }
});
test('legacy mouse right command commits once; synthetic clicks and double clicks never command',()=>{
 const {canvas,calls}=setup({pointerEvents:false});for(const name of ['click','dblclick','auxclick','contextmenu'])canvas.emit(name,{button:2});assert.equal(calls.command.length,0);
 canvas.emit('mousedown',{button:2});canvas.emit('mouseup',{button:2});canvas.emit('contextmenu',{button:2});assert.equal(calls.command.length,1);assert.equal(calls.begin.length,0);
});
