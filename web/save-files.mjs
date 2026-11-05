import {CAMPAIGN_KEY,CONTINUE_KEY,normalizeProgress,validHouse,validMission} from './campaign-state.mjs';
import {LANGUAGE_KEY} from './i18n.mjs';

// Only the web envelope is new. The payload remains the exact existing native
// serializer's bytes; exporting/importing does not execute or patch game code.
export const SAVE_FILE_FORMAT='dune-sega-web-save';
export const SAVE_FILE_VERSION=1;
export const MAX_SAVE_FILE_BYTES=512*1024;
export const MAX_NATIVE_SAVE_BYTES=256*1024;
export const NATIVE_SAVE_BASE_BYTES=140056;
export const SAVE_COMPATIBILITY=Object.freeze({
 game:'dune-sega-usa',nativeFormat:'DSAV',nativeVersion:2,nativeBaseBytes:NATIVE_SAVE_BASE_BYTES,
 engineSha256:'319b76fc26e77cbbe2d0eed808ae72587b4ec1d5fe88ed473561c287610c81d5',
});
// Verified builds share the exact DSAV v2 ABI. Browser input adapters and
// presentation are outside the native save payload; old exports remain valid.
const compatibleEngineHashes=new Set([SAVE_COMPATIBILITY.engineSha256,
 'd464dfb2ba1407c2a36ad9d2e01c311953db49bdb0d5d7765a10944d69dba953',
 '777d313a36f86b7c46bc5994b1c43507a2ef2a9006bd80648cf4f73c7b534add',
 '4f3a8c75663e87b0f7dbcad2aff11ee36fa434d9d0a82d87a74318700ee64c22',
]);
const verifiedArchives=new WeakSet();
const encoder=new TextEncoder();
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const positiveDate=v=>Number.isSafeInteger(v)&&v>0;
const clone=v=>JSON.parse(JSON.stringify(v));
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':record(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const equal=(a,b)=>canonical(a)===canonical(b);
function deepFreeze(v){if(v&&typeof v==='object'){for(const child of Object.values(v))deepFreeze(child);Object.freeze(v);}return v;}
export class SaveFileError extends Error {constructor(code,message,cause){super(message,{cause});this.name='SaveFileError';this.code=code;}}
const fail=(code,message)=>{throw new SaveFileError(code,message);};
function exactKeys(value,keys,code='invalid-format'){
 if(!record(value)||!equal(Object.keys(value).sort(),[...keys].sort()))fail(code,'This is not a complete Dune save file.');
}
async function digest(value){
 if(!globalThis.crypto?.subtle)fail('checksum-unavailable','Save verification requires HTTPS or localhost.');
 const hash=await globalThis.crypto.subtle.digest('SHA-256',encoder.encode(canonical(value)));
 return 'sha256-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function checkedProgress(value){
 exactKeys(value,['version','lastHouse','houses','lastRun'],'invalid-progress');
 if(value.version!==1||!validHouse(value.lastHouse)||!Array.isArray(value.houses)||value.houses.length!==3)fail('invalid-progress','Mission progress is invalid.');
 for(const h of value.houses){
  exactKeys(h,['unlocked','completed','completedAt'],'invalid-progress');
  if(!validMission(h.unlocked)||!Array.isArray(h.completed)||!record(h.completedAt))fail('invalid-progress','Mission progress is invalid.');
  if(h.completed.some(m=>!validMission(m))||h.completed.length>9)fail('invalid-progress','Mission progress is invalid.');
  if(Object.entries(h.completedAt).some(([m,at])=>!h.completed.includes(Number(m))||String(Number(m))!==m||!Number.isSafeInteger(at)||at<0))fail('invalid-progress','Mission history is invalid.');
 }
 if(value.lastRun!==null){exactKeys(value.lastRun,['house','mission'],'invalid-progress');if(!validHouse(value.lastRun.house)||!validMission(value.lastRun.mission))fail('invalid-progress','Active mission is invalid.');}
 const normalized=normalizeProgress(value);
 if(!equal(value,normalized))fail('invalid-progress','Mission progress is inconsistent.');
 return normalized;
}
export function validateNativeSave(state,{house,mission}={}){
 if(typeof state!=='string'||!state.length||state.length%4!==0||state.length>Math.ceil(MAX_NATIVE_SAVE_BYTES/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(state))fail('invalid-payload','The native save is invalid.');
 let binary;try{binary=atob(state);}catch{fail('invalid-payload','The native save is invalid.');}
 if(btoa(binary)!==state)fail('invalid-payload','The native save encoding is invalid.');
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 if(bytes.length<NATIVE_SAVE_BASE_BYTES||bytes.length>MAX_NATIVE_SAVE_BYTES)fail('invalid-payload','The native save has an invalid size.');
 const view=new DataView(bytes.buffer),ymBytes=view.getUint32(8,true);
 if(view.getUint32(0,true)!==0x56415344||view.getUint32(4,true)!==2)fail('incompatible-payload','This native save format is not supported.');
 if(view.getUint32(12,true)!==bytes.length||NATIVE_SAVE_BASE_BYTES+ymBytes!==bytes.length)fail('invalid-payload','The native save is incomplete.');
 // DuneSaveState.ram starts at byte94 in the shipped little-endian v2 ABI.
 // Original 68000 words within RAM retain big-endian order (campaign adapter).
 const nativeHouse=view.getUint16(94+0xc274,false),nativeMission=view.getUint16(94+0xc050,false)+1;
 if(!validHouse(nativeHouse)||!validMission(nativeMission))fail('invalid-payload','The native save is not an active campaign mission.');
 if(house!==undefined&&(house!==nativeHouse||mission!==nativeMission))fail('mission-mismatch','The save label does not match its original mission.');
 return {bytes:bytes.length,house:nativeHouse,mission:nativeMission};
}
function checkedContinue(value,progress){
 if(value===null)return null;
 exactKeys(value,['version','house','mission','state','savedAt'],'invalid-continue');
 if(value.version!==2||!validHouse(value.house)||!validMission(value.mission)||!positiveDate(value.savedAt))fail('invalid-continue','Continue is invalid.');
 validateNativeSave(value.state,value);
 if(progress.houses[value.house].unlocked<value.mission||value.savedAt<=(progress.houses[value.house].completedAt[value.mission]||0)||!equal(progress.lastRun,{house:value.house,mission:value.mission}))fail('invalid-continue','Continue does not match mission progress.');
 return {version:2,house:value.house,mission:value.mission,state:value.state,savedAt:value.savedAt};
}
function checkedBody(value){
 exactKeys(value,['format','version','compatibility','createdAt','language','progress','continue']);
 if(value.format!==SAVE_FILE_FORMAT)fail('wrong-game','This is not a Dune Sega web save.');
 if(value.version!==SAVE_FILE_VERSION)fail('incompatible-version','This save file version is not supported.');
 if(!record(value.compatibility)||!compatibleEngineHashes.has(value.compatibility.engineSha256)||!equal({...value.compatibility,engineSha256:SAVE_COMPATIBILITY.engineSha256},SAVE_COMPATIBILITY))fail('incompatible-engine','This save belongs to a different game core.');
 if(!positiveDate(value.createdAt)||!['en','ru'].includes(value.language))fail('invalid-format','Save metadata is invalid.');
 const progress=checkedProgress(value.progress),current=checkedContinue(value.continue,progress);
 // Retain the original accepted hash, so the verified archive still matches its
 // original checksum. A fresh export records the current build's hash instead.
 return {format:SAVE_FILE_FORMAT,version:SAVE_FILE_VERSION,compatibility:{...value.compatibility},createdAt:value.createdAt,language:value.language,progress,continue:current};
}
function verified(value){deepFreeze(value);verifiedArchives.add(value);return value;}

export async function createSaveFile({store,language='en',now=Date.now()}={}){
 if(!store)fail('no-store','Save storage is unavailable.');
 const progress=clone(store.progress),slot=store.resumable();
 const current=slot?{version:2,house:slot.house,mission:slot.mission,state:slot.state,savedAt:slot.savedAt}:null;
 const body=checkedBody({format:SAVE_FILE_FORMAT,version:SAVE_FILE_VERSION,compatibility:{...SAVE_COMPATIBILITY},createdAt:now,language,progress,continue:current});
 const archive=verified({...body,checksum:await digest(body)}),text=JSON.stringify(archive,null,2)+'\n';
 if(encoder.encode(text).length>MAX_SAVE_FILE_BYTES)fail('too-large','The save file is too large.');
 const stamp=new Date(now).toISOString().replace(/[:.]/g,'-');
 return {archive,text,filename:'dune-'+stamp+'.dune-save.json'};
}
export async function parseSaveFile(text){
 if(typeof text!=='string'||text.length>MAX_SAVE_FILE_BYTES||encoder.encode(text).length>MAX_SAVE_FILE_BYTES)fail('too-large','The save file is too large.');
 let value;try{value=JSON.parse(text);}catch{fail('invalid-json','The save file could not be read.');}
 exactKeys(value,['format','version','compatibility','createdAt','language','progress','continue','checksum']);
 const {checksum,...rawBody}=value;
 if(typeof checksum!=='string'||!/^sha256-[0-9a-f]{64}$/.test(checksum))fail('invalid-checksum','The save checksum is missing or invalid.');
 if(await digest(rawBody)!==checksum)fail('checksum-mismatch','The save file is damaged or has been edited.');
 return verified({...checkedBody(rawBody),checksum});
}
export function commitSaveFile({store,archive}={}){
 if(!store||!verifiedArchives.has(archive))fail('unverified','Verify the save file before importing it.');
 const storage=store.storage;
 if(!storage?.getItem||!storage?.setItem||!storage?.removeItem)fail('storage-unavailable','The browser cannot safely replace local saves.');
 const current=archive.continue?clone(archive.continue):{version:2,state:null,savedAt:0};
 const progress=clone(archive.progress),updates=[
  [CAMPAIGN_KEY,JSON.stringify(progress)],[CONTINUE_KEY,JSON.stringify(current)],[LANGUAGE_KEY,archive.language],
 ];
 const previous={progress:store.progress,current:store.current,legacyAllowed:store.legacyAllowed,error:store.error};
 let before;try{before=new Map(updates.map(([key])=>[key,storage.getItem(key)]));}catch(error){throw new SaveFileError('storage-unavailable','The browser cannot read local saves.',error);}
 const written=[];
 try{for(const [key,value]of updates){storage.setItem(key,value);written.push(key);}}
 catch(error){
  const rollbackErrors=[];for(const key of written.reverse())try{const old=before.get(key);if(old===null)storage.removeItem(key);else storage.setItem(key,old);}catch(e){rollbackErrors.push(e);}
  if(rollbackErrors.length)throw new SaveFileError('storage-rollback-failed','Local storage failed while restoring the previous save. Keep your exported backup.',new AggregateError([error,...rollbackErrors]));
  throw new SaveFileError('storage-write-failed','The browser could not import the save. Previous saves were kept.',error);
 }
 // In-memory state changes only after all persistent writes succeed. Historic
 // migration slots are retained; the authoritative Continue key supersedes them.
 store.progress=progress;store.current=current;store.legacyAllowed=false;store.error=null;
 let committed=true;
 const rollback=()=>{
  if(!committed)return {language:before.get(LANGUAGE_KEY)};
  const errors=[];for(const [key]of [...updates].reverse())try{const old=before.get(key);if(old===null)storage.removeItem(key);else storage.setItem(key,old);}catch(e){errors.push(e);}
  Object.assign(store,previous);committed=false;
  if(errors.length)throw new SaveFileError('storage-rollback-failed','The browser could not restore the previous local save. Keep your exported backup.',new AggregateError(errors));
  return {language:before.get(LANGUAGE_KEY)};
 };
 return {language:archive.language,continue:archive.continue?clone(archive.continue):null,progress:clone(progress),rollback};
}
