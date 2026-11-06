import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {OrderFeedback,orderFeedbackPulse,projectOrderFeedback,initialFeedbackPointerKind} from '../web/order-feedback.mjs';

test('one accepted intent has exactly two short visible intervals, then ends',()=>{
 assert.deepEqual([0,50,99,100,179,180,250,279,280].map(orderFeedbackPulse),[1,1,1,0,0,2,2,2,0]);
 assert.equal(orderFeedbackPulse(-1),0);assert.equal(orderFeedbackPulse(NaN),0);
});
test('feedback stays anchored to the same world point through pan, zoom and DPR-independent CSS projection',()=>{
 const world={x:800,y:1200},rect={left:10,top:20,width:1000,height:800},camera={map:1,left:600,top:1000,scale:2,scaleY:3};
 const a=projectOrderFeedback(world,camera,rect);assert.deepEqual(a,{x:384,y:581,width:52,height:78});
 const pan=projectOrderFeedback(world,{...camera,left:640,top:1020},rect);assert.equal(pan.x,a.x-80);assert.equal(pan.y,a.y-60);
 const zoom=projectOrderFeedback(world,{...camera,scale:3,scaleY:2},rect);assert.equal(zoom.x+zoom.width/2,rect.left+600);assert.equal(zoom.y+zoom.height/2,rect.top+400);
});
test('off-map, invalid projection and minimap positions never show the overlay',()=>{
 const world={x:800,y:1200},rect={left:0,top:0,width:1000,height:800},camera={map:1,left:600,top:1000,scale:2,scaleY:2};
 assert.equal(projectOrderFeedback(world,{...camera,map:0},rect),null);assert.equal(projectOrderFeedback(world,{...camera,scale:NaN},rect),null);
 assert.equal(projectOrderFeedback(world,{...camera,left:900},rect),null);
 assert.equal(projectOrderFeedback(world,{...camera,minimap:{visible:1,x:390,y:390,width:100,height:100}},rect),null);
});
test('RAF presentation counts two pulses and cancels on a UI transition without native callbacks',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}});view.ready=true;view.manifest={width:26,height:26};const camera={map:1,left:0,top:0,scale:1,scaleY:1};
  view.acknowledge(200,200,0);for(const now of [0,50,120,180,250])view.render(now,camera);
  assert.equal(view.displayedPulses,2);assert.equal(view.acceptedIntents,1);view.render(280,camera);assert.equal(view.active,false);assert.equal(view.element.hidden,true);
  view.acknowledge(200,200,1000);view.render(1001,camera,{blocked:true});assert.equal(view.active,false);assert.equal(view.element.hidden,true);assert.equal(view.acceptedIntents,2);
 }finally{globalThis.document=oldDocument;}
});

test('a delayed animation callback cannot discard a newly observed order before either pulse',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})},pointerKind:'touch'});
  view.ready=true;view.assets.move={width:26,height:26,url:'original-quad.png'};
  const camera={map:1,left:0,top:0,scale:1,scaleY:1};
  // A timer can observe the native commit after this frame's RAF timestamp.
  view.observe({lastOrder:{seq:1,kind:'move',worldX:160,worldY:200}},{now:100});
  view.render(94,camera);assert.equal(view.active,true,'an older frame timestamp leaves the acknowledgement pending');
  view.render(111,camera);assert.equal(view.image.hidden,false);assert.equal(view.displayedPulses,1);
  view.render(220,camera);assert.equal(view.image.hidden,true);
  view.render(290,camera);assert.equal(view.image.hidden,false);assert.equal(view.displayedPulses,2);
  view.render(380,camera);assert.equal(view.active,false);assert.equal(view.element.hidden,true);
 }finally{globalThis.document=oldDocument;}
});

test('the real host paints acknowledgements with the observation clock even when the RAF timestamp is older',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})},pointerKind:'touch'});
  view.ready=true;view.assets.move={width:26,height:26,url:'original-quad.png'};
  const camera={map:1,left:0,top:0,scale:1,scaleY:1},source=readFileSync(new URL('../web/shell.js',import.meta.url),'utf8'),start=source.indexOf('function placementFrame(now){');
  assert.ok(start>=0);const end=source.indexOf('\nif(inputCheckMode)',start);assert.ok(end>start);
  let wallNow=105;
  const frame=vm.runInNewContext(source.slice(start,end)+'\nplacementFrame',{
   requestAnimationFrame(){},ready:true,orders:{flush(){}},performance:{now:()=>wallNow},panInertia:{active:false},
   gameUI:{render(){},capturesInput:false},orderFeedback:view,nativeJSON:()=>camera,lastEdgeTime:0,gestures:{mode:'idle'},
  });
  view.observe({lastOrder:{seq:1,kind:'move',worldX:160,worldY:200}},{now:100});
  frame(98);assert.equal(view.image.hidden,false,'the first pulse paints immediately using current observation time');assert.equal(view.displayedPulses,1);
  wallNow=150;frame(138);assert.equal(view.image.hidden,false);assert.equal(view.displayedPulses,1);
  wallNow=220;frame(208);assert.equal(view.image.hidden,true);
  wallNow=280;frame(268);assert.equal(view.image.hidden,false);assert.equal(view.displayedPulses,2);
  wallNow=380;frame(368);assert.equal(view.active,false);assert.equal(view.element.hidden,true);
 }finally{globalThis.document=oldDocument;}
});

