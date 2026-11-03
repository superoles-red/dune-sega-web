import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {layoutFor,nativeSizeForRatio,cellAt,clampScroll} from '../web/base-prototype/layout.mjs';

const formats=[[432,768],[390,784],[320,508],[360,580],[600,740],[768,964],[1024,708],[844,330],[960,480],[1280,660],[1080,1920],[800,240],[400,280],[1280,180]];
test('six rows keep native icon proportions and usable targets across regular and short formats',()=>{
 for(const [w,h] of formats){
  const size=nativeSizeForRatio(w/h),l=layoutFor(size.width,size.height,18,h/size.height);
  assert(Math.abs((size.width/size.height)/(w/h)-1)<0.003,'canvas retains the target aspect ratio');
  assert.equal(l.rows,6);assert.equal(l.cells.length,18);
  for(const r of [l.monitor,l.title,...l.resources,l.cash,l.cabinet])assert(r.x>=0&&r.y>=0&&r.x+r.w<=l.W&&r.y+r.h<=l.H,'fixed panels stay inside the frame');
  for(const [i,r] of l.cells.entries()){
   assert.equal(r.art.w/32,r.art.h/24,'uniform native sprite scale');
   assert(r.art.x>=r.x&&r.art.y>=r.y&&r.art.x+r.art.w<=r.x+r.w&&r.art.y+r.art.h<=r.y+r.h,'native icon is never cropped');
   for(const q of l.cells.slice(i+1))assert(r.x+r.w<=q.x||q.x+q.w<=r.x||r.y+r.h<=q.y||q.y+q.h<=r.y,'choices do not overlap');
   assert(r.w*w/l.W>=44&&r.h*h/l.H>=44,'touch targets stay at least 44 CSS pixels');
   assert(!('hasPrice' in r),'no price row reserves icon space');
  }
 }
 const p=layoutFor(216,384,18);
 assert.equal(p.scrollLimit,0,'all six rows fit the standard portrait');
 assert.equal(p.titleText.y,p.title.y,'native glyphs occupy the upper eight black pixels');
 assert(p.titleText.x>=p.title.x+8&&p.titleText.x+p.titleText.w<=p.title.x+p.title.w-8);
 assert.equal(p.cabinet.y+p.cabinet.h,384);
});

test('scrolling reaches the sixth row without selecting outside the clipped purchase area',()=>{
 const size=nativeSizeForRatio(800/240),l=layoutFor(size.width,size.height,18,240/size.height),v=l.gridViewport;
 assert(l.scrollLimit>0);
 assert.equal(clampScroll(l,-100),0);assert.equal(clampScroll(l,Infinity),l.scrollLimit);
 const last=l.cells[15],lastY=last.y+last.h/2-l.scrollLimit;
 assert(lastY>=v.y&&lastY<v.y+v.h);
 assert.equal(cellAt(l,last.x+last.w/2,lastY,l.scrollLimit),15,'hit testing follows the scrolled cell');
 assert.equal(cellAt(l,last.x+last.w/2,v.y-1,l.scrollLimit),-1,'hidden first row cannot receive a tap through the information panel');
 assert.equal(cellAt(l,last.x+last.w/2,v.y+v.h+1,l.scrollLimit),-1,'cabinet border cannot select a hidden row');
});

test('late-base content uses the original six-row order and does not invent purchases',()=>{
 const data=JSON.parse(readFileSync(new URL('../web/base-prototype/assets/base-prototype-content/manifest.json',import.meta.url)));
 assert.deepEqual(data.nativeGrid.map(s=>s.raw),[-1,-2,-5,1,9,12,18,17,3,10,14,15,13,5,2,19,-128,-128]);
 assert.equal(data.nativeGrid[15].key,'upgrade');
 assert.equal(data.nativeGrid.filter(s=>s.kind==='empty').length,2);
});
