// Read-only lesson checks over the real native training fixture.
// This module cannot issue orders or write game state.
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const distance=(a,b)=>Math.hypot(num(a?.worldX)-num(b?.worldX),num(a?.worldY)-num(b?.worldY));
const concrete=object=>object&&num(object.product)>=0&&num(object.product)<=1;
const same=(a,b)=>num(a)>0&&num(a)===num(b);
export function normalizeTrainingState(value={}){
 const native=value.native||{},actions=value.actions||{},building=value.building||{},camera=value.camera||{};
 return {native,actions,building,camera,objects:native.objects||{},selected:actions.selected||{},order:actions.lastOrder||{},credits:num(native.credits)};
}
export class NativeTrainingProgress{
 constructor(steps=[]){this.steps=steps;this.index=0;this.complete=false;this.blocked='';this.baseline=null;this.lastState=null;this.observed={};this.session={harvest:null,delivery:null};}
 get step(){return this.steps[this.index];}
 begin(value){const state=normalizeTrainingState(value);this.baseline=clone(state);this.lastState=state;this.complete=false;this.blocked='';this.observed={};return this.observe(value);}
 next(){if(!this.complete||this.index>=this.steps.length-1)return false;this.index++;this.begin(this.lastStateEnvelope);return true;}
 confirmHarvest(state){
  if(this.session.harvest)return;
  const harvester=state.objects.harvester;
  this.session.harvest={pointer:num(harvester.pointer),orderSeq:num(this.observed.harvestOrderSeq),peakCargo:num(harvester.cargo),creditsAtPeak:state.credits,lastCargo:num(harvester.cargo),lastCredits:state.credits,pendingDrop:null};
 }
 trackDelivery(state){
  const harvest=this.session.harvest,harvester=state.objects.harvester;
  if(!harvest||!state.native.active||!harvester?.alive||!same(harvester.pointer,harvest.pointer))return;
  const cargo=num(harvester.cargo),credits=state.credits;
  if(cargo>harvest.peakCargo){harvest.peakCargo=cargo;harvest.creditsAtPeak=credits;}
  if(cargo<harvest.lastCargo&&harvest.lastCargo>0){
   // A native unload can credit the bank just before or just after its cargo
   // byte changes. Keep both the last report and the confirmed cargo peak.
   harvest.pendingDrop={cargoBefore:harvest.lastCargo,cargoAfter:cargo,creditsBefore:Math.min(harvest.lastCredits,harvest.creditsAtPeak)};
  }
  if(!this.session.delivery&&harvest.pendingDrop&&credits>harvest.pendingDrop.creditsBefore)this.session.delivery={...harvest.pendingDrop,creditsAfter:credits};
  harvest.lastCargo=cargo;harvest.lastCredits=credits;
 }
 observe(value){
  const state=normalizeTrainingState(value);this.lastStateEnvelope=value;this.lastState=state;if(!this.baseline){this.baseline=clone(state);return this.observe(value);}const b=this.baseline,id=this.step?.id,o=state.objects,bo=b.objects,a=state.actions,order=state.order;
  this.trackDelivery(state);
  this.blocked='';if(this.complete&&state.native.active)return this.result();if(!state.native.active){this.complete=false;this.blocked='TRAINING MAP IS NOT READY';return this.result();}
  const needed=id==='harvest'||id==='unload'||id==='select-harvester'?['harvester','refinery']:id==='complete'?[]:['tank','yard'];
  if(needed.some(key=>!o[key]?.alive)){this.blocked='AN ESSENTIAL UNIT OR BUILDING WAS LOST';return this.result();}
  const ownTank=same(state.selected.pointer,o.tank?.pointer),ownHarvester=same(state.selected.pointer,o.harvester?.pointer),newOrder=num(order.seq)>num(b.order.seq),tankOrder=newOrder&&same(order.actor,o.tank?.pointer),harvestOrder=newOrder&&same(order.actor,o.harvester?.pointer),yardMenu=!!state.building.active&&same(state.building.producer?.pointer,o.yard?.pointer),raw=num(state.building.selectedRaw),paidConcrete=concrete(o.yard)&&((o.yard.productionIndex!=null&&num(o.yard.productionIndex)!==255)||!!o.yard.ready);
  if(tankOrder&&order.kind==='attack'&&same(order.target,o.enemy?.pointer))this.observed.attackOrder=true;
  if(harvestOrder){this.observed.harvestOrder=true;this.observed.harvestOrderSeq=num(order.seq);}
  switch(id){
   case'pan':this.complete=Math.hypot(num(state.camera.cameraX)-num(b.camera.cameraX),num(state.camera.cameraY)-num(b.camera.cameraY))>=24;break;
   case'zoom':this.complete=Math.abs(num(state.camera.zoom)-num(b.camera.zoom))>=5;break;
   case'select-tank':this.complete=ownTank&&!!state.selected.own;break;
   case'move-tank':if(tankOrder&&order.kind==='move')this.observed.moveOrder=true;this.complete=!!this.observed.moveOrder&&distance(o.tank,bo.tank)>=12;break;
   case'clear':this.complete=num(a.nativeClears)>num(b.actions.nativeClears)&&state.selected.kind==='none';break;
   case'attack':this.complete=!!this.observed.attackOrder&&(!o.enemy?.alive||num(o.enemy?.hp)<num(bo.enemy?.hp));if(!o.enemy?.alive&&!this.observed.attackOrder&&!this.complete)this.blocked='THE TARGET WAS LOST BEFORE THE ATTACK ORDER';break;
   case'enter-yard':this.complete=yardMenu;break;
   case'preview':this.complete=yardMenu&&((!!state.building.previewArmed&&raw>=0&&raw<=1)||paidConcrete);break;
   case'buy':this.complete=paidConcrete&&(state.credits<b.credits||!!o.yard.ready||(bo.yard?.productionIndex!=null&&num(bo.yard.productionIndex)!==255));break;
   case'exit':this.complete=!state.building.active&&!!state.native.map;break;
   case'ready':this.complete=!!o.yard?.ready&&concrete(o.yard);break;
   case'place':this.complete=num(a.placementSuccesses)>num(b.actions.placementSuccesses)&&(state.native.concreteTiles==null||num(state.native.concreteTiles)>num(b.native.concreteTiles));break;
   case'select-harvester':this.complete=ownHarvester&&!!state.selected.own;break;
   case'harvest':this.complete=!!this.observed.harvestOrder&&num(o.harvester?.cargo)>num(bo.harvester?.cargo);if(this.complete)this.confirmHarvest(state);break;
   case'unload':this.complete=!!this.session.delivery;break;
   case'complete':this.complete=true;break;
   default:this.complete=false;
  }
  return this.result();
 }
 result(){return {id:this.step?.id,index:this.index,complete:!!this.complete,blocked:this.blocked,step:this.step,evidence:{harvestConfirmed:!!this.session.harvest,harvestPeak:this.session.harvest?.peakCargo||0,deliveryConfirmed:!!this.session.delivery,delivery:this.session.delivery?{...this.session.delivery}:null}};}
}
