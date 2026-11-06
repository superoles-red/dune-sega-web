import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PanInertia} from '../web/pan-inertia.mjs';
import {MapGestures,placementEdgeVelocity} from '../web/gestures.mjs';

// Execute the actual host's pointer lifecycle, gesture callbacks and RAF path.
// Native calls are receipts only: this checks camera ownership/no commands,
// not a replacement for original camera bounds or physical-device feel.
const source=readFileSync(new URL('../web/shell.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function host({minimap=false}={}){
 let now=0;const calls=[];
 const scope={MapGestures,placementEdgeVelocity,ready:true,gameUI:null,legacyMode:false,
  panMayCoast:false,inertialCameraHeld:false,panInertia:new PanInertia(),nativeHold:false,
  pendingReadyYard:null,lastPointerPoint:null,lastPointerKind:'touch',lastGesture:'idle',lastEdgeTime:0,
  effectivePointerKind:k=>k,performance:{now:()=>now},canvas:{focus(){},clientWidth:390,clientHeight:844},query:()=>1,
  counters:{panEvents:0,placementDrags:0,edgePans:0},mapInput:null,
  orders:{cancel(){},flush(){}},mapTap:(...p)=>calls.push(['tap',...p]),resumeAudio(){},
  orderFeedback:{active:false,setPointerKind(){},aimAt(){},releaseAim(){},panAim(){}},
  document:{body:{classList:{toggle(){}}}},requestAnimationFrame:()=>0};
 scope.Module={
  _dune_web_begin:()=>{scope.nativeHold=true;calls.push(['begin']);return 1;},
  _dune_web_end:()=>{scope.nativeHold=false;calls.push(['end']);},
  _dune_web_pan:(dx,dy)=>{calls.push(['pan',dx,dy,scope.nativeHold]);return scope.nativeHold?1:0;},
  _dune_web_minimap_begin:()=>minimap?1:0,_dune_web_minimap_move(){},_dune_web_zoom(){}};
 const functions=section('function stopPanMotion()','const orders='),gestures=section('const gestures=new MapGestures(','// One PointerEvent stream'),frame=section('function placementFrame(now)','if(inputCheckMode)import(');
 const api=vm.runInNewContext(functions+gestures+frame+'\n({beginPointer,endPointer,cancelGesture,gestures,placementFrame})',scope);
 return {scope,calls,...api,at:t=>{now=t;},coasting:()=>scope.panInertia.active};
}
const move=(h,x,y=200,id=1)=>h.gestures.move({id,x,y});
const start=(h,kind='touch')=>h.beginPointer(1,{x:100,y:200},kind);
const end=(h,x,y=200,id=1)=>h.endPointer(id,{x,y});

test('one coalesced phone pan plus equal-clock release keeps native camera held through the RAF tail',()=>{
 const h=host();h.at(0);start(h);h.at(33);move(h,160);end(h,170);
 assert.equal(h.coasting(),true);assert.equal(h.scope.inertialCameraHeld,true);assert.equal(h.scope.nativeHold,true);
 assert.equal(h.calls.filter(c=>c[0]==='end').length,0);
 const heldPans=h.calls.length;h.at(49);h.placementFrame(49);
 assert.ok(h.calls.length>heldPans);assert.ok(h.calls.at(-1)[1]>0);assert.equal(h.calls.at(-1)[3],true);
 assert.equal(h.calls.filter(c=>c[0]==='tap').length,0);
});

test('a finger held before a short swipe still coasts after its one fresh final event',()=>{
 const h=host();h.at(0);start(h);h.at(300);move(h,125);h.at(333);move(h,155);end(h,165);
 assert.equal(h.coasting(),true);h.at(350);h.placementFrame(350);assert.equal(h.scope.nativeHold,true);
});

test('a resting finger followed by one substantial coalesced pan gets a modest native RAF tail',()=>{
 const h=host();h.at(0);start(h);h.at(333);move(h,160);h.at(350);end(h,160);
 assert.equal(h.coasting(),true);assert.equal(h.scope.nativeHold,true);assert.ok(h.scope.panInertia.vx<=300);
 const before=h.calls.length;let now=350;
 while(h.coasting()){now+=1000/60;h.at(now);h.placementFrame(now);}
 const tail=h.calls.slice(before).filter(c=>c[0]==='pan').reduce((total,c)=>total+c[1],0);
 assert.ok(tail>40&&tail<70);assert.equal(h.scope.nativeHold,false);assert.equal(h.calls.filter(c=>c[0]==='tap').length,0);
});

test('new touch immediately ends the old tail before starting a new drag; a stationary release remains a tap',()=>{
 const h=host();h.at(0);start(h);h.at(33);move(h,160);end(h,160);assert.equal(h.coasting(),true);
 h.at(50);h.beginPointer(2,{x:200,y:200},'touch');assert.equal(h.coasting(),false);
 assert.deepEqual(h.calls.filter(c=>c[0]!=='pan'),[['begin'],['end'],['begin']]);
 const before=h.calls.filter(c=>c[0]==='pan').length;h.at(66);h.placementFrame(66);assert.equal(h.calls.filter(c=>c[0]==='pan').length,before);
 h.at(80);end(h,200,200,2);assert.equal(h.calls.filter(c=>c[0]==='tap').length,1);assert.equal(h.scope.nativeHold,false);
});

test('cancel, native UI capture and long RAF suspension stop without a delayed camera jump',()=>{
 for(const stop of ['cancel','menu','stall']){
  const h=host();h.at(0);start(h);h.at(33);move(h,160);end(h,160);assert.equal(h.coasting(),true);const before=h.calls.filter(c=>c[0]==='pan').length;
  if(stop==='cancel')h.cancelGesture();if(stop==='menu')h.scope.gameUI={capturesInput:true,render(){}};
  h.at(stop==='stall'?220:50);h.placementFrame(stop==='stall'?220:50);
  assert.equal(h.coasting(),false,stop);assert.equal(h.scope.nativeHold,false,stop);assert.equal(h.calls.filter(c=>c[0]==='pan').length,before,stop);
 }
});

test('mouse, minimap, pinch and a deliberately held release do not inherit phone momentum',()=>{
 for(const kind of ['mouse','minimap','pinch','hold']){
  const h=host({minimap:kind==='minimap'});h.at(0);start(h,kind==='mouse'?'mouse':'touch');h.at(33);move(h,160);
  if(kind==='pinch'){h.at(40);h.beginPointer(2,{x:220,y:200},'touch');h.at(60);move(h,240,200,2);end(h,240,200,2);}
  h.at(kind==='hold'?200:70);end(h,160);assert.equal(h.coasting(),false,kind);assert.equal(h.scope.nativeHold,false,kind);assert.equal(h.calls.filter(c=>c[0]==='tap').length,0,kind);
 }
});
