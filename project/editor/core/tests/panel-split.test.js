import test from 'node:test';
import assert from 'node:assert/strict';
import { COLUMN, DEFAULT_SPLIT, clampColumn, fitPair, minCanvas, readSplits, resolveSplit, splitForMode, writeSplits } from '../../ui/panel-split.js';
import { MODES } from '../../ui/task-router.js';

/**
 * How much of the window the panels get (UIR-15).
 *
 * One `300px · 1fr · 310px` for every screen was a compromise across screens
 * that want opposite things: measured at 1440×900, Artwork gave 58% of the
 * window to the canvas and left an Inspector with 1341px of content in an
 * 836px column, and Hands gave the same 58% to a drawing of a face whose
 * hands are behind its head.
 */

const SCREEN = 1440;

test('a screen asks for the width its work needs', () => {
  // Drawing wants the canvas; choosing among drawings of a hand wants the list.
  assert.deepEqual(splitForMode(MODES['design.artwork']), { left: 300, right: 340 });
  assert.deepEqual(splitForMode(MODES['design.hands']), { left: 400, right: 250 });
  assert.deepEqual(splitForMode(MODES['rig.controls']), { left: 400, right: 320 });
  // On Behavior the right-hand column is the tuning surface — an easing curve,
  // a waveform, a timing bar — rather than a strip of fields, so it is the
  // wider of the two (docs/BEHAVIOR_STUDIO.md). All three of its screens ask
  // for the same shape, because all three are the same board.
  for (const mode of ['behavior.reactions', 'behavior.automatic', 'behavior.stateMachine']) {
    assert.deepEqual(splitForMode(MODES[mode]), { left: 300, right: 340 }, mode);
  }
  // And a screen that says nothing still gets something: the one default, not
  // an empty column.
  assert.deepEqual(splitForMode(MODES['animate.motions']), DEFAULT_SPLIT);
  assert.deepEqual(splitForMode(null), DEFAULT_SPLIT);
  assert.deepEqual(splitForMode({}), DEFAULT_SPLIT);
});

test('every declared width is one the rules would allow, at every window', () => {
  // A route asking for something the drag rules forbid would be a screen that
  // opens one width and jumps to another the moment anybody touches it.
  for (const mode of Object.values(MODES)) {
    if (!mode.layout) continue;
    const { left, right } = splitForMode(mode);
    assert.equal(clampColumn(left), left, `${mode.id} left`);
    assert.equal(clampColumn(right), right, `${mode.id} right`);
    // And on a laptop the canvas keeps its share. This is the one that
    // matters: a pair of widths that is comfortable on a 1920px monitor
    // starves a 1280px canvas, and the rig draws handles *on* the canvas --
    // a hand's own slider sits beside the face, outside the artwork -- which
    // then end up behind the panel, where nobody can reach them.
    for (const window of [1280, 1440, 1920]) {
      const pair = resolveSplit(mode, {}, { available: window });
      assert.ok(window - pair.left - pair.right >= minCanvas(window) - 1, `${mode.id} at ${window} leaves a canvas`);
      assert.ok(pair.left >= COLUMN.min && pair.right >= COLUMN.min, `${mode.id} at ${window} keeps both columns readable`);
    }
  }
});

test('when they do not both fit, both give way in proportion', () => {
  // One column clamped to nothing to keep the other is a screen that loses its
  // Inspector on a smaller window rather than a screen that is a little
  // tighter all over.
  const roomy = fitPair(400, 250, 1920);
  assert.deepEqual(roomy, { left: 400, right: 250 }, 'with room, both asks stand');
  const tight = fitPair(400, 250, 1280);
  assert.ok(tight.left < 400 && tight.right < 250, 'both gave way');
  assert.ok(tight.left > tight.right, 'and the screen’s proportions survived');
  assert.ok(1280 - tight.left - tight.right >= minCanvas(1280) - 1);
  // Neither is ever squeezed below what a column needs to be readable.
  const cramped = fitPair(400, 400, 900);
  assert.ok(cramped.left >= COLUMN.min || cramped.left === 0);
  assert.equal(fitPair(400, 250, 0).left, 400, 'a window of unknown width does not clamp');
});

test('a column stays wide enough to read and narrow enough to leave a canvas', () => {
  assert.equal(clampColumn(40), COLUMN.min, 'narrower than this is what Collapse is for');
  assert.equal(clampColumn(9000), COLUMN.max);
  assert.equal(clampColumn('nonsense'), DEFAULT_SPLIT.left, 'and rubbish is the default, not NaN');
  // The canvas keeps its share whatever the two sides ask for.
  assert.ok(clampColumn(560, { other: 400, available: 1000 }) + 400 + minCanvas(1000) <= 1000);
  assert.equal(clampColumn(560, { other: 0, available: 1920 }), 560, 'with room, the ask stands');
});

test('what the author dragged wins, on that screen and no other', () => {
  const dragged = { 'design.hands': { left: 520 } };
  const wide = 1920;
  assert.equal(resolveSplit(MODES['design.hands'], dragged, { available: wide }).left, 520);
  assert.equal(resolveSplit(MODES['design.hands'], dragged, { available: wide }).right, 250, 'the side they did not touch is the screen’s');
  // Widening the list on Hands is not a request for a narrow canvas in Artwork.
  assert.deepEqual(resolveSplit(MODES['design.artwork'], dragged, { available: wide }), { left: 300, right: 340 });
  assert.deepEqual(resolveSplit(MODES['design.hands'], {}, { available: SCREEN }), { left: 400, right: 250 });
});

test('a window too narrow for both columns gives the canvas its floor', () => {
  // Below the width where the stylesheet still puts three columns side by
  // side, the canvas takes the squeeze rather than the columns: those numbers
  // are not read there, and a column narrower than `COLUMN.min` is one nobody
  // could have used anyway.
  const tight = resolveSplit(MODES['rig.controls'], {}, { available: 800 });
  assert.equal(tight.left, COLUMN.min, 'a column is never narrower than readable');
  assert.equal(tight.right, COLUMN.min);
  const laptop = resolveSplit(MODES['rig.controls'], {}, { available: 1280 });
  assert.ok(1280 - laptop.left - laptop.right >= minCanvas(1280) - 1, 'and where they are read, the canvas keeps its share');
  // The share is what protects a laptop; the pixel floor is for the window
  // sizes where the shell is about to stack the columns anyway.
  assert.equal(minCanvas(1280), 666);
  assert.equal(minCanvas(500), 360, 'the floor holds under the share');
});

test('a drag is remembered for the session, and a tab that cannot store one still works', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(readSplits(storage), {});
  assert.equal(writeSplits({ 'design.hands': { left: 520 } }, storage), true);
  assert.deepEqual(readSplits(storage), { 'design.hands': { left: 520 } });
  // Rubbish in storage is not a broken editor.
  store.set('boop.panelSplit', '{not json');
  assert.deepEqual(readSplits(storage), {});
  store.set('boop.panelSplit', '"a string"');
  assert.deepEqual(readSplits(storage), {});
  // A private window throws on both, and the columns are simply the route's.
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(readSplits(blocked), {});
  assert.equal(writeSplits({ a: 1 }, blocked), false);
  assert.deepEqual(readSplits(undefined), {});
});
