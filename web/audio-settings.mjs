// Playback preferences are separate from native saves and campaign progress.
export const AUDIO_SETTINGS_KEY='dune-sega-audio-v1';
export const AUDIO_LEVELS=Object.freeze([100,50,25,10,0]);
const kinds=['music','sound'];
const validLevel=value=>AUDIO_LEVELS.includes(value);

export class AudioSettings {
 constructor({storage,apply=()=>false}={}){
  this.storage=storage;this.applyLevels=apply;this.levels={music:100,sound:100};this.hasSaved=false;this.observedNative=false;this.error=null;
  try{
   const value=JSON.parse(storage?.getItem(AUDIO_SETTINGS_KEY)||'null');
   if(value?.version===1&&kinds.every(kind=>validLevel(value[kind]))){
    this.levels={music:value.music,sound:value.sound};this.hasSaved=true;
   }
  }catch(error){this.error=error;}
 }
 // The caller supplies a settled original state, never zero-filled boot RAM.
 // Existing ON/OFF choices migrate only when no saved level preference exists.
 observeNative(state){
  if(this.observedNative||!kinds.every(kind=>state?.[kind]===0||state?.[kind]===1||typeof state?.[kind]==='boolean'))return false;
  this.observedNative=true;
  if(this.hasSaved)return false;
  this.levels={music:state.music?100:0,sound:state.sound?100:0};return true;
 }
 // Successful old DSAV loads may restore a driver that was actually stopped.
 // An old save with a stopped driver takes precedence over a positive level.
 // Native ON never replaces a remembered playback level or output mute setting.
 restoreNativeMute(state){
  const next={...this.levels};let changed=false;
  for(const kind of kinds)if((state?.[kind]===0||state?.[kind]===false)&&next[kind]>0){next[kind]=0;changed=true;}
  if(!changed)return false;
  this.levels=next;this.observedNative=true;this.persist();return true;
 }
 persist(){
  try{this.storage?.setItem(AUDIO_SETTINGS_KEY,JSON.stringify({version:1,...this.levels}));this.hasSaved=true;this.error=null;return true;}
  catch(error){this.error=error;return false;}
 }
 cycle(kind){
  if(!kinds.includes(kind))return false;
  this.levels={...this.levels,[kind]:AUDIO_LEVELS[(AUDIO_LEVELS.indexOf(this.levels[kind])+1)%AUDIO_LEVELS.length]};
  this.observedNative=true;this.persist();this.apply();return this.levels[kind];
 }
 apply(){try{return !!this.applyLevels(this.levels.music,this.levels.sound);}catch(error){this.error=error;return false;}}
 label(kind){return (kind==='music'?'MUSIC: ':'SOUND: ')+(this.levels[kind]===0?'OFF':this.levels[kind]+'%');}
}
