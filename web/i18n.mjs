import {UI_RU,ACCESSIBLE_EN} from './locale-ui-ru.mjs?v=20261106-mobile5';

export const LANGUAGE_KEY='dune-sega-language-v1';
export const LANGUAGES=[{code:'en',label:'English'},{code:'ru',label:'Русский'}];
export const normaliseText=value=>String(value??'').replace(/\s+/g,' ').trim();
const key=value=>normaliseText(value).toUpperCase();
const typeSafe=value=>String(value??'').replace(/[“”«»]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/…/g,'...').replace(/\u00a0/g,' ');

export class GameLanguage {
 constructor({storage}={}){
  this.storage=storage;this.code='en';this.revision=0;this.listeners=new Set();this.lookup=new Map();this.catalogues={};
  try{const saved=storage?.getItem(LANGUAGE_KEY);if(LANGUAGES.some(l=>l.code===saved))this.code=saved;}catch{}
 }
 async load(){
  const base=new URL('./language-assets/',import.meta.url),read=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Language asset '+r.status);return r.json();};
  this.manifest=await read(new URL('manifest.json',base));
  [this.catalogues.en,this.catalogues.ru,this.story]=await Promise.all([read(new URL('en.json',base)),read(new URL('ru.json',base)),read(new URL('./locale-story-ru.json',import.meta.url))]);
  const en=this.catalogues.en,ru=this.catalogues.ru;
  for(const [id,source]of Object.entries(en.strings||{})){const target=this.story?.strings?.[id]||ru.strings?.[id];if(target)this.lookup.set(key(source),target);}
  for(const [source,target]of Object.entries(ru.bySourceText||{}))this.lookup.set(key(source),target);
  for(const [source,target]of Object.entries(this.story?.bySourceText||{}))this.lookup.set(key(source),target);
  for(const [source,target]of Object.entries(this.story?.sentences||{}))this.lookup.set(key(source),target);
  for(const [source,target]of Object.entries(UI_RU))this.lookup.set(key(source),target);
  this.font=this.manifest.languages.find(l=>l.code==='ru')?.font;
  this.publishDocumentLanguage();return this;
 }
 get russian(){return this.code==='ru';}
 publishDocumentLanguage(){if(typeof document!=='undefined'&&document.documentElement)document.documentElement.lang=this.code;}
 onChange(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 setLanguage(code){
  if(!LANGUAGES.some(l=>l.code===code)||code===this.code)return false;
  this.code=code;++this.revision;try{this.storage?.setItem(LANGUAGE_KEY,code);}catch{}
  this.publishDocumentLanguage();for(const f of this.listeners)f(code);return true;
 }
 text(value){
  const raw=String(value??'');if(!this.russian)return typeSafe(ACCESSIBLE_EN[raw]||raw);
  const source=ACCESSIBLE_EN[raw]||raw,exact=this.lookup.get(key(source));if(exact!==undefined)return typeSafe(exact);
  if(source!==raw)return raw;
  // Native decorative passwords/mission names remain unchanged. Only the UI
  // words surrounding numbers or those names are translated.
  let s=source.replace(/\bMISSION\s+(\d+)\b/gi,'МИССИЯ $1').replace(/\bDMG:\s*(\d+)/gi,'УРОН: $1');
  for(const [name,translated]of [['HARKONNEN','ХАРКОННЕНЫ'],['ATREIDES','АТРЕЙДЕСЫ'],['ORDOS','ОРДОСЫ']])s=s.replace(new RegExp('\\b'+name+'\\b','gi'),translated);
  return typeSafe(s);
 }
 storyText(value,state={}){
  if(!this.russian)return String(value??'');
  const normal=normaliseText(value),exact=this.lookup.get(key(normal));if(exact!==undefined)return typeSafe(exact);
  // The original writer may publish a wrapped group of sentences. Join the
  // reviewed translations of those actual sentences, preserving page timing.
  const sentences=normal.match(/[^.!?]+[.!?]?/g)||[];
  const translated=sentences.map(sentence=>this.lookup.get(key(sentence)));
  if(translated.length&&translated.every(t=>t!==undefined))return typeSafe(translated.join(' '));
  return this.text(normal);
 }
 debug(){return {code:this.code,revision:this.revision,available:LANGUAGES.map(l=>l.code)};}
}
