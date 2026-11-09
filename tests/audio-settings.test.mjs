import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioSettings,AUDIO_SETTINGS_KEY,AUDIO_LEVELS} from '../web/audio-settings.mjs';
import {GameInterface} from '../web/game-ui.mjs';
import {GameLanguage} from '../web/i18n.mjs';
import {UI_RU} from '../web/locale-ui-ru.mjs';

function memory(value){
 const values=new Map([['unrelated-progress','keep']]),writes=[];if(value!==undefined)values.set(AUDIO_SETTINGS_KEY,value);
 return {values,writes,getItem:key=>values.get(key)??null,setItem(key,value){writes.push([key,value]);values.set(key,value);}};
}
test('first visit defaults to full playback without writing preferences or touching native audio',()=>{
 const storage=memory(),calls=[],settings=new AudioSettings({storage,apply:(...levels)=>calls.push(levels)});
 assert.deepEqual(AUDIO_LEVELS,[100,50,0]);assert.deepEqual(settings.levels,{music:100,sound:100});assert.equal(settings.hasSaved,false);assert.deepEqual(storage.writes,[]);assert.deepEqual(calls,[]);
 assert.equal(settings.label('music'),'MUSIC: 100%');assert.equal(settings.label('sound'),'SOUND: 100%');
});
test('music and sound cycle independently through exact percentages, with one apply and preference write per press',()=>{
 const storage=memory(),calls=[],settings=new AudioSettings({storage,apply:(...levels)=>(calls.push(levels),true)});
 assert.equal(settings.cycle('music'),50);assert.equal(settings.label('music'),'MUSIC: 50%');
 assert.equal(settings.cycle('sound'),50);assert.equal(settings.cycle('music'),0);assert.equal(settings.label('music'),'MUSIC: OFF');
 assert.equal(settings.cycle('music'),100);assert.equal(settings.cycle('sound'),0);assert.equal(settings.cycle('sound'),100);
 assert.deepEqual(calls,[[50,100],[50,50],[0,50],[100,50],[100,0],[100,100]]);assert.equal(storage.writes.length,6);assert.equal(storage.values.get('unrelated-progress'),'keep');
 assert.deepEqual(JSON.parse(storage.values.get(AUDIO_SETTINGS_KEY)),{version:1,music:100,sound:100});
 assert.equal(settings.cycle('other'),false);assert.equal(storage.writes.length,6);assert.equal(calls.length,6);
});
test('a browser reload restores both saved percentages and a valid stored choice outranks stale native save flags',()=>{
 const storage=memory(JSON.stringify({version:1,music:50,sound:0})),calls=[],settings=new AudioSettings({storage,apply:(...levels)=>(calls.push(levels),true)});
 assert.equal(settings.hasSaved,true);assert.deepEqual(settings.levels,{music:50,sound:0});assert.equal(settings.observeNative({music:0,sound:1}),false);assert.deepEqual(settings.levels,{music:50,sound:0});
 assert.equal(settings.apply(),true);assert.deepEqual(calls,[[50,0]]);assert.deepEqual(storage.writes,[]);
});
test('an explicit settled old native choice migrates once without guessing from missing boot flags or writing it early',()=>{
 const storage=memory(),settings=new AudioSettings({storage});
 assert.equal(settings.observeNative({scene:'boot'}),false);assert.equal(settings.observedNative,false);assert.equal(settings.observeNative({music:0,sound:1}),true);
 assert.deepEqual(settings.levels,{music:0,sound:100});assert.deepEqual(storage.writes,[]);assert.equal(settings.hasSaved,false);
 assert.equal(settings.observeNative({music:1,sound:0}),false);assert.deepEqual(settings.levels,{music:0,sound:100});
 settings.cycle('music');assert.deepEqual(JSON.parse(storage.values.get(AUDIO_SETTINGS_KEY)),{version:1,music:100,sound:100});
});
test('a successful legacy DSAV load respects its stopped native driver and persists truthful OFF labels without native commands',()=>{
 const storage=memory(JSON.stringify({version:1,music:100,sound:50})),calls=[],settings=new AudioSettings({storage,apply:(...levels)=>(calls.push(levels),true)});
 settings.observeNative({music:1,sound:1});assert.equal(settings.restoreNativeMute({music:0,sound:false}),true);
 assert.deepEqual(settings.levels,{music:0,sound:0});assert.equal(settings.label('music'),'MUSIC: OFF');assert.equal(settings.label('sound'),'SOUND: OFF');assert.deepEqual(calls,[],'adoption itself does not call a driver or playback callback');
 assert.deepEqual(JSON.parse(storage.values.get(AUDIO_SETTINGS_KEY)),{version:1,music:0,sound:0});
 const h=options();h.ui.audioSettings=settings;h.state.music=0;h.state.sound=0;const inputs=[];h.ui.input=(...args)=>(inputs.push(args),true);
 assert.equal(h.ui.cycleAudio(0),true);assert.equal(settings.label('music'),'MUSIC: 100%');assert.deepEqual(inputs,[[2,0]],'the first user press restores the original ON handler');
});
test('native ON after load preserves current 50 percent/output OFF, and absent or invalid flags adopt nothing',()=>{
 const storage=memory(JSON.stringify({version:1,music:50,sound:0})),settings=new AudioSettings({storage});
 for(const state of [{music:1,sound:true},{},null,false,{music:null,sound:'0'},{music:NaN,sound:undefined}])assert.equal(settings.restoreNativeMute(state),false);
 assert.deepEqual(settings.levels,{music:50,sound:0});assert.deepEqual(storage.writes,[]);
 assert.equal(settings.restoreNativeMute({music:1,sound:0}),false);assert.equal(settings.restoreNativeMute({music:false,sound:1}),true);assert.deepEqual(settings.levels,{music:0,sound:0});
 assert.equal(settings.restoreNativeMute({music:false,sound:0}),false);assert.equal(storage.writes.length,1,'identical load flags do not rewrite preferences');
});
test('invalid preference data and inaccessible storage cannot break playback controls',()=>{
 for(const raw of ['bad','null','[]','{}',JSON.stringify({version:2,music:50,sound:100}),JSON.stringify({version:1,music:75,sound:100}),JSON.stringify({version:1,music:'50',sound:0})]){
  const settings=new AudioSettings({storage:memory(raw)});assert.deepEqual(settings.levels,{music:100,sound:100});assert.equal(settings.hasSaved,false);
 }
 const settings=new AudioSettings({storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}},apply(){throw Error('engine pending');}});
 assert.equal(settings.cycle('music'),50);assert.deepEqual(settings.levels,{music:50,sound:100});assert.equal(settings.apply(),false);assert(settings.error);
});
function options(scene='options'){
 const ui=Object.create(GameInterface.prototype),applied=[],labels=new Map(),state={scene,sceneReady:true,inputReady:true,music:1,sound:1},feedback=[];
 Object.assign(ui,{state,optionViews:new Map([[0,{update:value=>labels.set(0,value)}],[1,{update:value=>labels.set(1,value)}]]),audioSettings:new AudioSettings({storage:memory(),apply:(...levels)=>(applied.push(levels),true)}),isReady:()=>true,pendingScreen:null,curtain:{active:false},resumeAudio:()=>feedback.push('resume'),uiSound:()=>feedback.push('sound')});
 return {ui,applied,labels,state,feedback};
}
test('actual Options and Pause button handler immediately refreshes its bitmap labels, without native boolean input',()=>{
 for(const scene of ['options','pause']){
  const h=options(scene);h.ui.input=()=>assert.fail('50 percent is not a native on/off toggle');h.ui.refreshAudioLabels();assert.equal(h.labels.get(0),'MUSIC: 100%');
  assert.equal(h.ui.cycleAudio(0),true);assert.equal(h.labels.get(0),'MUSIC: 50%');assert.equal(h.labels.get(1),'SOUND: 100%');assert.deepEqual(h.applied,[[50,100]]);
  assert.equal(h.ui.cycleAudio(0),true);assert.equal(h.labels.get(0),'MUSIC: OFF');assert.equal(h.ui.cycleAudio(1),true);assert.equal(h.labels.get(1),'SOUND: 50%');
  assert.deepEqual(h.state,{scene,sceneReady:true,inputReady:true,music:1,sound:1},'UI preferences do not mutate native state publications');assert.equal(h.feedback.filter(value=>value==='sound').length,3);
 }
});
test('transient native scenes cannot cycle and a UI without the injected model retains the existing native toggle',()=>{
 const h=options();h.ui.pendingScreen={target:'pause'};assert.equal(h.ui.cycleAudio(0),false);h.ui.pendingScreen=null;h.ui.curtain.active=true;assert.equal(h.ui.cycleAudio(0),false);h.ui.curtain.active=false;h.ui.state.inputReady=false;assert.equal(h.ui.cycleAudio(0),false);assert.deepEqual(h.applied,[]);
 delete h.ui.audioSettings;h.ui.input=(...args)=>args;assert.deepEqual(h.ui.cycleAudio(1),[2,1]);h.ui.refreshAudioLabels();assert.equal(h.labels.get(0),'MUSIC: ON');
});
test('legacy native OFF to 100 percent restores its original ON handler once; 100 to 50 never restarts the driver',()=>{
 for(const [row,kind]of [[0,'music'],[1,'sound']]){
  const h=options(),inputs=[];h.state[kind]=0;h.ui.input=(...args)=>(inputs.push(args),true);
  h.ui.refreshAudioLabels();assert.equal(h.ui.audioSettings.levels[kind],0);
  assert.equal(h.ui.cycleAudio(row),true);assert.equal(h.ui.audioSettings.levels[kind],100);assert.deepEqual(inputs,[[2,row]]);
  h.state[kind]=1;assert.equal(h.ui.cycleAudio(row),true);assert.equal(h.ui.audioSettings.levels[kind],50);assert.deepEqual(inputs,[[2,row]],'half volume never sends a second native toggle');
  assert.equal(h.ui.cycleAudio(row),true);assert.equal(h.ui.audioSettings.levels[kind],0);assert.deepEqual(inputs,[[2,row]],'new OFF is output muting, preserving the native driver timeline');
 }
});
test('new percentage and OFF labels translate through the existing original English and Cyrillic glyph sets',()=>{
 const language=new GameLanguage();language.code='ru';for(const [source,target]of Object.entries(UI_RU))language.lookup.set(source,target);
 const manifest=JSON.parse(readFileSync(new URL('../web/language-assets/manifest.json',import.meta.url))),glyphs=manifest.languages.find(value=>value.code==='ru').font.glyphs;
 for(const source of ['MUSIC: 100%','MUSIC: 50%','MUSIC: OFF','SOUND: 100%','SOUND: 50%','SOUND: OFF']){
  const text=language.text(source);assert.equal(text,UI_RU[source]);for(const char of text)if(char.charCodeAt(0)>126)assert(glyphs[char.charCodeAt(0)],'missing native Cyrillic glyph '+char);
 }
});
