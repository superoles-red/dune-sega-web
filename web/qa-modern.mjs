// Local ?qa controls. Only ordinary original v2 saves enter the game, through
// the supplied existing loadPayload function. No CPU/RAM writes or win actions.
const HOUSE_NAMES=['Harkonnen','Atreides','Ordos'];
const EVENT_TYPES=['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','touchstart','touchend','touchmove','wheel','keydown','keyup'];
const base64=bytes=>{const parts=[];for(let i=0;i<bytes.length;i+=0x8000)parts.push(String.fromCharCode(...bytes.subarray(i,i+0x8000)));return btoa(parts.join(''));};
const json=(value)=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?String(v):v,2);
function nativeJSON(Module,name){
 try{const fn=Module?.[name];if(typeof fn!=='function'||!Module.HEAPU8)return null;const at=fn();if(!at||at>=Module.HEAPU8.length)return null;let end=at;while(end<Module.HEAPU8.length&&end-at<65536&&Module.HEAPU8[end])end++;return JSON.parse(new TextDecoder().decode(Module.HEAPU8.subarray(at,end)));}catch(error){return {readError:error.message};}
}
function v2(bytes){if(bytes.length<16||bytes.length>256*1024)return false;const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return d.getUint32(0,true)===0x56415344&&d.getUint32(4,true)===2&&d.getUint32(12,true)===bytes.length;}
async function checksum(bytes){if(!globalThis.crypto?.subtle)return null;const out=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...out].map(v=>v.toString(16).padStart(2,'0')).join('');}

