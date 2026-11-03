import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {GameInterface} from '../web/game-ui.mjs';
import {ScreenTransition} from '../web/screen-transition.mjs';
import {CampaignStore} from '../web/campaign-state.mjs';

class Element {
 constructor(){this.hidden=false;this.style={};this.dataset={};this.children=[];this.events=new Map();this.attributes=new Map();const classes=new Set();this.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name),remove:name=>classes.delete(name)};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(name,value){this.attributes.set(name,value);}
 getBoundingClientRect(){return {};}
 addEventListener(name,listener){this.events.set(name,listener);}
 click(){this.events.get('click')?.({stopPropagation(){}});}
}
async function dom(run){
 const document=globalThis.document,raf=globalThis.requestAnimationFrame;
 globalThis.document={createElement:()=>new Element(),body:new Element()};
 globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),0);
 try{return await run();}finally{globalThis.document=document;globalThis.requestAnimationFrame=raf;}
}
function memory(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};}
function snapshot(overrides={}){return {scene:'map',sceneReady:true,inputReady:true,outcomeSeq:0,activeRunArmed:false,houseId:1,mission:1,...overrides};}
function uiHarness(){
 const ui=Object.create(GameInterface.prototype),published=[],errors=[];
 Object.assign(ui,{
  store:new CampaignStore(memory()),Module:{},view:'native',state:{},visibleNative:{},demoMode:false,resuming:false,activeRun:null,
  updateEpoch:0,sequence:0,lastOutcome:0,lastNativeKey:'',displayed:'home',pendingScreen:null,waitingForFrame:false,
  busy:false,nativeBusy:false,element:new Element(),demoButton:new Element(),optionViews:new Map(),
  building:{active:false,update(state){this.active=!!state.active;}},
  curtain:{active:false,reveals:0,cover(){this.active=true;return Promise.resolve();},reveal(){this.reveals++;this.active=false;}},
  isReady:()=>true,resumeAudio(){},saveCurrent(){return false;},cancelGesture(){},uiSound(){},
  tell:message=>errors.push(message),showNative:state=>published.push(state.scene),
  showHome(){this.view='home';this.displayed='home';},
 });
 return {ui,published,errors};
}
// Hold the asynchronous engine/cover boundary while exercising the actual
// mission/load send callbacks and the actual pending dispatcher afterwards.
function capturePreparation(ui){ui.prepareNative=(pending,send)=>{ui.pendingScreen={...pending,sent:false,send};};}

test('native polling cannot keep an already revealing curtain active forever',{timeout:900},async()=>dom(async()=>{
 const curtain=new ScreenTransition({});await curtain.cover({instant:true,loading:true});
 for(let i=0;i<8;i++){void curtain.reveal();await delay(50);}
 assert.equal(curtain.active,false,'50ms native polling must not restart the265ms reveal timeout');
 assert.equal(curtain.element.hidden,true);assert.equal(curtain.loading,false);
}));

test('an old reveal cannot uncover a newer covered scene',{timeout:900},async()=>dom(async()=>{
 const curtain=new ScreenTransition({});await curtain.cover({instant:true});void curtain.reveal();await delay(10);
 await curtain.cover({instant:true,loading:true});await delay(190);
 assert.equal(curtain.active,true);assert.equal(curtain.element.hidden,false);assert.equal(curtain.element.style.opacity,'1');
 await curtain.reveal();await delay(300);assert.equal(curtain.active,false);
}));

test('leaving demo for a new mission cannot record demo victory before native acceptance',()=>{
 const {ui}=uiHarness();capturePreparation(ui);ui.demoMode=true;let accepted=false;
 ui.Module._dune_web_campaign_start=()=>accepted?1:0;
 const before=JSON.stringify(ui.store.progress);ui.startMission(1,1);
 ui.tryPending();assert.equal(ui.pendingScreen.sent,false);assert.equal(ui.demoMode,true);
 ui.view='home';ui.update(snapshot({outcomeSeq:1,outcome:'victory',outcomeHouse:1,outcomeMission:9}),null,{});
 assert.equal(JSON.stringify(ui.store.progress),before,'an outgoing demo victory must not unlock mission9');
 accepted=true;ui.tryPending();assert.equal(ui.pendingScreen.sent,true);assert.equal(ui.demoMode,false);
 assert.deepEqual(ui.store.progress.lastRun,{house:1,mission:1});assert.deepEqual(ui.store.progress.houses[1].completed,[]);
});

test('resuming a real save preserves demo isolation until the payload loads successfully',async()=>{
 const {ui}=uiHarness();capturePreparation(ui);ui.demoMode=true;let accepted=false;
 ui.loadPayload=()=>accepted;await ui.resumeSlot({state:'NORMAL-SAVE'});
 assert.equal(ui.demoMode,true);assert.throws(()=>ui.tryPending(),/не удалось загрузить/);
 assert.equal(ui.demoMode,true,'a rejected load must not turn the still-running demo into a normal campaign');
 const before=JSON.stringify(ui.store.progress);ui.view='home';ui.update(snapshot({outcomeSeq:1,outcome:'victory',outcomeHouse:1,outcomeMission:9}),null,{});
 assert.equal(JSON.stringify(ui.store.progress),before);
 accepted=true;ui.tryPending();assert.equal(ui.demoMode,false);assert.equal(ui.resuming,true);assert.equal(ui.pendingScreen.sent,true);
});

