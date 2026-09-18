import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BIRD_HEADS } from '../face-library/builtin/birds/heads.js';
import { TOKEN_SEEDS, isColour } from '../face-library/palette-model.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { PALETTE_TOKENS, facePartCategory } from '../face-library/face-part-model.js';
import { assetSlot, compatibleMorphologies, morphologySlots } from '../face-library/face-morphologies.js';

/**
 * MASC-12C — the bird heads against the delivered reference.
 *
 * Four painted face backgrounds were delivered into `art/planches/` — owl,
 * duck, parrot, crow. They are art direction, not assets: nothing imports them
 * and nothing builds them. This file is what makes them binding anyway.
 *
 * The pack builds a head from a width rule, and the reference paints one. The
 * test that matters is whether the two describe the same bird: sample each
 * delivered silhouette and the head this pack ships for it at the same heights,
 * and compare how wide they are. A head redrawn away from the art direction
 * fails here, and the failure names the species and the height.
 *
 * The rest of this file pins the two reasons the reference could only be read
 * for structure, so that neither is re-litigated by accident:
 *
 * - a gradient is not a paint the palette can hold, and
 * - a `beak` face seeds seven of the twelve tokens, so a bird head has exactly
 *   one skin tone to spend.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANCHES = join(HERE, '..', '..', '..', '..', 'art', 'planches');

/** The outer silhouette each delivered file draws, and the head it is for. */
const DELIVERED = Object.freeze({
  'head.bird-owl': { file: 'owl-face-background-only-v7.svg', outline: 'skull-base' },
  'head.bird-duck': { file: 'duck-face-background-only-v3.svg', outline: 'head-base' },
  'head.bird-parrot': { file: 'parrot-face-background-only-v1.svg', outline: 'skull-base' },
  'head.bird-crow': { file: 'crow-face-background-only-v1.svg', outline: 'skull-base' }
});

const head = (id) => BIRD_HEADS.find((asset) => asset.id === id);
const pathOf = (markup, id) => /\sd="([^"]*)"/.exec(new RegExp(`<path[^>]*\\sid="${id}"[\\s\\S]*?/>`).exec(markup)[0])[1];

/** A path of absolute moves and cubics as a polyline. Enough for these files and ours. */
function flatten(d) {
  const tokens = d.match(/[MCLZ]|-?[\d.]+/g) || [];
  const points = [];
  let at = null, start = null, index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === 'M') { at = [+tokens[index + 1], +tokens[index + 2]]; start = at; points.push(at); index += 3; }
    else if (token === 'L') { at = [+tokens[index + 1], +tokens[index + 2]]; points.push(at); index += 3; }
    else if (token === 'C') {
      const [a, b, c] = [[+tokens[index + 1], +tokens[index + 2]], [+tokens[index + 3], +tokens[index + 4]], [+tokens[index + 5], +tokens[index + 6]]];
      for (let step = 1; step <= 24; step += 1) {
        const t = step / 24, u = 1 - t;
        points.push([
          u * u * u * at[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * c[0],
          u * u * u * at[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * c[1]
        ]);
      }
      at = c; index += 7;
    } else if (token === 'Z') { points.push(start); index += 1; } else index += 1;
  }
  return points;
}

/** How far the outline reaches from the face's middle at this height. */
function halfWidth(points, y) {
  let widest = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, y0] = points[index], [x1, y1] = points[index + 1];
    if (y0 === y1 || (y0 - y) * (y1 - y) > 0) continue;
    widest = Math.max(widest, Math.abs(x0 + ((x1 - x0) * (y - y0)) / (y1 - y0) - 120));
  }
  return widest;
}

const extent = (points, axis) => {
  const values = points.map((point) => point[axis]);
  return [Math.min(...values), Math.max(...values)];
};

test('the four delivered planches are still there, and still say what they are for', () => {
  const files = new Set(readdirSync(PLANCHES));
  for (const { file } of Object.values(DELIVERED)) {
    assert.ok(files.has(file), `${file} is gone from art/planches`);
    const markup = readFileSync(join(PLANCHES, file), 'utf8');
    // Each file says in its own words that it is a background and nothing else.
    assert.match(markup, /No (?:ears, )?eyes, beak/i, `${file} no longer declares itself a bare background`);
  }
});

