import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderInput,DOUBLE_TAP_MS,DOUBLE_TAP_SLOP} from '../web/order-input.mjs';

function setup(initial={},options={}){
 let time=1000,state={own:true,kind:'unit',powerArmed:false,capturesInput:false,context:1,...initial},actor={unit:37},afterActor;
 const calls=[];
 const input=new OrderInput({readState:()=>state,captureActor:()=>{calls.push(['capture',actor]);return actor;},select:(x,y)=>{calls.push(['select',x,y]);options.onSelect?.(state);if(afterActor!==undefined)actor=afterActor;return options.selectResult??1;},command:(x,y,token)=>{calls.push(['command',x,y,token]);return options.commandResult??1;},now:()=>time});
 return {input,calls,state,get actor(){return actor;},set actor(value){actor=value;},set afterActor(value){afterActor=value;},advance:n=>time+=n};
}
const actions=calls=>calls.filter(c=>c[0]!=='capture');

test('first touch/pen selects synchronously; second orders retained original actor without selecting twice',()=>{
 for(const kind of ['touch','pen']){
  const s=setup(),token=s.actor;s.afterActor={unit:99};
  assert.equal(s.input.tap(30,40,kind),1);assert.deepEqual(actions(s.calls),[['select',30,40]]);
  assert.equal(s.calls[0][0],'capture');s.advance(150);assert.equal(s.input.tap(34,42,kind),1);
  assert.deepEqual(actions(s.calls),[['select',30,40],['command',34,42,token]]);assert.equal(s.input.snapshot().pending,false);
 }
});
test('double tap on empty terrain retains source despite immediate single-tap clearing selection',()=>{
 const s=setup({}, {onSelect:state=>{state.own=false;state.kind=null;}}),token=s.actor;s.afterActor=0;
 s.input.tap(100,100,'touch');s.advance(299);s.input.tap(102,99,'touch');
 assert.deepEqual(actions(s.calls),[['select',100,100],['command',102,99,token]]);
});
test('unselected unit captures the native pending selection after immediate first tap',()=>{
 const s=setup({own:false,kind:null});s.actor=0;const token={pendingUnit:44};s.afterActor=token;
 s.input.tap(20,25,'touch');assert.equal(s.calls[0][0],'select');assert.equal(s.calls[1][1],token);
 s.advance(10);s.input.tap(20,25,'touch');assert.deepEqual(actions(s.calls),[['select',20,25],['command',20,25,token]]);
});
test('a failed prior actor capture cannot silently retarget the next command to the newly selected unit',()=>{
 const s=setup();s.actor=0;s.afterActor={unit:99};s.input.tap(20,25,'touch');assert.equal(s.input.snapshot().pending,false);
 s.advance(10);s.input.tap(20,25,'touch');assert.deepEqual(actions(s.calls),[['select',20,25],['select',20,25]]);
});
test('no actor means repeated immediate selections, never commands or delayed timers',()=>{
 const s=setup({own:false,kind:'building'});s.actor=0;
 s.input.tap(20,20,'touch');s.advance(10);s.input.tap(20,20,'touch');s.advance(10);s.input.tap(20,20,'touch');
 assert.deepEqual(actions(s.calls),[['select',20,20],['select',20,20],['select',20,20]]);assert.equal(s.input.snapshot().pending,false);
});
test('triple tap issues at most one command and the third tap begins a fresh immediate selection',()=>{
 const s=setup();for(let i=0;i<3;i++){s.input.tap(10,10,'touch');s.advance(20);}
 assert.deepEqual(actions(s.calls).map(c=>c[0]),['select','command','select']);assert.equal(s.input.snapshot().pending,true);
});
test('300ms and 24 CSS pixels are inclusive boundaries; slower/further/different-pointer taps select afresh',()=>{
 assert.equal(DOUBLE_TAP_MS,300);assert.equal(DOUBLE_TAP_SLOP,24);
 for(const [time,distance,kind,pair] of [[300,24,'touch',true],[301,0,'touch',false],[200,24.01,'touch',false],[10,0,'pen',false]]){
  const s=setup();s.input.tap(0,0,'touch');s.advance(time);s.input.tap(distance,0,kind);assert.equal(actions(s.calls)[1][0],pair?'command':'select');
 }
});
test('desktop left always selects units; repeated desktop left never issues a normal command',()=>{
 const s=setup();for(let i=0;i<3;i++){s.input.tap(10,10,'mouse');s.advance(10);}
 assert.deepEqual(actions(s.calls),[['select',10,10],['select',10,10],['select',10,10]]);assert.equal(s.calls.some(c=>c[0]==='capture'),false);
});
test('ordinary right release captures a fresh actor and commands immediately without selecting',()=>{
 const s=setup({own:false});const token=s.actor;assert.equal(s.input.rightTap(40,50),1);
 assert.deepEqual(s.calls,[['capture',token],['command',40,50,token]]);assert.equal(s.input.snapshot().pending,false);
 s.actor=0;assert.equal(s.input.rightTap(40,50),0);assert.equal(actions(s.calls).length,1);
});
test('armed Palace left needs a matching double click and survives the first tap clearing power selection',()=>{
 const s=setup({own:true,kind:'building',powerArmed:true},{onSelect:state=>{state.powerArmed=false;state.own=false;}}),token=s.actor;s.afterActor=0;
 assert.equal(s.input.tap(100,110,'mouse'),1);assert.deepEqual(actions(s.calls),[['select',100,110]]);
 s.advance(100);assert.equal(s.input.tap(100,110,'mouse'),1);assert.deepEqual(actions(s.calls),[['select',100,110],['command',100,110,token]]);
});
test('armed Palace right first waits and matching second commands the retained source',()=>{
 const s=setup({own:true,kind:'building',powerArmed:true}),token=s.actor;
 assert.equal(s.input.rightTap(100,110),0);assert.equal(actions(s.calls).length,0);assert.equal(s.input.snapshot().lastAction,'power-wait');
 s.state.powerArmed=false;s.actor=0;s.advance(100);assert.equal(s.input.rightTap(102,111),1);
 assert.deepEqual(actions(s.calls),[['command',102,111,token]]);
});
test('Palace pairing requires the same button, with no cross-button command',()=>{
 for(const firstRight of [true,false]){
  const s=setup({kind:'building',powerArmed:true});
  if(firstRight)s.input.rightTap(10,10);else s.input.tap(10,10,'mouse');s.advance(10);
  if(firstRight)s.input.tap(10,10,'mouse');else s.input.rightTap(10,10);
  assert.equal(actions(s.calls).some(c=>c[0]==='command'),false);
 }
});
test('captured-input screens and world transitions invalidate a pending command pair',()=>{
 for(const update of [{capturesInput:true},{context:'building'},{context:0}]){
  const s=setup();s.input.tap(10,10,'touch');Object.assign(s.state,update);s.advance(10);assert.equal(s.input.tap(10,10,'touch'),0);
  assert.equal(actions(s.calls).length,1);assert.equal(s.input.snapshot().pending,false);
  Object.assign(s.state,{capturesInput:false,context:'world'});s.advance(10);s.input.tap(10,10,'touch');assert.equal(actions(s.calls)[1][0],'select');
 }
});
test('explicit pan/pinch/placement/minimap/route/Clear/visibility cancellation prevents late paired orders',()=>{
 for(const reason of ['pan','pinch','place','minimap','route','Clear','visibility']){
  const s=setup();s.input.tap(10,10,'touch');s.input.cancel(reason);s.advance(10);s.input.tap(10,10,'touch');assert.deepEqual(actions(s.calls).map(c=>c[0]),['select','select']);
 }
});
test('rejected orders consume the pair; rejected/invalid callbacks never report acceptance',()=>{
 const s=setup({}, {selectResult:0,commandResult:0});assert.equal(s.input.tap(0,0,'touch'),0);s.advance(10);assert.equal(s.input.tap(0,0,'touch'),0);assert.equal(s.input.snapshot().pending,false);
 s.advance(10);s.input.tap(0,0,'touch');assert.deepEqual(actions(s.calls).map(c=>c[0]),['select','command','select']);
 for(const point of [[NaN,0,'touch'],[0,Infinity,'touch'],[0,0,'unknown'],[0,0,'touch',2]]){const f=setup();assert.equal(f.input.tap(...point),0);assert.equal(f.calls.length,0);}
});
test('state lookup receives the exact tap coordinates so native letterbox/context guards can reject that target',()=>{
 const points=[],commands=[],input=new OrderInput({readState:(x,y)=>{points.push([x,y]);return {own:true,kind:'unit',context:x<0?0:1};},captureActor:()=>37,select:()=>1,command:(...args)=>{commands.push(args);return 1;},now:()=>0});
 assert.equal(input.tap(20,30,'touch'),1);assert.equal(input.rightTap(-1,30),0);assert.deepEqual(points,[[20,30],[-1,30]]);assert.equal(commands.length,0);assert.equal(input.snapshot().pending,false);
});
