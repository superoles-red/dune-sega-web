// Development-only integration surface; no automatic save writes in ?qa.
// Fixtures are CPU states produced by the original native program, serialized
// with its normal v2 save routine. They are not part of the normal game launch.
const canvas=document.getElementById('canvas'),panel=document.createElement('aside');panel.id='qa-panel';panel.style.cssText='position:fixed;right:8px;top:8px;z-index:30;background:#181818e8;color:white;padding:8px;font:11px monospace;max-width:320px;max-height:180px;overflow:auto';
// Debug controls must not also reach SDL's window-level mouse listeners.
for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','touchstart','touchend','touchmove'])panel.addEventListener(type,e=>e.stopPropagation());
const output=document.createElement('output');output.id='qa-result';output.setAttribute('aria-hidden','true');output.style.cssText='display:block;white-space:pre-wrap;max-height:90px;overflow:auto;margin-top:5px';
const frameOutput=document.createElement('output');frameOutput.id='qa-frame';frameOutput.hidden=true;
function button(label,action){const b=document.createElement('button');b.textContent=label;b.style.cssText='margin:2px;padding:6px';b.onclick=action;panel.append(b);return b;}
const wait=ms=>new Promise(r=>setTimeout(r,ms)),state=id=>JSON.parse(document.getElementById(id).textContent||'{}');
const snapshot=()=>({native:state('native-state'),camera:state('camera-state'),layout:state('layout-state'),menu:state('menu-state'),actions:state('selection-state'),gesture:state('gesture-state'),environment:{width:innerWidth,height:innerHeight,canvasWidth:canvas.clientWidth,canvasHeight:canvas.clientHeight,dpr:devicePixelRatio}});
async function until(predicate,timeout=3500){const end=performance.now()+timeout;do{await wait(50);if(predicate())return true;}while(performance.now()<end);return false;}
function mouse(type,x,y,buttons=0){const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent(type,{clientX:r.left+x,clientY:r.top+y,button:0,buttons,bubbles:true,cancelable:true}));}
function key(type){window.dispatchEvent(new KeyboardEvent(type,{code:'Space',key:' ',bubbles:true,cancelable:true}));}
function world(x,y){const c=state('camera-state');return {x:(x-c.left)*c.scale,y:(y-c.top)*c.scaleY};}
function tap(x,y){mouse('mousedown',x,y,1);mouse('mouseup',x,y);}
async function worldTap(x,y){const p=world(x,y);tap(p.x,p.y);await wait(180);}
async function drag(from,to,hold=0){mouse('mousedown',from.x,from.y,1);for(let i=1;i<=8;i++){mouse('mousemove',from.x+(to.x-from.x)*i/8,from.y+(to.y-from.y)*i/8,1);await wait(12);}if(hold)await wait(hold);const during=snapshot();mouse('mouseup',to.x,to.y);await wait(250);return during;}
function buttonTap(id){const el=document.getElementById(id),r=el.getBoundingClientRect();for(const type of ['pointerdown','pointerup'])el.dispatchEvent(new PointerEvent(type,{pointerId:91,pointerType:'touch',clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true}));}
function menuPoint(nx,ny){const layout=state('layout-state');if(layout.active){for(const r of layout.regions)if(nx>=r.nativeX&&nx<r.nativeX+r.nativeWidth&&ny>=r.nativeY&&ny<r.nativeY+r.nativeHeight)return {x:r.x+(nx-r.nativeX)*r.scale,y:r.y+(ny-r.nativeY)*r.scale};throw new Error('Native point outside portrait crops');}const c=state('camera-state');return {x:c.uiX+nx*c.uiScale,y:c.uiY+ny*c.uiScale};}
async function fixture(name){const M=window.Module;if(!M?._dune_web_actions_debug)throw new Error('New WASM is not ready');const response=await fetch('qa-fixtures/'+name+'.bin');if(!response.ok)throw new Error('Missing local QA fixture');const bytes=new Uint8Array(await response.arrayBuffer());M._dune_web_placement_cancel();M.HEAPU8.set(bytes,M._dune_get_save_buffer());if(!M._dune_load_state_from_buffer(bytes.length))throw new Error('Fixture was rejected');M._dune_web_selection_reset();M._dune_web_menu_select_reset?.();M._dune_web_rebase();await wait(180);canvas.focus();}
const results=[];function check(pass,name,data){results.push({name,pass:!!pass,data});output.textContent=JSON.stringify({running:true,results});if(!pass)throw new Error(name);}
async function run(){results.length=0;
 try{
  await fixture('baseline');let before=snapshot();check(before.camera.map===1,'native baseline map',before);
  key('keydown');key('keyup');await wait(180);before=snapshot();
  await drag({x:canvas.clientWidth*.45,y:canvas.clientHeight*.6},{x:canvas.clientWidth*.45+55,y:canvas.clientHeight*.6-20});let after=snapshot();
  check(after.gesture.taps===before.gesture.taps&&(after.camera.cameraX!==before.camera.cameraX||after.camera.cameraY!==before.camera.cameraY),'map drag without order',after);check(Math.abs(after.camera.minimap.viewX-before.camera.minimap.viewX)>.1,'minimap visible-area frame follows presentation camera',after.camera.minimap);
  before=after;mouse('mousemove',2,canvas.clientHeight*.45);await wait(250);after=snapshot();check(after.camera.cameraX===before.camera.cameraX&&after.camera.cameraY===before.camera.cameraY,'hover has no edge scrolling',after.camera);
  await fixture('baseline');key('keydown');key('keyup');await wait(150);await worldTap(720,1104);after=snapshot();check(after.actions.selected.kind==='unit'&&after.actions.selected.id===33,'single native unit selection',after.actions);
  check(!document.getElementById('context-actions').hidden&&document.getElementById('native-action').hidden,'unit has clear button without extra action',after.actions);check(after.camera.cursorHidden===1,'ordinary cursor hidden even for selected unit',after.camera);
  const clearRect=document.getElementById('clear-selection').getBoundingClientRect();document.getElementById('clear-selection').dispatchEvent(new MouseEvent('mousemove',{clientX:clearRect.left+clearRect.width/2,clientY:clearRect.top+clearRect.height/2,bubbles:true}));await wait(120);after=snapshot();check(after.camera.cursorHidden===1&&after.actions.selected.id===33,'hover over clear button never exposes the ordinary cursor',after);
  before=after;const mini=before.camera.minimap;tap(mini.x+mini.width*.65,mini.y+mini.height*.3);await wait(180);after=snapshot();check(after.actions.selected.pointer===before.actions.selected.pointer&&after.gesture.taps===before.gesture.taps&&(after.camera.cameraX!==before.camera.cameraX||after.camera.cameraY!==before.camera.cameraY),'minimap tap moves view without changing native selection or sending A',after);
  before=after;const mm=after.camera.minimap;await drag({x:mm.x+mm.width*.6,y:mm.y+mm.height*.3},{x:mm.x+mm.width*.4,y:mm.y+mm.height*.65});after=snapshot();check(after.actions.selected.pointer===before.actions.selected.pointer&&after.gesture.taps===before.gesture.taps&&after.camera.cameraY!==before.camera.cameraY,'minimap drag moves only the overview and preserves the selected unit',after);
  await fixture('baseline');key('keydown');key('keyup');await wait(150);await worldTap(720,1104);
  buttonTap('clear-selection');await until(()=>state('selection-state').selected?.kind==='none');after=snapshot();check(after.actions.selected.kind==='none'&&after.native.manualPaused===0,'bottom clear only deselects, no pause',after);
  await worldTap(784,1136);await worldTap(784,1136);await until(()=>state('camera-state').context===2);after=snapshot();check(after.camera.context===2,'original building menu opens',after.camera);
  const c=after.camera;let point=menuPoint(112,60);tap(point.x,point.y);await wait(90);check(state('camera-state').context===2,'direct disabled STOP retains original menu',snapshot());
  point=menuPoint(48,60);tap(point.x,point.y);await until(()=>state('camera-state').map===1);check(state('camera-state').map===1,'direct EXIT returns to map',snapshot());
  await fixture('ready-yard');before=snapshot();check(before.actions.readyYard===1,'paid ready Windtrap fixture',before.actions);check(before.camera.cursorHidden===1,'ready building waits without an idle footprint',before);
  const source=world(784,1136);const during=await drag(source,{x:canvas.clientWidth*.22,y:4},850);check(during.camera.cursorHidden===0&&during.actions.placementActive,'original coloured footprint visible only during carried drag',during);await until(()=>state('selection-state').lastPlacementOutcome==='rejected');after=snapshot();
  check(after.gesture.edgePans>before.gesture.edgePans&&after.camera.cameraY<before.camera.cameraY,'carried building scrolls camera at edge',after);
  check(after.actions.lastPlacementOutcome==='rejected'&&after.actions.placementAttempts===1&&after.actions.selected.kind==='none'&&after.camera.cursorHidden===1,'invalid drop native reject then clear and hide footprint',after.actions);
  await fixture('ready-yard');before=snapshot();await drag(world(784,1136),world(784,1200));await until(()=>state('selection-state').lastPlacementOutcome==='placed');after=snapshot();
  check(after.actions.lastPlacementOutcome==='placed'&&after.actions.placementAttempts===1&&after.actions.placementSuccesses===1,'drag performs one real native placement',after.actions);
  check(after.native.fault===0&&after.native.manualPaused===0,'native runtime healthy',after.native);
  output.textContent=JSON.stringify({running:false,pass:true,results,final:after});
 }catch(error){output.textContent=JSON.stringify({running:false,pass:false,error:error.message,results,final:snapshot()});}
}
async function openShop(){await fixture('baseline');await worldTap(784,1136);await worldTap(784,1136);if(!await until(()=>state('camera-state').context===2))throw new Error('Building menu did not open');await wait(100);}
async function runShop(){results.length=0;
 try{
  await openShop();let before=snapshot(),after;
  check(before.camera.context===2&&Number.isFinite(before.menu.credits),'original building menu with purchase telemetry',before);
  const layout=before.layout;
  if(innerHeight>innerWidth){
   check(layout.active&&layout.regions.length===3,'portrait menu contains three original parts',layout);
   const commands=layout.regions.find(r=>r.nativeX===24&&r.nativeY===40);
   const top=layout.regions.filter(r=>r!==commands);
   check(commands&&commands.width>innerWidth*.70&&Math.abs(commands.y+commands.height-canvas.clientHeight)<2,'command frame enlarged and docked to bottom',layout);
   check(top.length===2&&Math.abs(top[0].y-top[1].y)<1&&Math.abs(top[0].height-top[1].height)<1&&top[0].x+top[0].width<=top[1].x+1&&top.every(r=>Math.abs(r.y+r.height-commands.y)<1),'two information parts joined above commands without overlap',layout);
   const gap=commands.x/2;
   if(gap>1){const confirmations=before.menu.confirmations;tap(gap,commands.y+commands.height*.5);await wait(120);after=snapshot();check(after.menu.confirmations===confirmations&&after.camera.context===2,'black side field has no hidden original button',after);}
  }else check(!layout.active,'landscape keeps the original complete building screen',layout);
  let p=menuPoint(112,60);tap(p.x,p.y);await wait(120);after=snapshot();
  check(after.camera.context===2&&after.menu.confirmations===before.menu.confirmations+1,'STOP command uses one tap and original disabled guard',after);
  check(after.menu.selectionSoundRequests===before.menu.selectionSoundRequests+1,'command selection requests one original interface sound',after.menu);
  before=after;p=menuPoint(80,84);tap(p.x,p.y);await wait(200);after=snapshot();
  check(after.camera.context===2&&after.menu.item===9&&after.menu.previewArmed,'first Windtrap tap shows original information',after);
  check(after.menu.credits===before.menu.credits&&after.menu.product===before.menu.product&&after.menu.confirmations===before.menu.confirmations,'first purchase tap spends nothing and does not start production',after);
  check(after.menu.selectionSoundRequests===before.menu.selectionSoundRequests+1,'first purchase preview requests one original interface sound',after.menu);
  await wait(1300);after=snapshot();check(after.camera.context===2&&after.menu.previewArmed&&after.menu.confirmations===before.menu.confirmations&&after.menu.product===before.menu.product,'preview persists while the player reads information',after);before=after;
  p=menuPoint(48,84);tap(p.x,p.y);await wait(160);after=snapshot();
  check(after.camera.context===2&&after.menu.item===1&&after.menu.previewArmed&&after.menu.credits===before.menu.credits&&after.menu.confirmations===before.menu.confirmations,'changing product previews the new item without purchase',after);
  p=menuPoint(80,84);tap(p.x,p.y);await wait(160);after=snapshot();
  check(after.camera.context===2&&after.menu.item===9&&after.menu.confirmations===before.menu.confirmations,'returning to a previous product is still a preview',after);
  const previewSoundRequests=after.menu.selectionSoundRequests;
  tap(p.x,p.y);await until(()=>state('camera-state').map===1&&state('menu-state').product===9);after=snapshot();
  check(after.camera.map===1&&after.menu.product===9&&after.menu.confirmations===before.menu.confirmations+1,'second tap issues exactly one original construction confirmation',after);
  check(after.menu.selectionSoundRequests===previewSoundRequests,'purchase confirmation does not replay the selection sound',after.menu);
  await until(()=>state('menu-state').credits<before.menu.credits);after=snapshot();check(after.menu.credits<before.menu.credits&&after.native.fault===0,'native production spends credits after confirmation and stays healthy',after);
  await openShop();before=snapshot();p=menuPoint(80,84);tap(p.x,p.y);await wait(140);p=menuPoint(48,60);tap(p.x,p.y);await until(()=>state('camera-state').map===1);after=snapshot();
  check(after.camera.map===1&&after.menu.credits===before.menu.credits&&after.menu.confirmations===before.menu.confirmations+1,'EXIT remains one tap after preview and never purchases',after);
  // The original EXIT task finishes after the map callback becomes visible.
  // Match the native regression's settling window, measured in game frames;
  // this is QA synchronization and adds no delay to the shipping controls.
  const exitFrame=after.native.frames;await until(()=>state('native-state').frames>=exitFrame+150,6000);
  if(!await until(()=>state('menu-state').mapInputReady))throw new Error('Original map input gate did not reopen');
  await worldTap(784,1136);
  if(!await until(()=>state('camera-state').context===2,2000))await worldTap(784,1136);
  if(!await until(()=>state('camera-state').context===2))throw new Error('Yard did not reopen after EXIT');
  await wait(100);before=snapshot();p=menuPoint(80,84);tap(p.x,p.y);await wait(180);after=snapshot();
  check(after.camera.context===2&&after.menu.previewArmed&&after.menu.confirmations===before.menu.confirmations&&after.menu.credits===before.menu.credits,'re-entered shop requires a fresh preview',after);
  output.textContent=JSON.stringify({running:false,pass:true,results,final:after});
 }catch(error){output.textContent=JSON.stringify({running:false,pass:false,error:error.message,results,final:snapshot()});}
}
button('Проверить управление',run);button('Проверить магазин',runShop);button('Открыть магазин',openShop);button('Исходная миссия',()=>fixture('baseline'));button('Готовая постройка',()=>fixture('ready-yard'));button('Кадр игры',()=>requestAnimationFrame(()=>{frameOutput.textContent=canvas.toDataURL('image/png');}));button('Скрыть проверку',()=>{panel.hidden=true;});panel.append(output);document.body.append(panel,frameOutput);
