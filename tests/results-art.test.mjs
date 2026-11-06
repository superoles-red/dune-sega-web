import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GameInterface,nativeResultsDecor} from '../web/game-ui.mjs';

test('password replacement retains the original mission-specific art for all nine missions',()=>{
 const original=['results-soldier-scene','results-aircraft-scene','results-final-tanks-scene','results-soldier-scene','results-aircraft-scene','results-final-tanks-scene','results-soldier-scene','results-aircraft-scene','results-final-tanks-scene'];
 assert.deepEqual(Array.from({length:9},(_,i)=>nativeResultsDecor(i+1)),original);
 for(const invalid of [0,10,NaN,undefined,'2'])assert.equal(nativeResultsDecor(invalid),'results-soldier-scene');
});
test('the completion parts resolve to the audited original ROM table and include the complete aircraft crop',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../web/ui-assets/screen-assets/manifest.json',import.meta.url))),proof=JSON.parse(readFileSync(new URL('../data/native-results-art/proof.json',import.meta.url)));
 assert.equal(manifest.resultsMissionArt.nativeFunction,0x26c68);assert.equal(manifest.resultsMissionArt.nativeMapTable,0x26c5c);
 for(const entry of Object.values(manifest.resultsMissionArt.byRemainder))for(const mission of entry.missions){assert.equal(nativeResultsDecor(mission),entry.part);assert(manifest.parts[entry.part]);}
 const bytes=readFileSync(new URL('../web/ui-assets/screen-assets/'+proof.exportedPart.path,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),proof.exportedPart.sha256);
 assert.equal(bytes.readUInt32BE(16),320);assert.equal(bytes.readUInt32BE(20),128);assert.deepEqual(proof.exportedPart.sourceRect,[0,96,320,128]);
 assert(proof.nativeVariants.every(v=>v.readOnlyResultsGetterCpuUnchanged&&v.textlessOutsideActualGlyphCellsChangedPixels===0));
});
test('the real completion screen paints that art after each house and mission without consulting or changing the native game',()=>{
 for(const house of [0,1,2])for(const mission of [1,2,3,4,5,6,7,8]){
  const requests=[],painted=[],ctx={setTransform(){},clearRect(){},drawImage:source=>painted.push(source.key)};
  const ui=Object.create(GameInterface.prototype);
  Object.assign(ui,{
   clear(view){this.view=view;this.heroPaintKey='';},element:{hidden:false,dataset:{}},button(){},
   store:{progress:{houses:[{completed:[]},{completed:[]},{completed:[]}]}},
   art:{part(key,group){requests.push([key,group]);return {key,width:320,height:120};}},
   applyHomeUpdate:()=>false,curtain:{paint(){}},building:{render(){}},
   visibleNative:{},state:{outcomeMission:1},drawBackdrop(){},hero:{getBoundingClientRect:()=>({width:320,height:120})},
   heroCanvas:{width:0,height:0,getContext:()=>ctx},liveText:false,
  });
  GameInterface.prototype.showCompletion.call(ui,house,mission);
  const previousDPR=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
  try{GameInterface.prototype.render.call(ui,0);}finally{if(previousDPR===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=previousDPR;}
  assert.deepEqual(requests,[[nativeResultsDecor(mission),'screen']]);assert.deepEqual(painted,[nativeResultsDecor(mission)]);
 }
});
