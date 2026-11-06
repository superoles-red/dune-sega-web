import test from 'node:test';
import assert from 'node:assert/strict';
import {PlacementMode,placementScreenToWorld,placementWorldToScreen,placementPointVisible} from '../web/placement-mode.mjs';

const camera=()=>({map:1,left:100,top:200,scale:2,scaleY:3,cssWidth:400,cssHeight:600});
function setup(options={}){
 const state={map:true,blocked:false,placementActive:false,powerArmed:false,runId:'run-a',outcomeSeq:0},calls=[],changes=[];
 const callbacks={};
 for(const name of ['beginPlacement','movePlacement','confirmPlacement','cancelPlacement','confirmPower','cancelPower'])callbacks[name]=(...args)=>{calls.push([name,...args]);return options[name]?.(...args)??1;};
 const mode=new PlacementMode({...callbacks,readState:()=>({...state}),onChange:s=>changes.push(s),...options.controller});mode.sync(camera(),state);
 return {mode,state,calls,changes};
}
const names=s=>s.calls.map(c=>c[0]);

test('CSS/world projection uses both original camera axes without DPR or invented grid rounding',()=>{
 const c=camera();assert.deepEqual(placementScreenToWorld(51,63,c),{x:125.5,y:221});
 assert.deepEqual(placementWorldToScreen({x:125.5,y:221},c),{x:51,y:63});
 assert.equal(placementScreenToWorld(400,0,c),null);assert.equal(placementScreenToWorld(0,-1,c),null);
 assert.equal(placementScreenToWorld(0,0,{...c,scale:0}),null);
 assert.equal(placementWorldToScreen({x:NaN,y:1},c),null);
 assert.deepEqual(placementWorldToScreen({x:99,y:199},c),{x:-2,y:-3},'offscreen projection retains the actual world anchor');
});

test('minimap hides the visual point and is not a new map target',()=>{
 const c={...camera(),minimap:{visible:true,x:300,y:500,width:64,height:64}};
 assert.equal(placementPointVisible({x:310,y:510},c),false);
 assert.equal(placementScreenToWorld(310,510,c),null);
 assert.equal(placementPointVisible({x:299,y:510},c),true);
});

test('a ready construction does not auto-enter placement; the explicit ready tap immediately begins its native preview',()=>{
 const s=setup();s.state.readyYard=true;s.mode.sync(camera(),s.state);
 assert.equal(s.mode.active,false);assert.deepEqual(s.calls,[]);
 assert.equal(s.mode.beginPlacement(120,150),true);
 assert.deepEqual(s.calls,[['beginPlacement',120,150,{x:160,y:250}]]);
 assert.deepEqual(s.mode.snapshot().target,{x:160,y:250});assert.equal(s.mode.snapshot().canConfirm,true);
 assert.equal(s.mode.beginPlacement(130,160),false,'an active mode cannot silently replace its native operation');
 assert.deepEqual(names(s),['beginPlacement']);
});

test('native refusal and invalid input never create a host-only placement',()=>{
 const refused=setup({beginPlacement:()=>0});assert.equal(refused.mode.beginPlacement(120,150),false);assert.equal(refused.mode.active,false);
 const s=setup();assert.equal(s.mode.beginPlacement(NaN,150),false);assert.equal(s.mode.beginPlacement(500,150),false);assert.deepEqual(s.calls,[]);
 s.state.blocked=true;assert.equal(s.mode.beginPlacement(10,10),false);
});

test('a placement tap changes the native preview without confirming or inventing placement validity',()=>{
 const s=setup();s.mode.beginPlacement(120,150);assert.equal(s.mode.tap(140,180),true);
 assert.deepEqual(s.calls.at(-1),['movePlacement',140,180,{x:170,y:260}]);
 assert.deepEqual(s.mode.snapshot().target,{x:170,y:260});assert.deepEqual(names(s),['beginPlacement','movePlacement']);
 assert.equal(s.mode.confirm(),true);assert.deepEqual(s.calls.at(-1),['confirmPlacement',140,180,{x:170,y:260}]);
 assert.equal(s.mode.active,false);assert.equal(s.mode.confirm(),false);assert.equal(names(s).filter(n=>n==='confirmPlacement').length,1);
});

