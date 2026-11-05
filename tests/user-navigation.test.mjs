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
function bootSnapshot(extra={}){return snapshot({scene:'boot',sceneReady:false,houseId:0,activeRunArmed:0,pending:0,routePending:0,mapContext:0,sceneNativePc:0x200,sceneFrame:0,completedFrame:0,starts:0,...extra});}
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
 assert.equal(ui.pendingScreen.sent,true);assert.deepEqual(published,[]);assert.equal(coverOptions[0].duration,target==='options'?120:240);assert.equal(coverOptions[0].loading,false);
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

test('explicit cold Options restores genuine Main only behind the finished cover, then awaits real native Options',async()=>{
 const {ui,calls,storage}=fixture(),before=storage.getItem(CONTINUE_KEY);
 const payload=readFileSync(new URL('../web/frontend.state.bin',import.meta.url)).toString('base64');ui.frontendPayload=payload;
 let native=bootSnapshot({music:1,sound:1}),finishCover,reads=0;
 ui.Module._dune_web_campaign_json=()=>{reads++;return 1;};ui.Module.UTF8ToString=()=>JSON.stringify(native);
 // A stale UI poll must neither reject real boot nor supply its preferences.
 ui.state=snapshot({scene:'main',houseId:-1,activeRunArmed:0,music:0,sound:0});ui.activeRun=null;
 ui.curtain.cover=()=>{calls.covers++;ui.curtain.active=true;return new Promise(resolve=>{finishCover=resolve;});};
 ui.loadPayload=(value,silent)=>{calls.loads.push([value,silent]);assert.equal(ui.pendingScreen.awaitingCover,false);native={...native,scene:'main',sceneReady:true};return true;};
 const opening=ui.openOptions();assert.equal(ui.pendingScreen.sent,false);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[]);
 finishCover();await opening;
 assert.ok(reads>=2,'native state is read again when the cover and engine are ready');assert.deepEqual(calls.loads,[[payload,true]]);assert.deepEqual(calls.nativeRoutes,[1]);assert.equal(ui.pendingScreen.sent,true);
 assert.equal(storage.getItem(CONTINUE_KEY),before);assert.deepEqual(calls.saves,[]);assert.equal(ui.curtain.active,true);assert.equal(calls.reveals,0);
 ui.update({...native,scene:'options',sceneReady:false,inputReady:false},null,{});assert.equal(ui.pendingScreen.target,'options');assert.equal(calls.reveals,0);
 ui.update({...native,scene:'options',sceneReady:true,inputReady:true,inputKind:'options'},null,{});
 assert.equal(ui.pendingScreen,null);assert.equal(ui.state.music,1);assert.equal(ui.state.sound,1);assert.equal(ui.element.dataset.ready,'true');assert.equal(calls.loads.length,1);assert.equal(storage.getItem(CONTINUE_KEY),before);
});

test('cold Options reads after engine readiness and keeps the route unsent while its shared frontend download is pending',async()=>{
 const {ui,calls,storage}=fixture(),before=storage.getItem(CONTINUE_KEY),previousFetch=globalThis.fetch;
 delete ui.frontendPayload;let engineReady=false,reads=0,resolveFetch;
 const native=bootSnapshot();
 ui.isReady=()=>engineReady;ui.startEngine=async()=>{engineReady=true;};ui.Module._dune_web_campaign_json=()=>{assert.equal(engineReady,true);reads++;return 1;};ui.Module.UTF8ToString=()=>JSON.stringify(native);
 globalThis.fetch=url=>{assert.equal(url,'./frontend.state.bin');return new Promise(resolve=>{resolveFetch=resolve;});};
 try{
  const opening=ui.openOptions();assert.equal(reads,0);await opening;
  assert.equal(ui.pendingScreen.sent,false);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[]);assert.equal(ui.curtain.active,true);
  const bytes=readFileSync(new URL('../web/frontend.state.bin',import.meta.url));resolveFetch({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});await ui.frontendFetch;
  ui.update(native,null,{});assert.equal(ui.pendingScreen.sent,true);assert.equal(calls.loads.length,1);assert.deepEqual(calls.nativeRoutes,[1]);assert.equal(ui.pendingScreen.target,'options','the poll before snapshot restoration is not a destination acknowledgement');assert.equal(storage.getItem(CONTINUE_KEY),before);
 }finally{globalThis.fetch=previousFetch;}
});

