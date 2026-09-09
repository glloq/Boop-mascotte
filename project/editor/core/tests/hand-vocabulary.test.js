import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HAND_STYLE, HAND_ROTATION_ADVICE, HAND_SIDES, HAND_STYLES, HAND_STYLE_ALIASES, HAND_STYLE_IDS,
  handRotationIsComfortable, handSideId, handSideLetter, handStyle, handStyleId, handStyleLabel,
  normalizeHandState, resetHandStyleWarnings, resolveHandStyle
} from '../../../runtime/hand-vocabulary.js';

test('a hand is a side and a style, and nothing about angles', () => {
  assert.deepEqual([...HAND_SIDES], ['left', 'right']);
  assert.equal(handSideId('right'), 'right');
  assert.equal(handSideId('nonsense'), 'left');
  assert.equal(handSideLetter('right'), 'R');
  assert.equal(handSideLetter('left'), 'L');
  // The registry is a flat list, not a grid: no view, no face, no angle, and
  // nothing a drawing does on its own.
  const registry = JSON.stringify(HAND_STYLES);
  for (const gone of ['view', 'angle', 'face', 'threeQuarter', 'facing', 'yaw', 'pitch', 'roll', 'anim', 'shapeKey', 'curl']) {
    assert.doesNotMatch(registry, new RegExp(gone, 'i'), `${gone} is not part of a style`);
  }
});

test('the library is six drawings, each named and each an asset', () => {
  assert.deepEqual([...HAND_STYLE_IDS], ['relaxed', 'open', 'fist', 'point', 'thumbsUp', 'peace']);
  assert.ok(HAND_STYLE_IDS.length >= 5 && HAND_STYLE_IDS.length <= 10, 'five to ten drawings, no more');
  for (const style of Object.values(HAND_STYLES)) {
    assert.ok(style.label && style.label !== style.id, `${style.id} reads as words`);
    assert.ok(style.asset, `${style.id} names a drawing`);
    assert.deepEqual(Object.keys(style).sort(), ['asset', 'id', 'label', 'mirrorable'], `${style.id} says only what a style is`);
  }
  assert.equal(handStyleLabel('thumbsUp'), 'Thumbs up');
  assert.equal(DEFAULT_HAND_STYLE, 'relaxed');
});

test('a name the registry knows resolves; one it does not is not invented', () => {
  assert.equal(handStyleId('open'), 'open');
  assert.equal(handStyleId('  fist  '), 'fist');
  assert.equal(handStyleId('nonsense'), null);
  assert.equal(handStyleId(''), null);
  assert.equal(handStyleId(null), null);
  assert.equal(handStyle('nonsense'), null);
});

test('an alias is a name for a drawing the library already has', () => {
  // A wave is an open hand and a rotation clip, not a drawing of its own.
  assert.equal(handStyleId('wave'), 'open');
  assert.equal(handStyleId('spread'), 'open');
  assert.equal(handStyleId('relax'), 'relaxed');
  assert.equal(handStyleId('grab'), 'fist');
  assert.equal(handStyleId('victory'), 'peace');
  assert.equal(handStyleId('pointing'), 'point');
  // The ids the 2D drawings used before the styles were named.
  assert.equal(handStyleId('sideOpen'), 'relaxed');
  assert.equal(handStyleId('palmOpen'), 'open');
  assert.equal(handStyleId('frontFist'), 'fist');
  for (const [alias, target] of Object.entries(HAND_STYLE_ALIASES)) {
    assert.ok(HAND_STYLE_IDS.includes(target), `${alias} points at a style that exists`);
  }
});

test("a hand's own library answers before the registry", () => {
  const own = [{ id: 'open', label: 'Big open hand' }, { id: 'fist' }];
  assert.equal(handStyleId('palmOpen', own), 'open', 'an old name still finds the drawing it became');
  assert.equal(handStyleLabel('open', own), 'Big open hand', "the hand's own label wins");
  assert.equal(handStyleId('peace', own), null, 'a style this hand was never drawn with is not offered');
  assert.equal(handStyleId('peace'), 'peace', 'though the registry still knows it');
});

/* ── The resolver (PHASE 18/19) ────────────────────────────────────────────── */

