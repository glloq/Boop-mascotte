import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createProjectDocument } from '../state/project-document.js';
import { validateRig } from '../validation/rig-validator.js';
import { HAND_PART_IDS, handElementId, handPartId } from '../sample/hand-artwork.js';
import { handFacingParameter, handsMarkup, installHands } from '../sample/hand-feature.js';
import {
  addHandSpritesCommand, handPoseParameterMap, handSpriteFrame, handSpritesMarkup, hasHandSprites,
  installHandSprites, isLegacyPseudo3DHand, legacyHandPartIds, migrateHandPoseParameters, migratedHandPose,
  addHandPoseCommand, addHandSpritePose, addSpriteHandsCommand, handPoseIndex, handPoseMarkup, handSetPoses,
  installSpriteHands, parameterIsUsed, removeLegacyHandDeformation, retireHandDeformation, spriteHandsMarkup
} from '../hands/hand-sprite-install.js';
import { HAND_SPRITE_VIEWS, handSpriteElementId } from '../hands/hand-sprite-set.js';
import { compileRigFrame, createHandSprites } from '../../../runtime/runtime.js';

/**
 * Converting a hand to drawings (docs/HANDS_2D.md, PHASES 11, 40-41).
 *
 * What matters is that a project survives it: the mascot goes on waving, the
 * hand goes on moving, and nothing that used to deform is left half-wired.
 */
const element = (nodeType = 'path', d = '') => ({
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1,
  constraints: { translate: true, rotate: true, scale: true }, bindings: {},
  meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d }
});

/** A mascot with the pair the editor draws: six parts a side and the facing axis. */
function pairedMascot() {
  const state = createCleanProjectState();
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g>${handsMarkup({})}</svg>`;
  state.elements = { faceRoot: element('g') };
  state.states = { idle: {} };
  state.activeState = 'idle';
  for (const side of ['left', 'right']) {
    state.elements[handElementId(side)] = element('g');
    for (const part of HAND_PART_IDS) state.elements[handPartId(side, part)] = element('path', 'M0 0');
  }
  assert.equal(installHands(state), true);
  return state;
}

/** What the canvas does with appended markup: a rig record for every node with an id. */
function appended(state, markup) {
  state.svgMarkup = state.svgMarkup.replace('</svg>', `${markup}</svg>`);
  for (const match of markup.matchAll(/<(g|path) id="([^"]+)"/g)) state.elements[match[2]] ||= element(match[1]);
  return state;
}

const convert = (state, side = 'left', options = {}) => {
  const frame = handSpriteFrame(state, side, () => null);
  appended(state, handSpritesMarkup(state, side, { frame, ...options }));
  return { frame, ok: installHandSprites(state, side, { frame, ...options }) };
};

test('a drawn pair is a legacy hand until its author converts it', () => {
  const state = createProjectDocument(pairedMascot());
  assert.equal(hasHandSprites(state, 'left'), false);
  assert.equal(isLegacyPseudo3DHand(state, 'left'), true);
  assert.equal(state.hands.left.legacyPseudo3D, true);
  assert.equal(state.hands.right.legacyPseudo3D, true);
  // Opening it changes nothing about how it draws.
  assert.equal(state.hands.left.sprites, undefined);
  assert.ok(state.shapeKeys.some((key) => key.target === handPartId('left', 'palm')));
});

test('a mascot with no facing axis is not a legacy hand, only a hand', () => {
  const state = createProjectDocument({ ...pairedMascot(), params: {} });
  // Nothing to say, so nothing is said: the record is the one it always was.
  assert.equal(state.hands.left.legacyPseudo3D, undefined);
  assert.equal(isLegacyPseudo3DHand(state, 'left'), false);
});

test('converting gives the hand five drawings, inside its own group', () => {
  const state = pairedMascot();
  const { ok, frame } = convert(state);
  assert.equal(ok, true);
  const sprites = state.hands.left.sprites;
  assert.equal(sprites.drawings.length, 5);
  assert.deepEqual(sprites.drawings.map((drawing) => drawing.view), [...HAND_SPRITE_VIEWS]);
  assert.deepEqual(sprites.pivot, [frame.at.x, frame.at.y]);
  for (const drawing of sprites.drawings) {
    // The markup hides four of five so a page does not flash them all before
    // the first frame; the rig must not keep that, or the runtime's answer
    // would be multiplied away.
    assert.equal(state.elements[drawing.element].baseOpacity, 1, `${drawing.view} is the runtime's to show`);
    assert.equal(state.elements[drawing.element].baseTransform.rotation, 0, 'a drawing rides inside the group, carrying nothing');
    assert.equal(state.elements[drawing.element].baseTransform.scaleX, 1);
    assert.deepEqual([state.elements[drawing.element].baseTransform.pivotX, state.elements[drawing.element].baseTransform.pivotY], [frame.at.x, frame.at.y]);
  }
  // The group keeps its own tilt and size: the hand is where it always was.
  assert.equal(state.elements.handLeft.baseTransform.rotation, 200);
});

