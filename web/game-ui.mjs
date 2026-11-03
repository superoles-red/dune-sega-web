import {CampaignStore,HOUSE_NAMES,validHouse,validMission,canStart} from './campaign-state.mjs';
import {BuildingInterface} from './building-ui.mjs?v=20261103-safari6';
import {LiveNativeFrame,dragScroll} from './native-ui.mjs?v=20261103-safari6';
import {ScreenTransition} from './screen-transition.mjs';
import {NativeConfirmation} from './confirm-dialog.mjs';
import {displayMissionName} from './campaign-names.mjs';
import {drawOptionsScene} from './options-layout.mjs';
import {LANGUAGES} from './i18n.mjs';
import {drawLocalizedResults,drawLocalizedSceneLabels} from './localized-results.mjs';

const STORY=new Set(['house_briefing','briefing','victory','defeat']);
const SEQUENCE=new Set([...STORY,'tutorial','loading','campaign','victory_movie','defeat_movie','results','ending','credits']);
const presentationReady=s=>s?.presentationReady===true||s?.sceneReady===true;
const terminal=s=>s?.outcomeTerminal===true;
const TITLE={boot:'DUNE',title:'DUNE',main:'DUNE',house:'CHOOSE YOUR HOUSE',campaign:'ARRAKIS',house_briefing:'YOUR HOUSE',briefing:'MISSION BRIEFING',victory_movie:'VICTORY',victory:'VICTORY',defeat_movie:'DEFEAT',defeat:'DEFEAT',results:'MISSION RESULTS',ending:'DUNE',credits:'CREDITS',options:'OPTIONS',pause:'PAUSE',confirm:'CONFIRM',loading:'ARRAKIS',tutorial:'TUTORIAL'};
const cleanText=s=>String(s??'').replace(/\r/g,'\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
const ROUTE={main:0,options:1,tutorial:2,pause:3,map:4};
const ready=s=>s?.sceneReady===true;

export class GameInterface {
 constructor({art,Module,storage,startEngine,isReady,resumeAudio,saveCurrent,loadPayload,tell,cancelGesture=()=>{}}){
  Object.assign(this,{art,Module,startEngine,isReady,resumeAudio,saveCurrent,loadPayload,tell,cancelGesture});
  this.store=new CampaignStore(storage);this.frame=new LiveNativeFrame();this.textFrame=new LiveNativeFrame();this.titleFrame=document.createElement('canvas');this.homeFrame=document.createElement('canvas');this.homeFrameValid=false;this.creditsUnlocked=false;this.state={};this.visibleNative={};this.view='home';this.selectedHouse=this.store.progress.lastHouse;
  this.bound=[];this.lastOutcome=0;this.activeRun=null;this.lastNativeKey='';this.lastText='';this.paintKey='';this.busy=false;this.nativeBusy=false;this.frontOrigin=null;this.sequence=0;this.optionViews=new Map();this.pendingScreen=null;this.demoMode=false;this.trainingMode=false;this.coldHomeVideo=true;this.displayed='home';this.waitingForFrame=false;this.updateEpoch=0;
  this.curtain=new ScreenTransition(art);this.dialog=new NativeConfirmation({art,feedback:()=>this.uiSound()});this.building=new BuildingInterface({art,Module,resumeAudio});
  this.element=document.createElement('section');this.element.id='scene-ui';this.element.className='native-screen';this.element.setAttribute('aria-label','Dune — меню');
  this.backdrop=document.createElement('canvas');this.backdrop.className='scene-backdrop';this.backdrop.setAttribute('aria-hidden','true');this.shell=document.createElement('div');this.shell.className='scene-shell';
  const head=document.createElement('header');head.className='scene-head';this.caption=document.createElement('canvas');this.caption.className='scene-caption';this.caption.setAttribute('role','heading');this.caption.setAttribute('aria-level','1');head.append(this.caption);
  this.hero=document.createElement('div');this.hero.className='scene-hero';this.heroCanvas=document.createElement('canvas');this.heroCanvas.className='scene-art';this.heroCanvas.setAttribute('role','img');this.hero.append(this.heroCanvas);
  this.message=document.createElement('div');this.message.className='scene-message';this.message.setAttribute('role','article');this.textCanvas=document.createElement('canvas');this.textCanvas.className='scene-text';this.textCanvas.setAttribute('aria-hidden','true');this.message.append(this.textCanvas);
  this.actions=document.createElement('div');this.actions.className='scene-actions';this.footer=document.createElement('nav');this.footer.className='scene-footer';this.footer.setAttribute('aria-label','Навигация');this.shell.append(head,this.hero,this.message,this.actions,this.footer);this.element.append(this.backdrop,this.shell);document.body.append(this.element);
  this.demoButton=document.createElement('button');this.demoButton.id='demo-launch';this.demoButton.type='button';this.demoButton.textContent=this.art.displayText?.('LAUNCH DEMONSTRATION')||'Launch demonstration';this.demoButton.addEventListener('click',()=>this.beginDemo());document.body.append(this.demoButton);
  dragScroll(this.actions);dragScroll(this.message);this.bindDialogTap();
  this.observer=new ResizeObserver(()=>{this.paintKey='';this.heroPaintKey='';if(this.hero)this.hero.style.cssText='';this.element.dataset.artLocked='false';this.drawCaption();this.drawMessage();this.resizeLockedArt();});this.observer.observe(this.element);this.observer.observe(this.message);this.removeLanguageListener=this.art.language?.onChange(()=>this.languageChanged());this.showHome();
 }
 async loadCampaign(){const r=await fetch('./ui-assets/campaign/manifest.json');if(!r.ok)throw Error('Campaign catalogue '+r.status);this.campaign=await r.json();this.prepareTutorial().catch(e=>console.warn('Reference prefetch:',e.message));}
 async prepareTutorial(){
  if(this.tutorial)return this.tutorial;
  if(!this.tutorialPromise)this.tutorialPromise=import('./tutorial.mjs').then(({ModernTutorial})=>ModernTutorial.load({host:document.body,art:this.art,onBack:()=>this.closeTutorial(),onSound:()=>this.uiSound()})).then(guide=>(this.tutorial=guide)).catch(error=>{this.tutorialPromise=null;throw error;});
  return this.tutorialPromise;
 }
 languageChanged(){
  this.lastText='';this.paintKey='';this.heroPaintKey='';this.frameReadKey='';this.building.paintDirty=true;
  this.element.dataset.language=this.art.language.code;
  this.demoButton.textContent=this.art.displayText('LAUNCH DEMONSTRATION');
  this.caption.setAttribute('aria-label',this.art.displayText(this.title||'DUNE'));
  this.drawCaption();this.drawMessage();this.dialog.draw();
  if(this.tutorial?.active){this.tutorial.syncControls();this.tutorial.invalidate();}
  if(this.view==='languages')this.showLanguages();
 }
 openLanguages(){
  if(this.busy||this.pendingScreen||this.curtain.active)return;
  this.languageOrigin=this.state.scene==='pause'?'pause':'options';
  return this.front(()=>this.showLanguages());
 }
 showLanguages(){
  this.clear('languages','LANGUAGES');this.displayed='languages';this.actions.classList.add('language-grid');
  for(const locale of LANGUAGES)this.button(locale.label,()=>this.art.language.setLanguage(locale.code),{id:'language-'+locale.code,flag:locale.code,translate:false,subtitle:this.art.language.code===locale.code?'SELECTED':'',ariaLabel:locale.label});
  this.backButton(()=>this.closeLanguageScreen());
 }
 closeLanguageScreen(){return this.front(()=>{const scene=this.languageOrigin||'options';this.lastNativeKey='';if(this.state.scene===scene){this.showNative(this.state);this.displayed=scene;}else this.requestRoute(scene);});}
 get capturesInput(){return this.state?.battlePresentation&&this.state?.inputReady===false||this.tutorial?.capturesInput||this.dialog?.active||this.curtain.active||this.building.active||!this.element.hidden;}
 get inMission(){return !this.demoMode&&!this.trainingMode&&!!this.activeRun&&this.isReady()&&!!this.state.activeRunArmed;}
 get canAdvanceDialog(){return this.view==='native'&&!this.pendingScreen&&!this.curtain.active&&presentationReady(this.state)&&this.state.inputReady!==false&&!terminal(this.state)&&this.state.inputKind!=='confirm'&&SEQUENCE.has(this.state.scene);}
 uiSound(){this.resumeAudio();if(this.isReady())this.Module._dune_web_ui_sound?.();}
 button(label,action,options={},parent=this.actions){
  const b=document.createElement('button');b.type='button';if(options.id)b.id=options.id;if(options.className)b.className=options.className;b.disabled=!!options.disabled;parent.append(b);
  const view=this.art.decorate(b,label,options);this.bound.push(view);b.addEventListener('click',e=>{e.stopPropagation();if(this.busy||this.dialog?.active||this.curtain.active||this.pendingScreen&&!options.allowPending)return;view.pulse?.();this.resumeAudio();if(options.feedback!==false)this.uiSound();action();});return {button:b,view};
 }
 clear(view,title){
  for(const b of this.bound)b.dispose();this.bound=[];this.optionViews.clear();this.actions.replaceChildren();this.footer.replaceChildren();this.actions.hidden=false;this.footer.hidden=false;this.actions.removeAttribute('style');this.actions.className='scene-actions';this.view=view;if(this.isReady())this.Module._dune_web_frontend_hold?.(view==='native'?0:1);this.element.dataset.view=view;this.element.hidden=false;this.title=title;
  const accessibleTitle=this.art.displayText?.(title||'DUNE')||title||'DUNE';this.heroCanvas.setAttribute('aria-label',accessibleTitle);this.caption.setAttribute('aria-label',accessibleTitle);this.messageText='';this.liveText=false;this.message.hidden=true;this.element.dataset.hasMessage='false';this.element.dataset.dialog='false';this.element.dataset.optionsLayout='false';this.element.dataset.timeline='false';this.element.dataset.story='false';this.element.dataset.terminal='false';this.element.dataset.ready='true';this.demoButton.hidden=view!=='home';this.paintKey='';this.heroPaintKey='';if(this.hero)this.hero.style.cssText='';this.element.dataset.artLocked='false';this.drawCaption();
 }
 backButton(action=()=>this.back(),options={}){this.button('BACK',action,{back:true,ariaLabel:'Назад',allowPending:true,...options},this.footer);}
 cancelTrainingLoad(){const p=this.pendingScreen;if(p?.training&&p.reject){p.reject(Error('Training loading cancelled'));p.reject=null;}}
 async front(action){this.artLock=null;this.cancelTrainingLoad();const token=++this.sequence;this.coldHomeVideo=false;await this.curtain.cover();if(token!==this.sequence)return;this.pendingScreen=null;this.nativeBusy=false;this.busy=false;this.building.update({active:false});action();this.render(performance.now());this.curtain.reveal();}
 houseInfo(h){return this.campaign?.houses.find(x=>x.id===h);}
 missionInfo(h,m){return this.houseInfo(h)?.missions.find(x=>x.mission===m);}
 missionName(h,m){return displayMissionName(h,m,this.missionInfo(h,m)?.name);}
 showHome(){
  this.clear('home','DUNE');this.frontOrigin=null;this.lastNativeKey='';this.displayed='home';
  const slot=this.store.resumable();
  if(slot||this.store.legacy())this.button('CONTINUE',()=>this.confirmContinue(slot),{id:'continue-campaign',ariaLabel:'Продолжить игру'});
  this.button('NEW CAMPAIGN',()=>this.front(()=>this.showHouses()),{id:'new-campaign',ariaLabel:'Выбрать фракцию и миссию'});
  this.button('OPTIONS',()=>this.openOptions(),{id:'open-options',ariaLabel:'Настройки'});
 }
 async openTutorial(){
  if(this.busy||this.pendingScreen||this.curtain.active)return;
  this.tutorialOrigin=this.state.scene==='pause'?'pause':'options';
  const token=++this.sequence;this.busy=true;this.coldHomeVideo=false;this.cancelGesture();
  await this.curtain.cover();
  try{
   await this.startEngine();
   await this.prepareTutorial();
   if(token!==this.sequence)return;
   this.view='tutorial-guide';this.element.hidden=true;this.demoButton.hidden=true;this.building.update({active:false});this.tutorial.show(0);this.busy=false;this.curtain.reveal();
  }catch(e){if(token!==this.sequence)return;this.tell('Не удалось открыть обучение: '+e.message);this.busy=false;this.showHome();this.curtain.reveal();}
 }
 closeTutorial(){return this.front(()=>{this.tutorial?.hide();const scene=this.tutorialOrigin||'options';if(this.state.scene===scene){this.lastNativeKey='';this.showNative(this.state);this.displayed=scene;}else this.requestRoute(scene);});}
 getTrainingState(){
  const read=name=>{try{const at=this.Module[name]?.();return at?JSON.parse(this.Module.UTF8ToString(at)):{};}catch{return {};}};
  return {native:read('_dune_web_training_json'),actions:read('_dune_web_actions_debug'),building:read('_dune_web_building_ui_json'),camera:read('_dune_web_camera_debug')};
 }
 async startTraining(){
  if(this.pendingScreen)throw Error('Another native screen is loading');
  this.saveCurrent(true);this.trainingMode=true;this.trainingLoadError=null;this.activeRun=null;this.resuming=false;
  let payload;
  return new Promise((resolve,reject)=>{this.prepareNative({kind:'load',training:true,resolve,reject},()=>{
   if(this.trainingLoadError)throw this.trainingLoadError;
   if(!payload){if(!this.trainingFetch)this.trainingFetch=fetch('./training.state.bin').then(r=>{if(!r.ok)throw Error('Training map HTTP '+r.status);return r.arrayBuffer();}).then(buffer=>{const b=new Uint8Array(buffer),parts=[];for(let i=0;i<b.length;i+=8192)parts.push(String.fromCharCode(...b.subarray(i,i+8192)));this.trainingPayload=btoa(parts.join(''));}).catch(e=>{this.trainingLoadError=e;this.trainingFetch=null;});payload=this.trainingPayload;if(!payload)return 0;}
   if(!this.loadPayload(payload,true))throw Error('The native training map could not be loaded');return 1;
  });});
 }
 showHouses(origin=null){
  this.clear('houses','CHOOSE YOUR HOUSE');this.frontOrigin=origin;this.displayed='houses';this.actions.classList.add('house-grid');
  for(const h of [1,2,0]){const p=this.store.progress.houses[h],data=this.art.skin.houses?.[h];this.button(HOUSE_NAMES[h],()=>this.front(()=>{this.store.selectHouse(h);this.showMissions(h,origin);}),{id:'house-'+h,image:data?.crestPart||data?.part,subtitle:p.completed.length+' / 9',ariaLabel:HOUSE_NAMES[h]+', пройдено '+p.completed.length+' из 9'});}
  this.backButton(()=>this.front(()=>this.showHome()));
 }
 showMissions(house,origin=this.frontOrigin){
  this.selectedHouse=house;this.frontOrigin=origin;this.clear('missions',HOUSE_NAMES[house]);this.displayed='missions';this.actions.classList.add('mission-grid');const p=this.store.progress.houses[house];
  for(let m=1;m<=9;m++){const unlocked=canStart(this.store.progress,house,m),won=p.completed.includes(m),name=this.missionName(house,m);this.button(String(m),()=>this.chooseMission(house,m),{id:'mission-'+m,large:true,subtitle:name,disabled:!unlocked,ariaLabel:'Миссия '+m+', '+name+(won?', пройдена':'')+(!unlocked?', закрыта':'')});}
  this.backButton(()=>this.front(()=>this.showHouses(origin)));
 }
 showCompletion(house,mission){
  this.selectedHouse=house;this.clear('completion','MISSION COMPLETE');this.displayed='completion';this.element.dataset.scene='completion';
  const next=mission+1;
  if(validHouse(house)&&validMission(next)&&canStart(this.store.progress,house,next))this.button('NEXT MISSION',()=>this.startMission(house,next),{id:'next-mission',subtitle:this.missionName(house,next),ariaLabel:'Продолжить: '+HOUSE_NAMES[house]+', миссия '+next+', '+this.missionName(house,next),feedback:false});
  this.button('MAIN MENU',()=>this.mainMenu(),{id:'completed-main-menu',ariaLabel:'Главное меню'});
 }
 async confirmContinue(slot=this.store.resumable()){
  const hint=slot||this.store.progress.lastRun;const name=hint?this.missionName(hint.house,hint.mission):'';const lines=hint?[HOUSE_NAMES[hint.house], 'MISSION '+hint.mission,...(/^MISSION\s*\d+$/i.test(name)?[]:[name])]:['LAST SAVED GAME'];
  if(await this.dialog.ask({title:'CONTINUE?',lines,confirm:'CONTINUE'})){this.fromConfirmation=true;return this.resumeSlot(slot);}
 }
 async chooseMission(house,mission){
  if(!canStart(this.store.progress,house,mission))return;
  const replacing=!!(this.store.resumable()||this.store.legacy());
  const name=this.missionName(house,mission);const lines=[HOUSE_NAMES[house]+' - MISSION '+mission,...(/^MISSION\s*\d+$/i.test(name)?[]:[name]),...(replacing?['','THE CURRENT CONTINUE WILL BE REPLACED.']:[])];
  if(await this.dialog.ask({title:'START MISSION?',lines,confirm:'START',danger:replacing,confirmFeedback:false})){this.fromConfirmation=true;return this.startMission(house,mission);}
 }
 async confirmMainMenu(){
  const saveRequired=!this.demoMode&&!this.trainingMode&&!!this.state.activeRunArmed;
  if(!await this.dialog.ask({title:'RETURN TO MAIN MENU?',lines:[this.trainingMode?'TRAINING WILL NOT CHANGE YOUR CAMPAIGN.':this.demoMode?'DEMONSTRATION WILL NOT BE SAVED.':saveRequired?'YOUR PROGRESS WILL BE SAVED.':''],confirm:'MAIN MENU'}))return;
  if(saveRequired&&!this.saveCurrent(false)){this.tell('Не удалось сохранить игру. Вы остались в миссии.');return;}
  this.fromConfirmation=true;return this.mainMenu({save:false});
 }
 async prepareNative(pending,send){
  this.cancelTrainingLoad();if(this.dialog?.active)this.dialog.close(false);
  this.buildingExitFading=false;this.building.holdFrame=false;this.nativeTransition=null;this.completionTransition=false;this.artLock=null;
  const token=++this.sequence;this.coldHomeVideo=false;this.busy=true;this.cancelGesture();this.pendingScreen={...pending,token,sent:false,send,awaitingCover:true};
  const eager=this.isReady()&&pending.kind==='route',releaseHold=()=>{if(this.isReady())this.Module._dune_web_route_hold?.(token,0);};
  const from=this.fromConfirmation?0.65:0;this.fromConfirmation=false;
  try{
   if(eager){if(pending.target==='pause'&&this.element.hidden)this.Module._dune_web_route_hold?.(token,1);this.tryPending();}
   await this.curtain.cover({loading:pending.kind==='load',from,duration:240});if(token!==this.sequence){releaseHold();return;}
   this.pendingScreen.awaitingCover=false;
   if(!pending.training&&!(this.trainingMode&&this.tutorial?.practice&&pending.kind==='route'&&['pause','map'].includes(pending.target)))this.tutorial?.hide();
   await this.startEngine();if(token!==this.sequence){releaseHold();return;}
   this.view='native';this.Module._dune_web_frontend_hold?.(0);this.demoButton.hidden=true;this.lastNativeKey='';this.tryPending();
   releaseHold();
  }catch(e){releaseHold();pending.reject?.(e);if(pending.training)this.trainingMode=false;if(pending.demo)this.demoMode=pending.previousDemo;this.tell(e.message);this.pendingScreen=null;this.busy=false;this.nativeBusy=false;this.showHome();this.curtain.reveal();}
 }

 tryPending(){const p=this.pendingScreen;if(p&&!p.sent&&this.isReady()){p.sent=!!p.send();if(p.sent)p.sentAt=this.updateEpoch;}}
 placeholder(scene){return {...this.state,scene,inputKind:'options',optionsInGame:scene==='pause',music:this.state.music??1,sound:this.state.sound??1,sceneReady:false,rows:[]};}
 requestRoute(target){const id=ROUTE[target];if(id===undefined)return;return this.prepareNative({kind:'route',target,route:id,presentation:target==='pause'||target==='options'?target:null},()=>this.Module._dune_web_screen_route?.(id));}
 openPause(){if(this.view==='native'&&(this.state.scene==='pause'||this.pendingScreen?.target==='pause'))return;this.requestRoute('pause');}
 openOptions(){this.requestRoute('options');}
 openOriginalMain(index){if(index===2)this.requestRoute('tutorial');else if(index===1)this.openOptions();else this.front(()=>this.showHouses());}
 beginBoot(target){if(target==='houses')return this.front(()=>this.showHouses());if(target==='options')return this.openOptions();return this.openOriginalMain(target);}
 startMission(house,mission){
  if(!canStart(this.store.progress,house,mission))return;this.saveCurrent(true);this.activeRun=null;this.selectedHouse=house;
  return this.prepareNative({kind:'mission',house,mission},()=>{const ok=this.Module._dune_web_campaign_start?.(house,mission);if(ok){this.demoMode=false;this.trainingMode=false;this.store.begin(house,mission);this.requestedRun={house,mission};}return ok;});
 }
 async resumeSlot(slot,{saveCurrent:saveBeforeLoad=true}={}){
  if(saveBeforeLoad)this.saveCurrent(true);this.resuming=false;
  return this.prepareNative({kind:'load'},()=>{const payload=slot?.state||this.store.legacy();if(!payload||!this.loadPayload(payload,true))throw Error('Сохранение не удалось загрузить');this.demoMode=false;this.trainingMode=false;this.resuming=true;this.activeRun=null;return 1;});
 }
 async beginDemo(){
  if(this.busy||this.pendingScreen||this.curtain.active)return;this.uiSound();this.saveCurrent(true);const previousDemo=this.demoMode;this.demoMode=true;this.trainingMode=false;this.demoLoadError=null;this.resuming=false;this.activeRun=null;
  let payload;return this.prepareNative({kind:'load',demo:true,previousDemo},()=>{if(this.demoLoadError)throw this.demoLoadError;if(!payload){if(!this.demoFetch){this.demoFetch=fetch('./demo-harkonnen.state.bin').then(r=>{if(!r.ok)throw Error('Демонстрация недоступна');return r.arrayBuffer();}).then(buffer=>{const b=new Uint8Array(buffer);let text='';for(let i=0;i<b.length;i+=8192)text+=String.fromCharCode(...b.subarray(i,i+8192));this.demoPayload=btoa(text);}).catch(e=>{this.demoLoadError=e;this.demoFetch=null;});}payload=this.demoPayload;if(!payload)return 0;}if(!this.loadPayload(payload,true))throw Error('Не удалось загрузить демонстрацию');this.resuming=false;return 1;});
 }
 mainMenu({house=null,save=true}={}){
  if(save)this.saveCurrent(true);this.activeRun=null;this.resuming=false;
  if(this.state.houseId===-1&&['options','tutorial'].includes(this.state.scene))return this.requestRoute('main');
  this.frontendLoadError=null;const preferences={music:this.state.music??1,sound:this.state.sound??1};
  let payload;return this.prepareNative({kind:'frontend',house,preferences},()=>{if(this.frontendLoadError)throw this.frontendLoadError;if(!payload){if(!this.frontendFetch){this.frontendFetch=fetch('./frontend.state.bin').then(r=>{if(!r.ok)throw Error('Главное меню недоступно');return r.arrayBuffer();}).then(buffer=>{const b=new Uint8Array(buffer);let text='';for(let i=0;i<b.length;i+=8192)text+=String.fromCharCode(...b.subarray(i,i+8192));this.frontendPayload=btoa(text);}).catch(e=>{this.frontendLoadError=e;this.frontendFetch=null;});}payload=this.frontendPayload;if(!payload)return 0;}if(!this.loadPayload(payload,true))throw Error('Не удалось открыть главное меню');return 1;});
 }
 input(action,value){if(!this.isReady()||!ready(this.state)||this.state.inputReady===false||this.pendingScreen||this.curtain.active)return false;this.resumeAudio();const ok=!!this.Module._dune_web_campaign_input?.(action,value);if(ok&&action===5&&value===0&&STORY.has(this.state.scene)&&this.state.choiceLabels?.[0]==='PROCEED'){const b=this.hero?.getBoundingClientRect?.();if(b){this.artLock={x:b.left,y:b.top,w:b.width,h:b.height};this.applyArtLock(this.state,true);}}return ok;}
 async restartMission(){if(this.trainingMode&&this.tutorial?.active){this.tutorial.setSuspended?.(false);return this.tutorial.startPractice();}return this.prepareNative({kind:'confirm'},()=>this.Module._dune_web_campaign_input?.(1,6));}
 back(){
  if(this.dialog?.active){this.dialog.close(false);return;}
  if(this.tutorial?.active&&!this.tutorial?.suspended)return this.closeTutorial();
  if(this.view==='native'&&this.state.presentationFullFrame&&this.state.inputReady===false)return;
  if(this.pendingScreen){if(this.pendingScreen.target==='pause')this.requestRoute('map');else this.mainMenu();return;}
  if(this.view==='home')return;if(this.view==='houses')return this.front(()=>this.showHome());if(this.view==='missions')return this.front(()=>this.showHouses(this.frontOrigin));if(this.view==='replay')return this.front(()=>this.showMissions(this.selectedHouse));
  if(this.view==='languages')return this.closeLanguageScreen();
  if(this.building.active){this.building.exit();return;}
  if(this.state.scene==='pause')return this.requestRoute('map');if(this.state.scene==='options'||this.state.scene==='tutorial')return this.mainMenu();
  if(this.state.inputKind==='confirm'){this.input(5,1);return;}
  if(validHouse(this.state.houseId)&&(STORY.has(this.state.scene)||this.state.scene==='campaign'||this.state.scene==='results'))return this.mainMenu({house:this.state.houseId});
  this.mainMenu();
 }
 bindDialogTap(){let point=null;this.element.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;point={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});this.element.addEventListener('pointermove',e=>{if(point&&point.id===e.pointerId&&Math.hypot(e.clientX-point.x,e.clientY-point.y)>8)point.moved=true;});this.element.addEventListener('pointerup',e=>{const tap=point&&point.id===e.pointerId&&!point.moved;point=null;if(tap&&!e.target.closest('button'))this.advanceDialog();});this.element.addEventListener('pointercancel',()=>point=null);}
 advanceDialog(){if(!this.canAdvanceDialog)return false;return this.input(0,this.state.continueMask||16);}
 syncFrontendPreferences(p,s){
  if(!p.sent||this.updateEpoch<=p.sentAt||!ready(s)||s.inputReady===false)return false;
  const desired=p.preferences||{},same=['music','sound'].every(k=>(desired[k]??1)===(s[k]??1));
  if(s.scene==='main'){
   if(same){p.preferencesReady=true;return true;}
   if(!p.preferencesRouteSent&&this.Module._dune_web_screen_route?.(ROUTE.options)){p.preferencesRouteSent=true;p.preferencesAt=this.updateEpoch;}
   return false;
  }
  if(s.scene!=='options'||!p.preferencesRouteSent||this.updateEpoch<=p.preferencesAt)return false;
  if(p.preferenceWaiting){if((s[p.preferenceWaiting]??1)!==(desired[p.preferenceWaiting]??1))return false;p.preferenceWaiting=null;}
  const key=['music','sound'].find(k=>(desired[k]??1)!==(s[k]??1));
  if(key){if(this.Module._dune_web_campaign_input?.(2,key==='music'?0:1)){p.preferenceWaiting=key;p.preferencesAt=this.updateEpoch;}return false;}
  if(!p.preferencesReturnSent&&this.Module._dune_web_screen_route?.(ROUTE.main)){p.preferencesReturnSent=true;p.preferencesAt=this.updateEpoch;}
  return false;
 }
 matchesPending(p,s){
  if(p.awaitingCover||!p.sent||this.updateEpoch<=p.sentAt||!ready(s))return false;
  if(p.kind==='route')return p.target==='map'?s.scene==='map':s.scene===p.target;
  if(p.kind==='mission')return s.houseId===p.house&&s.mission===p.mission&&((s.pending&&s.requestStage>=4&&(STORY.has(s.scene)||s.scene==='campaign'))||(!s.pending&&(s.scene==='map'||s.scene==='building')));
  if(p.kind==='confirm')return s.scene==='confirm';
  if(p.kind==='frontend')return s.scene==='main';
  return !['unknown','boot','title','main','loading'].includes(s.scene);
 }
 handleBuildingTransition(s,building){
  const generation=s.transitionGeneration||0;
  if(this.view!=='native'||this.pendingScreen||!generation)return false;
  if(this.nativeTransition?.generation!==generation){
   if(!s.transitionActive)return false;
   const record=this.nativeTransition={generation,token:this.sequence,covered:false,finished:false};
   this.cancelGesture();this.building.holdFrame=this.building.active;
   this.curtain.cover().then(()=>{if(this.nativeTransition!==record||record.token!==this.sequence)return;record.covered=true;this.Module._dune_web_transition_covered?.(generation);});
  }
  const record=this.nativeTransition;
  if(record.finished)return false;
  if(!record.covered||!s.transitionReady)return true;
  record.finished=true;this.building.holdFrame=false;
  if(s.transitionTarget==='building'&&building?.frame?.ready){this.building.update(building);this.displayed='building';}
  else{this.building.update({active:false});this.displayed='map';}
  this.element.hidden=true;this.demoButton.hidden=true;this.waitingForFrame=false;this.revealAfterPaint=true;return true;
 }
 showCompletedTransition(s){
  if(this.completionTransition)return;
  this.completionTransition=true;this.cancelGesture();const token=this.sequence;
  const h=validHouse(s.outcomeHouse)?s.outcomeHouse:validHouse(s.houseId)?s.houseId:this.selectedHouse;
  const m=validMission(s.outcomeMission)?s.outcomeMission:validMission(s.terminalMission)?s.terminalMission:this.store.progress.lastRun?.mission;
  this.curtain.cover().then(()=>{if(token!==this.sequence)return;this.showCompletion(h,m);this.render(performance.now());this.curtain.reveal();});
 }
 update(state,camera,building){
  if(state?.titleLicenseReady)this.creditsUnlocked=true;
  this.updateEpoch++;this.state=state||{};const s=this.state;this.tutorial?.setSuspended?.(this.trainingMode&&this.view==='native'&&(s.scene==='pause'||['pause','map'].includes(this.pendingScreen?.target)));if(this.isReady()){this.Module._dune_web_frontend_hold?.(this.view==='native'?0:1);const nativeRequest=this.pendingScreen;const frontendAudio=!nativeRequest||nativeRequest.kind==='frontend'||nativeRequest.kind==='route'&&['main','options'].includes(nativeRequest.target);this.Module._dune_web_frontend_audio?.(frontendAudio&&(this.view!=='native'||s.houseId===-1&&['boot','title','main','options'].includes(s.scene))?1:0);}
  if(s.outcomeSeq>this.lastOutcome){this.lastOutcome=s.outcomeSeq;if(!this.demoMode&&!this.trainingMode&&s.outcome==='victory'&&validHouse(s.outcomeHouse)&&validMission(s.outcomeMission)){if(!this.store.complete(s.outcomeHouse,s.outcomeMission))this.tell('Прогресс пока хранится в памяти: запись недоступна');}if(s.outcome==='defeat'&&!this.demoMode&&!this.trainingMode)this.store.finish(s.outcomeHouse,s.outcomeMission);if(s.outcome==='victory'||s.outcome==='defeat')this.activeRun=null;}
  if(!this.demoMode&&!this.trainingMode&&s.activeRunArmed&&validHouse(s.activeRunHouse)&&validMission(s.activeRunMission)){const h=s.activeRunHouse,m=s.activeRunMission;if(this.resuming){this.store.adoptResume(h,m);this.resuming=false;}if(canStart(this.store.progress,h,m))this.activeRun={house:h,mission:m};}
  const buildingReady=this.view==='native'&&s.scene==='building'&&ready(s)&&!this.pendingScreen&&!!building?.frame?.ready;
  if(this.handleBuildingTransition(s,building))return;
  this.building.update(buildingReady?building:{active:false});
  if(this.view!=='native'){this.demoButton.hidden=this.view!=='home';return;}
  const p=this.pendingScreen;if(p){try{this.tryPending();}catch(e){p.reject?.(e);if(p.training)this.trainingMode=false;if(p.demo)this.demoMode=p.previousDemo;this.tell(e.message);this.pendingScreen=null;this.busy=false;this.nativeBusy=false;this.showHome();this.curtain.reveal();return;}
   if(p.kind==='frontend'&&!this.syncFrontendPreferences(p,s))return;
   if(!this.matchesPending(p,s))return;this.pendingScreen=null;this.busy=false;this.nativeBusy=false;this.lastNativeKey='';this.waitingForFrame=true;
   if(p.training)p.resolve?.(this.getTrainingState());
   if(p.kind==='load'&&!p.demo&&!p.training&&s.scene==='pause'){this.requestRoute('map');return;}
   if(p.kind==='frontend'){this.trainingMode=false;this.waitingForFrame=false;if(validHouse(p.house))this.showMissions(p.house);else this.showHome();this.render(performance.now());this.curtain.reveal();return;}
   if(s.scene==='building'&&building?.frame?.ready)this.building.update(building);
  }
  if(s.passwordPresentation){this.showCompletedTransition(s);return;}
  if(s.battlePresentation){this.artLock=null;this.element.hidden=true;this.demoButton.hidden=true;this.displayed='map';this.waitingForFrame=false;if(this.curtain.active)this.revealAfterPaint=true;return;}
  if(s.scene==='building'&&!this.building.active){if(!this.waitingForFrame&&!this.curtain.active)this.curtain.cover({instant:this.element.hidden});this.waitingForFrame=true;return;}
  if(!presentationReady(s)&&!SEQUENCE.has(s.scene)){if(!this.waitingForFrame){this.waitingForFrame=true;this.curtain.cover({instant:this.element.hidden,loading:false});}return;}
  if(s.scene==='password_display'){
   const h=validHouse(s.outcomeHouse)?s.outcomeHouse:validHouse(s.houseId)?s.houseId:this.selectedHouse;
   const m=validMission(s.outcomeMission)?s.outcomeMission:validMission(s.terminalMission)?s.terminalMission:this.store.progress.lastRun?.mission;
   this.showCompletion(h,m);this.curtain.reveal();return;
  }
  if(s.scene==='password'){this.mainMenu({house:validHouse(s.houseId)?s.houseId:this.selectedHouse});return;}
  if(s.scene==='main'||s.scene==='title'||s.scene==='boot'){this.showHome();this.curtain.reveal();return;}
  if(s.scene==='house'&&!s.pending){this.showHouses();this.curtain.reveal();return;}
  if(s.scene==='map'&&ready(s)||this.building.active){this.element.hidden=true;this.demoButton.hidden=true;const next=this.building.active?'building':'map';if(next!==this.displayed){if(!this.curtain.active)this.curtain.cover({instant:true});this.displayed=next;this.revealAfterPaint=true;}else if(this.waitingForFrame)this.revealAfterPaint=true;this.waitingForFrame=false;return;}
  const next=s.scene;if(!SEQUENCE.has(next)&&next!==this.displayed&&!this.curtain.active)this.curtain.cover();this.showNative(s);this.displayed=next;if(presentationReady(s)&&(this.waitingForFrame||this.curtain.active))this.revealAfterPaint=true;this.waitingForFrame=false;
 }
 resizeLockedArt(){
  if(!this.artLock||this.element.dataset.artLocked!=='true'||!this.hero)return;
  const story=this.element.dataset.story;this.hero.style.cssText='';this.element.dataset.story='true';const b=this.hero.getBoundingClientRect();this.element.dataset.story=story;
  if(b.width>0&&b.height>0)this.artLock={x:b.left,y:b.top,w:b.width,h:b.height};this.applyArtLock(this.state,true);this.heroPaintKey='';
 }
 applyArtLock(s,force=false){
  const active=!!this.artLock&&(force||s.presentationPhase==='briefing_exit'||['campaign','loading'].includes(s.scene));this.element.dataset.artLocked=String(active);
  if(active&&this.hero){const b=this.artLock;Object.assign(this.hero.style,{position:'fixed',left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px'});}else if(this.hero)this.hero.style.cssText='';
 }
 showNative(s,pending=false){
  const scene=s.scene,key=[scene,s.inputKind,s.inputReady,s.presentationFullFrame,s.presentationPhase,s.confirmStyle,s.houseId,s.optionsInGame,(s.choiceLabels||[]).join(','),terminal(s),pending].join(':');
  if(key!==this.lastNativeKey){this.lastNativeKey=key;this.clear('native',TITLE[scene]||'DUNE');this.element.dataset.scene=scene;
   const opts={feedback:false,disabled:pending||s.inputReady===false};
   if(scene==='options'||scene==='pause'){
    for(const row of [0,1]){const v=this.button('',()=>this.input(2,row),{...opts,id:'option-'+row});this.optionViews.set(row,v.view);}
    this.button('LANGUAGES',()=>this.openLanguages(),{...opts,id:'open-languages',feedback:true});
    this.button('TUTORIAL',()=>this.openTutorial(),{...opts,id:'open-tutorial',ariaLabel:'Пояснения об Арракисе',feedback:true});
    if(scene==='pause'){this.button('RESTART',()=>this.restartMission(),{...opts,id:'restart-mission',ariaLabel:'Начать текущую миссию заново'});this.button('MAIN MENU',()=>this.confirmMainMenu(),{...opts,id:'main-menu',ariaLabel:'Главное меню'});}
    this.backButton(()=>scene==='pause'?this.requestRoute('map'):this.mainMenu(),{feedback:true,disabled:pending});
   }else if(terminal(s)){
    const h=validHouse(s.terminalHouseId)?s.terminalHouseId:validHouse(s.outcomeHouse)?s.outcomeHouse:s.houseId,m=validMission(s.terminalMission)?s.terminalMission:validMission(s.outcomeMission)?s.outcomeMission:s.mission;
    if(validHouse(h)&&validMission(m))this.button('REPLAY',()=>this.startMission(h,m),{id:'replay-outcome',ariaLabel:'Начать миссию заново'});
    this.button('MAIN MENU',()=>this.mainMenu(),{id:'outcome-main-menu',ariaLabel:'Главное меню'});
   }else if(s.inputKind==='confirm'&&!s.presentationFullFrame){
    const choices=s.choiceLabels||['YES','NO'];this.button(choices[0],()=>this.input(5,0),{...opts,id:'native-yes',ariaLabel:choices[0]==='PROCEED'?'Начать миссию':'Да'});this.button(choices[1],()=>this.input(5,1),{...opts,id:'native-no',ariaLabel:choices[1]==='ADVICE'?'Совет ментата':'Нет'});
    if(scene==='confirm')this.backButton();
   }else if((scene==='tutorial'||scene==='briefing'||scene==='house_briefing')&&!s.presentationFullFrame&&s.inputReady!==false)this.backButton();
  }
  this.applyArtLock(s);this.nativeBusy=pending;this.visibleNative={...s};this.element.hidden=false;this.element.dataset.scene=scene;this.element.dataset.phase=s.presentationPhase||scene;this.element.dataset.ready=String(!pending);this.element.dataset.optionsLayout=String(scene==='pause'||scene==='options');this.element.dataset.timeline=String(SEQUENCE.has(scene));this.element.dataset.story=String(STORY.has(scene)&&(!s.presentationFullFrame||s.presentationPhase==='briefing_exit'));this.element.dataset.terminal=String(terminal(s));this.element.dataset.dialog=String(SEQUENCE.has(scene)&&!terminal(s));
  this.footer.hidden=!this.footer.childElementCount;this.actions.hidden=!this.actions.childElementCount;
  if(scene==='options'||scene==='pause'){this.optionViews.get(0)?.update('MUSIC: '+(s.music?'ON':'OFF'));this.optionViews.get(1)?.update('SOUND: '+(s.sound?'ON':'OFF'));}
  const dialogue=STORY.has(scene)&&!s.presentationFullFrame,hasText=typeof s.visibleMessageText==='string';this.liveText=dialogue&&!hasText;this.messageText=cleanText(dialogue&&hasText?s.visibleMessageText:scene==='confirm'?(s.promptText||'ARE YOU SURE?'):'');this.message.hidden=!(this.messageText||this.liveText);this.element.dataset.hasMessage=String(!this.message.hidden);this.message.setAttribute('aria-label',this.messageText||'Оригинальный текст игры');this.drawMessage();
 }
 drawCaption(){const box=this.caption.getBoundingClientRect();if(!this.art.ready||box.width<1)return;const text=value=>this.art.displayText?.(value)||value,label=text(this.title||'DUNE'),sub=this.view==='native'&&this.visibleNative?.scene==='pause'&&this.state.house?text(this.state.house.toUpperCase()+' - MISSION '+this.state.mission):'',d=Math.min(devicePixelRatio||1,3),h=sub?64:40;this.caption.width=Math.ceil(box.width*d);this.caption.height=h*d;this.caption.style.height=h+'px';this.caption.setAttribute('aria-label',label);const c=this.caption.getContext('2d');c.scale(d,d);c.imageSmoothingEnabled=false;const scale=Math.min(2,Math.max(1,(box.width-16)/(Math.max(1,label.length)*8)));this.art.text(c,label,box.width/2,(40-8*scale)/2,{scale,align:'center',shadow:true,translate:false});if(sub)this.art.text(c,sub,box.width/2,44,{scale:Math.min(1.25,(box.width-24)/(sub.length*8)),align:'center',shadow:true,translate:false});}
 drawMessage(){
  if(this.message.hidden)return;const width=Math.floor(this.message.clientWidth||300),d=Math.min(devicePixelRatio||1,3),scale=width<340?1.5:2,cols=Math.max(8,Math.floor((width-28)/(8*scale))),text=this.art.language?.storyText(this.messageText||'',this.state)||this.messageText||'',lines=[];this.message.setAttribute('aria-label',text);
  for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if((line?line.length+1:0)+word.length>cols&&line){lines.push(line);line='';}line+=(line?' ':'')+word;}lines.push(line);}
  const height=this.liveText?Math.max(48,Math.round(width*40/288)+20):Math.max(48,lines.length*(8*scale+5)+24),key=width+':'+height+':'+text+':'+this.liveText;if(key===this.lastText)return;this.lastText=key;this.textCanvas.width=width*d;this.textCanvas.height=height*d;this.textCanvas.style.height=height+'px';const c=this.textCanvas.getContext('2d');c.scale(d,d);c.imageSmoothingEnabled=false;this.art.frame(c,'dialog-frame',0,0,width,height,{group:'screen',unit:1,fill:true});if(!this.liveText)lines.forEach((line,i)=>this.art.text(c,line,14,12+i*(8*scale+5),{scale,preserveCase:true,shadow:true}));
 }
 drawBackdrop(){
  const b=this.element.getBoundingClientRect(),w=Math.round(b.width),h=Math.round(b.height),scene=this.element.dataset.scene||'',r=this.art.skin.screens?.[scene];
  const results=this.view==='completion'||this.view==='native'&&scene==='results',shade=results&&this.frame.valid&&this.view==='native'?Array.from(this.frame.data.data.subarray(0,3)).join(' '):'',background=(this.view==='native'&&(scene==='campaign'||this.state.presentationPhase==='briefing_exit'))||['home','missions','replay'].includes(this.view)?'native-black':this.view==='native'?(r?.background||'native-black'):'title-background',key=[this.view,scene,w,h,background,shade].join(':');if(key===this.paintKey)return;this.paintKey=key;const d=Math.min(devicePixelRatio||1,3);this.backdrop.width=w*d;this.backdrop.height=h*d;const c=this.backdrop.getContext('2d');c.scale(d,d);c.imageSmoothingEnabled=false;c.fillStyle='#000';c.fillRect(0,0,w,h);if(this.view==='native'&&['options','pause'].includes(scene)){drawOptionsScene({ctx:c,art:this.art,width:w,height:h,state:this.visibleNative||this.state});this.drawCaption();return;}const sky=results?this.art.part('pause-options-sky-sample','screen'):null;if(sky){if(shade){c.fillStyle='rgb('+shade+')';c.fillRect(0,0,w,h);}else this.art.repeat(c,sky,0,0,w,h);this.drawCaption();return;}const im=this.art.part(background,'screen');if(im){const scale=Math.min(w/im.width,h/im.height);c.drawImage(im,(w-im.width*scale)/2,0,im.width*scale,im.height*scale);}this.drawCaption();
 }
 homePicture(source,{cache=false}={}){
  if(!source)return null;
  if(cache){this.homeFrame.width=source.width;this.homeFrame.height=source.height;this.homeFrame.getContext('2d').drawImage(source,0,0);this.homeFrameValid=true;}
  const can=this.titleFrame;can.width=320;can.height=246;const c=can.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#000';c.fillRect(0,0,320,246);c.drawImage(source,0,0,320,224);
  if(this.creditsUnlocked){this.art.text(c,'ENGINE: REARRAKIS - OPEN SOURCE (MIT)',160,228,{scale:.65,align:'center',shadow:true});this.art.text(c,'KRUZEMAN / RROP / REARRAKIS CONTRIBUTORS',160,237,{scale:.65,align:'center',shadow:true});}return can;
 }
 updateFrame({textless=false,resultLabels=false,sceneLabels=false}={}){
  if(!this.isReady())return false;const serial=this.Module._dune_web_frame_serial?.(),key=[serial,textless,resultLabels,sceneLabels,this.liveText,this.state.scene,this.state.presentationPhase].join(':');
  if(serial!==undefined&&this.frame.valid&&key===this.frameReadKey)return true;
  const raw=this.Module._dune_web_frame_rgb?.(),ptr=resultLabels?(this.Module._dune_web_results_frame_rgb?.()||raw):sceneLabels?(this.Module._dune_web_localized_scene_frame_rgb?.()||raw):textless?(this.Module._dune_web_readonly_textless_frame_rgb?.()||raw):raw;
  if(resultLabels){try{const p=this.Module._dune_web_results_overlay_json?.();this.resultsOverlay=p?JSON.parse(this.Module.UTF8ToString(p)):null;}catch{this.resultsOverlay=null;}}else this.resultsOverlay=null;
  if(sceneLabels){try{const p=this.Module._dune_web_localized_scene_overlay_json?.();this.sceneOverlay=p?JSON.parse(this.Module.UTF8ToString(p)):null;}catch{this.sceneOverlay=null;}}else this.sceneOverlay=null;
  this.overlayPaintKey=JSON.stringify([this.resultsOverlay&&[this.resultsOverlay.labelMask,this.resultsOverlay.labelInk,this.resultsOverlay.rankInk,this.resultsOverlay.rankVisible,this.resultsOverlay.rank],this.sceneOverlay?.lines]);
  if(textless&&this.liveText&&this.textFrame)this.textFrame.update(this.Module,raw,320,224);
  const ok=this.frame.update(this.Module,ptr,this.Module._dune_web_frame_width?.()||320,this.Module._dune_web_frame_height?.()||224);if(ok)this.frameReadKey=key;return ok;
 }
 render(now){
  this.curtain.paint(now);this.building.render(now);this.tutorial?.render?.(now);
  if(!this.element.hidden){
   const a=this.art,s=this.visibleNative||{},scene=s.scene;let source=null,sourceKey='',home=false,cacheHome=false;
   if(this.view==='home'){
    const safe=['boot','title','main'].includes(this.state.scene),live=safe&&(this.coldHomeVideo||ready(this.state)&&!this.state.routePending);
    if(live&&this.updateFrame({textless:true})&&this.frame.valid){source=this.frame.canvas;sourceKey='home:'+this.frame.revision;home=true;cacheHome=ready(this.state)&&this.state.scene==='main';}
    else if(!this.coldHomeVideo){source=this.homeFrameValid?this.homeFrame:a.part('title-complete-without-choices','screen');sourceKey='home-static';home=true;}
   }else if(this.view==='houses'){source=a.part('title-logo','screen');sourceKey='house-logo';}
   else if(this.view==='missions'||this.view==='replay'){const h=a.skin.houses?.[this.selectedHouse];source=a.part(h?.crestPart||h?.part,'screen');sourceKey='crest:'+this.selectedHouse;}
   else if(this.view==='completion'){source=a.part('results-soldier-scene','screen');sourceKey='completion';}
   else if(scene==='confirm'){source=a.part('options-clean-background','screen');sourceKey='confirm';}
   else if(scene!=='pause'&&scene!=='options'){
    const serial=this.isReady()?this.Module._dune_web_frame_serial?.():undefined;if(this.state.nativeDisplayEnabled===false){this.nativeBlankSerial=serial;sourceKey='native-blank';}else if(serial!==undefined&&serial===this.nativeBlankSerial){sourceKey='native-blank';}else{this.nativeBlankSerial=undefined;
    if(this.state.scene===scene&&!this.completionTransition)this.updateFrame({textless:STORY.has(scene)&&(!s.presentationFullFrame||s.presentationPhase==='briefing_exit'),resultLabels:this.art.language?.russian&&scene==='results',sceneLabels:this.art.language?.russian&&['ending','credits'].includes(scene)});
    if(this.frame.valid){source=this.frame.canvas;sourceKey='native:'+this.frame.revision+':'+this.overlayPaintKey;}}
   }
   this.drawBackdrop();
   const box=this.hero.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,3),can=this.heroCanvas,key=[this.view,scene,sourceKey,box.width,box.height,d,this.creditsUnlocked,this.art.language?.revision].join(':');
   if(box.width>0&&box.height>0&&key!==this.heroPaintKey){
    this.heroPaintKey=key;this.heroPaints=(this.heroPaints||0)+1;if(home&&source)source=this.homePicture(source,{cache:cacheHome});
    // Keep native pixels in the backing store; CSS object-fit/pixelated does
    // the final display scale without rebuilding a viewport-sized bitmap.
    const pw=source?.width||1,ph=source?.height||1;if(can.width!==pw)can.width=pw;if(can.height!==ph)can.height=ph;
    const c=can.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect?.(0,0,pw,ph);c.imageSmoothingEnabled=false;if(source)c.drawImage(source,0,0);if(this.art.language?.russian&&this.view==='native'){const state={...this.state,scene};if(scene==='results')drawLocalizedResults(c,a,state,{width:pw,height:ph,overlay:this.resultsOverlay});else if(['ending','credits'].includes(scene))drawLocalizedSceneLabels(c,a,state,{width:pw,height:ph,overlay:this.sceneOverlay});}
   }
   if(this.liveText&&(this.textFrame?.valid||this.frame.valid)){
    const live=this.textFrame?.valid?this.textFrame:this.frame,textKey=[live.revision,this.textCanvas.width,this.textCanvas.height].join(':');if(textKey!==this.liveTextPaintKey){this.liveTextPaintKey=textKey;const cc=this.textCanvas.getContext('2d'),v=s.nativeTextRect||[16,16,288,40],w=this.textCanvas.width/d;cc.setTransform(d,0,0,d,0,0);cc.imageSmoothingEnabled=false;live.crop(cc,{x:v[0],y:v[1],w:v[2],h:v[3]},10,10,w-20,(w-20)*v[3]/v[2]);}
   }
  }
  if(this.revealAfterPaint&&(!this.building.active||this.building.frame.valid)){this.revealAfterPaint=false;this.curtain.reveal();}
 }

 debug(){return {heroPaints:this.heroPaints||0,frameUploads:this.frame.revision||0,language:this.art.language?.debug(),view:this.view,scene:this.state.scene,displayed:this.displayed,selectedHouse:this.selectedHouse,progress:this.store.progress,activeRun:this.activeRun,demoMode:this.demoMode,trainingMode:this.trainingMode,tutorial:this.tutorial?.debug?.(),building:this.building.debug(),ready:this.isReady(),sceneReady:this.state.sceneReady,pendingScreen:this.pendingScreen?{kind:this.pendingScreen.kind,target:this.pendingScreen.target,sent:this.pendingScreen.sent}:null,transition:this.curtain.debug(),confirmation:!!this.dialog?.active,busy:this.busy};}
}
