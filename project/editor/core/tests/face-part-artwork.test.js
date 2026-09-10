import test from 'node:test';
import assert from 'node:assert/strict';
import { documentIds, facePartThumbnail, remapArtworkIds, shapeSignature } from '../face-library/face-part-artwork.js';
import { MOUTH_WIDE } from '../face-library/builtin/mouth-wide.js';
import { NOSE_DOT } from '../face-library/builtin/nose-dot.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';

/**
 * An asset's artwork made ready for a document (docs/FACE_PART_LIBRARY.md,
 * "Installing"): ids renamed past what the document holds, references with
 * them, and the same artwork as a thumbnail that answers for nothing on the
 * mascot.
 */
const SHINY = '<g id="mouth-shiny"><defs><linearGradient id="shine"><stop offset="0"/></linearGradient><clipPath id="lips"><path id="lipShape" d="M0 0"/></clipPath></defs><path id="mouth" d="M0 0" fill="url(#shine)" clip-path="url( \'#lips\' )"/><use href="#mouth" id="mouthEcho"/><use xlink:href="#mouth"/></g>';

test('ids the document already holds are renamed, references included', () => {
  const taken = (id) => ['mouth', 'shine', 'lips-2'].includes(id) || id === 'lips';
  const { markup, renamed } = remapArtworkIds(SHINY, { taken });
  assert.deepEqual(renamed, { shine: 'shine-2', lips: 'lips-3', mouth: 'mouth-2' }, 'each taken id takes the first free suffix');
  assert.match(markup, /<g id="mouth-shiny">/, 'a free id stays');
  assert.match(markup, /<linearGradient id="shine-2">/);
  assert.match(markup, /<clipPath id="lips-3">/);
  assert.match(markup, /<path id="mouth-2" d="M0 0" fill="url\(#shine-2\)" clip-path="url\(#lips-3\)"\/>/, 'fill and clip references follow, quotes and spaces dropped');
  assert.match(markup, /<use href="#mouth-2" id="mouthEcho"\/>/, 'an href follows');
  assert.match(markup, /<use xlink:href="#mouth-2"\/>/, 'and the old namespaced one');
  assert.equal(markup.includes('id="mouth"'), false);
  assert.equal(markup.includes('mouthEcho-'), false, 'an id that only starts the same is left alone');
});

test('nothing taken, nothing renamed; a rename rule replaces the suffix rule', () => {
  assert.deepEqual(remapArtworkIds(MOUTH_WIDE.artwork), { markup: MOUTH_WIDE.artwork, renamed: {} });
  const prefixed = remapArtworkIds("<g id='root'><path id='mouth' fill=\"url(#root)\"/></g>", { rename: (id) => `thumb-${id}` });
  assert.deepEqual(prefixed.renamed, { root: 'thumb-root', mouth: 'thumb-mouth' });
  assert.equal(prefixed.markup, "<g id='thumb-root'><path id='thumb-mouth' fill=\"url(#thumb-root)\"/></g>", 'single quotes are kept as they were');
  assert.deepEqual(remapArtworkIds('', { taken: () => true }), { markup: '', renamed: {} });
  assert.deepEqual(remapArtworkIds(null), { markup: '', renamed: {} });
});

test('the document\'s ids are every id its markup carries, clips and defs included', () => {
  const ids = documentIds(createTemplateProjectState().svgMarkup);
  for (const id of ['faceRoot', 'mouth', 'eyeSocketLeft', 'headShape', 'handLeft']) assert.ok(ids.has(id), `${id} is taken`);
  assert.equal(ids.has('mouth-wide'), false);
});

