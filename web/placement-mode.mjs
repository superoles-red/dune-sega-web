// A chosen point belongs to the world, not to the finger or viewport. Native
// callbacks retain all construction, targeting, cost and cooldown decisions.
const point=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const copy=p=>p?{x:p.x,y:p.y}:null;
const accepted=v=>v===true||(typeof v==='number'&&Number.isFinite(v)&&v>0);
const identity=v=>!!v&&(typeof v!=='number'||Number.isFinite(v));
const dimensions=c=>({width:c?.cssWidth??c?.width,height:c?.cssHeight??c?.height});

export function placementWorldToScreen(world,camera){
 if(!point(world)||!camera?.map||![camera.left,camera.top,camera.scale,camera.scaleY].every(Number.isFinite)||camera.scale<=0||camera.scaleY<=0)return null;
 return {x:(world.x-camera.left)*camera.scale,y:(world.y-camera.top)*camera.scaleY};
}
export function placementPointVisible(screen,camera){
 if(!point(screen)||!camera?.map)return false;
 const {width,height}=dimensions(camera);
 if(Number.isFinite(width)&&(!(width>0)||screen.x<0||screen.x>=width))return false;
 if(Number.isFinite(height)&&(!(height>0)||screen.y<0||screen.y>=height))return false;
 const m=camera.minimap;
 return !(m?.visible&&screen.x>=m.x&&screen.x<m.x+m.width&&screen.y>=m.y&&screen.y<m.y+m.height);
}
export function placementScreenToWorld(x,y,camera){
 if(!placementPointVisible({x,y},camera)||![camera.left,camera.top,camera.scale,camera.scaleY].every(Number.isFinite)||camera.scale<=0||camera.scaleY<=0)return null;
 return {x:camera.left+x/camera.scale,y:camera.top+y/camera.scaleY};
}

export class PlacementMode {
 constructor({readState=()=>({}),screenToWorld=placementScreenToWorld,worldToScreen=placementWorldToScreen,beginPlacement,movePlacement,confirmPlacement,cancelPlacement,confirmPower,cancelPower,onChange=()=>{}}={}){
  this.callbacks={beginPlacement,movePlacement,confirmPlacement,cancelPlacement,confirmPower,cancelPower};
  Object.assign(this,{readState,screenToWorld,worldToScreen,onChange});
  this.camera=null;this.state={};this.current=null;this.powerPending=false;this.lastReason='idle';this.projectionKey='';
 }
 get active(){return !!this.current;}
 context(){return (this.state.map===undefined?!!this.camera?.map:!!this.state.map)&&!this.state.blocked;}
 snapshot(){
  const r=this.current,screen=r?this.worldToScreen(r.target,this.camera):null;
  return {active:!!r,mode:r?.mode??null,target:copy(r?.target),screen:copy(screen),visible:!!r&&placementPointVisible(screen,this.camera),canConfirm:!!r&&!r.confirming&&point(r.target)&&this.context(),identity:r?.identity??null,powerPending:this.powerPending,reason:this.lastReason};
 }
 emit(){const s=this.snapshot();this.projectionKey=[s.active,s.mode,s.screen?.x,s.screen?.y,s.visible,s.canConfirm,s.powerPending].join(':');this.onChange(s);return s;}
 begin(mode,x,y,actor){
  if(this.active||mode==='power'&&(!identity(actor)||this.powerPending))return false;
  this.state=this.readState()||{};
  if(!this.context())return false;
  const world=this.screenToWorld(x,y,this.camera);if(!point(world))return false;
  if(mode==='placement'&&!accepted(this.callbacks.beginPlacement?.(x,y,copy(world))))return false;
  this.current={mode,target:copy(world),identity:mode==='power'?actor:null,seenPlacement:!!this.state.placementActive,confirming:false,runId:this.state.runId,outcomeSeq:this.state.outcomeSeq};
  this.lastReason='begin';this.emit();return true;
 }
 beginPlacement(x,y){return this.begin('placement',x,y);}
 // Identity is an opaque Palace identity, never a time-limited native ticket.
 // The root's confirmPower callback validates it and captures a fresh ticket.
 beginPower(actor,x,y){return this.begin('power',x,y,actor);}
 tap(x,y){
  const r=this.current;if(!r||r.confirming||!this.context())return false;
  const world=this.screenToWorld(x,y,this.camera);if(!point(world))return false;
  if(r.mode==='placement'&&!accepted(this.callbacks.movePlacement?.(x,y,copy(world))))return false;
  r.target=copy(world);this.lastReason='target';this.emit();return true;
 }
 sync(camera,state=this.readState()){
  this.camera=camera;this.state=state||{};
  if(this.state.powerArmed===false)this.powerPending=false;
  const r=this.current;
  if(r){
   if(!this.context())return this.clear('context');
   for(const key of ['runId','outcomeSeq']){
    if(r[key]!==undefined&&this.state[key]!==undefined&&r[key]!==this.state[key])return this.clear(key);
    if(r[key]===undefined&&this.state[key]!==undefined)r[key]=this.state[key];
   }
   if(r.mode==='placement'){
    if(this.state.placementActive)r.seenPlacement=true;
    else if(r.seenPlacement&&this.state.placementActive===false)return this.clear('placement-ended');
   }else if(this.state.powerArmed===false)return this.clear('power-ended');
  }
  // Camera movement changes only the overlay projection. The original native
  // placement observer already retains its world anchor, including offscreen.
  const s=this.snapshot(),key=[s.active,s.mode,s.screen?.x,s.screen?.y,s.visible,s.canConfirm,s.powerPending].join(':');
  if(key!==this.projectionKey)this.emit();return s;
 }
 confirm(){
  const r=this.current;if(!this.snapshot().canConfirm)return false;
  const p=this.worldToScreen(r.target,this.camera)||{x:NaN,y:NaN};r.confirming=true;
  let result;
  try{result=r.mode==='placement'?this.callbacks.confirmPlacement?.(p.x,p.y,copy(r.target)):this.callbacks.confirmPower?.(p.x,p.y,r.identity,copy(r.target));}
  catch(error){r.confirming=false;this.emit();throw error;}
  if(!accepted(result)){r.confirming=false;this.lastReason='confirm-rejected';this.emit();return false;}
  if(r.mode==='power')this.powerPending=true;
  if(this.current===r)this.clear('confirmed');return true;
 }
 cancel(reason='cancelled'){
  const r=this.current;if(!r)return false;
  if(r.mode==='power')this.powerPending=true;
  this.clear(reason);
  if(r.mode==='placement')this.callbacks.cancelPlacement?.(copy(r.target));
  else this.callbacks.cancelPower?.(r.identity,copy(r.target));
  return true;
 }
 // A completed native outcome/screen change needs no new A/B action.
 clear(reason='cleared'){
  this.current=null;this.lastReason=reason;return this.emit();
 }
}
