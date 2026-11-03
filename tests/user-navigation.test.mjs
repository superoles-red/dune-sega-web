import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {GameInterface} from '../web/game-ui.mjs';
import {NativeConfirmation} from '../web/confirm-dialog.mjs';
import {CampaignStore,CONTINUE_KEY,HOUSE_NAMES} from '../web/campaign-state.mjs';

// The native engine and painting are boundaries here. Navigation, confirmation
// promise resolution, global Continue and native-ready decisions are real code.
class Element {
 constructor(){this.hidden=false;this.style={};this.dataset={};this.children=[];this.events=new Map();this.attributes=new Map();this.inert=false;this.isConnected=true;this.classList={add(){}};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 addEventListener(name,listener){this.events.set(name,listener);}
 get childElementCount(){return this.children.length;}
 get firstElementChild(){return this.children[0];}
 click(){this.events.get('click')?.({stopPropagation(){}});}
 focus(){document.activeElement=this;}
}
async function dom(run){
 const previous=globalThis.document,parents=new Map(['scene-ui','building-screen','native-menu','context-actions','demo-launch'].map(id=>[id,new Element()]));
 globalThis.document={createElement:()=>new Element(),activeElement:new Element(),getElementById:id=>parents.get(id)??null};
 try{return await run(parents);}finally{globalThis.document=previous;}
}
function memory(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};}
const campaign=JSON.parse(readFileSync(new URL('../web/ui-assets/campaign/manifest.json',import.meta.url)));
const saved=btoa('THE_CURRENT_NATIVE_V2_SAVE');
function snapshot(extra={}){return {scene:'map',sceneReady:true,presentationReady:true,inputReady:true,inputKind:'continue',outcomeSeq:0,activeRunArmed:0,houseId:0,mission:1,...extra};}
function fixture(){
 const ui=Object.create(GameInterface.prototype),storage=memory(),store=new CampaignStore(storage),calls={nativeStarts:[],nativeRoutes:[],loads:[],saves:[],messages:[],covers:0,reveals:0,inputs:[]};
 store.saveSlot(0,1,saved);
 const art={ready:false,decorate(button,label){button.label=label;return {pulse(){},dispose(){},update(){}};}};
 const dialog=Object.create(NativeConfirmation.prototype);Object.assign(dialog,{art,active:false,views:[],feedback(){},element:new Element(),actions:new Element(),panel:new Element(),text:new Element(),background:new Element()});
 Object.assign(ui,{art,dialog,store,campaign,Module:{_dune_web_campaign_start(h,m){calls.nativeStarts.push([h,m]);return 1;},_dune_web_screen_route(target){calls.nativeRoutes.push(target);return 1;},_dune_web_campaign_input(...args){calls.inputs.push(args);return 1;}},view:'native',state:snapshot({activeRunArmed:1,activeRunHouse:0,activeRunMission:1}),visibleNative:{},activeRun:{house:0,mission:1},demoMode:false,resuming:false,sequence:0,updateEpoch:0,lastOutcome:0,pendingScreen:null,lastNativeKey:'',displayed:'map',waitingForFrame:false,optionViews:new Map(),buttons:[],element:new Element(),message:new Element(),actions:new Element(),footer:new Element(),demoButton:new Element(),building:{active:false,update(s){this.active=!!s.active;}},isReady:()=>true,startEngine:async()=>{},cancelGesture(){},resumeAudio(){},tell:text=>calls.messages.push(text),drawMessage(){},render(){},saveCurrent(silent){calls.saves.push(silent);return true;},loadPayload(value,silent){calls.loads.push([value,silent]);return true;},frontendPayload:btoa('CLEAN_NATIVE_FRONTEND_V2')});
 ui.curtain={active:false,cover(){this.active=true;calls.covers++;return Promise.resolve();},reveal(){this.active=false;calls.reveals++;}};
 ui.clear=function(view,title){this.view=view;this.title=title;this.buttons=[];this.actions.replaceChildren();this.footer.replaceChildren();this.actions.hidden=false;this.footer.hidden=false;this.element.hidden=false;};
 ui.button=function(label,action,options={},parent=this.actions){const button=new Element();parent.append(button);this.buttons.push({label,action,options,button});return {button,view:{update(){}}};};
 return {ui,storage,calls};
}

