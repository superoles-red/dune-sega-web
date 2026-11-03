import test from 'node:test';
import assert from 'node:assert/strict';
import {dragScroll} from '../web/native-ui.mjs';

function fixture(){
 const listeners=new Map(),captures=[],element={scrollTop:200,scrollHeight:800,clientHeight:200,
  addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),setPointerCapture:id=>captures.push(id)};
 const remove=dragScroll(element);
 const emit=(name,properties={})=>{const event={pointerId:1,pointerType:'mouse',button:0,buttons:0,isPrimary:true,clientX:100,clientY:100,detail:1,defaultPrevented:false,immediateStopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.immediateStopped=true;},...properties};listeners.get(name)?.(event);return event;};
 return {element,captures,emit,remove,listeners};
}

test('Safari mouse hover after a down with no held buttons cannot turn a building click into a drag',()=>{
 const h=fixture();h.emit('pointerdown');const hover=h.emit('pointermove',{clientX:770,clientY:612,buttons:0});h.emit('pointerup');const click=h.emit('click');
 assert.equal(h.element.scrollTop,200);assert.deepEqual(h.captures,[]);assert.equal(hover.defaultPrevented,false);assert.equal(click.defaultPrevented,false);assert.equal(click.immediateStopped,false);
 h.remove();assert.equal(h.listeners.size,0);
});

test('a held mouse still scrolls and suppresses its following click',()=>{
 const h=fixture();h.emit('pointerdown',{buttons:1});const move=h.emit('pointermove',{clientY:140,buttons:1});h.emit('pointerup',{clientY:140});const click=h.emit('click');
 assert.equal(h.element.scrollTop,160);assert.deepEqual(h.captures,[1]);assert.equal(move.defaultPrevented,true);assert.equal(click.defaultPrevented,true);assert.equal(click.immediateStopped,true);h.remove();
});

test('touch dragging keeps browser scrolling and suppresses its following pointer click even with buttons zero',()=>{
 const h=fixture();h.emit('pointerdown',{pointerType:'touch'});const move=h.emit('pointermove',{pointerType:'touch',clientY:140,buttons:0});h.emit('pointerup',{pointerType:'touch',clientY:140});const click=h.emit('click',{pointerType:'touch'});
 assert.equal(h.element.scrollTop,200,'native touch scrolling is left to the browser');assert.deepEqual(h.captures,[]);assert.equal(move.defaultPrevented,false);assert.equal(click.defaultPrevented,true);assert.equal(click.immediateStopped,true);
 assert.equal(h.emit('click',{detail:0}).defaultPrevented,false,'keyboard activation remains available');h.remove();
});