test('a successful send cannot publish the outgoing snapshot as the loaded scene',()=>{
 const {ui,published}=uiHarness();let nativeScene='pause';ui.curtain.active=true;
 ui.pendingScreen={kind:'load',sent:false,send(){nativeScene='map';return 1;}};
 ui.update(snapshot({scene:'pause'}),null,{});
 assert.equal(nativeScene,'map');assert.ok(ui.pendingScreen,'loading must remain guarded until a subsequent native snapshot');
 assert.deepEqual(published,[]);assert.equal(ui.displayed,'home');assert.equal(ui.revealAfterPaint,undefined);
 ui.update(snapshot({scene:'map',sceneReady:false}),null,{});assert.ok(ui.pendingScreen);
 ui.update(snapshot({scene:'map'}),null,{});
 assert.equal(ui.pendingScreen,null);assert.equal(ui.displayed,'map');assert.equal(ui.element.hidden,true);assert.equal(ui.revealAfterPaint,true);
 assert.deepEqual(published,[],'the old pause UI was never published under the new save');
});

test('a failed demo fetch exits loading once instead of retrying beneath a permanent curtain',async()=>{
 const {ui,errors}=uiHarness();capturePreparation(ui);let fetches=0,loads=0;const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>{fetches++;return {ok:false,status:404};};ui.loadPayload=()=>{loads++;return true;};
 try{
  await ui.beginDemo();ui.tryPending();await ui.demoFetch;
  ui.update(snapshot({scene:'main'}),null,{});
  assert.equal(ui.pendingScreen,null);assert.equal(ui.view,'home');assert.equal(ui.demoMode,false);assert.equal(ui.busy,false);
  assert.equal(ui.curtain.reveals,1);assert.equal(errors.length,1);assert.match(errors[0],/Демонстрация недоступна/);
  for(let i=0;i<6;i++)ui.update(snapshot({scene:'main'}),null,{});
  assert.equal(fetches,1,'later native polls must not restart a failed fetch');assert.equal(loads,0);
  assert.deepEqual(ui.store.progress.houses[1].completed,[]);
 }finally{globalThis.fetch=oldFetch;}
});

test('a rendered credits frame is not permission to queue input before its native poll',()=>{
 const {ui}=uiHarness(),calls=[];let audio=0;ui.resumeAudio=()=>audio++;ui.Module._dune_web_campaign_input=(...args)=>{calls.push(args);return 1;};
 ui.state=snapshot({scene:'credits',inputReady:false});assert.equal(ui.input(0,16),false);
 ui.state=snapshot({scene:'credits'});ui.curtain.active=true;assert.equal(ui.input(0,16),false);
 ui.curtain.active=false;ui.pendingScreen={kind:'route'};assert.equal(ui.input(0,16),false);
 ui.pendingScreen=null;ui.state.sceneReady=false;assert.equal(ui.input(0,16),false);
 assert.deepEqual(calls,[]);assert.equal(audio,0);
 ui.state.sceneReady=true;assert.equal(ui.input(0,16),true);assert.deepEqual(calls,[[0,16]]);assert.equal(audio,1);
});

test('credits remain tap-only until the original terminal outcome is reached',()=>{
 const {ui}=uiHarness();ui.message=new Element();ui.actions=new Element();ui.footer=new Element();let buttons=[];let backs=0;
 ui.clear=()=>{buttons=[];};ui.button=(label,action,options)=>{buttons.push({label,action,options});return {view:{update(){}}};};ui.backButton=()=>{backs++;};ui.drawMessage=()=>{};
 const show=GameInterface.prototype.showNative.bind(ui);
 ui.state=snapshot({scene:'credits',inputKind:'transition',inputReady:false,outcomeTerminal:false});show(ui.state);
 assert.deepEqual(buttons,[]);assert.equal(backs,0);assert.equal(ui.canAdvanceDialog,false);
 show(snapshot({scene:'credits',inputKind:'continue',inputReady:true,outcomeTerminal:false}));assert.deepEqual(buttons,[]);
 show(snapshot({scene:'credits',inputKind:'continue',inputReady:true,outcomeTerminal:true}));
 assert.deepEqual(buttons.map(b=>b.label),['REPLAY','MAIN MENU']);assert.equal(backs,0);
});

test('keyboard-synthesized clicks cannot activate a focused button underneath the curtain',async()=>dom(()=>{
 const {ui}=uiHarness();let actions=0,pulses=0;ui.actions=new Element();ui.bound=[];
 ui.art={decorate:()=>({pulse(){pulses++;}})};
 const {button}=ui.button('CONTINUE',()=>actions++,{feedback:false});
 ui.curtain.active=true;button.click();ui.curtain.active=false;ui.pendingScreen={kind:'route'};button.click();
 assert.equal(actions,0);assert.equal(pulses,0);
 ui.pendingScreen=null;button.click();assert.equal(actions,1);assert.equal(pulses,1);
}));