test('mission START confirmation preserves the current Continue until confirmed and accepted; CANCEL changes nothing',async()=>dom(async parents=>{
 const {ui,storage,calls}=fixture(),before=storage.getItem(CONTINUE_KEY);let accepted=false;
 ui.Module._dune_web_campaign_start=(h,m)=>{calls.nativeStarts.push([h,m]);return accepted?1:0;};
 const cancelled=ui.chooseMission(1,1);
 assert.equal(ui.dialog.active,true);assert.equal(ui.dialog.title,'START MISSION?');assert.ok(ui.dialog.lines[0].includes('ATREIDES'));assert.equal(ui.dialog.element.dataset.danger,'true');
 assert.equal(parents.get('scene-ui').inert,true);assert.equal(storage.getItem(CONTINUE_KEY),before);assert.deepEqual(calls.nativeStarts,[]);assert.deepEqual(calls.saves,[]);
 ui.dialog.actions.children[1].click();await cancelled;
 assert.equal(ui.dialog.active,false);assert.equal(parents.get('scene-ui').inert,false);assert.equal(storage.getItem(CONTINUE_KEY),before);assert.equal(ui.pendingScreen,null);assert.deepEqual(calls.nativeStarts,[]);
 const starting=ui.chooseMission(1,1);assert.equal(storage.getItem(CONTINUE_KEY),before);ui.dialog.actions.children[0].click();await starting;
 assert.equal(ui.pendingScreen.kind,'mission');assert.equal(ui.pendingScreen.sent,false);assert.equal(storage.getItem(CONTINUE_KEY),before,'a native-rejected start cannot discard the existing Continue');
 accepted=true;ui.tryPending();assert.equal(ui.pendingScreen.sent,true);assert.equal(ui.store.resumable(),null);assert.equal(ui.store.current.house,1);assert.equal(ui.store.current.mission,1);assert.equal(ui.store.current.state,null);assert.deepEqual(ui.store.progress.lastRun,{house:1,mission:1});
}));

test('Home Continue confirms the globally stored house and mission even after another house was browsed',async()=>dom(async()=>{
 const {ui,calls}=fixture();ui.store.adoptResume(2,4);ui.store.saveSlot(2,4,saved);ui.store.selectHouse(1);
 ui.showHome();const button=ui.buttons.find(b=>b.options.id==='continue-campaign');assert.ok(button);
 const continuing=button.action();assert.equal(ui.dialog.active,true);assert.equal(ui.dialog.title,'CONTINUE?');assert.deepEqual(ui.dialog.lines,[HOUSE_NAMES[2],'MISSION 4',ui.missionName(2,4)]);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeStarts,[]);
 ui.dialog.actions.children[0].click();await continuing;
 assert.deepEqual(calls.loads,[[saved,true]]);assert.equal(ui.pendingScreen.kind,'load');assert.equal(ui.pendingScreen.sent,true);assert.equal(ui.resuming,true);assert.deepEqual(calls.nativeStarts,[]);
}));

test('F8-equivalent load cancels an older accepted START during its140ms modal fade without replacing Continue',async()=>dom(async()=>{
 const {ui,storage,calls}=fixture(),before=storage.getItem(CONTINUE_KEY);
 const choosing=ui.chooseMission(1,1);ui.dialog.actions.children[0].click();
 assert.equal(ui.dialog.active,true);assert.equal(ui.dialog.deciding,true);assert.deepEqual(calls.nativeStarts,[]);
 // This is the production shell's modern F8 delegation, without a save first.
 const loading=ui.resumeSlot({state:saved},{saveCurrent:false});
 assert.equal(ui.dialog.active,false,'the newer native request cancels the old modal before any await');
 await loading;await choosing;await delay(180);
 assert.deepEqual(calls.loads,[[saved,true]]);assert.deepEqual(calls.nativeStarts,[],'the old140ms callback never starts a mission after the newer load');
 assert.equal(ui.pendingScreen.kind,'load');assert.equal(ui.pendingScreen.sent,true);assert.equal(storage.getItem(CONTINUE_KEY),before);assert.equal(ui.store.resumable().state,saved);assert.deepEqual(calls.saves,[]);
}));

