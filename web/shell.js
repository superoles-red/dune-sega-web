import {MapGestures,placementEdgeVelocity} from './gestures.mjs?v=20261105-webapp2';
import {bindMapInput} from './map-input.mjs?v=20261105-webapp2';
import {OrderInput} from './order-input.mjs?v=20261105-webapp2';
import {NativeArt} from './native-ui.mjs?v=20261105-webapp2';
import {GameInterface} from './game-ui.mjs?v=20261105-webapp2';
import {validHouse,validMission} from './campaign-state.mjs';
import {contextAction} from './context-action.mjs?v=20261105-webapp2';
import {OrderFeedback} from './order-feedback.mjs?v=20261105-webapp2-palace';
import {NativeAudioBridge} from './native-audio.mjs';
import {BrowserFeatures} from './browser-features.mjs?v=20261105-webapp2';
import {bindAppViewport,showFullscreenControl} from './viewport.mjs?v=20261105-webapp2';

// Input and presentation only. The original Sega handlers decide every game action.
const canvas=document.getElementById('canvas');
const actionPanel=document.getElementById('context-actions');
const actionButton=document.getElementById('native-action');
const menuButton=document.getElementById('native-menu');
const fullscreenButton=document.getElementById('global-fullscreen');
const status=document.getElementById('status');
const startup=window.duneStartup;
const SAVE_KEY='dune-original-aot-state-v2';
const params=new URLSearchParams(location.search),qaMode=params.has('qa'),legacyMode=params.has('legacy'),inputCheckMode=params.has('inputcheck');
let gameUI=null,art=null,enginePromise=null,resolveEngine,rejectEngine,actionView=null;
function browserStorage(){try{return qaMode?sessionStorage:localStorage;}catch{return {getItem:()=>null,setItem:()=>{throw Error('Хранилище браузера недоступно');}};}}
let mapInput=null,inputCheck=null,lastMapTap=null,latestCamera={};
let started=false,ready=false,bootstrapPaused=false,messageTimer,lastSize='',queuedResize=false;
let lastGesture='idle',lastEdgeTime=0,latestActions={},lastActionKind='',lastCanvasVisible=null;
const counters={taps:0,selectRequests:0,commandRequests:0,panEvents:0,zooms:0,placementDrags:0,edgePans:0,clearRequests:0,bRequests:0};
const orderFeedback=new OrderFeedback({canvas});
const platform=new BrowserFeatures();
const fullscreenDisplay=window.matchMedia?.('(display-mode: fullscreen)');
function syncFullscreenControl(){const visible=!!art?.ready&&showFullscreenControl({state:platform.snapshot(),displayFullscreen:!!fullscreenDisplay?.matches}),mode=visible?'visible':'hidden';if(fullscreenButton.hidden===visible)fullscreenButton.hidden=!visible;if(document.body.dataset.fullscreenControl!==mode)document.body.dataset.fullscreenControl=mode;}
const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
function resumeAudio(){nativeAudio.resume();}
function tell(text){document.getElementById('message').textContent=text;clearTimeout(messageTimer);messageTimer=setTimeout(()=>{document.getElementById('message').textContent='';},2500);}
function nativeJSON(name,...args){try{return ready&&Module[name]?JSON.parse(Module.UTF8ToString(Module[name](...args))):{};}catch{return {};}}
function query(x,y){return ready&&!gameUI?.capturesInput?(Module._dune_web_gesture_query?.(x,y)??0):0;}
function resizeGame(){if(queuedResize)return;queuedResize=true;requestAnimationFrame(()=>{queuedResize=false;const r=canvas.getBoundingClientRect(),key=Math.round(r.width)+':'+Math.round(r.height);if(ready&&key!==lastSize){orders.cancel();lastSize=key;Module._dune_web_resize?.(Math.round(r.width),Math.round(r.height));}});}
function cancelGesture(){mapInput?.reset();gestures.cancel();orders.cancel();if(ready)Module._dune_web_end?.();lastEdgeTime=0;}
function clearSelection(){if(!ready)return;cancelGesture();orderFeedback.clear();Module._dune_web_placement_cancel?.();counters.clearRequests++;Module._dune_web_clear_selection?.();pollState();}
function nativeAction(){if(!ready)return;const action=contextAction(latestActions);if(!action)return;cancelGesture();resumeAudio();counters.bRequests++;Module._dune_web_action_b?.();pollState();}
function beginPointer(id,p,kind){if(!ready||gameUI?.capturesInput)return false;orderFeedback.setPointerKind(kind);resumeAudio();if(query(p.x,p.y)===1)orderFeedback.aimAt(p.x,p.y);canvas.focus({preventScroll:true});if(!gestures.points.size)Module._dune_web_begin?.(p.x,p.y);gestures.down({id,...p,kind});return true;}
function endPointer(id,p){gestures.up({id,...p});if(query(p.x,p.y)===1)orderFeedback.releaseAim(p.x,p.y);else orderFeedback.releaseAim();if(!gestures.points.size)Module._dune_web_end?.();}
const orders=new OrderInput({
 readState:(x,y)=>{const hit=nativeJSON('_dune_web_target_screen',x,y);return {...hit.inputActor,context:hit.context,capturesInput:!ready||!!gameUI?.capturesInput};},
 captureActor:()=>ready?(Module._dune_web_actor_capture?.()??0):0,
 select:(x,y)=>{counters.selectRequests++;return Module._dune_web_select_screen?.(x,y)??0;},
 command:(x,y,token)=>{counters.commandRequests++;return Module._dune_web_command_screen?.(x,y,token)??0;},
});
function mapTap(x,y,kind='mouse',button=0){
 if(!ready||gameUI?.capturesInput)return;
 counters.taps++;orderFeedback.setPointerKind(kind);orderFeedback.aimAt(x,y);resumeAudio();Module._dune_web_end?.();
 let result,intent;
 if(legacyMode){orders.cancel();result=button===0?Module._dune_web_selection_tap_screen?.(x,y):0;intent='legacy';}
 else if(query(x,y)===2){orders.cancel();result=button===0?Module._dune_web_select_screen?.(x,y):0;intent='native-ui';}
 else{result=orders.tap(x,y,kind,button);intent=orders.snapshot().lastAction;}
 if(inputCheckMode)lastMapTap={x,y,kind,button,intent,result:result??null};
 // A queue acceptance is not an attack/move decision. The read-only native
 // commit observer supplies its actual D4 action and target to pollState.
}
const gestures=new MapGestures({
  canPanAt:(x,y)=>query(x,y)===1,
  minimapStart:(x,y)=>ready&&Module._dune_web_minimap_begin?.(x,y),
  minimapMove:(x,y)=>Module._dune_web_minimap_move?.(x,y),
  tap:mapTap,
  pan:(dx,dy)=>{if(!ready)return;orderFeedback.panAim();counters.panEvents++;Module._dune_web_pan?.(dx,dy);},
  zoom:(factor,x,y)=>{if(!ready)return;orderFeedback.panAim();counters.zooms++;Module._dune_web_zoom?.(factor,x,y);},
  placementStart:(x,y)=>{const ok=ready&&(Module._dune_web_placement_begin?.(x,y)??0);if(ok)counters.placementDrags++;return !!ok;},
  placementMove:(x,y)=>Module._dune_web_placement_move?.(x,y),
  placementEnd:(x,y)=>Module._dune_web_placement_end?.(x,y),
  placementCancel:()=>Module._dune_web_placement_cancel?.(),
  state:mode=>{lastGesture=mode;if(['pan','pinch','place','minimap','blocked'].includes(mode))orders.cancel();document.body.classList.toggle('dragging',mode==='pan');document.body.classList.toggle('placing',mode==='place');},
});
// One PointerEvent stream owns mouse/touch/pen before SDL sees compatibility
// mouse events. A click is committed only on the real pointer release.
mapInput=bindMapInput(canvas,{
  begin:beginPointer,move:(id,p)=>gestures.move({id,...p}),end:endPointer,
  cancel:cancelGesture,hover:(p,kind)=>{orderFeedback.setPointerKind(kind);if(query(p.x,p.y)===1)orderFeedback.aimAt(p.x,p.y);},position:local,
  command:(p,kind)=>mapTap(p.x,p.y,kind,2),
});
canvas.addEventListener('wheel',e=>{stop(e);const p=local(e);if(query(p.x,p.y)!==1||gestures.points.size)return;orders.cancel();const unit=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1;const factor=Math.exp(-Math.max(-240,Math.min(240,e.deltaY*unit))*(e.ctrlKey?.006:.002));orderFeedback.panAim();counters.zooms++;Module._dune_web_zoom?.(factor,p.x,p.y);orderFeedback.releaseAim(p.x,p.y);},{capture:true,passive:false});

