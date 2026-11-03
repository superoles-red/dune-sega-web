// Mission unlocks remain per house. Continue is one authoritative global slot.
export const CAMPAIGN_KEY='dune-sega-campaign-v1';
export const CONTINUE_KEY='dune-sega-continue-v2';
export const LEGACY_SAVE_KEY='dune-original-aot-state-v2';
export const HOUSE_NAMES=['HARKONNEN','ATREIDES','ORDOS'];
export const MISSION_COUNT=9;
export const validHouse=h=>Number.isInteger(h)&&h>=0&&h<3;
export const validMission=m=>Number.isInteger(m)&&m>=1&&m<=MISSION_COUNT;
// Historical keys are read only during migration; they are never active slots afterwards.
export const slotKey=h=>'dune-sega-house-save-v1-'+h;
const validState=s=>typeof s==='string'&&s.length>0&&s.length<=400000&&/^[A-Za-z0-9+/]*={0,2}$/.test(s);
const sameRun=(a,h,m)=>a?.house===h&&a?.mission===m;
export function freshProgress(){return {version:1,lastHouse:1,houses:Array.from({length:3},()=>({unlocked:1,completed:[],completedAt:{}})),lastRun:null};}
export function normalizeProgress(value){
 const p=freshProgress();if(!value||value.version!==1||!Array.isArray(value.houses))return p;
 if(validHouse(value.lastHouse))p.lastHouse=value.lastHouse;
 for(let h=0;h<3;h++){
  const s=value.houses[h];if(!s||typeof s!=='object')continue;
  const completed=[...new Set(Array.isArray(s.completed)?s.completed.filter(validMission):[])].sort((a,b)=>a-b);
  const earned=completed.length?Math.min(MISSION_COUNT,completed.at(-1)+1):1;
  const completedAt={};for(const m of completed){const date=s.completedAt?.[m];if(Number.isFinite(date)&&date>=0)completedAt[m]=date;}
  p.houses[h]={completed,completedAt,unlocked:Math.max(earned,validMission(s.unlocked)?s.unlocked:1)};
 }
 const r=value.lastRun;if(r&&validHouse(r.house)&&validMission(r.mission))p.lastRun={house:r.house,mission:r.mission};
 return p;
}
export function canStart(progress,house,mission){return validHouse(house)&&validMission(mission)&&mission<=progress.houses[house].unlocked;}
export function recordVictory(progress,house,mission,now=Date.now()){
 if(!validHouse(house)||!validMission(mission))return normalizeProgress(progress);
 const p=normalizeProgress(progress),s=p.houses[house];
 s.completed=[...new Set([...s.completed,mission])].sort((a,b)=>a-b);
 s.completedAt[mission]=now;s.unlocked=Math.max(s.unlocked,Math.min(MISSION_COUNT,mission+1));p.lastHouse=house;if(sameRun(p.lastRun,house,mission))p.lastRun=null;
 return p;
}
function normalizeContinue(s){
 if(!s||s.version!==2)return null;
 if(s.state===null)return {version:2,house:validHouse(s.house)?s.house:null,mission:validMission(s.mission)?s.mission:null,state:null,savedAt:0};
 if(validHouse(s.house)&&validMission(s.mission)&&validState(s.state)&&Number.isFinite(s.savedAt)&&s.savedAt>0)return {...s,version:2};
 return null;
}
export class CampaignStore {
 constructor(storage){
  this.storage=storage;this.error=null;this.progress=freshProgress();this.current=null;this.legacyAllowed=false;
  try{this.progress=normalizeProgress(JSON.parse(storage.getItem(CAMPAIGN_KEY)||'null'));}catch(e){this.error=e;}
  try{
   const raw=storage.getItem(CONTINUE_KEY);
   if(raw!==null){this.current=normalizeContinue(JSON.parse(raw))||{version:2,state:null,savedAt:0};return;}
   const candidates=[];
   for(let h=0;h<3;h++){
    try{const s=JSON.parse(storage.getItem(slotKey(h))||'null');
     if(s?.version===1&&s.house===h&&validMission(s.mission)&&validState(s.state)&&Number.isFinite(s.savedAt)&&s.savedAt>(this.progress.houses[h].completedAt[s.mission]||0))candidates.push({...s,version:2});
    }catch(e){this.error=e;}
   }
   candidates.sort((a,b)=>b.savedAt-a.savedAt);
   this.current=candidates[0]||null;
   // Retain an unlabelled old-format save until a real new run is confirmed.
   this.legacyAllowed=!this.current&&!!storage.getItem(LEGACY_SAVE_KEY);
   if(this.current)this.writeContinue(this.current);
  }catch(e){this.error=e;}
 }
 persist(){try{this.storage.setItem(CAMPAIGN_KEY,JSON.stringify(this.progress));this.error=null;return true;}catch(e){this.error=e;return false;}}
 writeContinue(value){this.current=value;this.legacyAllowed=false;try{this.storage.setItem(CONTINUE_KEY,JSON.stringify(value));return true;}catch(e){this.error=e;return false;}}
 selectHouse(house){if(!validHouse(house))return false;this.progress.lastHouse=house;return this.persist();}
 begin(house,mission){
  if(!canStart(this.progress,house,mission))return false;
  this.progress.lastHouse=house;this.progress.lastRun={house,mission};
  this.writeContinue({version:2,house,mission,state:null,savedAt:0});this.persist();return true;
 }
 complete(house,mission){this.progress=recordVictory(this.progress,house,mission);if(sameRun(this.current,house,mission))this.writeContinue({version:2,house,mission,state:null,savedAt:0});return this.persist();}
 finish(house,mission){if(sameRun(this.progress.lastRun,house,mission))this.progress.lastRun=null;if(sameRun(this.current,house,mission))this.writeContinue({version:2,house,mission,state:null,savedAt:0});return this.persist();}
 adoptResume(house,mission){if(!validHouse(house)||!validMission(mission))return false;this.progress.houses[house].unlocked=Math.max(this.progress.houses[house].unlocked,mission);this.progress.lastHouse=house;this.progress.lastRun={house,mission};return this.persist();}
 getSlot(house=null){const s=this.current;return s&&validState(s.state)&&(house===null||s.house===house)?s:null;}
 resumable(house=null,mission=null){const s=this.getSlot(house);return s&&(mission===null||s.mission===mission)&&s.savedAt>(this.progress.houses[s.house].completedAt[s.mission]||0)?s:null;}
 saveSlot(house,mission,state){
  if(!validHouse(house)||!validMission(mission)||!validState(state))return false;
  if(this.progress.lastRun&&!sameRun(this.progress.lastRun,house,mission))return false;
  const savedAt=Math.max(Date.now(),(this.progress.houses[house].completedAt[mission]||0)+1);
  const ok=this.writeContinue({version:2,house,mission,state,savedAt});this.progress.lastRun={house,mission};this.progress.lastHouse=house;const progressOK=this.persist();return ok&&progressOK;
 }
 legacy(){if(!this.legacyAllowed)return null;try{return this.storage.getItem(LEGACY_SAVE_KEY);}catch(e){this.error=e;return null;}}
}
