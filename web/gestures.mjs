/** Pointer recognition only. Commands and placement rules belong to Sega's program. */
export class MapGestures {
  constructor(callbacks,threshold=8){this.callbacks=callbacks;this.threshold=threshold;this.points=new Map();this.mode='idle';this.origin=this.last=this.pinch=null;}
  change(mode){this.mode=mode;this.callbacks.state?.(mode);}
  down(point){
    if(this.points.has(point.id))return;
    const p={...point,map:!!this.callbacks.canPanAt(point.x,point.y)};this.points.set(p.id,p);
    if(this.points.size===1){this.primary=p.id;this.origin={x:p.x,y:p.y};this.last={...this.origin};this.change(this.callbacks.minimapStart?.(p.x,p.y)?'minimap':'pending');return;}
    if(this.mode==='place')this.callbacks.placementCancel?.();
    const pair=[...this.points.values()].slice(0,2);
    if(!pair.every(p=>p.map)){this.change('blocked');return;}
    this.pinch=this.geometry(pair);this.change('pinch');
  }
  geometry(pair){return {x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2,distance:Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y)};}
  move(point){
    const p=this.points.get(point.id);if(!p)return;Object.assign(p,{x:point.x,y:point.y});
    if(this.mode==='pinch'){
      const pair=[...this.points.values()].slice(0,2);if(pair.length<2)return;
      const next=this.geometry(pair),before=this.pinch;
      if(before){const dx=next.x-before.x,dy=next.y-before.y;if(dx||dy)this.callbacks.pan(dx,dy);if(before.distance>=8&&next.distance>=8){const ratio=next.distance/before.distance;if(Number.isFinite(ratio)&&ratio>0)this.callbacks.zoom(ratio,next.x,next.y);}}
      this.pinch=next;return;
    }
    if(point.id!==this.primary)return;
    if(this.mode==='minimap'){this.callbacks.minimapMove?.(p.x,p.y);return;}
    if(this.mode==='pending'&&Math.hypot(p.x-this.origin.x,p.y-this.origin.y)>this.threshold){
      if(!p.map)this.change('blocked');
      else if(this.callbacks.placementStart?.(this.origin.x,this.origin.y))this.change('place');
      else this.change('pan');
    }
    if(this.mode==='place'){this.callbacks.placementMove?.(p.x,p.y);this.last={x:p.x,y:p.y};}
    if(this.mode==='pan'){const dx=p.x-this.last.x,dy=p.y-this.last.y;if(dx||dy)this.callbacks.pan(dx,dy);this.last={x:p.x,y:p.y};}
  }
  up(point){
    if(!this.points.has(point.id))return;this.move(point);
    const mode=this.mode,primary=point.id===this.primary;this.points.delete(point.id);
    if(mode==='pinch'){
      if(this.points.size>=2){this.pinch=this.geometry([...this.points.values()].slice(0,2));return;}
      if(this.points.size===1){const p=[...this.points.values()][0];this.primary=p.id;this.origin={x:p.x,y:p.y};this.last={...this.origin};this.pinch=null;this.change('pan');return;}
      this.finish();return;
    }
    if(!primary){if(!this.points.size)this.finish();return;}
    if(mode==='pending')this.callbacks.tap(point.x,point.y);
    if(mode==='place')this.callbacks.placementEnd?.(point.x,point.y);
    this.finish();
  }
  finish(){this.points.clear();this.origin=this.last=this.pinch=null;this.change('idle');}
  cancel(){if(this.mode==='place')this.callbacks.placementCancel?.();this.finish();}
}
/** CSS pixels/second. Only the placement state calls this; ordinary hover has no scroll. */
export function placementEdgeVelocity(position,size,zone=42,speed=155){
  if(!Number.isFinite(position)||size<=0)return 0;
  zone=Math.min(zone,size/4);
  if(position<zone)return -speed*Math.min(1,(zone-position)/zone);
  if(position>size-zone)return speed*Math.min(1,(position-size+zone)/zone);
  return 0;
}
