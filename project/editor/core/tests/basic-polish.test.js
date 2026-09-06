import test from 'node:test';import assert from 'node:assert/strict';
import { FACE_FEATURES,describeFaceFeature,isFaceFeatureInstalled } from '../sample/face-features.js';
import { findSemanticPartByElement } from '../../rig-editor/semantic-parts/part-model.js';
import { MASCOT_FACE_SVG } from '../sample/templates/face-artwork.js';
test('feature detection derives installation from semantic roles and artwork',()=>{const state={elements:{browLeft:{},browRight:{}},semanticParts:{eyebrows:{type:'eyebrows',roles:{leftBrow:'browLeft',rightBrow:'browRight'}}}};assert.equal(isFaceFeatureInstalled(state,'eyebrows'),true);delete state.elements.browRight;assert.equal(isFaceFeatureInstalled(state,'eyebrows'),false);assert.ok(FACE_FEATURES.eyelids.exampleClips.some(c=>c.name==='Natural Blink'));});
// The card said "+ Add" on a mascot that already had eyelids, and the press
// threw "Semantic part id collision". The question is whether the *mascot* has
// the feature, so artwork drawn differently and named differently still counts.
test('a feature the mascot already has counts however its artwork is named',()=>{
  const state={elements:{lidUpperLeft:{},lidLowerLeft:{},lidUpperRight:{},lidLowerRight:{}},
    semanticParts:{eyelids:{type:'eyelids',roles:{leftUpper:'lidUpperLeft',leftLower:'lidLowerLeft',rightUpper:'lidUpperRight',rightLower:'lidLowerRight'}}}};
  assert.equal(isFaceFeatureInstalled(state,'eyelids'),true,'these are eyelids, whatever the ids are');
  assert.deepEqual(describeFaceFeature(state,'eyelids'),{installed:true,available:false,reason:null});
  // Half a part is not installed, and it is not addable either: the press would
  // collide with the part that is already there, so the card says so instead.
  delete state.elements.lidLowerRight;
  assert.equal(isFaceFeatureInstalled(state,'eyelids'),false);
  const half=describeFaceFeature(state,'eyelids');
  assert.equal(half.available,false);
  assert.match(half.reason,/already has eyelids/);
  // Nothing there at all: addable.
  assert.deepEqual(describeFaceFeature({},'eyelids'),{installed:false,available:true,reason:null});
  // Artwork already drawing one of the ids blocks it, and says which.
  assert.match(describeFaceFeature({elements:{upperLidLeft:{}}},'eyelids').reason,/upperLidLeft/);
  assert.match(describeFaceFeature({animationClips:[{id:'natural-blink'}]},'eyelids').reason,/natural-blink/);
});
test('the built-in face and the progressive features share the faceRoot contract',()=>{assert.match(MASCOT_FACE_SVG,/<g id="faceRoot"/);assert.equal(FACE_FEATURES.eyebrows.mountPoint,'faceRoot');assert.equal(FACE_FEATURES.eyelids.mountPoint,'faceRoot');});
test('canvas artwork resolves to its most specific semantic Face Part',()=>{const state={layers:[{id:'faceRoot',children:[{id:'head',children:[]},{id:'eyes',children:[{id:'pupilLeft',children:[]}]}]}],semanticParts:{head:{id:'head-part',roles:{head:'faceRoot'}},gaze:{id:'gaze',roles:{leftPupil:'pupilLeft'}}}};assert.equal(findSemanticPartByElement(state,'pupilLeft').id,'gaze');assert.equal(findSemanticPartByElement(state,'head').id,'head-part');assert.equal(findSemanticPartByElement(state,'missing'),null);});
