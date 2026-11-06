// Standalone recovery host. It deliberately imports no cached game modules,
// starts no native engine, and never reads, clears or migrates player saves.
export class OfflineUpdater {
 constructor({nav=globalThis.navigator,win=globalThis.window,onState=()=>{}}={}){Object.assign(this,{nav,win,onState});}
 state(status,extra={}){this.onState({status,...extra});}
 // Three bounded large-asset attempts may take 120s each on a slow connection.
 async waitForWorker(worker,timeoutMs=450000){
  if(['installed','activating','activated'].includes(worker.state))return;
  return new Promise((resolve,reject)=>{
   const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve();};
   const check=()=>{if(worker.state==='redundant')finish(Error('download-failed'));else if(['installed','activating','activated'].includes(worker.state))finish();};
   const timer=setTimeout(()=>finish(Error('download-timeout')),timeoutMs);worker.addEventListener('statechange',check);check();
  });
 }
 request(worker,type,extra={}){
  const Channel=this.win?.MessageChannel;if(!Channel)return Promise.reject(Error('unsupported'));
  return new Promise((resolve,reject)=>{
   const channel=new Channel();let done=false;
   const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close?.();channel.port2.close?.();error?reject(error):resolve(value);};
   const timer=setTimeout(()=>finish(Error('response-timeout')),12000);
   channel.port1.onmessage=({data})=>finish(null,data);
   try{worker.postMessage({type,...extra},[channel.port2]);}catch(error){finish(error);}
  });
 }
 async prepare(){
  if(!this.nav?.serviceWorker)throw Error('unsupported');
  this.state('checking');
  const listener=({data,source})=>{
   if(data?.type!=='DUNE_OFFLINE_PROGRESS'||this.worker&&source&&source!==this.worker)return;
   if(data.status==='downloading')this.state('downloading',data);
  };
  this.nav.serviceWorker.addEventListener('message',listener);
  try{
   this.registration=await this.nav.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
   // Failing to reach the server must not report an old active cache as latest.
   await this.registration.update();
   this.worker=this.registration.installing||this.registration.waiting||this.registration.active;
   if(!this.worker)throw Error('unavailable');
   await this.waitForWorker(this.worker);
   const ready=await this.request(this.worker,'DUNE_OFFLINE_STATUS');
   if(ready?.type!=='DUNE_OFFLINE_PROGRESS'||ready.status!=='ready'||!Number.isSafeInteger(ready.total)||ready.total<1||ready.loaded!==ready.total||typeof ready.version!=='string'||!ready.version)throw Error('incomplete');
   this.version=ready.version;this.state('ready',{version:this.version});return this.version;
  }finally{this.nav.serviceWorker.removeEventListener('message',listener);}
 }
 async apply({restart=false}={}){
  if(!this.worker||!this.version)throw Error('incomplete');
  this.state('applying');
  // Another window may already have activated this verified package. Reload
  // only this recovery document, without rewriting that worker's client pins.
  if(this.registration?.active===this.worker&&this.worker.state==='activated'){
   this.state('done',{version:this.version});return true;
  }
  const options={};
  if(restart)options.restart=true;
  const active=this.registration?.active;
  if(active){
    // Existing game windows keep the exact package they were opened with.
    // The worker pins only their assets; neither this page nor the updater
    // reads their game state, closes their tabs, or reloads their missions.
    const previous=await this.request(active,'DUNE_OFFLINE_STATUS');
    if(previous?.type!=='DUNE_OFFLINE_PROGRESS'||previous.status!=='ready'||typeof previous.version!=='string'||!previous.version)throw Error('incomplete');
    options.previousVersion=previous.version;
    options.clientVersions=previous.clientVersions||{};
  }
  const reply=await this.request(this.worker,'DUNE_APPLY_UPDATE',options);
  if(reply?.type!=='DUNE_UPDATE_RESULT'||reply.version!==this.version)throw Error('invalid-response');
  if(reply.status==='blocked'){this.state('blocked',{count:reply.count});return false;}
  if(reply.status!=='applying')throw Error(reply.status||'denied');
  if(this.worker.state!=='activated')await new Promise((resolve,reject)=>{
   const finish=error=>{clearTimeout(timer);this.worker.removeEventListener('statechange',check);error?reject(error):resolve();};
   const check=()=>{if(this.worker.state==='activated')finish();else if(this.worker.state==='redundant')finish(Error('activation-failed'));};
   const timer=setTimeout(()=>finish(Error('activation-timeout')),20000);this.worker.addEventListener('statechange',check);check();
  });
  this.state('done',{version:this.version});return true;
 }
 async start({automatic=false}={}){
  await this.prepare();
  // Automatic entry is requested only by settled Home, after the mission has
  // been left. The same pinned-package path keeps other live windows intact.
  return automatic?this.apply({restart:true}):false;
 }
}