test('a thumbnail is the artwork inside its own padded box, with every id prefixed', () => {
  const thumb = facePartThumbnail(MOUTH_WIDE, { size: 40 });
  assert.match(thumb, /^<svg class="face-part-thumb" viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) \3" width="40" height="40" aria-hidden="true" focusable="false" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/, 'square, so every part sits the same way on a card');
  const [, x, y, side] = thumb.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+)/);
  assert.equal(Number(side), 80 * 1.3, 'the longer side of the box, padded on both sides');
  assert.equal(Number(x) + Number(side) / 2, 80 + 40, 'centred on the box');
  assert.equal(Number(y) + Number(side) / 2, 168 + 11);
  assert.match(thumb, /<g id="thumb-mouth-wide-mouth-wide"/);
  assert.match(thumb, /<path id="thumb-mouth-wide-mouth"/);
  assert.match(thumb, /<path id="thumb-mouth-wide-teeth"/);
  assert.equal(thumb.includes(' id="mouth"'), false, 'no id a thumbnail shares with the mascot');
  assert.match(facePartThumbnail(NOSE_DOT), /width="48" height="48"/, 'the default size');
  assert.equal(facePartThumbnail({ ...NOSE_DOT, referenceBox: { x: 0, y: 0, width: 0, height: 4 } }), '', 'a box with no area is no picture');
});

test('the shape signature is one word for a drawing, the same until a point, a curve or a size changes, whatever the whole piece was moved by', () => {
  const state = createTemplateProjectState();
  const word = shapeSignature(state.svgMarkup, ['mouth', 'teeth']);
  assert.match(word, /^s[0-9a-z]+$/);
  assert.equal(shapeSignature(state.svgMarkup, ['mouth', 'teeth']), word, 'stable');
  assert.notEqual(shapeSignature(state.svgMarkup, ['mouth']), word, 'a different set of pieces');
  const moved = state.svgMarkup.replace(/<path id="mouth" /, '<path id="mouth" transform="translate(4 2) rotate(10)" ');
  assert.equal(shapeSignature(moved, ['mouth', 'teeth']), word, 'a move, a turn or a resize of the whole is no reshape');
  const reshaped = state.svgMarkup.replace(/(<path id="mouth"[^>]*\sd=")([^"]*)"/, (_, head, d) => `${head}${d.replace(/\d/, (digit) => String((Number(digit) + 1) % 10))}"`);
  assert.notEqual(reshaped, state.svgMarkup);
  assert.notEqual(shapeSignature(reshaped, ['mouth', 'teeth']), word, 'a point moved is a reshape');
  assert.notEqual(shapeSignature(state.svgMarkup, ['mouth', 'gone']), shapeSignature(state.svgMarkup, ['mouth']), 'a piece gone counts');
  assert.equal(shapeSignature('', []), shapeSignature(null, []));
});

test('ids are renamed in one pass: a rename whose target is another id\'s source is never renamed twice, and a free name is never one the fragment already uses', () => {
  // `a` is taken; `a-2` is the fragment's own other id: `a` must not become it.
  const { markup, renamed } = remapArtworkIds('<g id="a"><path id="a-2" fill="url(#a)"/><use href="#a-2"/></g>', { taken: (id) => id === 'a' });
  assert.deepEqual(renamed, { a: 'a-3' });
  assert.equal(markup, '<g id="a-3"><path id="a-2" fill="url(#a-3)"/><use href="#a-2"/></g>');
  const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate id');
  // Both taken: each moves past the other's name too.
  const both = remapArtworkIds('<g id="a"><path id="a-2"/></g>', { taken: (id) => ['a', 'a-2'].includes(id) });
  assert.deepEqual(both.renamed, { a: 'a-3', 'a-2': 'a-2-2' });
  assert.equal(both.markup, '<g id="a-3"><path id="a-2-2"/></g>');
});

test('a picture goes through the cleaner: a handler glued onto a value, which the scan cannot read, is no picture', () => {
  const asset = { id: 'mouth.x', category: 'mouth', name: 'X', artwork: '<g id="x"><img src=""onerror="alert(1)"></g>', roles: { mouth: 'x' }, referenceBox: { x: 0, y: 0, width: 10, height: 10 } };
  const thumb = facePartThumbnail(asset);
  assert.doesNotMatch(thumb, /onerror/, 'nothing executable reaches the page');
});
