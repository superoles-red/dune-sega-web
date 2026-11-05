export const DOUBLE_TAP_MS=300;
export const DOUBLE_TAP_SLOP=24;

const accepted=value=>value===true||(typeof value==='number'&&Number.isFinite(value)&&value>0);
const world=state=>!!state&&!state.capturesInput&&[1,'map','world'].includes(state.context);
const source=state=>!!state.powerArmed||(!!state.own&&state.kind==='unit');

/** Immediate selection and retained-source orders, independent of the simulation.
 * captureActor returns an opaque, truthy native token (0 means no actor).
 * readState is a neutral UI snapshot: own, kind ('unit'/'building'), powerArmed,
 * capturesInput and context (1/'map'/'world'). The caller cancels pending pairs
 * when a pan, pinch, placement, minimap gesture, UI route or visibility change
 * interrupts input. Pending/idle gesture notifications do not interrupt pairs.
 */
export class OrderInput {
  constructor({readState,captureActor,select,command,now=()=>performance.now(),doubleTapMs=DOUBLE_TAP_MS,slop=DOUBLE_TAP_SLOP}){
    Object.assign(this,{readState,captureActor,select,command,now,doubleTapMs,slop});
    this.pair=null;this.lastAction='idle';
  }
  cancel(){this.pair=null;this.lastAction='cancelled';}
  snapshot(){return {pending:!!this.pair,pointerKind:this.pair?.kind??null,button:this.pair?.button??null,power:!!this.pair?.power,lastAction:this.lastAction};}
  rightTap(x,y,kind='mouse'){return this.tap(x,y,kind,2);}
  tap(x,y,kind='touch',button=0){
    const state=this.readState(x,y),time=this.now();
    if(!world(state)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(time)||!['touch','pen','mouse'].includes(kind)||(button!==0&&!(kind==='mouse'&&button===2))){this.cancel();this.lastAction='ignored';return 0;}
    const previous=this.pair;
    const match=previous&&previous.kind===kind&&previous.button===button&&time>=previous.time&&time-previous.time<=this.doubleTapMs&&Math.hypot(x-previous.x,y-previous.y)<=this.slop;
    // Only mobile input and explicitly armed Palace pairs can issue a paired
    // order. The retained Palace source survives the first tap clearing it.
    if(match&&(kind!=='mouse'||previous.power)){
      this.pair=null;this.lastAction='command';return +accepted(this.command(x,y,previous.token));
    }
    this.pair=null;
    if(kind==='mouse'&&button===2){
      const token=this.captureActor();
      if(state.powerArmed){
        if(token)this.pair={x,y,time,kind,button,token,power:true};
        this.lastAction='power-wait';return 0;
      }
      this.lastAction=token?'command':'ignored';return token?+accepted(this.command(x,y,token)):0;
    }
    const power=!!state.powerArmed,pairAllowed=kind!=='mouse'||power;
    const hadSource=source(state);
    const before=pairAllowed&&hadSource?this.captureActor():null;
    this.lastAction='select';
    const result=+accepted(this.select(x,y));
    // Native selection can be queued until the next frame. Its capture API
    // knows that pending selection, so do not depend on a stale second snapshot.
    const token=pairAllowed?(hadSource?before:this.captureActor()):null;
    if(token)this.pair={x,y,time,kind,button,token,power};
    return result;
  }
}
