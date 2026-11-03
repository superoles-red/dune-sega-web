import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const enBytes=read('web/language-assets/en.json'),rawRu=read('web/language-assets/ru.json');
const en=JSON.parse(enBytes),ruBytes=read('web/locale-story-ru.json'),ru=JSON.parse(ruBytes);
const story=Object.fromEntries(Object.entries(en.strings).filter(([key])=>key.startsWith('campaign.')||key.startsWith('house.')&&key.endsWith('.intro')));
const normalize=s=>s.replace(/\s+/g,' ').trim();
const sentences=s=>(s.match(/[^.!?]+[.!?]?/g)||[]).map(normalize).filter(Boolean);
const hash=b=>createHash('sha256').update(b).digest('hex');

test('Russian story covers every canonical USA passage and native sentence without changed numbers',()=>{
 assert.deepEqual(Object.keys(ru.strings),Object.keys(story));
 assert.equal(Object.keys(ru.strings).length,111);
 let occurrences=0,numbers=0;const unique=new Set();
 for(const [key,original] of Object.entries(story)){
  const parts=sentences(original),translated=ru.segmentsByKey[key];
  assert.equal(translated.length,parts.length,key);
  assert.equal(ru.strings[key],translated.map(s=>s.russian).join(' '),key);
  assert.equal(ru.bySourceText[original],ru.strings[key],key);
  parts.forEach((part,index)=>{
   const item=translated[index];assert.equal(item.index,index);assert.equal(item.english,part);
   assert.equal(ru.sentences[part],item.russian,`${key}:${index}`);
   assert.match(item.russian,/[А-Яа-яЁё]/);
   assert.deepEqual(item.russian.match(/\d+/g)||[],part.match(/\d+/g)||[],key);
   numbers+=(part.match(/\d+/g)||[]).length;occurrences++;unique.add(part);
  });
 }
 assert.equal(occurrences,254);assert.equal(unique.size,224);assert.equal(numbers,9);
 assert.equal(ru.review.canonicalSentenceOccurrences,occurrences);
 assert.equal(ru.review.uniqueSentenceTranslations,unique.size);
 assert.equal(ru.review.sourceSha256,hash(enBytes));
 for(const [pointer,text] of Object.entries(en.nativeTexts))if(text in ru.bySourceText)assert.equal(ru.nativeTexts[pointer],ru.bySourceText[text],pointer);
});

test('reviewed Russian preserves the original first missions and USA character names',()=>{
 const intro=ru.strings['house.harkonnen.intro'];
 assert.match(intro,/Гьеди Прайм/);assert.match(intro,/к друзьям, и к врагам/);
 assert(!/убить.*мать/i.test(intro),'the unrelated fan intro must not replace the USA speech');
 assert.match(ru.strings['campaign.harkonnen.1.briefing'],/1000 кредитов/);
 assert.match(ru.strings['campaign.harkonnen.1.briefing'],/собирая спайс/);
 assert.match(ru.strings['campaign.harkonnen.1.briefing'],/построить спайс-завод/);
 for(const house of ['atreides','ordos'])assert.match(ru.strings[`campaign.${house}.9.briefing`],/Фредерик/);
 assert.match(ru.strings['campaign.atreides.1.briefing'],/Кирилл/);
 assert.match(ru.strings['campaign.ordos.1.briefing'],/Аммон/);
});

test('story overlay retains raw translation provenance and a byte-identical canonical data mirror',()=>{
 assert.equal(ru.review.rawFanTranslationSha256,hash(rawRu));
 assert.equal(ru.review.rawFanTranslationModified,false);assert.equal(ru.review.gameplayModified,false);
 assert.deepEqual(read('data/locale-story-ru/locale-story-ru.json'),ruBytes);
});
