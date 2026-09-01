import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, createMascotEngine } from '../../../runtime/runtime.js';

test('canTransition allows unrestricted graph', () => {
  assert.equal(canTransition(undefined, 'idle', 'happy'), true);
});

test('canTransition enforces configured transitions', () => {
  const transitions = { idle: ['happy'], happy: ['idle'] };
  assert.equal(canTransition(transitions, 'idle', 'happy'), true);
  assert.equal(canTransition(transitions, 'idle', 'sad'), false);
});

test('transition contract distinguishes missing, empty, listed, unknown, and same state', () => {
  assert.equal(canTransition({}, 'idle', 'happy'), true);
  assert.equal(canTransition({ idle: [] }, 'idle', 'happy'), false);
  assert.equal(canTransition({ idle: ['happy'] }, 'idle', 'happy'), true);
  assert.equal(canTransition({ idle: ['happy'] }, 'idle', 'unknown'), false);
  assert.equal(canTransition({ idle: [] }, 'idle', 'idle'), true);
});

test('standalone runtime start/stop is idempotent and stale generations cannot resurrect',()=>{
  const callbacks=new Map();let id=0;const node={id:'part',tagName:'g',values:{},setAttribute(k,v){this.values[k]=v;}};const root={id:'',querySelectorAll:()=>[node]};
  const rig={params:{x:{default:0}},states:{idle:{x:0}},activeState:'idle',elements:{part:{bindings:{},baseTransform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1}}}};
  const engine=createMascotEngine({svgRoot:root,rig,requestFrame:fn=>(callbacks.set(++id,fn),id),cancelFrame:key=>callbacks.delete(key),now:()=>0});
  for(let i=0;i<100;i++)engine.start();assert.equal(callbacks.size,1);const stale=[...callbacks.values()][0];engine.stop();assert.equal(callbacks.size,0);engine.start();stale(20);assert.equal(callbacks.size,1);for(let i=0;i<1000;i++){engine.stop();engine.start();}assert.equal(callbacks.size,1);engine.stop();assert.equal(callbacks.size,0);
});
