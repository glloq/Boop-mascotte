import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, evaluateRigBinding } from '../../../runtime/runtime.js';
import { createCleanProjectState } from '../state/store.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createSemanticPart, assignSemanticRole, calibrateSemanticPart, enableSemanticControl, removeSemanticPart, renameSemanticParameterReferences, setSemanticControlMethod, captureSemanticMorph } from '../../rig-editor/semantic-parts/part-model.js';
import { SEMANTIC_PART_REGISTRY, SUPPORTED_SEMANTIC_DRIVER_PROPERTIES } from '../../rig-editor/semantic-parts/part-registry.js';
import { normalizeAnimationClip } from '../../animation-editor/timeline/clip-model.js';
import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
import { moveKeyframe } from '../../animation-editor/timeline/clip-operations.js';

const baseElement = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 3 }, baseOpacity: .8, constraints: { translate: true, rotate: true, scale: true }, bindings: {} });

test('binding neutrals, constrained scales, and opacity use property semantics', () => {
  assert.equal(evaluateRigBinding(undefined, {}, { neutral: 0 }), 0);
  assert.equal(evaluateRigBinding(undefined, {}, { neutral: 1 }), 1);
  assert.equal(evaluateRigBinding({ enabled: false }, {}, { neutral: 1 }), 1);
  const element = baseElement();
  element.bindings.scaleX = { enabled: true, expression: '1.5' };
  assert.equal(compileRigFrame({ e: element }, {}, { scale: 0 }).e.transform.scaleX, 2);
  assert.equal(compileRigFrame({ e: element }, {}, { scale: .5 }).e.transform.scaleX, 2.5);
  for (const [binding, expected] of [[undefined, .8], [{ enabled: false }, .8], [{ enabled: true, expression: '0' }, 0], [{ enabled: true, expression: '.5' }, .4], [{ enabled: true, expression: '1' }, .8]]) {
    element.bindings.opacity = binding; assert.equal(compileRigFrame({ e: element }).e.opacity, expected);
  }
  element.bindings.opacity = { enabled: true, expression: '2' }; assert.equal(compileRigFrame({ e: element }).e.opacity, 1);
});

test('semantic registry covers the v1 part vocabulary', () => {
  assert.deepEqual(Object.keys(SEMANTIC_PART_REGISTRY), ['head', 'eyes', 'gaze', 'eyelids', 'eyebrows', 'nose', 'mouth', 'jaw', 'hair', 'ears', 'accessory']);
});

test('semantic parts assign roles, create parameters and generic bindings, rename and remove', () => {
  const rig = createCleanProjectState(); rig.elements = { left: baseElement(), right: baseElement() }; rig.states = { idle: {} };
  const part = createSemanticPart(rig, 'gaze'); assignSemanticRole(rig, part.id, 'leftPupil', 'left'); assignSemanticRole(rig, part.id, 'rightPupil', 'right');
  enableSemanticControl(rig, part.id, 'lookX', { amplitude: 5 });
  assert.equal(rig.params.lookX.default, 0); assert.equal(rig.states.idle.lookX, 0);
  assert.equal(rig.elements.left.bindings.translateX.expression, 'lookX'); assert.equal(rig.elements.right.bindings.translateX.amplitude, 5);
  renameSemanticParameterReferences(rig, 'lookX', 'gazeX'); assert.deepEqual(part.controls, ['gazeX']);
  assert.equal(removeSemanticPart(rig, part.id), part); assert.deepEqual(rig.semanticParts, {});
});

test('semantic role assignment rejects using one artwork for two distinct roles', () => {
  const rig=createCleanProjectState();rig.elements={eye:baseElement()};
  const eyes=createSemanticPart(rig,'eyes');assignSemanticRole(rig,eyes.id,'leftEye','eye');
  assert.throws(()=>assignSemanticRole(rig,eyes.id,'rightEye','eye'),/already used by leftEye/);
  assert.deepEqual(eyes.roles,{leftEye:'eye'});
});