test('exit confirmation CANCEL or a failed required save leaves the current world in place',async()=>dom(async()=>{
 const {ui,storage,calls}=fixture(),before=storage.getItem(CONTINUE_KEY),run=ui.activeRun;
 const cancelled=ui.confirmMainMenu();assert.equal(ui.dialog.title,'RETURN TO MAIN MENU?');ui.dialog.actions.children[1].click();await cancelled;
 assert.deepEqual(calls.saves,[]);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[]);assert.equal(ui.activeRun,run);assert.equal(ui.view,'native');assert.equal(ui.pendingScreen,null);
 ui.saveCurrent=silent=>{calls.saves.push(silent);return false;};const failed=ui.confirmMainMenu();ui.dialog.actions.children[0].click();await failed;
 assert.deepEqual(calls.saves,[false]);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[]);assert.equal(ui.activeRun,run);assert.equal(ui.view,'native');assert.equal(ui.pendingScreen,null);assert.equal(ui.curtain.active,false);assert.equal(storage.getItem(CONTINUE_KEY),before);assert.match(calls.messages.at(-1),/остались в миссии/);
}));

test('a presentation-ready native sequence remains visible before an input-ready scene frame exists',()=>{
 const {ui,calls}=fixture();ui.activeRun=null;
 for(const scene of ['campaign','house_briefing','briefing','victory_movie','victory','defeat_movie','defeat','results','ending','credits']){
  ui.update(snapshot({scene,presentationReady:true,sceneReady:false,inputReady:false,outcomeTerminal:false}),null,{active:false});
  assert.equal(calls.covers,0,'a valid original sequence frame must not be replaced by a black loading veil: '+scene);assert.equal(ui.curtain.active,false);assert.equal(ui.element.hidden,false);assert.equal(ui.visibleNative.scene,scene);assert.equal(ui.element.dataset.timeline,'true');assert.equal(ui.displayed,scene);
 }
 assert.deepEqual(calls.inputs,[],'presentation readiness alone never submits native input');
});

test('terminal defeat offers only Replay and Main Menu; intermediate outcomes keep tap-only continuation',()=>{
 const {ui,calls}=fixture();ui.state=snapshot({scene:'defeat',outcomeTerminal:true,outcome:'defeat',outcomeHouse:0,outcomeMission:1});ui.showNative(ui.state);
 assert.deepEqual(ui.buttons.map(b=>b.label),['REPLAY','MAIN MENU']);assert.equal(ui.footer.childElementCount,0);assert.equal(ui.footer.hidden,true);assert.equal(ui.canAdvanceDialog,false);assert.equal(ui.advanceDialog(),false);assert.deepEqual(calls.inputs,[]);
 for(const scene of ['victory_movie','victory','defeat_movie','defeat','results','campaign','ending','credits']){
  ui.state=snapshot({scene,outcomeTerminal:false,continueMask:16});ui.showNative(ui.state);
  assert.deepEqual(ui.buttons,[],'no NEXT/BACK overlays on intermediate original timeline: '+scene);assert.equal(ui.actions.hidden,true);assert.equal(ui.footer.hidden,true);assert.equal(ui.canAdvanceDialog,true);assert.equal(ui.advanceDialog(),true);
 }
 assert.equal(calls.inputs.length,8);assert.ok(calls.inputs.every(([action,mask])=>action===0&&mask===16));
});

test('a published Emscripten wrapper is never called before its WASM exports are initialized',()=>{
 const {ui}=fixture();ui.view='home';ui.state={};ui.isReady=()=>false;
 let held=0,audio=0;
 ui.Module._dune_web_frontend_hold=()=>{held++;throw Error('WASM exports not initialized');};
 ui.Module._dune_web_frontend_audio=()=>{audio++;throw Error('WASM exports not initialized');};
 assert.doesNotThrow(()=>ui.update({},null,{}));assert.equal(held,0);assert.equal(audio,0);
 ui.bound=[];ui.heroCanvas=new Element();ui.caption=new Element();ui.drawCaption=()=>{};
 ui.actions.removeAttribute=()=>{};
 assert.doesNotThrow(()=>GameInterface.prototype.clear.call(ui,'houses','CHOOSE YOUR HOUSE'));
 assert.equal(held,0);
});

test('an empty native paragraph hides the text box until the original writer publishes real words',()=>{
 const {ui}=fixture();
 ui.showNative(snapshot({scene:'briefing',visibleMessageText:''}));
 assert.equal(ui.message.hidden,true);assert.equal(ui.liveText,false,'an empty modern field is not permission to crop map pixels as text');
 ui.showNative(snapshot({scene:'briefing',visibleMessageText:'Greetings, I am your Mentat Cyril.'}));
 assert.equal(ui.message.hidden,false);assert.equal(ui.liveText,false);assert.match(ui.messageText,/Mentat Cyril/);
 ui.showNative(snapshot({scene:'briefing',visibleMessageText:'',presentationFullFrame:true}));
 assert.equal(ui.message.hidden,true,'the original full-screen exit animation owns its own text');
});

