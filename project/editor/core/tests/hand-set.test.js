import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { validateRig } from '../validation/rig-validator.js';
import { assignHand } from '../hands/hand-model.js';
import { HAND_LOCAL_RADIUS, HAND_PART_IDS, handElementId, handPartId } from '../sample/hand-artwork.js';
import { handsMarkup, installHands } from '../sample/hand-feature.js';
import {
  HAND_SET_DRAWINGS, addHandSetCommand, builtInHandSetMarkup, handSetElementId, handSetFrame, hasHandSet, importedHandSetMarkup, installHandSet
} from '../sample/hand-set.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * A set of drawings for a hand (docs/HAND_REPRESENTATIONS_STUDY.md, stage 4):
 * method B, the cut-out way -- every pose a whole drawing the hand swaps to.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const element = (nodeType = 'path', d = '') => ({
  baseTransform: transform(), baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {},
  meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d }
});
const value = (name, amount) => ({ [name]: { type: 'number', min: -1, max: 1, default: 0, value: amount } });

/** A hand whose artwork is a blob of the author's own, somewhere on the canvas. */
function customHand() {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="body"></g><path id="blob" d="M100 100 L140 100 L140 150 L100 150 Z"/></svg>';
  state.elements = { body: element('g'), blob: element('path', 'M100 100 L140 100 L140 150 L100 150 Z') };
  state.layers = [{ id: 'body', type: 'g', name: 'Body', children: [] }, { id: 'blob', type: 'path', name: 'Blob', children: [] }];
  state.states = { idle: {} };
  state.activeState = 'idle';
  const assigned = assignHand(null, 'left', { element: 'blob', parent: 'body', anchor: { x: 120, y: 125 }, reach: { x: 40, y: 30 } });
  state.hands = assigned.hands;
  for (const [name, parameter] of Object.entries(assigned.parameters)) state.params[name] = structuredClone(parameter);
  return state;
}
const measureBlob = (id) => (id === 'blob' ? { x: 100, y: 100, width: 40, height: 50 } : null);

/** What the canvas does with appended markup: a rig record for every node with an id. */
function appended(state, markup) {
  state.svgMarkup = state.svgMarkup.replace('</svg>', `${markup}</svg>`);
  for (const match of markup.matchAll(/<(g|path|circle) id="([^"]+)"/g)) state.elements[match[2]] ||= element(match[1]);
  return state;
}