test('only a new native commit chooses move or attack art; selection, queued clicks and hidden commits cannot guess an attack',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}}),camera={map:1,left:0,top:0,scale:1,scaleY:1};view.ready=true;view.assets={move:{width:26,height:26,url:'original-quad.png'},attack:{width:24,height:24,url:'original-attack.png'}};
  view.observe({selected:{kind:'unit',own:true},lastOrder:{seq:0,kind:'none'}},{now:0});assert.equal(view.current,null,'selecting any object is not a committed order');
  view.observe({lastOrder:{seq:1,kind:'move',worldX:200,worldY:200,action:1,targetKind:'none'}},{now:1});view.render(1,camera);assert.equal(view.image.src,'original-quad.png');assert.equal(view.current.kind,'move');
  view.observe({lastOrder:{seq:2,kind:'attack',worldX:220,worldY:200,action:0,targetKind:'building'}},{now:10});view.render(10,camera);assert.equal(view.image.src,'original-attack.png');assert.equal(view.current.kind,'attack');assert.equal(view.acceptedIntents,2);
  view.observe({lastOrder:{seq:2,kind:'attack',worldX:220,worldY:200}},{now:20});assert.equal(view.acceptedIntents,2,'polling never repeats a native commit');
  view.observe({lastOrder:{seq:3,kind:'attack',worldX:240,worldY:200}},{now:30,blocked:true});assert.equal(view.acceptedIntents,2);
  view.observe({lastOrder:{seq:3,kind:'attack',worldX:240,worldY:200}},{now:40});assert.equal(view.acceptedIntents,2,'a commit consumed behind the curtain is not replayed later');
  view.clear({reset:true});view.observe({lastOrder:{seq:1,kind:'move',worldX:200,worldY:200}},{now:50});assert.equal(view.acceptedIntents,3,'a new loaded run may start its observer sequence again');
 }finally{globalThis.document=oldDocument;}
});

test('armed native Palace shows its original large reticle while camera movement stays presentation only',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}});view.ready=true;view.assets.attack={width:24,height:24,url:'original-attack.png'};
  assert.match(view.specialImage.style.cssText,/left:0;top:0;transform:translate\(-50%,-50%\)/);assert.match(view.specialImage.style.cssText,/pointer-events:none/);
  view.observe({special:{armed:true},lastOrder:{seq:0}},{now:0});view.render(0,{map:1,left:0,top:0,scale:1,scaleY:1});assert.equal(view.specialImage.hidden,true,'an unknown pointer never invents a centre-of-screen aim');view.observe({special:{armed:false},lastOrder:{seq:0}},{now:0});
  for(const [house,key] of [[0,'death-hand'],[1,'fremen'],[2,'saboteur']]){
   view.aimAt(157,526);view.observe({special:{armed:true,ready:true,house,key,targetsCell:true},lastOrder:{seq:0,kind:'none'}},{now:0});assert.equal(view.active,true);
   view.render(0,{map:1,left:100,top:200,scale:1,scaleY:1});assert.equal(view.specialImage.hidden,false);assert.equal(view.specialImage.src,'original-attack.png');assert.equal(view.specialImage.style.left,'157px');assert.equal(view.specialImage.style.top,'526px');assert.equal(view.current,null);
   view.render(10,{map:1,left:300,top:400,scale:2,scaleY:2});assert.equal(view.specialImage.hidden,false);assert.equal(view.acceptedIntents,0,'panning does not invent a native fire command');
   view.observe({special:{armed:false},lastOrder:{seq:0,kind:'none'}},{now:20});view.render(20,{map:1,left:300,top:400,scale:2,scaleY:2});assert.equal(view.specialImage.hidden,true);assert.equal(view.active,false);
  }
 }finally{globalThis.document=oldDocument;}
});

test('one Palace cancellation hides the painted marker even when the host stops rendering inactive feedback',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  for(const kind of ['mouse','touch']){
   const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})},pointerKind:kind});view.ready=true;view.assets.attack={width:24,height:24,url:'native-attack.png'};
   const camera={map:1,left:0,top:0,scale:1,scaleY:1},armed={special:{armed:true},lastOrder:{seq:0}};
   view.aimAt(120,180);view.observe(armed);if(view.active)view.render(0,camera);assert.equal(view.specialImage.hidden,false);
   // A queued native clear can still produce one old armed snapshot.
   view.clear();view.observe(armed);if(view.active)view.render(1,camera);assert.equal(view.specialImage.hidden,false);
   view.observe({special:{armed:false},lastOrder:{seq:0}});if(view.active)view.render(2,camera);
   assert.equal(view.active,false);assert.equal(view.specialImage.hidden,true);assert.equal(view.element.hidden,true);assert.equal(view.acceptedIntents,0);
  }
 }finally{globalThis.document=oldDocument;}
});

