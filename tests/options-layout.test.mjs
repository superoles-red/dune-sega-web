import test from 'node:test';
import assert from 'node:assert/strict';
import {optionsSceneLayout} from '../web/options-layout.mjs';

test('the original Options illustration fits its own area without stretching or controls over it',()=>{
 for(const [width,height] of [[366,300],[1256,274],[820,117],[296,100]]){
  const p=optionsSceneLayout(width,height,{imageWidth:208,imageHeight:136});
  assert(p.x>=0&&p.y>=0&&p.x+p.width<=width+.001&&p.y+p.height<=height+.001);
  assert(Math.abs(p.width/p.height-208/136)<.00001);
  assert.equal(p.controls,undefined,'interactive controls have their own DOM row below the picture');
 }
});
