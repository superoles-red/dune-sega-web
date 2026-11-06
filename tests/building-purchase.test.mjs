import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {BuildingInterface} from '../web/building-ui.mjs';
import {NativeConfirmation} from '../web/confirm-dialog.mjs';
import {GameInterface} from '../web/game-ui.mjs';

// The production preview/confirmation lifecycle and dialog are exercised here.
// The native engine boundary records its original checked pointer intent; price,
// affordability, stock, timers and payments are deliberately not simulated in JS.
class Element {
 constructor(){this.style={};this.dataset={};this.children=[];this.attributes=new Map();this.listeners=new Map();this.inert=false;this.isConnected=true;this.classList={add(){},remove(){}};}
 setAttribute(k,v){this.attributes.set(k,String(v));}
 append(...values){this.children.push(...values);}
 replaceChildren(...values){this.children=values;}
 addEventListener(k,f){this.listeners.set(k,f);}
 get firstElementChild(){return this.children[0];}
 getContext(){return {};}
 focus(){document.activeElement=this;}
 click(extra={}){this.listeners.get('click')?.({stopPropagation(){},...extra});}
}
async function dom(run){
 const previous=globalThis.document,parents=new Map(['canvas','scene-ui','building-screen','native-menu','global-fullscreen','context-actions','demo-launch'].map(id=>[id,new Element()]));parents.get('canvas').getBoundingClientRect=()=>({width:640,height:448});
 globalThis.document={createElement:()=>new Element(),activeElement:new Element(),getElementById:id=>parents.get(id)??null};
 try{return await run(parents);}finally{globalThis.document=previous;}
}
function state({context=2,kind='building',raw=9,key='windtrap',name='WINDTRAP',available=true}={}){
 const cells=Array.from({length:context===3?12:18},(_,index)=>({index,col:index%3,row:Math.floor(index/3),raw:index<3?(context===3?28+index:-1-index):context===3?255:-128,kind:index<3?'command':'empty',key:index<3?['exit','repair','stop'][index]:'empty',name:index<3?['EXIT','FIX','STOP'][index]:'',cost:null,clickable:index<3,visible:index<3,selected:index===0,previewArmed:false,sourceRect:{x:32+(index%3)*32,y:48+Math.floor(index/3)*24,w:32,h:24}}));
 Object.assign(cells[3],{raw,kind,key,name,cost:400,clickable:true,visible:true,available,affordable:false,disabled:!available});
 return {active:true,frame:{ready:true},context,menuKind:context===3?'starport':'construction-yard',producer:{pointer:0xff4eb8,id:17,type:context===3?11:8,house:1,name:'CONST YARD',product:9,flags6:0},selectedIndex:0,previewArmed:false,detailTexts:{name:'EXIT'},cells};
}
function armed(s,index=3){const next=structuredClone(s);next.selectedIndex=index;next.previewArmed=true;for(const c of next.cells){c.selected=c.index===index;c.previewArmed=c.index===index;}return next;}
function fixture(s=state()){
 const calls={tap:[],feedback:0,resume:0,reads:0,raster:[],icons:[],hover:[]};let native=s,accept=1,clock=100;
 const art={ready:false,displayText:s=>s,decorate(button,label){button.label=label;return {dispose(){},pulse(){}};}};
 const dialog=Object.create(NativeConfirmation.prototype);Object.assign(dialog,{art,active:false,views:[],feedback(){calls.feedback++;},element:new Element(),actions:new Element(),panel:new Element(),text:new Element(),preview:new Element(),background:new Element()});
 const ui=Object.create(BuildingInterface.prototype);Object.assign(ui,{art,confirmation:dialog,purchaseRequest:null,previewInFlight:null,previewNow:()=>clock,resolvePointerKind:kind=>kind,Module:{_dune_web_building_ui_tap_checked(...a){calls.tap.push(a);return accept;},_dune_web_building_ui_json(){calls.reads++;return JSON.stringify(native);},_dune_web_building_ui_frame_rgb(){return 17;},_dune_web_portrait_debug(){return JSON.stringify({active:false});},_dune_web_hover_screen(...a){calls.hover.push(a);return s.context;},UTF8ToString:value=>value},resumeAudio(){calls.resume++;},frame:{valid:true,update(Module,ptr){calls.raster.push(ptr);this.valid=true;return true;},crop(ctx,rect,...destination){calls.icons.push({rect,destination,context:ctx});}},key:'',active:false,element:new Element(),grid:new Element(),scroller:new Element(),cells:[],resize(){}});
 ui.update(s);
 return {ui,dialog,calls,setNative(value){native=value;},advance(ms){clock+=ms;ui.update(native);},reject(){accept=0;},preview(index=3){native=armed(s,index);ui.update(native);return native;}};
}
function click(ui,index=3){ui.cells[index].button.click();}
function hostFor(building){
 const calls={covers:0},host=Object.create(GameInterface.prototype);
 Object.assign(host,{building,view:'native',state:{},updateEpoch:0,lastOutcome:0,pendingScreen:null,displayed:'building',waitingForFrame:false,element:new Element(),demoButton:new Element(),isReady:()=>false,curtain:{active:false,cover(){calls.covers++;this.active=true;},reveal(){this.active=false;}}});
 return {host,calls};
}