test('Palace aim follows the actual pointer, hides during pan and confirms the committed world target',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:10,top:20,width:800,height:600})}});view.ready=true;view.assets.attack={width:24,height:24,url:'native-attack.png'};
  const camera={map:1,left:100,top:200,scale:2,scaleY:2};
  view.observe({special:{armed:true},lastOrder:{seq:0}},{now:0});view.aimAt(123,234);view.render(0,camera);
  assert.equal(view.specialImage.style.left,'133px');assert.equal(view.specialImage.style.top,'254px');assert.equal(view.acceptedIntents,0);
  assert.match(view.specialImage.style.cssText,/clamp\(128px,44vmin,256px\)/);
  view.panAim();view.render(1,camera);assert.equal(view.specialImage.hidden,true);assert.equal(view.acceptedIntents,0);
  view.releaseAim(160,280);view.render(2,camera);assert.equal(view.specialImage.style.left,'170px');
  view.observe({special:{armed:false},lastOrder:{seq:1,kind:'special',worldX:180,worldY:340}},{now:3});view.render(3,camera);
  assert.equal(view.current.kind,'special');assert.equal(view.lastProjection.width,256);assert.equal(view.lastProjection.x+view.lastProjection.width/2,170);assert.equal(view.lastProjection.y+view.lastProjection.height/2,300);
 }finally{globalThis.document=oldDocument;}
});

test('touch and pen Palace indicators stay visible at viewport centre before a pointer, through pan and resize',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  for(const kind of ['touch','pen']){
   let rect={left:10,top:20,width:390,height:844};const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>rect},pointerKind:kind});view.ready=true;view.assets.attack={width:24,height:24,url:'native-attack.png'};
   const camera={map:1,left:100,top:200,scale:2,scaleY:2};view.observe({special:{armed:true},lastOrder:{seq:0}},{now:0});view.render(0,camera);
   assert.equal(view.lastPointer,null);assert.equal(view.specialImage.hidden,false,'arming never waits for a hover on a touch screen');assert.equal(view.specialImage.style.left,'205px');assert.equal(view.specialImage.style.top,'442px');
   view.aimAt(25,720);view.panAim();view.render(1,{...camera,left:800,top:900,scale:1,scaleY:1});assert.equal(view.specialImage.hidden,false);assert.equal(view.specialImage.style.left,'205px');assert.equal(view.specialImage.style.top,'442px');
   view.releaseAim(100,200);view.render(2,camera);assert.equal(view.specialImage.style.left,'205px');assert.equal(view.specialImage.style.top,'442px');assert.equal(view.acceptedIntents,0,'moving the visual marker does not commit an order');
   rect={left:0,top:0,width:844,height:390};view.render(3,camera);assert.equal(view.specialImage.style.left,'422px');assert.equal(view.specialImage.style.top,'195px');
   view.observe({special:{armed:false},lastOrder:{seq:0}},{now:4});view.render(4,camera);assert.equal(view.specialImage.hidden,true);assert.equal(view.element.hidden,true);assert.equal(view.active,false);
  }
 }finally{globalThis.document=oldDocument;}
});

test('actual pointer kind overrides coarse-device default without changing native world-target confirmation',()=>{
 const oldDocument=globalThis.document,oldMatch=globalThis.matchMedia;globalThis.document={createElement:()=>({style:{},hidden:true,setAttribute(){},append(){}}),body:{append(){}}};
 try{
  globalThis.matchMedia=query=>({matches:query==='(pointer: coarse)'});assert.equal(initialFeedbackPointerKind(),'touch');
  const view=new OrderFeedback({canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}});view.ready=true;view.assets.attack={width:24,height:24,url:'native-attack.png'};const camera={map:1,left:100,top:200,scale:2,scaleY:2};
  view.observe({special:{armed:true},lastOrder:{seq:0}},{now:0});view.aimAt(120,150);view.render(0,camera);assert.equal(view.specialImage.style.left,'400px');
  assert.equal(view.setPointerKind('mouse'),true);view.render(1,camera);assert.equal(view.specialImage.style.left,'120px');assert.equal(view.specialImage.style.top,'150px');
  assert.equal(view.setPointerKind('unknown'),false);assert.equal(view.pointerKind,'mouse');view.setPointerKind('touch');view.render(2,camera);assert.equal(view.specialImage.style.left,'400px');
  const actual={seq:1,kind:'special',worldX:180,worldY:340};view.observe({special:{armed:false},lastOrder:actual},{now:3});view.render(3,camera);
  assert.deepEqual(actual,{seq:1,kind:'special',worldX:180,worldY:340});assert.deepEqual(view.lastWorld,{x:180,y:340});assert.equal(view.lastProjection.x+view.lastProjection.width/2,160);assert.equal(view.lastProjection.y+view.lastProjection.height/2,280);assert.equal(view.specialImage.hidden,true);
  globalThis.matchMedia=()=>({matches:false});assert.equal(initialFeedbackPointerKind(),'mouse');
 }finally{globalThis.document=oldDocument;if(oldMatch===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=oldMatch;}
});
