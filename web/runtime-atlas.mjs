// Lossless transport only: each canvas contains the unchanged original PNG crop.
import {loadAssetImage,loadAssetJSON} from './asset-loader.mjs?v=20261105-webapp5';

export function atlasEntries(manifest,expected,width,height){
 if(manifest?.version!==1||manifest.path!=='runtime-atlas.png'||manifest.width!==width||manifest.height!==height||width<1||height<1||width>2048||height>2048)throw Error('Native graphics atlas dimensions differ');
 const entries=[];
 for(const [key,path]of expected){
  const entry=manifest.assets?.[key],r=entry?.rect;
  if(entry?.source!==path||!Array.isArray(r)||r.length!==4||!r.every(Number.isSafeInteger)||r[0]<0||r[1]<0||r[2]<1||r[3]<1||r[0]+r[2]>width||r[1]+r[3]>height)throw Error('Missing native graphics crop: '+key);
  entries.push([key,path,r]);
 }
 if(entries.length!==Object.keys(manifest.assets||{}).length)throw Error('Native graphics atlas catalogue differs');
 return entries;
}

export async function loadRuntimeAtlas(expected,{onProgress=()=>{},doc=globalThis.document,bitmapFactory=globalThis.createImageBitmap}={}){
 const base=new URL('./ui-assets/',import.meta.url),[manifest,image]=await Promise.all([
  loadAssetJSON(new URL('runtime-atlas.json?v=20261105-webapp5',base)),
  loadAssetImage(new URL('runtime-atlas.png?v=20261105-webapp5',base)),
 ]);
 const entries=atlasEntries(manifest,expected,image.naturalWidth,image.naturalHeight),images=new Map();
 try{for(const [key,path,[x,y,w,h]]of entries){
  let crop;
  if(typeof bitmapFactory==='function')crop=await bitmapFactory.call(globalThis,image,x,y,w,h);
  else{
   crop=doc.createElement('canvas');crop.width=w;crop.height=h;
   // Static source images need no independent GPU render targets. This fallback
   // requests CPU backing on browsers without the immutable ImageBitmap API.
   const context=crop.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Native graphics canvas is unavailable');
   context.imageSmoothingEnabled=false;context.drawImage(image,x,y,w,h,0,0,w,h);
  }
  // Original identity is retained for the existing tinted-glyph cache.
  images.set(key,crop);crop.src=new URL('./'+path,import.meta.url).href;
  onProgress({stage:'graphics',loaded:images.size,total:entries.length});
 }}catch(error){for(const crop of images.values())crop.close?.();throw error;}
 return images;
}
