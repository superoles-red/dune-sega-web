import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {placementWorldToScreen} from '../web/placement-mode.mjs';

const source=readFileSync(new URL('../web/shell.js',import.meta.url),'utf8');
function fn(name,next,scope){
 const start=source.indexOf('function '+name+'('),end=source.indexOf(next,start);
 assert(start>=0&&end>start,'actual host function '+name+' is available');
 return vm.runInNewContext(source.slice(start,end)+'\n'+name,scope);
}
const plain=value=>JSON.parse(JSON.stringify(value));
const yardHit=(unit=false)=>({context:1,worldX:1000,worldY:1100,tile:2207,target:{kind:'building',own:true,ready:true,pointer:77,id:8},inputActor:{kind:unit?'unit':'none',own:unit,powerArmed:false}});

test('actual host records a ready Yard only after the native SELECT accepts it, with the original unit-pair priority',()=>{
 for(const unit of [false,true]){
  const scope={counters:{selectRequests:0},pendingReadyYard:null,nativeJSON:()=>yardHit(unit),Module:{_dune_web_select_screen:()=>1}};
  const select=fn('selectMapObject','function renderTargetActions',scope);
  assert.equal(select(10,20),1);assert.equal(scope.counters.selectRequests,1);
  assert.deepEqual(plain(scope.pendingReadyYard),{world:{x:1008,y:1104},yard:77,id:8,waitPair:unit});
 }
});

test('a later rejected selection cannot leave an older ready-Yard placement request waiting to surprise the player',()=>{
 const scope={counters:{selectRequests:0},pendingReadyYard:{yard:77,id:8},nativeJSON:()=>({context:1,target:{kind:'unit',own:true,ready:false},inputActor:{kind:'building'}}),Module:{_dune_web_select_screen:()=>0}};
 const select=fn('selectMapObject','function renderTargetActions',scope);
 assert.equal(select(10,20),0);assert.equal(scope.pendingReadyYard,null);
});

test('a repeated same-Yard tap during its original selector preserves that already accepted request, but a different ready Yard does not',()=>{
 for(const same of [false,true]){
  const previous={world:{x:1008,y:1104},yard:77,id:8,waitPair:false},hit=yardHit();if(!same)hit.target.pointer=78;
  const scope={counters:{selectRequests:0},pendingReadyYard:previous,nativeJSON:()=>hit,Module:{_dune_web_select_screen:()=>0}};
  fn('selectMapObject','function renderTargetActions',scope)(10,20);assert.equal(scope.pendingReadyYard,same?previous:null);
 }
});

function tapScope(){
 const calls=[];
 const scope={ready:true,gameUI:null,legacyMode:false,inputCheckMode:false,counters:{taps:0},lastPointerKind:'touch',lastPointerPoint:null,pendingReadyYard:null,
  orderFeedback:{setPointerKind(){},aimAt(){}},resumeAudio(){},Module:{_dune_web_end(){},_dune_web_select_screen:(...args)=>{calls.push(['nativeUI',...args]);return 1;}},
  targetMode:{active:false,tap:(...args)=>{calls.push(['target',...args]);return true;}},confirmTarget:()=>calls.push(['confirm']),
  query:()=>1,orders:{tap:(...args)=>{calls.push(['order',...args]);return 1;},snapshot:()=>({lastAction:'select'}),cancel:()=>calls.push(['cancel-order'])}};
 return {scope,calls,tap:fn('mapTap','const gestures=',scope)};
}

test('actual touch/pen map taps in target mode select a preview only and bypass ordinary unit commands',()=>{
 for(const kind of ['touch','pen']){
  const s=tapScope();s.scope.targetMode.active=true;s.tap(40,50,kind);
  assert.deepEqual(s.calls,[['target',40,50]]);assert.equal(s.scope.counters.taps,1);
 }
});

test('actual desktop target routing confirms only a valid left click; a right click never commits',()=>{
 for(const [button,moved,confirmed]of [[0,true,true],[0,false,false],[2,true,false]]){
  const s=tapScope();s.scope.targetMode.active=true;s.scope.targetMode.tap=(...args)=>{s.calls.push(['target',...args]);return moved;};
  s.tap(40,50,'mouse',button);assert.deepEqual(s.calls,confirmed?[['target',40,50],['confirm']]:[['target',40,50]]);
 }
});