test('converting creates the three parameters a 2D hand reads, and no more', () => {
  const state = pairedMascot();
  convert(state);
  for (const name of ['handLPose', 'handLView', 'handLFacing']) assert.ok(state.params[name], name);
  assert.equal(state.params.handLView.max, 4);
  assert.equal(state.params.handLView.default, 2, 'the front');
  assert.equal(state.params.handLPose.max, 0, 'one pose is drawn');
  assert.equal(state.params.handRPose, undefined, 'the other hand is untouched');
  for (const stored of Object.values(state.states)) assert.equal(stored.handLView, 2);
});

test('retiring the deformation hides the parts and drops what was measured on them', () => {
  const state = pairedMascot();
  convert(state);
  const before = state.shapeKeys.length;
  assert.ok(before > 0);
  assert.equal(removeLegacyHandDeformation(state, 'left'), true);
  const parts = new Set(legacyHandPartIds(state, 'left'));
  assert.equal(state.shapeKeys.some((key) => parts.has(key.target)), false);
  assert.equal(state.keyforms.some((keyform) => parts.has(keyform.target?.id)), false);
  for (const id of parts) {
    assert.equal(state.elements[id].baseOpacity, 0, `${id} is hidden`);
    assert.equal(state.layerMetadata[id].visible, false);
  }
  // ...and the other hand still deforms, untouched.
  assert.ok(state.shapeKeys.some((key) => key.target === handPartId('right', 'palm')));
  // The keys on the group stay: coming out from behind the head is the whole hand moving.
  assert.ok(state.keyforms.some((keyform) => keyform.target?.id === 'handLeft'));
});

test('no pose grid is left pointing at a shape key that has gone', () => {
  const state = pairedMascot();
  convert(state);
  removeLegacyHandDeformation(state, 'left');
  const live = new Set(state.shapeKeys.map((key) => key.id));
  for (const keyform of state.keyforms) {
    if (keyform.channel === 'pathShape') assert.ok(live.has(keyform.shapeKey), keyform.id);
  }
  assert.deepEqual(validateRig(state).filter((issue) => /hand/i.test(issue)), []);
});

test('an old pose parameter becomes a choice of drawing', () => {
  const state = pairedMascot();
  convert(state, 'left', { poses: ['relaxed', 'fist', 'point'] });
  const map = handPoseParameterMap(state, 'left');
  assert.equal(map.get('handLFist'), 1);
  assert.equal(map.get('handLPoint'), 2);
  // A pose with no drawing and no honest stand-in is left out rather than guessed at.
  assert.equal(map.has('handLOk'), false);
  assert.equal(migratedHandPose('relax'), 'relaxed');
  assert.equal(migratedHandPose('spread'), 'open');
  assert.equal(migratedHandPose('ok'), null);
});

