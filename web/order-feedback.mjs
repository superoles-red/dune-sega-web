// Display-only acknowledgement of the original contextual-A commit. The native
// action register classifies commands; JavaScript never guesses from ownership.
export const ORDER_FEEDBACK_DURATION=280;
const pointerKind=kind=>['mouse','touch','pen'].includes(kind)?kind:null;
export function initialFeedbackPointerKind(){
 try{return globalThis.matchMedia?.('(pointer: coarse)').matches?'touch':'mouse';}catch{return 'mouse';}
}
export function orderFeedbackPulse(elapsed){
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=ORDER_FEEDBACK_DURATION)return 0;
 return elapsed<100?1:elapsed<180?0:2;
}
export function projectOrderFeedback(world,camera,rect,width=26,height=26){
 if(!world||!camera?.map||!rect||![world.x,world.y,camera.left,camera.top,camera.scale,camera.scaleY,rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||camera.scale<=0||camera.scaleY<=0)return null;
 const x=(world.x-camera.left)*camera.scale,y=(world.y-camera.top)*camera.scaleY;
 if(x<0||y<0||x>=rect.width||y>=rect.height)return null;
 const mini=camera.minimap;if(mini?.visible&&x>=mini.x&&x<mini.x+mini.width&&y>=mini.y&&y<mini.y+mini.height)return null;
 return {x:rect.left+x-width*camera.scale/2,y:rect.top+y-height*camera.scaleY/2,width:width*camera.scale,height:height*camera.scaleY};
}

export class OrderFeedback {
 constructor({canvas,pointerKind:kind=initialFeedbackPointerKind(),anchoredSpecial=false}){
  this.anchoredSpecial=anchoredSpecial;this.targetPreview=null;this.canvas=canvas;this.pointerKind=pointerKind(kind)||'mouse';this.ready=false;this.assets={};this.current=null;this.special=null;this.specialPoint=null;this.lastPointer=null;this.specialDragging=false;this.lastSequence=0;this.acceptedIntents=0;this.displayedPulses=0;this.lastWorld=null;this.lastPulse=0;this.lastProjection=null;
  this.element=document.createElement('div');this.element.id='order-feedback';this.element.className='order-feedback';this.element.hidden=true;this.element.setAttribute('aria-hidden','true');this.element.style.cssText='position:fixed;inset:0;z-index:9;overflow:hidden;pointer-events:none';
  this.image=document.createElement('img');this.image.className='order-feedback-reticle';this.image.alt='';this.image.draggable=false;this.image.hidden=true;this.image.style.cssText='position:absolute;display:block;pointer-events:none;image-rendering:pixelated';
  this.specialImage=document.createElement('img');this.specialImage.className='special-target-indicator';this.specialImage.alt='';this.specialImage.draggable=false;this.specialImage.hidden=true;this.specialImage.style.cssText='position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:clamp(128px,44vmin,256px);height:clamp(128px,44vmin,256px);opacity:.55;object-fit:contain;pointer-events:none;image-rendering:pixelated';this.element.append(this.image,this.specialImage);document.body.append(this.element);
 }
 async load(){
  if(this.loading)return this.loading;
  this.loading=(async()=>{for(const [kind,path,id] of [['move','manifest.json','ordinary-map-cursor-BF18'],['attack','attack-manifest.json','native-map-target-cursor-5']]){const manifestURL=new URL('./input-feedback/'+path,import.meta.url),response=await fetch(manifestURL);if(!response.ok)throw Error('Original reticle manifest HTTP '+response.status);const m=await response.json();if(m.id!==id||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width>64||m.height>64)throw Error('Original reticle manifest is invalid');const probe=document.createElement('img'),url=new URL(m.path,manifestURL).href;probe.src=url;await probe.decode();if(probe.naturalWidth!==m.width||probe.naturalHeight!==m.height)throw Error('Original reticle dimensions differ from manifest');this.assets[kind]={...m,url};if(kind==='move'){this.manifest=m;this.image.src=url;this.ready=true;}}return this;})();return this.loading;
 }
 get active(){return !!this.current||!!this.special?.armed;}
 setTargetPreview(world){this.targetPreview=world&&Number.isFinite(world.x)&&Number.isFinite(world.y)?{x:world.x,y:world.y}:null;if(this.anchoredSpecial&&!this.targetPreview){this.specialImage.hidden=true;if(!this.current)this.element.hidden=true;}}
 setPointerKind(kind){
  const next=pointerKind(kind);if(!next||next===this.pointerKind)return false;
  this.pointerKind=next;
  if(next==='mouse'&&this.special?.armed&&!this.specialDragging&&this.lastPointer)this.specialPoint={...this.lastPointer};
  return true;
 }
 acknowledge(x,y,now=performance.now(),kind='move'){
  if(![x,y,now].every(Number.isFinite))return false;
  this.current={x,y,start:now,kind:kind==='special'?'special':kind==='attack'?'attack':'move'};this.lastWorld={x,y};this.lastPulse=0;this.lastProjection=null;this.acceptedIntents++;return true;
 }
 observe(actions,{blocked=false,now=performance.now()}={}){
  const wasArmed=!!this.special?.armed;this.special=actions?.special?.armed?actions.special:null;if(!this.special||!wasArmed){this.specialPoint=this.special&&this.lastPointer?{...this.lastPointer}:null;this.specialDragging=false;}
  // Once cancelled there may be no active feedback left, so the host stops
  // calling render(). Remove the previous Palace marker at this state change.
  if(wasArmed&&!this.special){this.specialImage.hidden=true;if(!this.current){this.image.hidden=true;this.element.hidden=true;}}
  const order=actions?.lastOrder,seq=order?.seq;if(!Number.isSafeInteger(seq)||seq<0)return;
  if(seq<this.lastSequence)this.lastSequence=seq;
  if(seq===this.lastSequence)return;this.lastSequence=seq;
  if(!blocked&&['move','attack','special'].includes(order.kind))this.acknowledge(order.worldX,order.worldY,now,order.kind);
 }
 aimAt(x,y){if(![x,y].every(Number.isFinite))return;this.lastPointer={x,y};if(this.special?.armed){this.specialPoint={x,y};this.specialDragging=false;}}
 panAim(){if(this.special?.armed){this.specialDragging=true;this.specialPoint=null;}}
 releaseAim(x,y){this.specialDragging=false;if([x,y].every(Number.isFinite))this.aimAt(x,y);}
 clear({reset=false}={}){this.targetPreview=null;this.current=null;this.special=null;this.specialPoint=null;this.specialDragging=false;this.lastPulse=0;this.lastProjection=null;this.image.hidden=true;this.specialImage.hidden=true;this.element.hidden=true;if(reset){this.lastSequence=0;this.lastPointer=null;}}
 render(now,camera,{blocked=false}={}){
  if(blocked||!camera?.map){this.clear();return;}
  const attack=this.assets.attack,fixed=this.pointerKind!=='mouse',r=this.canvas.getBoundingClientRect(),worldProjection=this.targetPreview?projectOrderFeedback(this.targetPreview,camera,r,0,0):null,point=this.anchoredSpecial?(worldProjection?{x:worldProjection.x-r.left,y:worldProjection.y-r.top}:null):fixed?(r.width>0&&r.height>0?{x:r.width/2,y:r.height/2}:null):this.specialPoint;
  // A touch/pen has no permanent hovering cursor. This screen-centred marker
  // only announces the armed original Palace; the native tap still supplies
  // the exact target. Panning/pinching move the map underneath the marker.
  this.specialImage.hidden=!(this.special?.armed&&attack&&point)||(!this.anchoredSpecial&&!fixed&&this.specialDragging);if(!this.specialImage.hidden){this.specialImage.src=attack.url;Object.assign(this.specialImage.style,{left:(r.left+point.x)+'px',top:(r.top+point.y)+'px',opacity:'.65'});}
  this.element.hidden=this.specialImage.hidden;this.image.hidden=true;
  if(!this.current)return;
  // RAF timestamps describe the beginning of a frame. A native-order poll can
  // run later within it, especially on a busy phone; that acknowledgement is
  // still pending, rather than expired, until a subsequent frame catches up.
  const elapsed=now-this.current.start;if(elapsed<0)return;
  if(elapsed>=ORDER_FEEDBACK_DURATION){this.current=null;this.lastPulse=0;this.lastProjection=null;return;}
  const asset=this.current.kind==='special'?this.assets.attack:this.assets[this.current.kind]||(this.current.kind==='move'?this.manifest:null),pulse=orderFeedbackPulse(elapsed),rect=this.canvas.getBoundingClientRect(),p=projectOrderFeedback(this.current,camera,rect,asset?.width||26,asset?.height||26);
  if(!this.ready||!asset||!p||!pulse)return;
  if(this.current.kind==='special'){const size=Math.max(128,Math.min(256,Math.min(rect.width,rect.height)*.44)),cx=p.x+p.width/2,cy=p.y+p.height/2;p.x=cx-size/2;p.y=cy-size/2;p.width=p.height=size;}
  if(this.lastPulse!==pulse){this.lastPulse=pulse;this.displayedPulses++;}
  if(asset.url)this.image.src=asset.url;Object.assign(this.image.style,{left:p.x+'px',top:p.y+'px',width:p.width+'px',height:p.height+'px'});this.lastProjection=p;this.element.hidden=false;this.image.hidden=false;
 }
 debug(){return {active:this.active,assetReady:this.ready,attackAssetReady:!!this.assets.attack,special:this.special,pointerKind:this.pointerKind,specialDisplayMode:this.anchoredSpecial?'world':this.pointerKind==='mouse'?'pointer':'screen-centre',lastSequence:this.lastSequence,kind:this.current?.kind,acceptedIntents:this.acceptedIntents,displayedPulses:this.displayedPulses,pulse:this.lastPulse,world:this.lastWorld,projection:this.lastProjection,meaning:'original contextual-A action committed; native combat/pathfinding still decide its result'};}
}