test('two mobile item presses request the original-icon popup; only BUY can supply the payment tap',()=>dom(async parents=>{
 const {ui,dialog,calls,preview}=fixture();click(ui);click(ui);
 assert.deepEqual(calls.tap,[[2,0xff4eb8,0,1]],'a second fast tap before preview publication never supplies the purchase A');
 assert.equal(dialog.active,false);preview();
 assert.equal(dialog.active,true);assert.equal(dialog.title,'WINDTRAP');assert.deepEqual(dialog.lines,[]);assert.equal(dialog.compact,true);assert.equal(dialog.preview.hidden,false);assert.equal(dialog.previewSource.width,32);assert.equal(dialog.previewSource.height,24);
 assert.deepEqual(dialog.actions.children.map(b=>b.label),['BUY','CANCEL']);
 assert.equal(parents.get('building-screen').inert,true);assert.equal(parents.get('native-menu').inert,true);
 click(ui);assert.equal(calls.tap.length,1,'even programmatic background cell clicks cannot bypass an active modal');
 dialog.actions.children[1].click();await delay(160);
 assert.equal(calls.tap.length,1,'Cancel sends no native payment/action');assert.equal(dialog.active,false);assert.equal(parents.get('building-screen').inert,false);
 ui.update(ui.state);assert.equal(dialog.active,false,'a retained native preview cannot automatically reopen the cancelled popup');
 click(ui);assert.equal(dialog.active,true,'clicking the same retained preview reopens the popup');assert.equal(calls.tap.length,1,'reopening never accidentally buys');
 const readsBeforeBuy=calls.reads;dialog.actions.children[0].click();dialog.actions.children[0].click();await delay(160);
 assert.deepEqual(calls.tap,[[2,0xff4eb8,0,1],[2,0xff4eb8,0,1]],'Buy submits exactly the original second checked tap, once');
 assert.equal(calls.reads,readsBeforeBuy+1,'final Buy reads current native identity and preview, not only the outer UI poll');assert.equal(calls.feedback,1,'Cancel gets UI feedback; Buy retains original purchase sound');
}));

for(const product of [{kind:'upgrade',raw:19,key:'upgrade',name:'* Upgrade *'},{context:3,kind:'unit',raw:9,key:'tank',name:'COMBAT TANK',available:false}])test(product.kind+' purchase retains native Upgrade/Starport guards and hidden stock semantics',()=>dom(async()=>{
 const {ui,dialog,calls,preview}=fixture(state(product));click(ui);preview();assert.equal(dialog.active,false);click(ui);assert.equal(dialog.title,product.name);assert.deepEqual(dialog.actions.children.map(b=>b.label),['BUY','CANCEL']);
 dialog.actions.children[0].click();await delay(160);assert.equal(calls.tap.length,2);assert.ok(calls.tap.every(a=>a[0]===(product.context||2)));
 assert.equal(ui.cells[3].button.attributes.get('aria-disabled'),'false','availability/affordability cannot replace original purchase checks');
}));

