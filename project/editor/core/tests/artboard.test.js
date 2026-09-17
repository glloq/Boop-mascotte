import test from 'node:test';
import assert from 'node:assert/strict';
import { artboardAround, artboardOverflow, describeOverflow, normalizeArtboard, readArtboard, resizeArtboard, writeArtboard } from '../artwork/artboard.js';

/**
 * The working area (docs/VECTOR_EDITING.md). A nested `<svg>` clips to its own
 * `viewBox`, so this is the difference between artwork that exists and artwork
 * that is silently cut off.
 */
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img"><g id="a"/></svg>';

test('the artboard is read from the root and nothing else', () => {
  assert.deepEqual(readArtboard(svg), { x: 0, y: 0, width: 240, height: 240 });
  assert.deepEqual(readArtboard('<svg viewBox="-10 -20 100 50">'), { x: -10, y: -20, width: 100, height: 50 });
  assert.deepEqual(readArtboard('<svg viewBox="0,0,80,60">'), { x: 0, y: 0, width: 80, height: 60 }, 'commas are legal');
  // A missing, malformed or empty box falls back rather than throwing: an
  // imported drawing is not always well behaved.
  for (const markup of ['', '<svg>', '<svg viewBox="nonsense">', '<svg viewBox="0 0 0 0">']) {
    assert.deepEqual(readArtboard(markup), { x: 0, y: 0, width: 240, height: 240 });
  }
});

test('writing one changes the viewBox and leaves the rest of the markup alone', () => {
  const next = writeArtboard(svg, { x: 0, y: -40, width: 240, height: 300 });
  assert.match(next, /viewBox="0 -40 240 300"/);
  assert.match(next, /role="img"/);
  assert.match(next, /<g id="a"\/>/);
  assert.deepEqual(readArtboard(next), { x: 0, y: -40, width: 240, height: 300 });
  // A root with no viewBox gets one rather than staying unbounded.
  assert.match(writeArtboard('<svg xmlns="x"><g/></svg>', { x: 0, y: 0, width: 10, height: 20 }), /<svg viewBox="0 0 10 20" xmlns="x">/);
});

test('a box is always a box', () => {
  assert.deepEqual(normalizeArtboard({ width: -5, height: 0 }), { x: 0, y: 0, width: 240, height: 240 });
  assert.deepEqual(normalizeArtboard({ x: '2.345', y: NaN, width: '10.005', height: 3 }), { x: 2.35, y: 0, width: 10.01, height: 3 });
});

test('a size is a scale, so the working area resizes around its own centre', () => {
  // A `viewBox` is an origin *and* a size. Writing the size alone nails the
  // top-left corner down, which on screen is a scale **and** a pan: measured
  // before this existed, 240 → 160 slid the mascot's head 107 px to the right
  // and 384 → 120 left it below the canvas entirely, with every handle drawn
  // over it going the same way.
  const box = { x: 0, y: -60, width: 240, height: 384 };
  const centre = (value) => ({ x: value.x + value.width / 2, y: value.y + value.height / 2 });

  const narrow = resizeArtboard(box, { width: 120 });
  assert.deepEqual(narrow, { x: 60, y: -60, width: 120, height: 384 });
  assert.deepEqual(centre(narrow), centre(box), 'the same place, framed smaller');

  const short = resizeArtboard(narrow, { height: 120 });
  assert.deepEqual(short, { x: 60, y: 72, width: 120, height: 120 });
  assert.deepEqual(centre(short), centre(box));

  // Growing is symmetric for the same reason: room appears on both sides
  // rather than only on the right.
  const wide = resizeArtboard(box, { width: 480 });
  assert.deepEqual(wide, { x: -120, y: -60, width: 480, height: 384 });
  assert.deepEqual(centre(wide), centre(box));

  // One side at a time: the other keeps its own origin exactly.
  assert.equal(resizeArtboard(box, { width: 100 }).y, box.y);
  assert.equal(resizeArtboard(box, { height: 100 }).x, box.x);

  // Nothing asked for is nothing moved, and a side that is not a size falls
  // back the way every other box does rather than producing a negative origin.
  assert.deepEqual(resizeArtboard(box), box);
  assert.deepEqual(resizeArtboard(box, { width: undefined, height: undefined }), box);
  assert.deepEqual(resizeArtboard(box, { width: 0 }), resizeArtboard(box, { width: 240 }), 'zero is a missing side, not a small one');

  // An odd difference keeps the centre to the precision a box is rounded to.
  assert.deepEqual(centre(resizeArtboard(box, { width: 101 })), centre(box));
});

test('Fit grows around what is drawn, and never crops it', () => {
  const box = { x: 0, y: 0, width: 240, height: 240 };
  // Hair drawn above the top edge and a hand past the bottom.
  assert.deepEqual(artboardAround(box, { x: -6, y: -30, width: 250, height: 300 }, 8),
    { x: -14, y: -38, width: 266, height: 316 });
  // Content well inside it changes nothing: Fit is not a crop.
  assert.deepEqual(artboardAround(box, { x: 40, y: 40, width: 100, height: 100 }, 8), box);
  assert.deepEqual(artboardAround(box, null), box, 'nothing measured, nothing moved');
});

test('overflow is per edge, and says so in words', () => {
  const box = { x: 0, y: 0, width: 240, height: 240 };
  assert.deepEqual(artboardOverflow(box, { x: 0, y: -12, width: 240, height: 252 }),
    { left: 0, top: 12, right: 0, bottom: 0, any: true });
  assert.equal(describeOverflow(artboardOverflow(box, { x: 0, y: -12, width: 240, height: 252 })), '12 past the top');
  assert.equal(artboardOverflow(box, { x: 10, y: 10, width: 100, height: 100 }).any, false);
  assert.equal(describeOverflow(artboardOverflow(box, { x: 10, y: 10, width: 100, height: 100 })), '');
  // Half a unit is rounding, not artwork hanging over the edge.
  assert.equal(artboardOverflow(box, { x: -0.2, y: 0, width: 240, height: 240 }).any, false);
});
