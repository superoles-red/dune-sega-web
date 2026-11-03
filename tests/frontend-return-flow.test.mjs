import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {GameInterface} from '../web/game-ui.mjs';
import {CampaignStore,slotKey} from '../web/campaign-state.mjs';

// Use the production navigation, barrier and save policy. Only browser drawing,
// fetch and the ordinary native v2 I/O boundary are replaced by test doubles.
const source=await readFile(new URL('../web/shell.js',import.meta.url),'utf8');
const saveSource=source.slice(source.indexOf('function saveGame('),source.indexOf('function loadPayload('));
const nativeMain=btoa('ORIGINAL_FRONTEND_V2');
const originalState={scene:'map',sceneReady:true,activeRunArmed:1,activeRunHouse:1,activeRunMission:1,outcomeSeq:4,outcome:'none',houseId:1,mission:1};
function memory(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};}
function fixture({demo=false,cached=true,accept=true}={}){
 const storage=memory(),store=new CampaignStore(storage),ui=Object.create(GameInterface.prototype),calls=[];
 store.saveSlot(1,1,btoa('PREVIOUS_HEALTHY_SAVE'));
 const Module={HEAPU8:Uint8Array.from([1,2,3,4]),_dune_save_state_to_buffer(){calls.push('serialize');return 4;},_dune_get_save_buffer:()=>0,_dune_web_frontend_hold(){},_dune_web_screen_route(target){calls.push('route:'+target);throw Error('Returning to the frontend must not borrow native Main');}};
 Object.assign(ui,{Module,store,view:'native',state:{...originalState},sequence:0,updateEpoch:10,lastOutcome:4,demoMode:demo,resuming:false,activeRun:{house:1,mission:1},pendingScreen:null,displayed:'map',lastNativeKey:'',element:{hidden:true},demoButton:{hidden:true},isReady:()=>true,startEngine:async()=>{calls.push('start');},cancelGesture(){calls.push('cancel');},loadPayload(payload,silent){calls.push(['load',payload,silent]);return accept;},tell(message){calls.push(['error',message]);},showHome(){calls.push('home');this.view='home';this.element.hidden=false;},showMissions(house){calls.push(['missions',house]);this.view='missions';this.selectedHouse=house;this.element.hidden=false;},render(){calls.push('paint');},building:{active:false,update(){this.active=false;}}});
 ui.curtain={active:false,cover(){calls.push('cover');this.active=true;return Promise.resolve();},reveal(){calls.push('reveal');this.active=false;}};
 const saveContext={ready:true,gameUI:ui,Module,legacyMode:false,nativeJSON:()=>({...originalState}),validHouse:h=>h===1,validMission:m=>m===1,btoa,tell:ui.tell.bind(ui)};
 ui.saveCurrent=()=>{calls.push('save');return vm.runInNewContext(saveSource+';saveGame(true)',saveContext);};
 if(cached)ui.frontendPayload=nativeMain;
 const update=state=>ui.update({...originalState,activeRunArmed:0,...state},{map:false},{active:false});
 return {ui,calls,storage,update};
}

test('Main Menu saves the live run before loading its clean v2 and never routes to borrowed Main',async()=>{
 const f=fixture();const returning=f.ui.mainMenu();
 assert.deepEqual(f.calls.slice(0,4),['save','serialize','cancel','cover']);
 assert.equal(f.ui.activeRun,null);assert.equal(f.ui.pendingScreen.kind,'frontend');assert.equal(f.ui.curtain.active,true);
 await returning;
 assert.deepEqual(f.calls.find(Array.isArray),['load',nativeMain,true]);
 assert.equal(f.ui.store.getSlot(1).state,btoa(String.fromCharCode(1,2,3,4)));
 assert.equal(f.ui.pendingScreen.sent,true);assert.equal(f.calls.includes('home'),false);assert.equal(f.calls.some(x=>typeof x==='string'&&x.startsWith('route:')),false);
 const p=f.ui.pendingScreen;assert.equal(f.ui.matchesPending(p,{scene:'main',sceneReady:true}),false,'the pre-load update epoch is never accepted');
 f.update({scene:'pause',sceneReady:true});assert.equal(f.ui.pendingScreen,p);
 f.update({scene:'main',sceneReady:false});assert.equal(f.ui.pendingScreen,p);
 f.update({scene:'main',sceneReady:true});assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.view,'home');assert.equal(f.ui.busy,false);assert.equal(f.ui.curtain.active,false);
 assert.ok(f.calls.indexOf('serialize')<f.calls.findIndex(x=>Array.isArray(x)&&x[0]==='load'));
});

test('a house destination opens its catalogue only after the clean native Main is ready',async()=>{
 const f=fixture();await f.ui.mainMenu({house:2});
 f.update({scene:'building',sceneReady:true});assert.equal(f.ui.pendingScreen.kind,'frontend');assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='missions'),false);
 f.update({scene:'main',sceneReady:true});assert.equal(f.ui.view,'missions');assert.equal(f.ui.selectedHouse,2);assert.deepEqual(f.calls.find(x=>Array.isArray(x)&&x[0]==='missions'),['missions',2]);assert.equal(f.calls.includes('home'),false);
});

