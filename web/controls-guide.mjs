// Static instructions only. The original runtime owns selection and commands.
export function defaultControlsMode(win=globalThis.window){try{return win?.matchMedia?.('(pointer: coarse)').matches?'touch':'mouse';}catch{return 'mouse';}}
export function controlsGuideRows(mode='touch'){
 const touch=mode==='touch';
 return [
  [touch?'SINGLE TAP':'LEFT CLICK','SELECT. EMPTY GROUND CLEARS.'],
  [touch?'DOUBLE TAP':'RIGHT CLICK','GIVE AN ORDER.'],
  [touch?'DRAG':'LEFT DRAG','MOVE THE MAP.'],
  [touch?'PINCH':'WHEEL OR TRACKPAD','ZOOM THE MAP.'],
 ];
}
export function wrapControlsText(value,columns){
 const rows=[];let line='';
 for(const word of String(value).toUpperCase().split(/\s+/).filter(Boolean)){
  if(line&&line.length+1+word.length>columns){rows.push(line);line='';}
  if(word.length>columns){if(line){rows.push(line);line='';}for(let at=0;at<word.length;at+=columns){const piece=word.slice(at,at+columns);if(piece.length===columns)rows.push(piece);else line=piece;}}
  else line+=(line?' ':'')+word;
 }
 if(line)rows.push(line);return rows;
}
export function composeControlsGuide({art,width,mode='touch',doc=globalThis.document}={}){
 const w=Math.max(240,Math.min(720,Math.floor(width||320))),scale=w<420?1.5:2,gap=8*scale+4,left=42,right=18,columns=Math.max(12,Math.floor((w-left-right)/(8*scale)));
 const local=value=>art.displayText?.(value)||value,rows=controlsGuideRows(mode).map(([title,text])=>({title:local(title),text:local(text)}));
 const layout=rows.map(row=>({...row,lines:wrapControlsText(row.text,columns),titles:wrapControlsText(row.title,columns)}));
 const h=24+layout.reduce((sum,row)=>sum+(row.titles.length+row.lines.length)*gap+14,0),canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Controls canvas unavailable');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
 art.frame(ctx,'dialog-frame',0,0,w,h,{group:'screen',unit:1});const arrow=art.part('menu-arrow-native','screen');let y=12;
 for(const row of layout){
  if(arrow)ctx.drawImage(arrow,16,y,16,16);
  for(const line of row.titles){art.text(ctx,line,left,y,{scale,shadow:true,translate:false});y+=gap;}
  for(const line of row.lines){art.text(ctx,line,left,y,{scale,shadow:true,translate:false});y+=gap;}y+=14;
 }
 return {canvas,mode:mode==='touch'?'touch':'mouse',rows,accessibility:rows.map(row=>row.title+'. '+row.text).join('\n')};
}
