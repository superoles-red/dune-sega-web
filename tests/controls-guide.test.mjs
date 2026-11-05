import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeControlsGuide,controlsGuideRows,defaultControlsMode} from '../web/controls-guide.mjs';
import {GameInterface} from '../web/game-ui.mjs';
import {UI_RU} from '../web/locale-ui-ru.mjs';

function paper({width=366,mode='touch',russian=false}={}){
 const calls={frames:[],parts:[],text:[],images:[]},arrow={native:'menu-arrow-native'},ctx={fillRect(){},drawImage:(...args)=>calls.images.push(args)};
 const doc={createElement(tag){assert.equal(tag,'canvas','the guide creates only static bitmap artwork');return {getContext:()=>ctx};}};
 const art={displayText:value=>russian?UI_RU[value]||value:value,frame:(...args)=>calls.frames.push(args),part:(...args)=>(calls.parts.push(args),arrow),text:(...args)=>calls.text.push(args)};
 const guide=composeControlsGuide({art,width,mode,doc});return {guide,calls,ctx,arrow};
}
test('touch and mouse instructions separate selection from the original command and explain empty-ground deselection',()=>{
 const touch=controlsGuideRows('touch'),mouse=controlsGuideRows('mouse');
 assert(touch.some(([title,text])=>title==='SELECT'&&text==='SINGLE TAP AN OBJECT.'));assert(touch.some(([title,text])=>title==='CLEAR SELECTION'&&text==='SINGLE TAP EMPTY GROUND.'));assert(touch.some(([title,text])=>title==='GIVE AN ORDER'&&text==='DOUBLE TAP THE TARGET.'));
 assert(mouse.some(([title,text])=>title==='SELECT'&&text==='LEFT CLICK AN OBJECT.'));assert(mouse.some(([title,text])=>title==='GIVE AN ORDER'&&text==='RIGHT CLICK THE TARGET.'));
 assert(!touch.some(([,text])=>text.includes('RIGHT CLICK')));assert(!mouse.some(([,text])=>text.includes('DOUBLE TAP')));
 assert.deepEqual(touch.find(([title])=>title==='BUILD'),mouse.find(([title])=>title==='BUILD'));
 for(const rows of [touch,mouse]){const special=rows.find(([title])=>title==='DEVASTATOR')[1];assert(special.includes('ITSELF TO ARM'));assert(special.includes('DETONATE APPEARS BELOW'));assert(!special.includes('INSTANT'));}
 assert(touch.find(([title])=>title==='PALACE')[1].includes('WHILE AIMING, DOUBLE TAP THE TARGET'));
 const palaceMouse=mouse.find(([title])=>title==='PALACE')[1];assert(palaceMouse.includes('WHILE AIMING, DOUBLE CLICK'));assert(palaceMouse.includes('LEFT OR RIGHT BUTTON'));
 assert(touch.find(([title])=>title==='MOVE THE MAP')[1].includes('SWIPE TO COAST, TOUCH TO STOP'));
 assert.equal(mouse.find(([title])=>title==='MOVE THE MAP')[1],'DRAG WITH THE LEFT BUTTON.');
});
test('coarse input selects the touch explanation while the mouse explanation remains available on hybrid devices',()=>{
 assert.equal(defaultControlsMode({matchMedia:query=>({matches:query==='(pointer: coarse)'})}),'touch');assert.equal(defaultControlsMode({matchMedia:()=>({matches:false})}),'mouse');assert.equal(defaultControlsMode({matchMedia(){throw Error('unsupported');}}),'mouse');assert.equal(defaultControlsMode(null),'mouse');
});
test('the complete static reference uses original frame, menu-arrow PNG and bitmap text calls',()=>{
 const h=paper();assert.equal(h.calls.frames[0][1],'dialog-frame');assert.deepEqual(h.calls.frames[0].slice(-1),[{group:'screen',unit:1}]);assert.deepEqual(h.calls.parts,[['menu-arrow-native','screen']]);assert.equal(h.calls.images.length,h.guide.rows.length);assert(h.calls.images.every(([image])=>image===h.arrow));
 assert(h.calls.text.length>h.guide.rows.length);assert(h.calls.text.every(call=>call[4].shadow===true&&call[4].translate===false));assert.equal(h.ctx.imageSmoothingEnabled,false);assert(h.guide.accessibility.includes('DOUBLE TAP THE TARGET.'));assert(h.guide.accessibility.includes('DETONATE APPEARS BELOW.'));
});
test('English and Russian reference glyphs fit phone and landscape widths without losing wrapped text',()=>{
 for(const russian of [false,true])for(const mode of ['touch','mouse'])for(const width of [240,296,366,720]){
  const h=paper({width,mode,russian});assert.equal(h.guide.canvas.width,width);assert(h.guide.canvas.height>300);
  for(const [,text,x,y,{scale}]of h.calls.text){assert(x>=16);assert(x+text.length*8*scale<=width-17,'glyph row stays inside original frame');assert(y+8*scale<=h.guide.canvas.height-8);}
  for(const row of h.guide.rows){const rendered=h.calls.text.map(call=>call[1]).join(' ').replace(/\s/g,'');assert(rendered.includes(row.text.replace(/\s/g,'')),'wrapping retains complete instructions');}
 }
});
test('all control labels and explanations have Russian translations covered by the original Cyrillic font',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../web/language-assets/manifest.json',import.meta.url))),glyphs=manifest.languages.find(locale=>locale.code==='ru').font.glyphs;
 const keys=new Set(['CONTROLS','TOUCH SCREEN','MOUSE',...controlsGuideRows('touch').flat(),...controlsGuideRows('mouse').flat()]);
 for(const key of keys){assert(UI_RU[key],'missing Russian control text: '+key);for(const char of UI_RU[key])if(char.charCodeAt(0)>126)assert(glyphs[char.charCodeAt(0)],'unsupported original Cyrillic glyph: '+char);}
 const h=paper({russian:true});assert(h.guide.accessibility.includes('ДВАЖДЫ КОСНИТЕСЬ ЦЕЛИ.'));assert(!h.guide.accessibility.includes('DOUBLE TAP'));
});

