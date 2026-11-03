/* Only playback of the unchanged native 48 kHz stereo PCM lives here.
 * MessagePort deliberately avoids SharedArrayBuffer/COOP/COEP requirements. */
class DuneNativePCM extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const p=options.processorOptions??{};
    this.sourceRate=p.sourceRate??48000;
    this.step=this.sourceRate/sampleRate;
    this.capacity=this.sourceRate*2;
    this.ring=new Int16Array(this.capacity*2);
    this.read=0;this.count=0;this.fraction=0;
    this.preroll=Math.round(this.sourceRate*(p.prerollMs??120)/1000);
    this.ceiling=Math.round(this.sourceRate*(p.maxQueueMs??320)/1000);
    this.epoch=0;this.playing=true;this.primed=false;this.rebuffering=false;
    this.fade=0;this.fadeFrames=32;this.lastL=0;this.lastR=0;this.tail=0;
    this.reportClock=0;
    this.metrics={receivedFrames:0,consumedFrames:0,outputFrames:0,prerollFrames:0,underrunFrames:0,underrunEvents:0,discardedFrames:0,overflowEvents:0,flushes:0,peakFrames:0,minFrames:null};
    this.port.onmessage=({data:d})=>{
      if(d.type==='flush'){
        this.epoch=d.epoch>>>0;this.read=this.count=this.fraction=0;this.primed=false;this.rebuffering=false;this.fade=0;this.tail=0;this.lastL=this.lastR=0;++this.metrics.flushes;
      }else if(d.type==='playing'){
        this.playing=!!d.playing;
        if(!this.playing){this.read=this.count=this.fraction=0;this.primed=false;this.rebuffering=false;this.fade=0;this.tail=0;}
      }else if(d.type==='pcm'&&(d.epoch>>>0)===this.epoch){
        const pcm=new Int16Array(d.samples),n=Math.min(d.frames>>>0,pcm.length>>>1);
        if(!n)return;
        this.metrics.receivedFrames+=n;
        // A suspended/throttled producer must not leave seconds of old clicks.
        // Overflow trims output only, never chip clocks, world state or events.
        let skip=Math.max(0,n-this.ceiling);
        if(this.count+n-skip>this.ceiling){
          const keep=Math.min(this.preroll,this.count,Math.max(0,this.ceiling-(n-skip))),drop=this.count-keep;
          this.read=(this.read+drop)%this.capacity;this.count=keep;
          this.metrics.discardedFrames+=drop;++this.metrics.overflowEvents;
        }
        let write=(this.read+this.count)%this.capacity;
        this.metrics.discardedFrames+=skip;
        for(let i=skip;i<n;++i){this.ring[write*2]=pcm[i*2];this.ring[write*2+1]=pcm[i*2+1];write=(write+1)%this.capacity;}
        this.count+=n-skip;
        this.metrics.peakFrames=Math.max(this.metrics.peakFrames,this.count);
      }else if(d.type==='metrics')this.report();
    };
  }
  report(){
    this.port.postMessage({type:'metrics',...this.metrics,epoch:this.epoch,queuedFrames:this.count,queuedMs:this.count*1000/this.sourceRate,primed:this.primed,playing:this.playing,sourceRate:this.sourceRate,outputRate:sampleRate,prerollMs:this.preroll*1000/this.sourceRate});
  }
  process(_inputs,outputs){
    const out=outputs[0];if(!out?.length)return true;
    const left=out[0],right=out[1]??left,n=left.length;
    // Browser may change render-quantum length; never assume exactly128.
    left.fill(0);if(right!==left)right.fill(0);
    this.metrics.outputFrames+=n;
    if(this.playing){
      if(!this.primed&&this.count>=this.preroll){this.primed=true;this.fade=this.rebuffering?this.fadeFrames:0;this.tail=0;}
      for(let i=0;i<n;++i){
        const need=this.step===1?1:Math.max(2,Math.floor(this.fraction+this.step)+1);
        if(this.primed&&this.count>=need){
          let l=this.ring[this.read*2]/32768,r=this.ring[this.read*2+1]/32768;
          if(this.step!==1){const next=(this.read+1)%this.capacity,f=this.fraction;l+=(this.ring[next*2]/32768-l)*f;r+=(this.ring[next*2+1]/32768-r)*f;}
          if(this.fade){const gain=(this.fadeFrames-this.fade)/this.fadeFrames;--this.fade;l*=gain;r*=gain;}
          left[i]=this.lastL=l;right[i]=this.lastR=r;
          this.fraction+=this.step;const take=Math.floor(this.fraction);this.fraction-=take;
          this.read=(this.read+take)%this.capacity;this.count-=take;this.metrics.consumedFrames+=take;
          this.metrics.minFrames=this.metrics.minFrames===null?this.count:Math.min(this.metrics.minFrames,this.count);
        }else{
          if(this.primed){this.primed=false;this.rebuffering=true;this.tail=this.fadeFrames;++this.metrics.underrunEvents;}
          if(this.tail){const g=this.tail/this.fadeFrames;--this.tail;left[i]=this.lastL*g;right[i]=this.lastR*g;}
          if(this.rebuffering)++this.metrics.underrunFrames;else ++this.metrics.prerollFrames;
        }
      }
    }
    this.reportClock+=n;
    if(this.reportClock>=sampleRate/2){this.reportClock=0;this.report();}
    return true;
  }
}
registerProcessor('dune-native-pcm',DuneNativePCM);