test('a mascot that waved still waves: the clips, expressions and states are renamed', () => {
  const state = pairedMascot();
  state.animationClips.push({ id: 'fist-shake', name: 'Fist', duration: 1, tracks: {
    handLFist: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }, { time: 1, value: 0 }],
    handLRotation: [{ time: 0, value: 0 }, { time: 1, value: 1 }]
  } });
  state.expressions.push({ id: 'angry', name: 'Angry', controls: { handLFist: 1, mouthOpen: 0.2 } });
  state.states.idle = { ...state.states.idle, handLFist: 1 };
  convert(state, 'left', { poses: ['relaxed', 'fist'] });
  assert.equal(retireHandDeformation(state, 'left'), true);
  const clip = state.animationClips.find((item) => item.id === 'fist-shake');
  assert.equal(clip.tracks.handLFist, undefined);
  assert.deepEqual(clip.tracks.handLPose.map((key) => key.value), [0, 1, 0]);
  assert.deepEqual(clip.tracks.handLPose.map((key) => key.easing), ['step', 'step', 'step'], 'a pose is chosen, never blended halfway into');
  assert.ok(clip.tracks.handLRotation, 'what moved the hand is untouched');
  const expression = state.expressions.find((item) => item.id === 'angry');
  assert.equal(expression.controls.handLFist, undefined);
  assert.equal(expression.controls.handLPose, 1);
  assert.equal(expression.controls.mouthOpen, 0.2);
  assert.equal(state.states.idle.handLPose, 1);
  assert.equal(state.states.idle.handLFist, undefined);
  assert.equal(state.params.handLFist, undefined, 'the parameter goes once nothing names it');
  assert.deepEqual(validateRig(state).filter((issue) => /hand/i.test(issue)), []);
});

test('a raised pose that stays down is rewritten to the resting pose, not to itself', () => {
  const state = pairedMascot();
  state.animationClips.push({ id: 'c', name: 'c', duration: 1, tracks: { handLFist: [{ time: 0, value: 0.2 }, { time: 1, value: 0.9 }] } });
  convert(state, 'left', { poses: ['relaxed', 'fist'] });
  migrateHandPoseParameters(state, 'left');
  assert.deepEqual(state.animationClips.find((item) => item.id === 'c').tracks.handLPose.map((key) => key.value), [0, 1]);
});

test('a pose parameter something else still reads is kept, not tidied away', () => {
  const state = pairedMascot();
  state.elements.faceRoot.bindings = { rotation: { expression: 'handLFist * 10', enabled: true } };
  convert(state, 'left', { poses: ['relaxed', 'fist'] });
  retireHandDeformation(state, 'left');
  assert.ok(state.params.handLFist, 'a binding still names it');
  assert.equal(state.params.handLPoint, undefined, 'nothing names this one');
  assert.equal(parameterIsUsed(state, 'handLFist'), true);
  assert.equal(parameterIsUsed(state, 'nothing-at-all'), false);
  assert.equal(parameterIsUsed(state, ''), false);
});

test('the command converts one hand in one undo, and the project stays valid', () => {
  const state = pairedMascot();
  const store = createEditorStore(state);
  const history = createHistory(store);
  const frame = handSpriteFrame(store.getDocument(), 'left', () => null);
  const artwork = structuredClone(store.getDocument());
  appended(artwork, handSpritesMarkup(artwork, 'left', { frame }));
  assert.equal(addHandSpritesCommand(store, history, 'left', artwork, { frame }), true);
  const after = store.getDocument();
  assert.equal(hasHandSprites(after, 'left'), true);
  assert.equal(hasHandSprites(after, 'right'), false);
  assert.equal(after.elements[handPartId('left', 'palm')].baseOpacity, 0);
  assert.equal(after.elements[handPartId('right', 'palm')].baseOpacity, 1);
  assert.deepEqual(validateRig(after).filter((issue) => /hand/i.test(issue)), []);
  history.undo();
  assert.equal(hasHandSprites(store.getDocument(), 'left'), false);
  assert.equal(store.getDocument().elements[handPartId('left', 'palm')].baseOpacity, 1);
});

