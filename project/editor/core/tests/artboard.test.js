import test from 'node:test';
import assert from 'node:assert/strict';
import { artboardAround, artboardOverflow, describeOverflow, normalizeArtboard, readArtboard, writeArtboard } from '../artwork/artboard.js';

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
