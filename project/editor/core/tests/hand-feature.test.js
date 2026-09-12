import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import { DEFAULT_HAND_LOOK, HAND_LOOKS, handStyleIds, handElementId } from '../hands/hand-style-art.js';
import {
  HANDS_OUT_EXPRESSION, HAND_REST_TILT, HAND_WAVE_CLIP, HANDS_UP_CLIP,
  areHandsInstalled, artboardBox, handFrame, handHiddenPoint, handPlacement, handScale, handShowParameter,
  installedHandLook, isHandHidden, setHandHidden, styleIdFromName
} from '../sample/hand-feature.js';
import { installStyleHands, styleHandsMarkup } from '../hands/hand-style-install.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * Where a pair of hands goes, and how it hides (docs/HAND_RIGGING.md,
 * docs/HAND_STYLES.md).
 *
 * What a hand *looks* like is a style, and that is `hand-style-art.js`. This is
 * everything else a pair needs: the artboard, the placement, the reveal from
 * behind the head, and the two clips it comes with.
 */
const transform = () => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 });
const element = (nodeType, d = '') => ({
  baseTransform: transform(), baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {},
  meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d }
});

/** The document as it is once the canvas has appended the artwork. */
function drawn(options = {}) {
  const state = createCleanProjectState();
  const markup = styleHandsMarkup({}, options);
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g>${markup}</svg>`;
  state.elements = { faceRoot: element('g') };
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: [] }];
  for (const match of markup.matchAll(/<(g|path) id="([^"]+)"/g)) state.elements[match[2]] ||= element(match[1]);
  state.states = { idle: {} };
  state.activeState = 'idle';
  return state;
}

const value = (name, amount) => ({ [name]: { type: 'number', min: -1, max: 1, default: 0, value: amount } });
const frameOf = (state, values = {}) => compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, { shapeKeys: state.shapeKeys, keyforms: state.keyforms, hands: state.hands });

/* ── One press draws a pair ────────────────────────────────────────────────── */

test('one press draws both hands, rigs them and gives each one the whole library', () => {
  const state = drawn();
  assert.equal(installStyleHands(state), true);
  assert.equal(areHandsInstalled(state), true);
  for (const side of ['left', 'right']) {
    const hand = state.hands[side];
    assert.equal(hand.element, handElementId(side));
    assert.equal(hand.parent, 'faceRoot');
    assert.deepEqual(hand.styles.library.map((entry) => entry.id), [...handStyleIds()]);
    // Fingers down and thumbs inwards: the drawings are made fingers-up, and a
    // hand hanging beside a body is not.
    assert.equal(state.elements[hand.element].baseTransform.rotation, HAND_REST_TILT[side]);
    assert.ok(state.params[`hand${side === 'right' ? 'R' : 'L'}X`], 'and it can be moved');
  }
  // The two hands are mirror images of each other about the artboard.
  const box = artboardBox(state);
  const left = state.elements.handLeft.baseTransform, right = state.elements.handRight.baseTransform;
  assert.ok(Math.abs((box.width - left.pivotX) - right.pivotX) < 1, 'the pair is not lopsided');
  assert.deepEqual(validateRig(state), []);
});

test('the artboard grows once for the pair, and only when it has to', () => {
  const short = { svgMarkup: '<svg viewBox="0 0 240 240"></svg>' };
  assert.ok(handPlacement(short).artboard.height > 240, 'a drawing that fills its artboard gets room below it');
  const tall = { svgMarkup: '<svg viewBox="0 0 240 500"></svg>' };
  assert.equal(handPlacement(tall).artboard.height, 500, 'an artboard that already has the room is left alone');
});

test('a measured body puts the hands beside it; nothing measured puts them in the corners', () => {
  const state = { svgMarkup: '<svg viewBox="0 0 240 240"></svg>', elements: { faceRoot: element('g') } };
  const guessed = handPlacement(state);
  assert.equal(guessed.measured, false);
  assert.ok(guessed.points.left.x < 120 && guessed.points.right.x > 120);
  const measured = handPlacement(state, { measure: () => ({ x: 40, y: 20, width: 160, height: 180 }) });
  assert.equal(measured.measured, true);
  assert.ok(measured.points.left.y > 180, 'below the body it was measured against');
  assert.ok(measured.points.left.x < 120 && measured.points.right.x > 120, 'and outside it either way');
  assert.equal(measured.points.left.y, measured.points.right.y, 'level with each other');
});

test('where a hand’s drawings sit comes from its pivot, or from a measured box', () => {
  const state = drawn();
  installStyleHands(state);
  const frame = handFrame(state, 'left', () => null);
  const base = state.elements.handLeft.baseTransform;
  assert.deepEqual(frame.at, { x: base.pivotX, y: base.pivotY });
  assert.equal(frame.scale, handScale(artboardBox(state)));
  // Artwork the editor did not draw has no pivot, so the canvas measures it.
  const imported = { svgMarkup: '<svg viewBox="0 0 240 240"></svg>', elements: { blob: element('path') }, hands: { left: { element: 'blob' } } };
  assert.deepEqual(handFrame(imported, 'left', () => ({ x: 10, y: 20, width: 80, height: 80 })).at, { x: 50, y: 60 });
  assert.equal(handFrame(imported, 'left', () => null), null);
});

/* ── The look ──────────────────────────────────────────────────────────────── */

test('the look is a token: gloves by default, skin on request', () => {
  const gloves = drawn();
  assert.match(gloves.svgMarkup, new RegExp(`id="handLeftStyle-relaxed-[a-z]+"[^>]*fill="${HAND_LOOKS.glove.fill}"`));
  assert.equal(installedHandLook(gloves), 'glove');
  const skin = drawn({ look: 'skin' });
  assert.match(skin.svgMarkup, new RegExp(`fill="${HAND_LOOKS.skin.fill}"`));
  assert.equal(installedHandLook(skin), 'skin');
  // Same drawings, same layouts: only the paint differs.
  assert.equal(installStyleHands(skin), true);
  assert.deepEqual(validateRig(skin), []);
  assert.equal(installedHandLook({}), DEFAULT_HAND_LOOK);
});

test("a pair dressed in the mascot's own palette hands its look back whole", () => {
  // The template dresses its pair in the face's colours, which are neither of
  // the named looks. Read back as a name, anything drawn later came out white
  // beside a pair that was not.
  const dressed = {
    svgMarkup: '<svg viewBox="0 0 240 324"><g id="handLeftStyle-relaxed"><path id="handLeftStyle-relaxed-palm" fill="#f2c9a0" stroke="#5b3a29" stroke-width="6.2" /></g></svg>'
  };
  const look = installedHandLook(dressed);
  assert.equal(typeof look, 'object', 'a look, not a name');
  assert.equal(look.fill, '#f2c9a0');
  assert.equal(look.line, '#5b3a29');
  assert.ok(look.width > 0, 'and the authored width, back out of the drawn one');
  // A pair in one of the named looks still reports that name.
  assert.equal(installedHandLook({ svgMarkup: '<svg><g id="handLeftStyle-relaxed"><path fill="#ffffff" stroke="#1b1b1b" stroke-width="1.9" /></g></svg>' }), 'glove');
});

test("a named look is a name only when the pair is drawn in all of it", () => {
  // The template dresses its pair in the face's palette *and* the face's line
  // weight, which is heavier than any named look's. Matching on the fill alone
  // read that back as "skin" and threw the weight away -- so a drawing redrawn
  // from the set, or a gesture added later, arrived beside the pair with a
  // thinner line than the pair has.
  const at = (fill, line, width) => ({ svgMarkup: `<svg viewBox="0 0 240 324"><g id="handLeftStyle-relaxed"><path id="handLeftStyle-relaxed-palm" fill="${fill}" stroke="${line}" stroke-width="${width}" /></g></svg>` });
  const skin = HAND_LOOKS.skin;
  assert.equal(installedHandLook(at(skin.fill, skin.line, skin.width)), 'skin', 'all of it is the name');
  const heavier = installedHandLook(at(skin.fill, skin.line, 4));
  assert.equal(typeof heavier, 'object', 'the face\'s own line weight is not the skin look');
  assert.equal(heavier.fill, skin.fill);
  assert.equal(heavier.width, 4, 'and the weight comes back as the document has it');
  assert.equal(typeof installedHandLook(at(skin.fill, '#000000', skin.width)), 'object', 'nor is another outline colour');
});

/* ── Behind the head (docs/HAND_RIGGING.md) ────────────────────────────────── */

test('a drawn pair rests behind the head until something asks for it', () => {
  const state = drawn();
  installStyleHands(state);
  const show = handShowParameter('left');
  assert.equal(show, 'handLShow');
  assert.deepEqual([state.params[show].min, state.params[show].max, state.params[show].default], [0, 1, 0], 'tucked away by default');
  assert.equal(isHandHidden(state, 'left'), true);
  assert.equal(isHandHidden(state, 'right'), true);
  const group = state.elements.handLeft.baseTransform, at = { x: group.pivotX, y: group.pivotY };
  const frame = (values) => frameOf(state, values);
  // Hidden: behind the head, in the band behind whatever it was drawn over.
  const hidden = frame({}).handLeft;
  assert.equal(hidden.depthBand, 'behind');
  const point = handHiddenPoint('left', handPlacement(state));
  assert.ok(point.x < 240 / 2 && point.y < at.y, 'on its own side of the head, above where it rests');
  assert.ok(Math.abs(hidden.transform.x - (point.x - at.x)) < 0.01 && Math.abs(hidden.transform.y - (point.y - at.y)) < 0.01, 'slid to where it hides');
  // Out: at its rest place, where the anchor was measured.
  const out = frame(value(show, 1)).handLeft;
  assert.equal(out.depthBand, 'normal');
  assert.deepEqual([out.transform.x, out.transform.y], [0, 0]);
  // On the way out it is still behind the head until nearly clear of it.
  assert.equal(frame(value(show, 0.7)).handLeft.depthBand, 'behind');
  assert.ok(Math.abs(frame(value(show, 0.5)).handLeft.transform.y) < Math.abs(hidden.transform.y));
  const expression = state.expressions.find((item) => item.id === HANDS_OUT_EXPRESSION.id);
  assert.deepEqual(expression.controls, { handLShow: 1, handRShow: 1 });
  assert.equal(frame({ ...value('handLShow', 1) }).handLeft.opacity, 1, 'coming out is a move, not a fade');
  const wave = state.animationClips.find((clip) => clip.id === HAND_WAVE_CLIP.id);
  assert.equal(wave.tracks.handLShow.at(-1).value, 0, 'and goes back after');
  assert.equal(Math.max(...wave.tracks.handLShow.map((key) => key.value)), 1);
  assert.deepEqual(validateRig(state), []);
  // Out in the open again: nothing of it left.
  assert.equal(setHandHidden(state, 'left', false), true);
  assert.equal(isHandHidden(state, 'left'), false);
  assert.equal(state.params[show], undefined);
  assert.equal(state.keyforms.some((item) => item.id.startsWith('handLeft-show-')), false);
  assert.deepEqual(state.expressions.find((item) => item.id === HANDS_OUT_EXPRESSION.id).controls, { handRShow: 1 });
  assert.equal(frame({}).handLeft.depthBand, 'normal');
  assert.equal(setHandHidden(state, 'right', false), true);
  assert.equal(state.expressions.some((item) => item.id === HANDS_OUT_EXPRESSION.id), false, 'the expression goes with the last hidden hand');
  // And back behind the head, from where the hand rests.
  assert.equal(setHandHidden(state, 'left', true, { at, hidden: point }), true);
  assert.equal(frame({}).handLeft.depthBand, 'behind');
  assert.deepEqual(validateRig(state), []);
  // A pair asked to rest in the open is drawn exactly as before the hiding existed.
  const open = drawn();
  installStyleHands(open, { hidden: false });
  assert.equal(isHandHidden(open, 'left'), false);
  assert.equal(open.params.handLShow, undefined);
  assert.equal(frameOf(open, {}).handLeft.depthBand, 'normal');
});

/* ── The clips ─────────────────────────────────────────────────────────────── */

test('the pair comes with a wave and both hands up, fitted to the mascot', () => {
  const state = drawn();
  installStyleHands(state);
  const wave = state.animationClips.find((clip) => clip.id === HAND_WAVE_CLIP.id), up = state.animationClips.find((clip) => clip.id === HANDS_UP_CLIP.id);
  assert.ok(wave && up);
  assert.deepEqual(Object.keys(up.tracks).sort(),
    ['handLShow', 'handLStyle', 'handLX', 'handLY', 'handRShow', 'handRStyle', 'handRX', 'handRY'],
    'no head bounce on a mascot with no head movement, and no shape anywhere');
  assert.equal(Math.max(...up.tracks.handRShow.map((key) => key.value)), 1, 'both hands come out');
  assert.equal(up.tracks.handRShow.at(-1).value, 0, 'and go back');
  // A wave is a rotation of one drawing, and nothing about it deforms.
  assert.ok(wave.tracks.handLRotation);
  assert.deepEqual([...new Set(wave.tracks.handLStyle.map((key) => key.easing))], ['step']);
  assert.deepEqual(validateRig(state), []);
  // A mascot with a head bounces it too.
  const headed = drawn();
  headed.params.headY = { type: 'number', min: -1, max: 1, default: 0, value: 0 };
  installStyleHands(headed);
  assert.ok(headed.animationClips.find((clip) => clip.id === HANDS_UP_CLIP.id).tracks.headY);
  // A hand put back in the open takes its show track out of the clips, and hiding it again puts it back.
  setHandHidden(state, 'right', false);
  assert.equal(state.animationClips.find((clip) => clip.id === HANDS_UP_CLIP.id).tracks.handRShow, undefined);
  assert.deepEqual(validateRig(state), []);
  const group = state.elements.handRight.baseTransform;
  setHandHidden(state, 'right', true, { at: { x: group.pivotX, y: group.pivotY }, hidden: { x: group.pivotX, y: group.pivotY - 60 } });
  assert.ok(state.animationClips.find((clip) => clip.id === HANDS_UP_CLIP.id).tracks.handRShow);
  assert.deepEqual(validateRig(state), []);
});

test('a name typed by an author becomes an id', () => {
  assert.equal(styleIdFromName('Thumbs up!'), 'thumbsUp');
  assert.equal(styleIdFromName('  rock ON  '), 'rockOn');
  assert.equal(styleIdFromName(''), 'style');
});
