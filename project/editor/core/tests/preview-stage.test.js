import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GROUND, DEFAULT_SIZE, PREVIEW_GROUNDS, PREVIEW_GROUND_IDS, PREVIEW_SIZES, PREVIEW_SIZE_IDS,
  describeStage, normalizeGround, normalizeSize, stageWarning
} from '../../ui/preview-stage.js';

/**
 * The two checks Preview did not offer (docs/AUDIT_UI_2026-09/02_PROBLEMES.md
 * §11): what the mascot sits on, and how big it is drawn.
 *
 * It had eight sections including an event simulator and a log, and neither of
 * these — so an author could not find out that their three-unit outlines vanish
 * at 32 px, or that their dark line work disappears on a dark site, without
 * exporting and looking.
 */

test('the grounds are the four a mascot actually meets, transparency first', () => {
  assert.deepEqual(PREVIEW_GROUND_IDS, ['checker', 'light', 'dark', 'colour']);
  assert.equal(DEFAULT_GROUND, 'checker', 'what the exported SVG really has behind it');
  for (const ground of PREVIEW_GROUNDS) assert.ok(ground.label && ground.hint, `${ground.id} needs both`);
});

test('the sizes are four somebody can name, and Fit', () => {
  assert.deepEqual(PREVIEW_SIZE_IDS, [32, 64, 128, 256, 'fit']);
  assert.equal(DEFAULT_SIZE, 'fit', 'the canvas as it is, until a size is asked for');
  for (const size of PREVIEW_SIZES) assert.ok(size.label && size.hint, `${size.id} needs both`);
});

test('anything resolves to a ground and a size, and a number lands on the nearest offered', () => {
  assert.equal(normalizeGround('dark'), 'dark');
  assert.equal(normalizeGround('mauve'), 'checker');
  assert.equal(normalizeGround(undefined), 'checker');

  assert.equal(normalizeSize(64), 64);
  assert.equal(normalizeSize('fit'), 'fit');
  assert.equal(normalizeSize(undefined), 'fit');
  assert.equal(normalizeSize('nonsense'), 'fit');
  // A size from somewhere else — a saved preference, a deep link — lands on
  // the nearest one that is offered rather than on nothing.
  assert.equal(normalizeSize(40), 32);
  assert.equal(normalizeSize(100), 128);
  assert.equal(normalizeSize(5000), 256);
});

test('the stage says what it is, and never touches a document', () => {
  const fitted = describeStage({});
  assert.deepEqual(fitted, { ground: 'checker', size: 'fit', fitted: true, pixels: null, tooSmall: false, artboard: 0 });

  const small = describeStage({ ground: 'dark', size: 32 }, { artboard: 240 });
  assert.equal(small.ground, 'dark');
  assert.equal(small.pixels, 32);
  assert.equal(small.fitted, false);
  assert.equal(small.artboard, 240);
});

test('a stroke that would fall under a pixel is worth one sentence, and only then', () => {
  // The template's own outlines are three units on a 240-unit artboard: at
  // 32 px that is 0.4 px, which is the failure this warning exists for.
  const at32 = stageWarning(describeStage({ size: 32 }), { strokes: [3, 2.4], artboard: 240 });
  assert.match(at32, /32 px/);
  assert.match(at32, /0\.32 px wide/);
  assert.match(at32, /Thicker outlines/);

  // At 256 the same drawing is fine, and says nothing.
  assert.equal(stageWarning(describeStage({ size: 256 }), { strokes: [3, 2.4], artboard: 240 }), '');
  // Fit is not a size to warn about.
  assert.equal(stageWarning(describeStage({ size: 'fit' }), { strokes: [3], artboard: 240 }), '');
  // And nothing to measure says nothing.
  assert.equal(stageWarning(describeStage({ size: 32 }), { strokes: [], artboard: 240 }), '');
  assert.equal(stageWarning(describeStage({ size: 32 }), { strokes: [3], artboard: 0 }), '');
  assert.equal(stageWarning(null, { strokes: [3], artboard: 240 }), '');
});