test('a native UI tap abandons an outstanding Yard request before entering that interface',()=>{
 const s=tapScope();s.scope.query=()=>2;s.scope.pendingReadyYard={yard:77,id:8};s.tap(40,50,'touch');
 assert.equal(s.scope.pendingReadyYard,null);assert.deepEqual(s.calls,[['cancel-order'],['nativeUI',40,50]]);
});

test('Yard activation waits for a retained unit command pair, then starts its saved world position once',()=>{
 const calls=[],scope={latestCamera:null,targetRunId:'',targetOutcomeSeq:0,pendingReadyYard:{world:{x:160,y:250},yard:77,id:8,waitPair:true},
  latestActions:{selected:{kind:'building',pointer:77,id:8},readyYard:true},gameUI:null,lastPointerKind:'touch',lastPointerPoint:null,
  targetState:()=>({}),placementWorldToScreen,renderTargetActions(){},orders:{snapshot:()=>({pending:true}),cancel:()=>calls.push(['cancel-order'])},
  targetMode:{active:false,powerPending:false,sync(){},beginPlacement:(...args)=>{calls.push(['begin',...args]);return true;}}};
 const sync=fn('syncTargetMode','function confirmTarget',scope),camera={map:1,left:100,top:200,scale:2,scaleY:3};
 sync(camera,{});assert.deepEqual(calls,[]);assert(scope.pendingReadyYard);
 scope.orders.snapshot=()=>({pending:false});sync(camera,{});
 assert.deepEqual(calls,[['begin',120,150],['cancel-order']]);assert.equal(scope.pendingReadyYard,null);
});

test('the host does not activate a ready Yard from a stale pointer/id identity or a captured screen',()=>{
 for(const [selected,captured]of [[{kind:'building',pointer:77,id:9},false],[{kind:'building',pointer:78,id:8},false],[{kind:'building',pointer:77,id:8},true]]){
  let begins=0;
  const scope={latestCamera:null,targetRunId:'',targetOutcomeSeq:0,pendingReadyYard:{world:{x:160,y:250},yard:77,id:8,waitPair:false},latestActions:{selected,readyYard:true},gameUI:{capturesInput:captured},lastPointerKind:'touch',lastPointerPoint:null,
   targetState:()=>({}),placementWorldToScreen,renderTargetActions(){},orders:{snapshot:()=>({pending:false}),cancel(){}},targetMode:{active:false,powerPending:false,sync(){},beginPlacement:()=>{begins++;return true;}}};
  fn('syncTargetMode','function confirmTarget',scope)({map:1,left:100,top:200,scale:2,scaleY:3},{});assert.equal(begins,0);
 }
});

function powerCallback(scope){
 const start=source.indexOf('confirmPower:'),end=source.indexOf('cancelPower:',start);
 assert(start>=0&&end>start);const code=source.slice(start+'confirmPower:'.length,end).replace(/,\s*$/,'');
 const identityHelpers=source.slice(source.indexOf('function powerIdentity('),source.indexOf('const targetMode='));
 return vm.runInNewContext(identityHelpers+'\n('+code+')',scope);
}

test('Palace confirmation revalidates the selected identity, captures a fresh ticket each time and commands the saved world cell',()=>{
 const actor={kind:'building',pointer:77,id:8,owner:0,type:2},calls=[];let serial=100;
 const scope={latestActions:{},counters:{commandRequests:0},nativeJSON:()=>({selected:actor,special:{armed:true}}),Module:{_dune_web_actor_capture:()=>{calls.push(['capture']);return ++serial;},_dune_web_command_world:(...args)=>{calls.push(['command',...args]);return 1;}}};
 const confirm=powerCallback(scope),identity={pointer:77,id:8,owner:0,type:2};
 assert.equal(confirm(NaN,NaN,identity,{x:1700,y:1400}),1);
 assert.equal(confirm(-100,999,identity,{x:100,y:200}),1);
 assert.deepEqual(calls,[['capture'],['command',1700,1400,101],['capture'],['command',100,200,102]]);assert.equal(scope.counters.commandRequests,2);
 actor.id=9;assert.equal(confirm(0,0,identity,{x:100,y:200}),0);assert.equal(calls.length,4,'a reused Palace pointer cannot inherit the original confirmation');
});
