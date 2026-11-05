import test from 'node:test';import assert from 'node:assert/strict';
import {LiveNativeFrame} from '../web/native-ui.mjs';import {contextAction} from '../web/context-action.mjs';
test('unchanged exact native pixels do not upload again; a last-pixel change is retained',()=>{
 const old=globalThis.document;let uploads=0;const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){uploads++;}};globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 try{const frame=new LiveNativeFrame(),Module={HEAPU8:new Uint8Array(320*224*3+64)};Module.HEAPU8.fill(37);assert(frame.update(Module,16));assert.equal(uploads,1);assert.equal(frame.revision,1);assert(frame.update(Module,16));assert.equal(frame.changed,false);assert.equal(uploads,1);Module.HEAPU8[16+320*224*3-1]=99;assert(frame.update(Module,16));assert.equal(uploads,2);assert.equal(frame.revision,2);assert.equal(frame.data.data.at(-2),99);assert.equal(frame.data.data.at(-1),255);frame.valid=false;assert(frame.update(Module,16));assert.equal(uploads,3,'a native state load invalidates the cache even if pixels happen to match');}finally{globalThis.document=old;}
});
test('unit action is visible before arming, then follows the exact native B guard',()=>{
 assert.equal(contextAction({}),null);assert.equal(contextAction({selfAvailable:true,selfKind:'devastator'}),null);assert.equal(contextAction({selfAvailable:true,selfKind:'mcv'}),null);assert.equal(contextAction({selfAvailable:true,selfKind:'devastator',bAvailable:true,bKind:'confirm-devastator'}).method,'b');assert.equal(contextAction({selfAvailable:false,bAvailable:true,bKind:'confirm-native'}).label,'CONFIRM');assert.equal(contextAction({selfAvailable:true,placementActive:true}),null);
});
