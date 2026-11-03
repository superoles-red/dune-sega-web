import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {GameInterface} from '../web/game-ui.mjs';
import {CampaignStore,slotKey} from '../web/campaign-state.mjs';

// Exercise the actual shell entry point without starting a browser/ROM. The
// GameInterface route/load/update methods are real; only native I/O is stubbed.
const source=await readFile(new URL('../web/shell.js',import.meta.url),'utf8');
const loadSource=source.slice(source.indexOf('function loadGame('),source.indexOf('const Module=window.Module'));
const saveSource=source.slice(source.indexOf('function saveGame('),source.indexOf('function loadPayload('));
const payload='Tk9STUFMX1YyX1BBWUxPQUQ=';
function memory(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};}
function fixture({accept=true,delayFirstCover=false,demoMode=false}={}){
 const storage=memory(),store=new CampaignStore(storage);store.saveSlot(1,1,payload);
 const ui=Object.create(GameInterface.prototype),calls={saveBeforeLoad:0,loaded:[],oldRoute:0,cancel:0,cover:0,reveal:0,errors:[],published:[],routeHolds:[]};let release;
 Object.assign(ui,{store,view:'native',state:{},sequence:0,updateEpoch:0,lastOutcome:7,demoMode,resuming:false,activeRun:null,pendingScreen:null,displayed:'pause',lastNativeKey:'pause',element:{hidden:true},demoButton:{hidden:true},building:{active:false,update(){this.active=false;},render(){}},isReady:()=>true,startEngine:async()=>{},cancelGesture(){calls.cancel++;},saveCurrent(){calls.saveBeforeLoad++;store.saveSlot(1,1,'T1ZFUldSSVRURU4=');},loadPayload(value,silent){calls.loaded.push({value,silent});return accept;},tell(message){calls.errors.push(message);},showHome(){this.view='home';this.element.hidden=false;},Module:{_dune_web_screen_route(){calls.oldRoute++;return 1;}}});
 ui.curtain={active:false,cover(){this.active=true;calls.cover++;if(delayFirstCover&&calls.cover===1)return new Promise(resolve=>{release=resolve;});return Promise.resolve();},reveal(){this.active=false;calls.reveal++;},paint(){}};
 ui.showNative=(state,pending)=>calls.published.push({scene:state.scene,pending});
 ui.Module._dune_web_route_hold=(token,on)=>calls.routeHolds.push([token,on]);
 const context={ready:true,legacyMode:false,gameUI:ui,loadPayload(){throw Error('Modern F8 must use the transition flow');},browserStorage:()=>storage,SAVE_KEY:'legacy',pollState(){}};
 return {ui,calls,storage,context,release:()=>release?.(),load:()=>vm.runInNewContext(loadSource+';loadGame(true)',context)};
}
for(const target of ['options','pause'])test('F8 replaces an eager '+target+' route without publishing its cached preview or overwriting Continue',async()=>{
 const f=fixture({delayFirstCover:true}),old=f.ui.requestRoute(target);assert.equal(f.ui.pendingScreen.target,target);assert.equal(f.ui.sequence,1);
 assert.equal(f.calls.oldRoute,1,'the original route is queued immediately, before its short visual cover completes');assert.equal(f.ui.pendingScreen.sent,true);assert.deepEqual(f.calls.published,[]);
 const loading=f.load();assert.equal(f.ui.pendingScreen.kind,'load');assert.equal(f.ui.sequence,2);assert.equal(f.ui.curtain.active,true);await loading;f.release();await old;
 assert.equal(f.calls.oldRoute,1,'the cancelled route cannot submit again after the newer save load');assert.deepEqual(f.calls.published,[],'the stale cover completion cannot publish Options/Pause over the loaded world');if(target==='pause')assert.deepEqual(f.calls.routeHolds.filter(([token])=>token===1),[[1,1],[1,0]],'cancellation releases the superseded pause hold using its own token');
 assert.equal(f.calls.saveBeforeLoad,0);assert.deepEqual(f.calls.loaded,[{value:payload,silent:true}]);assert.equal(f.ui.store.getSlot(1).state,payload);assert.equal(f.ui.lastOutcome,7);
 f.ui.update({scene:'map',sceneReady:true,outcomeSeq:7,outcome:'none',activeRunArmed:1,activeRunHouse:1,activeRunMission:1,houseId:1,mission:1},{map:1},{active:false});
 assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.busy,false);assert.equal(f.ui.element.hidden,true);assert.equal(f.ui.revealAfterPaint,true);f.ui.render(0);assert.equal(f.ui.curtain.active,false);assert.equal(f.ui.store.getSlot(1).state,payload);
});
test('successful F8 leaves demo mode only after the normal native loader accepts',async()=>{
 const f=fixture({demoMode:true});const loading=f.load();assert.equal(f.ui.demoMode,true);await loading;
 assert.equal(f.ui.demoMode,false);assert.equal(f.calls.saveBeforeLoad,0);assert.equal(f.ui.store.getSlot(1).state,payload);assert.equal(f.ui.lastOutcome,7);
});
test('missing or rejected normal save keeps demo isolated from persistence',async()=>{
 const missing=fixture({demoMode:true});missing.ui.store.resumable=()=>null;missing.ui.store.legacy=()=>null;assert.equal(missing.load(),false);assert.equal(missing.ui.demoMode,true);assert.equal(missing.calls.cover,0);
 const rejected=fixture({demoMode:true,accept:false});const before=rejected.storage.getItem(slotKey(1));await rejected.load();assert.equal(rejected.ui.demoMode,true);assert.equal(rejected.calls.saveBeforeLoad,0);assert.equal(rejected.storage.getItem(slotKey(1)),before);assert.equal(rejected.calls.errors.length,1);
 let serialized=0,writes=0;const context={ready:true,gameUI:rejected.ui,nativeJSON(){throw Error('Demo guard must run before native serialization');},Module:{_dune_save_state_to_buffer(){serialized++;}},browserStorage:()=>({setItem(){writes++;}})};assert.equal(vm.runInNewContext(saveSource+';saveGame(true)',context),false);assert.equal(serialized,0);assert.equal(writes,0);
});
test('legacy F8 retains its direct native loader path',()=>{
 let loaded='';const context={ready:true,legacyMode:true,gameUI:null,loadPayload(value){loaded=value;return true;},browserStorage:()=>({getItem:()=>payload}),SAVE_KEY:'legacy',pollState(){}};
 assert.equal(vm.runInNewContext(loadSource+';loadGame(true)',context),true);assert.equal(loaded,payload);
});


