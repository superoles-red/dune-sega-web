import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GameLanguage,LANGUAGES,LANGUAGE_KEY} from '../web/i18n.mjs';
import {UI_RU} from '../web/locale-ui-ru.mjs';

function memory(){const values=new Map([['another-game-progress','keep']]);return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};}
async function loaded(storage){const previous=globalThis.fetch;globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))});try{return await new GameLanguage({storage}).load();}finally{globalThis.fetch=previous;}}

test('first visit is English; only English/Russian are selectable, and the browser remembers its choice',async()=>{
 const storage=memory(),language=await loaded(storage),changes=[];
 assert.deepEqual(LANGUAGES.map(l=>l.code),['en','ru']);assert.equal(language.code,'en');assert.equal(language.text('FIX'),'FIX');
 language.onChange(code=>changes.push(code));assert(language.setLanguage('ru'));
 assert.equal(language.text('FIX'),'РЕМОНТ');assert.equal(language.text('STOP'),'СТОП');assert.equal(language.text('EXIT'),'ВЫХОД');
 assert.equal(language.text('MUSIC: ON'),'МУЗЫКА: ВКЛ');assert.equal(language.text('Dmg: 20'),'УРОН: 20');
 assert.equal(language.text("'Thopter"),'ОРНИТОПТЕР');assert.equal(language.text('MCV'),'MCV');
 assert(!language.setLanguage('ru'));assert(!language.setLanguage('fr'));assert.deepEqual(changes,['ru']);
 assert.equal(storage.getItem(LANGUAGE_KEY),'ru');assert.equal(storage.getItem('another-game-progress'),'keep');
 assert.equal(new GameLanguage({storage}).code,'ru');assert(language.setLanguage('en'));assert.equal(language.text('FIX'),'FIX');
});

test('every native USA story sentence resolves to its reviewed Russian counterpart, including wrapped pages',async()=>{
 const language=await loaded(memory());language.setLanguage('ru');
 const review=JSON.parse(await readFile(new URL('../web/locale-story-ru.json',import.meta.url),'utf8'));let count=0;
 for(const segments of Object.values(review.segmentsByKey))for(const segment of segments){
  assert.equal(language.storyText(segment.english),segment.russian.replace(/[“”«»]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/…/g,'...'));
  assert.equal(language.storyText('  '+segment.english.replaceAll(' ','\n')+'  '),language.storyText(segment.english));++count;
 }
 assert.equal(count,254);assert.equal(language.text('Sand Snake'),'ПЕСЧАНАЯ ЗМЕЯ');
 assert(review.strings['campaign.harkonnen.1.hints'].includes('Также постройте'));
 const glyphs=language.manifest.languages.find(l=>l.code==='ru').font.glyphs;
 for(const value of Object.values(review.strings))for(const ch of language.storyText(value).toUpperCase())if(ch.charCodeAt(0)>126)assert(glyphs[ch.charCodeAt(0)],'missing story bitmap glyph '+ch);
 assert.equal(language.text('Send Order'),'ОТПРАВИТЬ ЗАКАЗ');assert.equal(language.text('Out Of Stock'),'НЕТ В НАЛИЧИИ');
});

test('Russian UI uses the complete native 8px alphabet and compact PNG commands, without replacing ASCII glyphs',async()=>{
 const language=await loaded(memory());language.setLanguage('ru');
 const manifest=language.manifest,ru=manifest.languages.find(l=>l.code==='ru'),en=manifest.languages.find(l=>l.code==='en');
 for(const text of Object.values(UI_RU))for(const ch of language.text(text).toUpperCase())if(ch.charCodeAt(0)>126)assert(ru.font.glyphs[ch.charCodeAt(0)],'missing bitmap glyph '+ch);
 assert(!ru.font.glyphs[65]);assert(en.font.glyphs[65]);assert.equal(ru.font.advance,8);
 for(const key of ['exit-enabled','fix-enabled','stop-enabled','fix-disabled','stop-disabled']){
  const bytes=await readFile(new URL('../web/language-assets/'+ru.commands[key],import.meta.url));assert.equal(bytes.readUInt32BE(16),32);assert.equal(bytes.readUInt32BE(20),24);assert(bytes.length<2000);
 }
});