test('the asynchronous frontend download cannot acknowledge an old ready Main frame',async()=>{
 const f=fixture({cached:false}),previousFetch=globalThis.fetch;let resolveFetch;
 globalThis.fetch=url=>{assert.equal(url,'./frontend.state.bin');return new Promise(resolve=>{resolveFetch=resolve;});};
 try{
  await f.ui.mainMenu();const p=f.ui.pendingScreen;assert.equal(p.sent,false);
  f.update({scene:'main',sceneReady:true});assert.equal(f.ui.pendingScreen,p);assert.equal(f.calls.includes('home'),false);
  resolveFetch({ok:true,arrayBuffer:async()=>new TextEncoder().encode('DOWNLOADED_NATIVE_V2').buffer});await f.ui.frontendFetch;
  f.update({scene:'main',sceneReady:true});assert.equal(p.sent,true);assert.equal(f.ui.pendingScreen,p,'send epoch must not consume the snapshot captured before load');
  f.update({scene:'main',sceneReady:false});assert.equal(f.ui.pendingScreen,p);
  f.update({scene:'main',sceneReady:true});assert.equal(f.ui.view,'home');assert.equal(f.ui.pendingScreen,null);
  assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==='load').length,1);
 }finally{globalThis.fetch=previousFetch;}
});

test('leaving the demonstration preserves demo isolation and the normal save',async()=>{
 const f=fixture({demo:true}),before=f.storage.getItem(slotKey(1));
 await f.ui.mainMenu();assert.equal(f.ui.demoMode,true);assert.equal(f.calls.includes('serialize'),false);assert.equal(f.storage.getItem(slotKey(1)),before);
 f.update({scene:'main',sceneReady:true});assert.equal(f.ui.view,'home');assert.equal(f.ui.demoMode,true);assert.equal(f.storage.getItem(slotKey(1)),before);
});

test('a rejected frontend v2 preserves the prior save and returns a usable Home',async()=>{
 const f=fixture({accept:false});await f.ui.mainMenu();
 assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.busy,false);assert.equal(f.ui.view,'home');assert.equal(f.ui.curtain.active,false);assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='error'));
 assert.equal(f.ui.store.getSlot(1).state,btoa(String.fromCharCode(1,2,3,4)));
});

test('returning a world with Music and Sound OFF restores both through queued native toggles before unveiling Main',async()=>{
 const f=fixture(),routes=[],attempts=[],accepted=[];let queueBusy=true;
 Object.assign(f.ui.state,{music:0,sound:0});
 f.ui.Module._dune_web_screen_route=target=>{assert.equal(f.ui.state.houseId,-1,'route0 is restricted to the already loaded clean frontend');routes.push(target);return 1;};
 f.ui.Module._dune_web_campaign_input=(action,row)=>{attempts.push([action,row]);if(queueBusy)return 0;accepted.push([action,row]);return 1;};
 await f.ui.mainMenu();const p=f.ui.pendingScreen;
 assert.deepEqual(p.preferences,{music:0,sound:0});assert.equal(f.ui.curtain.active,true);
 f.update({scene:'main',houseId:-1,sceneReady:true,inputReady:true,music:1,sound:1});
 assert.deepEqual(routes,[1]);assert.equal(f.ui.pendingScreen,p);assert.equal(f.calls.includes('home'),false);
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:false,music:1,sound:1});assert.equal(attempts.length,0);
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:true,inputQueued:1,music:1,sound:1});
 assert.deepEqual(attempts,[[2,0]]);assert.equal(p.preferenceWaiting,undefined,'a rejected native queue attempt must not count as a toggle');
 queueBusy=false;
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:true,inputQueued:0,music:1,sound:1});
 assert.deepEqual(accepted,[[2,0]]);assert.equal(p.preferenceWaiting,'music');
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:true,inputQueued:1,music:1,sound:1});assert.equal(attempts.length,2,'wait for actual native Music state before sending another command');
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:true,inputQueued:0,music:0,sound:1});
 assert.deepEqual(accepted,[[2,0],[2,1]]);assert.equal(p.preferenceWaiting,'sound');
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:true,inputQueued:1,music:0,sound:1});assert.equal(attempts.length,3);
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:true,inputQueued:0,music:0,sound:0});
 assert.deepEqual(routes,[1,0]);assert.equal(f.ui.pendingScreen,p);assert.equal(f.ui.curtain.active,true);assert.equal(f.calls.includes('home'),false);
 f.update({scene:'options',houseId:-1,sceneReady:true,inputReady:true,music:0,sound:0});assert.deepEqual(routes,[1,0],'native return intent is queued only once');
 f.update({scene:'main',houseId:-1,sceneReady:false,inputReady:false,music:0,sound:0});assert.equal(f.ui.pendingScreen,p);assert.equal(f.ui.curtain.active,true);
 f.update({scene:'main',houseId:-1,sceneReady:true,inputReady:true,music:0,sound:0});
 assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.view,'home');assert.equal(f.ui.curtain.active,false);assert.equal(f.ui.state.music,0);assert.equal(f.ui.state.sound,0);
 assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==='load').length,1);
});

test('Back from clean Options or Tutorial preserves preferences with a direct native return and no v2 reload',async()=>{
 for(const scene of ['options','tutorial']){
  const f=fixture(),routes=[];Object.assign(f.ui.state,{scene,houseId:-1,activeRunArmed:0,music:0,sound:0});
  f.ui.Module._dune_web_screen_route=target=>{routes.push(target);return 1;};
  await f.ui.back();
  assert.deepEqual(routes,[0]);assert.equal(f.ui.pendingScreen.kind,'route');assert.equal(f.ui.pendingScreen.target,'main');
  assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='load'),false,'clean menus must not reset flags by reloading the default-ON snapshot');
  f.update({scene,houseId:-1,sceneReady:true,music:0,sound:0});assert.equal(f.ui.pendingScreen.target,'main');
  f.update({scene:'main',houseId:-1,sceneReady:false,music:0,sound:0});assert.equal(f.ui.pendingScreen.target,'main');
  f.update({scene:'main',houseId:-1,sceneReady:true,music:0,sound:0});
  assert.equal(f.ui.view,'home');assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.state.music,0);assert.equal(f.ui.state.sound,0);assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='load'),false);
 }
});