for(const mutate of [s=>{s.producer.pointer++;},s=>{s.producer.id++;},s=>{s.producer.house=0;},s=>{s.cells[3].raw=12;},s=>{s.cells[3].kind='command';},s=>{s.cells[3].previewArmed=false;},s=>{s.active=false;},s=>{s.frame.ready=false;}])test('a changed native identity/catalogue/preview cannot spend after the modal has accepted: '+mutate.toString(),()=>dom(async()=>{
 const h=fixture();click(h.ui);const native=h.preview();click(h.ui);h.dialog.actions.children[0].click();const changed=structuredClone(native);mutate(changed);h.setNative(changed);await delay(160);
 assert.equal(h.calls.tap.length,1);assert.equal(h.dialog.active,false);
}));

test('leaving a producer cancels an accepted popup during its fade, invalidating its late callback',()=>dom(async()=>{
 const h=fixture();click(h.ui);h.preview();click(h.ui);h.dialog.actions.children[0].click();h.ui.update({active:false});await delay(160);
 assert.equal(h.calls.tap.length,1);assert.equal(h.ui.purchaseRequest,null);assert.equal(h.dialog.active,false);
}));

test('commands stay immediate; Exit abandons an uncompleted native preview request without a transient purchase popup',()=>dom(async()=>{
 const h=fixture();for(const i of [0,1,2])click(h.ui,i);assert.deepEqual(h.calls.tap,[[2,0xff4eb8,0,0],[2,0xff4eb8,1,0],[2,0xff4eb8,2,0]]);assert.equal(h.dialog.active,false);
 click(h.ui);assert(h.ui.purchaseRequest);h.ui.exit();assert.equal(h.ui.purchaseRequest,null);assert.equal(h.dialog.active,false);h.preview();assert.equal(h.dialog.active,false);
}));

test('a rejected initial checked preview creates no popup and can be retried',()=>dom(async()=>{
 const h=fixture();h.reject();click(h.ui);assert.equal(h.ui.purchaseRequest,null);h.preview();assert.equal(h.dialog.active,false);assert.equal(h.calls.tap.length,1);
}));

test('actual GameInterface polling preserves a queued same-building purchase through an unready monitor frame',()=>dom(async()=>{
 const h=fixture(),{host,calls}=hostFor(h.ui);click(h.ui);click(h.ui);const pending=h.ui.purchaseRequest;
 const preview=armed(h.ui.state),gap=structuredClone(preview);gap.frame.ready=false;
 host.update({scene:'building',sceneReady:false,presentationReady:false,outcomeSeq:0},null,gap);
 assert.equal(h.ui.purchaseRequest,pending);assert.equal(h.ui.active,true);assert.equal(h.ui.element.hidden,false);assert.equal(h.ui.presentationReady,false);assert.equal(h.dialog.active,false);assert.equal(calls.covers,0,'changing a monitor picture is not a new screen fade');
 h.ui.layout={};const readRaster=h.ui.Module._dune_web_building_ui_frame_rgb;h.ui.Module._dune_web_building_ui_frame_rgb=()=>{throw Error('unready source pixels must not replace the last composed screen');};h.ui.render(0);h.ui.Module._dune_web_building_ui_frame_rgb=readRaster;
 h.setNative(preview);host.update({scene:'building',sceneReady:true,presentationReady:true,outcomeSeq:0},null,preview);
 assert.equal(h.dialog.active,true);assert.equal(h.ui.purchaseRequest,pending);assert.equal(h.ui.presentationReady,true);assert.equal(h.calls.tap.length,1);
 h.dialog.actions.children[0].click();await delay(160);assert.equal(h.calls.tap.length,2,'the one explicit Buy supplies the original second native tap');
}));

test('a modal survives a same-building picture gap; an actual Cancel never reopens when pixels become ready',()=>dom(async()=>{
 const h=fixture();click(h.ui);const preview=h.preview();click(h.ui);const pending=h.ui.purchaseRequest,gap=structuredClone(preview);gap.frame.ready=false;
 h.ui.update(gap);assert.equal(h.dialog.active,true);assert.equal(h.ui.purchaseRequest,pending);
 h.dialog.actions.children[1].click();await delay(160);assert.equal(h.ui.purchaseRequest,pending);assert.equal(pending.confirmRequested,false);h.ui.update(preview);
 assert.equal(h.dialog.active,false);assert.equal(h.calls.tap.length,1);
}));

