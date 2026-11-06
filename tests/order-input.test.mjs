import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderInput,DOUBLE_TAP_MS,SELECTION_WAIT_MS,DOUBLE_TAP_SLOP} from '../web/order-input.mjs';

function setup(initial={},options={}){
 let time=1000,state={own:true,kind:'unit',powerArmed:false,capturesInput:false,context:1,...initial},actor={unit:37},afterActor;
 const calls=[];
 const input=new OrderInput({readState:()=>({...state,target:state.target?{...state.target}:undefined}),captureActor:()=>{calls.push(['capture',actor]);return actor;},select:(x,y)=>{calls.push(['select',x,y]);options.onSelect?.(state);if(afterActor!==undefined)actor=afterActor;return options.selectResult??1;},command:(x,y,token)=>{calls.push(['command',x,y,token]);return options.commandResult??1;},now:()=>time});
 return {input,calls,state,get actor(){return actor;},set actor(value){actor=value;},set afterActor(value){afterActor=value;},advance:n=>time+=n};
}
const actions=calls=>calls.filter(c=>c[0]!=='capture');

test('a terrain touch/pen tap clears synchronously; its pair orders the retained original actor',()=>{
 for(const kind of ['touch','pen']){
  const s=setup(),token=s.actor;s.afterActor={unit:99};
  assert.equal(s.input.tap(30,40,kind),1);assert.deepEqual(actions(s.calls),[['select',30,40]]);
  assert.equal(s.calls[0][0],'capture');s.advance(50);assert.equal(s.input.tap(34,42,kind),1);
  assert.deepEqual(actions(s.calls),[['select',30,40],['command',34,42,token]]);assert.equal(s.input.snapshot().pending,false);
 }
});
test('double tap on empty terrain retains source despite immediate single-tap clearing selection',()=>{
 const s=setup({}, {onSelect:state=>{state.own=false;state.kind=null;}}),token=s.actor;s.afterActor=0;
 s.input.tap(100,100,'touch');s.advance(99);s.input.tap(102,99,'touch');
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
test('300ms and 24 CSS pixels are inclusive pair boundaries, independent of the75ms selection wait',()=>{
 assert.equal(DOUBLE_TAP_MS,300);assert.equal(SELECTION_WAIT_MS,75);assert.equal(DOUBLE_TAP_SLOP,24);
 for(const [time,distance,kind,pair] of [[300,24,'touch',true],[301,0,'touch',false],[50,24.01,'touch',false],[10,0,'pen',false]]){
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

test('armed Palace double command on an own building never sends its first selection or opens it',()=>{
 for(const kind of ['mouse','touch','pen']){
  const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}}),token=s.actor;
  assert.equal(s.input.tap(100,110,kind),0);assert.deepEqual(actions(s.calls),[]);assert.equal(s.input.snapshot().deferredSelection,true);
  s.advance(50);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[]);
  assert.equal(s.input.tap(102,111,kind),1);assert.deepEqual(actions(s.calls),[['command',102,111,token]]);
  s.advance(500);s.input.flush();assert.deepEqual(actions(s.calls),[['command',102,111,token]]);
 }
});

test('a lone armed-Palace tap on an own building selects exactly once after the inclusive window',()=>{
 const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}});
 s.input.tap(100,110,'touch');s.advance(101);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[]);
 s.advance(199);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[]);
 s.advance(1);assert.equal(s.input.flush(),1);assert.deepEqual(actions(s.calls),[['select',100,110]]);
 s.advance(1000);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[['select',100,110]]);assert.equal(s.input.snapshot().pending,false);
});

test('an own-building Palace pair at exactly300ms still commands even if RAF flush runs first',()=>{
 const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}}),token=s.actor;
 s.input.tap(10,20,'mouse');s.advance(300);s.input.flush();s.input.tap(10,20,'mouse');
 assert.deepEqual(actions(s.calls),[['command',10,20,token]]);
});

test('cancelled own-building selection cannot appear after pan/pinch/placement/minimap/UI/visibility interruption',()=>{
 for(const reason of ['pan','pinch','place','minimap','route','Clear','visibility']){
  const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}});
  s.input.tap(10,20,'touch');s.input.cancel(reason);s.advance(1000);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[]);
 }
 for(const update of [{capturesInput:true},{context:'building'},{context:0}]){
  const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}});
  s.input.tap(10,20,'touch');Object.assign(s.state,update);s.advance(301);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[]);assert.equal(s.input.snapshot().pending,false);
 }
});