function bindButton(button,action){
  // Standard HTML click owns the action. Keep NativeArt's same-element visual
  // listeners and browser click synthesis; stop only propagation to SDL.
  for(const name of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','touchstart','touchmove','touchend'])button.addEventListener(name,e=>e.stopPropagation(),{passive:true});
  button.addEventListener('pointerdown',resumeAudio);
  button.addEventListener('click',e=>{e.stopPropagation();if(button.disabled)return;resumeAudio();button._nativeArtView?.pulse();action();});
  button.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();});
}
function pulseStart(){if(!ready)return;resumeAudio();cancelGesture();if(!legacyMode&&Module._dune_web_campaign_input)Module._dune_web_campaign_input(0,128);else{Module._dune_web_pad(128,1);setTimeout(()=>Module._dune_web_pad?.(128,0),140);}canvas.focus({preventScroll:true});}
bindButton(actionButton,nativeAction);bindButton(fullscreenButton,()=>gameUI?.toggleFullscreen());bindButton(menuButton,()=>{if(!legacyMode&&gameUI){cancelGesture();gameUI.openPause();}else pulseStart();});
function saveGame(silent=false){
  if(!ready||gameUI?.demoMode||gameUI?.trainingMode||gameUI?.fileImportInProgress)return false;
  const run=nativeJSON('_dune_web_campaign_json');
  if(!run.activeRunArmed||run.fault||run.pending||run.routePending||run.uiCallActive||!run.sceneReady||!['map','building','pause'].includes(run.scene)||!validHouse(run.activeRunHouse)||!validMission(run.activeRunMission))return false;
  try{const size=Module._dune_save_state_to_buffer();if(size<=0||size>256*1024)return false;
    const ptr=Module._dune_get_save_buffer(),bytes=Module.HEAPU8.subarray(ptr,ptr+size);let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const value=btoa(binary);if(legacyMode)browserStorage().setItem(SAVE_KEY,value);else if(!gameUI?.store.saveSlot(run.activeRunHouse,run.activeRunMission,value))throw Error('Браузер не разрешил записать сохранение');if(!silent)tell('Игра сохранена.');return true;
  }catch(e){if(!silent)tell(`Сохранение недоступно: ${e.message}`);return false;}
}
function loadPayload(value,silent=false){
  if(!ready||!value)return false;
  try{
    const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0)),ptr=Module._dune_get_save_buffer();
    if(bytes.length>256*1024||bytes.length>Module.HEAPU8.length-ptr)throw new Error('Сохранение повреждено');
    cancelGesture();orderFeedback.clear({reset:true});Module.HEAPU8.set(bytes,ptr);
    if(!Module._dune_load_state_from_buffer(bytes.length))throw new Error('Сохранение не подходит к этой сборке');
    Module._dune_web_selection_reset?.();Module._dune_web_menu_select_reset?.();Module._dune_web_rebase?.();if(gameUI){gameUI.frame.valid=false;gameUI.building.frame.valid=false;gameUI.building.key='';}if(!silent)tell('Игра загружена.');return true;
  }catch(e){if(!silent)tell(e.message);return false;}
}
function loadGame(silent=false){
  if(!ready)return false;
  let slot=null;try{if(!legacyMode){const p=gameUI?.store.progress;slot=gameUI?.store.resumable();}}
  catch{}
  let value=slot?.state||gameUI?.store.legacy();if(!value&&legacyMode)try{value=browserStorage().getItem(SAVE_KEY);}catch{}
  if(!legacyMode&&gameUI){if(!value)return false;return gameUI.resumeSlot({state:value},{saveCurrent:false});}
  const ok=loadPayload(value,silent);if(ok&&gameUI){gameUI.demoMode=false;gameUI.resuming=true;gameUI.view='native';gameUI.lastNativeKey='';gameUI.bootTarget=null;pollState();}return ok;
}
const Module=window.Module={
  canvas,locateFile:name=>'engine/'+name+(name.endsWith('.wasm')?'?v=319b76fc26e77cbb':'?v=20261105-webapp2'),
  print:(...args)=>console.log(...args),printErr:(...args)=>console.warn(...args),
  setStatus:text=>{status.textContent=text;if(text)startup?.engine();},
  onRuntimeInitialized:()=>{},
  postRun:[()=>{ready=true;if(!legacyMode&&!gameUI){bootstrapPaused=true;Module._dune_web_set_paused?.(1);}Module._dune_web_native_video?.(legacyMode?1:0);Module._dune_web_set_hidden?.(document.hidden?1:0);if(legacyMode){document.getElementById('launch').hidden=true;loadGame(true);canvas.focus();}resizeGame();Module._dune_web_rebase?.();nativeAudio.start();resolveEngine?.();pollState();}],
  onAbort:reason=>{ready=false;status.textContent=`Не удалось запустить игру: ${reason}`;rejectEngine?.(Error(status.textContent));startup?.fail();if(legacyMode||!gameUI)document.getElementById('launch').hidden=false;else tell(status.textContent);},
};
const nativeAudio=new NativeAudioBridge({Module});
function startEngine(){
 if(ready)return Promise.resolve();if(enginePromise)return enginePromise;
 enginePromise=new Promise((resolve,reject)=>{resolveEngine=resolve;rejectEngine=reject;});started=true;
 status.textContent='Подготовка оригинальной игры…';document.getElementById('start').disabled=true;
 const script=document.createElement('script');script.src='engine/dune_web.js?v=20261105-webapp2';script.onerror=()=>{status.textContent='Не удалось загрузить сборку.';rejectEngine?.(Error(status.textContent));};document.body.appendChild(script);return enginePromise;
}
try{if(localStorage.getItem(SAVE_KEY))document.getElementById('start').textContent='Продолжить игру';}catch{}
document.getElementById('start').onclick=()=>startEngine().catch(e=>tell(e.message));