test('the frame of a set is the hand: its middle, its size, and its turn when the generator drew it', () => {
  const custom = handSetFrame(customHand(), 'left', measureBlob);
  assert.deepEqual(custom.at, { x: 120, y: 125 }, 'the middle of the artwork');
  assert.ok(Math.abs(custom.scale - 50 / (2 * HAND_LOCAL_RADIUS)) < 1e-9, 'no bigger than the artwork');
  assert.equal(custom.transform.rotation, 0, 'nothing says which way that artwork hangs');
  assert.deepEqual([custom.transform.pivotX, custom.transform.pivotY], [120, 125]);
  // Nothing to measure, nothing to place.
  assert.equal(handSetFrame(customHand(), 'left', () => null), null);
  assert.equal(handSetFrame({}, 'left', measureBlob), null);

  // A generated hand knows its own frame: the drawing lands under the neutral hand.
  const state = createCleanProjectState();
  const markup = handsMarkup({});
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g>${markup}</svg>`;
  state.elements = { faceRoot: element('g') };
  state.states = { idle: {} };
  for (const side of ['left', 'right']) {
    state.elements[handElementId(side)] = element('g');
    for (const part of HAND_PART_IDS) state.elements[handPartId(side, part)] = element('path', 'M0 0');
  }
  installHands(state);
  const generated = handSetFrame(state, 'left', () => null);
  const group = state.elements.handLeft.baseTransform;
  assert.deepEqual(generated.at, { x: group.pivotX, y: group.pivotY });
  assert.equal(generated.transform.rotation, 200);
  assert.equal(generated.transform.scaleX, group.scaleX);
});

test('the built-in set gives a hand of any artwork every gesture as a drawing, swapped in as the pose rises', () => {
  const state = customHand();
  const frame = handSetFrame(state, 'left', measureBlob);
  const markup = builtInHandSetMarkup(state, 'left', { frame });
  for (const drawing of HAND_SET_DRAWINGS) assert.ok(markup.includes(`<g id="${handSetElementId('left', drawing.id)}" data-name="${drawing.name} (drawing)"`), `${drawing.id} is drawn`);
  assert.match(markup, /id="handLeftSetFistPalm"/, 'a drawing is the six parts, under its own ids');
  appended(state, markup);
  assert.equal(hasHandSet(state, 'left'), false);
  assert.equal(installHandSet(state, 'left', { drawings: HAND_SET_DRAWINGS, frame }), true);
  assert.equal(hasHandSet(state, 'left'), true);
  assert.deepEqual(validateRig(state), []);

  const hand = state.hands.left;
  assert.deepEqual(hand.poses.map((pose) => pose.id), HAND_SET_DRAWINGS.map((drawing) => drawing.id));
  for (const pose of hand.poses) {
    assert.equal(pose.variant, handSetElementId('left', pose.id), 'each pose is a drawing');
    assert.ok(state.params[pose.parameter], `${pose.parameter} exists`);
    // Where the hand is: pivot on its middle, unturned for artwork of unknown orientation.
    assert.deepEqual([state.elements[pose.variant].baseTransform.pivotX, state.elements[pose.variant].baseTransform.pivotY], [120, 125]);
  }
  const at = (values) => compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, { hands: state.hands });
  const rest = at({});
  assert.equal(rest.handLeftSetFist.opacity, 0, 'a drawing is hidden until its pose rises');
  assert.equal(rest.blob.opacity, 1);
  const fist = at(value('handLFist', 1));
  assert.equal(fist.handLeftSetFist.opacity, 1);
  assert.equal(fist.blob.opacity, 0, 'the neutral artwork fades out by exactly as much');
  // Carried by the hand: the drawing reaches where the hand reaches.
  const reached = at({ ...value('handLFist', 1), ...value('handLX', 1) });
  assert.equal(reached.handLeftSetFist.transform.x, reached.blob.transform.x);
  assert.ok(reached.handLeftSetFist.transform.x > fist.handLeftSetFist.transform.x);
  // Two drawings raised at once share the hand rather than piling up.
  const both = at({ ...value('handLFist', 1), ...value('handLPoint', 1) });
  assert.equal(both.handLeftSetFist.opacity, 0.5);
  assert.equal(both.handLeftSetPoint.opacity, 0.5);
});

test('an imported SVG\'s drawings are centred on the hand, no bigger than it, and named after the pose they are for', () => {
  const state = customHand();
  const frame = handSetFrame(state, 'left', measureBlob);
  const children = [
    { id: 'fist', markup: '<path d="M0 0 L10 0 L10 20 Z"/>', bbox: { x: 0, y: 0, width: 10, height: 20 } },
    { name: 'Wave hello', markup: '<circle cx="5" cy="5" r="5"/>', bbox: { x: 0, y: 0, width: 10, height: 10 } },
    { id: 'fist', markup: '<path d="M0 0 L4 0 L4 4 Z"/>', bbox: { x: 0, y: 0, width: 4, height: 4 } },
    { id: 'empty', markup: '<g/>', bbox: { x: 0, y: 0, width: 0, height: 0 } },
    { markup: '<rect width="8" height="8"/>', bbox: { x: 0, y: 0, width: 8, height: 8 } }
  ];
  const { markup, drawings } = importedHandSetMarkup(children, 'left', { frame });
  assert.deepEqual(drawings.map((drawing) => drawing.id), ['fist', 'waveHello', 'fist2', 'drawing'], 'known names map to poses, twins are numbered, a drawing with no size is skipped');
  assert.deepEqual(drawings.map((drawing) => drawing.elementId), ['handLeftSetFist', 'handLeftSetWaveHello', 'handLeftSetFist2', 'handLeftSetDrawing']);
  // The first drawing is 20 tall; the hand is 2 × radius × scale tall, so it is scaled to fit and its middle put on the hand's.
  const k = (2 * HAND_LOCAL_RADIUS * frame.scale) / 20;
  const wrap = new RegExp(`<g id="handLeftSetFist" data-name="fist \\(drawing\\)"><g transform="translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([-\\d.]+) ([-\\d.]+)\\)"><path d="M0 0 L10 0 L10 20 Z"/></g></g>`);
  const match = wrap.exec(markup);
  assert.ok(match, 'the drawing is wrapped, not rewritten');
  assert.ok(Math.abs(Number(match[3]) - k) < 0.06 && Math.abs(Number(match[4]) - k) < 0.06);
  assert.ok(Math.abs(Number(match[1]) - (120 - k * 5)) < 0.06 && Math.abs(Number(match[2]) - (125 - k * 10)) < 0.06);
  // A set drawn for the other hand is flipped, about the same middle.
  const flipped = importedHandSetMarkup(children.slice(0, 1), 'left', { frame, flip: true });
  assert.match(flipped.markup, /scale\(-[\d.]+ [\d.]+\)/);
  // Ids a hand already uses are kept clear of.
  assert.deepEqual(importedHandSetMarkup(children.slice(0, 1), 'left', { frame, taken: new Set(['fist']) }).drawings.map((drawing) => drawing.id), ['fist2']);
  // Rigged like the built-in set.
  appended(state, markup);
  assert.equal(installHandSet(state, 'left', { drawings, frame }), true);
  assert.equal(state.hands.left.poses.find((pose) => pose.id === 'waveHello').variant, 'handLeftSetWaveHello');
  assert.deepEqual(validateRig(state), []);
});

test('a set is one command and one undo step', () => {
  const before = customHand();
  const frame = handSetFrame(before, 'left', measureBlob);
  const markup = builtInHandSetMarkup(before, 'left', { frame });
  const artwork = appended(structuredClone(before), markup);
  const store = createEditorStore(before);
  const history = createHistory(store);
  let snapshots = 0, commands = 0;
  const snapshot = history.snapshot.bind(history), execute = store.execute.bind(store);
  history.snapshot = () => { snapshots += 1; return snapshot(); };
  store.execute = (command) => { commands += 1; return execute(command); };
  assert.equal(addHandSetCommand(store, history, 'left', { svgMarkup: artwork.svgMarkup, elements: artwork.elements, layers: artwork.layers, layerMetadata: {} }, { drawings: HAND_SET_DRAWINGS, frame }), true);
  assert.equal(snapshots, 1);
  assert.equal(commands, 1);
  assert.equal(hasHandSet(store.getDocument(), 'left'), true);
  history.undo();
  assert.equal(hasHandSet(store.getDocument(), 'left'), false);
  assert.equal(store.getDocument().elements.handLeftSetFist, undefined);
  // A hand that does not exist gets nothing.
  assert.equal(addHandSetCommand(store, history, 'right', artwork, { drawings: HAND_SET_DRAWINGS, frame }), false);
});