test('a late tap flushes the first single before reading/capturing its fresh intended actor',()=>{
 const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}},{onSelect:state=>{state.powerArmed=false;state.kind='building';}});
 const newActor={building:9};s.afterActor=newActor;s.input.tap(10,20,'touch');s.advance(301);s.input.tap(10,20,'touch');
 assert.deepEqual(actions(s.calls),[['select',10,20],['select',10,20]]);
 assert.equal(s.calls.at(-1)[0],'capture');assert.equal(s.calls.at(-1)[1],newActor);assert.equal(s.input.snapshot().power,false);
 s.advance(100);s.input.tap(10,20,'touch');assert.deepEqual(actions(s.calls).at(-1),['command',10,20,newActor]);
});

test('ground targets and non-armed own buildings retain immediate single selection',()=>{
 for(const kind of ['mouse','touch','pen']){
  const s=setup({kind:'building',powerArmed:true,target:{kind:'none',own:false}});s.input.tap(10,20,kind);assert.deepEqual(actions(s.calls),[['select',10,20]]);assert.equal(s.input.snapshot().deferredSelection,false);
 }
 const normal=setup({kind:'building',powerArmed:false,target:{kind:'building',own:true}});normal.input.tap(10,20,'touch');assert.deepEqual(actions(normal.calls),[['select',10,20]]);
});

test('mobile double orders on every object target never select the target before commanding the retained unit',()=>{
 for(const kind of ['touch','pen'])for(const targetKind of ['unit','building'])for(const own of [false,true]){
  const s=setup({target:{kind:targetKind,own}}),token=s.actor;
  s.afterActor={unit:99};assert.equal(s.input.tap(30,40,kind),0);
  assert.deepEqual(actions(s.calls),[]);assert.equal(s.input.snapshot().deferredSelection,true);assert.equal(s.input.snapshot().lastAction,'command-wait');
  s.advance(50);s.input.flush();assert.deepEqual(actions(s.calls),[]);
  assert.equal(s.input.tap(32,41,kind),1);assert.deepEqual(actions(s.calls),[['command',32,41,token]]);
  assert.equal(s.input.snapshot().pending,false);s.advance(1000);s.input.flush();assert.deepEqual(actions(s.calls),[['command',32,41,token]]);
 }
});

test('a lone object tap with an active mobile unit selects once at76ms while retaining its300ms pair',()=>{
 for(const kind of ['touch','pen'])for(const targetKind of ['unit','building'])for(const own of [false,true]){
  const s=setup({target:{kind:targetKind,own}});
  s.input.tap(30,40,kind);s.advance(75);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[]);
  s.advance(1);assert.equal(s.input.flush(),1);assert.deepEqual(actions(s.calls),[['select',30,40]]);
  assert.equal(s.input.snapshot().pending,true);assert.equal(s.input.snapshot().deferredSelection,false);
  s.advance(224);assert.equal(s.input.flush(),0);assert.deepEqual(actions(s.calls),[['select',30,40]]);assert.equal(s.input.snapshot().pending,true);
  s.advance(1000);s.input.flush();assert.deepEqual(actions(s.calls),[['select',30,40]]);
  assert.equal(s.input.snapshot().pending,false);
 }
});

test('Palace object commands have the same priority for own/enemy units and buildings',()=>{
 for(const kind of ['mouse','touch','pen'])for(const targetKind of ['unit','building'])for(const own of [false,true]){
  const s=setup({kind:'building',powerArmed:true,target:{kind:targetKind,own}}),token=s.actor;
  s.input.tap(30,40,kind);assert.deepEqual(actions(s.calls),[]);assert.equal(s.input.snapshot().power,true);
  s.advance(100);s.input.tap(30,40,kind);assert.deepEqual(actions(s.calls),[['command',30,40,token]]);
 }
});

test('first selection, normal PC selection and failed captures never gain the mobile object delay',()=>{
 for(const targetKind of ['unit','building']){
  const first=setup({own:false,kind:'none',target:{kind:targetKind,own:true}});first.actor=0;first.afterActor={unit:44};first.input.tap(30,40,'touch');assert.deepEqual(actions(first.calls),[['select',30,40]]);assert.equal(first.input.snapshot().deferredSelection,false);
  const pc=setup({target:{kind:targetKind,own:false}});pc.input.tap(30,40,'mouse');assert.deepEqual(actions(pc.calls),[['select',30,40]]);assert.equal(pc.input.snapshot().pending,false);
  const failed=setup({target:{kind:targetKind,own:false}});failed.actor=0;failed.input.tap(30,40,'touch');assert.deepEqual(actions(failed.calls),[['select',30,40]]);assert.equal(failed.input.snapshot().pending,false);
 }
});

test('a same-unit Devastator-style pair sends only the original self command',()=>{
 const s=setup({kind:'unit',type:11,target:{kind:'unit',own:true,type:11}}),token=s.actor;
 s.input.tap(30,40,'touch');assert.deepEqual(actions(s.calls),[]);s.advance(60);s.input.tap(30,40,'touch');
 assert.deepEqual(actions(s.calls),[['command',30,40,token]]);
});