test('a producer change during an unready frame still cancels its queued purchase permanently',()=>dom(async()=>{
 const h=fixture();click(h.ui);const other=armed(h.ui.state);other.producer.id++;other.frame.ready=false;h.ui.update(other);
 assert.equal(h.ui.purchaseRequest,null);assert.equal(h.ui.active,false);other.frame.ready=true;h.ui.update(other);
 assert.equal(h.dialog.active,false);assert.equal(h.calls.tap.length,1);
}));

function pointer(ui,index,type='mouse',entered=true){ui.cells[index].button.listeners.get(entered?'pointerenter':'pointerleave')({pointerType:type});}
function withSecondProduct(){const s=state();Object.assign(s.cells[4],{raw:12,kind:'building',key:'refinery',name:'REFINERY',cost:400,clickable:true,visible:true});return s;}

test('mouse hover coalesces A/B/A to a preview-only native point; one left click then opens the purchase popup',()=>dom(async()=>{
 const h=fixture(withSecondProduct());pointer(h.ui,3);pointer(h.ui,4);pointer(h.ui,3);h.advance(34);
 assert.deepEqual(h.calls.hover,[]);assert.deepEqual(h.calls.tap,[]);
 h.advance(1);assert.deepEqual(h.calls.hover,[[97,169]],'classic640x448 fit maps exact original(48,84) cell centre');assert.deepEqual(h.calls.tap,[],'hover never queues native A, even across A/B/A');
 const selected=structuredClone(h.ui.state);selected.selectedIndex=3;for(const c of selected.cells){c.selected=c.index===3;c.previewArmed=false;}h.setNative(selected);h.ui.update(selected);
 assert.equal(h.dialog.active,false);assert.equal(h.ui.state.previewArmed,false);const count=h.calls.hover.length;h.advance(100);assert.equal(h.calls.hover.length,count,'acknowledged hover stops issuing points');
 h.ui.cells[3].button.click({pointerType:'mouse',button:0,detail:1});assert.deepEqual(h.calls.tap,[[2,0xff4eb8,0,1]],'one PCclick supplies only the native first arm');assert.equal(h.dialog.active,false);
 h.preview();assert.equal(h.dialog.active,true);assert.equal(h.dialog.title,'WINDTRAP');assert.equal(h.calls.tap.length,1);
 pointer(h.ui,4);h.advance(100);assert.equal(h.dialog.title,'WINDTRAP','hover cannot replace an already clicked/confirmed item');assert.equal(h.calls.tap.length,1);
 h.dialog.actions.children[0].click();await delay(160);assert.equal(h.calls.tap.length,2,'Buy alone supplies the native purchase A');
}));

test('touch pointerenter and secondary buttons do nothing, and QA touch override reaches shop HTML controls',()=>dom(async()=>{
 const h=fixture();pointer(h.ui,3,'touch');h.advance(100);assert.equal(h.ui.purchaseRequest,null);assert.deepEqual(h.calls.hover,[]);assert.deepEqual(h.calls.tap,[]);
 h.ui.cells[3].button.click({pointerType:'mouse',button:1,detail:1});h.ui.cells[3].button.click({pointerType:'mouse',button:2,detail:1});assert.deepEqual(h.calls.tap,[]);
 h.ui.resolvePointerKind=()=> 'touch';pointer(h.ui,3);h.advance(100);assert.deepEqual(h.calls.hover,[]);
 h.ui.cells[3].button.click({pointerType:'mouse',button:0,detail:1});h.preview();assert.equal(h.dialog.active,false,'QA mouse-as-touch first press browses only');
 h.ui.cells[3].button.click({pointerType:'mouse',button:0,detail:1});assert.equal(h.dialog.active,true,'the second QA touch press opens the popup');assert.equal(h.calls.tap.length,1);
}));