test('an unaccepted native move retains the preceding chosen tile',()=>{
 const s=setup({movePlacement:()=>0});s.mode.beginPlacement(120,150);
 assert.equal(s.mode.tap(140,180),false);assert.deepEqual(s.mode.snapshot().target,{x:160,y:250});
 assert.equal(s.mode.tap(Infinity,180),false);assert.equal(names(s).filter(n=>n==='movePlacement').length,1);
});

test('pan, pinch zoom and resize only reproject the chosen world target; no synthetic native move is needed',()=>{
 const s=setup();s.mode.beginPlacement(120,150);const original=s.mode.snapshot().target;
 const c={...camera(),left:130,top:240,scale:3,scaleY:2,cssWidth:800,cssHeight:390};
 s.mode.sync(c,s.state);assert.deepEqual(s.mode.snapshot().target,original);assert.deepEqual(s.mode.snapshot().screen,{x:90,y:20});
 assert.deepEqual(names(s),['beginPlacement'],'camera changes never relocate or place the building');
 assert.equal(s.mode.confirm(),true);assert.deepEqual(s.calls.at(-1),['confirmPlacement',90,20,original]);
});

test('offscreen or HUD-covered anchors can be confirmed through original world APIs without choosing a new screen point',()=>{
 for(const c of [{...camera(),left:1000,top:1000},{...camera(),minimap:{visible:true,x:100,y:100,width:100,height:100}}]){
  const s=setup();s.mode.beginPlacement(120,150);s.mode.sync(c,s.state);
  assert.equal(s.mode.snapshot().visible,false);assert.equal(s.mode.snapshot().canConfirm,true);
  assert.equal(s.mode.confirm(),true);assert.deepEqual(s.calls.at(-1).at(-1),{x:160,y:250});
 }
});

test('the native world confirmation remains possible while a transient camera projection is unavailable',()=>{
 const s=setup();s.mode.beginPlacement(120,150);s.mode.sync({...camera(),scale:0},s.state);
 assert.equal(s.mode.snapshot().screen,null);assert.equal(s.mode.snapshot().canConfirm,true);assert.equal(s.mode.confirm(),true);
 assert(Number.isNaN(s.calls.at(-1)[1]));assert(Number.isNaN(s.calls.at(-1)[2]));assert.deepEqual(s.calls.at(-1)[3],{x:160,y:250});
});

test('an immediate native rejection leaves the preview and chosen point available; polls never retry commands',()=>{
 const s=setup({confirmPlacement:()=>0});s.mode.beginPlacement(120,150);assert.equal(s.mode.confirm(),false);
 assert.equal(s.mode.active,true);assert.equal(s.mode.snapshot().reason,'confirm-rejected');
 for(let i=0;i<5;i++)s.mode.sync(camera(),s.state);
 assert.equal(names(s).filter(n=>n==='confirmPlacement').length,1);assert.deepEqual(s.mode.snapshot().target,{x:160,y:250});
});

test('cancel calls only the native cancellation once and leaves the external ready product untouched',()=>{
 const s=setup();s.state.readyYard=true;s.mode.beginPlacement(120,150);assert.equal(s.mode.cancel(),true);assert.equal(s.mode.cancel(),false);
 assert.equal(s.state.readyYard,true);assert.deepEqual(names(s),['beginPlacement','cancelPlacement']);assert.equal(s.mode.active,false);
});

test('a queued native placement can start on a later poll, then end without an extra B/cancel action',()=>{
 const s=setup();s.mode.beginPlacement(120,150);s.mode.sync(camera(),s.state);assert.equal(s.mode.active,true);
 s.state.placementActive=true;s.mode.sync(camera(),s.state);assert.equal(s.mode.active,true);
 s.state.placementActive=false;s.mode.sync(camera(),s.state);assert.equal(s.mode.active,false);
 assert.deepEqual(names(s),['beginPlacement']);
});

test('Palace mode stores its opaque identity and world point, never a cached native ticket or hover command',()=>{
 const s=setup(),actor={palacePointer:77,palaceId:3};s.state.powerArmed=true;
 assert.equal(s.mode.beginPower(actor,120,150),true);assert.deepEqual(s.calls,[]);
 assert.equal(s.mode.tap(160,210),true);assert.deepEqual(s.mode.snapshot().target,{x:180,y:270});assert.deepEqual(s.calls,[]);
 s.mode.sync({...camera(),left:130,top:240,scale:3,scaleY:2},s.state);
 assert.deepEqual(s.mode.snapshot().screen,{x:150,y:60});assert.equal(s.mode.snapshot().identity,actor);
 assert.equal(s.mode.confirm(),true);assert.deepEqual(s.calls,[['confirmPower',150,60,actor,{x:180,y:270}]]);
});

