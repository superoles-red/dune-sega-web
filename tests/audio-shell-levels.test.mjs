import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {AudioSettings,AUDIO_SETTINGS_KEY} from '../web/audio-settings.mjs';

const shell=fs.readFileSync(new URL('../web/shell.js',import.meta.url),'utf8');
const declaration=shell.split('\n').find(line=>line.startsWith('const audioSettings=new AudioSettings('));
test('shell binds saved independent levels to the real native output export, without early engine calls',()=>{
 const calls=[],storage={getItem:key=>key===AUDIO_SETTINGS_KEY?JSON.stringify({version:1,music:50,sound:0}):null};
 const context={AudioSettings,browserStorage:()=>storage,ready:false,Module:{_dune_web_audio_levels:(...levels)=>(calls.push(levels),1)}};
 vm.createContext(context);vm.runInContext(declaration+'\nthis.settings=audioSettings;',context);
 assert.equal(context.settings.apply(),false);assert.deepEqual(calls,[]);
 context.ready=true;assert.equal(context.settings.apply(),true);assert.deepEqual(calls,[[50,0]]);
});

test('successful native save loads reapply browser audio levels; failed and legacy loads do not',()=>{
 const start=shell.indexOf('function loadPayload('),end=shell.indexOf('\nfunction loadGame(',start);
 assert(start>=0&&end>start);
 for(const [legacyMode,accepted,applied]of [[false,true,1],[false,false,0],[true,true,0]]){
  const calls=[],context={ready:true,legacyMode,atob,Uint8Array,audioSettings:{restoreNativeMute:s=>calls.push('loaded:'+s.music),apply:()=>calls.push('levels')},nativeJSON:()=>({music:0,sound:1}),cancelGesture(){},targetMode:{clear(){}},orderFeedback:{clear(){}},gameUI:null,tell(){},Module:{HEAPU8:new Uint8Array(16),_dune_get_save_buffer:()=>0,_dune_load_state_from_buffer:()=>accepted}};
  vm.createContext(context);vm.runInContext(shell.slice(start,end),context);
  assert.equal(context.loadPayload(btoa('native'),true),accepted);assert.deepEqual(calls,applied?['loaded:0','levels']:[]);
 }
});

test('shell migrates original ON/OFF only at a settled playable or main/options state, never boot RAM',()=>{
 const start=shell.indexOf("  if(!legacyMode&&['main','options','pause','map','building']"),end=shell.indexOf('\n  const needsBuilding',start);
 assert(start>=0&&end>start);
 for(const [scene,sceneReady,inputReady,expected]of [['boot',true,true,0],['title',true,true,0],['main',false,true,0],['options',true,false,0],['main',true,true,1],['map',true,true,1]]){
  let observed=0,applied=0;
  vm.runInNewContext(shell.slice(start,end),{legacyMode:false,campaign:{scene,sceneReady,inputReady},audioSettings:{observeNative(){observed++;return true;},apply(){applied++;}}});
  assert.equal(observed,expected);assert.equal(applied,expected);
 }
});
