// Browser capabilities only. No native game memory or simulation is accessed.
export const SOURCE_URL='https://github.com/superoles-red/dune-sega-web';
export function isAppleMobile(nav=globalThis.navigator){return /iPhone|iPad|iPod/.test(nav?.userAgent||'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1);}
export function installationKind(nav=globalThis.navigator){
 if(isAppleMobile(nav))return 'apple';
 const ua=nav?.userAgent||'';
 if(/SamsungBrowser\//i.test(ua))return 'samsung';
 if(/Android/i.test(ua))return /(?:Chrome|Chromium)\//i.test(ua)?'android-chrome':'android';
 if(/Macintosh/i.test(ua)&&/Safari\//i.test(ua)&&!/(?:Chrome|Chromium|Edg)\//i.test(ua))return 'mac-safari';
 return 'desktop';
}
export class BrowserFeatures {
 constructor({win=globalThis.window,doc=globalThis.document,nav=globalThis.navigator}={}){
  Object.assign(this,{win,doc,nav});this.listeners=new Set();this.state={status:'idle',loaded:0,total:0,installed:!!nav?.standalone,preparing:false,persistent:false};
  this.installPrompt=null;this.observedRegistrations=new WeakSet();this.observedWorkers=new WeakSet();
  win?.addEventListener('beforeinstallprompt',e=>{e.preventDefault();this.installPrompt=e;this.emit();});
  win?.addEventListener('appinstalled',()=>{this.installPrompt=null;this.state.installed=true;this.emit();});
  doc?.addEventListener('fullscreenchange',()=>this.emit());doc?.addEventListener('webkitfullscreenchange',()=>this.emit());
  nav?.serviceWorker?.addEventListener('message',e=>{
   if(e.data?.type==='DUNE_OFFLINE_PROGRESS'&&e.data.status==='error'){this.lastWorkerError=e.data.message;console.warn('Dune offline worker:',e.data.message);}
   if(e.data?.type!=='DUNE_OFFLINE_PROGRESS'||this.pending&&this.targetWorker&&e.source&&e.source!==this.targetWorker)return;
   // A background candidate is separate from the complete copy still running.
   // In particular, a failed update must not mark that older copy unusable.
   if(!this.pending&&e.source&&this.registration?.active&&e.source!==this.registration.active){this.emit();return;}
   let {status,loaded,total,bytes,totalBytes,version}=e.data;
   if(this.state.preparing&&status==='ready'&&this.targetWorker?.state==='installing')status='downloading';
   Object.assign(this.state,{status,loaded,total,bytes,totalBytes,version,preparing:status==='downloading'});
   if(typeof e.data.clientVersion==='string'&&e.data.clientVersion)this.state.clientVersion=e.data.clientVersion;
   this.emit();
  });
  this.state.installed ||= !!win?.matchMedia?.('(display-mode: standalone)').matches||!!win?.matchMedia?.('(display-mode: fullscreen)').matches;
  // Only players who already opted into offline use receive update checks.
  // An unchanged worker does not redownload the package; a changed package
  // waits safely until the player chooses to update outside the game.
  this.inspection=nav?.serviceWorker?.getRegistration?.('./').then(async r=>{if(!r)return;this.observeRegistration(r);(r.active||r.waiting)?.postMessage({type:'DUNE_OFFLINE_STATUS'});if(!this.pending)await this.checkForUpdates();}).catch(()=>{});
  nav?.serviceWorker?.addEventListener('controllerchange',()=>this.readActivePackage());
  win?.addEventListener('online',()=>{this.readActivePackage();this.checkForUpdates();});
  const checkOnResume=()=>{if(doc?.hidden||doc?.visibilityState&&doc.visibilityState!=='visible')return;this.readActivePackage();this.checkForUpdates();};
  win?.addEventListener('focus',checkOnResume);win?.addEventListener('pageshow',checkOnResume);doc?.addEventListener('visibilitychange',checkOnResume);
 }
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn(this.snapshot());}
 snapshot(){const r=this.registration,olderClient=this.state.status==='ready'&&!!this.state.clientVersion&&!!this.state.version&&this.state.clientVersion!==this.state.version;return {...this.state,online:this.nav?.onLine!==false,fullscreen:!!(this.doc?.fullscreenElement||this.doc?.webkitFullscreenElement),canFullscreen:!!(this.doc?.documentElement?.requestFullscreen||this.doc?.documentElement?.webkitRequestFullscreen),canInstall:!!this.installPrompt,appleMobile:isAppleMobile(this.nav),installationKind:installationKind(this.nav),updateAvailable:!!r?.waiting&&r.waiting.state==='installed'||olderClient,restartRequired:this.state.status==='ready'&&!!r&&!!(r.waiting||r.installing||r.active!==this.nav?.serviceWorker?.controller||olderClient)};}
 readActivePackage(){try{(this.registration?.active||this.nav?.serviceWorker?.controller)?.postMessage({type:'DUNE_OFFLINE_STATUS'});}catch{}}
 observeRegistration(registration){
  this.registration=registration;
  const watch=()=>{
   const worker=registration.installing;if(!worker||this.observedWorkers.has(worker))return;
   this.observedWorkers.add(worker);
   const changed=()=>{this.emit();if(['installed','redundant'].includes(worker.state))worker.removeEventListener('statechange',changed);};
   worker.addEventListener('statechange',changed);
  };
  if(!this.observedRegistrations.has(registration)){this.observedRegistrations.add(registration);registration.addEventListener?.('updatefound',watch);}
  watch();this.emit();
 }
 async checkForUpdates(){
  const r=this.registration;if(!r||this.nav?.onLine===false||typeof r.update!=='function')return;
  if(this.updateCheck)return this.updateCheck;
  this.updateCheck=Promise.resolve().then(()=>r.update()).catch(()=>{/* Keep the verified offline copy when the network fails. */}).finally(()=>{this.updateCheck=null;this.emit();});
  return this.updateCheck;
 }
 updateGame({automatic=false}={}){this.win.location.assign(automatic?'./update.html?auto=1&v=20261106-mobile7':'./update.html');}
 async fullscreen(){
  // Invoke the actual API synchronously in the click's user activation.
  if(this.doc.fullscreenElement||this.doc.webkitFullscreenElement){const exit=this.doc.exitFullscreen||this.doc.webkitExitFullscreen;await exit?.call(this.doc);return 'exited';}
  const target=this.doc.documentElement,request=target.requestFullscreen||target.webkitRequestFullscreen;
  if(!request)return isAppleMobile(this.nav)?'apple-help':'unsupported';
  await request.call(target);return 'entered';
 }
 async persist(){try{this.state.persistent=!!(await this.nav.storage?.persist?.());}catch{}this.emit();return this.state.persistent;}
 async install(){
  if(this.state.installed)return 'installed';
  const prompt=this.installPrompt;if(!prompt)return isAppleMobile(this.nav)?'apple-help':'install-help';
  this.installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;this.emit();return choice?.outcome==='accepted'?'accepted':'cancelled';
 }
 async prepareOffline(){
  if(this.pending)return this.pending;
  this.state.status='downloading';this.state.preparing=true;this.lastWorkerError=null;this.emit();
  this.pending=this.prepare().catch(error=>{this.state.status='error';this.state.preparing=false;this.state.error=this.lastWorkerError||error.message;console.warn('Dune offline preparation:',this.state.error,error.name);this.emit();throw error;}).finally(()=>{this.pending=null;});
  return this.pending;
 }
 async prepare(){
  if(!this.nav.serviceWorker)throw Error('offline-unsupported');
  await this.persist();
  const r=await this.nav.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});this.observeRegistration(r);
  // An explicit offline/install action also checks for an updated package.
  // No update is activated over a running game.
  if(r.update)try{await r.update();}catch(error){if(!r.active)throw error;}
  const worker=r.installing||r.waiting||r.active;if(!worker)throw Error('offline-unavailable');this.targetWorker=worker;
  if(worker.state==='installing')await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(Error('offline-timeout'));},180000);
   const check=()=>{if(worker.state==='redundant'){clearTimeout(timeout);worker.removeEventListener('statechange',check);reject(Error('offline-download-failed'));}else if(['installed','activating','activated'].includes(worker.state)){clearTimeout(timeout);worker.removeEventListener('statechange',check);resolve();}};
   worker.addEventListener('statechange',check);check();
  });
  // An activated registration alone does not prove all assets are present.
  // Ask the exact worker for the ready marker written after its verified cache.
  const confirmed=await this.confirmOffline(worker);
  Object.assign(this.state,confirmed,{status:'ready',preparing:false});this.emit();return this.snapshot();
 }
 confirmOffline(worker){
  const Channel=this.win?.MessageChannel;if(!Channel)return Promise.reject(Error('offline-status-unavailable'));
  return new Promise((resolve,reject)=>{
   const channel=new Channel();let done=false;
   const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timeout);channel.port1.close?.();channel.port2.close?.();if(error)reject(error);else resolve(value);};
   const timeout=setTimeout(()=>finish(Error('offline-status-timeout')),10000);
   channel.port1.onmessage=({data})=>{
    if(data?.type!=='DUNE_OFFLINE_PROGRESS'||data.status!=='ready'||!Number.isSafeInteger(data.total)||data.total<1||data.loaded!==data.total||typeof data.version!=='string'||!data.version.length)return finish(Error('offline-package-incomplete'));
    const {loaded,total,bytes,totalBytes,version}=data;finish(null,{loaded,total,bytes,totalBytes,version});
   };
   try{worker.postMessage({type:'DUNE_OFFLINE_STATUS'},[channel.port2]);}catch(error){finish(error);}
  });
 }
 openSource(){this.win.open(SOURCE_URL,'_blank','noopener,noreferrer');}
}

export async function downloadSave({text,filename},{nav=globalThis.navigator,doc=globalThis.document,url=globalThis.URL}={}){
 const blob=new Blob([text],{type:'application/json'});
 if(isAppleMobile(nav)&&typeof File!=='undefined'){
  const file=new File([blob],filename,{type:'application/json'});
  if(nav?.canShare?.({files:[file]})){
   try{await nav.share({files:[file],title:'Dune save'});return true;}catch(e){if(e.name==='AbortError')return false;/* regular download is the fallback */}
  }
 }
 const href=url.createObjectURL(blob),a=doc.createElement('a');a.href=href;a.download=filename;a.style.display='none';doc.body.append(a);a.click();a.remove();setTimeout(()=>url.revokeObjectURL(href),60000);return true;
}

// Open immediately from a user click, before any await or screen transition.
export function pickSaveFile(onFile,{doc=globalThis.document}={}){
 const input=doc.createElement('input');input.type='file';input.accept='.json,.dune-save,application/json';input.style.display='none';
 input.addEventListener('change',()=>{const file=input.files?.[0];input.remove();if(file)onFile(file);},{once:true});
 input.addEventListener('cancel',()=>input.remove(),{once:true});doc.body.append(input);input.click();return input;
}