window.addEventListener('keydown',e=>{if(e.target.closest?.('#qa-modern-panel'))return;if(gameUI?.fileImportInProgress){stop(e);return;}resumeAudio();if(e.code==='F5'){stop(e);saveGame();return;}if(e.code==='F8'){stop(e);if(!gameUI?.tutorial?.active)loadGame();return;}
 if(['Enter','Space'].includes(e.code)&&e.target instanceof HTMLButtonElement){stop(e);if(!e.repeat&&!e.target.disabled&&!gameUI?.curtain.active)e.target.click();return;}
 if(gameUI?.tutorial?.active){gameUI.tutorial.key(e);if(e.defaultPrevented){stop(e);return;}}
 if(gameUI?.capturesInput){if(e.code==='Escape'){stop(e);if(!e.repeat)gameUI.back();return;}if(['Enter','Space'].includes(e.code)&&e.target instanceof HTMLButtonElement){stop(e);if(!e.repeat&&!e.target.disabled)e.target.click();return;}e.stopImmediatePropagation();return;}
 if(e.code==='Space'){stop(e);if(!e.repeat)clearSelection();return;}
 if(['KeyZ','KeyX','KeyC','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.code)){stop(e);return;}if(e.code==='Tab')e.stopImmediatePropagation();if(e.code==='Enter'&&e.target instanceof HTMLButtonElement)e.stopImmediatePropagation();},true);
window.addEventListener('keyup',e=>{if(e.target.closest?.('#qa-modern-panel'))return;if(gameUI?.capturesInput){if(['Enter','Space'].includes(e.code))stop(e);else e.stopImmediatePropagation();return;}if(e.code==='Space'){stop(e);return;}if(['KeyZ','KeyX','KeyC','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Tab'].includes(e.code))e.stopImmediatePropagation();if(e.code==='Enter'&&e.target instanceof HTMLButtonElement)e.stopImmediatePropagation();},true);
window.addEventListener('blur',cancelGesture);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelGesture();if(!qaMode){pollState();saveGame(true);}}if(ready)Module._dune_web_set_hidden?.(document.hidden?1:0);});
window.addEventListener('pagehide',()=>{cancelGesture();if(!qaMode){pollState();saveGame(true);}});
const icons={
  repeat:'<path d="M22 10a9 9 0 1 0 1 8M22 4v7h-7"/><path d="M10 10h7v8h-7z"/>',
  'confirm-devastator':'<path d="m14 2 2 7 6-4-3 7 7 2-7 3 3 7-6-4-2 7-3-7-6 4 3-7-7-3 7-2-3-7 6 4Z"/>',
  'confirm-mcv':'<path d="M4 24V13l10-7 10 7v11H4Zm6 0v-8h8v8M14 2v4M5 4l4 4M23 4l-4 4"/>'
};
const labels={repeat:'Повторить производство', 'confirm-devastator':'Подтвердить самоподрыв — оригинальная B', 'confirm-mcv':'Подтвердить развёртывание — оригинальная B'};
function pollState(){
  const camera=nativeJSON('_dune_web_camera_debug');if(inputCheckMode)latestCamera=camera;latestActions=nativeJSON('_dune_web_actions_debug');
  const campaign=nativeJSON('_dune_web_campaign_json'),needsBuilding=campaign.scene==='building'||gameUI?.building.active,
   building=needsBuilding?nativeJSON('_dune_web_building_ui_json'):{active:false};
  if(qaMode){
   document.getElementById('native-state').textContent=JSON.stringify({...nativeJSON('_dune_web_debug'),browserAudio:nativeAudio.snapshot()});
   document.getElementById('camera-state').textContent=JSON.stringify(camera);
   document.getElementById('layout-state').textContent=JSON.stringify(nativeJSON('_dune_web_portrait_debug'));
   document.getElementById('selection-state').textContent=JSON.stringify(latestActions);
   document.getElementById('menu-state').textContent=JSON.stringify(nativeJSON('_dune_web_menu_select_debug'));
   document.getElementById('gesture-state').textContent=JSON.stringify({mode:lastGesture,...counters,orderFeedback:orderFeedback.debug()});
  }
  gameUI?.update(campaign,camera,building);
  if(gameUI?.capturesInput)orders.cancel();
  if(!legacyMode)orderFeedback.observe(latestActions,{blocked:!ready||!!gameUI?.capturesInput});
  if(qaMode){document.getElementById('campaign-state').textContent=JSON.stringify(campaign);document.getElementById('building-ui-state').textContent=JSON.stringify(building);document.getElementById('interface-state').textContent=JSON.stringify(gameUI?.debug()||{});}
  const canvasVisible=legacyMode||!gameUI||gameUI.element.hidden&&!gameUI.building.active&&!gameUI.tutorial?.active;if(ready&&canvasVisible!==lastCanvasVisible){lastCanvasVisible=canvasVisible;Module._dune_web_canvas_visible?.(canvasVisible?1:0);}
  menuButton.hidden=!ready||!camera.map||!!gameUI?.capturesInput;
  syncFullscreenControl();
  const action=contextAction(latestActions);actionPanel.hidden=!!gameUI?.capturesInput||!camera.map||!action;actionButton.hidden=!action;
  const kind=action?.kind||'none';if(kind!==lastActionKind){lastActionKind=kind;actionButton.dataset.action=kind;actionButton.setAttribute('aria-label',action?.aria||'Особое действие');actionButton.title=action?.aria||'';if(actionView)actionView.update(action?.label||'ACTION',{ariaLabel:action?.aria||'Особое действие'});else actionButton.textContent=action?.label||'ACTION';}
  inputCheck?.refresh();

}
function placementFrame(now){
  requestAnimationFrame(placementFrame);gameUI?.render(now);
  if(orderFeedback.active){const camera=nativeJSON('_dune_web_camera_debug');orderFeedback.render(now,camera,{blocked:!ready||!!gameUI?.capturesInput});}
  const dt=lastEdgeTime?Math.min(.05,(now-lastEdgeTime)/1000):0;lastEdgeTime=now;
  if(!ready||gestures.mode!=='place')return;
  const p=gestures.points.get(gestures.primary);if(!p)return;
  const vx=placementEdgeVelocity(p.x,canvas.clientWidth),vy=placementEdgeVelocity(p.y,canvas.clientHeight);
  if(dt&&(vx||vy)){Module._dune_web_pan?.(-vx*dt,-vy*dt);counters.edgePans++;}
  Module._dune_web_placement_move?.(p.x,p.y);
}
if(inputCheckMode)import('./input-check.mjs?v=20261105-webapp2').then(({mountInputCheck})=>{
 inputCheck=mountInputCheck({canvas,read:()=>({taps:counters.taps,selectRequests:counters.selectRequests,commandRequests:counters.commandRequests,pan:counters.panEvents,mode:gestures.mode,lastTap:lastMapTap,lastOrder:latestActions.lastOrder,special:latestActions.special,unitSpecial:latestActions.unitSpecial,bAvailable:latestActions.bAvailable,bKind:latestActions.bKind,orders:orders.snapshot(),selected:{kind:latestActions.selected?.kind||'none',id:latestActions.selected?.id,type:latestActions.selected?.type},ready,capturesInput:!!gameUI?.capturesInput,camera:{map:latestCamera.map,css:[latestCamera.cssWidth,latestCamera.cssHeight],output:[latestCamera.outputWidth,latestCamera.outputHeight],left:latestCamera.left,top:latestCamera.top,scale:latestCamera.scale,queued:latestCamera.queuedClicks}})});
}).catch(e=>console.warn('Input diagnostic unavailable:',e.message));
setInterval(pollState,50);if(!qaMode)setInterval(()=>saveGame(true),30000);
bindAppViewport({onResize:resizeGame});resizeGame();requestAnimationFrame(placementFrame);
if(legacyMode){document.getElementById('launch').hidden=false;if(qaMode)import('./qa.mjs');}
else (async()=>{try{
 // Decode the native runtime while the original PNG interface is loading.
 // If compilation wins the race, hold only this fresh boot until its interface
 // exists: the full original intro is then visible, without a raw-menu flash.
 startEngine().catch(e=>{console.warn('Background engine preload failed:',e);startup?.fail();tell(e.message);});
 art=await new NativeArt({storage:browserStorage()}).load({onProgress:state=>startup?.progress(state)});
 await startup?.stylesReady();
 gameUI=new GameInterface({art,Module,storage:browserStorage(),startEngine,isReady:()=>ready,resumeAudio,saveCurrent:saveGame,loadPayload,tell,platform,cancelGesture});
 if(bootstrapPaused){bootstrapPaused=false;Module._dune_web_set_paused?.(0);}
 await gameUI.loadCampaign();art.decorate(menuButton,'MENU',{ariaLabel:'Пауза — меню игры (Start)'});const fullscreenView=art.decorate(fullscreenButton,'',{ariaLabel:'FULL SCREEN'});platform.subscribe(s=>fullscreenView.update('',{ariaLabel:s.fullscreen?'EXIT FULL SCREEN':'FULL SCREEN'}));syncFullscreenControl();actionView=art.decorate(actionButton,'REPEAT',{ariaLabel:'Повторить производство'});
 if(startup)startup.finish();else document.getElementById('launch').hidden=true;pollState();
 orderFeedback.load().catch(e=>console.warn('Original order feedback unavailable:',e.message));
 if(qaMode){const {installModernQA}=await import('./qa-modern.mjs');await installModernQA({Module,startEngine,loadPayload,ui:gameUI,pollState});}
}catch(e){console.error(e);status.textContent='Не удалось подготовить интерфейс: '+e.message;startup?.fail();document.getElementById('launch').hidden=false;}})();
