// Presentation only. Every result value is an existing original VDP display
// string; this module never calculates a score, rank, duration or casualty.
const GROUPS=[
 {key:'spice',lines:['SPICE','HARVESTED'],title:'SPICE HARVESTED'},
 {key:'units',lines:['UNITS','DESTROYED'],title:'UNITS DESTROYED'},
 {key:'structures',lines:['STRUCTURES','DESTROYED'],title:'STRUCTURES DESTROYED'},
];

function displayData(state){
 const d=state?.statsDisplay;
 if(!d||d.ready!==true)return null;
 const read=v=>typeof v==='string'&&v.trim().length?v.trim():null;
 const score=read(d.score),time=read(d.time),rank=read(d.rank);
 const groups=GROUPS.map(g=>({...g,you:read(d[g.key]?.you),enemy:read(d[g.key]?.enemy)}));
 if(score===null||time===null||rank===null||groups.some(g=>g.you===null||g.enemy===null))return null;
 return {score,time,rank,groups,campaignComplete:d.campaignComplete===true};
}

function fontImage(art,id){
 const font=art.skin?.fonts?.[id];
 const image=font?.path&&(art.image?.(font.path,'screen')||art.images?.get('screen:'+font.path));
 return font&&image?{font,image}:null;
}
function supports(f,value){return [...value].every(ch=>f.font.glyphs[ch.charCodeAt(0)]);}
function fittedScale(value,maximumWidth,desired){
 // Quarter steps keep complete 8px character cells at an integer destination
 // width. Native glyph pixels are never recoloured or replaced by browser text.
 return Math.max(.5,Math.floor(Math.min(desired,maximumWidth/(Math.max(1,value.length)*8))*4)/4);
}
function glyphs(ctx,f,value,x,y,scale,align='left'){
 if(align==='center')x-=value.length*4*scale;
 else if(align==='right')x-=value.length*8*scale;
 for(let i=0;i<value.length;i++){
  const code=value.charCodeAt(i),source=f.overrides?.[code]||f,g=source.font.glyphs[code];
  ctx.drawImage(source.image,g.x,g.y,g.width,g.height,Math.round(x+i*8*scale),Math.round(y),g.width*scale,g.height*scale);
 }
}

/**
 * Draw a responsive original-statistics board inside the caller's logical
 * canvas rectangle. Return false without drawing while the native values/fonts
 * are unavailable or the space is too small; the caller keeps its live-frame
 * fallback. `frame` is accepted for that shared renderer contract, never read
 * back to fabricate missing numeric values.
 */
export function renderNativeResults({art,ctx,state,width,height,frame}={}){
 const data=displayData(state);
 if(!data||!art?.ready||!ctx||!Number.isFinite(width)||!Number.isFinite(height)||width<260||height<166)return false;
 const labelFont=fontImage(art,'textShadow')||fontImage(art,'uiShadow');
 const valueFont=fontImage(art,'statsValue');
 if(!labelFont||!valueFont||!art.skin?.modules?.['dialog-frame'])return false;
 // The original clock colon is static white tile2F5, whose4bpp bytes
 // exactly equal the native shadow-font colon. Its digits stay yellow.
 valueFont.overrides={58:labelFont};
 const values=[data.score,data.time,data.rank,...data.groups.flatMap(g=>[g.you,g.enemy])];
 if(values.some(v=>!supports(valueFont,v)))return false;
 const compact=height<288||width/height>1.7;
 const label=(v,x,y,scale=1.5,align='left',max=Infinity)=>glyphs(ctx,labelFont,v,x,y,fittedScale(v,max,scale),align);
 const value=(v,x,y,scale=2.5,align='left',max=Infinity)=>glyphs(ctx,valueFont,v,x,y,fittedScale(v,max,scale),align);
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
 if(compact){
  const pad=14,inner=width-pad*2,half=inner/2,ls=1.5,vs=2;
  art.frame(ctx,'dialog-frame',2,2,width-4,height-4,{group:'screen',unit:1,fill:true});
  label('SCORE',pad,pad,ls);value(data.score,pad+half-8,pad-2,vs,'right',half-5*8*ls-12);
  label('TIME',pad+half+8,pad,ls);value(data.time,width-pad,pad-2,vs,'right',half-4*8*ls-16);
  const rankY=pad+24;label('RANK',pad,rankY,ls);
  value(data.rank,width-pad,rankY-1,1.75,'right',inner-4*8*ls-12);
  const headerY=rankY+24,labelWidth=inner*.48,columnWidth=(inner-labelWidth)/2;
  const youX=pad+labelWidth+columnWidth/2,enemyX=youX+columnWidth;
  label('YOU',youX,headerY,ls,'center');label('ENEMY',enemyX,headerY,ls,'center');
  const rowsY=headerY+17,rowHeight=(height-pad-rowsY)/3;
  for(let i=0;i<data.groups.length;i++){
   const g=data.groups[i],y=rowsY+i*rowHeight,cy=y+rowHeight/2;
   label(g.lines[0],pad,cy-12,ls,'left',labelWidth-6);
   label(g.lines[1],pad,cy,ls,'left',labelWidth-6);
   value(g.you,youX,cy-8,vs,'center',columnWidth-8);
   value(g.enemy,enemyX,cy-8,vs,'center',columnWidth-8);
  }
 }else{
  const pad=14,inner=width-pad*2,half=inner/2,ls=width>=340?2:1.5;
  const picture=width>=348&&height>=392?art.part(data.campaignComplete?'results-final-tanks-scene':'results-soldier-scene','screen'):null;
  const pictureScale=picture?Math.min(1,inner/picture.width):0,pictureHeight=picture?picture.height*pictureScale:0;
  const panelHeight=Math.min(height,288+pictureHeight+(picture?8:0)+48),top=Math.round((height-panelHeight)/2);
  art.frame(ctx,'dialog-frame',2,top+2,width-4,panelHeight-4,{group:'screen',unit:1,fill:true});
  let y=top+pad;
  label('SCORE',pad+half/2,y,ls,'center');label('TIME',pad+half*1.5,y,ls,'center');
  value(data.score,pad+half/2,y+21,3,'center',half-16);value(data.time,pad+half*1.5,y+21,3,'center',half-16);
  y+=52;
  label('RANK',width/2,y,1.5,'center');value(data.rank,width/2,y+17,2.5,'center',inner-12);y+=44;
  if(picture){ctx.drawImage(picture,Math.round((width-picture.width*pictureScale)/2),Math.round(y),picture.width*pictureScale,pictureHeight);y+=pictureHeight+8;}
  const rowHeight=(top+panelHeight-pad-y)/3;
  for(let i=0;i<data.groups.length;i++){
   const g=data.groups[i],rowY=y+i*rowHeight,headingY=rowY+Math.max(0,(rowHeight-46)/2);
   label(g.title,width/2,headingY,ls,'center',inner-12);
   const lineY=headingY+23,labelScale=1.5,numberScale=width>=340?2.5:2;
   label('YOU',pad+8,lineY,labelScale);value(g.you,pad+half-10,lineY-3,numberScale,'right',half-3*8*labelScale-22);
   label('ENEMY',pad+half+8,lineY,labelScale);value(g.enemy,width-pad-8,lineY-3,numberScale,'right',half-5*8*labelScale-24);
  }
 }
 ctx.restore();return true;
}
