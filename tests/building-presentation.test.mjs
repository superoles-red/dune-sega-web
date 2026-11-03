import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BuildingInterface} from '../web/building-ui.mjs';
import {buildingLayoutFor} from '../web/building-layout.mjs';
import {LiveNativeFrame} from '../web/native-ui.mjs';

class Element {
 constructor(){this.style={};this.dataset={};this.attributes=new Map();this.children=[];this.listeners=new Map();this.hidden=false;this.scrollTop=0;}
 setAttribute(k,v){this.attributes.set(k,String(v));}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(k,f){this.listeners.set(k,f);}
 getContext(){return context();}
}
const context=()=>new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
function fixture(){
 const calls={tap:[],live:[],parts:[],frames:[],texts:[],rgb:0};
 const state={active:true,frame:{ready:true},context:3,menuKind:'starport',producer:{pointer:0xff4eb8,name:'STARPORT'},sourceRects:{portrait:{x:160,y:40,w:96,h:56},name:{x:160,y:104,w:96,h:8},secondaryIcon:{x:156,y:148,w:24,h:24}},detailTexts:{price:'909',secondary:'0',hp:'100'},cells:[28,31,32,1,7,9,10,13,15,16,17,255].map((raw,i)=>({index:i,col:i%3,row:Math.floor(i/3),raw,kind:i<3?'command':raw===255?'empty':'unit',key:i<3?['exit','repair','stop'][i]:'unit',name:i<3?['EXIT','FIX','STOP'][i]:'NATIVE UNIT',cost:i<3?null:909,clickable:raw!==255,visible:raw!==255,stock:19,ordered:7,disabled:true,explicitDisabledCommand:i===1||i===2,selected:i===4,previewArmed:i===4,sourceRect:{x:32+(i%3)*32,y:48+Math.floor(i/3)*24,w:32,h:24}}))};
 const skin=JSON.parse(readFileSync(new URL('../web/ui-assets/screen-assets/manifest.json',import.meta.url)));
 const art={skin,kit:{animations:{}},part(id,group='shop'){calls.parts.push([id,group]);const p=group==='screen'?skin.parts[id]:null;return {id,width:p?.width??8,height:p?.height??8};},livePart(id,frame,group='shop'){calls.live.push([id,group]);return {id,width:40,height:64};},blit(){},repeat(){},frame(c,id,x,y,w,h,options){calls.frames.push([id,options.group]);},text(c,value){calls.texts.push(value);}};
 const ui=Object.create(BuildingInterface.prototype);Object.assign(ui,{art,Module:{_dune_web_building_ui_frame_rgb(){calls.rgb++;return 1;},_dune_web_building_ui_tap_checked(...args){calls.tap.push(args);}},resumeAudio(){},frame:{valid:true,data:{data:new Uint8ClampedArray(320*224*4)},update(){return true;},crop(){}},key:'',active:false,holdFrame:false,element:new Element(),grid:new Element(),scroller:new Element(),background:new Element(),border:new Element(),cells:[],resize(){}});
 return {ui,state,calls};
}
function dom(run){const previous=globalThis.document;globalThis.document={createElement:()=>new Element()};try{return run();}finally{globalThis.document=previous;}}

test('Starport exposes native cells and prices, but no hidden stock/order availability in DOM or ARIA',()=>dom(()=>{
 const {ui,state,calls}=fixture();ui.update(state);
 assert.equal(ui.cells.length,12);assert.equal(ui.grid.children.length,12);
 const unit=ui.cells[4].button;
 assert.equal(unit.attributes.get('aria-label'),'NATIVE UNIT, price 909');
 assert.equal(unit.attributes.get('aria-disabled'),'false','native hidden stock cannot disable or annotate the HTML control');
 assert.equal(ui.cells[1].button.attributes.get('aria-label'),'FIX, unavailable','an explicitly disabled original command remains recognisable');
 unit.listeners.get('click')({stopPropagation(){}});
 assert.deepEqual(calls.tap,[[3,state.producer.pointer,1,1]],'even native-rejected purchases go through the original pointer guard');
 assert.equal(ui.cells[11].element.attributes.get('aria-hidden'),'true');
 assert.ok(!ui.cells.some(v=>/stock|ordered|в наличии|заказано|19|7/i.test(v.button?.attributes.get('aria-label')??'')));
 assert.equal(ui.stockSummary,undefined);
}));

