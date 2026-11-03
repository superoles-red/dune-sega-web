// Overlay only; the preceding live native image must come from
// _dune_web_results_frame_rgb(). Counters, clock and score are never redrawn.
export const RESULT_LABELS=Object.freeze([
 {text:'SCORE:',x:24,y:24,width:48},
 {text:'TIME:',x:200,y:24,width:40},
 {text:'YOU HAVE ATTAINED THE RANK OF',x:48,y:40,width:232,center:true},
 {text:'SPICE HARVESTED BY',x:88,y:88,width:144,center:true},
 {text:'UNITS DESTROYED BY',x:88,y:128,width:144,center:true},
 {text:'STRUCTURES DESTROYED BY',x:72,y:168,width:184,center:true},
 {text:'YOU:',x:48,y:104,width:32},{text:'ENEMY:',x:32,y:112,width:48},
 {text:'YOU:',x:48,y:144,width:32},{text:'ENEMY:',x:32,y:152,width:48},
 {text:'YOU:',x:48,y:184,width:32},{text:'ENEMY:',x:32,y:192,width:48},
]);

/** Paint fixed labels and the actual VDP rank after a textless native frame.
 * art.displayText(value) resolves the locale; art.text accepts ink from the
 * completed native palette. Scale only to the supplied complete-frame bounds.
 * Caller must use the metadata and RGB from the same completed native frame.
 */
export function drawLocalizedResults(ctx,art,state,{width=320,height=224,overlay=state?.resultsOverlay}={}){
 if(!ctx||!art?.ready||typeof art.text!=='function'||!overlay?.ready||state?.scene!=='results'||!(width>0&&height>0))return false;
 const display=value=>typeof art.displayText==='function'?art.displayText(value):value;
 const ink=value=>Array.isArray(value)&&value.length===3&&value.every(v=>Number.isInteger(v)&&v>=0&&v<=255);
 if(!ink(overlay.labelInk)||!ink(overlay.rankInk))return false;
 ctx.save();ctx.scale(width/320,height/224);ctx.imageSmoothingEnabled=false;
 const line=(value,x,y,width,color,center=false)=>{
  const text=display(value),scale=Math.min(1,width/(Math.max(1,[...text].length)*8));
  art.text(ctx,text,center?x+width/2:x,y,{scale,align:center?'center':'left',maxWidth:width,shadow:true,transparent:true,ink:color,preserveCase:true});
 };
 RESULT_LABELS.forEach((label,index)=>{if(overlay.labelMask&(1<<index))line(label.text,label.x,label.y,label.width,overlay.labelInk,label.center);});
 if(overlay.rankVisible&&typeof overlay.rank==='string'&&overlay.rank.trim())line(overlay.rank.trim(),0,56,320,overlay.rankInk,true);
 ctx.restore();return true;
}

// The End and a small whitelist of original scrolling credits roles. Metadata
// supplies native scroll coordinates and colours; names/legal text stay in RGB.
export function drawLocalizedSceneLabels(ctx,art,state,{width=320,height=224,overlay=state?.localizedSceneOverlay}={}){
 if(!ctx||!art?.ready||typeof art.text!=='function'||!overlay?.ready||!['ending','credits'].includes(state?.scene)||!Array.isArray(overlay.lines)||!(width>0&&height>0))return false;
 ctx.save();ctx.scale(width/320,height/224);ctx.beginPath();ctx.rect(0,0,320,224);ctx.clip();ctx.imageSmoothingEnabled=false;
 for(const line of overlay.lines){
  if(typeof line.text!=='string'||!Number.isFinite(line.x)||!Number.isFinite(line.y)||!(line.width>0)||!Array.isArray(line.ink)||line.ink.length!==3)continue;
  const value=typeof art.displayText==='function'?art.displayText(line.text):line.text,center=line.x+line.width/2;
  // The original role occupies its own scrolling row. A longer translation
  // can use that row's empty sides before reducing the native8px glyphs.
  const available=Math.max(line.width,2*Math.min(center,320-center)),scale=Math.min(1,available/(Math.max(1,[...value].length)*8));
  art.text(ctx,value,center,line.y,{scale,align:'center',maxWidth:available,shadow:true,transparent:true,ink:line.ink,preserveCase:true});
 }
 ctx.restore();return true;
}
