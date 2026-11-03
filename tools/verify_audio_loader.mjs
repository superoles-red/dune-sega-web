#!/usr/bin/env node
/* Execute the real generated EM_JS functions: valid C syntax alone does not
 * prove Emscripten parsed pointer argument names into the intended JS ABI. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
function functionSource(source,name){
  const at=source.indexOf(`function ${name}(`);assert.ok(at>=0,`generated loader missing ${name}`);
  const open=source.indexOf('{',at);let quote=null,escaped=false,depth=1,end=open+1;
  for(;end<source.length&&depth;end++){
    const c=source[end];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=null;}
    else if(c==='"'||c==="'"||c==='`')quote=c;
    else if(c==='{')++depth;else if(c==='}')--depth;
  }
  assert.equal(depth,0,`generated function ${name} has no complete body`);return source.slice(at,end);
}
export function verifyAudioLoader(source){
  const heap=new Uint8Array(256),pointer=32,frames=32,bytes=frames*4;
  for(let i=0;i<heap.length;i++)heap[i]=(i*17+3)&255;
  const wanted=[...heap.slice(pointer,pointer+bytes)],calls=[];
  const Module={HEAPU8:heap,nativeAudioBridge:{
    pushPCM:(p,n)=>{assert.equal(p,pointer);assert.equal(n,frames);assert.deepEqual([...Module.HEAPU8.slice(p,p+n*4)],wanted);calls.push('pcm32');return true;},
    flush:epoch=>{assert.equal(epoch,41);calls.push('flush41');},
    setPlaying:playing=>{assert.equal(typeof playing,'boolean');calls.push(`playing${+playing}`);}
  }};
  const bind=name=>new Function('Module',`return (${functionSource(source,name)});`)(Module);
  const push=bind('em_web_audio_push'),flush=bind('em_web_audio_flush_js'),playing=bind('em_web_audio_playing_js');
  assert.equal(push(pointer,frames),1);flush(41);playing(1);playing(0);
  delete Module.nativeAudioBridge;assert.equal(push(pointer,frames),0);flush(41);playing(1);
  assert.deepEqual(calls,['pcm32','flush41','playing1','playing0']);
  return {passed:true,pcmFrames:frames,pcmBytes:bytes,epochAndPlayingABI:true,missingBridgeFallback:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const target=process.argv[2]??new URL('../web/engine/dune_web.js',import.meta.url);
  try{console.log(JSON.stringify(verifyAudioLoader(fs.readFileSync(target,'utf8'))));}
  catch(e){console.error(`Generated native audio bridge failed: ${e.stack??e}`);process.exitCode=1;}
}
