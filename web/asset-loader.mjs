// Resource scheduling only. Pixel bytes and game behavior are never changed.
export const ASSET_CONCURRENCY=12;
export class AssetLoadError extends Error {
 constructor(url,attempts,cause){super('Cannot load asset '+String(url)+' after '+attempts+' attempts: '+(cause?.message||cause||'unknown error'),{cause});this.name='AssetLoadError';this.url=String(url);this.attempts=attempts;}
}
const bounded=(value,fallback,max)=>Number.isInteger(value)&&value>0?Math.min(value,max):fallback;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function retryURL(url,attempt){
 const source=String(url);if(!attempt)return source;
 const hash=source.indexOf('#'),head=hash<0?source:source.slice(0,hash),fragment=hash<0?'':source.slice(hash),query=head.indexOf('?'),path=query<0?head:head.slice(0,query),params=new URLSearchParams(query<0?'':head.slice(query+1));
 params.set('dune-image-retry',String(attempt));return path+'?'+params+fragment;
}
async function retryAsset(url,run,{attempts=3,retryDelayMs=120,sleep=pause}={}){
 attempts=bounded(attempts,3,3);let error;
 for(let attempt=0;attempt<attempts;attempt++){
  try{return await run(retryURL(url,attempt));}catch(cause){error=cause;if(attempt+1<attempts)await sleep(Math.max(0,retryDelayMs)*(attempt+1));}
 }
 throw new AssetLoadError(url,attempts,error);
}
export async function runAssetPool(jobs,{concurrency=ASSET_CONCURRENCY}={}){
 concurrency=bounded(concurrency,ASSET_CONCURRENCY,16);const results=new Array(jobs.length);let next=0,failure;
 async function worker(){
  while(!failure){const index=next++;if(index>=jobs.length)return;
   try{results[index]=await jobs[index]();}catch(error){failure=error;throw error;}
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},worker));return results;
}
function imageAttempt(url,{ImageCtor=globalThis.Image,timeoutMs=15000}={}){
 return new Promise((resolve,reject)=>{
  let image,finished=false,timer;
  const usable=()=>image?.complete&&image.naturalWidth>0&&image.naturalHeight>0;
  const finish=(error)=>{
   if(finished)return;finished=true;clearTimeout(timer);if(image){image.onload=null;image.onerror=null;if(error)image.removeAttribute?.('src');}
   if(error)reject(error);else resolve(image);
  };
  try{
   image=new ImageCtor();image.onload=()=>finish(usable()?null:Error('Image has no pixels'));image.onerror=()=>finish(Error('Image network or format error'));
   timer=setTimeout(()=>finish(Error('Image load timed out')),bounded(timeoutMs,15000,60000));
   image.src=url;
   if(usable()){finish();return;}
   if(typeof image.decode==='function')Promise.resolve(image.decode()).then(()=>finish(usable()?null:Error('Decoded image has no pixels')),error=>{
    // Safari can reject decode() for an already loaded, valid tiny native PNG.
    // complete + positive intrinsic size is the browser's independent load proof.
    finish(usable()?null:error||Error('Image decode failed'));
   });
  }catch(error){finish(error);}
 });
}
export function loadAssetImage(url,options={}){return retryAsset(url,attempt=>imageAttempt(attempt,options),options);}
export function loadAssetJSON(url,options={}){
 const {fetcher=globalThis.fetch,timeoutMs=15000}=options;
 return retryAsset(url,attempt=>new Promise((resolve,reject)=>{
  const controller=new AbortController();let finished=false;
  const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);if(error){controller.abort();reject(error);}else resolve(value);};
  const timer=setTimeout(()=>finish(Error('JSON load timed out')),bounded(timeoutMs,15000,60000));
  Promise.resolve().then(()=>fetcher(attempt,{signal:controller.signal})).then(response=>{
   if(!response.ok)throw Error('HTTP '+response.status);return response.json();
  }).then(value=>finish(null,value),error=>finish(error));
 }),options);
}
