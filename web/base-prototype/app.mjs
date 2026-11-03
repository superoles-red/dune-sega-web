import {layoutFor,nativeSizeForRatio,cellAt,clampScroll} from './layout.mjs';

const canvas=document.getElementById('prototype'),ctx=canvas.getContext('2d'),stage=document.querySelector('.stage');
const stateOut=document.getElementById('prototype-state'),status=document.getElementById('status');
const ROOT='assets/';
const imageCache=new Map();
let kit,content,buildings,ui,focus,slots=[],layout,selected=4,format='portrait',paused=false,pausedAt=0,pausedOffset=0,startedAt=performance.now(),pointer=null,loaded=false,scrollY=0;
const presets={portrait:[432,768],tall:[390,845],tablet:[600,800],wide:[960,540]};
async function json(path){const r=await fetch(ROOT+path);if(!r.ok)throw new Error(path+': '+r.status);return r.json();}
async function picture(path){if(imageCache.has(path))return imageCache.get(path);const img=new Image();img.src=ROOT+path;await img.decode();imageCache.set(path,img);return img;}
const part=id=>kit.parts[id]?imageCache.get('shop-layout-kit/'+kit.parts[id].path):null;
const buildingImage=(id,key)=>imageCache.get('building-assets/'+buildings.buildings.find(b=>b.id===id)[key][0]);
const uiImage=id=>imageCache.get('shop-ui-assets/'+ui.assets.find(a=>a.id===id).path);

function blit(c,img,x,y,scale=1){c.drawImage(img,Math.round(x),Math.round(y),img.width*scale,img.height*scale);}
function tile(c,img,x,y,w,h){if(w<=0||h<=0)return;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();for(let yy=y;yy<y+h;yy+=img.height)for(let xx=x;xx<x+w;xx+=img.width)c.drawImage(img,xx,yy);c.restore();}
function nine(c,name,x,y,w,h,paintFill=true){const m=kit.modules[name],p=m.pieces,[l,t,r,b]=m.insets;
 if(paintFill)tile(c,part(p.fill),x+l,y+t,w-l-r,h-t-b);tile(c,part(p.top),x+l,y,w-l-r,t);tile(c,part(p.bottom),x+l,y+h-b,w-l-r,b);tile(c,part(p.left),x,y+t,l,h-t-b);tile(c,part(p.right),x+w-r,y+t,r,h-t-b);
 blit(c,part(p.tl),x,y);blit(c,part(p.tr),x+w-r,y);blit(c,part(p.bl),x,y+h-b);blit(c,part(p.br),x+w-r,y+h-b);
}
function three(c,name,x,y,w){const p=kit.modules[name].pieces,left=part(p.left),right=part(p.right);blit(c,left,x,y);tile(c,part(p.middle),x+left.width,y,w-left.width-right.width,left.height);blit(c,right,x+w-right.width,y);}
function text(c,value,x,y,{align='left',maxWidth=999}={}){const font=kit.fonts.ui,img=imageCache.get('shop-layout-kit/'+font.path);let str=String(value).toUpperCase();const max=Math.floor(maxWidth/8);if(str.length>max)str=str.slice(0,max);if(align==='right')x-=str.length*8;if(align==='center')x-=str.length*4;
 for(let i=0;i<str.length;i++){const code=str.charCodeAt(i),g=font.glyphs[code]||font.glyphs[32];c.drawImage(img,g.x,g.y,8,8,Math.round(x+i*8),Math.round(y),8,8);}}
function focusSpec(){return focus.focus?.yard||focus.yard||focus.animations?.yard||focus.sequences?.yard;}
function focusStates(){const s=focusSpec();return s.phases||s.frames||s.states;}
function phasePath(a){return a.path||a.png||a.file;}
function focusImage(ms){const s=focusSpec(),phases=focusStates();const period=s.cycleMilliseconds;
 const index=Math.floor((ms%period)/period*phases.length)%phases.length;
 return imageCache.get('menu-animations/'+phasePath(phases[index]));}