test('native portrait hover uses its authoritative flattened command region, and missing projection never queues a tap',()=>dom(async()=>{
 const h=fixture();h.ui.Module._dune_web_portrait_debug=()=>JSON.stringify({active:true,regions:[{x:0,y:243.5714,width:449,height:641.4286,nativeX:24,nativeY:40,nativeWidth:112,nativeHeight:160}]});
 pointer(h.ui,3);h.advance(35);assert.equal(h.calls.hover.length,1);assert.ok(Math.abs(h.calls.hover[0][0]-(24.5*449/112))<1e-8);assert.ok(Math.abs(h.calls.hover[0][1]-(243.5714+44.5*641.4286/160))<1e-8);
 h.ui.Module._dune_web_portrait_debug=()=>JSON.stringify({active:true,regions:[]});h.advance(50);assert.equal(h.calls.hover.length,1);assert.deepEqual(h.calls.tap,[]);
}));

test('pending mouse click pins its item while native arming is queued, and command hover never executes an action',()=>dom(async()=>{
 const h=fixture(withSecondProduct());h.ui.cells[3].button.click({pointerType:'mouse',button:0,detail:1});pointer(h.ui,4);h.advance(100);
 assert.equal(h.ui.purchaseRequest.index,3);assert.deepEqual(h.calls.hover,[]);assert.equal(h.calls.tap.length,1);
 h.preview();assert.equal(h.dialog.title,'WINDTRAP');h.dialog.close(false);await Promise.resolve();
 for(const index of [0,1,2])pointer(h.ui,index);h.advance(100);assert.equal(h.calls.tap.length,1);assert.deepEqual(h.calls.hover,[]);
}));

test('fast mobile switches keep one arm in flight; first press of the other item never opens or pays',()=>dom(async()=>{
 const h=fixture(withSecondProduct());click(h.ui,3);click(h.ui,4);click(h.ui,4);assert.equal(h.calls.tap.length,1,'the second native preview waits for the first arm to settle');
 h.preview(3);assert.deepEqual(h.calls.tap,[[2,0xff4eb8,0,1],[2,0xff4eb8,1,1]]);assert.equal(h.dialog.active,false);
 h.preview(4);assert.equal(h.dialog.active,true);assert.equal(h.dialog.title,'REFINERY');assert.equal(h.calls.tap.length,2);assert.deepEqual(h.calls.icons.at(-1).rect,{x:64,y:72,w:32,h:24});
}));

test('the modal waits for fresh native icon RGB and never crops a stale or differently selected item',()=>dom(async()=>{
 const h=fixture(withSecondProduct());click(h.ui);click(h.ui);h.ui.Module._dune_web_building_ui_frame_rgb=()=>0;const selected=h.preview();
 assert.equal(h.dialog.active,false);assert.equal(h.calls.icons.length,0);assert(h.ui.purchaseRequest.confirmRequested);
 h.ui.Module._dune_web_building_ui_frame_rgb=()=>17;const wrong=armed(withSecondProduct(),4);h.setNative(wrong);h.ui.update(selected);
 assert.equal(h.dialog.active,false);assert.equal(h.calls.icons.length,0,'current native identity/selection overrides the older outer poll');
 h.setNative(selected);h.ui.update(selected);assert.equal(h.dialog.active,true);assert.equal(h.calls.raster.at(-1),17);assert.deepEqual(h.calls.icons.at(-1).rect,{x:32,y:72,w:32,h:24});assert.deepEqual(h.calls.icons.at(-1).destination,[0,0,32,24]);assert.notEqual(h.dialog.previewSource,h.ui.frame.canvas,'the original32x24 grid crop is an independent snapshot');
 h.dialog.close(false);await Promise.resolve();const image=h.dialog.preview;h.dialog.ask({title:'RETURN TO MAIN MENU?',confirm:'MAIN MENU'});assert.equal(image.hidden,true);assert.equal(h.dialog.previewSource,null,'ordinary confirmations retain their prior title/actions-only layout');
}));