test('fresh Title/Main/world and unsafe boot states never reload audio/defaults for Options',async()=>{
 const states=[{scene:'title'},{scene:'main'},{scene:'options'},{scene:'map',houseId:1},{scene:'pause',houseId:1},{activeRunArmed:1},{pending:1},{routePending:1},{mapContext:1},{houseId:-1},{sceneNativePc:0x9320},{sceneFrame:1},{starts:1},{demo:true},{training:true}];
 for(const extra of states){
  const {ui,calls,storage}=fixture(),before=storage.getItem(CONTINUE_KEY);
  const native=bootSnapshot({music:0,sound:0,...extra});
  ui.demoMode=!!extra.demo;ui.trainingMode=!!extra.training;ui.state={...native,scene:'boot',houseId:-1,activeRunArmed:0,pending:0};
  ui.Module._dune_web_campaign_json=()=>1;ui.Module.UTF8ToString=()=>JSON.stringify(native);
  await ui.openOptions();assert.deepEqual(calls.loads,[],'no restore for '+JSON.stringify(extra));assert.deepEqual(calls.nativeRoutes,[1]);assert.equal(ui.state.music,0);assert.equal(ui.state.sound,0);assert.equal(storage.getItem(CONTINUE_KEY),before);assert.deepEqual(calls.saves,[]);
 }
});

test('an immediate frame-zero Options click waits for genuine boot identity before restoring its snapshot',async()=>{
 const {ui,calls}=fixture();let native=bootSnapshot({scene:'unknown'});
 ui.Module._dune_web_campaign_json=()=>1;ui.Module.UTF8ToString=()=>JSON.stringify(native);
 await ui.openOptions();assert.equal(ui.pendingScreen.sent,false);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[]);
 native={...native,scene:'boot'};ui.update(native,null,{});
 assert.equal(calls.loads.length,1);assert.deepEqual(calls.nativeRoutes,[1]);assert.equal(ui.pendingScreen.sent,true);
});

test('frame-zero waiting is bounded and a native fault fails instead of keeping Options loading forever',async()=>{
 const previousPerformance=globalThis.performance;let now=0;globalThis.performance={now:()=>now};
 try{
  const {ui,calls}=fixture(),native=bootSnapshot({scene:'unknown'});
  ui.Module._dune_web_campaign_json=()=>1;ui.Module.UTF8ToString=()=>JSON.stringify(native);
  await ui.openOptions();assert.equal(ui.pendingScreen.sent,false);now=1001;ui.update(native,null,{});
  assert.equal(ui.pendingScreen.sent,true);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[1],'an initialization that remains unknown uses the bounded ordinary route fallback');
  const failed=fixture();failed.ui.Module._dune_web_campaign_json=()=>1;failed.ui.Module.UTF8ToString=()=>JSON.stringify({...native,fault:1});
  await failed.ui.openOptions();assert.equal(failed.ui.pendingScreen,null);assert.equal(failed.ui.view,'home');assert.equal(failed.ui.busy,false);assert.equal(failed.ui.curtain.active,false);assert.deepEqual(failed.calls.loads,[]);assert.deepEqual(failed.calls.nativeRoutes,[]);assert.ok(failed.calls.messages.length);
 }finally{globalThis.performance=previousPerformance;}
});

