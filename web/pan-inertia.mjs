/** Camera motion in CSS pixels only. No timers, native commands or game state.
 * The input owner begins/samples an ordinary touch/pen pan, releases once,
 * steps from its existing RAF, and cancels on any new/interrupted interaction. */
const time=t=>Number.isFinite(t)&&t>=0&&t<Number.MAX_SAFE_INTEGER-1000;
const bounded=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;

export class PanInertia {
 constructor({tauMs=220,maxSpeed=1000,maxDistance=220,maxDurationMs=850,minSpeed=90,stopSpeed=18}={}){
  this.tauMs=bounded(tauMs,220,150,260);
  this.maxSpeed=bounded(maxSpeed,1000,1,1200);
  this.maxDistance=bounded(maxDistance,220,0,280);
  this.maxDurationMs=bounded(maxDurationMs,850,0,1000);
  this.minSpeed=bounded(minSpeed,90,1,1000);
  this.stopSpeed=bounded(stopSpeed,18,1,1000);
  this.cancel();
 }
 get active(){return this.coasting;}
 debug(){return {phase:this.coasting?'coast':this.tracking?'tracking':'idle',kind:this.kind,samples:this.samples.length,lastSample:this.lastSample,lastMotion:this.lastMotion,vx:this.vx,vy:this.vy,started:this.started,ends:this.ends};}
 cancel(){
  this.tracking=this.coasting=false;this.kind=null;this.samples=[];
  this.lastSample=this.lastMotion=this.started=this.lastStep=this.ends=0;
  this.lastDx=this.lastDy=this.pendingDx=this.pendingDy=this.vx=this.vy=0;
 }
 begin(kind,now){
  this.cancel();
  if((kind!=='touch'&&kind!=='pen')||!time(now))return false;
  this.kind=kind;this.tracking=true;this.lastSample=now;return true;
 }
 sample(dx,dy,now){
  if(!this.tracking)return false;
  if(!time(now)||!Number.isFinite(dx)||!Number.isFinite(dy)||now<this.lastSample){this.cancel();return false;}
  // Browser input can be coalesced or share a reduced-precision clock tick,
  // especially the last pointermove and pointerup. Keep their displacement;
  // equal stamps are not a cancellation or an infinite instantaneous speed.
  if(now===this.lastSample){
   if(!dx&&!dy)return true;
   if(dx*this.lastDx+dy*this.lastDy<0){this.samples=[];this.pendingDx=this.pendingDy=0;}
   const last=this.samples[this.samples.length-1];
   if(last){last.dx+=dx;last.dy+=dy;}else{this.pendingDx+=dx;this.pendingDy+=dy;}
   this.lastDx=dx;this.lastDy=dy;this.lastMotion=now;return true;
  }
  if(dx*this.lastDx+dy*this.lastDy<0){this.samples=[];this.pendingDx=this.pendingDy=0;}
  dx+=this.pendingDx;dy+=this.pendingDy;this.pendingDx=this.pendingDy=0;
  const from=this.lastSample,dt=now-from;this.lastSample=now;
  // A phone can deliver just one pan after the finger was resting. Its true
  // motion duration is unknowable, so accept only substantial fresh movement
  // and give that estimate a modest speed cap at release. A subsequent timed
  // sample replaces it; a held release still expires normally below.
  if(dt>160){
   this.samples=[];this.lastDx=this.lastDy=0;this.lastMotion=0;
   if(Math.hypot(dx,dy)<32)return false;
   this.samples.push({from:now-120,to:now,dx,dy,estimated:true});
   this.lastDx=dx;this.lastDy=dy;this.lastMotion=now;return true;
  }
  if(this.samples.some(sample=>sample.estimated))this.samples=[];
  if(dx||dy){
   // Recent motion must not carry the map in the direction just reversed.
   if(dx*this.lastDx+dy*this.lastDy<0)this.samples=[];
   this.lastDx=dx;this.lastDy=dy;this.lastMotion=now;
  }else{this.samples=[];this.lastMotion=0;this.lastDx=this.lastDy=0;return true;}
  this.samples.push({from,to:now,dx,dy});
  while(this.samples.length&&this.samples[0].to<=now-120)this.samples.shift();
  if(this.samples.length>128)this.samples.splice(0,this.samples.length-128);
  return true;
 }
 release(now){
  if(!this.tracking)return false;
  if(time(now)&&now>this.lastSample&&(this.pendingDx||this.pendingDy))this.sample(0,0,now);
  this.tracking=false;
  if(!time(now)||now<this.lastSample||!this.samples.length||!this.lastMotion||now-this.lastMotion>=130){this.cancel();return false;}
  const end=this.lastSample,start=Math.max(this.samples[0].from,end-120);
  let dx=0,dy=0,travel=0;
  for(const sample of this.samples){
   const overlap=sample.to-Math.max(start,sample.from);
   if(overlap<=0)continue;
   const fraction=overlap/(sample.to-sample.from);
   dx+=sample.dx*fraction;dy+=sample.dy*fraction;
   travel+=Math.hypot(sample.dx,sample.dy)*fraction;
  }
  const span=end-start,net=Math.hypot(dx,dy);
  // One genuine pan event can contain a whole quick phone swipe. The gesture
  // recognizer already required a drag, so measure distance/time, not how many
  // callbacks the browser happened to deliver.
  if(span<8||travel<12||net<12){this.cancel();return false;}
  // A finger held still briefly before release loses its old momentum.
  const freshness=Math.exp(-Math.max(0,now-this.lastMotion-20)/90);
  let vx=dx*1000/span*freshness,vy=dy*1000/span*freshness,speed=Math.hypot(vx,vy);
  if(!Number.isFinite(speed)||speed<this.minSpeed||speed<=this.stopSpeed||!this.maxDistance||!this.maxDurationMs){this.cancel();return false;}
  const speedLimit=this.samples.some(sample=>sample.estimated)?Math.min(this.maxSpeed,300):this.maxSpeed;
  if(speed>speedLimit){vx*=speedLimit/speed;vy*=speedLimit/speed;speed=speedLimit;}
  if(speed<=this.stopSpeed){this.cancel();return false;}
  const fullDistance=speed*this.tauMs/1000;
  const distanceTime=this.maxDistance<fullDistance?-this.tauMs*Math.log1p(-this.maxDistance/fullDistance):Infinity;
  const duration=Math.min(this.maxDurationMs,this.tauMs*Math.log(speed/this.stopSpeed),distanceTime);
  if(!Number.isFinite(duration)||duration<=0){this.cancel();return false;}
  this.vx=vx;this.vy=vy;this.started=this.lastStep=now;this.ends=now+duration;
  this.samples=[];this.coasting=true;return true;
 }
 step(now){
  if(!this.coasting)return null;
  // Resume/long stalls must not turn into an unexpected camera jump.
  if(!time(now)||now<this.lastStep||now-this.lastStep>150){this.cancel();return null;}
  if(now===this.lastStep)return null;
  const end=Math.min(now,this.ends),a=(this.lastStep-this.started)/this.tauMs,b=(end-this.started)/this.tauMs;
  const integral=this.tauMs/1000*(Math.exp(-a)-Math.exp(-b));
  const delta={dx:this.vx*integral,dy:this.vy*integral};this.lastStep=end;
  if(end>=this.ends)this.coasting=false;
  if(!Number.isFinite(delta.dx)||!Number.isFinite(delta.dy)){this.cancel();return null;}
  return delta.dx||delta.dy?delta:null;
 }
}