class Element{
 constructor(){this.children=[];this.dataset={};this.hidden=false;this.scrollTop=80;this.attributes=new Map();}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 get childElementCount(){return this.children.length;}
}
function navigation(scene){
 const ui=Object.create(GameInterface.prototype),calls={routes:[],cancels:0,fronts:0},state={scene,sceneReady:true,inputReady:true,music:1,sound:1,houseId:scene==='pause'?0:-1,activeRunArmed:scene==='pause'?1:0};
 Object.assign(ui,{art:{displayText:value=>value},state,visibleNative:state,view:'native',displayed:scene,lastNativeKey:'',busy:false,pendingScreen:null,curtain:{active:false},dialog:{active:false},building:{active:false},optionViews:new Map(),element:new Element(),actions:new Element(),footer:new Element(),hero:new Element(),message:new Element(),buttons:[],cancelGesture(){calls.cancels++;},applyArtLock(){},refreshPlatform(){},platform:{},requestRoute:target=>calls.routes.push(target)});
 ui.clear=(view,title)=>{ui.view=view;ui.title=title;ui.buttons=[];ui.optionViews.clear();ui.actions.replaceChildren();ui.footer.replaceChildren();ui.element.hidden=false;};
 ui.button=(label,action,options={},parent=ui.actions)=>{const button=new Element();parent.append(button);const view={update(text){button.label=text;}};ui.buttons.push({label,action,options,button});return {button,view};};
 ui.front=action=>{calls.fronts++;action();return Promise.resolve();};
 return {ui,calls,state};
}
test('Controls is available from both Options and Pause, offers both device explanations and returns to its exact origin',async()=>{
 for(const scene of ['options','pause']){
  const h=navigation(scene),before=JSON.stringify(h.state);h.ui.showNative(h.state);const open=h.ui.buttons.find(button=>button.options.id==='open-controls');assert(open);await open.action();assert.equal(h.ui.view,'controls');assert.equal(h.ui.controlsOrigin,scene);assert.equal(h.ui.capturesInput,true);assert.equal(h.calls.cancels,1);assert.equal(h.ui.hero.scrollTop,0);
  const touch=h.ui.buttons.find(button=>button.options.id==='controls-touch');touch.action();assert.equal(h.ui.controlsMode,'touch');const mouse=h.ui.buttons.find(button=>button.options.id==='controls-mouse');mouse.action();assert.equal(h.ui.controlsMode,'mouse');
  assert(h.ui.buttons.some(button=>button.options.id==='controls-touch'));assert(h.ui.buttons.some(button=>button.options.id==='controls-mouse'));await h.ui.back();assert.equal(h.ui.view,'native');assert.equal(h.ui.displayed,scene);assert(h.ui.buttons.some(button=>button.options.id==='open-controls'));assert.deepEqual(h.calls.routes,[]);assert.equal(JSON.stringify(h.state),before,'reading controls cannot alter original mission or settings');
 }
});
test('a pending native transition cannot open Controls, and a changed origin uses its normal return route',async()=>{
 const h=navigation('pause');h.ui.pendingScreen={target:'pause'};await h.ui.openControls();assert.equal(h.ui.view,'native');assert.equal(h.calls.fronts,0);assert.equal(h.calls.cancels,0);
 h.ui.pendingScreen=null;await h.ui.openControls();h.ui.state={...h.state,scene:'map'};await h.ui.closeControls();assert.deepEqual(h.calls.routes,['pause']);
});
