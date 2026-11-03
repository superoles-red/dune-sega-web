// Browser capabilities only. No native game memory or simulation is accessed.
export const SOURCE_URL='https://github.com/superoles-red/dune-sega-web';
export function isAppleMobile(nav=globalThis.navigator){return /iPhone|iPad|iPod/.test(nav?.userAgent||'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1);}
export class BrowserFeatures {
 constructor({win=globalThis.window,doc=globalThis.document,nav=globalThis.navigator}={}){
  Object.assign(this,{win,doc,nav});this.listeners=new Set();this.state={status:'idle',loaded:0,total:0,installed:!!nav?.standalone,preparing:false,persistent:false};
  this.installPrompt=null;
  win?.addEventListener('beforeinstallprompt',e=>{e.preventDefault();this.installPrompt=e;this.emit();});
  win?.addEventListener('appinstalled',()=>{this.installPrompt=null;this.state.installed=true;this.emit();});
  doc?.addEventListener('fullscreenchange',()=>this.emit());doc?.addEventListener('webkitfullscreenchange',()=>this.emit());
  nav?.serviceWorker?.addEventListener('message',e=>{
   if(e.data?.type==='DUNE_OFFLINE_PROGRESS'&&e.data.status==='error'){this.lastWorkerError=e.data.message;console.warn('Dune offline worker:',e.data.message);}
   if(e.data?.type!=='DUNE_OFFLINE_PROGRESS'||this.pending&&this.targetWorker&&e.source&&e.source!==this.targetWorker)return;
   let {status,loaded,total,bytes,totalBytes,version}=e.data;
   if(this.state.preparing&&status==='ready'&&this.targetWorker?.state==='installing')status='downloading';
   Object.assign(this.state,{status,loaded,total,bytes,totalBytes,version,preparing:status==='downloading'});this.emit();
  });
  this.state.installed ||= !!win?.matchMedia?.('(display-mode: standalone)').matches||!!win?.matchMedia?.('(display-mode: fullscreen)').matches;
  // Inspect an existing registration without starting downloads on every visit.
  nav?.serviceWorker?.getRegistration?.('./').then(r=>{this.registration=r;r?.active?.postMessage({type:'DUNE_OFFLINE_STATUS'});}).catch(()=>{});
 }
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn(this.snapshot());}
 snapshot(){return {...this.state,fullscreen:!!(this.doc?.fullscreenElement||this.doc?.webkitFullscreenElement),canFullscreen:!!(this.doc?.documentElement?.requestFullscreen||this.doc?.documentElement?.webkitRequestFullscreen),canInstall:!!this.installPrompt,appleMobile:isAppleMobile(this.nav)};}
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
  const r=await this.nav.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});this.registration=r;
  const worker=r.installing||r.waiting||r.active;if(!worker)throw Error('offline-unavailable');this.targetWorker=worker;
  if(worker.state==='installing')await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(Error('offline-timeout'));},180000);
   const check=()=>{if(worker.state==='redundant'){clearTimeout(timeout);worker.removeEventListener('statechange',check);reject(Error('offline-download-failed'));}else if(['installed','activating','activated'].includes(worker.state)){clearTimeout(timeout);worker.removeEventListener('statechange',check);resolve();}};
   worker.addEventListener('statechange',check);check();
  });
  this.state.status='ready';this.state.preparing=false;this.state.loaded=this.state.total;this.emit();
  (r.waiting||r.active||worker).postMessage({type:'DUNE_OFFLINE_STATUS'});return this.snapshot();
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