test('PROCEED immediately removes Back while the original briefing-exit animation owns input',()=>{
 const {ui,calls}=fixture();ui.state=snapshot({scene:'briefing',visibleMessageText:'Ready.'});ui.showNative(ui.state);
 assert(ui.buttons.some(b=>b.options.back));
 ui.state=snapshot({scene:'briefing',sceneReady:false,presentationReady:true,inputReady:false,presentationFullFrame:true,presentationPhase:'briefing_exit',visibleMessageText:'Ready.'});ui.showNative(ui.state);
 assert.equal(ui.buttons.length,0);assert.equal(ui.footer.hidden,true);assert.equal(ui.message.hidden,true);assert.equal(ui.canAdvanceDialog,false);ui.back();assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[]);assert.equal(ui.pendingScreen,null);
});

for(const target of ['options','pause'])test(target+' keeps one black fade until native controls are usable, without a disabled preview or Loading text',async()=>{
 const {ui,calls}=fixture(),published=[],coverOptions=[];let finishCover;
 if(target==='options')ui.state=snapshot({scene:'main',houseId:-1,activeRunArmed:0});
 const showNative=ui.showNative.bind(ui);ui.showNative=(state,pending=false)=>{published.push({scene:state.scene,pending});showNative(state,pending);};
 ui.curtain.cover=options=>{calls.covers++;coverOptions.push(options);ui.curtain.active=true;return new Promise(resolve=>{finishCover=resolve;});};
 const opening=ui.requestRoute(target);
 assert.deepEqual(calls.nativeRoutes,[target==='options'?1:3],'the route queues before the visual cover, without waiting for another DOM poll');
 assert.equal(ui.pendingScreen.sent,true);assert.deepEqual(published,[]);assert.equal(coverOptions[0].duration,240);assert.equal(coverOptions[0].loading,false);
 assert.equal(ui.input(2,0),false);assert.deepEqual(calls.inputs,[]);
 finishCover();await opening;
 assert.deepEqual(published,[]);assert.equal(calls.reveals,0,'the old screen stays covered while native preparation completes');assert.equal(ui.pendingScreen.target,target);assert.equal(ui.curtain.active,true);
 assert.equal(ui.input(2,0),false);assert.deepEqual(calls.inputs,[]);
 const native=snapshot({scene:target,houseId:target==='options'?-1:0,optionsInGame:target==='pause'});
 ui.update({...native,sceneReady:false,presentationReady:false,inputReady:false},null,{});
 assert.equal(published.length,0);assert.equal(ui.pendingScreen.target,target);assert.equal(ui.input(2,0),false);assert.deepEqual(calls.inputs,[]);
 ui.update(native,null,{});
 assert.deepEqual(published,[{scene:target,pending:false}]);assert.equal(ui.pendingScreen,null);assert.equal(ui.element.dataset.ready,'true');assert.ok(ui.buttons.every(button=>!button.options.disabled));assert.equal(calls.covers,1,'native readiness does not start a second fade');
 assert.equal(ui.input(2,0),false,'the first completed paint must still uncover the screen');ui.curtain.reveal();
 assert.equal(ui.input(2,0),true);assert.deepEqual(calls.inputs,[[2,0]]);
});

test('Tutorial and Languages are available in both Options and Pause, with no Home shortcut',()=>{
 const {ui}=fixture();
 ui.showHome();assert(!ui.buttons.some(button=>button.options.id==='open-tutorial'||button.label==='TUTORIAL'));
 ui.state=snapshot({scene:'options',houseId:-1,optionsInGame:false});ui.showNative(ui.state);
 assert.equal(ui.buttons.filter(button=>button.options.id==='open-tutorial').length,1);assert.equal(ui.buttons.find(button=>button.options.id==='open-tutorial').options.disabled,false);
 assert.equal(ui.buttons.filter(button=>button.options.id==='open-languages').length,1);
 for(const state of [snapshot({scene:'pause',houseId:0,optionsInGame:true}),snapshot({scene:'options',houseId:0,optionsInGame:true})]){
  ui.state=state;ui.showNative(state);assert.equal(ui.buttons.filter(button=>button.options.id==='open-tutorial').length,1);assert.equal(ui.buttons.filter(button=>button.options.id==='open-languages').length,1);
 }
});

