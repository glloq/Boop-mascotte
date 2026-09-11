import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_LABELS, TOKEN_SEEDS, derivePalette, isColour, paletteRoleTokens, seedTokens, tintArtwork, tokenWrites } from '../face-library/palette-model.js';
import { PALETTE_TOKENS } from '../face-library/face-part-model.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { HEAD_ROUND } from '../face-library/builtin/heads.js';

/**
 * The face's colours as tokens (docs/FACE_PART_LIBRARY.md, "Palette
 * tokens"): a reading of the artwork, seeded from the parts' own paints,
 * every use of a colour gathered under its token, and an asset painted in
 * those colours as it goes on.
 */
const template = () => createTemplateProjectState();
/** The template's paints, as the canvas would report them, in document order. */
const PAINTS = [
  { id: 'faceRoot' }, { id: 'hairBack', fill: '#7c4529' }, { id: 'earLeft' }, { id: 'earLeftShape', fill: '#f9d9b0' }, { id: 'earLeftEdge', fill: 'none', stroke: '#a4674a' },
  { id: 'earRight' }, { id: 'earRightShape', fill: '#f9d9b0' }, { id: 'head', fill: '#f9d9b0', stroke: '#a4674a' },
  { id: 'mouth', fill: '#6d2831', stroke: '#b4525c' }, { id: 'tongue', fill: '#d9707f' }, { id: 'teeth', fill: '#fff8ec' },
  { id: 'eyeLeft' }, { id: 'eyeWhiteLeft', fill: '#ffffff' }, { id: 'pupilLeft', fill: '#2f3a43' }, { id: 'glintLeft', fill: '#ffffff' }, { id: 'lidUpperLeft', fill: '#f9d9b0', stroke: '#a4674a' }, { id: 'rimLeft', fill: 'none', stroke: '#a4674a' },
  { id: 'eyeRight' }, { id: 'eyeWhiteRight', fill: '#FFFFFF' }, { id: 'pupilRight', fill: '#2f3a43' },
  { id: 'eyebrows' }, { id: 'browLeft', fill: '#a6603c' }, { id: 'browRight', fill: '#a6603c' }, { id: 'nose', fill: 'none', stroke: '#bd8763' },
  { id: 'hairTop', fill: '#c8874f' }, { id: 'hairFront' }, { id: 'hair', fill: '#a6603c' }, { id: 'handLeft', fill: 'url(#g)' }
];

test('every token has a label and a seed, and every seed names a real part and role', async () => {
  const { SEMANTIC_PART_REGISTRY } = await import('../../rig-editor/semantic-parts/part-registry.js');
  for (const token of PALETTE_TOKENS) {
    assert.ok(TOKEN_LABELS[token], `${token} has a label`);
    assert.ok(TOKEN_SEEDS.some((rule) => rule.token === token), `${token} is read from somewhere`);
  }
  for (const rule of TOKEN_SEEDS) {
    assert.ok(SEMANTIC_PART_REGISTRY[rule.part]?.roles.includes(rule.role), `${rule.token}: ${rule.part}.${rule.role} exists`);
    assert.ok(['fill', 'stroke', 'either'].includes(rule.property));
  }
  assert.equal(isColour('#fff'), true); assert.equal(isColour('none'), false); assert.equal(isColour('url(#g)'), false); assert.equal(isColour(''), false);
  // A colour by its syntax, and nothing else: what is read here goes into a style attribute.
  for (const value of ['#abc', '#ABCDEF', '#abcd', '#aabbccdd', 'red', 'RebeccaPurple', 'rgb(1, 2, 3)', 'rgba(1,2,3,.5)', 'hsl(120 50% 50%)', 'hsla(0, 0%, 0%, 0.5)']) assert.equal(isColour(value), true, value);
  for (const value of ['#fff;background:url(https://evil.example/x)', 'red;x', 'rgb(1,2,3);y', 'url(https://evil.example/x)', 'expression(1)', 'transparent', 'inherit', 'currentColor', '#ggg', 'rgb(1,2,3', 'var(--x)', '#fff url(x)']) assert.equal(isColour(value), false, value);
});

test('the template\'s tokens are read from the parts that play them', () => {
  const seeds = seedTokens(template(), PAINTS);
  assert.deepEqual(seeds.skin, { colour: '#f9d9b0', id: 'head', property: 'fill' }, 'the skull, which the jaw plays on the template');
  assert.deepEqual(seeds.outline, { colour: '#a4674a', id: 'head', property: 'stroke' });
  assert.deepEqual(seeds.hair, { colour: '#a6603c', id: 'hair', property: 'fill' });
  assert.deepEqual(seeds.hairShadow, { colour: '#7c4529', id: 'hairBack', property: 'fill' });
  assert.deepEqual(seeds.eyeWhite, { colour: '#ffffff', id: 'eyeWhiteLeft', property: 'fill' }, 'the first painted shape inside the eye group');
  assert.deepEqual(seeds.pupil, { colour: '#2f3a43', id: 'pupilLeft', property: 'fill' });
  assert.deepEqual(seeds.mouth, { colour: '#6d2831', id: 'mouth', property: 'fill' });
  assert.deepEqual(seeds.teeth, { colour: '#fff8ec', id: 'teeth', property: 'fill' });
  assert.deepEqual(seeds.tongue, { colour: '#d9707f', id: 'tongue', property: 'fill' });
  assert.equal(seeds.skinShadow, undefined, 'the nose is a line: no fill to read');
  assert.equal(seeds.accessoryPrimary, undefined);
  // A mouth drawn as a line seeds from its stroke; a face with no parts seeds nothing.
  assert.deepEqual(seedTokens(template(), PAINTS.map((paint) => (paint.id === 'mouth' ? { id: 'mouth', fill: 'none', stroke: '#b4525c' } : paint))).mouth, { colour: '#b4525c', id: 'mouth', property: 'stroke' });
  assert.deepEqual(seedTokens({}, PAINTS), {});
});