test('Starport uses original gray chrome and four native rows without Yard purple material',()=>dom(()=>{
 const {ui,state,calls}=fixture();ui.update(state);ui.layout=buildingLayoutFor(216,384,state,2);ui.sy=2;ui.render(0);
 assert.equal(ui.layout.rows,4);assert.ok(calls.parts.some(([id,g])=>id==='starport-body-fill'&&g==='screen'));
 assert.ok(calls.frames.some(([id,g])=>id==='starport-command-cabinet'&&g==='screen'));
 assert.ok(calls.live.some(([id,g])=>id==='starport-monitor-stack'&&g==='screen'));
 assert.ok(!calls.parts.some(([id])=>/^steel-|^command-skin/.test(id)));
 assert.ok(!calls.texts.some(s=>/STOCK|ORDER|TOTAL/.test(s)));
}));

test('held native building pixels remain intact while the single exit curtain covers them',()=>dom(()=>{
 const {ui,state,calls}=fixture();ui.update(state);ui.layout=buildingLayoutFor(216,384,state,2);ui.holdFrame=true;ui.render(0);
 assert.equal(calls.rgb,0,'holding the last frame does not read a fading or old source raster');
 assert.equal(ui.active,true);assert.equal(ui.element.hidden,false);
 ui.update({active:false});assert.equal(ui.holdFrame,false);assert.equal(ui.active,false);assert.equal(ui.element.hidden,true);
}));

test('a native palette fade between outer polls cannot erase the already composed building before its exit curtain',()=>dom(()=>{
 const {ui,state,calls}=fixture();ui.update(state);ui.layout=buildingLayoutFor(216,384,state,2);ui.frame.valid=true;ui.element.style.visibility='';ui.Module._dune_web_building_ui_frame_rgb=()=>0;
 ui.frame.update=LiveNativeFrame.prototype.update;ui.frame.data.data.fill(37);const prior=ui.frame.data.data.slice();
 ui.background.getContext=()=>{throw Error('the composed canvas must not be cleared during this inter-poll gap');};
 ui.render(0);
 assert.equal(ui.frame.valid,true);assert.equal(ui.element.style.visibility,'');assert.equal(ui.element.hidden,false);assert.deepEqual(ui.frame.data.data,prior);assert.deepEqual(calls.parts,[]);
 // A new producer without a valid composed frame must still stay hidden.
 ui.frame.valid=false;ui.render(16);assert.equal(ui.element.style.visibility,'hidden');assert.equal(ui.frame.valid,false);
}));

test('all23 original Starport parts and3 modules retain native shell corners, quiet grain bands and packaged pixels',()=>{
 const source=JSON.parse(readFileSync(new URL('../data/starport-ui/manifest.json',import.meta.url))),packed=JSON.parse(readFileSync(new URL('../web/ui-assets/screen-assets/manifest.json',import.meta.url)));
 assert.deepEqual(source.bodyNativeRgbSample,[145,145,145]);assert.equal(Object.keys(source.parts).length,23);assert.equal(Object.keys(source.modules).length,3);
 const shell=source.modules['starport-command-cabinet'];assert.deepEqual(shell.nativeRect,[12,36,132,128]);assert.deepEqual(shell.insets,[20,12,16,20]);
 for(const key of ['top','bottom'])assert.equal(source.parts[shell.pieces[key]].width,8);
 for(const key of ['left','right']){assert.equal(source.parts[shell.pieces[key]].height,96);assert.equal(source.parts[shell.sideBands.middleParts[key]].height,8);}
 assert.deepEqual([shell.sideBands.top,shell.sideBands.bottom],[56,32],'native connectors and shaded lower profiles are preserved once instead of repeated');
 assert.deepEqual(source.parts['starport-monitor-stack'].sourceRect,[152,32,112,84]);assert.equal(source.junctionProof.monitorBottomExclusive,source.junctionProof.nextNativeDollarTop,'monitor crop stops before the next native resource icon');
 for(const [id,p] of Object.entries(source.parts)){assert.deepEqual(packed.parts[id],p);for(const folder of ['data/starport-ui','web/ui-assets/screen-assets']){const bytes=readFileSync(new URL('../'+folder+'/'+p.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256,id);}}
 for(const [id,m] of Object.entries(source.modules))assert.deepEqual(packed.modules[id],m);
});