test('native password continuation becomes an unlocked next-mission button without exposing a password page',()=>{
 const {ui,calls}=fixture();ui.store.complete(1,1);
 ui.update(snapshot({scene:'password_display',outcome:'victory',outcomeHouse:1,outcomeMission:1,houseId:1,mission:2}),null,{});
 assert.equal(ui.view,'completion');assert.deepEqual(ui.buttons.map(b=>b.label),['NEXT MISSION','MAIN MENU']);assert.equal(ui.buttons[0].options.subtitle,ui.missionName(1,2));assert.equal(ui.footer.childElementCount,0);
 let requested;ui.startMission=(h,m)=>{requested=[h,m];};ui.buttons[0].action();assert.deepEqual(requested,[1,2]);assert.deepEqual(calls.nativeRoutes,[]);
});

test('native building intent keeps the last completed view through exactly one acknowledged fade',async()=>{
 const {ui,calls}=fixture();let finishCover,acks=[];
 ui.Module._dune_web_transition_covered=g=>{acks.push(g);return 1;};
 ui.building.active=true;ui.displayed='building';ui.curtain.cover=()=>{calls.covers++;ui.curtain.active=true;return new Promise(resolve=>{finishCover=resolve;});};
 const transition={transitionGeneration:7,transitionActive:true,transitionIntent:'building_exit',transitionTarget:'map',transitionReady:false};
 ui.update(snapshot({scene:'building',...transition}),null,{active:true,frame:{ready:false}});
 assert.equal(ui.building.active,true);assert.equal(ui.building.holdFrame,true);assert.equal(calls.covers,1);assert.deepEqual(acks,[],'native held frame is not released before host opacity');
 ui.update(snapshot({scene:'building',...transition}),null,{active:true,frame:{ready:false}});assert.equal(calls.covers,1);
 finishCover();await Promise.resolve();assert.deepEqual(acks,[7]);assert.equal(ui.building.active,true);
 ui.update(snapshot({scene:'map',...transition,transitionReady:true}),null,{active:false});
 assert.equal(ui.building.active,false);assert.equal(ui.displayed,'map');assert.equal(ui.revealAfterPaint,true);assert.equal(calls.covers,1);
 ui.update(snapshot({scene:'map',...transition,transitionReady:true,transitionActive:false}),null,{active:false});assert.equal(calls.covers,1,'sticky generation cannot repeat its fade');
});

test('modern Tutorial opens repeatedly at step zero without rerouting the original engine or replacing Continue',async()=>{
 const {ui,calls,storage}=fixture(),before=storage.getItem(CONTINUE_KEY),shown=[];
 ui.view='native';ui.state=snapshot({scene:'options',houseId:-1,optionsInGame:false});ui.tutorial={active:false,get capturesInput(){return this.active;},show(index){this.active=true;shown.push(index);},hide(){this.active=false;}};
 for(let i=0;i<3;i++){
  await ui.openTutorial();assert.equal(ui.view,'tutorial-guide');assert.equal(ui.tutorial.active,true);assert.equal(ui.capturesInput,true);assert.equal(ui.element.hidden,true);assert.equal(ui.busy,false);
  await ui.closeTutorial();assert.equal(ui.view,'native');assert.equal(ui.state.scene,'options');assert.equal(ui.tutorial.active,false);assert.equal(ui.element.hidden,false);
 }
 assert.deepEqual(shown,[0,0,0]);assert.deepEqual(calls.nativeRoutes,[]);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeStarts,[]);assert.equal(storage.getItem(CONTINUE_KEY),before);
});

test('Home uses the native textless getter even while its polled scene still says Title',()=>{
 const {ui}=fixture(),reads=[],previousDpr=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 Object.assign(ui,{view:'home',state:{scene:'title',sceneReady:false},coldHomeVideo:true,homePicture:im=>im,frame:{valid:true,canvas:{width:320,height:224}},hero:{getBoundingClientRect:()=>({width:320,height:240})},heroCanvas:{getContext:()=>({setTransform(){},drawImage(){}})},drawBackdrop(){},updateFrame(options){reads.push(options);return true;}});
 ui.element.hidden=false;ui.curtain.paint=()=>{};ui.building.render=()=>{};
 try{GameInterface.prototype.render.call(ui,100);assert.deepEqual(reads,[{textless:true}],'native Main can draw its first menu words between the50ms DOM polls; the getter knows the actual C scene');}finally{globalThis.devicePixelRatio=previousDpr;}
});
