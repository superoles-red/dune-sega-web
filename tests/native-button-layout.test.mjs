import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeArt} from '../web/native-ui.mjs';

// Exercise the real decorator and native8px glyph positioning. The canvas only
// records destinations; source PNG loading and browser rasterization are bounds.
function buttonHarness({label,flag,selected}){
 const previous=new Map(['document','ResizeObserver','devicePixelRatio'].map(key=>[key,globalThis[key]]));
 const glyphImage={},flagImage={width:24,height:16},draws=[],attrs=new Map(),size={width:240,height:80};
 const context={setTransform(){},clearRect(){},drawImage(...args){if(args[0]===glyphImage)draws.push({x:args[5],y:args[6],w:args[7],h:args[8]});}};
 globalThis.document={createElement:()=>({setAttribute(){},getContext:()=>context})};
 globalThis.devicePixelRatio=2;
 globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 const button={classList:{add(){}},replaceChildren(){},getBoundingClientRect:()=>size,matches:()=>false,setAttribute:(key,value)=>attrs.set(key,value),getAttribute:key=>attrs.get(key),addEventListener(){},removeEventListener(){}};
 const glyphs={};for(const ch of 'ENGLISHРУССКИЙSELECTEDВЫБРАНО? ')glyphs[ch.charCodeAt(0)]={x:0,y:0};
 const font={path:'font',glyphs},art=Object.create(NativeArt.prototype);
 Object.assign(art,{ready:true,skin:{fonts:{ui:font,uiShadow:font,uiMask:font}},images:new Map([['screen:font',glyphImage]]),buttonViews:new Set(),pressedViews:new Set(),language:{revision:0},frame(){},flag:()=>flagImage,displayText:value=>value==='SELECTED'?selected:String(value)});
 const view=art.decorate(button,label,{flag,translate:false,subtitle:'SELECTED'});
 return {draws,size,view,resize(width,height){size.width=width;size.height=height;draws.length=0;view.draw();},dispose(){view.dispose();for(const [key,value]of previous)if(value===undefined)delete globalThis[key];else globalThis[key]=value;}};
}
function rows(draws){
 const result=new Map();for(const glyph of draws){const row=result.get(glyph.y)||[];row.push(glyph);result.set(glyph.y,row);}return [...result.values()];
}
function bounds(glyphs){return {left:Math.min(...glyphs.map(g=>g.x)),right:Math.max(...glyphs.map(g=>g.x+g.w))};}

test('English and Russian selected subtitles share the language-name center to the right of the flag, including after resize',()=>{
 for(const [label,flag,selected]of [['English','en','SELECTED'],['Русский','ru','ВЫБРАНО']]){
  const h=buttonHarness({label,flag,selected});try{
   for(const [width,height]of [[160,64],[240,80],[360,96]]){
    h.resize(width,height);const textRows=rows(h.draws);assert.equal(textRows.length,2);
    const flagScale=Math.min((height-12)/16,width*.28/24),textLeft=24+24*flagScale,textRight=width-8,expectedCenter=(textLeft+textRight)/2;
    for(const row of textRows){const box=bounds(row);assert.ok(Math.abs((box.left+box.right)/2-expectedCenter)<=.5,'both native glyph rows center in the same text area');assert.ok(box.left>=textLeft-.5);assert.ok(box.right<=textRight+.5);}
    assert.notEqual(expectedCenter,width/2,'the flag occupies its own leading column');
   }
  }finally{h.dispose();}
 }
});

test('a subtitle without a leading flag remains centered on the complete button',()=>{
 const h=buttonHarness({label:'English',selected:'SELECTED'});try{
  for(const row of rows(h.draws)){const b=bounds(row);assert.ok(Math.abs((b.left+b.right)/2-h.size.width/2)<=.5);}
 }finally{h.dispose();}
});