for(const variant of [
 {name:'iPhone trusted MouseEvent detail0',start:'pointerdown',kind:'touch',click:{detail:0,isTrusted:true}},
 {name:'iPhone compatibility pointerTypeMouse/detail0',start:'pointerdown',kind:'touch',click:{detail:0,pointerType:'mouse',isTrusted:true}},
 {name:'iPhone compatibility pointerTypeMouse/detail1',start:'pointerdown',kind:'touch',click:{detail:1,pointerType:'mouse',isTrusted:true}},
 {name:'Safari touchstart fallback without PointerEvents',start:'touchstart',click:{detail:0,isTrusted:true}},
 {name:'Safari touchstart plus compatibility mouse events',start:'touchstart',click:{detail:1,pointerType:'mouse',isTrusted:true},compatibility:true},
 {name:'pen activation plus compatibility MouseEvent',start:'pointerdown',kind:'pen',click:{detail:0,pointerType:'mouse',isTrusted:true},compatibility:true},
])test(variant.name+' browses on first physical press and opens on the next physical press only',()=>dom(async()=>{
 const h=fixture(),button=h.ui.cells[3].button;
 const press=()=>{button.listeners.get(variant.start)({pointerType:variant.kind});if(variant.compatibility){button.listeners.get('pointerenter')({pointerType:'mouse'});button.listeners.get('pointerdown')({pointerType:'mouse'});button.listeners.get('mousedown')({});}button.click({button:0,...variant.click});};
 press();assert.equal(h.calls.tap.length,1);assert.equal(h.ui.purchaseRequest.confirmRequested,false);h.preview();assert.equal(h.dialog.active,false,'detail0/compatibility metadata cannot turn a tap into keyboard confirmation');
 button.listeners.get('mousedown')({});button.click({button:0,pointerType:'mouse',detail:1,isTrusted:true});
 button.listeners.get('mousedown')({sourceCapabilities:{firesTouchEvents:true}});button.click({button:0,detail:0,isTrusted:false});
 assert.equal(h.dialog.active,false,'compatibility and synthetic duplicate clicks without a new real touch are ignored');assert.equal(h.ui.purchaseRequest.confirmRequested,false);assert.equal(h.calls.tap.length,1);
 press();assert.equal(h.dialog.active,true,'a genuine second touch/start opens immediately, with no extra timing wait');assert.equal(h.calls.tap.length,1,'the popup itself still does not pay');
}));

test('unknown trusted detail0 clicks are safely mobile, whereas synthetic keyboard activation opens once',()=>dom(async()=>{
 const h=fixture();h.ui.cells[3].button.click({detail:0,isTrusted:true});h.preview();assert.equal(h.dialog.active,false);
 h.ui.cells[3].button.click({detail:0,isTrusted:true});assert.equal(h.dialog.active,true);h.dialog.close(false);await Promise.resolve();
 const keyboard=fixture();keyboard.ui.cells[3].button.click({detail:0,isTrusted:false});keyboard.preview();assert.equal(keyboard.dialog.active,true);assert.equal(keyboard.calls.tap.length,1);
}));

test('a physical mouse owns a detail0 MouseEvent on desktop and activation records stay local to each cell',()=>dom(async()=>{
 const h=fixture(withSecondProduct());h.ui.cells[3].button.listeners.get('pointerdown')({pointerType:'touch'});
 const mouse=h.ui.cells[4].button;mouse.listeners.get('pointerdown')({pointerType:'mouse'});mouse.click({button:0,detail:0,isTrusted:true});h.preview(4);
 assert.equal(h.dialog.active,true);assert.equal(h.dialog.title,'REFINERY');assert.deepEqual(h.calls.tap,[[2,0xff4eb8,1,1]]);
 const hybrid=fixture(),same=hybrid.ui.cells[3].button;same.listeners.get('touchstart')({});same.click({detail:0,isTrusted:true});hybrid.preview();assert.equal(hybrid.dialog.active,false);
 same.listeners.get('pointerdown')({pointerType:'mouse'});same.click({button:0,detail:0,isTrusted:true});assert.equal(hybrid.dialog.active,true,'a genuine new mouse pointerdown is not a compatibility duplicate');
}));

test('cancelled touch activation cannot misclassify a later unknown trusted click as keyboard input',()=>dom(async()=>{
 const h=fixture(),button=h.ui.cells[3].button;button.listeners.get('pointerdown')({pointerType:'touch'});button.listeners.get('pointercancel')({});button.click({detail:0,isTrusted:true});h.preview();assert.equal(h.dialog.active,false);
 button.listeners.get('touchstart')({});button.click({detail:0,isTrusted:true});assert.equal(h.dialog.active,true);
}));
