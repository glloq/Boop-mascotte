// Regressions for the fixes in docs/ANIMATION_CONTROL_AUDIT.md that live
// outside the reaction controller (its own three are in reactions.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState, createStore } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';
import { createClip, addTrack, upsertKeyframe } from '../../animation-editor/timeline/clip-operations.js';
import { duplicateSelectedKeys } from '../../animation-editor/timeline/timeline-operations.js';
import { assignEdgeLanes, renderTransitionGraph } from '../../animation-editor/state-machine/transition-graph.js';
import { createExpressionCommands } from '../expressions/expression-commands.js';
import { expressionBlend } from '../expressions/expression-model.js';
import { createExportRig } from '../export/export-rig.js';

/* § 2.4 — duplicating a key used to overwrite whatever was one step later. */
test('duplicating keys never overwrites a key that is already there', () => {
  const clips = [], clip = createClip(clips, 'Move', 1);
  addTrack(clip, 'headY');
  upsertKeyframe(clip, 'headY', 0, 0);
  upsertKeyframe(clip, 'headY', 1 / 30, .5, 'easeIn');
  upsertKeyframe(clip, 'headY', 1, -1);

  // The copy of the key at 0 would land exactly on the key at 1/30.
  const collide = duplicateSelectedKeys(clip, [{ parameter: 'headY', time: 0 }], 1 / 30);
  assert.deepEqual(collide, { selection: [], skipped: 1 });
  assert.deepEqual(clip.tracks.headY.find((frame) => Math.abs(frame.time - 1 / 30) < 1e-6), { time: 1 / 30, value: .5, easing: 'easeIn' }, 'the neighbour keeps its own value and easing');

  // A key at the very end clamps onto itself, which used to look like success.
  assert.deepEqual(duplicateSelectedKeys(clip, [{ parameter: 'headY', time: 1 }], 1 / 30), { selection: [], skipped: 1 });
  assert.equal(clip.tracks.headY.length, 3, 'nothing was added');

  const room = duplicateSelectedKeys(clip, [{ parameter: 'headY', time: 1 / 30 }], .25);
  assert.deepEqual(room.selection, [{ parameter: 'headY', time: 1 / 30 + .25 }]);
  assert.equal(room.skipped, 0);
  assert.equal(clip.tracks.headY.length, 4);
});

/* § 7 — every edge used to be drawn at one height, so a pair hid each other. */
test('transition edges take separate lanes so every one of them is clickable', () => {
  assert.deepEqual(assignEdgeLanes([{ left: 110, right: 190 }, { left: 110, right: 190 }]), [0, 1], 'A→B and B→A cannot share a rectangle');
  assert.deepEqual(assignEdgeLanes([{ left: 110, right: 190 }, { left: 260, right: 340 }]), [0, 0], 'edges that do not overlap share a lane');
  assert.deepEqual(assignEdgeLanes([{ left: 110, right: 190 }, { left: 110, right: 340 }]), [0, 1], 'an edge drawn across a node gets its own lane');

  const rig = { states: { Idle: {}, Happy: {}, Angry: {} }, transitions: { Idle: ['Happy', 'Angry'], Happy: ['Idle'] }, activeState: 'Idle' };
  const html = renderTransitionGraph(rig, 'Idle', null);
  const tops = [...html.matchAll(/graph-edge[^>]*top:(-?\d+)px/g)].map((match) => Number(match[1]));
  assert.equal(new Set(tops).size, tops.length, 'no two edges land on the same row');
  assert.ok(tops.every((top) => top >= 0), 'and none of them is clipped off the top');
});

/* § 3.1 — the cross-fade was shipped, exported and unreachable. */
test('the expression cross-fade can be authored, and reaches the exported rig', () => {
  const document = { ...createCleanProjectState(), svgMarkup: '<svg><path id="head" d="M0 0"/></svg>', expressions: [{ id: 'happy', name: 'Happy', controls: {}, source: 'preset' }] };
  const store = createEditorStore(document), history = createHistory(store), commands = createExpressionCommands(store, history);
  assert.deepEqual(expressionBlend(store.getDocument()), { duration: 0, easing: 'easeInOut' }, 'a project switches instantly until it is told otherwise');

  assert.deepEqual(commands.setBlend({ duration: 160 }), { duration: 160, easing: 'easeInOut' });
  assert.deepEqual(commands.setBlend({ easing: 'easeOut' }), { duration: 160, easing: 'easeOut' }, 'each field is set on its own');
  assert.deepEqual(createExportRig(store.getDocument()).expressionBlend, { duration: 160, easing: 'easeOut' }, 'the exported mascot cross-fades too');

  assert.deepEqual(commands.setBlend({ duration: -50 }), { duration: 0, easing: 'easeOut' }, 'nonsense is clamped, not stored');
  history.undo();
  assert.equal(expressionBlend(store.getDocument()).duration, 160, 'and it is one undo step like every other edit');
});

/* § 4.1 — Preview posed the mascot with a clip the exported runtime would not play. */
test('a stopped clip poses the mascot for the Timeline and not for Preview', () => {
  const state = createCleanProjectState();
  state.params = { headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
  state.states = { idle: { headY: 0 } }; state.activeState = 'idle';
  // A clip that does not start at neutral is the case that used to mislead.
  state.animationClips = [{ id: 'lean', name: 'Lean', duration: 1, loop: false, tracks: { headY: [{ time: 0, value: .6, easing: 'linear' }, { time: 1, value: .9, easing: 'linear' }] } }];
  const store = createStore(); store.replaceState(state);
  const preview = createPreviewController({ store, canvas: { applyFrame() {} }, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });

  preview.setClip('lean');
  assert.equal(preview.getEffectiveParams().headY, .6, 'selecting a clip shows its first frame: that is how a key is authored');
  preview.seek(.5);
  assert.equal(preview.getEffectiveParams().headY, .75, 'scrubbing poses the mascot');

  preview.stopClip();
  assert.equal(preview.getEffectiveParams().headY, .6, 'the Timeline keeps the pose at the playhead');
  assert.equal(preview.isClipPosed(), true);

  preview.stopClip({ pose: false });
  assert.equal(preview.getEffectiveParams().headY, 0, 'Preview puts the mascot back, like the exported runtime');
  assert.equal(preview.isClipPosed(), false);

  preview.playClip();
  assert.equal(preview.getEffectiveParams().headY, .6, 'and playing brings it back');
});
