// Static instructions only. The original runtime owns selection and commands.
export function defaultControlsMode(win=globalThis.window){try{return win?.matchMedia?.('(pointer: coarse)').matches?'touch':'mouse';}catch{return 'mouse';}}
export function controlsGuideRows(mode='touch'){
 const touch=mode==='touch';
 return [
  ['SELECT',touch?'SINGLE TAP AN OBJECT.':'LEFT CLICK AN OBJECT.'],
  ['CLEAR SELECTION',touch?'SINGLE TAP EMPTY GROUND.':'LEFT CLICK EMPTY GROUND.'],
  ['GIVE AN ORDER',touch?'DOUBLE TAP THE TARGET.':'RIGHT CLICK THE TARGET.'],
  ['OPEN A BUILDING',touch?'TAP THE SELECTED BUILDING TO OPEN.':'LEFT CLICK THE SELECTED BUILDING TO OPEN.'],
  ['MOVE THE MAP',touch?'DRAG WITH ONE FINGER.':'DRAG WITH THE LEFT BUTTON.'],
  ['ZOOM',touch?'PINCH WITH TWO FINGERS.':'MOUSE WHEEL OR TRACKPAD.'],
  ['BUILD','DRAG FROM YOUR READY CONSTRUCTION YARD TO A VALID PLACE.'],
  ['DEVASTATOR',touch?'DOUBLE TAP ITSELF TO ARM. DETONATE APPEARS BELOW.':'RIGHT CLICK ITSELF TO ARM. DETONATE APPEARS BELOW.'],
  ['PALACE',touch?'WHILE AIMING, DOUBLE TAP THE TARGET TO FIRE.':'WHILE AIMING, DOUBLE CLICK THE TARGET WITH THE LEFT OR RIGHT BUTTON.'],
  ['EXTRA ACTION','USE THE EXTRA BUTTON WHEN IT APPEARS.'],
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