test('a pan or empty-ground tap cancels a pending object selection without a later phantom select',()=>{
 for(const cancel of ['pan','pinch','place','minimap','route','Clear','visibility']){
  const s=setup({target:{kind:'unit',own:false}});s.input.tap(30,40,'touch');s.input.cancel(cancel);s.advance(1000);s.input.flush();assert.deepEqual(actions(s.calls),[]);
 }
 const s=setup({target:{kind:'building',own:true}});s.input.tap(30,40,'touch');s.state.target={kind:'none',own:false};s.advance(75);s.input.tap(200,200,'touch');
 assert.deepEqual(actions(s.calls),[['select',200,200]]);s.advance(1000);s.input.flush();assert.deepEqual(actions(s.calls),[['select',200,200]]);
});

test('deferred selection uses no timer, invalid/rewound input cancels it, and rejection cannot retry it',()=>{
 for(const time of [NaN,Infinity,999]){
  const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}});s.input.tap(10,20,'touch');assert.equal(s.input.flush(time),0);s.advance(1000);s.input.flush();assert.deepEqual(actions(s.calls),[]);
 }
 const invalid=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}});invalid.input.tap(10,20,'touch');invalid.advance(101);invalid.input.tap(NaN,20,'touch');invalid.input.flush();assert.deepEqual(actions(invalid.calls),[]);
 const rejected=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}},{selectResult:0});rejected.input.tap(10,20,'touch');rejected.advance(301);assert.equal(rejected.input.flush(),0);rejected.input.flush();assert.deepEqual(actions(rejected.calls),[['select',10,20]]);
});

test('matching object taps at80/150/299/300ms command before an overdue single RAF can select the target',()=>{
 for(const kind of ['touch','pen'])for(const gap of [80,150,250,299,300]){
  const s=setup({target:{kind:'unit',own:false}}),token=s.actor;s.afterActor={unit:99};
  s.input.tap(30,40,kind);s.advance(gap);s.input.tap(31,40,kind);
  assert.deepEqual(actions(s.calls),[['command',31,40,token]]);assert.equal(s.input.snapshot().pending,false);
 }
});

test('late matching object taps still command the original unit after its76ms single has selected another actor',()=>{
 for(const gap of [80,150,250,299,300])for(const kind of ['touch','pen']){
  const s=setup({target:{kind:'unit',own:true}}),token=s.actor,next={unit:99};s.afterActor=next;
  s.input.tap(30,40,kind);s.advance(76);s.input.flush();assert.equal(s.actor,next);
  s.input.flush();s.advance(gap-76);s.input.flush();s.input.tap(31,40,kind);
  assert.deepEqual(actions(s.calls),[['select',30,40],['command',31,40,token]]);
  assert.equal(s.calls.filter(c=>c[0]==='capture').length,1,'selection must not replace the retained command source');
 }
});

test('after300ms or a missed target, new pairs capture the actor created by the prompt single selection',()=>{
 for(const [gap,x] of [[301,30],[150,100]]){
  const s=setup({target:{kind:'unit',own:true}}),next={unit:99};s.afterActor=next;
  s.input.tap(30,40,'touch');s.advance(gap);s.input.tap(x,40,'touch');
  assert.deepEqual(actions(s.calls),[['select',30,40]]);assert.equal(s.calls.at(-1)[0],'capture');assert.equal(s.calls.at(-1)[1],next);
  s.advance(80);s.input.tap(x,40,'touch');assert.deepEqual(actions(s.calls).at(-1),['command',x,40,next]);
 }
});

test('Palace object selection stays deferred through300ms and quick/ordinary pairs never open the target',()=>{
 for(const kind of ['mouse','touch','pen'])for(const gap of [80,150,299,300]){
  const s=setup({kind:'building',powerArmed:true,target:{kind:'building',own:true}}),token=s.actor;
  s.input.tap(30,40,kind);s.advance(Math.min(gap,101));s.input.flush();assert.deepEqual(actions(s.calls),[]);
  if(gap>101)s.advance(gap-101);s.input.flush();s.input.tap(30,40,kind);
  assert.deepEqual(actions(s.calls),[['command',30,40,token]]);
 }
});

test('pan cancellation after a prompt single selection discards its retained original command source',()=>{
 const s=setup({target:{kind:'unit',own:true}});s.afterActor={unit:99};
 s.input.tap(30,40,'touch');s.advance(76);s.input.flush();s.input.cancel('pan');
 s.advance(4);s.input.tap(30,40,'touch');s.advance(1000);s.input.flush();
 assert.deepEqual(actions(s.calls).map(c=>c[0]),['select','select']);assert.equal(s.input.snapshot().pending,false);
});