test('the palette gathers every use of a token\'s colour, and the colours nothing claims', () => {
  const palette = derivePalette(template(), PAINTS);
  assert.deepEqual(palette.tokens.map((entry) => entry.token), ['skin', 'outline', 'hair', 'hairShadow', 'eyeWhite', 'pupil', 'mouth', 'tongue', 'teeth'], 'in the tokens\' own order');
  const skin = palette.tokens.find((entry) => entry.token === 'skin');
  assert.deepEqual(skin, { token: 'skin', label: 'Skin', colour: '#f9d9b0', seed: { id: 'head', property: 'fill' }, uses: [{ id: 'earLeftShape', property: 'fill' }, { id: 'earRightShape', property: 'fill' }, { id: 'head', property: 'fill' }, { id: 'lidUpperLeft', property: 'fill' }] });
  const outline = palette.tokens.find((entry) => entry.token === 'outline');
  assert.deepEqual(outline.uses.map((use) => `${use.id}.${use.property}`), ['earLeftEdge.stroke', 'head.stroke', 'lidUpperLeft.stroke', 'rimLeft.stroke']);
  const white = palette.tokens.find((entry) => entry.token === 'eyeWhite');
  assert.deepEqual(white.uses.map((use) => use.id), ['eyeWhiteLeft', 'glintLeft', 'eyeWhiteRight'], 'the glint is painted like the white, so it is the white; case does not matter');
  assert.deepEqual(palette.other, [{ colour: '#b4525c', uses: [{ id: 'mouth', property: 'stroke' }] }, { colour: '#bd8763', uses: [{ id: 'nose', property: 'stroke' }] }, { colour: '#c8874f', uses: [{ id: 'hairTop', property: 'fill' }] }], 'the lip line, the nose line and the crown\'s highlight belong to no token');
  assert.deepEqual(tokenWrites(palette, 'skin', ' #88cc88 '), [{ id: 'earLeftShape', property: 'fill', value: '#88cc88' }, { id: 'earRightShape', property: 'fill', value: '#88cc88' }, { id: 'head', property: 'fill', value: '#88cc88' }, { id: 'lidUpperLeft', property: 'fill', value: '#88cc88' }]);
  assert.deepEqual(tokenWrites(palette, 'skinShadow', '#000'), [], 'not on this face');
  assert.deepEqual(tokenWrites(palette, 'skin', 'none'), [], 'none is not a colour');
  assert.deepEqual(derivePalette({}, []), { tokens: [], other: [] });
});

test('an asset is painted in the face\'s colours: its paints that play a token take the token\'s colour', () => {
  const palette = derivePalette(template(), PAINTS.map((paint) => (paint.id === 'head' ? { id: 'head', fill: '#88cc88', stroke: '#224422' } : paint)));
  const { markup, tinted } = tintArtwork(HEAD_ROUND.artwork, HEAD_ROUND.paletteRoles, palette);
  assert.match(markup, /<path id="skull" data-name="Skull" d="[^"]*" fill="#88cc88" stroke="#224422" stroke-width="4" \/>/);
  assert.deepEqual(tinted, [{ id: 'skull', property: 'fill', token: 'skin', colour: '#88cc88' }, { id: 'skull', property: 'stroke', token: 'outline', colour: '#224422' }]);
  // A token the face has no colour for leaves the asset's own paint; an attribute the asset lacks is added.
  const bare = tintArtwork('<g id="x"><path id="p" d="M0 0"/><path id="q" d="M1 1" fill="red"/></g>', { p: { fill: 'skin', stroke: 'accessoryPrimary' }, q: { fill: 'skinShadow' }, nope: { fill: 'skin' } }, palette);
  assert.equal(bare.markup, '<g id="x"><path id="p" d="M0 0" fill="#88cc88"/><path id="q" d="M1 1" fill="red"/></g>');
  assert.deepEqual(bare.tinted.map((item) => `${item.id}.${item.property}`), ['p.fill']);
  assert.equal(tintArtwork("<path id='p' fill='blue'/>", { p: { fill: 'skin' } }, palette).markup, "<path id='p' fill=\"#88cc88\"/>", 'single quotes are replaced too');
  assert.deepEqual(paletteRoleTokens({ a: { fill: 'skin', stroke: 'outline' }, b: { fill: 'skin' } }), ['skin', 'outline']);
  assert.deepEqual(tintArtwork('', {}, null), { markup: '', tinted: [] });
});