test('semantic binding ownership conflicts never overwrite manual or other-part bindings',()=>{const rig=createCleanProjectState();rig.elements={eye:baseElement()};rig.states={idle:{}};rig.elements.eye.bindings.translateX={expression:'manual'};const part=createSemanticPart(rig,'gaze');assignSemanticRole(rig,part.id,'leftPupil','eye');assert.throws(()=>enableSemanticControl(rig,part.id,'lookX'),(error)=>error.name==='SemanticBindingConflict'&&error.conflicts[0].owner.manual);assert.equal(rig.elements.eye.bindings.translateX.expression,'manual');assert.deepEqual(part.controls,[]);});

test('control-specific scale defaults distinguish eye-open and mouth-open neutral poses',()=>{const rig=createCleanProjectState();rig.elements={eye:baseElement(),mouth:baseElement()};rig.states={idle:{}};const eyes=createSemanticPart(rig,'eyes');assignSemanticRole(rig,eyes.id,'leftEye','eye');enableSemanticControl(rig,eyes.id,'eyeOpen');const mouth=createSemanticPart(rig,'mouth');assignSemanticRole(rig,mouth.id,'mouth','mouth');enableSemanticControl(rig,mouth.id,'mouthOpen');assert.equal(rig.elements.eye.bindings.scaleY.offset,0);assert.equal(rig.elements.mouth.bindings.scaleY.offset,1);assert.equal(compileRigFrame({eye:rig.elements.eye},{eyeOpen:1}).eye.transform.scaleY,3);});

test('moving a key clamps, sorts, and replaces a destination collision',()=>{const clip={duration:1,tracks:{lookX:[{time:0,value:-1,easing:'linear'},{time:1,value:1,easing:'easeOut'}]}};const moved=moveKeyframe(clip,'lookX',1,0);assert.equal(moved.value,1);assert.deepEqual(clip.tracks.lookX,[{time:0,value:1,easing:'easeOut'}]);moveKeyframe(clip,'lookX',0,2);assert.equal(clip.tracks.lookX[0].time,1);});
test('registry calibration is complete and every exposed strategy compiles generically',()=>{const expected={eyeOpen:['CLOSED','OPEN'],browRaise:['LOW','NEUTRAL','RAISED'],browTilt:['TILT LEFT','NEUTRAL','TILT RIGHT'],jawOpen:['CLOSED','OPEN'],hairSway:['LEFT','CENTER','RIGHT'],hairLift:['LOW','CENTER','HIGH'],mouthOpen:['CLOSED / NEUTRAL','OPEN']};for(const def of Object.values(SEMANTIC_PART_REGISTRY)){for(const methods of Object.values(def.strategies||{}))for(const method of methods)assert.ok(SUPPORTED_SEMANTIC_DRIVER_PROPERTIES.includes(method),method);for(const [control,labels] of Object.entries(expected))if(def.controls.includes(control))assert.deepEqual(def.calibration[control].poses.map(p=>p.label),labels);}});

test('generated semantic bindings have ownership, follow role reassignment, calibrate asymmetrically, and clean up',()=>{
  const rig=createCleanProjectState();rig.elements={old:baseElement(),next:baseElement()};rig.states={idle:{}};const part=createSemanticPart(rig,'gaze');assignSemanticRole(rig,part.id,'leftPupil','old');enableSemanticControl(rig,part.id,'lookX');assert.equal(rig.elements.old.bindings.translateX.generatedBy.semanticPart,part.id);
  assignSemanticRole(rig,part.id,'leftPupil','next');assert.equal(rig.elements.old.bindings.translateX,undefined);assert.equal(rig.elements.next.bindings.translateX.expression,'lookX');
  calibrateSemanticPart(rig,part.id,{center:{leftPupil:{x:2}},left:{leftPupil:{x:-3}},right:{leftPupil:{x:9}}});assert.equal(rig.elements.next.bindings.translateX.amplitude,6);assert.equal(rig.elements.next.bindings.translateX.offset,3);
  removeSemanticPart(rig,part.id);assert.equal(rig.params.lookX,undefined);assert.equal(rig.states.idle.lookX,undefined);assert.equal(rig.elements.next.bindings.translateX,undefined);
});

