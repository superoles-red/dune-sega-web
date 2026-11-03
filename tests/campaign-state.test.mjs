import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CampaignStore,freshProgress,normalizeProgress,recordVictory,canStart,LEGACY_SAVE_KEY,CONTINUE_KEY,slotKey,CAMPAIGN_KEY} from '../web/campaign-state.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
test('each native house begins at mission one, victory opens only its next stage',()=>{
 let p=freshProgress();for(let h=0;h<3;h++){assert(canStart(p,h,1));assert(!canStart(p,h,2));}
 p=recordVictory(p,1,1);assert(canStart(p,1,2));assert(!canStart(p,1,3));assert(!canStart(p,0,2));assert(!canStart(p,2,2));
 p=recordVictory(p,1,2);p=recordVictory(p,1,1);assert.equal(p.houses[1].unlocked,3);assert.deepEqual(p.houses[1].completed,[1,2]);
 p=recordVictory(p,1,9);assert.equal(p.houses[1].unlocked,9);assert(!canStart(p,1,10));
});
test('malformed storage is bounded and does not invent completed missions',()=>{
 const p=normalizeProgress({version:1,lastHouse:99,houses:[{unlocked:100,completed:[0,1,1,2,20,'3']},null,{unlocked:7,completed:[]}]});
 assert.equal(p.lastHouse,1);assert.equal(p.houses[0].unlocked,3);assert.deepEqual(p.houses[0].completed,[1,2]);assert.equal(p.houses[2].unlocked,7);
 for(const [h,m] of [[-1,1],[3,1],[1,0],[1,10],[1,NaN]])assert(!canStart(p,h,m));
});
test('one Continue replaces the prior house while each house keeps its unlocks',()=>{
 const storage=memory();storage.setItem(LEGACY_SAVE_KEY,'OLD-SLOT');const a=new CampaignStore(storage);
 a.adoptResume(1,6);assert(a.saveSlot(1,6,'AQID'));assert.equal(a.resumable().house,1);
 a.selectHouse(0);assert.equal(a.resumable().house,1,'viewing a house must not reset Continue');
 assert(a.begin(0,1));assert.equal(a.resumable(),null,'confirmed new run clears the old Continue immediately');
 assert(!a.saveSlot(1,6,'AQID'),'a stale old campaign cannot replace the newly started run');
 assert(a.saveSlot(0,1,'BAUG'));
 const b=new CampaignStore(storage);assert.equal(b.getSlot(1),null);assert.equal(b.resumable().house,0);assert.equal(b.legacy(),null);
 assert.equal(b.progress.houses[1].unlocked,6);assert.deepEqual(b.progress.houses[1].completed,[]);
 b.complete(0,1);assert.equal(b.resumable(),null);assert.equal(b.progress.houses[0].unlocked,2);
 assert.equal(storage.getItem(LEGACY_SAVE_KEY),'OLD-SLOT','historical bytes remain recoverable but cannot reappear as Continue');
});
test('migration chooses the newest legitimate old slot and never resurrects archives after a new run',()=>{
 const storage=memory();storage.setItem(slotKey(0),'{broken');
 storage.setItem(slotKey(1),JSON.stringify({version:1,house:1,mission:2,state:'AQID',savedAt:100}));
 storage.setItem(slotKey(2),JSON.stringify({version:1,house:2,mission:3,state:'BAUG',savedAt:200}));
 const a=new CampaignStore(storage);assert.equal(a.resumable().house,2);assert.equal(JSON.parse(storage.getItem(CONTINUE_KEY)).house,2);
 a.begin(0,1);const b=new CampaignStore(storage);assert.equal(b.resumable(),null);assert.equal(b.getSlot(2),null);
 assert.ok(storage.getItem(slotKey(2)),'migration preserves original bytes for recovery');
});
test('a confirmed defeat ends the shared Continue without removing mission unlocks',()=>{
 const a=new CampaignStore(memory());a.adoptResume(2,5);a.saveSlot(2,5,'AQID');a.finish(2,5);
 assert.equal(a.resumable(),null);assert.equal(a.progress.lastRun,null);assert.equal(a.progress.houses[2].unlocked,5);
});
test('storage failure keeps earned progress in memory and reports failure',()=>{
 const a=new CampaignStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});assert.equal(a.complete(2,1),false);assert.equal(a.progress.houses[2].unlocked,2);assert(a.error);
});
