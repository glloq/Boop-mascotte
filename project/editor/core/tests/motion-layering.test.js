// docs/ADR_MOTION_LAYERING.md — Q1 cross-fade replace with an opt-in layer,
// Q2 weightedOverride, Q3 the document with a per-call override.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMascotEngine, createMotionLayer, normalizeMotionBlend } from '../../../runtime/runtime.js';
import { createCleanProjectState, createStore } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';
import { createMotionCommands } from '../motion/motion-commands.js';
import { motionBlend } from '../motion/motion-model.js';
import { createExportRig } from '../export/export-rig.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';

const hold = (id, parameter, value) => ({ id, name: id.toUpperCase(), duration: 2, loop: false, tracks: { [parameter]: [{ time: 0, value, easing: 'linear' }, { time: 2, value, easing: 'linear' }] } });
const clips = () => [hold('a', 'headY', 1), hold('b', 'headY', -1), hold('c', 'lookX', 1)];
const layerOf = (blend = { duration: 200, easing: 'linear' }) => createMotionLayer({ blend, clips: clips() });
const weightsAt = (layer, time, base = { headY: 0, lookX: 0 }) => Object.fromEntries(layer.layers(time, base).map((item) => [item.values.headY !== undefined ? 'headY' : 'lookX', item.weight]));

test('a motion fades in, hands over to the next one, and fades out at its end', () => {
  const layer = layerOf();
  assert.equal(layer.play('nope', 0), false, 'a motion that does not exist does not play');
  assert.equal(layer.play('a', 0), true);

  // Q2: weightedOverride. The clip is worth its keys at the weight it is showing.
  assert.deepEqual(layer.layers(0, { headY: 0 }), [], 'it starts from the pose underneath, not at full');
  layer.advance(100);
  assert.deepEqual(layer.layers(.1, { headY: 0 }).map((item) => [item.source, item.mode, item.weight]), [['motion', 'weightedOverride', .5]]);
  layer.advance(100);
  assert.equal(layer.layers(.2, { headY: 0 })[0].weight, 1);

  // Q1: playing another motion cross-fades; both are on screen at once.
  layer.play('b', .2);
  layer.advance(100);
  const swap = layer.layers(.3, { headY: 0 });
  assert.deepEqual(swap.map((item) => item.weight), [.5, .5], 'the outgoing motion is still showing');
  assert.deepEqual(swap.map((item) => item.values.headY), [1, -1]);
  layer.advance(100);
  assert.deepEqual(layer.layers(.4, { headY: 0 }).map((item) => item.values.headY), [-1], 'and is gone once the fade is spent');
  assert.equal(layer.active(), 'b');

  // The end of a non-looping clip releases instead of vanishing in one frame.
  layer.advance(1900); layer.layers(2.3, { headY: 0 });
  layer.advance(100);
  assert.equal(layer.layers(2.4, { headY: 0 })[0].weight, .5, 'it rides its own fade out');
  layer.advance(100);
  assert.deepEqual(layer.layers(2.5, { headY: 0 }), []);
  assert.equal(layer.active(), null);
  assert.equal(layer.settled(), true);
});

test('layer: true runs two motions at once, and a shared parameter goes to the newer one', () => {
  const layer = layerOf({ duration: 0, easing: 'linear' });
  layer.play('a', 0);
  layer.play('c', 0, { layer: true });
  assert.deepEqual(layer.playing(), ['a', 'c'], 'disjoint parameters simply coexist');
  assert.deepEqual(layer.layers(0, { headY: 0, lookX: 0 }).map((item) => item.values), [{ headY: 1 }, { lookX: 1 }]);

  // Two motions writing the same parameter is legal; start order decides.
  layer.play('b', 0, { layer: true });
  assert.deepEqual(layer.playing(), ['a', 'c', 'b']);
  const stacked = layer.layers(0, { headY: 0, lookX: 0 });
  assert.deepEqual(stacked.map((item) => item.values), [{ headY: 1 }, { lookX: 1 }, { headY: -1 }], 'the newer motion is applied last, so it wins');

  assert.equal(layer.stop('c'), true, 'one motion can be stopped on its own');
  assert.deepEqual(layer.playing(), ['a', 'b']);
  assert.equal(layer.stop('nope'), false);
});

test('the fade span comes from the document, and a call may override it', () => {
  // Q3. A rig that declares nothing cuts, exactly as it did before this change.
  assert.deepEqual(normalizeMotionBlend(), { duration: 0, easing: 'easeInOut' });
  assert.deepEqual(normalizeMotionBlend({ duration: -5, easing: 'nope' }), { duration: 0, easing: 'easeInOut' });

  const instant = layerOf({ duration: 0 });
  instant.play('a', 0);
  assert.equal(instant.layers(0, { headY: 0 })[0].weight, 1, 'no blend means the old behaviour, on the first frame');

  const overridden = layerOf({ duration: 0 });
  overridden.play('a', 0, { fade: 200, easing: 'linear' });
  assert.deepEqual(overridden.layers(0, { headY: 0 }), [], 'a per-call fade wins over the document');
  overridden.advance(100);
  assert.equal(overridden.layers(.1, { headY: 0 })[0].weight, .5);
});