test('clips normalize ordering, validate params, interpolate, ease, and loop', () => {
  const clip = normalizeAnimationClip({ id: 'look', duration: 2, loop: true, tracks: { lookX: [{ time: 2, value: 1 }, { time: 0, value: 0 }, { time: 1, value: 1, easing: 'easeIn' }] } }, ['lookX']);
  assert.deepEqual(clip.tracks.lookX.map((key) => key.time), [0, 1, 2]);
  assert.equal(evaluateAnimationClip(clip, 0).lookX, 0); assert.equal(evaluateAnimationClip(clip, .5).lookX, .25);
  assert.equal(evaluateAnimationClip(clip, 2.5).lookX, .25);
  assert.throws(() => normalizeAnimationClip({ duration: 1, tracks: { missing: [] } }, ['lookX']), /unknown parameter/);
});

test('semantic parts and timeline beta round-trip as editor-only snapshot metadata', () => {
  const source = createCleanProjectState(); source.svgMarkup = '<svg><g id="artwork"/></svg>'; source.semanticParts = { eyes: { id: 'eyes', type: 'eyes', roles: {} } }; source.animationClips = [{ id: 'blink', duration: .3, tracks: {} }];
  const snapshot = createProjectSnapshot(source); assert.equal(snapshot.version, 3); assert.equal(snapshot.document.rig.semanticParts, undefined);
  const target = createCleanProjectState(); applyProjectSnapshot(target, snapshot);
  assert.deepEqual(target.semanticParts, source.semanticParts); assert.deepEqual(target.animationClips, source.animationClips);
});


test('method switching cleans only owned drivers and morph capture validates ownership',()=>{const rig=createCleanProjectState();rig.elements={mouth:{...baseElement(),meta:{nodeType:'path'}}};rig.states={idle:{}};const part=createSemanticPart(rig,'mouth');assignSemanticRole(rig,part.id,'mouth','mouth');enableSemanticControl(rig,part.id,'mouthOpen');rig.elements.mouth.bindings.opacity={expression:'manual'};setSemanticControlMethod(rig,part.id,'mouthOpen','morph');assert.equal(rig.elements.mouth.bindings.scaleY,undefined);assert.equal(rig.elements.mouth.bindings.opacity.expression,'manual');assert.equal(captureSemanticMorph(rig,part.id,'mouthOpen','neutral',{mouth:'M 0 0 L 10 0'}),false);assert.equal(captureSemanticMorph(rig,part.id,'mouthOpen','open',{mouth:'M 0 0 L 10 5'}),true);assert.deepEqual(rig.elements.mouth.morph.generatedBy,{semanticPart:part.id,control:'mouthOpen'});setSemanticControlMethod(rig,part.id,'mouthOpen','scaleY');assert.equal(rig.elements.mouth.morph,undefined);assert.equal(rig.elements.mouth.bindings.opacity.expression,'manual');assert.equal(rig.elements.mouth.bindings.scaleY.generatedBy.control,'mouthOpen');});

test('eye morph orientation is closed at zero and open at one, and non-path artwork is rejected',()=>{const rig=createCleanProjectState();rig.elements={eye:{...baseElement(),meta:{nodeType:'path'}},rect:{...baseElement(),meta:{nodeType:'rect'}}};const eyes=createSemanticPart(rig,'eyes');assignSemanticRole(rig,eyes.id,'leftEye','eye');enableSemanticControl(rig,eyes.id,'eyeOpen');setSemanticControlMethod(rig,eyes.id,'eyeOpen','morph');captureSemanticMorph(rig,eyes.id,'eyeOpen','open',{leftEye:'M 0 0 L 5 2'});captureSemanticMorph(rig,eyes.id,'eyeOpen','closed',{leftEye:'M 0 0 L 5 0'});assert.equal(rig.elements.eye.morph.pathA,'M 0 0 L 5 0');assert.equal(rig.elements.eye.morph.pathB,'M 0 0 L 5 2');const other=createSemanticPart(rig,'mouth');assignSemanticRole(rig,other.id,'mouth','rect');enableSemanticControl(rig,other.id,'mouthOpen');assert.throws(()=>setSemanticControlMethod(rig,other.id,'mouthOpen','morph'),/requires an SVG path/);});
