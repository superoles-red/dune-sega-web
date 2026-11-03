/* Opt-in DOM-only input observer. The supplied snapshot reads existing JS
 * caches; this module has no Module/native getter or command access. */
export function mountInputCheck({read,canvas}){
  const panel=document.createElement('aside');panel.id='input-check';panel.style.cssText='position:fixed;z-index:1100;left:8px;bottom:8px;width:min(460px,calc(100vw - 16px));max-height:190px;color:#fff;background:#111e;padding:6px;font:10px/1.25 monospace;pointer-events:none';
  const button=document.createElement('button');button.id='input-check-snapshot';button.type='button';button.textContent='INPUTCHECK safari3 · Snapshot';button.style.cssText='pointer-events:auto;min-height:30px;padding:4px 8px;font:11px monospace';
  const output=document.createElement('output');output.id='input-check-state';output.setAttribute('role','status');output.style.cssText='display:block;white-space:pre-wrap;overflow-wrap:anywhere;max-height:144px;overflow:auto';panel.append(button,output);document.body.append(panel);
  const events=[];let disposed=false;
  const refresh=()=>{if(disposed)return;output.textContent=JSON.stringify({inputcheck:'safari3',...read(),events},null,1);};
  const trace=e=>{
    if(panel.contains(e.target))return;
    const row={type:e.type,kind:e.pointerType||'mouse',id:e.pointerId,button:e.button,buttons:e.buttons,x:Math.round(e.clientX),y:Math.round(e.clientY),target:e.target===canvas?'canvas':e.target?.id||e.target?.tagName||'unknown',before:read().mode};events.push(row);if(events.length>6)events.shift();
    queueMicrotask(()=>{if(disposed)return;row.after=read().mode;refresh();});
  };
  const types=['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'];
  for(const name of types)window.addEventListener(name,trace,{capture:true,passive:true});
  for(const name of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','touchstart','touchend'])button.addEventListener(name,e=>e.stopPropagation());
  button.addEventListener('click',e=>{e.stopPropagation();refresh();});refresh();
  return {refresh,dispose(){disposed=true;for(const name of types)window.removeEventListener(name,trace,true);panel.remove();}};
}