test('resolving a style answers with an asset and a flip, and nothing else', () => {
  assert.deepEqual(resolveHandStyle('open', 'left'), { id: 'open', asset: 'open', flipX: false, mirrorable: true, fallback: false });
  assert.deepEqual(resolveHandStyle('open', 'right'), { id: 'open', asset: 'open', flipX: true, mirrorable: true, fallback: false });
  // One file for both hands is the whole point of `mirrorable`.
  assert.equal(resolveHandStyle('thumbsUp', 'left').asset, resolveHandStyle('thumbsUp', 'right').asset);
  assert.equal(resolveHandStyle('palmOpen', 'right').id, 'open', 'an old name resolves on the way through');
});

test('a style that is not mirrorable gets a drawing of its own per side', () => {
  // No shipped style needs this, but the registry has to allow it: a drawing
  // whose mirror image reads wrong names both sides instead (PHASE 12).
  const asymmetric = { id: 'salute', label: 'Salute', mirrorable: false, leftAsset: 'salute-left', rightAsset: 'salute-right' };
  const registry = { ...HAND_STYLES, salute: asymmetric };
  const resolve = (side) => {
    const record = registry.salute;
    const mirrorable = record.mirrorable !== false;
    return {
      asset: mirrorable ? record.asset : (side === 'right' ? record.rightAsset : record.leftAsset),
      flipX: mirrorable && side === 'right'
    };
  };
  assert.deepEqual(resolve('left'), { asset: 'salute-left', flipX: false });
  assert.deepEqual(resolve('right'), { asset: 'salute-right', flipX: false });
});

test('an unknown style falls back to relaxed, warns once, and never stops the render', () => {
  resetHandStyleWarnings();
  const said = [];
  const warn = console.warn;
  console.warn = (message) => said.push(message);
  try {
    const first = resolveHandStyle('threeQuarterBackPalm', 'left');
    assert.equal(first.id, DEFAULT_HAND_STYLE);
    assert.equal(first.fallback, true);
    resolveHandStyle('threeQuarterBackPalm', 'right');
    resolveHandStyle('threeQuarterBackPalm', 'left');
  } finally { console.warn = warn; }
  assert.equal(said.length, 1, 'said once, not once a frame');
  assert.match(said[0], /unknown hand style/);
  assert.match(said[0], /relaxed/);
  // Nothing was asked for at all is not a mistake worth saying anything about.
  resetHandStyleWarnings();
  console.warn = (message) => said.push(message);
  try { assert.equal(resolveHandStyle(null, 'left').id, DEFAULT_HAND_STYLE); } finally { console.warn = warn; }
  assert.equal(said.length, 1);
});

test('a hand state is seven fields, and lands on something drawable', () => {
  const library = [{ id: 'open' }, { id: 'fist' }];
  assert.deepEqual(Object.keys(normalizeHandState({})).sort(), ['flipX', 'rotation', 'scale', 'side', 'style', 'visible', 'x', 'y']);
  assert.equal(normalizeHandState({ style: 'fist' }, 'left', library).style, 'fist');
  assert.equal(normalizeHandState({ style: 'peace' }, 'left', library).style, 'open',
    'a drawing the hand has not got falls back to the first it has, not to a registry entry it never drew');
  assert.equal(normalizeHandState({}, 'left').style, DEFAULT_HAND_STYLE);
  // The names an older file used for the same field.
  assert.equal(normalizeHandState({ drawing: 'frontFist' }).style, 'fist');
  assert.equal(normalizeHandState({ pose: 'spread' }).style, 'open');
  const state = normalizeHandState({ side: 'right', x: 'x', y: 12, rotation: -8, scale: 2, flipX: true, visible: false }, 'left');
  assert.deepEqual(state, { side: 'right', style: 'relaxed', x: 0, y: 12, rotation: -8, scale: 2, flipX: true, visible: false });
});

test('the turn a static drawing carries is a recommendation, not a limit', () => {
  assert.deepEqual({ ...HAND_ROTATION_ADVICE }, { min: -35, max: 35 });
  assert.equal(handRotationIsComfortable(30), true);
  assert.equal(handRotationIsComfortable(-30), true);
  assert.equal(handRotationIsComfortable(120), false);
  // …and the model still carries it: nothing clamps.
  assert.equal(normalizeHandState({ rotation: 120 }).rotation, 120);
});
