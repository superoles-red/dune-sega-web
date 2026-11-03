import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingLayoutFor,occupiedBuildingRows} from '../web/building-layout.mjs';
import {nativeSizeForRatio} from '../web/base-prototype/layout.mjs';

// Occupancy taken from native 60-menu captures. Geometry needs no private ROM
// or .local CPU files; live price/stock/order fidelity has separate C evidence.
const fixture=name=>{const raw=name==='house1-starport-preview'?[28,31,32,1,7,9,10,13,15,16,17,255]:name==='house1-building04'?[-1,-2,-5,13,15,16,...Array(12).fill(-128)]:[-1,-2,-5,...Array(15).fill(-128)];const starport=name==='house1-starport-preview';return {context:starport?3:2,rows:starport?4:6,cells:raw.map((id,i)=>({index:i,row:Math.floor(i/3),col:i%3,raw:id,kind:id===(starport?255:-128)?'empty':i<3?'command':'unit',visible:id!==(starport?255:-128),stock:starport?3:null,ordered:0,cost:909}))};};
const formats=[[390,844],[320,568],[768,1024],[844,390],[1440,900],[800,240]];
test('Starport keeps its actual four-row order with bounded uniform icons and no extra stock/order panel',()=>{
 const state=fixture('house1-starport-preview'),before=JSON.stringify(state);assert.equal(occupiedBuildingRows(state),4);
 for(const [w,h] of formats){const size=nativeSizeForRatio(w/h),scale=h/size.height,L=buildingLayoutFor(size.width,size.height,state,scale);
  assert.equal(L.rows,4);assert.equal(L.cells.length,12);assert(!('stockSummary' in L));
  assert(L.gridWidth<=L.gridViewport.w);assert(L.cells[0].h*scale<=137,'a four-row menu never stretches to giant tall targets');
  for(const r of L.cells){assert(r.w*w/L.W>=44);assert(r.h*scale>=44);assert.equal(r.art.w/32,r.art.h/24);assert(r.art.x>=r.x&&r.art.x+r.art.w<=r.x+r.w);assert(r.art.y>=r.y&&r.art.y+r.art.h<=r.y+r.h);}
  assert.equal(L.contentHeight,L.gridHeight);assert.equal(L.scrollLimit,Math.max(0,L.contentHeight-L.gridViewport.h));
  assert.equal(L.gridViewport.x-L.cabinet.x,20);assert.equal(L.gridViewport.y-L.cabinet.y,12);assert.equal(L.cabinet.w-L.gridViewport.w,36);
  assert(L.cabinet.h<=L.gridHeight+32,'native four-row cabinet has no giant empty extension below its actual contents');
 }
 assert.equal(JSON.stringify(state),before,'layout never rewrites native stock, order, prices or cell IDs');
});
test('nonproduction buildings use one command row; factories preserve internal holes and their occupied rows',()=>{
 for(const [name,rows] of [['house1-building09',1],['house1-building02',1],['house1-building04',2]]){
  const state=fixture(name),size=nativeSizeForRatio(390/844),L=buildingLayoutFor(size.width,size.height,state,844/size.height);
  assert.equal(occupiedBuildingRows(state),rows);assert.equal(L.rows,rows);assert.equal(L.cells.length,rows*3);assert(!('stockSummary' in L));
 }
 const state={context:2,cells:Array.from({length:18},(_,i)=>({kind:[0,4,16].includes(i)?'building':'empty',visible:[0,4,16].includes(i)}))};
 const L=buildingLayoutFor(216,384,state,2);assert.equal(L.rows,6);assert.equal(L.cells.length,18,'a later occupied slot never moves across an internal hole');
});
