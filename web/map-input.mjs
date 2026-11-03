/* One DOM input stream owns map gestures. Compatibility MouseEvents are only
 * a fallback when Pointer Events do not exist, never a second commit path. */
export function bindMapInput(canvas,{begin,move,end,cancel,hover=()=>{},position=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}}={}, {pointerEvents=typeof globalThis.PointerEvent==='function'}={}){
  const active=new Map();
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const listen=(name,handler)=>canvas.addEventListener(name,handler,{capture:true,passive:false});
  const release=id=>{try{canvas.releasePointerCapture(id);}catch{}};
  const reset=()=>{const ids=[...active.keys()];active.clear();if(pointerEvents)for(const id of ids)release(id);};
  const abort=()=>{if(!active.size)return;reset();cancel();};
  if(pointerEvents){
    listen('pointerdown',e=>{
      stop(e);const kind=e.pointerType||'mouse';if((kind==='mouse'&&e.button!==0)||active.has(e.pointerId))return;
      active.set(e.pointerId,kind);
      if(begin(e.pointerId,position(e),kind)===false){active.delete(e.pointerId);return;}
      try{canvas.setPointerCapture(e.pointerId);}catch{}
    });
    listen('pointermove',e=>{
      stop(e);const p=position(e);
      if(active.has(e.pointerId))move(e.pointerId,p);
      else if(e.pointerType==='mouse'||e.pointerType==='pen')hover(p);
    });
    listen('pointerup',e=>{
      stop(e);if(!active.has(e.pointerId))return;
      // Clear ownership before committing/releasing. WebKit may dispatch lost
      // capture before a compatibility mouseup; neither can cancel this tap.
      active.delete(e.pointerId);end(e.pointerId,position(e));release(e.pointerId);
    });
    listen('pointercancel',e=>{stop(e);if(active.has(e.pointerId))abort();});
    listen('lostpointercapture',e=>{if(active.has(e.pointerId))abort();});
    for(const name of ['mousedown','mousemove','mouseup'])listen(name,stop);
  }else{
    listen('mousedown',e=>{
      stop(e);if(e.button!==0||active.has('mouse'))return;active.set('mouse','mouse');
      if(begin('mouse',position(e),'mouse')===false)active.delete('mouse');
    });
    listen('mousemove',e=>{stop(e);const p=position(e);if(active.has('mouse'))move('mouse',p);else hover(p);});
    listen('mouseup',e=>{stop(e);if(e.button!==0||!active.has('mouse'))return;active.delete('mouse');end('mouse',position(e));});
  }
  for(const name of ['click','dblclick','auxclick','contextmenu','touchstart','touchmove','touchend','touchcancel'])listen(name,stop);
  return {reset,get activeCount(){return active.size;},pointerEvents};
}
