import test from 'node:test';import assert from 'node:assert/strict';
import { availableExamples } from '../sample/example-registry.js';
import { FACE_FEATURES,isFaceFeatureInstalled } from '../sample/face-features.js';
test('example registry exposes only clips present in the project',()=>{const state={animationClips:[{id:'blink-clip',name:'Blink'},{id:'missing',name:'Dead'}]};assert.deepEqual(availableExamples(state).map(x=>x.name),['Blink']);});
test('feature detection derives installation from semantic roles and artwork',()=>{const state={elements:{browLeft:{},browRight:{}},semanticParts:{eyebrows:{roles:{leftBrow:'browLeft',rightBrow:'browRight'}}}};assert.equal(isFaceFeatureInstalled(state,'eyebrows'),true);delete state.elements.browRight;assert.equal(isFaceFeatureInstalled(state,'eyebrows'),false);assert.ok(FACE_FEATURES.eyelids.exampleClips.some(c=>c.name==='Natural Blink'));});