test('a stopped native runtime cannot overwrite a healthy saved mission',()=>{
 let serialized=0,writes=0;
 const state={activeRunArmed:1,activeRunHouse:1,activeRunMission:1,scene:'map',sceneReady:true,fault:1};
 const context={ready:true,gameUI:{demoMode:false},nativeJSON:()=>state,Module:{_dune_save_state_to_buffer(){serialized++;}},browserStorage:()=>({setItem(){writes++;}})};
 assert.equal(vm.runInNewContext(saveSource+';saveGame(true)',context),false);
 assert.equal(serialized,0);assert.equal(writes,0);
});

test('normal saved Pause resumes under the curtain, while building and demo loads retain their native scene',async()=>{
 const state={scene:'pause',sceneReady:true,outcomeSeq:7,outcome:'none',activeRunArmed:1,activeRunHouse:1,activeRunMission:1,houseId:1,mission:1};
 const normal=fixture(),shown=[],routes=[];let routePromise;
 normal.ui.showNative=s=>shown.push(s.scene);
 normal.ui.Module._dune_web_screen_route=target=>{routes.push(target);return 1;};
 const requestRoute=normal.ui.requestRoute.bind(normal.ui);normal.ui.requestRoute=target=>(routePromise=requestRoute(target));
 await normal.load();normal.ui.update(state,{map:0},{active:false});
 assert.equal(normal.ui.pendingScreen.kind,'route');assert.equal(normal.ui.pendingScreen.target,'map');assert.equal(normal.ui.curtain.active,true);assert.deepEqual(shown,[],'the saved Pause is never presented');
 await routePromise;assert.deepEqual(routes,[4]);
 normal.ui.update({...state,scene:'map',sceneReady:false},{map:1},{active:false});assert.equal(normal.ui.pendingScreen.target,'map');assert.equal(normal.ui.curtain.active,true);
 normal.ui.update({...state,scene:'map',sceneReady:true},{map:1},{active:false});assert.equal(normal.ui.pendingScreen,null);assert.equal(normal.ui.element.hidden,true);assert.equal(normal.ui.revealAfterPaint,true);
 normal.ui.render(0);assert.equal(normal.ui.curtain.active,false);assert.equal(normal.ui.store.getSlot(1).state,payload);assert.deepEqual(shown,[]);

 const building=fixture();building.ui.building.update=function(s){this.active=!!s.active;};
 await building.load();building.ui.update({...state,scene:'building'},{map:0},{active:true,frame:{ready:true}});
 assert.equal(building.ui.pendingScreen,null);assert.equal(building.ui.building.active,true);assert.equal(building.calls.oldRoute,0,'a saved building must stay open');

 const demo=fixture({demoMode:true}),demoShown=[];demo.ui.showNative=s=>demoShown.push(s.scene);
 await demo.ui.prepareNative({kind:'load',demo:true},()=>1);demo.ui.update(state,{map:0},{active:false});
 assert.equal(demo.ui.pendingScreen,null);assert.equal(demo.ui.demoMode,true);assert.equal(demo.calls.oldRoute,0,'demo fixtures must not receive the normal Continue shortcut');assert.deepEqual(demoShown,['pause']);
});