export async function installModernQA({Module,startEngine,loadPayload,ui,pollState}){
 if(!new URLSearchParams(location.search).has('qa'))return null;
 if(typeof startEngine!=='function'||typeof loadPayload!=='function'||!ui)throw Error('Modern QA requires the real engine, native save loader and UI');
 document.getElementById('qa-modern-panel')?.remove();
 const panel=document.createElement('aside');panel.id='qa-modern-panel';panel.setAttribute('aria-label','Local native fixture QA');panel.style.cssText='position:fixed;z-index:1000;right:max(8px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));width:min(380px,calc(100vw - 16px));max-height:80dvh;overflow:auto;box-sizing:border-box;background:#111;color:#eee;padding:10px;font:12px/1.4 monospace;touch-action:pan-y;overscroll-behavior:contain';
 const stop=e=>e.stopPropagation();for(const type of EVENT_TYPES)panel.addEventListener(type,stop);
 const heading=document.createElement('strong');heading.textContent='QA · original native v2 fixtures';panel.append(heading);
 const hint=document.createElement('p');hint.textContent='Локальная проверка интерфейса. Controlled outcome scenes получены при подготовке offline fixture и не означают пройденную игроком миссию.';hint.style.cssText='margin:6px 0;font-size:11px';panel.append(hint);
 const field=(name,id)=>{const label=document.createElement('label');label.textContent=name;label.style.cssText='display:block;margin-top:7px';const select=document.createElement('select');select.id=id;select.style.cssText='display:block;width:100%;height:36px;margin:2px 0;background:#000;color:#eee;font:12px monospace;touch-action:manipulation';label.append(select);panel.append(label);return select;};
 const group=field('Набор','qa-modern-group'),house=field('Дом','qa-modern-house'),type=field('Здание / сцена','qa-modern-type'),selection=field('Fixture','qa-modern-fixture');
 const option=(parent,value,label)=>{const e=document.createElement('option');e.value=value;e.textContent=label;parent.append(e);return e;};
 option(group,'buildings','Building menus');option(group,'scenes','Captured native scenes');option(group,'controls','Native control fixtures');option(house,'all','Все дома');for(let i=0;i<3;i++)option(house,String(i),HOUSE_NAMES[i]);
 const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:9px';panel.append(row);
 const button=(label,id,action)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=label;b.style.cssText='min-height:36px;padding:5px 9px;touch-action:manipulation';b.addEventListener('click',action);row.append(b);return b;};
 const output=document.createElement('output');output.id='qa-modern-output';output.setAttribute('aria-live','polite');output.style.cssText='display:block;white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;margin-top:8px;font-size:10px;touch-action:pan-y';panel.append(output);document.body.append(panel);
 const collections={buildings:[],scenes:[],controls:[{key:'ready-yard',path:'ready-yard.bin',folder:'./qa-fixtures/',label:'Ready Yard — original paid building',house:1,type:'map',typeLabel:'Map controls',bytes:140056,sha256:'40fd8cf3f053e84662894750ee4c39f14c5430ae2e1081338a9a3b1dd01f3dcf',controlledConditions:true,provenance:'Original native v2 control fixture with a completed paid building; not earned campaign progression'}]},warnings=[];let loading=false,disposed=false,lastFixture=null;
 const report=value=>{if(!disposed)output.textContent=json(value);};
 const inputEvents=[],inputTypes=['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','mousedown','mouseup'];
 const traceInput=e=>{if(e.target!==Module.canvas)return;inputEvents.push(e.type+':'+(e.pointerType||'mouse')+':'+e.buttons+'@'+Math.round(e.clientX)+','+Math.round(e.clientY));if(inputEvents.length>18)inputEvents.shift();};
 for(const name of inputTypes)window.addEventListener(name,traceInput,{capture:true,passive:true});
 const snapshot=()=>({input:{events:inputEvents,gesture:(({mode,taps,panEvents,placementDrags})=>({mode,taps,panEvents,placementDrags}))(JSON.parse(document.getElementById('gesture-state')?.textContent||'{}')),selected:nativeJSON(Module,'_dune_web_actions_debug')?.selected},fixture:lastFixture,ui:ui.debug?.()??{view:ui.view,busy:ui.busy},native:nativeJSON(Module,'_dune_web_campaign_json'),building:nativeJSON(Module,'_dune_web_building_ui_json')});
 const capture=()=>{pollState?.();const data=snapshot();report(data);return data;};
 const filtered=()=>collections[group.value].filter(e=>house.value==='all'||String(e.house)===house.value);
 const fillFixtures=()=>{const before=selection.value;selection.replaceChildren();let count=0;for(const entry of filtered()){if(type.value!=='all'&&String(entry.type)!==type.value)continue;option(selection,entry.key,entry.label);count++;}if([...selection.options].some(o=>o.value===before))selection.value=before;load.disabled=loading||!count;};
 const fillTypes=()=>{const before=type.value;type.replaceChildren();option(type,'all','Все');const values=new Map();for(const e of filtered())values.set(String(e.type),e.typeLabel);for(const [value,label] of [...values].sort((a,b)=>a[1].localeCompare(b[1])))option(type,value,label);if([...type.options].some(o=>o.value===before))type.value=before;fillFixtures();};
 async function loadSelected(){
  if(loading||disposed)return false;const fixture=collections[group.value].find(e=>e.key===selection.value);if(!fixture){report({error:'Fixture не выбран'});return false;}
  loading=true;ui.busy=true;load.disabled=true;group.disabled=house.disabled=type.disabled=selection.disabled=true;if(Number.isFinite(ui.sequence))ui.sequence++;
  report({loading:true,fixture:fixture.label,provenance:fixture.provenance});
  try{
   await startEngine();const response=await fetch(new URL(fixture.folder+fixture.path,import.meta.url));if(!response.ok)throw Error('Fixture HTTP '+response.status);
   const bytes=new Uint8Array(await response.arrayBuffer());if(!v2(bytes))throw Error('Fixture is not an ordinary original v2 save');if(fixture.bytes&&bytes.length!==fixture.bytes)throw Error('Fixture length differs from native manifest');
   const actual=await checksum(bytes);if(actual&&fixture.sha256&&actual!==fixture.sha256)throw Error('Fixture SHA-256 differs from native manifest');
   if(!await loadPayload(base64(bytes),true))throw Error('Existing native save loader rejected the fixture');
   ui.dialog?.close(false);ui.tutorial?.hide();ui.buildingExitFading=false;ui.building.holdFrame=false;ui.view='native';ui.busy=false;ui.bootTarget=null;ui.pendingScreen=null;ui.nativeBusy=false;ui.demoMode=false;ui.trainingMode=false;ui.nativeTransition=null;ui.completionTransition=false;ui.coldHomeVideo=false;ui.waitingForFrame=true;ui.displayed='qa-loading';ui.curtain?.cover({instant:true});ui.lastNativeKey='';ui.activeRun=null;ui.requestedRun=null;ui.resuming=false;ui.paintKey='';lastFixture={key:fixture.key,label:fixture.label,controlledConditions:!!fixture.controlledConditions,provenance:fixture.provenance,sha256:actual||fixture.sha256,sha256Checked:!!actual};
   pollState?.();report({loaded:true,...snapshot()});return true;
  }catch(error){report({loaded:false,error:error.message,fixture:fixture.label});return false;}
  finally{loading=false;ui.busy=false;group.disabled=house.disabled=type.disabled=selection.disabled=false;fillFixtures();}
 }
 const toggle=document.createElement('button');toggle.id='qa-modern-toggle';toggle.textContent='QA';toggle.hidden=true;toggle.style.cssText='position:fixed;z-index:1001;right:8px;bottom:8px;min-width:44px;min-height:44px';document.body.append(toggle);toggle.addEventListener('click',()=>{panel.hidden=false;toggle.hidden=true;});
 const load=button('Load native save','qa-modern-load',loadSelected);button('Snapshot JSON','qa-modern-snapshot',capture);button('Скрыть QA','qa-modern-hide',()=>{panel.hidden=true;toggle.hidden=false;});
 group.addEventListener('change',fillTypes);house.addEventListener('change',fillTypes);type.addEventListener('change',fillFixtures);
 report({loadingCatalogues:true});load.disabled=true;
 const jobs=await Promise.allSettled(['buildings','scenes'].map(async kind=>{const folder='./qa-fixtures/'+kind+'/',response=await fetch(new URL(folder+'manifest.json',import.meta.url));if(!response.ok)throw Error(kind+' manifest HTTP '+response.status);return {kind,folder,manifest:await response.json()};}));
 for(const job of jobs){if(job.status!=='fulfilled'){warnings.push(job.reason.message);continue;}const {kind,folder,manifest}=job.value;
  for(const entry of manifest.fixtures||[]){if(!entry.key||!/^[\w.-]+\.state\.bin$/.test(entry.path||''))continue;const h=entry.house,houseLabel=Number.isInteger(h)&&h>=0&&h<3?HOUSE_NAMES[h]:'Other';collections[kind].push({...entry,folder,type:kind==='buildings'?entry.producerType:entry.scene,typeLabel:kind==='buildings'?String(entry.producerType).padStart(2,'0')+' · '+entry.producerName:entry.scene||'Unknown native scene',label:kind==='buildings'?houseLabel+' · '+entry.producerName+' · '+entry.key:(entry.label||entry.key),provenance:entry.provenance||manifest.fixturePolicy||manifest.policy||'Original native v2 fixture'});}
 }
 for(const o of group.options)o.disabled=!collections[o.value].length;if(!collections[group.value].length&&collections.scenes.length)group.value='scenes';fillTypes();report({ready:true,catalogues:{buildings:collections.buildings.length,scenes:collections.scenes.length},warnings});
 return {panel,output,loadSelected,snapshot:capture,show(){panel.hidden=false;},hide(){panel.hidden=true;},dispose(){disposed=true;for(const name of inputTypes)window.removeEventListener(name,traceInput,true);panel.remove();toggle.remove();}};
}
