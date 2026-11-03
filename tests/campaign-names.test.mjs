import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {displayMissionName} from '../web/campaign-names.mjs';

test('all three first missions display BEGINNING without changing source names/passwords',()=>{
 const source=JSON.parse(readFileSync(new URL('../data/campaign/manifest.json',import.meta.url))),before=JSON.stringify(source);
 for(const house of source.houses){
  for(const mission of house.missions){
   const name=displayMissionName(house.id,mission.mission,mission.name);
   assert.equal(name,mission.mission===1?'BEGINNING':mission.name||'MISSION '+mission.mission);
  }
 }
 assert.equal(JSON.stringify(source),before);
});

test('display fallback preserves supplied labels for other missions and unknown houses',()=>{
 assert.equal(displayMissionName(0,1,'TRISTA'),'BEGINNING');
 assert.equal(displayMissionName(1,1,''),'BEGINNING');
 assert.equal(displayMissionName(2,1),'BEGINNING');
 assert.equal(displayMissionName(1,4,'Native Name'),'Native Name');
 assert.equal(displayMissionName(2,4),'MISSION 4');
 assert.equal(displayMissionName(-1,1,'SOURCE'),'SOURCE');
});
