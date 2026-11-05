import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {GameInterface} from '../web/game-ui.mjs';
import {NativeConfirmation} from '../web/confirm-dialog.mjs';
import {CampaignStore,CONTINUE_KEY,CAMPAIGN_KEY} from '../web/campaign-state.mjs';
import {LANGUAGE_KEY} from '../web/i18n.mjs';
import {createSaveFile,validateNativeSave,MAX_SAVE_FILE_BYTES} from '../web/save-files.mjs';

// Exercise production import/navigation/confirmation/store methods. Browser
// painting and the existing native serializer/loader are explicit boundaries.
class Element {
 constructor(){this.hidden=false;this.inert=false;this.style={};this.dataset={};this.children=[];this.events=new Map();this.attributes=new Map();this.isConnected=true;this.classList={add(){},remove(){}};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 addEventListener(name,listener){this.events.set(name,listener);}
 get childElementCount(){return this.children.length;}
 get firstElementChild(){return this.children[0];}
 focus(){document.activeElement=this;}
}
async function dom(run){const previous=globalThis.document,parents=new Map(['scene-ui','building-screen','native-menu','context-actions','demo-launch'].map(id=>[id,new Element()]));globalThis.document={createElement:()=>new Element(),activeElement:new Element(),getElementById:id=>parents.get(id)??null};try{return await run(parents);}finally{globalThis.document=previous;}}
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const payload=readFileSync(new URL('../web/demo.state.bin',import.meta.url)).toString('base64'),nativeMission=validateNativeSave(payload);
const snapshot=(extra={})=>({scene:'map',sceneReady:true,presentationReady:true,inputReady:true,inputKind:'continue',outcome:'none',outcomeSeq:0,activeRunArmed:1,activeRunHouse:nativeMission.house,activeRunMission:nativeMission.mission,houseId:nativeMission.house,mission:nativeMission.mission,music:1,sound:1,...extra});
async function archiveFile({active=true}={}){const store=new CampaignStore(memory());store.complete(2,1);store.complete(2,2);if(active){store.adoptResume(nativeMission.house,nativeMission.mission);store.saveSlot(nativeMission.house,nativeMission.mission,payload);}const generated=await createSaveFile({store,language:'ru'});return {...generated,size:new TextEncoder().encode(generated.text).length,text:async()=>generated.text};}
function fixture({accept=true,startError=false,ready=true}={}){
 const ui=Object.create(GameInterface.prototype),storage=memory(),store=new CampaignStore(storage),calls={loads:[],saves:[],messages:[],languages:[],routes:[],homes:0};store.adoptResume(0,1);store.saveSlot(0,1,btoa('PREVIOUS_NATIVE_SAVE'));storage.setItem(LANGUAGE_KEY,'en');
 const art={ready:false,displayText:text=>text,decorate(){return {pulse(){},dispose(){},update(){}};},language:{code:'en',setLanguage(code){this.code=code;calls.languages.push(code);}}};
 const dialog=Object.create(NativeConfirmation.prototype);Object.assign(dialog,{art,active:false,views:[],feedback(){},element:new Element(),actions:new Element(),panel:new Element(),text:new Element(),background:new Element()});
 Object.assign(ui,{art,dialog,store,Module:{_dune_web_screen_route:target=>(calls.routes.push(target),1)},view:'platform',state:snapshot({scene:'pause',houseId:0,activeRunHouse:0,activeRunMission:1}),visibleNative:{},activeRun:{house:0,mission:1},demoMode:false,trainingMode:false,resuming:false,sequence:0,updateEpoch:10,lastOutcome:0,pendingScreen:null,lastNativeKey:'',displayed:'map',waitingForFrame:false,optionViews:new Map(),buttons:[],element:new Element(),message:new Element(),actions:new Element(),footer:new Element(),demoButton:new Element(),building:{active:false,update(s){this.active=!!s.active;}},isReady:()=>ready,startEngine:async()=>{if(startError)throw Error('native initialization failed');},cancelGesture(){},resumeAudio(){},tell:text=>calls.messages.push(text),drawMessage(){},render(){},saveCurrent(...args){calls.saves.push(args);return true;},loadPayload(state,silent){calls.loads.push({state,silent,guard:ui.fileImportInProgress,stored:ui.store.resumable()?.state??null});return accept;},frontendPayload:btoa('ORIGINAL_CLEAN_NATIVE_FRONTEND'),platformOrigin:'pause'});
 ui.curtain={active:false,cover(){this.active=true;return Promise.resolve();},reveal(){this.active=false;},paint(){}};
 ui.clear=function(view,title){this.view=view;this.title=title;this.buttons=[];this.actions.replaceChildren();this.footer.replaceChildren();this.element.hidden=false;};
 ui.button=function(label,action,options={},parent=this.actions){const button=new Element();parent.append(button);this.buttons.push({label,action,options,button});return {button,view:{update(){}}};};
 ui.showHome=function(){calls.homes++;this.view='home';this.element.hidden=false;};
 return {ui,storage,calls};
}
async function waitFor(condition){for(let i=0;i<1000;i++){if(condition())return;await delay(1);}assert.fail('expected asynchronous state was not reached');}
async function confirmImport(f,file,{accept=true}={}){const operation=f.ui.importFile(file);await waitFor(()=>f.ui.dialog.active);f.ui.dialog.close(accept);await operation;}
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);