test('every head this pack ships is the width the reference paints, at every height', () => {
  for (const [id, { file, outline }] of Object.entries(DELIVERED)) {
    const reference = flatten(pathOf(readFileSync(join(PLANCHES, file), 'utf8'), outline));
    const drawn = flatten(pathOf(head(id).artwork, 'skull'));
    const [refTop, refBottom] = extent(reference, 1), [top, bottom] = extent(drawn, 1);
    // The crown and the chin first: a head that stops at a person's chin is the
    // mistake this whole milestone exists to correct.
    assert.ok(Math.abs(refTop - top) <= 6, `${id}: crown at ${top.toFixed(1)}, reference ${refTop.toFixed(1)}`);
    assert.ok(Math.abs(refBottom - bottom) <= 6, `${id}: chin at ${bottom.toFixed(1)}, reference ${refBottom.toFixed(1)}`);
    // Then the width all the way down, skipping the last tenth at each end where
    // both curves are turning through the vertical and a width is meaningless.
    let worst = 0, worstAt = 0;
    for (let step = 2; step <= 18; step += 1) {
      const y = refTop + ((refBottom - refTop) * step) / 20;
      const gap = Math.abs(halfWidth(reference, y) - halfWidth(drawn, y));
      if (gap > worst) { worst = gap; worstAt = y; }
    }
    assert.ok(worst <= 3, `${id}: ${worst.toFixed(1)} units off the reference at y ${worstAt.toFixed(0)}`);
  }
});

test('the two species with no reference are still the family the other four describe', () => {
  const referenced = Object.keys(DELIVERED).map((id) => head(id).referenceBox);
  const tallest = Math.max(...referenced.map((box) => box.height));
  for (const id of ['head.bird-cute', 'head.bird-slim']) {
    const box = head(id).referenceBox;
    assert.ok(box.height >= 180, `${id} is ${box.height} tall; the reference heads run to ${tallest}`);
  }
});

test('the brow band is the family mark: every head carries one, and it is a line', () => {
  for (const asset of BIRD_HEADS) {
    assert.match(asset.artwork, /id="brow"/, `${asset.id} has no brow band`);
    assert.match(asset.artwork, /id="brow"[^>]*fill="none"/, `${asset.id} fills its brow band; it is an arc, not a shape`);
    assert.deepEqual(asset.paletteRoles.brow, { stroke: 'outline' });
  }
});

test('the owl is the only head carrying a species mark, and it is the facial discs', () => {
  const marked = BIRD_HEADS.filter((asset) => /id="disc|id="patch|id="billRoot/.test(asset.artwork));
  assert.deepEqual(marked.map((asset) => asset.id), ['head.bird-owl']);
  for (const side of ['discLeft', 'discRight']) {
    assert.deepEqual(head('head.bird-owl').paletteRoles[side], { fill: 'skin', stroke: 'outline' });
  }
});

test('no bird head paints with anything the palette cannot hold', () => {
  for (const asset of BIRD_HEADS) {
    assert.doesNotMatch(asset.artwork, /url\(/, `${asset.id} references a paint server; a token writes a colour, not a url(...)`);
    assert.doesNotMatch(asset.artwork, /<(?:linear|radial)Gradient/, `${asset.id} defines a gradient`);
    for (const paint of asset.artwork.matchAll(/\s(?:fill|stroke)="([^"]*)"/g)) {
      assert.ok(paint[1] === 'none' || isColour(paint[1]), `${asset.id} paints with "${paint[1]}"`);
    }
  }
});

test('a beak face seeds eight of the thirteen tokens, so a bird head has one skin tone', () => {
  // Not asserted — counted. A token is seeded off one role of one semantic part
  // (`TOKEN_SEEDS`), a part reaches the face on an asset the morphology has a
  // slot for, and the role has to be one that asset actually plays. So walk
  // every drawing a beak face can hold and collect the roles it plays.
  const slots = new Set(morphologySlots('beak').map((slot) => slot.id));
  const placeable = FACE_PART_LIBRARY.list()
    .filter((asset) => compatibleMorphologies(asset).includes('beak') && slots.has(assetSlot(asset)));
  const played = new Set();
  for (const asset of placeable) {
    const own = facePartCategory(asset.category)?.part;
    if (own) for (const role of Object.keys(asset.roles || {})) played.add(`${own}.${role}`);
    for (const [type, part] of Object.entries(asset.parts || {})) {
      for (const role of Object.keys(part.roles || {})) played.add(`${type}.${role}`);
    }
  }
  const seeded = [...new Set(TOKEN_SEEDS.filter((seed) => played.has(`${seed.part}.${seed.role}`)).map((seed) => seed.token))].sort();

  // `iris` joined them without the pack changing: the eye row is the library's
  // three builds now, one of which draws an iris, and a bird that can wear it
  // can colour it (docs/EYE_BUILDS.md).
  assert.deepEqual(seeded, ['accessoryPrimary', 'accessorySecondary', 'eyeWhite', 'iris', 'mouth', 'outline', 'pupil', 'skin']);
  // `skinShadow` is read from a nose, `hair` and `hairShadow` from hair, and
  // `teeth` and `tongue` from roles a beak does not play. A bird has none of
  // those, so five of the thirteen swatches never appear on its face and the
  // drawings must not paint with them: the colour would simply stick.
  assert.deepEqual(PALETTE_TOKENS.filter((token) => !seeded.includes(token)),
    ['skinShadow', 'hair', 'hairShadow', 'tongue', 'teeth']);

  // Which is why every paint on every bird head is one of the two it can spend.
  assert.deepEqual([...new Set(BIRD_HEADS.flatMap((asset) => asset.palette))].sort(), ['outline', 'skin']);
});