test('a converted hand draws one of its drawings and keeps every movement it had', () => {
  const state = pairedMascot();
  convert(state);
  removeLegacyHandDeformation(state, 'left');
  const document = createProjectDocument(state);
  const sprites = createHandSprites(document.hands);
  const values = { ...Object.fromEntries(Object.entries(document.params).map(([name, item]) => [name, item.default])), handLX: 0.6, handLView: 4, handLShow: 1 };
  const compiled = compileRigFrame(document.elements, values, {}, {}, { hands: document.hands, handSprites: sprites, delta: 1, keyforms: document.keyforms, shapeKeys: document.shapeKeys });
  assert.ok(compiled.handLeft.transform.x !== 0, 'the reach still moves it');
  assert.equal(compiled.handLeft.handView, 'sideRight');
  const shown = handSpriteElementId('left', 'relaxed', 'sideRight');
  assert.ok(compiled[shown].opacity > 0);
  assert.equal(compiled[handSpriteElementId('left', 'relaxed', 'front')].opacity, 0);
  // The parts it used to deform draw nothing at all.
  assert.equal(compiled[handPartId('left', 'palm')].opacity, 0);
});

test('converting refuses a hand that has no artwork, and one that is already converted', () => {
  const state = pairedMascot();
  assert.equal(installHandSprites(state, 'left', { frame: null }), false);
  assert.equal(installHandSprites({ hands: {} }, 'left', { frame: { at: { x: 0, y: 0 }, scale: 1 } }), false);
  convert(state);
  assert.equal(hasHandSprites(state, 'left'), true);
  assert.equal(handSpritesMarkup(state, 'left', { frame: null }), '');
});

/* ── A pair that never deforms (PHASES 11, 25) ─────────────────────────────── */

test('a new pair is drawings from the start: no parts, no shape keys, no facing keys', () => {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g></svg>';
  state.elements = { faceRoot: element('g') };
  state.states = { idle: {} };
  state.activeState = 'idle';
  appended(state, spriteHandsMarkup(state, {}));
  assert.equal(installSpriteHands(state, {}), true);
  for (const side of ['left', 'right']) {
    assert.equal(hasHandSprites(state, side), true, side);
    assert.equal(state.hands[side].sprites.drawings.length, 5, `${side}: the five views of the hand it rests in`);
    assert.equal(legacyHandPartIds(state, side).length, 0, `${side} has no parts to deform`);
    assert.equal(state.hands[side].poses.length, 0, `${side} poses by drawing`);
  }
  assert.deepEqual(state.shapeKeys, [], 'nothing deforms, so nothing is measured');
  assert.equal(state.keyforms.some((keyform) => /-facing-/.test(keyform.id)), false);
  // ...and what makes a hand a floating hand is all still there.
  assert.ok(state.keyforms.some((keyform) => keyform.id === 'handLeft-show-depth'), 'it still rests behind the head');
  assert.equal(state.elements.handLeft.baseTransform.rotation, 200, 'fingers down, thumb inwards');
  assert.ok(state.params.handLX && state.params.handLRotation && state.params.handLShow);
  assert.ok(state.animationClips.some((clip) => clip.id === 'hand-wave'), 'a wave is a rotation, and comes with the pair');
  assert.deepEqual(validateRig(state).filter((issue) => /hand/i.test(issue)), []);
});

test('a drawn pair moves, turns and swaps, all from its own group', () => {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g></svg>';
  state.elements = { faceRoot: element('g') };
  state.states = { idle: {} };
  appended(state, spriteHandsMarkup(state, {}));
  installSpriteHands(state, {});
  const document = createProjectDocument(state);
  const sprites = createHandSprites(document.hands);
  const values = { ...Object.fromEntries(Object.entries(document.params).map(([name, item]) => [name, item.default])), handLShow: 1, handRShow: 1, handLX: 1, handLView: 0, handRView: 4 };
  const compiled = compileRigFrame(document.elements, values, {}, {}, { hands: document.hands, handSprites: sprites, delta: 1, keyforms: document.keyforms, shapeKeys: document.shapeKeys });
  assert.ok(compiled.handLeft.transform.x !== 0);
  assert.equal(compiled.handLeft.handView, 'sideLeft');
  assert.equal(compiled.handRight.handView, 'sideRight');
  assert.ok(compiled[handSpriteElementId('left', 'relaxed', 'sideLeft')].opacity > 0);
  assert.equal(compiled[handSpriteElementId('left', 'relaxed', 'front')].opacity, 0);
  assert.ok(compiled[handSpriteElementId('right', 'relaxed', 'sideRight')].opacity > 0);
});

