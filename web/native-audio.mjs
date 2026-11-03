/* AudioWorklet is an optional output consumer, never a second synthesizer.
 * SDL remains untouched until setup succeeds and is restored on failure. */
export class NativeAudioBridge {
  constructor({Module,workletUrl=new URL('./native-audio-worklet.js',import.meta.url),prerollMs=120,maxQueueMs=320,now=()=>performance.now()}={}){
    this.Module=Module;this.url=workletUrl;this.prerollMs=prerollMs;this.maxQueueMs=maxQueueMs;this.now=now;
    this.backend='sdl';this.ready=false;this.epoch=0;this.playing=true;this.startPromise=null;this.resumePromise=null;this.context=null;this.node=null;this.script=null;
    this.needsFreshEpoch=false;this.suspendedObserved=false;this.outputPlaying=null;
    this.metrics={suspendedDiscardedFrames:0,suspendedPackets:0,resumeEpochFlushes:0,packets:0,sentFrames:0,maxProducerGapMs:0,producerGapsOver80ms:0,flushes:0,resumeCalls:0};this.processor={};this.lastPush=null;this.error=null;
  }
  start(){
    if(this.startPromise)return this.startPromise;
    this.startPromise=this.setup().catch(e=>{this.fallback(e);return false;}).then(ok=>{if(!ok)this.startPromise=null;return ok;});
    return this.startPromise;
  }
  async setup(){
    const M=this.Module,SDL=M?.SDL2;
    const context=SDL?.audioContext,script=SDL?.audio?.scriptProcessorNode;
    if(!context?.audioWorklet||typeof globalThis.AudioWorkletNode!=='function'||!script||!M?._dune_web_audio_worklet)return false;
    this.context=context;this.script=script;this.sdl=SDL;
    await context.audioWorklet.addModule(this.url);
    const node=new AudioWorkletNode(context,'dune-native-pcm',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{sourceRate:48000,prerollMs:this.prerollMs,maxQueueMs:this.maxQueueMs}});
    this.node=node;
    node.port.onmessage=({data})=>{if(data?.type==='metrics')this.processor=data;};
    node.onprocessorerror=()=>this.fallback(new Error('native PCM AudioWorklet processor error'));
    M.nativeAudioBridge=this;
    node.connect(context.destination);
    // Do not leave SDL's main-thread callback connected alongside the worklet.
    script.disconnect();
    this.ready=true;this.backend='worklet';
    if(!M._dune_web_audio_worklet(1))throw new Error('native PCM output route unavailable');
    // SDL installs a suspended-context silence timer. Retain its unlock helper
    // until running, then stop its unnecessary main-thread callbacks too.
    this.contextChanged=()=>this.syncContext();
    context.addEventListener?.('statechange',this.contextChanged);this.contextChanged();
    return true;
  }
  fallback(error){
    this.error=String(error?.message??error??'');
    this.context?.removeEventListener?.('statechange',this.contextChanged);
    const was=this.ready;this.ready=false;this.backend='sdl';
    try{this.Module?._dune_web_audio_worklet?.(0);}catch{}
    try{this.node?.disconnect();}catch{}
    if(was)try{this.script?.connect(this.context.destination);}catch{}
    if(this.Module?.nativeAudioBridge===this)delete this.Module.nativeAudioBridge;
  }
  pushPCM(pointer,frames){
    if(!this.ready||!this.node||frames<1)return false;
    if(this.context.state!=='running'){
      this.observeSuspended();
      // Consume native output but do not enqueue history in a suspended port.
      this.metrics.suspendedDiscardedFrames+=frames;++this.metrics.suspendedPackets;
      return true;
    }
    if(!this.freshOutputEpoch())return false;
    this.suspendedObserved=false;this.publishPlaying(this.playing);
    const at=this.now();
    if(this.lastPush!==null){const gap=at-this.lastPush;this.metrics.maxProducerGapMs=Math.max(this.metrics.maxProducerGapMs,gap);if(gap>80)++this.metrics.producerGapsOver80ms;}
    this.lastPush=at;
    // Own transferable copy: WASM linear memory may grow or be reused next batch.
    const samples=this.Module.HEAPU8.slice(pointer,pointer+frames*4).buffer;
    try{this.node.port.postMessage({type:'pcm',epoch:this.epoch,frames,samples},[samples]);}
    catch(e){this.fallback(e);return false;}
    ++this.metrics.packets;this.metrics.sentFrames+=frames;return true;
  }
  flush(epoch){
    this.epoch=epoch>>>0;this.lastPush=null;++this.metrics.flushes;
    this.node?.port.postMessage({type:'flush',epoch:this.epoch});
  }
  publishPlaying(playing){
    if(this.outputPlaying===!!playing)return;
    this.outputPlaying=!!playing;
    this.node?.port.postMessage({type:'playing',playing:this.outputPlaying});
  }
  observeSuspended(){
    if(!this.suspendedObserved){this.suspendedObserved=true;this.needsFreshEpoch=true;this.lastPush=null;this.publishPlaying(false);}
  }
  freshOutputEpoch(){
    if(!this.needsFreshEpoch||!this.ready)return this.ready;
    // The C setter owns/increments the epoch and calls flush(epoch) back here.
    // JS never invents an epoch which could collide with a later native load.
    this.needsFreshEpoch=false;
    try{if(!this.Module._dune_web_audio_worklet(1))throw Error('native PCM resume route unavailable');}
    catch(e){this.fallback(e);return false;}
    ++this.metrics.resumeEpochFlushes;return true;
  }
  syncContext(){
    if(!this.ready)return;
    if(this.context.state!=='running'){this.observeSuspended();return;}
    if(!this.freshOutputEpoch())return;
    this.suspendedObserved=false;this.publishPlaying(this.playing);
    const audio=this.sdl?.audio;
    if(audio?.silenceTimer!==undefined){clearInterval(audio.silenceTimer);audio.silenceTimer=undefined;audio.silenceBuffer=undefined;}
  }
  setPlaying(playing){
    this.playing=!!playing;
    if(!this.playing)this.publishPlaying(false);
    else if(this.context?.state==='running'&&!this.needsFreshEpoch)this.publishPlaying(true);
  }
  resume(){
    if(!this.ready&&!this.startPromise)this.start();
    const context=this.context??this.Module?.SDL2?.audioContext;
    if(!context||context.state!=='suspended')return Promise.resolve();
    if(this.resumePromise)return this.resumePromise;
    if(this.ready){this.observeSuspended();this.freshOutputEpoch();}
    ++this.metrics.resumeCalls;
    this.resumePromise=Promise.resolve(context.resume()).then(()=>this.syncContext()).catch(e=>{this.error=String(e?.message??e);}).finally(()=>{this.resumePromise=null;});
    return this.resumePromise;
  }
  snapshot(){
    const c=this.context??this.Module?.SDL2?.audioContext;
    return {backend:this.backend,ready:this.ready,contextState:c?.state??'unavailable',outputSampleRate:c?.sampleRate??0,baseLatencyMs:c?.baseLatency?c.baseLatency*1000:0,outputLatencyMs:c?.outputLatency?c.outputLatency*1000:0,epoch:this.epoch,playing:this.playing,...this.metrics,processor:{...this.processor},error:this.error};
  }
}
