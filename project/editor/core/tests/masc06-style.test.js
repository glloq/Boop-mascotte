import test from 'node:test';
import assert from 'node:assert/strict';
import { styleBrowserMarkup } from '../../ui/character-builder/style-browser.js';
import { describeRestylePlan, restylePlan } from '../face-library/compatibility.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { CHARACTER_CATEGORY_IDS, characterCategory } from '../../ui/character-builder/character-model.js';

/**
 * MASC-06 — Style in Design ▸ Face.
 *
 * The bargain, in one sentence: a style redraws the parts somebody has drawn
 * in it and **keeps** every other one. Nothing is taken off a face because
 * nobody has drawn its replacement yet, and the count an author is shown is
 * always both halves — one told only what moved would read what stayed as
 * something lost.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace('.', '-');
  const role = { mouth: 'mouth', head: 'head', nose: 'nose' }[category] || 'element';
  return { id, category, name: id, artwork: `<g id="${root}"><path id="${root}-a" d="M0 0h10"/></g>`, roles: { [role]: `${root}-a` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra };
};

const wearing = (pairs) => ({
  elements: Object.fromEntries(pairs.map(([, , root]) => [root, {}])),
  semanticParts: Object.fromEntries(pairs.map(([type, assetId, root], index) => [`p${index}`, { id: `p${index}`, type, assetId, assetRoot: root }]))
});

test('the card says how much of this face a style can redraw, before it is pressed', () => {
  const markup = styleBrowserMarkup({
    loaded: true,
    styles: [
      { id: 'soft-cartoon', label: 'Soft Cartoon', description: 'Rounded.', restyled: 7, total: 9 },
      { id: 'woodcut', label: 'Woodcut', description: 'Carved.', restyled: 0, total: 9 },
      { id: 'flat', label: 'Flat', description: 'Flat.', restyled: 0, total: 0 }
    ]
  });
  assert.match(markup, /7 of 9 library parts can be redrawn/);
  // Two different nothings, said differently: a style nobody has drawn in, and
  // a face with nothing from the library on it at all. A card that conflated
  // them would send an author looking for the wrong missing thing.
  assert.match(markup, /Nothing on this face is drawn this way yet/);
  assert.match(markup, /Nothing on this face comes from the library yet/);
  assert.match(markup, /data-face-style="woodcut"[^>]*disabled/);
  assert.match(markup, /data-face-style="soft-cartoon"(?![^>]*disabled)/);
  // And the promise the row is making, in the row.
  assert.match(markup, /leaves the rest exactly as they are/);
  assert.match(styleBrowserMarkup({ loaded: false }), /Start from a face before choosing a style/);
});

test('a restyle counts both halves, and the sentence never reports only the good one', () => {
  const library = createFacePartRegistry();
  library.registerMany([
    part('head.round', 'head'),
    part('head.round-soft', 'head', { variant: { of: 'head.round', style: 'soft-cartoon' } }),
    part('nose.button', 'nose'),
    part('mouth.small', 'mouth'),
    part('mouth.small-soft', 'mouth', { variant: { of: 'mouth.small', style: 'soft-cartoon' } })
  ]);
  const face = wearing([['head', 'head.round', 'h'], ['nose', 'nose.button', 'n'], ['mouth', 'mouth.small', 'm']]);

  const plan = restylePlan(face, 'soft-cartoon', { library });
  assert.deepEqual(plan.replace.map((step) => `${step.from}→${step.to}`), ['head.round→head.round-soft', 'mouth.small→mouth.small-soft']);
  assert.deepEqual(plan.kept.map((step) => step.assetId), ['nose.button'], 'the nose nobody restyled is kept, never removed');
  assert.equal(describeRestylePlan(plan), '2 parts restyled, 1 kept as it is.');

  // The notice the builder shows is built from the counts the command returns,
  // so it cannot say one thing while the face does another.
  assert.equal(describeRestylePlan({ replace: Array.from({ length: 2 }), kept: Array.from({ length: 1 }) }), '2 parts restyled, 1 kept as it is.');
  assert.equal(describeRestylePlan({ replace: [], kept: Array.from({ length: 3 }) }), 'Nothing is drawn in this style yet, so all 3 parts stay as they are.');
});

test('Style is a row of its own, after Type', () => {
  assert.deepEqual([...CHARACTER_CATEGORY_IDS].slice(0, 4), ['presets', 'type', 'style', 'palette']);
  assert.equal(characterCategory('style').kind, 'style');
  assert.ok(characterCategory('style').hint.includes('keeping everything nobody has drawn yet'));
});