test('drawing a pair over one that exists is refused rather than colliding', () => {
  const state = pairedMascot();
  const store = createEditorStore(state);
  assert.equal(addSpriteHandsCommand(store, createHistory(store), structuredClone(state), {}), false);
});

/* ── Adding a hand the set has not got (docs/HANDS_2D.md) ──────────────────── */

test('a pose the set does not draw yet is offered, and drawn on request', () => {
  const state = pairedMascot();
  convert(state);
  assert.deepEqual(handSetPoses(state, 'left').filter((item) => item.drawn).map((item) => item.id), ['relaxed']);
  const frame = handSpriteFrame(state, 'left', () => null);
  const markup = handPoseMarkup(state, 'left', 'fist', { frame });
  assert.ok(markup.includes(handSpriteElementId('left', 'fist', 'front')));
  assert.equal((markup.match(/<g id="handLeftDraw-fist-/g) || []).length, 5, 'all five views at once');
  appended(state, markup);
  assert.equal(addHandSpritePose(state, 'left', 'fist', { frame }), true);
  assert.deepEqual([...new Set(state.hands.left.sprites.drawings.map((drawing) => drawing.pose))], ['relaxed', 'fist']);
  assert.equal(state.hands.left.sprites.drawings.length, 10);
  // The range follows the list: an index into it is only as good as the list.
  assert.equal(state.params.handLPose.max, 1);
  assert.equal(handPoseIndex(state, 'left', 'fist'), 1);
  assert.deepEqual(validateRig(state).filter((issue) => /hand/i.test(issue)), []);
});

test('the drawings stay in the catalogue\'s order, whatever order they were added in', () => {
  const state = pairedMascot();
  convert(state);
  const frame = handSpriteFrame(state, 'left', () => null);
  for (const pose of ['peace', 'fist']) {
    appended(state, handPoseMarkup(state, 'left', pose, { frame }));
    addHandSpritePose(state, 'left', pose, { frame });
  }
  assert.deepEqual([...new Set(state.hands.left.sprites.drawings.map((drawing) => drawing.pose))], ['relaxed', 'fist', 'peace']);
});

test('a pose the hand already draws is drawn once, not twice', () => {
  const state = pairedMascot();
  convert(state);
  const frame = handSpriteFrame(state, 'left', () => null);
  assert.equal(handPoseMarkup(state, 'left', 'relaxed', { frame }), '', 'nothing to add');
  assert.equal(handPoseMarkup(state, 'left', 'nonsense', { frame }), '');
  assert.equal(handPoseMarkup(state, 'left', 'fist', { frame: null }), '');
  assert.equal(addHandSpritePose(state, 'left', 'fist', { frame: null }), false);
  assert.equal(state.hands.left.sprites.drawings.length, 5);
});

test('adding a hand is one document revision, and one undo', () => {
  const state = pairedMascot();
  convert(state);
  const store = createEditorStore(createProjectDocument(state));
  const history = createHistory(store);
  const frame = handSpriteFrame(store.getDocument(), 'left', () => null);
  const artwork = structuredClone(store.getDocument());
  appended(artwork, handPoseMarkup(artwork, 'left', 'point', { frame }));
  assert.equal(addHandPoseCommand(store, history, 'left', 'point', artwork, { frame }), true);
  assert.equal(handPoseIndex(store.getDocument(), 'left', 'point'), 1);
  assert.equal(store.getDocument().params.handLPose.max, 1);
  history.undo();
  assert.equal(handPoseIndex(store.getDocument(), 'left', 'point'), -1);
  assert.equal(store.getDocument().params.handLPose.max, 0);
  // A hand with no drawings has nothing to add one to.
  assert.equal(addHandPoseCommand(store, history, 'right', 'point', artwork, { frame }), false);
});