test('Palace confirmations call the fresh-ticket owner even after arbitrarily many native frames',()=>{
 let captured=0;
 const s=setup({confirmPower:(_x,_y,actor,world)=>{assert.equal(actor,'palace-3');assert.deepEqual(world,{x:160,y:250});++captured;return 1;}});
 s.state.powerArmed=true;s.mode.beginPower('palace-3',120,150);
 for(let frame=0;frame<200;frame++)s.mode.sync(camera(),{...s.state,nativeFrame:frame});
 assert.equal(captured,0);assert.equal(s.mode.confirm(),true);assert.equal(captured,1);
});

test('an accepted Palace confirm suppresses stale auto-arm snapshots until the original armed state is released',()=>{
 const s=setup();s.state.powerArmed=true;s.mode.beginPower('palace-a',120,150);s.mode.confirm();
 assert.equal(s.mode.snapshot().powerPending,true);assert.equal(s.mode.beginPower('palace-a',130,160),false);
 s.mode.sync(camera(),s.state);assert.equal(s.mode.beginPower('palace-a',130,160),false);
 s.state.powerArmed=false;s.mode.sync(camera(),s.state);assert.equal(s.mode.snapshot().powerPending,false);
 s.state.powerArmed=true;assert.equal(s.mode.beginPower('palace-b',130,160),true);
 assert.deepEqual(names(s),['confirmPower']);
});

test('Palace reset has the same stale-armed protection, with no attack or repeated native clear',()=>{
 const s=setup();s.state.powerArmed=true;s.mode.beginPower('palace-a',120,150);
 assert.equal(s.mode.cancel(),true);assert.equal(s.mode.cancel(),false);s.mode.sync(camera(),s.state);
 assert.equal(s.mode.beginPower('palace-a',120,150),false);assert.deepEqual(names(s),['cancelPower']);
 s.state.powerArmed=false;s.mode.sync(camera(),s.state);assert.equal(s.mode.snapshot().powerPending,false);
});

test('a rejected Palace confirmation keeps its identity/point for retry; external disarming removes the UI only',()=>{
 const s=setup({confirmPower:()=>0});s.state.powerArmed=true;s.mode.beginPower('palace-a',120,150);
 assert.equal(s.mode.confirm(),false);assert.equal(s.mode.active,true);assert.equal(s.mode.snapshot().powerPending,false);
 s.state.powerArmed=false;s.mode.sync(camera(),s.state);assert.equal(s.mode.active,false);assert.deepEqual(names(s),['confirmPower']);
});

test('outcome, loaded-run and captured/non-map context changes never send a new native action to another screen',()=>{
 for(const patch of [{outcomeSeq:1},{runId:'run-b'},{blocked:true},{map:false}]){
  const s=setup();s.mode.beginPlacement(120,150);Object.assign(s.state,patch);s.mode.sync(camera(),s.state);
  assert.equal(s.mode.active,false);assert.equal(s.mode.confirm(),false);assert.deepEqual(names(s),['beginPlacement']);
 }
});

test('snapshots cannot move the chosen target; unchanged camera polls generate no redundant UI notifications',()=>{
 const s=setup();s.mode.beginPlacement(120,150);const snapshot=s.mode.snapshot(),count=s.changes.length;
 snapshot.target.x=999;snapshot.screen.y=999;
 assert.deepEqual(s.mode.snapshot().target,{x:160,y:250});assert.deepEqual(s.mode.snapshot().screen,{x:120,y:150});
 s.mode.sync(camera(),s.state);s.mode.sync(camera(),s.state);assert.equal(s.changes.length,count);
 s.mode.sync({...camera(),left:110},s.state);assert.equal(s.changes.length,count+1);
});

test('confirmation reentrancy cannot issue the same native command twice',()=>{
 let s;
 s=setup({confirmPlacement:()=>{assert.equal(s.mode.confirm(),false);return 1;}});
 s.mode.beginPlacement(120,150);assert.equal(s.mode.confirm(),true);assert.deepEqual(names(s),['beginPlacement','confirmPlacement']);
});
