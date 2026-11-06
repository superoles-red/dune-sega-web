import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../web/update.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\n/m,'');
function screen({language='en',automatic=false,failOnce=false,blocked=false}={}){
 const nodes=new Map(['status','progress','restart'].map(id=>[id,{hidden:false,disabled:false,textContent:'',removeAttribute(){},addEventListener(name,fn){this[name]=fn;}}]));
 const calls=[],navigations=[],document={documentElement:{},getElementById:id=>{assert(nodes.has(id),'no extra update panel or action: '+id);return nodes.get(id);}};
 class OfflineUpdater{
  constructor({onState}){this.onState=onState;}
  async start(options){calls.push(['start',options]);this.onState({status:'checking'});if(failOnce){failOnce=false;throw Error('network');}this.onState({status:blocked?'blocked':'ready',count:99,version:'new-package'});return false;}
  async apply(options){calls.push(['apply',options]);this.onState({status:'applying'});this.onState({status:'done',version:'new-package'});return true;}
 }
 vm.runInNewContext(script,{OfflineUpdater,document,URL,location:{href:'https://example.test/update.html'+(automatic?'?auto=1':''),replace:target=>navigations.push(target)},localStorage:{getItem:()=>language,setItem(){assert.fail('the update screen cannot write saves');}}});
 return {nodes,calls,navigations,document};
}
test('one short ready screen has one Restart action and returns directly to the game',async()=>{
 assert.equal((html.match(/<button\b/g)||[]).length,1);assert(!/<a\b/.test(html));
 for(const [language,ready,label]of [['en','UPDATE READY','RESTART GAME'],['ru','ОБНОВЛЕНИЕ ГОТОВО','ПЕРЕЗАПУСТИТЬ ИГРУ']]){
  const f=screen({language});assert.equal(f.nodes.get('status').textContent,ready);assert.equal(f.nodes.get('restart').textContent,label);assert.equal(f.nodes.get('restart').hidden,false);assert.equal(f.nodes.get('progress').hidden,true);
  await f.nodes.get('restart').click();assert.equal(f.calls.at(-1)[0],'apply');assert.equal(f.calls.at(-1)[1].restart,true);assert.deepEqual(f.navigations,['./index.html?updated=new-package']);
 }
});
test('a deferred automatic update shows the same Restart button without window counts or close-tab instructions',async()=>{
 const f=screen({automatic:true,blocked:true});assert.equal(f.calls[0][1].automatic,true);assert.equal(f.nodes.get('status').textContent,'UPDATE READY');assert.equal(f.nodes.get('restart').textContent,'RESTART GAME');
 assert.equal(f.nodes.get('restart').hidden,false);await f.nodes.get('restart').click();assert.deepEqual(f.navigations,['./index.html?updated=new-package']);
});
test('a failed download reuses that single button for Retry and never reports success',async()=>{
 const f=screen({failOnce:true});await Promise.resolve();await Promise.resolve();assert.equal(f.nodes.get('restart').textContent,'TRY AGAIN');assert.equal(f.nodes.get('restart').hidden,false);assert.equal(f.nodes.get('restart').disabled,false);assert.deepEqual(f.navigations,[]);
 f.nodes.get('restart').click();await Promise.resolve();assert.equal(f.nodes.get('status').textContent,'UPDATE READY');assert.equal(f.nodes.get('restart').textContent,'RESTART GAME');assert.equal(f.calls.length,2);
});
