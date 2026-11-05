import test from 'node:test';
import assert from 'node:assert/strict';
import {PanInertia} from '../web/pan-inertia.mjs';

function flick({kind='touch',dx=12,dy=0,options}={}){
 const motion=new PanInertia(options);motion.begin(kind,0);
 motion.sample(dx,dy,20);motion.sample(dx,dy,40);motion.sample(dx,dy,60);
 return motion;
}
function integrate(motion,hz=60){
 let dx=0,dy=0,steps=0,now=motion.lastStep;
 while(motion.active&&steps++<200){now+=1000/hz;const delta=motion.step(now);if(delta){dx+=delta.dx;dy+=delta.dy;}}
 assert.ok(!motion.active,'coast always reaches a finite stop');return {dx,dy,steps};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} equals ${b}`);

test('fresh phone flick adds only a gentle finite CSS-space camera tail',()=>{
 const motion=flick();assert.ok(motion.release(60));assert.ok(motion.active);
 const result=integrate(motion);assert.ok(result.dx>40&&result.dx<110);assert.equal(result.dy,0);
 assert.ok(motion.ends-motion.started<=650);assert.equal(motion.step(800),null);
});

test('pen coasts in the original drag direction while mouse never does',()=>{
 const pen=flick({kind:'pen',dx:-10,dy:6});assert.ok(pen.release(60));const delta=integrate(pen);assert.ok(delta.dx<0&&delta.dy>0);close(delta.dy/delta.dx,-.6);
 const mouse=flick({kind:'mouse'});assert.equal(mouse.release(60),false);assert.equal(mouse.active,false);assert.equal(mouse.step(80),null);
});

test('integrated exponential distance is identical at30/60/120Hz and irregular RAF intervals',()=>{
 const results=[30,60,120].map(hz=>{const motion=flick({dx:13,dy:5});motion.release(60);return integrate(motion,hz);});
 for(const result of results.slice(1)){close(result.dx,results[0].dx);close(result.dy,results[0].dy);}
 const irregular=flick({dx:13,dy:5});irregular.release(60);let now=60,dx=0,dy=0,index=0;
 while(irregular.active){now+=[7,40,13,24,80][index++%5];const delta=irregular.step(now);if(delta){dx+=delta.dx;dy+=delta.dy;}}
 close(dx,results[0].dx);close(dy,results[0].dy);
});

test('same CSS deltas produce the same tail across viewport sizes, DPR and zoom',()=>{
 const tails=[],keys=['devicePixelRatio','innerWidth','innerHeight','visualViewport','window'],previous=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
 try{
  for(const [width,height,dpr,zoom] of [[360,800,1,.5],[412,915,3,1],[915,412,2,.75],[1920,1080,2,1]]){
   for(const [key,value] of Object.entries({devicePixelRatio:dpr,innerWidth:width,innerHeight:height,visualViewport:{width,height,scale:zoom},window:globalThis}))Object.defineProperty(globalThis,key,{value,configurable:true});
   const motion=flick();assert.ok(motion.release(60));tails.push(integrate(motion));
  }
 }finally{for(let i=0;i<keys.length;i++){if(previous[i])Object.defineProperty(globalThis,keys[i],previous[i]);else delete globalThis[keys[i]];}}
 for(const tail of tails)close(tail.dx,tails[0].dx);
});

test('extreme flick speed and diagonal distance stay bounded without changing direction',()=>{
 const motion=flick({dx:1e9,dy:1e9});assert.ok(motion.release(60));
 const result=integrate(motion,120);assert.ok(Math.hypot(result.dx,result.dy)<=160+1e-8);close(result.dx,result.dy);
 const capped=flick({options:{tauMs:220,maxSpeed:1000,maxDistance:40},dx:50});assert.ok(capped.release(60));close(integrate(capped).dx,40);
});

test('taps, a single displacement, slow drags and short jitter have no inertia',()=>{
 const tap=new PanInertia();tap.begin('touch',0);assert.equal(tap.release(50),false);
 const single=new PanInertia();single.begin('touch',0);single.sample(100,0,30);assert.equal(single.release(30),false);
 const slow=flick({dx:1});assert.equal(slow.release(60),false);
 const jitter=flick({dx:2,dy:1});assert.equal(jitter.release(60),false);
 const brief=new PanInertia();brief.begin('touch',0);brief.sample(15,0,4);brief.sample(15,0,8);assert.equal(brief.release(8),false);
});

test('stale release and stopping the finger cannot reuse old swipe velocity',()=>{
 const stale=flick();assert.equal(stale.release(140),false);assert.equal(stale.active,false);
 const held=flick();held.sample(0,0,100);held.sample(0,0,130);assert.equal(held.release(140),false);
 const fresh=flick();fresh.release(60);const delayed=flick();delayed.release(85);assert.ok(integrate(delayed).dx<integrate(fresh).dx);
});

test('reversal discards the previous direction instead of coasting against the finger',()=>{
 const motion=flick();motion.sample(-15,0,80);assert.equal(motion.release(80),false);
 const reversed=flick();reversed.sample(-15,0,80);reversed.sample(-15,0,100);assert.ok(reversed.release(100));assert.ok(integrate(reversed).dx<0);
});

test('new touch and explicit cancellation stop immediately with no delayed work',()=>{
 const motion=flick();motion.release(60);assert.ok(motion.step(80));motion.begin('touch',85);assert.equal(motion.active,false);assert.equal(motion.step(90),null);assert.equal(motion.release(100),false);
 const canceled=flick();canceled.release(60);canceled.cancel();assert.equal(canceled.active,false);assert.equal(canceled.step(80),null);assert.equal(canceled.sample(20,0,100),false);assert.equal(canceled.release(100),false);
});

test('invalid/repeated/backward stamps or deltas cannot start or poison momentum',()=>{
 for(const stamp of [NaN,Infinity,-1,Number.MAX_VALUE]){const motion=flick();assert.equal(motion.release(stamp),false);assert.equal(motion.active,false);}
 for(const [dx,dy,stamp] of [[NaN,0,80],[0,Infinity,80],[5,0,60],[5,0,20]]){const motion=flick();assert.equal(motion.sample(dx,dy,stamp),false);assert.equal(motion.release(100),false);}
 const gap=flick();assert.equal(gap.sample(100,0,250),false);assert.equal(gap.release(250),false);
 for(const stamp of [NaN,Infinity,40,250]){const motion=flick();motion.release(60);assert.equal(motion.step(stamp),null);assert.equal(motion.active,false);}
});

test('duplicate release/RAF cannot extend coast and malformed options stay finite/gentle',()=>{
 const motion=flick();motion.release(60);const end=motion.ends;assert.equal(motion.release(70),false);assert.equal(motion.ends,end);assert.equal(motion.step(60),null);assert.ok(motion.active);assert.ok(motion.step(80));assert.equal(motion.step(80),null);assert.equal(motion.ends,end);
 const extreme=flick({options:{tauMs:Infinity,maxSpeed:Infinity,maxDistance:Infinity,maxDurationMs:Infinity}});assert.ok(extreme.release(60));assert.ok(integrate(extreme).dx<=180);
});
