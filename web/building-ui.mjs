import {nativeSizeForRatio} from './base-prototype/layout.mjs';
import {buildingLayoutFor,occupiedBuildingRows} from './building-layout.mjs';
import {LiveNativeFrame,dragScroll} from './native-ui.mjs?v=20261103-pwa4';

export class BuildingInterface {
 constructor({art,Module,resumeAudio}){
  this.art=art;this.Module=Module;this.resumeAudio=resumeAudio;this.frame=new LiveNativeFrame();this.state=null;this.key='';this.active=false;this.holdFrame=false;this.cells=[];this.paintDirty=true;this.lastSerial=null;this.paintCount=0;
  this.element=document.createElement('section');this.element.id='building-screen';this.element.className='building-screen';this.element.hidden=true;this.element.setAttribute('aria-label','Экран здания');
  this.viewport=document.createElement('div');this.viewport.className='building-viewport';this.background=document.createElement('canvas');this.background.className='building-background';this.background.setAttribute('aria-hidden','true');
  this.scroller=document.createElement('div');this.scroller.className='building-scroll';this.grid=document.createElement('div');this.grid.className='building-grid';this.grid.setAttribute('role','group');this.grid.setAttribute('aria-label','Покупки и действия оригинальной игры');this.scroller.append(this.grid);
  this.border=document.createElement('canvas');this.border.className='building-border';this.border.setAttribute('aria-hidden','true');this.viewport.append(this.background,this.scroller,this.border);
  this.element.append(this.viewport);document.body.append(this.element);
  this.scroller.addEventListener('scroll',()=>{this.paintDirty=true;},{passive:true});this.removeDrag=dragScroll(this.scroller);new ResizeObserver(()=>this.resize()).observe(this.viewport);
 }
 update(state){
  const active=!!state?.active&&state.frame?.ready;
  if(!active){this.active=false;this.holdFrame=false;this.element.hidden=true;this.element.style.visibility='';this.frame.valid=false;this.state=null;this.key='';this.layout=null;this.lastSerial=null;this.paintDirty=true;return;}
  const presentation=JSON.stringify([this.art.language?.revision,state.selectedIndex,state.previewArmed,state.detailTexts,state.creditsActual,state.producer.product,state.producer.flags6,state.cells.map(c=>[c.raw,c.selected,c.explicitDisabledCommand])]);if(presentation!==this.presentationKey){this.presentationKey=presentation;this.paintDirty=true;}this.active=true;this.element.hidden=false;this.state=state;this.element.dataset.menu=state.menuKind;this.element.setAttribute('aria-label',this.art.displayText?.(state.producer.name)||state.producer.name);
  const key=state.context+':'+state.producer.pointer+':'+state.cells.map(c=>c.raw).join(',');
  if(key!==this.key){this.frame.valid=false;this.key=key;this.buildCells();this.scroller.scrollTop=0;this.resize();}
  if(!this.frame.valid)this.element.style.visibility='hidden';
  for(let i=0;i<state.cells.length;i++){const c=state.cells[i],v=this.cells[i];if(!v?.button)continue;v.button.dataset.selected=String(c.selected);v.button.dataset.armed=String(c.previewArmed);v.button.setAttribute('aria-pressed',String(c.selected));v.button.setAttribute('aria-disabled',String(!!c.explicitDisabledCommand));v.button.setAttribute('aria-label',(this.art.displayText?.(c.name)||c.name)+(c.cost===null?'':(this.art.language?.russian?', цена ':', price ')+c.cost)+(c.explicitDisabledCommand?(this.art.language?.russian?', недоступно':', unavailable'):''));}
 }
 buildCells(){
  this.grid.replaceChildren();this.cells=[];const expectedContext=this.state.context,expectedProducer=this.state.producer.pointer;
  for(const c of this.state.cells.slice(0,occupiedBuildingRows(this.state)*3)){const element=document.createElement(c.clickable?'button':'div');element.className='building-cell'+(c.clickable?'':' empty-cell');element.dataset.cell=String(c.index);if(c.clickable){element.type='button';const can=document.createElement('canvas');can.setAttribute('aria-hidden','true');element.append(can);element.addEventListener('click',e=>{e.stopPropagation();this.resumeAudio();this.Module._dune_web_building_ui_tap_checked?.(expectedContext,expectedProducer,c.col,c.row);});this.cells.push({element,button:element,canvas:can,context:can.getContext('2d')});}else{element.setAttribute('aria-hidden','true');this.cells.push({element});}this.grid.append(element);}
 }
 exit(){if(!this.active||!this.state)return;const c=this.state.cells.find(c=>c.key==='exit'&&c.clickable);if(c){this.resumeAudio();this.Module._dune_web_building_ui_tap_checked?.(this.state.context,this.state.producer.pointer,c.col,c.row);}}
 resize(){this.paintDirty=true;if(!this.active||!this.state)return;const b=this.viewport.getBoundingClientRect();if(b.width<1||b.height<1)return;const size=nativeSizeForRatio(b.width/b.height);this.layout=buildingLayoutFor(size.width,size.height,this.state,b.height/size.height);const L=this.layout,sx=b.width/L.W,sy=b.height/L.H;this.sx=sx;this.sy=sy;
  for(const can of [this.background,this.border]){can.width=L.W*4;can.height=L.H*4;const c=can.getContext('2d');c.setTransform(4,0,0,4,0,0);c.imageSmoothingEnabled=false;}
  const v=L.gridViewport;Object.assign(this.scroller.style,{left:v.x*sx+'px',top:v.y*sy+'px',width:v.w*sx+'px',height:v.h*sy+'px'});Object.assign(this.grid.style,{marginLeft:L.gridX*sx+'px',width:L.gridWidth*sx+'px',height:L.gridHeight*sy+'px',gridTemplateColumns:'repeat(3, 1fr)',gridAutoRows:L.cells[0].h*sy+'px',columnGap:4*sx+'px',rowGap:2*sy+'px'});
  for(let i=0;i<this.cells.length;i++){const view=this.cells[i],r=L.cells[i];if(view.canvas){view.canvas.width=Math.round(r.w*4);view.canvas.height=Math.round(r.h*4);view.context.setTransform(4,0,0,4,0,0);view.context.imageSmoothingEnabled=false;}}
 }
 render(now){if(!this.active||!this.layout||this.holdFrame)return;const serial=this.Module._dune_web_frame_serial?.();if(this.frame.valid&&!this.paintDirty&&serial!==undefined&&serial===this.lastSerial)return;
  const s=this.state,L=this.layout,a=this.art,ptr=this.Module._dune_web_building_ui_frame_rgb?.();if(!ptr&&this.frame.valid)return;if(!this.frame.update(this.Module,ptr)){this.frame.valid=false;this.element.style.visibility='hidden';return;}this.lastSerial=serial;this.element.hidden=false;this.element.style.visibility='';if(this.frame.changed===false&&!this.paintDirty)return;this.paintDirty=false;this.paintCount++;
  const starport=s.context===3,live=id=>starport?a.livePart('starport-'+id,this.frame,'screen'):a.livePart(id,this.frame),glass=(ctx,id,x,y,w)=>starport?this.drawStarportGlass(ctx,id,x,y,w):a.glass(ctx,id,x,y,w);
  const c=this.background.getContext('2d');c.clearRect(0,0,L.W,L.H);if(starport)a.repeat(c,a.part('starport-body-fill','screen'),0,0,L.wide?128:L.W,L.wide?L.H:120);else a.repeat(c,a.part('steel-light'),0,0,L.W,L.H);
  // One original horizontal shading band at the info/cabinet join. Its8px
  // source is directional: never repeat it vertically across the body.
  if(!starport)a.repeat(c,a.part('steel-grain'),0,112,L.wide?128:L.W,8);
  const profile=a.skin.starportChrome;if(starport&&profile&&a.part(profile.radarPart,'screen')){a.blit(c,a.livePart(profile.radarPart,this.frame,'screen'),28,4);a.blit(c,a.livePart(profile.bankPart,this.frame,'screen'),8,0,.5);}
  else{a.blit(c,live('radar-clean'),28,0);a.blit(c,live('header-vents'),78,8);}
  // Use the current original frame's fixture RGB with the measured native masks.
  if(!starport)for(const [id,x,y] of [['green-fixture',8,8],['red-fixture',L.W-108,3]]){const spec=a.kit.animations[id],first=spec?.states?.[0];if(first){const key='live-'+id;if(!a.kit.parts[key]){a.kit.parts[key]={...first,sourceRect:spec.sourceRect};}a.blit(c,a.livePart(key,this.frame),x,y);}}
  if(L.W>=280){const x=starport?124:108,w=L.W-x-(starport?96:116),name=a.displayText?.(s.producer.name)||s.producer.name,scale=Math.min(1,(w-16)/(Math.max(1,name.length)*8));glass(c,'cash-window-clean',x,10,w);a.text(c,name,x+w/2,12+(8-8*scale)/2,{scale,align:'center',translate:false});}
  glass(c,'cash-window-clean',L.cash.x,L.cash.y,L.cash.w);this.frame.crop(c,{x:248,y:16,w:48,h:8},L.cash.x+L.cash.w-56,L.cash.y+2);
  a.blit(c,live('monitor-stack'),L.monitor.x,L.monitor.y);if(starport){this.frame.crop(c,s.sourceRects.portrait,L.monitor.x+8,L.monitor.y+8);this.frame.crop(c,s.sourceRects.name,L.titleText.x,L.titleText.y);}
  if(a.language?.russian){const r=L.titleText,name=a.displayText(s.detailTexts?.name||''),scale=Math.min(1,r.w/(Math.max(1,name.length)*8));a.repeat(c,a.part('native-black'),r.x,r.y,r.w,r.h);a.text(c,name,r.x+r.w/2,r.y+(8-8*scale)/2,{scale,align:'center',translate:false});}
  // Complete original monitor support louver, without painting a new decoration.
  if(!starport)c.drawImage(live('resource-vent'),0,20,40,8,44,112,40,8);
  this.drawInfoJoin(c,L,live);
  const labels=['price','secondary','hp'];for(let i=0;i<3;i++){const r=L.resources[i],fieldX=r.x+28,fieldW=r.w-28;if(starport&&i===1)this.frame.crop(c,s.sourceRects.secondaryIcon,r.x,r.y);else a.blit(c,live(['resource-dollar','resource-power','resource-armor'][i]),r.x,r.y);glass(c,'meter-window',fieldX,r.y+8,fieldW);const value=String(s.detailTexts?.[labels[i]]??'').trim(),scale=Math.min(1,(fieldW-16)/(Math.max(1,value.length)*8));a.text(c,value,fieldX+fieldW-8,r.y+12+(8-8*scale)/2,{scale,align:'right'});if(starport&&i===0)this.frame.crop(c,{x:268,y:108,w:32,h:28},fieldX+Math.floor((fieldW-16)/2),r.y+24,16,14);else if(!starport&&i<2){const ax=fieldX+Math.floor((fieldW-38)/2);this.frame.crop(c,{x:208,y:140+32*i,w:16,h:16},ax,r.y+24);this.frame.crop(c,{x:230,y:140+32*i,w:16,h:16},ax+22,r.y+24);}}
  const box=L.cabinet,v=L.gridViewport;a.repeat(c,a.part('native-black'),v.x,v.y,v.w,v.h);
  for(let i=0;i<this.cells.length;i++){const view=this.cells[i],cell=s.cells[i],r=L.cells[i];if(!view.context)continue;const k=view.context;k.clearRect(0,0,r.w,r.h);const p=cell.sourceRect,d=this.frame.data.data,sample=((p.y+3)*320+p.x+3)*4;if(starport||cell.kind==='command'){k.fillStyle=`rgb(${d[sample]} ${d[sample+1]} ${d[sample+2]})`;k.fillRect(0,0,r.w,r.h);}else a.repeat(k,a.part('steel-medium'),0,0,r.w,r.h);
   const at=(p.y*320+p.x)*4,rr=d[at],gg=d[at+1],bb=d[at+2],focused=bb===0&&((rr>48&&gg===0)||(gg>48&&rr===0)),x=r.art.x-r.x,y=r.art.y-r.y,u=r.scale;
   if(!starport&&cell.kind==='command'&&['exit','repair','stop'].includes(cell.key)){a.frame(k,cell.explicitDisabledCommand?'command-skin-disabled':'command-skin-normal',0,0,r.w,r.h,{group:'screen',unit:1});this.frame.crop(k,{x:p.x+2,y:p.y+6,w:28,h:12},x+2*u,y+6*u,28*u,12*u);if(focused)this.drawFocus(k,p,r.w,r.h,u);}
   else if(focused){this.frame.crop(k,{x:p.x+2,y:p.y+2,w:p.w-4,h:p.h-4},x+2*u,y+2*u,r.art.w-4*u,r.art.h-4*u);this.drawFocus(k,p,r.w,r.h,u);}else this.frame.crop(k,p,x,y,r.art.w,r.art.h);
   if(a.language?.russian&&cell.kind==='command'&&['exit','repair','stop'].includes(cell.key)){const label=a.commandLabel(cell.key==='repair'?'fix':cell.key,!!cell.explicitDisabledCommand);if(label){const bg=((p.y+4)*320+p.x+16)*4;k.fillStyle=`rgb(${d[bg]} ${d[bg+1]} ${d[bg+2]})`;k.fillRect(x+2*u,y+6*u,28*u,12*u);k.drawImage(label,x+2*u,y+6*u,28*u,12*u);}}
  }
  const top=this.border.getContext('2d');top.clearRect(0,0,L.W,L.H);a.frame(top,starport?'starport-command-cabinet':'command-cabinet',box.x,box.y,box.w,box.h,{group:starport?'screen':'shop',fill:false});
  if(starport)this.drawStarportSides(top,box);
  if(starport)a.blit(top,a.part('starport-cabinet-brace','screen'),box.x+(box.w-48)/2+2,box.y+box.h-16);
  if(L.scrollLimit>0){const v=L.gridViewport,h=Math.max(12,v.h*v.h/L.contentHeight),y=v.y+(v.h-h)*this.scroller.scrollTop/(L.scrollLimit*this.sy);a.repeat(top,a.part('native-black'),box.x+box.w-5,v.y,2,v.h);a.repeat(top,a.part(starport?'starport-body-fill':'steel-light',starport?'screen':'shop'),box.x+box.w-5,Math.round(y),2,h);}
 }
 drawInfoJoin(c,L,live){
  if(L.wide)return;
  const left=L.monitor.x+L.monitor.w,right=L.resources[0].x,gap=right-left;
  if(gap<8)return;
  if(this.state?.context===3){if(gap>=20){const scale=gap>=40?1:.5;this.art.blit(c,live('resource-vent'),left+(gap-40*scale)/2,32,scale);}return;}
  const scale=gap>=20?1:.5,x=gap>=40?right-20:left+(gap-16*scale)/2;
  for(const r of L.resources)this.art.blit(c,live('resource-knob'),x,r.y+(24-24*scale)/2,scale);
  if(gap>=40){const ventScale=gap>=60?1:.5,w=40*ventScale;this.art.blit(c,live('resource-vent'),Math.floor((left+x-w)/2),38,ventScale);}
 }
 drawStarportGlass(c,name,x,y,w){const a=this.art,p=a.skin.modules['starport-'+name]?.pieces;if(!p)return;const left=a.part(p.left,'screen'),middle=a.part(p.middle,'screen'),right=a.part(p.right,'screen');if(!left||!middle||!right)return;a.blit(c,left,x,y);a.repeat(c,middle,x+left.width,y,w-left.width-right.width,left.height);a.blit(c,right,x+w-right.width,y);}
 drawStarportSides(c,box){const a=this.art,m=a.skin.modules['starport-command-cabinet'],bands=m?.sideBands;if(!bands)return;const [l,t,r,b]=m.insets,height=box.h-t-b;
  for(const [key,x,w] of [['left',box.x,l],['right',box.x+box.w-r,r]]){const image=a.part(m.pieces[key],'screen'),middle=a.part(bands.middleParts[key],'screen');if(!image||!middle)continue;const top=Math.min(bands.top,height),bottom=Math.min(bands.bottom,height-top);c.drawImage(image,0,0,w,top,x,box.y+t,w,top);a.repeat(c,middle,x,box.y+t+top,w,height-top-bottom);c.drawImage(image,0,image.height-bottom,w,bottom,x,box.y+box.h-b-bottom,w,bottom);}
 }
 drawFocus(c,p,w,h,u){const f=this.frame,b=2*u,copy=(sx,sy,sw,sh,x,y,dw,dh)=>f.crop(c,{x:p.x+sx,y:p.y+sy,w:sw,h:sh},x,y,dw,dh);copy(0,0,2,2,0,0,b,b);copy(30,0,2,2,w-b,0,b,b);copy(0,22,2,2,0,h-b,b,b);copy(30,22,2,2,w-b,h-b,b,b);copy(2,0,1,2,b,0,w-2*b,b);copy(2,22,1,2,b,h-b,w-2*b,b);copy(0,2,2,1,0,b,b,h-2*b);copy(30,2,2,1,w-b,b,b,h-2*b);}
 debug(){return {active:this.active,paintCount:this.paintCount,context:this.state?.context,producer:this.state?.producer,selectedIndex:this.state?.selectedIndex,rows:this.layout?.rows,cells:this.state?.cells,scrollTop:this.scroller.scrollTop,scrollHeight:this.scroller.scrollHeight,viewportHeight:this.scroller.clientHeight};}
}