function installFixture({result='accepted',kind='android-chrome',failure=false}={}){
 const f=fixture(),order=[],updates=[],state={status:'idle',installed:false,preparing:false,installationKind:kind,appleMobile:kind==='apple'};
 f.ui.platform={snapshot:()=>({...state}),install(){order.push('prompt');return Promise.resolve(result);},async prepareOffline(){order.push('offline');state.status=failure?'error':'ready';if(failure)throw Error('offline download failed');return {...state};}};
 f.ui.installButton=new Element();f.ui.installButton._nativeArtView={update:(label,options)=>updates.push({label,...options})};
 return {...f,order,updates,platformState:state};
}
test('Install Game invokes the prompt before downloading, but accepted is not yet an installed application',async()=>dom(async()=>{
 const f=installFixture(),before=[...f.storage.values],operation=f.ui.installGame();assert.deepEqual(f.order,['prompt']);assert.equal(f.ui.installButton.disabled,true);
 await operation;assert.deepEqual(f.order,['prompt','offline']);assert.equal(f.ui.platformNotice,'INSTALLATION REQUESTED.');assert(!f.ui.messageText.includes('INSTALLED ON THIS DEVICE.'));assert(f.ui.messageText.includes('OFFLINE GAME READY.'));assert(f.ui.messageText.includes('ANDROID CHROME:'));
 assert.equal(f.ui.installButton.disabled,false);assert.deepEqual([...f.storage.values],before);assert.deepEqual(f.calls.loads,[]);assert.deepEqual(f.calls.saves,[]);
 f.platformState.installed=true;f.ui.refreshPlatform();assert.equal(f.ui.platformNotice,'');assert.equal(f.ui.installButton.disabled,true);assert.equal(f.updates.at(-1).label,'INSTALLED');assert(f.ui.messageText.includes('INSTALLED ON THIS DEVICE.'));
}));
test('dismissing installation does not begin a cache download or report the app installed',async()=>dom(async()=>{
 const f=installFixture({result:'cancelled'});await f.ui.installGame();assert.deepEqual(f.order,['prompt']);assert.equal(f.ui.platformNotice,'INSTALLATION CANCELLED.');assert.equal(f.ui.installBusy,false);assert.equal(f.ui.installButton.disabled,false);assert(!f.ui.messageText.includes('INSTALLED ON THIS DEVICE.'));
}));
test('manual install instructions fit the actual browser and an explicit install action prepares offline too',async()=>dom(async()=>{
 for(const [kind,phrase]of [['apple','ON IPHONE: SHARE'],['samsung','SAMSUNG INTERNET:'],['android-chrome','ANDROID CHROME:'],['android','ANDROID:'],['mac-safari','MAC SAFARI:'],['desktop','INSTALL THE GAME FROM YOUR BROWSER MENU.']]){
  const f=installFixture({result:kind==='apple'?'apple-help':'install-help',kind});await f.ui.installGame();assert.deepEqual(f.order,['prompt','offline']);assert(f.ui.messageText.includes(phrase));assert.equal(f.ui.messageText.split(phrase).length,2,'the instruction is not repeated as both notice and hint');
 }
}));
test('failed offline preparation stays separate from an accepted install request and can be retried',async()=>dom(async()=>{
 const f=installFixture({failure:true});await f.ui.installGame();assert.equal(f.ui.installBusy,false);assert.equal(f.ui.installButton.disabled,false);assert.equal(f.ui.platformNotice,'INSTALLATION REQUESTED.');assert(f.ui.messageText.includes('OFFLINE DOWNLOAD FAILED. TRY AGAIN.'));assert(f.calls.messages.includes('OFFLINE DOWNLOAD FAILED. TRY AGAIN.'));assert(!f.ui.messageText.includes('OFFLINE GAME READY.'));
}));
test('in-flight installation coalesces clicks and a waiting complete package asks for a clean relaunch',async()=>dom(async()=>{
 const f=installFixture();let choose;f.ui.platform.install=()=>{f.order.push('prompt');return new Promise(resolve=>{choose=resolve;});};
 const first=f.ui.installGame();await f.ui.installGame();assert.deepEqual(f.order,['prompt']);choose('accepted');await first;
 f.platformState.restartRequired=true;f.ui.refreshPlatform();assert(f.ui.messageText.includes('CLOSE ALL GAME WINDOWS AND REOPEN TO USE THE DOWNLOADED COPY.'));assert.deepEqual(f.calls.routes,[]);assert.deepEqual(f.calls.loads,[]);
}));

