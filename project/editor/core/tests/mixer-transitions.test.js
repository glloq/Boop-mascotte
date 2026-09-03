import test from 'node:test';
import assert from 'node:assert/strict';
import { mixParameters, orderLayers, parameterNeutral, MIXER_ORDER, MIX_MODES } from '../../../runtime/mixer.js';
import { createWeightBlender, createParameterTransition } from '../../../runtime/transitions.js';
import { createMascotEngine } from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';
import { createEditorStore } from '../state/editor-store.js';
import { createSampleProject } from '../state/store.js';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} != ${expected}`);

const params = () => ({
  smile: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  eyeOpen: { type: 'number', min: 0, max: 1, default: 1, value: 1 },
  headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
});

/* Mixer */

test('the mixer declares its layer order and its modes', () => {
  assert.deepEqual(MIXER_ORDER, ['base', 'motion', 'reaction', 'expression', 'behavior', 'override']);
  assert.deepEqual(MIX_MODES, ['additive', 'multiplicative', 'override', 'weightedOverride']);
});

test('an override layer replaces, and a partial weight blends towards the value', () => {
  const base = { smile: 0.2 };
  assert.deepEqual(mixParameters(base, [{ mode: 'override', values: { smile: 1 } }], params()), { smile: 1 });
  near(mixParameters(base, [{ mode: 'override', weight: 0.5, values: { smile: 1 } }], params()).smile, 0.6);
});

test('an additive layer adds its distance from the parameter neutral', () => {
  assert.deepEqual(mixParameters({ eyeOpen: 1 }, [{ mode: 'additive', values: { eyeOpen: 0 } }], params()), { eyeOpen: 0 });
  // eyeOpen's neutral is 1, so a value of 0 contributes −1, halved by the weight.
  assert.deepEqual(mixParameters({ eyeOpen: 1 }, [{ mode: 'additive', weight: 0.5, values: { eyeOpen: 0 } }], params()), { eyeOpen: 0.5 });
  assert.deepEqual(mixParameters({ smile: 0.25 }, [{ mode: 'additive', values: { smile: 0.5 } }], params()), { smile: 0.75 });
});

test('a multiplicative layer scales around one', () => {
  assert.deepEqual(mixParameters({ eyeOpen: 0.8 }, [{ mode: 'multiplicative', values: { eyeOpen: 0.5 } }], params()), { eyeOpen: 0.4 });
  near(mixParameters({ eyeOpen: 0.8 }, [{ mode: 'multiplicative', weight: 0.5, values: { eyeOpen: 0.5 } }], params()).eyeOpen, 0.6);
});

test('a weightedOverride moves part of the way from wherever it is', () => {
  assert.deepEqual(mixParameters({ headX: -1 }, [{ mode: 'weightedOverride', weight: 0.25, values: { headX: 1 } }], params()), { headX: -0.5 });
});

test('layers apply in the order they are given, and a zero weight does nothing', () => {
  const result = mixParameters({ smile: 0 }, [
    { mode: 'override', values: { smile: 1 } },
    { mode: 'additive', values: { smile: 0.5 } },
    { mode: 'override', weight: 0, values: { smile: -1 } }
  ], params());
  assert.equal(result.smile, 1.5);
});

test('orderLayers sorts into the canonical order regardless of how they arrive', () => {
  const sorted = orderLayers([{ source: 'override' }, { source: 'base' }, { source: 'expression' }, { source: 'motion' }]);
  assert.deepEqual(sorted.map((layer) => layer.source), ['base', 'motion', 'expression', 'override']);
});

test('the mixer ignores non-numeric values and unknown parameters keep a zero neutral', () => {
  assert.deepEqual(mixParameters({ smile: 0.5 }, [{ mode: 'override', values: { smile: 'nope', other: undefined } }], params()), { smile: 0.5 });
  assert.equal(parameterNeutral(params(), 'eyeOpen'), 1);
  assert.equal(parameterNeutral(params(), 'unknown'), 0);
  assert.equal(parameterNeutral({ direct: 0.4 }, 'direct'), 0.4);
});

test('clamping to bounds is opt-in and only touches what a layer wrote', () => {
  const layers = [{ mode: 'additive', values: { smile: 5 } }];
  assert.equal(mixParameters({ smile: 0, headX: 9 }, layers, params()).smile, 5);
  const clamped = mixParameters({ smile: 0, headX: 9 }, layers, params(), { clampToBounds: true });
  assert.equal(clamped.smile, 1);
  assert.equal(clamped.headX, 9, 'an untouched parameter is left alone');
});

/* Weight blender */

test('a blender with no duration behaves exactly as an instant switch', () => {
  const blender = createWeightBlender();
  blender.set('happy', 0.5);
  assert.deepEqual(blender.values(), { happy: 0.5 });
  assert.deepEqual(blender.targets(), { happy: 0.5 });
  blender.set('happy', 0);
  assert.deepEqual(blender.targets(), {});
  assert.equal(blender.settled(), true);
});

test('a blender ramps a weight instead of jumping', () => {
  const blender = createWeightBlender({ duration: 100, easing: 'linear' });
  blender.set('happy', 1);
  assert.deepEqual(blender.values(), {});
  blender.advance(50);
  assert.deepEqual(blender.values(), { happy: 0.5 });
  assert.equal(blender.settled(), false);
  blender.advance(50);
  assert.deepEqual(blender.values(), { happy: 1 });
  assert.equal(blender.settled(), true);
});

test('Happy to Angry cross-fades and never passes through neutral', () => {
  const blender = createWeightBlender({ duration: 100, easing: 'linear' });
  blender.set('happy', 1);
  blender.advance(100);
  blender.transitionTo('angry');
  for (const step of [10, 20, 30, 20]) {
    blender.advance(step);
    const values = blender.values();
    const total = (values.happy || 0) + (values.angry || 0);
    assert.ok(total > 0.9, `something is always showing (total ${total})`);
  }
  blender.advance(20);
  assert.deepEqual(blender.values(), { angry: 1 });
});

test('retargeting mid-ramp continues from what is showing, it does not restart', () => {
  const blender = createWeightBlender({ duration: 100, easing: 'linear' });
  blender.set('happy', 1);
  blender.advance(50);
  assert.deepEqual(blender.values(), { happy: 0.5 });
  blender.set('happy', 0);
  assert.deepEqual(blender.values(), { happy: 0.5 }, 'starts from where the eye is');
  blender.advance(50);
  assert.deepEqual(blender.values(), { happy: 0.25 });
});

test('Happy → Angry → Surprised → Happy never returns to an empty pose', () => {
  const blender = createWeightBlender({ duration: 80, easing: 'easeInOut' });
  blender.set('happy', 1);
  blender.advance(80);
  for (const next of ['angry', 'surprised', 'happy']) {
    blender.transitionTo(next);
    for (let step = 0; step < 8; step += 1) {
      blender.advance(10);
      const total = Object.values(blender.values()).reduce((sum, value) => sum + value, 0);
      assert.ok(total > 0.5, `pose held while moving to ${next} (total ${total})`);
    }
  }
  assert.deepEqual(blender.values(), { happy: 1 });
});

test('a blender reset drops everything', () => {
  const blender = createWeightBlender({ duration: 100 });
  blender.set('happy', 1);
  blender.reset();
  assert.deepEqual(blender.values(), {});
  assert.equal(blender.settled(), true);
});

/* Parameter transition */

test('a parameter transition starts from the vector it was given, not from neutral', () => {
  const transition = createParameterTransition({ smile: 0.8, headX: -0.4 }, { smile: -0.6 }, { duration: 100, easing: 'linear' });
  assert.deepEqual(transition.at(0), { smile: 0.8, headX: -0.4 });
  near(transition.at(50).smile, 0.1);
  near(transition.at(50).headX, -0.4);
  near(transition.at(100).smile, -0.6);
  near(transition.at(100).headX, -0.4);
  assert.equal(transition.done(100), true);
});

test('a zero-duration transition lands immediately', () => {
  const transition = createParameterTransition({ smile: 1 }, { smile: 0 }, { duration: 0 });
  assert.deepEqual(transition.at(0), { smile: 0 });
  assert.equal(transition.done(0), true);
});

/* Engine and preview */

const rigWithExpressions = (transitionSettings = {}) => normalizeRig({
  params: params(),
  states: { idle: { smile: 0, eyeOpen: 1, headX: 0 } },
  activeState: 'idle', transitions: {}, transitionSettings,
  elements: {},
  expressions: [
    { id: 'happy', name: 'Happy', controls: { smile: 0.8, eyeOpen: 0.9 } },
    { id: 'angry', name: 'Angry', controls: { smile: -0.7, eyeOpen: 0.6 } }
  ]
});

const engineAt = (rig, clock) => createMascotEngine({
  svgRoot: { id: '', querySelector: () => null }, rig,
  requestFrame: () => 1, cancelFrame: () => {}, now: () => clock.value
});

test('setExpression stays instant when a rig configures no expression blend', () => {
  const engine = engineAt(rigWithExpressions(), { value: 0 });
  engine.setExpression('happy', 1);
  assert.equal(engine.getParams().smile, 0.8);
  assert.deepEqual(engine.getExpressions(), { happy: 1 });
});

test('an expression blend is reported as a target while it is still showing the old pose', () => {
  const engine = engineAt(rigWithExpressions({ expression: { duration: 200, easing: 'linear' } }), { value: 0 });
  engine.setExpression('happy', 1);
  assert.deepEqual(engine.getExpressions(), { happy: 1 }, 'the target is what was asked for');
  assert.deepEqual(engine.getExpressionWeights(), {}, 'nothing is showing yet');
  assert.equal(engine.isSettled(), false);
});

test('transitionToExpression refuses an unknown expression', () => {
  const engine = engineAt(rigWithExpressions(), { value: 0 });
  assert.equal(engine.transitionToExpression('nope'), false);
  assert.equal(engine.transitionToExpression('angry'), true);
  assert.equal(engine.setExpression('nope'), false);
});

test('the exported engine and the editor preview still agree on expressions', () => {
  const state = createSampleProject();
  state.expressions = [{ id: 'happy', name: 'Happy', controls: { mouthOpen: 0.6 } }];
  const store = createEditorStore(state);
  const preview = createPreviewController({ store, canvas: { applyFrame: () => {} }, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });
  preview.setExpression('happy', 0.5);
  const engine = createMascotEngine({
    svgRoot: { id: '', querySelector: () => null }, rig: normalizeRig({ ...state, expressions: state.expressions }),
    requestFrame: () => 1, cancelFrame: () => {}, now: () => 0
  });
  engine.setExpression('happy', 0.5);
  assert.equal(engine.getParams().mouthOpen, preview.getEffectiveParams().mouthOpen);
});

test('the preview cross-fades expressions without a neutral frame', () => {
  const state = createSampleProject();
  state.transitionSettings = { ...state.transitionSettings, expression: { duration: 100, easing: 'linear' } };
  state.expressions = [
    { id: 'happy', name: 'Happy', controls: { mouthOpen: 0.8 } },
    { id: 'angry', name: 'Angry', controls: { mouthOpen: -0.8 } }
  ];
  const store = createEditorStore(state);
  const preview = createPreviewController({ store, canvas: { applyFrame: () => {} }, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });
  preview.setExpression('happy', 1, { duration: 0 });
  assert.equal(preview.getEffectiveParams().mouthOpen, 0.8);
  preview.transitionToExpression('angry');
  const weights = preview.getExpressionWeights();
  assert.deepEqual(weights, { happy: 1 }, 'the previous pose is still the one showing');
  assert.deepEqual(preview.getExpressionTargets(), { angry: 1 });
});