function drawFocus(c,img,r,u){const b=2*u,w=r.w,h=r.h,x=r.x,y=r.y;
 // Fixed native corners; the flat native border pixels repeat between them.
 const copy=(sx,sy,sw,sh,dx,dy,dw,dh)=>c.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
 copy(0,0,2,2,x,y,b,b);copy(30,0,2,2,x+w-b,y,b,b);copy(0,22,2,2,x,y+h-b,b,b);copy(30,22,2,2,x+w-b,y+h-b,b,b);
 for(let dx=x+b;dx<x+w-b;dx+=u){const dw=Math.min(u,x+w-b-dx);copy(8,0,1,2,dx,y,dw,b);copy(8,22,1,2,dx,y+h-b,dw,b);}
 for(let dy=y+b;dy<y+h-b;dy+=u){const dh=Math.min(u,y+h-b-dy);copy(0,8,2,1,x,dy,b,dh);copy(30,8,2,1,x+w-b,dy,b,dh);}
}
function animationImage(name,ms){const a=kit.animations[name];if(!a)return null;const total=a.timeline.reduce((n,t)=>n+t.durationMs,0);const t=ms%total;let run=0,pick=a.timeline[0];for(const e of a.timeline){run+=e.durationMs;if(t<run){pick=e;break;}}const s=a.states.find(s=>s.index===pick.state);return imageCache.get('shop-layout-kit/'+s.path);}
function header(c,L,ms){tile(c,part('steel-light'),0,0,L.W,24);blit(c,part('radar-clean'),28,0);blit(c,part('header-vents'),78,8);const green=animationImage('green-fixture',ms);if(green)blit(c,green,8,8);const red=animationImage('red-fixture',ms);if(red)blit(c,red,L.W-108,3);
 if(L.W>=280){const w=L.W-224;three(c,'cash-window-clean',108,10,w);text(c,'BASE',108+w/2,12,{align:'center',maxWidth:w-16});}
 three(c,'cash-window-clean',L.cash.x,L.cash.y,L.cash.w);text(c,content.creditsExample,L.cash.x+L.cash.w-8,L.cash.y+2,{align:'right',maxWidth:L.cash.w-16});
}
function currentItem(){const s=slots[selected];return s.kind==='building'?content.items.find(i=>i.id===s.raw):content.items.find(i=>i.id===8);}
function info(c,L,ms){const slot=slots[selected],item=currentItem();const m=L.monitor;blit(c,part('monitor-stack'),m.x,m.y);blit(c,buildingImage(item.id,'illustrations'),m.x+8,m.y+8);
 const name=slot.kind==='building'?item.name:slot.key==='upgrade'?'UPGRADE':'CONST YARD';text(c,name,L.titleText.x+L.titleText.w/2,L.titleText.y,{align:'center',maxWidth:L.titleText.w});
 // One complete original louver joins the monitor and the purchase cabinet.
 c.drawImage(part('resource-vent'),0,20,40,8,44,112,40,8);
 if(!L.wide&&L.W>=284){const knobX=L.resources[0].x-20;blit(c,part('resource-vent'),Math.floor((120+knobX-40)/2),38);for(const r of L.resources)blit(c,part('resource-knob'),knobX,r.y);}
 const values=slot.kind==='building'?[item.cost,Math.abs(item.power),item.hp]:['','',''];
 for(let i=0;i<3;i++){const r=L.resources[i],id=['resource-dollar','resource-power','resource-armor'][i];blit(c,part(id),r.x,r.y);const fieldX=r.x+28,fieldW=r.w-28;three(c,'meter-window',fieldX,r.y+8,fieldW);text(c,values[i],fieldX+fieldW-8,r.y+12,{align:'right',maxWidth:fieldW-16});
  if(i<2){blit(c,uiImage('native-arrow-up'),fieldX+Math.floor((fieldW-38)/2),r.y+24);blit(c,uiImage('native-arrow-down'),fieldX+Math.floor((fieldW-38)/2)+22,r.y+24);}}
}
function slotImage(s){if(s.kind==='building')return buildingImage(s.raw,'icons');return uiImage(({exit:'exit-enabled',repair:'repair-enabled','repair-disabled':'repair-disabled',stop:'stop-enabled','stop-disabled':'stop-disabled',upgrade:'upgrade-enabled'})[s.key]);}
function draw(c,L,ms,offset=0){c.imageSmoothingEnabled=false;c.clearRect(0,0,L.W,L.H);tile(c,part('steel-light'),0,0,L.W,L.H);header(c,L,ms);info(c,L,ms);const r=L.cabinet;tile(c,part('native-black'),r.x+8,r.y+8,r.w-16,r.h-16);
 const v=L.gridViewport;c.save();c.beginPath();c.rect(v.x,v.y,v.w,v.h);c.clip();c.translate(0,-clampScroll(L,offset));
 for(let i=0;i<slots.length;i++){if(slots[i].kind==='empty')continue;const cell=L.cells[i];tile(c,part('steel-medium')||part('steel-light'),cell.x,cell.y,cell.w,cell.h);const img=slotImage(slots[i]);c.drawImage(img,cell.art.x,cell.art.y,cell.art.w,cell.art.h);}
 drawFocus(c,focusImage(ms),L.cells[selected],Math.min(2,L.cells[selected].scale));c.restore();
 // The complete native curve caps the contents; the grid cannot paint over it.
 nine(c,'command-cabinet',r.x,r.y,r.w,r.h,false);
 if(L.scrollLimit>0){const h=Math.max(12,Math.floor(v.h*v.h/L.contentHeight)),y=v.y+(v.h-h)*clampScroll(L,offset)/L.scrollLimit;tile(c,part('native-black'),r.x+r.w-5,v.y,2,v.h);tile(c,part('steel-light'),r.x+r.w-5,Math.round(y),2,h);}
}
function elapsed(now=performance.now()){return paused?pausedAt-startedAt-pausedOffset:now-startedAt-pausedOffset;}
function resize(){if(!loaded)return;const box=stage.getBoundingClientRect(),size=nativeSizeForRatio(box.width/box.height);layout=layoutFor(size.width,size.height,slots.length,box.height/size.height);scrollY=clampScroll(layout,scrollY);canvas.width=layout.W*4;canvas.height=layout.H*4;ctx.imageSmoothingEnabled=false;ctx.setTransform(4,0,0,4,0,0);publish();}
function publish(){if(!layout)return;const box=canvas.getBoundingClientRect(),active=slots.filter(s=>s.kind!=='empty').length;stateOut.textContent=JSON.stringify({loaded:true,format,selectedIndex:selected,selectedKey:slots[selected].key,selectedBuilding:currentItem().id,balance:content.creditsExample,logicalWidth:layout.W,logicalHeight:layout.H,cssWidth:box.width,cssHeight:box.height,cellCount:layout.cells.length,activeCount:active,rows:layout.rows,cells:layout.cells,gridViewport:layout.gridViewport,scrollY,scrollLimit:layout.scrollLimit,titleText:layout.titleText,priceLabels:false,minimumTouchWidth:Math.min(...layout.cells.map(r=>r.w))*box.width/layout.W,minimumTouchHeight:Math.min(...layout.cells.map(r=>r.h))*box.height/layout.H,animations:['focus','red-indicator','green-indicator'],paused});status.textContent=`${Math.round(box.width)}×${Math.round(box.height)} · ${layout.rows} рядов · ${active} кнопок · ${currentItem().name}`;}
function animate(now){requestAnimationFrame(animate);if(!loaded)return;draw(ctx,layout,elapsed(now),scrollY);}
function chooseFormat(value){format=value;document.body.classList.toggle('fit',value==='fit');if(value!=='fit'){const [w,h]=presets[value];stage.style.width=Math.min(w,Math.max(280,innerWidth-28))+'px';stage.style.aspectRatio=w+'/'+h;stage.style.height='';}else{stage.style.width='';stage.style.aspectRatio='auto';}for(const b of document.querySelectorAll('[data-format]'))b.setAttribute('aria-pressed',String(b.dataset.format===value));resize();}
for(const b of document.querySelectorAll('[data-format]'))b.addEventListener('click',()=>chooseFormat(b.dataset.format));
function point(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*layout.W/b.width,y:(e.clientY-b.top)*layout.H/b.height,scale:b.height/layout.H};}
function inGrid(p){const v=layout.gridViewport;return p.x>=v.x&&p.x<v.x+v.w&&p.y>=v.y&&p.y<v.y+v.h;}
canvas.addEventListener('pointerdown',e=>{if(!loaded||!e.isPrimary||e.button!==0)return;e.preventDefault();const p=point(e);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,scrollY,scrollable:inGrid(p),dragged:false};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dy=e.clientY-pointer.y;if(Math.hypot(e.clientX-pointer.x,dy)>8)pointer.dragged=true;if(pointer.dragged&&pointer.scrollable&&layout.scrollLimit>0){e.preventDefault();scrollY=clampScroll(layout,pointer.scrollY-dy/point(e).scale);publish();}});
canvas.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;e.preventDefault();const gesture=pointer;pointer=null;if(gesture.dragged||Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)return;const p=point(e),index=cellAt(layout,p.x,p.y,scrollY);if(index>=0&&slots[index].kind!=='empty'){selected=index;publish();}});
canvas.addEventListener('pointercancel',()=>pointer=null);
canvas.addEventListener('wheel',e=>{if(!loaded||layout.scrollLimit<=0)return;const p=point(e);if(!inGrid(p))return;e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);scrollY=clampScroll(layout,scrollY+pixels/p.scale);publish();},{passive:false});
canvas.addEventListener('keydown',e=>{if(!loaded||!layout.scrollLimit)return;const steps={ArrowUp:-24,ArrowDown:24,PageUp:-layout.gridViewport.h,PageDown:layout.gridViewport.h,Home:-Infinity,End:Infinity};if(!(e.key in steps))return;e.preventDefault();scrollY=clampScroll(layout,scrollY+steps[e.key]);publish();});
document.getElementById('freeze').addEventListener('click',e=>{if(!paused){pausedAt=performance.now();paused=true;}else{pausedOffset+=performance.now()-pausedAt;paused=false;}e.currentTarget.setAttribute('aria-pressed',String(paused));e.currentTarget.textContent=paused?'Продолжить анимацию':'Пауза анимации';publish();});
function capture9x16(){const out=document.createElement('canvas');out.width=864;out.height=1536;const c=out.getContext('2d');c.scale(4,4);c.imageSmoothingEnabled=false;draw(c,layoutFor(216,384,slots.length),0);return out.toDataURL('image/png');}
document.getElementById('save').addEventListener('click',()=>{const a=document.createElement('a');a.download='dune-base-9x16.png';a.href=capture9x16();a.click();});
document.getElementById('capture').addEventListener('click',()=>document.getElementById('frame-export').textContent=capture9x16());
if(new URLSearchParams(location.search).has('qa'))document.getElementById('capture').hidden=false;
new ResizeObserver(resize).observe(stage);window.addEventListener('resize',()=>{if(format!=='fit')chooseFormat(format);else resize();});
try{
 [kit,content,buildings,ui,focus]=await Promise.all(['shop-layout-kit/manifest.json','base-prototype-content/manifest.json','building-assets/manifest.json','shop-ui-assets/manifest.json','menu-animations/manifest.json'].map(json));
 slots=content.nativeGrid;selected=slots.findIndex(s=>s.raw===9);
 const all=[...Object.values(kit.parts).map(p=>'shop-layout-kit/'+p.path),'shop-layout-kit/'+kit.fonts.ui.path,...Object.values(kit.animations).flatMap(a=>a.states.map(s=>'shop-layout-kit/'+s.path)),...buildings.buildings.flatMap(b=>[...b.icons,...b.illustrations].map(p=>'building-assets/'+p)),...ui.assets.filter(a=>a.path.startsWith('buttons/')||a.path.startsWith('icons/')).map(a=>'shop-ui-assets/'+a.path),...focusStates().map(a=>'menu-animations/'+phasePath(a))];
 await Promise.all([...new Set(all)].map(picture));loaded=true;startedAt=performance.now();chooseFormat('portrait');requestAnimationFrame(animate);
}catch(e){document.getElementById('error').textContent=e.message;stateOut.textContent=JSON.stringify({loaded:false,error:e.message});}