test('import asks confirmation before changing any existing browser save, and CANCEL preserves it exactly',async()=>dom(async parents=>{
 const f=fixture(),file=await archiveFile(),before=[...f.storage.values],operation=f.ui.importFile(file);await waitFor(()=>f.ui.dialog.active);
 assert.equal(f.ui.dialog.title,'LOAD SAVE FILE?');assert.equal(parents.get('scene-ui').inert,true);assert.deepEqual([...f.storage.values],before);assert.deepEqual(f.calls.loads,[]);assert.equal(f.ui.fileBusy,true);
 f.ui.dialog.close(false);await operation;assert.deepEqual([...f.storage.values],before);assert.equal(f.ui.fileBusy,false);assert(!f.ui.fileImportInProgress);assert.equal(parents.get('scene-ui').inert,false);assert.deepEqual(f.calls.saves,[]);
}));
test('active import restores exact payload without saving stale world, and completes only after a fresh native-ready frame',async()=>dom(async()=>{
 const f=fixture(),file=await archiveFile();await confirmImport(f,file);
 assert.equal(f.ui.pendingScreen.kind,'load');assert.equal(f.ui.fileImportInProgress,true);assert.equal(f.ui.art.language.code,'en');assert.deepEqual(f.calls.saves,[]);assert.deepEqual(f.calls.loads,[{state:payload,silent:true,guard:true,stored:payload}]);assert.equal(f.ui.store.resumable().state,payload);
 f.ui.update(snapshot({sceneReady:false,presentationReady:false}),{map:true},{active:false});assert.equal(f.ui.fileImportInProgress,true);assert.equal(f.ui.pendingScreen.kind,'load');assert.deepEqual(f.calls.languages,[]);
 f.ui.update(snapshot(),{map:true},{active:false});assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.fileImportInProgress,false);assert.equal(f.ui.art.language.code,'ru');assert.equal(f.ui.store.resumable().state,payload);assert.equal(f.ui.store.progress.houses[2].unlocked,3);assert(f.calls.messages.includes('SAVE FILE LOADED.'));assert.deepEqual(f.calls.saves,[]);
}));
test('progress-only import clears shared Continue and returns to native Main without saving the old run',async()=>dom(async()=>{
 const f=fixture(),file=await archiveFile({active:false});await confirmImport(f,file);assert.equal(f.ui.pendingScreen.kind,'frontend');assert.equal(f.ui.store.resumable(),null);assert.equal(f.ui.fileImportInProgress,true);assert.deepEqual(f.calls.saves,[]);assert.equal(f.calls.loads[0].guard,true);
 f.ui.update(snapshot({scene:'main',houseId:-1,activeRunArmed:0}),{map:false},{active:false});assert.equal(f.ui.fileImportInProgress,false);assert.equal(f.ui.view,'home');assert.equal(f.ui.art.language.code,'ru');assert.equal(f.ui.store.resumable(),null);assert.equal(new CampaignStore(f.storage).resumable(),null);assert.equal(f.ui.store.progress.houses[2].unlocked,3);assert.deepEqual(f.calls.saves,[]);
}));
test('native payload refusal restores all prior browser save keys and clears import guard',async()=>dom(async()=>{
 const f=fixture({accept:false}),file=await archiveFile(),before=[...f.storage.values],oldProgress=f.ui.store.progress;await confirmImport(f,file);
 assert.deepEqual([...f.storage.values],before);assert.equal(f.ui.store.progress,oldProgress);assert.equal(f.ui.store.resumable().state,btoa('PREVIOUS_NATIVE_SAVE'));assert.equal(f.ui.fileImportInProgress,false);assert.equal(f.ui.fileBusy,false);assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.view,'home');assert.equal(f.ui.art.language.code,'en');assert(!f.calls.messages.includes('SAVE FILE LOADED.'));
}));
test('native initialization failure after commit rolls back progress and Continue',async()=>dom(async()=>{
 const f=fixture({startError:true}),file=await archiveFile(),before=[...f.storage.values];await confirmImport(f,file);assert.deepEqual([...f.storage.values],before);assert.equal(f.ui.fileImportInProgress,false);assert.equal(f.ui.fileBusy,false);assert.equal(f.ui.pendingScreen,null);assert.deepEqual(f.calls.loads,[]);
}));
test('late native-loader refusal in the polling path also rolls back a committed import',async()=>dom(async()=>{
 const f=fixture({ready:false,accept:false}),file=await archiveFile(),before=[...f.storage.values];await confirmImport(f,file);assert.equal(f.ui.pendingScreen.sent,false);assert.equal(f.ui.fileImportInProgress,true);assert.deepEqual(f.calls.loads,[]);
 f.ui.isReady=()=>true;f.ui.update(snapshot({activeRunArmed:0}),{map:true},{active:false});assert.deepEqual([...f.storage.values],before);assert.equal(f.ui.fileImportInProgress,false);assert.equal(f.ui.pendingScreen,null);assert.equal(f.ui.view,'home');assert.equal(f.calls.loads.length,1);
}));
test('invalid, oversized, and incompatible files never show confirmation or touch native loader',async()=>dom(async()=>{
 for(const file of [{size:MAX_SAVE_FILE_BYTES+1,text:async()=>{throw Error('must not read oversized file');}},{size:1,text:async()=>'{'}]){
  const f=fixture(),before=[...f.storage.values];await f.ui.importFile(file);assert.deepEqual([...f.storage.values],before);assert.equal(f.ui.dialog.active,false);assert.deepEqual(f.calls.loads,[]);assert.equal(f.ui.fileBusy,false);assert(!f.ui.fileImportInProgress);assert(f.calls.messages.includes('SAVE FILE IS INVALID OR DAMAGED.'));
 }
 const valid=await archiveFile(),value=JSON.parse(await valid.text());delete value.checksum;value.compatibility.engineSha256='0'.repeat(64);value.checksum='sha256-'+createHash('sha256').update(canonical(value)).digest('hex');const text=JSON.stringify(value),f=fixture(),before=[...f.storage.values];
 await f.ui.importFile({size:text.length,text:async()=>text});assert.deepEqual([...f.storage.values],before);assert.equal(f.ui.dialog.active,false);assert.deepEqual(f.calls.loads,[]);assert(f.calls.messages.includes('SAVE FILE IS FROM AN INCOMPATIBLE VERSION.'));
}));
test('storage import failure keeps previous Continue and never enters native transition',async()=>dom(async()=>{
 const f=fixture(),file=await archiveFile(),before=[...f.storage.values],set=f.storage.setItem;let writes=0;f.storage.setItem=(key,value)=>{if(++writes===2)throw Error('quota');return set(key,value);};await confirmImport(f,file);
 assert.deepEqual([...f.storage.values],before);assert.deepEqual(f.calls.loads,[]);assert.equal(f.ui.pendingScreen,null);assert(!f.ui.fileImportInProgress);assert(f.calls.messages.includes('BROWSER COULD NOT STORE SAVE FILE.'));
}));
test('Escape during native import cannot orphan its rollback callback or permanently disable autosave',async()=>dom(async()=>{
 const f=fixture(),file=await archiveFile(),before=f.storage.getItem(CONTINUE_KEY);await confirmImport(f,file);const importing=f.ui.pendingScreen;assert.equal(f.ui.fileImportInProgress,true);
 await f.ui.back();
 if(f.ui.pendingScreen===importing){f.ui.update(snapshot(),{map:true},{active:false});assert.equal(f.ui.fileImportInProgress,false);assert.equal(f.ui.store.resumable().state,payload);}
 else{assert.equal(f.ui.fileImportInProgress,false,'superseding imported load must reject/rollback its transaction');assert.equal(f.storage.getItem(CONTINUE_KEY),before);}
}));
test('autosave guard runs before native serialization throughout a pending file restore',()=>{
 const source=readFileSync(new URL('../web/shell.js',import.meta.url),'utf8'),saveSource=source.slice(source.indexOf('function saveGame('),source.indexOf('function loadPayload('));let serialized=0,queried=0;
 const context={ready:true,gameUI:{fileImportInProgress:true},nativeJSON(){queried++;return {};},Module:{_dune_save_state_to_buffer(){serialized++;}},browserStorage(){throw Error('must not write');}};
 assert.equal(vm.runInNewContext(saveSource+';saveGame(true)',context),false);assert.equal(serialized,0);assert.equal(queried,0);
});
test('precomputed export reaches iPhone sharing synchronously without another native save or awaited hashing',async()=>dom(async()=>{
 const f=fixture(),file=await archiveFile(),shares=[],previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'iPhone',canShare:()=>true,share:options=>(shares.push(options),Promise.resolve())}});
 try{f.ui.preparedSave={text:await file.text(),filename:file.filename};const operation=f.ui.exportFile();assert.equal(shares.length,1,'share must be invoked before exportFile returns');assert.deepEqual(f.calls.saves,[]);await operation;assert.equal(f.ui.fileBusy,false);}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
}));
