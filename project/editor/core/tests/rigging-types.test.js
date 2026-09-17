import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RIGGING, RIGGING_IDS, RIGGING_TYPES, normalizeRigging, riggingChoices, riggingIssues, riggingRefusal, suggestedRigging } from '../rig/rigging-types.js';
import { createProjectDocument } from '../state/project-document.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';

/**
 * How a piece moves, chosen when the piece is added
 * (V5-02, docs/V5_MASCOTTE_IMAGES_ETUDE.md).
 *
 * The editor already had this choice, per movement, under Rig ▸ Advanced,
 * after the piece had been assigned a role and a driver. This is the same
 * decision made once, about the piece, in the sentence an author already has
 * in their head when they drop a file.
 */

test('five ways a piece can move, and each is one sentence', () => {
  assert.deepEqual(RIGGING_IDS, ['fixed', 'rigid', 'bend', 'states', 'outline']);
  for (const type of RIGGING_TYPES) {
    assert.ok(type.label && type.hint && type.use, `${type.id} has to read as a sentence, not a setting`);
    assert.equal(/shape key|binding|mesh|driver|transform/i.test(`${type.label} ${type.hint}`), false,
      `${type.id} explains itself in the author's words, not the engine's`);
  }
});

test('a picture has no outline, and is told so rather than offered nothing', () => {
  assert.equal(riggingRefusal('outline', 'image'), 'A picture has no outline to reshape — its shape is its pixels.');
  assert.equal(riggingRefusal('outline', 'path'), '');
  assert.equal(riggingRefusal('bend', 'image'), '', 'bending a picture is what a mesh is for');
  assert.match(riggingRefusal('nonsense', 'path'), /is not a way a piece can move/);

  // Offered with the reason, not dropped: an absent option reads as a missing
  // one, a present option with its reason reads as an answer.
  const choices = riggingChoices('image');
  assert.equal(choices.length, RIGGING_TYPES.length);
  assert.deepEqual(choices.filter((choice) => !choice.allowed).map((choice) => choice.id), ['outline']);
  assert.ok(choices.find((choice) => choice.id === 'outline').refusal);
  assert.deepEqual(riggingChoices('path').filter((choice) => !choice.allowed), []);
});

test('a role arrives with an answer, and it is only ever a proposal', () => {
  assert.equal(suggestedRigging('mouth'), 'states');
  assert.equal(suggestedRigging('leftEye'), 'states');
  assert.equal(suggestedRigging('leftEar'), 'bend');
  assert.equal(suggestedRigging('head'), 'rigid');
  assert.equal(suggestedRigging(''), DEFAULT_RIGGING, 'a piece with no role still moves as one');
  assert.equal(suggestedRigging('whatever'), DEFAULT_RIGGING);
  // A picture never arrives proposing something it cannot have.
  assert.equal(riggingRefusal(suggestedRigging('mouth', 'image'), 'image'), '');
});

test('a piece always has an answer, even if the answer is "not at all"', () => {
  assert.equal(normalizeRigging('bend', 'image'), 'bend');
  assert.equal(normalizeRigging('outline', 'image'), DEFAULT_RIGGING, 'asked for what it cannot have, it moves as one piece');
  assert.equal(normalizeRigging('outline', 'path'), 'outline');
  for (const junk of [undefined, null, '', '   ', 42, 'morph']) assert.equal(normalizeRigging(junk, 'path'), DEFAULT_RIGGING);
});

// ---------------------------------------------------------------------------
// What the document carries
// ---------------------------------------------------------------------------

const piece = (over = {}) => ({ baseTransform: { x: 0, y: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' }, ...over });
const set = (target) => ({ target, states: [{ id: 'a', element: `${target}A` }, { id: 'b', element: `${target}B` }] });

test('rigging and state sets are part of the document, the rig and the export', () => {
  const document = createProjectDocument({
    svgMarkup: '<svg><g id="mouth"/></svg>',
    elements: { mouth: piece({ rigging: 'states' }), head: piece() },
    partStates: [set('mouth')]
  });
  assert.equal(document.partStates.length, 1);
  assert.deepEqual(document.partStates[0].states.map((state) => state.element), ['mouthA', 'mouthB']);

  const rig = normalizeRig({ params: {}, states: {}, elements: document.elements, partStates: document.partStates });
  assert.equal(rig.elements.mouth.rigging, 'states');
  // Every element written before this reads as `rigid`, which is what they all
  // were: nothing in the document says otherwise and nothing has to be migrated.
  assert.equal(rig.elements.head.rigging, 'rigid');
  assert.equal(rig.partStates.length, 1);

  // The exported mascot has to be able to blink, so the sets ship.
  const exported = createExportRig({ ...document, params: {}, states: { idle: {} }, activeState: 'idle' });
  assert.equal(exported.partStates.length, 1);
  assert.ok(exported.requires.includes('part:states'));
});

test('a disagreement is reported, never repaired', () => {
  const document = (over) => createProjectDocument({ svgMarkup: '<svg/>', ...over });

  // Half-finished work, not a broken file: rewriting it to `rigid` would throw
  // away the answer its author already gave.
  const promised = document({ elements: { mouth: piece({ rigging: 'states' }) } });
  assert.deepEqual(riggingIssues(promised).map((issue) => issue.kind), ['states-without-drawings']);
  assert.equal(promised.elements.mouth.rigging, 'states', 'and it is left saying what it says');

  const orphan = document({ elements: { head: piece() }, partStates: [set('mouth')] });
  assert.deepEqual(riggingIssues(orphan).map((issue) => issue.kind), ['drawings-without-piece']);

  const unused = document({ elements: { mouth: piece({ rigging: 'rigid' }) }, partStates: [set('mouth')] });
  assert.deepEqual(riggingIssues(unused).map((issue) => issue.kind), ['drawings-not-used']);

  const impossible = document({ elements: { photo: piece({ rigging: 'outline', meta: { nodeType: 'image' } }) } });
  assert.deepEqual(riggingIssues(impossible).map((issue) => issue.kind), ['rigging-impossible']);

  // The whole thing agreeing says nothing at all.
  assert.deepEqual(riggingIssues(document({ elements: { mouth: piece({ rigging: 'states' }) }, partStates: [set('mouth')] })), []);
  assert.deepEqual(riggingIssues({}), []);
});
