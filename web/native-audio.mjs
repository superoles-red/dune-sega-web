/* AudioWorklet is an optional output consumer, never a second synthesizer.
 * SDL remains untouched until setup succeeds and is restored on failure. */
export class NativeAudioBridge {
  constructor({Module,workletUrl=new URL('./native-audio-worklet.js',import.meta.url),prerollMs=120,maxQueueMs=320,resumeTimeoutMs=1000,resumeRetryMs=250,now=()=>performance.now(),recoverInterruptions=false,audioSession=null,healthWindowMs=1250,createContext=rate=>new (globalThis.AudioContext||globalThis.webkitAudioContext)({sampleRate:rate})}={}){
    this.Module=Module;this.url=workletUrl;this.prerollMs=prerollMs;this.maxQueueMs=maxQueueMs;this.resumeTimeoutMs=resumeTimeoutMs;this.resumeRetryMs=resumeRetryMs;this.now=now;
    this.backend='sdl';this.ready=false;this.epoch=0;this.playing=true;this.startPromise=null;this.resumePromise=null;this.context=null;this.node=null;this.script=null;
    this.needsFreshEpoch=false;this.suspendedObserved=false;this.outputPlaying=null;this.pageActive=true;this.resumeRequest=null;
    this.recoverInterruptions=recoverInterruptions;this.audioSession=audioSession;this.healthWindowMs=healthWindowMs;this.createContext=createContext;
    this.hasRendered=false;this.health=null;this.nudgePending=false;this.nudged=false;this.rebuildNeeded=false;this.nudge=null;this.replacement=null;this.retryAfter=0;
    this.metrics={suspendedDiscardedFrames:0,suspendedPackets:0,hiddenDiscardedFrames:0,hiddenPackets:0,resumeEpochFlushes:0,resumeTimeouts:0,resumeSuperseded:0,packets:0,sentFrames:0,maxProducerGapMs:0,producerGapsOver80ms:0,flushes:0,resumeCalls:0};this.processor={};this.lastPush=null;this.error=null;
    if(recoverInterruptions)audioSession?.addEventListener?.('statechange',()=>{
      if(audioSession.state==='interrupted'){
        this.noteInterruption();this.cancelNudge();this.cancelReplacement();this.observeSuspended();this.settleResume(this.resumeRequest,false);
      }else if(this.pageActive&&this.hasRendered)this.resume();
    });
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
    const node=this.makeNode(context);
    this.node=node;this.processor={};
    M.nativeAudioBridge=this;
    node.connect(context.destination);
    // Do not leave SDL's main-thread callback connected alongside the worklet.
    script.disconnect();
    this.ready=true;this.backend='worklet';
    if(!M._dune_web_audio_worklet(1))throw new Error('native PCM output route unavailable');
    // SDL installs a suspended-context silence timer. Retain its unlock helper
    // until running, then stop its unnecessary main-thread callbacks too.
    this.watchContext(context);this.syncContext();
    return true;
  }
  makeNode(context){
    const node=new AudioWorkletNode(context,'dune-native-pcm',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{sourceRate:48000,prerollMs:this.prerollMs,maxQueueMs:this.maxQueueMs}});
    node.port.onmessage=({data})=>{if(this.node===node&&data?.type==='metrics'){this.processor=data;if(data.outputFrames>0)this.hasRendered=true;
      const stalled=this.stalled;
      if(this.rebuildNeeded&&stalled&&data.epoch===this.epoch&&data.outputFrames>stalled.frames&&this.context.currentTime>stalled.clock&&this.context.state==='running'&&this.pageActive&&!this.sessionInterrupted()&&!this.replacement){
        this.rebuildNeeded=false;this.stalled=null;this.nudged=false;this.syncContext();
      }}};
    node.onprocessorerror=()=>{if(this.node===node&&this.ready)this.fallback(new Error('native PCM AudioWorklet processor error'));};
    return node;
  }
  watchContext(context){
    this.contextChanged=()=>{if(this.context===context)this.syncContext(true);};
    context.addEventListener?.('statechange',this.contextChanged);
  }
  fallback(error){
    this.error=String(error?.message??error??'');
    this.settleResume(this.resumeRequest,false);this.startPromise=null;
    this.context?.removeEventListener?.('statechange',this.contextChanged);
    const was=this.ready;this.ready=false;this.backend='sdl';
    this.cancelNudge();this.cancelReplacement();this.health=null;
    try{this.Module?._dune_web_audio_worklet?.(0);}catch{}
    try{this.node?.disconnect();}catch{}
    if(was)try{this.script?.connect(this.context.destination);}catch{}
    if(this.Module?.nativeAudioBridge===this)delete this.Module.nativeAudioBridge;
  }
  pushPCM(pointer,frames){
    if(!this.ready||!this.node||frames<1)return false;
    if(!this.pageActive){
      // A background AudioContext can still report running. Page lifecycle,
      // rather than that state alone, owns whether output may enter its port.
      this.observeSuspended();this.metrics.hiddenDiscardedFrames+=frames;++this.metrics.hiddenPackets;return true;
    }
    const at=this.now();
    this.checkOutput(at);
    if(this.context.state!=='running'||this.audioBlocked()){
      this.observeSuspended();
      // Consume native output but do not enqueue history in a suspended port.
      this.metrics.suspendedDiscardedFrames+=frames;++this.metrics.suspendedPackets;
      return true;
    }
    if(!this.freshOutputEpoch())return false;
    this.suspendedObserved=false;this.publishPlaying(this.playing);
    if(this.lastPush!==null){const gap=at-this.lastPush;this.metrics.maxProducerGapMs=Math.max(this.metrics.maxProducerGapMs,gap);if(gap>80)++this.metrics.producerGapsOver80ms;}
    this.lastPush=at;
    // Own transferable copy: WASM linear memory may grow or be reused next batch.
    const samples=this.Module.HEAPU8.slice(pointer,pointer+frames*4).buffer;
    try{this.node.port.postMessage({type:'pcm',epoch:this.epoch,frames,samples},[samples]);}
    catch(e){this.fallback(e);return false;}
    ++this.metrics.packets;this.metrics.sentFrames+=frames;return true;
  }
  flush(epoch){
    this.epoch=epoch>>>0;this.lastPush=null;this.outputPlaying=null;++this.metrics.flushes;
    this.node?.port.postMessage({type:'flush',epoch:this.epoch});
    if(!this.pageActive||this.context?.state!=='running'||!this.playing||this.audioBlocked())this.publishPlaying(false);
  }
  publishPlaying(playing){
    if(this.outputPlaying===!!playing)return;
    this.outputPlaying=!!playing;
    this.node?.port.postMessage({type:'playing',playing:this.outputPlaying,epoch:this.epoch});
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
  syncContext(fromEvent=false){
    if(!this.ready)return;
    if(this.recoverInterruptions&&fromEvent&&!this.nudge&&this.context.state!=='running')this.noteInterruption();
    if(!this.pageActive||this.context.state!=='running'||this.audioBlocked()){this.observeSuspended();return;}
    if(fromEvent&&this.nudgePending&&!this.resumeRequest){this.resume();return;}
    if(!this.freshOutputEpoch())return;
    this.suspendedObserved=false;this.error=null;this.publishPlaying(this.playing);
    // Safari can emit running without resolving an older resume() promise.
    // Actual context state is sufficient; that promise must not latch unlock.
    this.settleResume(this.resumeRequest,true);
    this.clearSilenceTimer();
  }
  clearSilenceTimer(){
    const audio=this.sdl?.audio;
    if(audio?.silenceTimer!==undefined){clearInterval(audio.silenceTimer);audio.silenceTimer=undefined;audio.silenceBuffer=undefined;}
  }
  setPlaying(playing){
    this.playing=!!playing;
    if(!this.playing){this.health=null;this.publishPlaying(false);}
    else if(this.pageActive&&this.context?.state==='running'&&!this.needsFreshEpoch&&!this.audioBlocked())this.publishPlaying(true);
  }
  /** Shell calls this for visibility/pagehide/pageshow/focus, independently of
   * native hidden/pause. It changes output only and never resumes the world. */
  setPageActive(active){
    this.pageActive=!!active;
    if(!this.pageActive){this.noteInterruption();this.cancelNudge();this.cancelReplacement();this.observeSuspended();this.settleResume(this.resumeRequest,false);return Promise.resolve(false);}
    return this.resume();
  }
  settleResume(request,result){
    if(!request||this.resumeRequest!==request)return;
    clearTimeout(request.timer);this.resumeRequest=null;this.resumePromise=null;request.resolve(!!result);
  }
  /** A real pointer/key gesture passes trusted:true. It must call the browser
   * synchronously, even if an earlier automatic resume() never settled. */
  resume({trusted=false,repair=false}={}){
    if(!this.pageActive)return Promise.resolve(false);
    if(this.replacement)return this.replacement.promise;
    if(this.nudge)return this.nudge.promise;
    if(!this.ready&&!this.startPromise)this.start();
    const context=this.context??this.Module?.SDL2?.audioContext;
    if(!context)return Promise.resolve(false);
    if(this.sessionInterrupted())return Promise.resolve(false);
    if(this.recoverInterruptions&&this.hasRendered&&this.ready){
      if(trusted&&repair&&(this.rebuildNeeded||context.state==='closed'))return this.replaceOutput(context);
      if(this.rebuildNeeded)return Promise.resolve(false);
      if(context.state==='running'&&this.nudgePending&&typeof context.suspend==='function')return this.nudgeOutput(context);
    }
    if(context.state==='running'){this.syncContext();return Promise.resolve(true);}
    if(!['suspended','interrupted'].includes(context.state))return Promise.resolve(false);
    const pending=this.resumeRequest;
    if(pending){
      if(!trusted||pending.trusted&&this.now()-pending.started<this.resumeRetryMs)return pending.promise;
      ++this.metrics.resumeSuperseded;this.settleResume(pending,false);
    }
    this.nudgePending=false;
    if(this.ready){this.observeSuspended();this.freshOutputEpoch();}
    ++this.metrics.resumeCalls;
    const request={trusted:!!trusted,started:this.now()};
    request.promise=new Promise(resolve=>{request.resolve=resolve;});this.resumeRequest=request;this.resumePromise=request.promise;
    request.timer=setTimeout(()=>{
      if(this.resumeRequest!==request)return;
      if(this.pageActive&&context.state==='running'&&!this.audioBlocked()){this.syncContext();this.settleResume(request,true);return;}
      ++this.metrics.resumeTimeouts;this.resumeFailed(request,null,true);
    },this.resumeTimeoutMs);
    try{
      // Do not await setup, another Promise, a timer or an animation frame
      // before this call: iOS requires the original trusted event turn.
      Promise.resolve(context.resume()).then(()=>{
        if(this.resumeRequest!==request)return;
        this.syncContext();
        if(context.state!=='running')this.resumeFailed(request);
        else this.settleResume(request,this.pageActive&&!this.audioBlocked());
      },error=>this.resumeFailed(request,error));
    }catch(error){this.resumeFailed(request,error);}
    return request.promise;
  }
  sessionInterrupted(){return this.recoverInterruptions&&this.audioSession?.state==='interrupted';}
  audioBlocked(){return this.sessionInterrupted()||!!(this.nudge||this.replacement||this.rebuildNeeded);}
  noteInterruption(){
    if(!this.recoverInterruptions||!this.hasRendered)return;
    this.health=null;
    if(!this.nudged&&!this.rebuildNeeded)this.nudgePending=true;
  }
  resumeFailed(request,error,timedOut=false){
    if(this.resumeRequest!==request)return;
    if(error)this.error=String(error?.message??error);
    if((request.trusted||timedOut)&&this.recoverInterruptions&&this.hasRendered&&this.ready)this.requireReplacement();
    this.settleResume(request,false);
  }
  requireReplacement(){
    if(!this.rebuildNeeded)this.stalled={clock:this.context.currentTime,frames:this.processor.outputFrames??0};
    this.rebuildNeeded=true;this.nudgePending=false;this.health=null;this.observeSuspended();
  }
  // An iOS context can say "running" while its clock or processor is frozen.
  // Use native production as the cadence; no idle polling or extra render loop.
  checkOutput(at){
    if(!this.recoverInterruptions||!this.hasRendered||!this.playing||this.audioBlocked()||this.context.state!=='running')return;
    const h=this.health;
    if(h&&at-h.last<=this.healthWindowMs/2){
      h.last=at;
      if(at-h.at<this.healthWindowMs)return;
      const clock=this.context.currentTime,frames=this.processor.outputFrames??0;
      if((Number.isFinite(clock)&&clock<=h.clock)||frames<=h.frames){
        if(this.nudged||typeof this.context.suspend!=='function')this.requireReplacement();
        else this.nudgeOutput(this.context);
        return;
      }
      this.nudged=false;this.nudgePending=false;
    }
    this.health={at,last:at,clock:this.context.currentTime,frames:this.processor.outputFrames??0};
  }
  nudgeOutput(context){
    if(this.nudge)return this.nudge.promise;
    this.nudgePending=false;this.nudged=true;this.health=null;this.observeSuspended();
    const op={context,suspending:true};op.promise=new Promise(resolve=>{op.resolve=resolve;});this.nudge=op;
    const finish=ok=>{
      if(this.nudge!==op)return;
      this.cancelNudge(ok);
      if(ok)this.syncContext();else this.requireReplacement();
    };
    op.timer=setTimeout(()=>finish(false),this.resumeTimeoutMs);
    try{
      Promise.resolve(context.suspend()).then(()=>{
        op.suspending=false;
        if(this.nudge!==op){
          // Visibility can return before a canceled suspend actually finishes.
          if(op.canceled&&this.context===context&&this.pageActive&&!this.audioBlocked()&&!this.resumeRequest&&context.state==='suspended')this.resume();
          return;
        }
        if(!this.pageActive||this.sessionInterrupted())return;
        return Promise.resolve(context.resume()).then(()=>finish(context.state==='running'));
      }).catch(()=>finish(false));
    }catch{finish(false);}
    return op.promise;
  }
  cancelNudge(result=false){
    const op=this.nudge;if(!op)return;
    clearTimeout(op.timer);op.canceled=!result&&op.suspending;this.nudge=null;op.resolve(result);
  }
  closeContext(context){
    try{Promise.resolve(context?.close?.()).catch(()=>{});}catch{}
  }
  cancelReplacement(){
    const op=this.replacement;if(!op)return;
    this.replacement=null;clearTimeout(op.timer);
    op.context?.removeEventListener?.('statechange',op.commit);
    try{op.node?.disconnect();op.node?.port.close?.();}catch{}
    this.closeContext(op.context);op.resolve(false);
  }
  replaceOutput(oldContext){
    if(this.replacement)return this.replacement.promise;
    if(this.now()<this.retryAfter||!this.ready)return Promise.resolve(false);
    this.settleResume(this.resumeRequest,false);this.requireReplacement();
    const op={};op.promise=new Promise(resolve=>{op.resolve=resolve;});this.replacement=op;
    const fail=error=>{
      if(this.replacement!==op)return;
      this.error=String(error?.message??error);this.retryAfter=this.now()+this.resumeRetryMs;this.cancelReplacement();
    };
    try{
      const sdl=this.sdl,oldScript=this.script,oldNode=this.node,oldListener=this.contextChanged;
      const context=op.context=this.createContext(oldContext.sampleRate);
      if(context.sampleRate!==oldContext.sampleRate||!context.audioWorklet||!oldScript.bufferSize||typeof oldScript.onaudioprocess!=='function')
        throw Error('Cannot recreate the original SDL output format');
      // Both creation and unlock must happen before the trusted input returns.
      const wake=context.resume();
      Promise.resolve(wake).then(()=>op.commit?.(),error=>{if(context.state!=='running')fail(error);});
      const script=context.createScriptProcessor(oldScript.bufferSize,0,2);script.onaudioprocess=oldScript.onaudioprocess;
      op.commit=()=>{
        if(this.replacement!==op||!op.node||context.state!=='running')return;
        if(!this.pageActive||this.sessionInterrupted()||this.context!==oldContext||sdl.audioContext!==oldContext||sdl.audio.scriptProcessorNode!==oldScript){
          fail(Error('Audio output changed during recovery'));return;
        }
        try{
          op.node.connect(context.destination);
          this.context=context;this.node=op.node;this.script=script;
          if(!this.Module._dune_web_audio_worklet(1))throw Error('Native audio output rejected replacement');
        }catch(error){
          this.context=oldContext;this.node=oldNode;this.script=oldScript;this.outputPlaying=null;fail(error);return;
        }
        clearTimeout(op.timer);context.removeEventListener?.('statechange',op.commit);this.replacement=null;
        oldContext.removeEventListener?.('statechange',oldListener);
        try{oldNode.disconnect();oldNode.port.close?.();}catch{}
        this.clearSilenceTimer();sdl.audioContext=context;sdl.audio.scriptProcessorNode=script;sdl.audio.currentOutputBuffer=undefined;
        this.processor={};this.health=null;this.nudgePending=false;this.rebuildNeeded=false;this.stalled=null;this.nudged=false;this.needsFreshEpoch=false;this.outputPlaying=null;
        this.watchContext(context);this.syncContext();this.closeContext(oldContext);op.resolve(true);
      };
      context.addEventListener?.('statechange',op.commit);
      op.timer=setTimeout(()=>fail(Error('Audio output recovery timed out')),this.resumeTimeoutMs+this.healthWindowMs);
      Promise.resolve(context.audioWorklet.addModule(this.url)).then(()=>{
        if(this.replacement!==op)return;
        op.node=this.makeNode(context);op.commit();
      }).catch(fail);
    }catch(error){fail(error);}
    return op.promise;
  }
  snapshot(){
    const c=this.context??this.Module?.SDL2?.audioContext;
    return {backend:this.backend,ready:this.ready,contextState:c?.state??'unavailable',outputSampleRate:c?.sampleRate??0,baseLatencyMs:c?.baseLatency?c.baseLatency*1000:0,outputLatencyMs:c?.outputLatency?c.outputLatency*1000:0,epoch:this.epoch,playing:this.playing,pageActive:this.pageActive,needsFreshEpoch:this.needsFreshEpoch,resumePending:!!this.resumeRequest,recovery:this.replacement?'rebuilding':this.nudge?'restarting':this.rebuildNeeded?'awaiting-input':'idle',...this.metrics,processor:{...this.processor},error:this.error};
  }
}
