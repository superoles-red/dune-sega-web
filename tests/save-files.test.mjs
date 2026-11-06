import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {CampaignStore,CAMPAIGN_KEY,CONTINUE_KEY,LEGACY_SAVE_KEY,slotKey} from '../web/campaign-state.mjs';
import {LANGUAGE_KEY} from '../web/i18n.mjs';
import {createSaveFile,parseSaveFile,commitSaveFile,validateNativeSave,MAX_SAVE_FILE_BYTES,SAVE_COMPATIBILITY,SaveFileError} from '../web/save-files.mjs';

globalThis.crypto??=webcrypto;
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const payload=readFileSync(new URL('../web/demo.state.bin',import.meta.url)).toString('base64');
const mission=validateNativeSave(payload);
function source(){
 const storage=memory(),store=new CampaignStore(storage);store.complete(2,1);store.complete(2,2);store.adoptResume(mission.house,mission.mission);assert(store.saveSlot(mission.house,mission.mission,payload));storage.setItem(LANGUAGE_KEY,'ru');
 return {storage,store};
}
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
function signed(archive,mutate){const value=JSON.parse(JSON.stringify(archive));delete value.checksum;mutate(value);value.checksum='sha256-'+createHash('sha256').update(canonical(value)).digest('hex');return JSON.stringify(value);}
async function rejects(text,code){await assert.rejects(parseSaveFile(text),error=>error instanceof SaveFileError&&error.code===code);}

