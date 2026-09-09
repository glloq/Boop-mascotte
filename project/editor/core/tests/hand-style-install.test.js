import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createProjectDocument } from '../state/project-document.js';
import { validateRig } from '../validation/rig-validator.js';
import { HAND_STYLE_IDS, handElementId, handStyleElementId } from '../hands/hand-style-art.js';
import { HAND_WAVE_CLIP, handShowParameter } from '../sample/hand-feature.js';
import {
  addHandStyle, addHandStyleCommand, addHandStylesCommand, addStyleHandsCommand, handAnimParameter,
  handPoseParameterMap, handStyleFrame, handStyleIndex, handStyleMarkupFor, handStyleOffers, handStyleParameter,
  handStylesMarkup, hasHandStyles, installHandStyles, installStyleHands, isLegacyPseudo3DHand, legacyHandPartIds,
  migrateHandPoseParameters, migratedHandPose, neutralizeHandAnimation, parameterIsUsed,
  removeLegacyHandDeformation, retireHandDeformation, styleHandsMarkup
} from '../hands/hand-style-install.js';
import { compileRigFrame, createHandStyleSwaps, normalizeHands } from '../../../runtime/runtime.js';

/**
 * Giving a hand its drawings, and converting one that still deforms
 * (docs/HAND_STYLES.md).
 *
 * What matters is that a project survives it: the mascot goes on waving, the
 * hand goes on moving, and nothing that used to deform is left half-wired.
 */
const element = (nodeType = 'path', d = '') => ({
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1,
  constraints: { translate: true, rotate: true, scale: true }, bindings: {},
  meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d }
});
const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

/** What the canvas does with appended markup: a rig record for every node with an id. */
function appended(state, markup) {
  state.svgMarkup = state.svgMarkup.replace('</svg>', `${markup}</svg>`);
  for (const match of markup.matchAll(/<(g|path) id="([^"]+)"/g)) state.elements[match[2]] ||= element(match[1]);
  return state;
}

/** A mascot with a pair of hands made of drawings from the start. */
function drawnMascot() {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g></svg>';
  state.elements = { faceRoot: element('g') };
  state.states = { idle: {} };
  state.activeState = 'idle';
  appended(state, styleHandsMarkup(state));
  assert.equal(installStyleHands(state), true);
  return state;
}

/**
 * A mascot as a file written **before** the refit carries one: six parts a
 * side, a pose per gesture, per-digit curls and the pseudo-3D facing axis.
 *
 * Written out rather than generated, because the generator that made these is
 * gone: this is the shape of the old save, and the point of the fixture is
 * that opening it still works.
 */
