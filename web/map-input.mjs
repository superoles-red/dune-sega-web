/* One DOM input stream owns map gestures. Compatibility MouseEvents are only
 * a fallback when Pointer Events do not exist, never a second commit path. */
export const MOUSE_COMMAND_DRAG_SLOP=8;
export function bindMapInput(canvas,{begin,move,end,cancel,command=()=>{},hover=()=>{},position=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}}={}, {pointerEvents=typeof globalThis.PointerEvent==='function'}={}){
  const active=new Map();
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const listen=(name,handler)=>canvas.addEventListener(name,handler,{capture:true,passive:false});
  const release=id=>{try{canvas.releasePointerCapture(id);}catch{}};
  const reset=()=>{const ids=[...active.keys()];active.clear();if(pointerEvents)for(const id of ids)release(id);};
  const abort=()=>{if(!active.size)return;reset();cancel();};
  const markDrag=(record,p)=>{if(Math.hypot(p.x-record.origin.x,p.y-record.origin.y)>MOUSE_COMMAND_DRAG_SLOP)record.dragged=true;};
  const record=(kind,button,p)=>({kind,button,origin:p,dragged:false});
  if(pointerEvents){
    listen('pointerdown',e=>{
      stop(e);const kind=e.pointerType||'mouse';if((kind==='mouse'&&e.button!==0&&e.button!==2)||active.has(e.pointerId))return;
      const p=position(e);active.set(e.pointerId,record(kind,e.button,p));
      if(!(kind==='mouse'&&e.button===2)&&begin(e.pointerId,p,kind)===false){active.delete(e.pointerId);return;}
      try{canvas.setPointerCapture(e.pointerId);}catch{}
    });
    listen('pointermove',e=>{
      stop(e);
      // An assistive/AX click can have no held mouse buttons yet receive an
      // unrelated OS hover between down/up. That hover is not a drag. The
      // release still supplies its final position to the gesture recognizer.
      const held=active.get(e.pointerId);
      if(held?.kind==='mouse'&&e.buttons===0)return;
      const p=position(e);
      if(held?.kind==='mouse'&&held.button===2)markDrag(held,p);
      else if(held)move(e.pointerId,p);
      else if(e.pointerType==='mouse'||e.pointerType==='pen')hover(p,e.pointerType);
    });
    listen('pointerup',e=>{
      stop(e);const held=active.get(e.pointerId);if(!held||(held.kind==='mouse'&&e.button!==held.button))return;
      // Clear ownership before committing/releasing. WebKit may dispatch lost
      // capture before a compatibility mouseup; neither can cancel this tap.
      const p=position(e);active.delete(e.pointerId);
      if(held.kind==='mouse'&&held.button===2){markDrag(held,p);if(held.dragged)cancel();else command(p,held.kind);}
      else end(e.pointerId,p);
      release(e.pointerId);
    });
    listen('pointercancel',e=>{stop(e);if(active.has(e.pointerId))abort();});
    listen('lostpointercapture',e=>{if(active.has(e.pointerId))abort();});
    for(const name of ['mousedown','mousemove','mouseup'])listen(name,stop);
  }else{
    listen('mousedown',e=>{
      stop(e);if((e.button!==0&&e.button!==2)||active.has('mouse'))return;const p=position(e);active.set('mouse',record('mouse',e.button,p));
      if(e.button===0&&begin('mouse',p,'mouse')===false)active.delete('mouse');
    });
    listen('mousemove',e=>{stop(e);const held=active.get('mouse');if(held&&e.buttons===0)return;const p=position(e);if(held?.button===2)markDrag(held,p);else if(held)move('mouse',p);else hover(p,'mouse');});
    listen('mouseup',e=>{stop(e);const held=active.get('mouse');if(!held||e.button!==held.button)return;const p=position(e);active.delete('mouse');if(held.button===2){markDrag(held,p);if(held.dragged)cancel();else command(p,'mouse');}else end('mouse',p);});
  }
  for(const name of ['click','dblclick','auxclick','contextmenu','touchstart','touchmove','touchend','touchcancel'])listen(name,stop);
  return {reset,get activeCount(){return active.size;},pointerEvents};
}