test('a transient boot click sound finishes before snapshot restore; a stuck call has a bounded ordinary-route fallback',async()=>{
 const previousPerformance=globalThis.performance;let now=0;globalThis.performance={now:()=>now};
 try{
  const {ui,calls}=fixture();let native=bootSnapshot({uiCallActive:1});ui.Module._dune_web_campaign_json=()=>1;ui.Module.UTF8ToString=()=>JSON.stringify(native);
  await ui.openOptions();assert.equal(ui.pendingScreen.sent,false);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[]);
  native={...native,uiCallActive:0};ui.update(native,null,{});assert.equal(calls.loads.length,1);assert.deepEqual(calls.nativeRoutes,[1]);
  const stuck=fixture();stuck.ui.Module._dune_web_campaign_json=()=>1;stuck.ui.Module.UTF8ToString=()=>JSON.stringify(bootSnapshot({uiCallActive:1}));
  await stuck.ui.openOptions();now=1001;stuck.ui.update(bootSnapshot({uiCallActive:1}),null,{});
  assert.equal(stuck.ui.pendingScreen.sent,true);assert.deepEqual(stuck.calls.loads,[]);assert.deepEqual(stuck.calls.nativeRoutes,[1]);
 }finally{globalThis.performance=previousPerformance;}
});

test('a boot that reaches Title during the snapshot download follows the ordinary route and keeps live music',async()=>{
 const {ui,calls}=fixture(),previousFetch=globalThis.fetch;delete ui.frontendPayload;let resolveFetch;
 let native=bootSnapshot({music:0,sound:0});ui.Module._dune_web_campaign_json=()=>1;ui.Module.UTF8ToString=()=>JSON.stringify(native);
 globalThis.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
 try{
  await ui.openOptions();assert.equal(ui.pendingScreen.sent,false);
  native={...native,scene:'title'};resolveFetch({ok:true,arrayBuffer:async()=>new TextEncoder().encode('UNUSED_FRONTEND').buffer});await ui.frontendFetch;
  ui.update(native,null,{});assert.equal(ui.pendingScreen.sent,true);assert.deepEqual(calls.loads,[]);assert.deepEqual(calls.nativeRoutes,[1]);assert.equal(ui.state.music,0);assert.equal(ui.state.sound,0);
 }finally{globalThis.fetch=previousFetch;}
});