test('actual shipped native fixtures match DSAV v2 ABI, including original mission RAM',()=>{
 const build=JSON.parse(readFileSync(new URL('../docs/wasm-build.json',import.meta.url),'utf8'));
 assert.equal(SAVE_COMPATIBILITY.engineSha256,build.sha256,'new exports identify the actual shipped core');
 for(const name of ['demo','demo-harkonnen']){
  const bytes=readFileSync(new URL('../web/'+name+'.state.bin',import.meta.url)),result=validateNativeSave(bytes.toString('base64'));
  assert.equal(result.bytes,bytes.length);assert.equal(result.house,bytes.readUInt16BE(94+0xc274));assert.equal(result.mission,bytes.readUInt16BE(94+0xc050)+1);
 }
 const frontend=readFileSync(new URL('../web/frontend.state.bin',import.meta.url)).toString('base64');assert.throws(()=>validateNativeSave(frontend),{code:'invalid-payload'},'frontend menus cannot masquerade as campaign Continue');
});
test('file roundtrip preserves exact native bytes, all house progress and language without mutating source',async()=>{
 const {store,storage}=source(),before=[...storage.values],result=await createSaveFile({store,language:'ru',now:1793730000123});
 assert.match(result.filename,/^dune-2026-11-03T.*\.dune-save\.json$/);assert(result.text.length<MAX_SAVE_FILE_BYTES);assert.deepEqual([...storage.values],before);
 const archive=await parseSaveFile(result.text);assert.equal(archive.continue.state,payload);assert.equal(archive.language,'ru');assert.deepEqual(archive.progress,store.progress);assert.deepEqual(archive.compatibility,SAVE_COMPATIBILITY);assert(Object.isFrozen(archive));assert(Object.isFrozen(archive.progress.houses));
 const targetStorage=memory(),target=new CampaignStore(targetStorage),restored=commitSaveFile({store:target,archive});
 assert.equal(target.resumable().state,payload);assert.deepEqual(target.progress,store.progress);assert.equal(targetStorage.getItem(LANGUAGE_KEY),'ru');assert.equal(restored.continue.house,mission.house);
 const reopened=new CampaignStore(targetStorage);assert.deepEqual(reopened.progress,store.progress);assert.equal(reopened.resumable().state,payload);
});
test('progress-only backup creates a Continue tombstone and never resurrects legacy slots',async()=>{
 const original=new CampaignStore(memory());original.complete(0,1);
 const {text}=await createSaveFile({store:original}),archive=await parseSaveFile(text);assert.equal(archive.continue,null);
 const storage=memory();storage.setItem(LEGACY_SAVE_KEY,'old');storage.setItem(slotKey(1),JSON.stringify({version:1,house:1,mission:1,state:'AQID',savedAt:100}));const store=new CampaignStore(storage);
 commitSaveFile({store,archive});assert.equal(store.resumable(),null);assert.equal(new CampaignStore(storage).resumable(),null);assert.equal(store.legacy(),null);assert.equal(storage.getItem(LEGACY_SAVE_KEY),'old');assert(storage.getItem(slotKey(1)));assert.equal(store.progress.houses[0].unlocked,2);
});
test('previous published core exports import unchanged and re-export with the current ABI-compatible core',async()=>{
 for(const oldHash of ['5156b9ee619e6a2c864d908f712f37e912cab713971d67f7fa34303a55e2e03f','e43b28261eb6b9f05c29641cd44b752755e9ef0ffd44c5387e6adbc92ff6ef2e','f4a8cb4fc34845f17652b449e11401c34cfeba6900d76fa16e926f63c0337938','319b76fc26e77cbbe2d0eed808ae72587b4ec1d5fe88ed473561c287610c81d5','d464dfb2ba1407c2a36ad9d2e01c311953db49bdb0d5d7765a10944d69dba953','4f3a8c75663e87b0f7dbcad2aff11ee36fa434d9d0a82d87a74318700ee64c22','777d313a36f86b7c46bc5994b1c43507a2ef2a9006bd80648cf4f73c7b534add']){
 const {store}=source(),{archive}=await createSaveFile({store,language:'ru'});
 const oldText=signed(archive,v=>v.compatibility.engineSha256=oldHash),old=await parseSaveFile(oldText);
 assert.equal(old.compatibility.engineSha256,oldHash);assert.equal(old.checksum,JSON.parse(oldText).checksum);
 const reparsed=await parseSaveFile(JSON.stringify(old));assert.deepEqual(reparsed,old,'verified imported archive retains a valid checksum');
 const target=new CampaignStore(memory());commitSaveFile({store:target,archive:old});
 assert.equal(target.resumable().state,payload);assert.deepEqual(target.progress,store.progress);
 const current=await createSaveFile({store:target,language:'ru'});
 assert.equal(current.archive.compatibility.engineSha256,SAVE_COMPATIBILITY.engineSha256);
 assert.equal(current.archive.continue.state,payload);assert.deepEqual(current.archive.progress,old.progress);
 for(const mutate of [v=>v.compatibility.nativeVersion=3,v=>v.compatibility.nativeBaseBytes++,v=>v.compatibility.game='dune-sega-eur',v=>v.compatibility.extra=true]){
  await rejects(signed(old,mutate),'incompatible-engine');
 }
 }
});
test('invalid JSON, unrelated data, unknown envelope fields, oversize and checksum corruption are rejected',async()=>{
 const {store}=source(),{text,archive}=await createSaveFile({store});
 await rejects('{','invalid-json');await rejects('null','invalid-format');await rejects('{}','invalid-format');await rejects(' '.repeat(MAX_SAVE_FILE_BYTES+1),'too-large');await rejects('я'.repeat(MAX_SAVE_FILE_BYTES/2+1),'too-large');
 await rejects(text.replace('dune-sega-usa','dune-sega-eur'),'checksum-mismatch');
 const bad=JSON.parse(text);bad.extra=true;await rejects(JSON.stringify(bad),'invalid-format');
 await rejects(signed(archive,v=>v.format='other-game'),'wrong-game');
 await rejects(signed(archive,v=>v.version=99),'incompatible-version');
 await rejects(signed(archive,v=>v.compatibility.engineSha256='0'.repeat(64)),'incompatible-engine');
 await rejects(signed(archive,v=>v.language='de'),'invalid-format');
});
test('invalid native header, format, truncation, encoding, and mislabeled mission are rejected before mutation',async()=>{
 const {store,storage}=source(),{archive}=await createSaveFile({store}),before=[...storage.values];
 for(const [offset,value,code]of [[0,0,'incompatible-payload'],[4,1,'incompatible-payload'],[8,0,'invalid-payload'],[12,0,'invalid-payload']]){
  const bytes=Buffer.from(payload,'base64');bytes.writeUInt32LE(value,offset);await rejects(signed(archive,v=>v.continue.state=bytes.toString('base64')),code);
 }
 await rejects(signed(archive,v=>v.continue.state=payload.slice(0,-4)),'invalid-payload');
 await rejects(signed(archive,v=>v.continue.state='!'.repeat(payload.length)),'invalid-payload');
 await rejects(signed(archive,v=>v.continue.house=(mission.house+1)%3),'mission-mismatch');
 await rejects(signed(archive,v=>v.continue.mission=mission.mission===9?8:mission.mission+1),'mission-mismatch');
 assert.deepEqual([...storage.values],before);
});
test('inconsistent progress, out-of-range house and inactive Continue metadata are rejected',async()=>{
 const {store}=source(),{archive}=await createSaveFile({store});
 await rejects(signed(archive,v=>v.progress.houses.push(v.progress.houses[0])),'invalid-progress');
 await rejects(signed(archive,v=>v.progress.houses[0].unlocked=10),'invalid-progress');
 await rejects(signed(archive,v=>v.progress.houses[0].completed=[2,1]),'invalid-progress');
 await rejects(signed(archive,v=>v.progress.lastRun=null),'invalid-continue');
 await rejects(signed(archive,v=>v.continue.savedAt=0),'invalid-continue');
 await rejects(signed(archive,v=>v.continue.house=3),'invalid-continue');
 await rejects(signed(archive,v=>v.progress.houses[mission.house].completedAt[mission.mission]=v.continue.savedAt),'invalid-progress');
});
test('commit requires an immutable archive produced by successful checksum verification',async()=>{
 const {store}=source(),{archive}=await createSaveFile({store}),target=new CampaignStore(memory());
 assert.throws(()=>commitSaveFile({store:target,archive:JSON.parse(JSON.stringify(archive))}),{code:'unverified'});
 assert.throws(()=>{archive.continue.house=99;},TypeError);
});
test('failed second persistent write restores exact old keys and leaves memory unchanged',async()=>{
 const {store:origin}=source(),{archive}=await createSaveFile({store:origin,language:'ru'});
 const storage=memory();storage.setItem(CAMPAIGN_KEY,JSON.stringify({version:1,houses:[]}));storage.setItem(CONTINUE_KEY,'previous-invalid-but-recoverable');storage.setItem(LANGUAGE_KEY,'en');storage.setItem(LEGACY_SAVE_KEY,'untouched');const target=new CampaignStore(storage),prior={progress:target.progress,current:target.current,legacyAllowed:target.legacyAllowed},before=[...storage.values];
 const set=storage.setItem;let attempts=0;storage.setItem=(key,value)=>{if(++attempts===2)throw Error('quota');return set(key,value);};
 assert.throws(()=>commitSaveFile({store:target,archive}),{code:'storage-write-failed'});assert.deepEqual([...storage.values],before);assert.equal(target.progress,prior.progress);assert.equal(target.current,prior.current);assert.equal(target.legacyAllowed,prior.legacyAllowed);
});
test('failed language write removes newly-created campaign keys and keeps unrelated data',async()=>{
 const {store:origin}=source(),{archive}=await createSaveFile({store:origin}),storage=memory();storage.setItem('unrelated','keep');const target=new CampaignStore(storage),before=[...storage.values];
 const set=storage.setItem;storage.setItem=(key,value)=>{if(key===LANGUAGE_KEY)throw Error('blocked');return set(key,value);};
 assert.throws(()=>commitSaveFile({store:target,archive}),{code:'storage-write-failed'});assert.deepEqual([...storage.values],before);assert.equal(target.resumable(),null);
});
test('explicit rollback after native loading failure restores persistent and in-memory source',async()=>{
 const {store:origin}=source(),{archive}=await createSaveFile({store:origin,language:'ru'}),storage=memory();storage.setItem(LANGUAGE_KEY,'en');storage.setItem(LEGACY_SAVE_KEY,'recoverable');const target=new CampaignStore(storage),oldProgress=target.progress,oldContinue=target.current,before=[...storage.values];
 const transaction=commitSaveFile({store:target,archive});assert.equal(target.resumable().state,payload);assert.deepEqual(transaction.rollback(),{language:'en'});assert.deepEqual([...storage.values],before);assert.equal(target.progress,oldProgress);assert.equal(target.current,oldContinue);assert.equal(target.legacyAllowed,true);assert.deepEqual(transaction.rollback(),{language:'en'},'rollback is idempotent');
});
test('storage read failure causes no writes, and rollback failure is reported distinctly',async()=>{
 const {store:origin}=source(),{archive}=await createSaveFile({store:origin});
 let writes=0;const storage=memory(),target=new CampaignStore(storage);storage.getItem=()=>{throw Error('disabled');};storage.setItem=()=>writes++;
 assert.throws(()=>commitSaveFile({store:target,archive}),{code:'storage-unavailable'});assert.equal(writes,0);
 const blocked=memory(),other=new CampaignStore(blocked),set=blocked.setItem;let n=0;blocked.setItem=(key,value)=>{if(++n===2)throw Error('quota');set(key,value);};blocked.removeItem=()=>{throw Error('blocked rollback');};
 assert.throws(()=>commitSaveFile({store:other,archive}),{code:'storage-rollback-failed'});
});
