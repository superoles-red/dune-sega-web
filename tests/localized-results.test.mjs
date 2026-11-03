import test from 'node:test';
import assert from 'node:assert/strict';
import {drawLocalizedResults,drawLocalizedSceneLabels,RESULT_LABELS} from '../web/localized-results.mjs';

test('localized Results paints only labels/rank, preserving original counter/clock drawing',()=>{
 const calls=[],transforms=[];
 const ctx={save(){},restore(){},scale(...v){transforms.push(v);}};
 const art={ready:true,displayText:s=>s==='SCORE:'?'СЧЁТ:':s==='Sand Snake'?'ПЕСЧАНАЯ ЗМЕЯ':s,text(...args){calls.push(args);}};
 const overlay={ready:true,labelMask:4095,labelInk:[109,109,109],rankInk:[145,145,0],rankVisible:true,rank:'               Sand Snake'};
 const state={scene:'results',statsDisplay:{ready:false,score:'1234',time:'1:23',counts:['1','2','3','4','5','6']}};
 assert(drawLocalizedResults(ctx,art,state,{width:640,height:448,overlay}));
 assert.deepEqual(transforms,[[2,2]]);assert.equal(calls.length,13);
 assert.equal(calls[0][1],'СЧЁТ:');assert.equal(calls[12][1],'ПЕСЧАНАЯ ЗМЕЯ');
 assert.deepEqual(calls[0][4].ink,[109,109,109]);assert.deepEqual(calls[12][4].ink,[145,145,0]);
 for(const call of calls){assert(call[4].shadow&&call[4].transparent);assert(!['1234','1:23','1','2','3','4','5','6'].includes(call[1]));}
 assert.equal(RESULT_LABELS.length,12);assert.equal(overlay.rank,'               Sand Snake');
});

test('no Results overlay appears before a completed matching source label or in other native scenes',()=>{
 let draws=0;const ctx={save(){},restore(){},scale(){}},art={ready:true,text(){draws++;}};
 assert.equal(drawLocalizedResults(ctx,art,{scene:'results'},{overlay:{ready:false}}),false);
 assert.equal(drawLocalizedResults(ctx,art,{scene:'credits'},{overlay:{ready:true}}),false);
 assert.equal(draws,0);
 const overlay={ready:true,labelMask:1,labelInk:[0,0,0],rankInk:[0,0,0],rankVisible:false,rank:''};
 assert(drawLocalizedResults(ctx,art,{scene:'results'},{overlay}));
 assert.equal(draws,1,'the native early/count-up phase draws only source-present translated labels');
});

test('ending and credits follow actual partial-row native scrolling without replacing author names',()=>{
 const drawn=[],clip=[],ctx={save(){},restore(){},scale(){},beginPath(){},rect(...r){clip.push(r);},clip(){}};
 const art={ready:true,displayText:s=>s==='The End'?'КОНЕЦ':s,text(...a){drawn.push(a);}};
 const overlay={ready:true,lines:[{text:'The End',x:128,y:-3,width:56,ink:[182,182,182]},{text:'Producers',x:120,y:221,width:72,ink:[255,255,255]}]};
 assert(drawLocalizedSceneLabels(ctx,art,{scene:'credits'},{overlay}));
 assert.equal(drawn.length,2);assert.deepEqual(drawn[0].slice(1,4),['КОНЕЦ',156,-3]);assert.equal(drawn[1][3],221);
 assert.deepEqual(drawn[0][4].ink,[182,182,182]);assert.deepEqual(clip,[[0,0,320,224]]);
 assert.equal(drawLocalizedSceneLabels(ctx,art,{scene:'main'},{overlay}),false);
 assert.equal(drawn.length,2);
});