test('Options and Pause offer How to Play and Languages, with Tutorial inside the guide only',()=>{
 const {ui}=fixture();
 ui.showHome();assert(!ui.buttons.some(button=>button.options.id==='open-tutorial'||button.label==='TUTORIAL'));
 ui.state=snapshot({scene:'options',houseId:-1,optionsInGame:false});ui.showNative(ui.state);
 assert.equal(ui.buttons.filter(button=>button.options.id==='open-tutorial').length,0);assert.equal(ui.buttons.find(button=>button.options.id==='open-controls').label,'HOW TO PLAY?');
 assert.equal(ui.buttons.filter(button=>button.options.id==='open-languages').length,1);
 for(const state of [snapshot({scene:'pause',houseId:0,optionsInGame:true}),snapshot({scene:'options',houseId:0,optionsInGame:true})]){
  ui.state=state;ui.showNative(state);assert.equal(ui.buttons.filter(button=>button.options.id==='open-tutorial').length,0);assert.equal(ui.buttons.filter(button=>button.options.id==='open-controls').length,1);assert.equal(ui.buttons.filter(button=>button.options.id==='open-languages').length,1);
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

test('loading the campaign catalogue does not download or decode unused tutorial atlases',async()=>{
 const previousFetch=globalThis.fetch,requests=[];const {ui}=fixture();
 globalThis.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>campaign};};
 ui.prepareTutorial=()=>{assert.fail('reference images are on demand, not a startup dependency');};
 try{await ui.loadCampaign();assert.equal(ui.campaign,campaign);assert.deepEqual(requests,['./ui-assets/campaign/manifest.json']);}finally{globalThis.fetch=previousFetch;}
});

test('opening the reference overlaps its asset load and engine readiness with the fade',async()=>{
 const {ui}=fixture(),started=[];let finishCover,finishEngine,finishAssets;
 ui.state=snapshot({scene:'options',houseId:-1,optionsInGame:false});
 ui.tutorial={active:false,show(index){assert.equal(index,0);this.active=true;},hide(){this.active=false;}};
 ui.curtain.cover=()=>{started.push('cover');ui.curtain.active=true;return new Promise(resolve=>{finishCover=resolve;});};
 ui.startEngine=()=>{started.push('engine');return new Promise(resolve=>{finishEngine=resolve;});};
 ui.prepareTutorial=()=>{started.push('assets');return new Promise(resolve=>{finishAssets=resolve;});};
 const opening=ui.openTutorial();assert.deepEqual(started,['cover','engine','assets']);assert.equal(ui.tutorial.active,false);
 finishEngine();finishAssets();await Promise.resolve();assert.equal(ui.tutorial.active,false,'the cover remains the presentation boundary');
 finishCover();await opening;assert.equal(ui.tutorial.active,true);assert.equal(ui.busy,false);assert.equal(ui.view,'tutorial-guide');
});

test('Home uses the native textless getter even while its polled scene still says Title',()=>{
 const {ui}=fixture(),reads=[],previousDpr=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 Object.assign(ui,{view:'home',state:{scene:'title',sceneReady:false},coldHomeVideo:true,homePicture:im=>im,frame:{valid:true,revision:1,data:{data:Uint8ClampedArray.of(1,0,0,255)},canvas:{width:320,height:224}},hero:{getBoundingClientRect:()=>({width:320,height:240})},heroCanvas:{getContext:()=>({setTransform(){},drawImage(){}})},drawBackdrop(){},updateFrame(options){reads.push(options);return true;}});
 ui.element.hidden=false;ui.curtain.paint=()=>{};ui.building.render=()=>{};
 try{GameInterface.prototype.render.call(ui,100);assert.deepEqual(reads,[{textless:true}],'native Main can draw its first menu words between the50ms DOM polls; the getter knows the actual C scene');}finally{globalThis.devicePixelRatio=previousDpr;}
});

test('Home credits retain the legal-credit gate and extend below the complete original frame',()=>{
 const source={width:320,height:224},images=[],credits=[],fills=[];
 const context={drawImage(...args){images.push(args);},fillRect(...args){fills.push(args);}};
 const ui=Object.create(GameInterface.prototype);Object.assign(ui,{titleFrame:{getContext:()=>context},creditsUnlocked:false,art:{text(_context,label,x,y,options){credits.push({label,x,y,options});}}});
 const cold=ui.homePicture(source);assert.equal(cold.width,320);assert.equal(credits.length,0,'translator and engine acknowledgements cannot precede the original licensing sequence');
 ui.creditsUnlocked=true;const final=ui.homePicture(source);assert.ok(credits.some(line=>line.label.includes('SHEDEVR')));
 assert.ok(credits.every(line=>line.y>=224&&line.y+8*line.options.scale<=final.height),'all acknowledgements occupy added rows below the original image');
 assert.ok(images.every(args=>args[0]===source&&args.slice(1).join(',')==='0,0,320,224'),'the source frame and its original legal text are never cropped or resized internally');
 assert.deepEqual(fills.at(-1),[0,0,final.width,final.height]);
});

test('animated Home artwork reuses its canvas backing without retaining old pixels',()=>{
 let width=300,height=150,resets=0,fills=0,images=0;
 const context={fillRect(x,y,w,h){assert.deepEqual([x,y,w,h],[0,0,320,255]);fills++;},drawImage(){images++;}};
 const ui=Object.create(GameInterface.prototype);ui.titleFrame={get width(){return width;},set width(value){width=value;resets++;},get height(){return height;},set height(value){height=value;resets++;},getContext:()=>context};
 for(let i=0;i<120;i++)ui.homePicture({width:320,height:224});
 assert.equal(resets,2,'allocate once rather than resetting twice for each animated frame');assert.equal(fills,120,'each frame still completely replaces the prior picture');assert.equal(images,120);
});
