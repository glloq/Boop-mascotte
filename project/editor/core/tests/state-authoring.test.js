import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from '../../../runtime/runtime.js';
import { addBehavior, duplicateBehavior } from '../../animation-editor/behaviors/behavior-operations.js';
import { addTransition, copyState, removeState, stateProblems } from '../../animation-editor/state-machine/state-operations.js';

const rig=()=>({params:{headY:{min:-1,max:1,default:0,value:.2}},states:{Neutral:{headY:0},Happy:{headY:.5}},activeState:'Neutral',transitions:{},transitionSettings:{},behaviors:[]});
test('legacy unrestricted transitions stay unrestricted until an author edits policy',()=>{const model=rig();assert.equal(canTransition(model.transitions,'Neutral','Happy'),true);const saved=structuredClone(model);assert.equal(Object.hasOwn(saved.transitions,'Neutral'),false);addTransition(saved,'Neutral','Happy');assert.deepEqual(saved.transitions.Neutral,['Happy']);assert.equal(canTransition(saved.transitions,'Happy','Neutral'),true);saved.transitions.Happy=[];assert.equal(canTransition(saved.transitions,'Happy','Neutral'),false);});
test('duplicate State copies pose without incoming or outgoing transitions',()=>{const model=rig();addTransition(model,'Neutral','Happy');const name=copyState(model,'Happy');assert.equal(name,'Happy-Copy');assert.deepEqual(model.states[name],model.states.Happy);assert.deepEqual(model.transitions[name],[]);assert.equal(model.transitions.Neutral.includes(name),false);});
test('State deletion cleans directed links and settings atomically',()=>{const model=rig();addTransition(model,'Neutral','Happy');removeState(model,'Happy');assert.deepEqual(model.transitions.Neutral,[]);assert.deepEqual(model.transitionSettings,{});assert.deepEqual(stateProblems(model),[]);});
test('behavior ids remain stable and duplication creates a distinct id',()=>{const model=rig(),first=addBehavior(model,'oscillator'),id=first.id;const copy=duplicateBehavior(model,0);assert.equal(model.behaviors[0].id,id);assert.notEqual(copy.id,id);assert.equal(copy.name,'Oscillation Copy');});