test('motionBlend is authored, persisted, exported and undone like any other edit', () => {
  const document = { ...createCleanProjectState(), svgMarkup: '<svg><path id="head" d="M0 0"/></svg>', animationClips: [hold('a', 'headY', 1)] };
  const store = createEditorStore(document), history = createHistory(store), commands = createMotionCommands(store, history);
  assert.deepEqual(motionBlend(store.getDocument()), { duration: 0, easing: 'easeInOut' }, 'a new project cuts until it is told otherwise');

  const revisions = store.getDomainRevisions();
  assert.deepEqual(commands.setBlend({ duration: 140 }), { duration: 140, easing: 'easeInOut' });
  assert.notEqual(store.getDomainRevisions().animation, revisions.animation, 'it belongs to the animation domain');
  assert.deepEqual(commands.setBlend({ easing: 'easeOut' }), { duration: 140, easing: 'easeOut' });
  assert.deepEqual(createExportRig(store.getDocument()).motionBlend, { duration: 140, easing: 'easeOut' }, 'the exported mascot hands over too');

  const restored = { ...createCleanProjectState() };
  applyProjectSnapshot(restored, createProjectSnapshot(store.getDocument()));
  assert.deepEqual(restored.motionBlend, { duration: 140, easing: 'easeOut' }, 'and it survives save / open');

  history.undo();
  assert.equal(motionBlend(store.getDocument()).duration, 140);
  assert.equal(motionBlend(store.getDocument()).easing, 'easeInOut');
});

test('the exported engine hands over between motions instead of cutting', () => {
  const rig = {
    schemaVersion: 4, elements: {}, params: { headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 } },
    states: { idle: { headY: 0 } }, activeState: 'idle', transitions: {}, behaviors: [],
    animations: clips(), motionBlend: { duration: 200, easing: 'linear' }
  };
  let clock = 0, frame = null;
  const engine = createMascotEngine({
    svgRoot: { id: '', querySelector: () => null, querySelectorAll: () => [] }, rig,
    requestFrame: (fn) => { frame = fn; return 1; }, cancelFrame: () => {}, now: () => clock, fps: 1000
  });
  engine.start();
  const advance = (ms) => { clock += ms; const next = frame; frame = null; next?.(clock); };
  // The engine assumes 1/60 s for its very first frame, so prime the clock
  // before measuring: from here every delta is the one we asked for.
  advance(1);

  assert.equal(engine.playMotion('a'), true);
  advance(100);
  assert.ok(Math.abs(engine.getParams().headY - .5) < 1e-9, 'the motion eases in');
  advance(100);
  assert.equal(engine.getParams().headY, 1);

  engine.playMotion('b');
  advance(100);
  const mid = engine.getParams().headY;
  assert.ok(mid < 1 && mid > -1, `the two motions overlap (${mid})`);
  advance(100);
  assert.equal(engine.getParams().headY, -1);
  assert.equal(engine.getAnimation(), 'b');
  assert.deepEqual(Object.keys(engine.getMotionWeights()), ['b']);

  engine.stopMotion();
  advance(200);
  assert.equal(engine.getParams().headY, 0, 'stopping fades back to the pose underneath');
  assert.equal(engine.getAnimation(), null);
  assert.equal(engine.isSettled(), true);
  engine.stop();
});

test('Preview plays motions the way the exported mascot does, and the Timeline keeps its own transport', () => {
  const state = createCleanProjectState();
  state.params = { headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 }, lookX: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
  state.states = { idle: { headY: 0, lookX: 0 } }; state.activeState = 'idle';
  state.motionBlend = { duration: 200, easing: 'linear' };
  state.animationClips = clips();
  const store = createStore(); store.replaceState(state);
  let clock = 0; const queue = [];
  const preview = createPreviewController({ store, canvas: { applyFrame() {} }, requestFrame: (fn) => { queue.push(fn); return queue.length; }, cancelFrame: () => {}, now: () => clock });
  const advance = (ms) => { clock += ms; queue.shift()?.(clock); };
  preview.start();

  assert.equal(preview.playMotion('nope'), false);
  assert.equal(preview.playMotion('a'), true);
  advance(100);
  assert.equal(preview.getEffectiveParams().headY, .5, 'it eases in, like the export');
  advance(100);
  preview.playMotion('b');
  advance(100);
  assert.deepEqual(Object.keys(preview.getMotionWeights()), ['a', 'b'], 'and hands over rather than cutting');
  advance(100);
  assert.equal(preview.getEffectiveParams().headY, -1);
  assert.equal(preview.isPlaying(), true);
  preview.stopMotion();
  advance(200);
  assert.equal(preview.getEffectiveParams().headY, 0);
  assert.equal(preview.isPlaying(), false);

  // The Timeline transport is not blended: a scrub shows the clip at full strength.
  preview.setClip('a');
  assert.equal(preview.getEffectiveParams().headY, 1, 'selecting a clip to edit shows it immediately');
  assert.deepEqual(preview.getMotionWeights(), {}, 'and it does not go through the motion layer');
  preview.playMotion('c');
  assert.equal(preview.getActiveClipId(), 'c');
  assert.equal(preview.getEffectiveParams().headY, 0, 'playing a motion takes the scrub pose down');
  advance(200);
  assert.deepEqual(preview.getMotionWeights(), { c: 1 }, 'and fades the new one in through the layer');
  assert.equal(preview.getEffectiveParams().lookX, 1);
});