const LEGACY_PARTS = ['palm', 'ring', 'middle', 'index', 'thumb', 'cuff'];
const legacyPartId = (side, part) => `${handElementId(side)}${part.charAt(0).toUpperCase()}${part.slice(1)}`;
function legacyMascot() {
  const state = createCleanProjectState();
  const ids = [];
  for (const side of ['left', 'right']) ids.push(handElementId(side), ...LEGACY_PARTS.map((part) => legacyPartId(side, part)));
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g>${ids
    .map((id) => (id.endsWith('Left') || id.endsWith('Right') ? `<g id="${id}"></g>` : `<path id="${id}" d="M0 0"/>`)).join('')}</svg>`;
  state.elements = { faceRoot: element('g') };
  state.states = { idle: {} };
  state.activeState = 'idle';
  state.hands = {};
  for (const side of ['left', 'right']) {
    const letter = side === 'right' ? 'R' : 'L';
    const group = handElementId(side);
    state.elements[group] = element('g');
    for (const part of LEGACY_PARTS) state.elements[legacyPartId(side, part)] = { ...element('path', 'M0 0'), restPath: 'M0 0 L1 1' };
    state.hands[side] = {
      element: group, parent: 'faceRoot', anchor: { x: side === 'left' ? 48 : 192, y: 192 },
      reach: { x: 38, y: 40, rotation: 180, scale: 0.25 },
      // What an older file calls a pose: a parameter that deformed the parts.
      poses: [
        { id: 'fist', name: 'Fist', parameter: `hand${letter}Fist`, shapeKey: `${group}-fist-palm` },
        { id: 'spread', name: 'Spread', parameter: `hand${letter}Spread`, shapeKey: `${group}-spread-palm` },
        { id: 'ok', name: 'OK', parameter: `hand${letter}Ok`, shapeKey: `${group}-ok-palm` }
      ]
    };
    Object.assign(state.params, {
      [`hand${letter}X`]: number(-1, 1), [`hand${letter}Y`]: number(-1, 1),
      [`hand${letter}Rotation`]: number(-1, 1), [`hand${letter}Scale`]: number(-1, 1), [`hand${letter}Depth`]: number(-1, 1),
      [`hand${letter}Fist`]: number(0, 1), [`hand${letter}Spread`]: number(0, 1), [`hand${letter}Ok`]: number(0, 1),
      // The pseudo-3D turn, the group control and the per-digit curls.
      [`hand${letter}Facing`]: number(-1, 1), [`hand${letter}Grip`]: number(0, 1),
      [`hand${letter}Index`]: number(0, 1), [`hand${letter}Thumb`]: number(0, 1),
      // A drawing's own little animation (docs/HAND_STYLES.md, "Deprecated fields").
      [`hand${letter}Anim`]: number(0, 1)
    });
    for (const pose of state.hands[side].poses) {
      state.shapeKeys.push({ id: pose.shapeKey, target: legacyPartId(side, 'palm'), name: pose.name, driver: { mode: 'range', parameter: pose.parameter, min: 0, max: 1 }, delta: {} });
    }
    state.shapeKeys.push({ id: `${group}-facing-near-palm`, target: legacyPartId(side, 'palm'), name: 'Side', driver: null, delta: {} });
    state.keyforms.push({
      id: `${group}-facing-near-palm-kf`, target: { kind: 'element', id: legacyPartId(side, 'palm') },
      channel: 'pathShape', shapeKey: `${group}-facing-near-palm`,
      axes: [{ parameter: `hand${letter}Facing`, values: [-1, 0, 1] }],
      keyforms: [{ at: [0], value: 0 }, { at: [1], value: 0 }, { at: [2], value: 1 }]
    });
    // And the keys a drawing's own animation used to be played by.
    state.shapeKeys.push({ id: `${group}Draw-palmOpen-anim-palm`, target: legacyPartId(side, 'palm'), name: 'Close', driver: { mode: 'range', parameter: `hand${letter}Anim`, min: 0, max: 1 }, delta: {} });
  }
  for (const name of Object.keys(state.params)) state.states.idle[name] = 0;
  return state;
}

const measured = () => ({ x: 0, y: 0, width: 80, height: 80 });
const convert = (state, side = 'left', options = {}) => {
  const frame = handStyleFrame(state, side, measured);
  appended(state, handStylesMarkup(state, side, { frame, ...options }));
  return { frame, ok: installHandStyles(state, side, { frame, ...options }) };
};

/* ── A pair drawn as drawings from the start ───────────────────────────────── */

test('a drawn pair has a library, a style parameter and no deformation at all', () => {
  const state = drawnMascot();
  for (const side of ['left', 'right']) {
    assert.equal(hasHandStyles(state, side), true);
    const hand = state.hands[side];
    assert.deepEqual(hand.styles.library.map((entry) => entry.id), [...HAND_STYLE_IDS]);
    assert.equal(hand.styles.showing, 'relaxed');
    assert.equal(hand.parameters.style, handStyleParameter(side));
    assert.equal(hand.parameters.anim, undefined, 'no drawing has an animation of its own');
    assert.equal(hand.poses.length, 0);
    const parameter = state.params[handStyleParameter(side)];
    assert.deepEqual([parameter.min, parameter.max], [0, HAND_STYLE_IDS.length - 1]);
    assert.deepEqual(parameter.options, [...HAND_STYLE_IDS], 'the parameter names its choices');
  }
  // Nothing anywhere deforms a hand.
  const owned = new Set(['left', 'right'].flatMap((side) => state.hands[side].styles.library.map((entry) => entry.element)));
  for (const key of state.shapeKeys) assert.ok(!owned.has(key.target) && !/^hand(Left|Right)/.test(key.target || ''), `${key.id} deforms ${key.target}`);
  assert.equal(state.params.handLAnim, undefined);
  assert.equal(state.params.handLFacing, undefined);
  assert.equal(state.params.handLGrip, undefined);
  assert.deepEqual(validateRig(state).filter((issue) => /hand/i.test(issue)), []);
});

test('every drawing sits exactly where the hand is, and carries no transform of its own', () => {
  const state = drawnMascot();
  const hand = state.hands.left;
  const base = state.elements[hand.element].baseTransform;
  for (const entry of hand.styles.library) {
    const drawing = state.elements[entry.element].baseTransform;
    assert.deepEqual([drawing.x, drawing.y, drawing.rotation, drawing.scaleX, drawing.scaleY], [0, 0, 0, 1, 1]);
    assert.deepEqual([drawing.pivotX, drawing.pivotY], [base.pivotX, base.pivotY], 'one pivot for the hand and all of its drawings');
    assert.equal(state.elements[entry.element].baseOpacity, 1, 'which drawing is showing is the runtime’s answer, not the markup’s');
  }
});

test('the pair comes with a wave that turns an open hand and never deforms it', () => {
  const state = drawnMascot();
  const wave = state.animationClips.find((clip) => clip.id === HAND_WAVE_CLIP.id);
  assert.ok(wave, 'the pair brings its Wave');
  assert.ok(wave.tracks.handLRotation, 'a wave is a rotation');
  assert.ok(wave.tracks[handShowParameter('left')], 'and comes out from behind the head to do it');
  const style = wave.tracks[handStyleParameter('left')];
  assert.ok(style, 'and opening the hand to do it');
  assert.deepEqual([...new Set(style.map((key) => key.easing))], ['step'], 'a style is stepped, never blended');
  // Swapped where nobody can see it: the drawing changes as the hand comes out
  // from behind the head, and changes back once it is away again
  // (docs/HAND_STYLES.md, "Changing style mid-animation").
  const show = wave.tracks[handShowParameter('left')];
  const rest = handStyleIndex(state, 'left', 'relaxed'), open = handStyleIndex(state, 'left', 'open');
  assert.deepEqual(style.map((key) => key.value), [rest, open, rest]);
  assert.equal(style[0].time, 0, 'it rests on its own drawing until it is asked out');
  assert.equal(style[1].time, show.find((key) => key.value >= 0.5).time, 'and opens exactly as it comes out');
  assert.equal(style.at(-1).time, [...show].reverse().find((key) => key.value < 0.5 && key.time > 0).time);
});

test('a drawn pair is not a legacy hand, and has nothing to convert', () => {
  const state = createProjectDocument(drawnMascot());
  assert.equal(isLegacyPseudo3DHand(state, 'left'), false);
  assert.equal(state.hands.left.legacyPseudo3D, undefined);
  assert.deepEqual(legacyHandPartIds(state, 'left'), []);
});

/* ── PHASE 31: an old save still opens ─────────────────────────────────────── */

test('a project written before the refit loads, and is marked rather than converted', () => {
  const state = createProjectDocument(legacyMascot());
  assert.equal(hasHandStyles(state, 'left'), false);
  assert.equal(isLegacyPseudo3DHand(state, 'left'), true);
  assert.equal(state.hands.left.legacyPseudo3D, true);
  assert.equal(state.hands.right.legacyPseudo3D, true);
  // It still moves: the parameters that place a hand are untouched.
  assert.equal(state.hands.left.parameters.x, 'handLX');
  assert.equal(state.hands.left.parameters.style, undefined, 'until it is given drawings');
  assert.equal(state.hands.left.parameters.anim, undefined, 'and never an animation of its own');
  // Nothing is thrown away on the way in: the old poses are still readable, so
  // the migration below has something to map.
  assert.deepEqual(state.hands.left.poses.map((pose) => pose.id), ['fist', 'spread', 'ok']);
  assert.equal(state.hands.left.poses[0].shapeKey, undefined, 'a pose deforms nothing any more');
  assert.equal(legacyHandPartIds(state, 'left').length, 6);
});

test('an old hand shows drawings the moment it is given some', () => {
  const state = legacyMascot();
  assert.equal(convert(state, 'left').ok, true);
  assert.equal(hasHandStyles(state, 'left'), true);
  assert.equal(hasHandStyles(state, 'right'), false, 'one hand at a time: the two are independent');
  const hands = normalizeHands(state);
  const swaps = createHandStyleSwaps(hands);
  const frame = compileRigFrame(state.elements, { handLStyle: 2 }, {}, {}, { hands, handStyles: swaps, shapeKeys: state.shapeKeys, keyforms: state.keyforms });
  assert.equal(frame[handStyleElementId('left', 'fist')].opacity, 1);
  assert.equal(frame[handStyleElementId('left', 'relaxed')].opacity, 0);
});

/* ── PHASE 32/33: what the old fields become ───────────────────────────────── */

test('an old pose id maps onto the nearest style, or onto none at all', () => {
  assert.equal(migratedHandPose('relax'), 'relaxed');
  assert.equal(migratedHandPose('spread'), 'open');
  assert.equal(migratedHandPose('fist'), 'fist');
  assert.equal(migratedHandPose('palmOpen'), 'open', 'and so does an old drawing id');
  assert.equal(migratedHandPose('ok'), null, 'a pose with no honest stand-in is left out rather than guessed at');
});

test('an old pose parameter becomes a choice of drawing', () => {
  const state = legacyMascot();
  convert(state);
  const map = handPoseParameterMap(state, 'left');
  assert.equal(map.get('handLFist'), HAND_STYLE_IDS.indexOf('fist'));
  assert.equal(map.get('handLSpread'), HAND_STYLE_IDS.indexOf('open'));
  assert.equal(map.has('handLOk'), false);
});

test('a mascot that waved still waves: the clips, expressions and states are renamed', () => {
  const state = legacyMascot();
  state.animationClips.push({ id: 'fist-shake', name: 'Fist', duration: 1, tracks: {
    handLFist: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }, { time: 1, value: 0 }],
    handLRotation: [{ time: 0, value: 0 }, { time: 1, value: 1 }]
  } });
  state.expressions.push({ id: 'angry', name: 'Angry', controls: { handLFist: 1, mouthOpen: 0.2 } });
  state.states.idle = { ...state.states.idle, handLFist: 1 };
  convert(state);
  assert.equal(retireHandDeformation(state, 'left'), true);
  const fist = HAND_STYLE_IDS.indexOf('fist'), rest = HAND_STYLE_IDS.indexOf('relaxed');
  const clip = state.animationClips.find((item) => item.id === 'fist-shake');
  assert.equal(clip.tracks.handLFist, undefined);
  assert.deepEqual(clip.tracks.handLStyle.map((key) => key.value), [rest, fist, rest]);
  assert.deepEqual(clip.tracks.handLStyle.map((key) => key.easing), ['step', 'step', 'step'], 'a drawing is chosen, never blended halfway into');
  assert.ok(clip.tracks.handLRotation, 'what moved the hand is untouched');
  const expression = state.expressions.find((item) => item.id === 'angry');
  assert.equal(expression.controls.handLFist, undefined);
  assert.equal(expression.controls.handLStyle, fist);
  assert.equal(expression.controls.mouthOpen, 0.2);
  assert.equal(state.states.idle.handLStyle, fist);
  assert.equal(state.states.idle.handLFist, undefined);
  assert.equal(state.params.handLFist, undefined, 'the parameter goes once nothing names it');
  assert.deepEqual(validateRig(state).filter((issue) => /hand/i.test(issue)), []);
});

test('a raised pose that stays down is rewritten to the resting drawing, not to itself', () => {
  const state = legacyMascot();
  state.animationClips.push({ id: 'c', name: 'c', duration: 1, tracks: { handLFist: [{ time: 0, value: 0.2 }, { time: 1, value: 0.9 }] } });
  convert(state);
  migrateHandPoseParameters(state, 'left');
  assert.deepEqual(state.animationClips.find((item) => item.id === 'c').tracks.handLStyle.map((key) => key.value),
    [HAND_STYLE_IDS.indexOf('relaxed'), HAND_STYLE_IDS.indexOf('fist')]);
});

/* ── PHASE 7/33: handLAnim and handRAnim are neutralised ───────────────────── */

test('a drawing’s own animation is taken off the hand, on either side', () => {
  const state = legacyMascot();
  state.animationClips.push({ id: 'close', name: 'Close', duration: 1, tracks: {
    handLAnim: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
    handRAnim: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
    handLY: [{ time: 0, value: 0 }, { time: 1, value: -1 }]
  } });
  state.expressions.push({ id: 'grab', name: 'Grab', controls: { handLAnim: 1, handRAnim: 0.5, handLScale: 0.2 } });
  state.states.idle.handLAnim = 1;
  state.states.idle.handRAnim = 1;
  for (const side of ['left', 'right']) {
    convert(state, side);
    assert.equal(neutralizeHandAnimation(state, side), true);
  }
  const clip = state.animationClips.find((item) => item.id === 'close');
  for (const side of ['left', 'right']) {
    const parameter = handAnimParameter(side);
    assert.equal(state.params[parameter], undefined, `${parameter} is gone`);
    assert.equal(state.states.idle[parameter], undefined, 'and so is its stored value');
    assert.equal(clip.tracks[parameter], undefined, 'and the track that played it');
    assert.equal(state.expressions.find((item) => item.id === 'grab').controls[parameter], undefined);
    assert.equal(state.shapeKeys.some((key) => key.driver?.parameter === parameter), false, 'and every key it drove');
  }
  assert.ok(clip.tracks.handLY, 'what moved the hand is untouched');
  assert.equal(state.expressions.find((item) => item.id === 'grab').controls.handLScale, 0.2);
  // Neutralising twice is a no-op, and an old value in a loaded file is simply ignored.
  assert.equal(neutralizeHandAnimation(state, 'left'), false);
  const reloaded = createProjectDocument({ ...state, states: { idle: { ...state.states.idle, handLAnim: 1, handRAnim: 1 } } });
  assert.equal(reloaded.hands.left.parameters.anim, undefined);
  assert.deepEqual(validateRig(reloaded).filter((issue) => /hand/i.test(issue)), []);
});

/* ── PHASE 43: retiring the deformation ────────────────────────────────────── */

test('the parts are hidden rather than deleted, and every key measured on them goes', () => {
  const state = legacyMascot();
  convert(state);
  assert.equal(removeLegacyHandDeformation(state, 'left'), true);
  for (const id of legacyHandPartIds(state, 'left')) {
    assert.ok(state.elements[id], `${id} is still there to be brought back`);
    assert.equal(state.elements[id].baseOpacity, 0);
    assert.equal(state.layerMetadata[id].visible, false);
    assert.equal(state.shapeKeys.some((key) => key.target === id), false, `${id} deforms nothing`);
  }
  assert.equal(state.hands.left.poses.length, 0, 'a pose that moves nothing is not a pose');
  // The keys on the group stay: coming out from behind the head is the whole hand moving.
  const live = new Set(state.shapeKeys.map((key) => key.id));
  for (const keyform of state.keyforms) {
    if (keyform.channel === 'pathShape') assert.ok(live.has(keyform.shapeKey), keyform.id);
  }
  // And the other hand is untouched: converting one never reaches the other.
  assert.equal(state.shapeKeys.some((key) => key.target === legacyPartId('right', 'palm')), true);
});

test('retiring drops the whole pseudo-3D rig, and only what nothing else names', () => {
  const state = legacyMascot();
  // An author's own binding on a pose parameter is a use like any other.
  state.elements.faceRoot.bindings = { rotation: { enabled: true, mode: 'simple', expression: 'handLOk' } };
  convert(state);
  retireHandDeformation(state, 'left');
  for (const gone of ['handLFacing', 'handLGrip', 'handLIndex', 'handLThumb', 'handLAnim', 'handLFist', 'handLSpread']) {
    assert.equal(state.params[gone], undefined, `${gone} is retired`);
  }
  assert.equal(parameterIsUsed(state, 'handLOk'), true);
  assert.ok(state.params.handLOk, 'a parameter an author still drives is left standing');
  for (const kept of ['handRFacing', 'handRGrip', 'handRFist']) assert.ok(state.params[kept], `${kept} is the other hand’s`);
  assert.ok(state.params.handLX && state.params.handLRotation, 'and the hand still moves');
});

/* ── Adding one drawing to a hand ──────────────────────────────────────────── */

test('a hand can be drawn with some of the library, and given more later', () => {
  const state = legacyMascot();
  convert(state, 'left', { styles: ['relaxed', 'open'] });
  assert.deepEqual(state.hands.left.styles.library.map((entry) => entry.id), ['relaxed', 'open']);
  assert.deepEqual(handStyleOffers(state, 'left').filter((item) => !item.drawn).map((item) => item.id), ['fist', 'point', 'thumbsUp', 'peace']);
  const frame = handStyleFrame(state, 'left', measured);
  appended(state, handStyleMarkupFor(state, 'left', 'fist', { frame }));
  assert.equal(addHandStyle(state, 'left', 'fist', { frame }), true);
  // Rebuilt over the union, so the library stays in the registry's order and
  // the parameter's range is exactly the count of what is drawn.
  assert.deepEqual(state.hands.left.styles.library.map((entry) => entry.id), ['relaxed', 'open', 'fist']);
  assert.equal(state.params.handLStyle.max, 2);
  assert.deepEqual(state.params.handLStyle.options, ['relaxed', 'open', 'fist']);
  assert.equal(handStyleIndex(state, 'left', 'fist'), 2);
  assert.equal(handStyleMarkupFor(state, 'left', 'fist', { frame }), '', 'a drawing it already has is not drawn twice');
});

/* ── The commands, as one undo step each ───────────────────────────────────── */

const storeFor = (state) => {
  const store = createEditorStore(state);
  return { store, history: createHistory(store) };
};

test('drawing a pair, converting a hand and adding a drawing are each one revision', () => {
  const blank = createCleanProjectState();
  blank.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g></svg>';
  blank.elements = { faceRoot: element('g') };
  blank.states = { idle: {} };
  blank.activeState = 'idle';
  const { store, history } = storeFor(blank);
  const artwork = appended(structuredClone(blank), styleHandsMarkup(blank));
  assert.equal(addStyleHandsCommand(store, history, artwork), true);
  assert.equal(hasHandStyles(store.getDocument(), 'left'), true);
  assert.equal(addStyleHandsCommand(store, history, artwork), false, 'a mascot with hands is not given a second pair');
  history.undo();
  assert.equal(store.getDocument().hands?.left, undefined, 'one undo takes the artwork and the rig together');

  const legacy = legacyMascot();
  const second = storeFor(legacy);
  const frame = handStyleFrame(legacy, 'left', measured);
  const converted = appended(structuredClone(legacy), handStylesMarkup(legacy, 'left', { frame }));
  assert.equal(addHandStylesCommand(second.store, second.history, 'left', converted, { frame }), true);
  assert.equal(hasHandStyles(second.store.getDocument(), 'left'), true);
  assert.equal(second.store.getDocument().params.handLFacing, undefined, 'the conversion retires the turn in the same step');
  second.history.undo();
  assert.equal(hasHandStyles(second.store.getDocument(), 'left'), false);
  assert.ok(second.store.getDocument().params.handLFacing, 'and undo brings it back');

  const partial = legacyMascot();
  convert(partial, 'left', { styles: ['relaxed'] });
  const third = storeFor(partial);
  const partialFrame = handStyleFrame(partial, 'left', measured);
  const added = appended(structuredClone(partial), handStyleMarkupFor(partial, 'left', 'peace', { frame: partialFrame }));
  assert.equal(addHandStyleCommand(third.store, third.history, 'left', 'peace', added, { frame: partialFrame }), true);
  assert.deepEqual(third.store.getDocument().hands.left.styles.library.map((entry) => entry.id), ['relaxed', 'peace']);
  assert.equal(addHandStyleCommand(third.store, third.history, 'left', 'nonsense', added, { frame: partialFrame }), false);
});
