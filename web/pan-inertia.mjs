/** Camera motion in CSS pixels only. No timers, native commands or game state.
 * The input owner begins/samples an ordinary touch/pen pan, releases once,
 * steps from its existing RAF, and cancels on any new/interrupted interaction. */
const time=t=>Number.isFinite(t)&&t>=0&&t<Number.MAX_SAFE_INTEGER-1000;
const bounded=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;

export class PanInertia {
 constructor({tauMs=180,maxSpeed=900,maxDistance=160,maxDurationMs=650,minSpeed=140,stopSpeed=18}={}){
  this.tauMs=bounded(tauMs,180,150,220);
  this.maxSpeed=bounded(maxSpeed,900,1,1000);
  this.maxDistance=bounded(maxDistance,160,0,180);
  this.maxDurationMs=bounded(maxDurationMs,650,0,650);
  this.minSpeed=bounded(minSpeed,140,1,1000);
  this.stopSpeed=bounded(stopSpeed,18,1,1000);
  this.cancel();
 }
 get active(){return this.coasting;}
 cancel(){
  this.tracking=this.coasting=false;this.kind=null;this.samples=[];
  this.lastSample=this.lastMotion=this.started=this.lastStep=this.ends=0;
  this.lastDx=this.lastDy=this.vx=this.vy=0;
 }
 begin(kind,now){
  this.cancel();
  if((kind!=='touch'&&kind!=='pen')||!time(now))return false;
  this.kind=kind;this.tracking=true;this.lastSample=now;return true;
 }
 sample(dx,dy,now){
  if(!this.tracking)return false;
  if(!time(now)||!Number.isFinite(dx)||!Number.isFinite(dy)||now<=this.lastSample){this.cancel();return false;}
  const from=this.lastSample,dt=now-from;this.lastSample=now;
  // A hold followed by one jump cannot manufacture a fresh flick velocity.
  if(dt>120){this.samples=[];this.lastDx=this.lastDy=0;this.lastMotion=0;return false;}
  if(dx||dy){
   // Recent motion must not carry the map in the direction just reversed.
   if(dx*this.lastDx+dy*this.lastDy<0)this.samples=[];
   this.lastDx=dx;this.lastDy=dy;this.lastMotion=now;
  }
  this.samples.push({from,to:now,dx,dy});
  while(this.samples.length&&this.samples[0].to<=now-90)this.samples.shift();
  if(this.samples.length>128)this.samples.splice(0,this.samples.length-128);
  return true;
 }
 release(now){
  if(!this.tracking)return false;
  this.tracking=false;
  if(!time(now)||now<this.lastSample||!this.samples.length||!this.lastMotion||now-this.lastMotion>=80){this.cancel();return false;}
  const end=this.lastSample,start=Math.max(this.samples[0].from,end-90);
  let dx=0,dy=0,travel=0,count=0;
  for(const sample of this.samples){
   const overlap=sample.to-Math.max(start,sample.from);
   if(overlap<=0)continue;
   const fraction=overlap/(sample.to-sample.from);
   dx+=sample.dx*fraction;dy+=sample.dy*fraction;
   travel+=Math.hypot(sample.dx,sample.dy)*fraction;
   if(sample.dx||sample.dy)count++;
  }
  const span=end-start,net=Math.hypot(dx,dy);
  if(count<2||span<20||travel<14||net<14){this.cancel();return false;}
  // A finger held still briefly before release loses its old momentum.
  const freshness=Math.exp(-(now-this.lastMotion)/48);
  let vx=dx*1000/span*freshness,vy=dy*1000/span*freshness,speed=Math.hypot(vx,vy);
  if(!Number.isFinite(speed)||speed<this.minSpeed||speed<=this.stopSpeed||!this.maxDistance||!this.maxDurationMs){this.cancel();return false;}
  if(speed>this.maxSpeed){vx*=this.maxSpeed/speed;vy*=this.maxSpeed/speed;speed=this.maxSpeed;}
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
