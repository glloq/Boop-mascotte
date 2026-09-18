import test from 'node:test';
import assert from 'node:assert/strict';
import { ROBOT_FACE_PARTS } from '../face-library/builtin/robots/index.js';
import { NARROWED } from './fixtures/face-packs.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { FACE_PALETTES, FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';
import { PALETTE_TOKENS } from '../face-library/face-part-model.js';
import { assetSlot, compatibleMorphologies, morphologySlots } from '../face-library/face-morphologies.js';
import { availableMorphologies, presetsFor } from '../face-library/compatibility.js';
import { reviewAssets } from '../face-library/face-asset-review.js';

/**
 * MASC-11B — the Soft Cartoon robot pack, as the library sees it.
 *
 * `masc11a-robot-pilot.test.js` holds the pack to the brief: every planned
 * family drawn, under the planned name, in the planned slot, and four recipes
 * worn as four presets. This file asks the other question — whether a pack of
 * *machines* is a well-behaved citizen of a library that was built for faces.
 *
 * That is a sharper question than it was for the animals. A cat is a person
 * with different proportions; a robot has no nose, no hair, no jaw and no
 * pupils in the sense the word was coined for. If the library can hold one
 * without a special case, the slots and the categories were drawn at the right
 * level — and if it cannot, this is where that shows.
 */

const TYPES = ['screen', 'retro', 'industrial', 'toy'];
const PRESETS = TYPES.map((type) => `robot-${type}`);
const part = (id) => ROBOT_FACE_PARTS.find((asset) => asset.id === id);
const ids = new Set(ROBOT_FACE_PARTS.map((asset) => asset.id));

test('the pack is twenty-eight drawings in the categories the library already had', () => {
  assert.equal(ROBOT_FACE_PARTS.length, 28, 'one per family the planche labels');
  assert.ok(BUILTIN_FACE_PARTS.length >= 120, 'the 47 people, the 45 animals, these, and whatever arrived since');
  const categories = {};
  for (const asset of ROBOT_FACE_PARTS) categories[asset.category] = (categories[asset.category] || 0) + 1;
  assert.deepEqual(categories, { head: 4, ears: 4, eyes: 4, eyebrows: 4, mouth: 4, accessory: 8 },
    'seven rows, four kinds, and not one new category');
  for (const asset of ROBOT_FACE_PARTS) {
    assert.equal(asset.origin, 'builtin');
    assert.ok(Object.isFrozen(asset), `${asset.id} is frozen`);
    assert.ok(FACE_PART_LIBRARY.has(asset.id), `${asset.id} is in the library`);
  }
});

test('the pack narrows to machines, and narrows nothing that was here before it', () => {
  for (const asset of ROBOT_FACE_PARTS) assert.deepEqual(compatibleMorphologies(asset), ['robot'], asset.id);
  // The packs between them are the whole of what narrows, and each to one kind.
  const narrowed = FACE_PART_LIBRARY.list().filter((asset) => asset.morphologies?.length).map((asset) => asset.id);
  assert.deepEqual(narrowed.sort(), [...NARROWED.keys()].sort());
  // The antennae and the panels are accessories to the rig and rows of their
  // own on screen -- the same arrangement the muzzles and whiskers use, and the
  // first drawings either slot has ever had.
  const slotted = ROBOT_FACE_PARTS.filter((asset) => assetSlot(asset) !== asset.category);
  assert.deepEqual(slotted.map((asset) => `${asset.id} -> ${assetSlot(asset)}`), [
    'accessory.antenna-single-short -> antenna', 'accessory.antenna-retro-multi -> antenna',
    'accessory.antenna-industrial-robust -> antenna', 'accessory.antenna-toy-fun -> antenna',
    'accessory.panels-light-panel -> panels', 'accessory.panels-retro-buttons -> panels',
    'accessory.panels-warning-stripe -> panels', 'accessory.panels-toy-buttons -> panels'
  ]);
  for (const asset of slotted) assert.equal(asset.category, 'accessory', `${asset.id} installs as what the rig understands`);
});

test('drawing the antenna and the panel turned the Robot kind of face on', () => {
  // MASC-05's mechanism, twice now. `antenna` and `panels` have been in
  // FACE_SLOTS since MASC-01 and empty ever since; nobody wrote
  // `robot: available` anywhere, and the row turned itself on the moment the
  // first of each existed.
  const kinds = availableMorphologies({ library: FACE_PART_LIBRARY });
  assert.equal(kinds.find((kind) => kind.id === 'robot').available, true);
  assert.deepEqual(kinds.find((kind) => kind.id === 'robot').missing, []);
  assert.deepEqual(kinds.find((kind) => kind.id === 'robot').distinctive, ['antenna', 'panels'], 'and those two are what makes one');
  // Monster still says what it wants, which is the mechanism working rather
  // than a gap: a kind nobody can draw is a promise the row would be making on
  // somebody else's behalf.
  assert.deepEqual(kinds.find((kind) => kind.id === 'monster').missing, ['horns']);
});

/* ── The two mapping decisions, and whether they earned their keep ──────── */

test('a module where an ear goes behaves exactly as an ear, which is why it is one', () => {
  // MASC-11A's blocking decision: the Modules latéraux row went to `ears`
  // rather than to `panels`, and the whole argument was that it buys the
  // control for nothing. This is that argument, checkable.
  const modules = ROBOT_FACE_PARTS.filter((asset) => asset.category === 'ears');
  assert.equal(modules.length, 4);
  for (const module of modules) {
    assert.deepEqual(module.capabilities, ['earWiggle'], `${module.id} wiggles, as a module bolted to a case should`);
    assert.deepEqual(Object.keys(module.roles), ['leftEar', 'rightEar']);
    assert.equal(module.mountPoint, 'ears');
    // And it says nothing about the turn, because there is nothing to say: it
    // sits where a person's ear sits, so it takes the reading a person's ear
    // takes. `tests/fixtures/head-turn-baseline.js` records that these sign as
    // `ears.round` exactly -- the decision confirming itself.
    assert.equal(module.turn, undefined, `${module.id} declares a profile it does not need`);
  }
  // Same for the visor: a plate over the eyes raises and tilts, which is what
  // `eyebrows` is.
  const visors = ROBOT_FACE_PARTS.filter((asset) => asset.category === 'eyebrows');
  assert.equal(visors.length, 4);
  for (const visor of visors) {
    assert.deepEqual(visor.capabilities, ['browRaise', 'browTilt'], visor.id);
    assert.deepEqual(Object.keys(visor.roles), ['leftBrow', 'rightBrow'], `${visor.id} is two halves, so the two can raise on their own`);
  }
  // And the morphology offers both rows, which it did not before MASC-11B.
  const offered = morphologySlots('robot').map((slot) => slot.id);
  for (const slot of ['ears', 'eyebrows']) assert.ok(offered.includes(slot), `a robot face is offered its ${slot}`);
});

test('the lit element is the pupil, so a lamp is a whole eye set', () => {
  // MASC-10A's open question, answered. A bare pair of lamps could not be an
  // eye set: an eye set is the part that *holds* the gaze and the eyelids, and
  // swapping in one that brought neither would take the pupils off the face.
  // So the light is the pupil, the bezel is the socket that clips it, and the
  // housing shutters are the lids.
  const eyes = ROBOT_FACE_PARTS.filter((asset) => asset.category === 'eyes');
  assert.equal(eyes.length, 4);
  for (const set of eyes) {
    assert.deepEqual(set.parts.gaze.capabilities, ['lookX', 'lookY', 'pupilScale'], `${set.id}: the light moves inside its housing`);
    assert.deepEqual(set.parts.gaze.roles, { leftPupil: 'pupilLeft', rightPupil: 'pupilRight' });
    assert.deepEqual(set.capabilities, ['eyeOpen'], `${set.id}: and the housing closes`);
    assert.equal(Object.keys(set.parts.eyelids.roles).length, 4);
    assert.ok(set.parts.eyelids.drivers.eyeOpen, `${set.id} has lids that travel`);
    // The token pair is the same for all four; what differs is which way round
    // the palette paints it, which is how a lamp and a cartoon eye come out of
    // one drawing contract.
    assert.deepEqual([...set.palette].sort(), ['eyeWhite', 'outline', 'pupil', 'skin']);
  }
  // Which the palettes then invert, and that inversion is the whole difference
  // between a screen robot's lamp and a toy robot's eye.
  assert.equal(FACE_PALETTES['robot-screen'].eyeWhite, '#23272e', 'cyan on near-black');
  assert.equal(FACE_PALETTES['robot-toy'].eyeWhite, '#ffffff', 'near-black on white');
  assert.notEqual(FACE_PALETTES['robot-screen'].pupil, FACE_PALETTES['robot-toy'].pupil);
});

test('a shell has no jaw, and nothing in the library minds', () => {
  // Every other head ships a `jaw` part: the same outline drawn twice, at rest
  // and with its chin stretched down by `jawOpen`. A bolted plate does not
  // stretch, and a control that makes a machine look like it is chewing is a
  // control nobody wanted. So `jawOpen` moves nothing on a robot face -- which
  // is what a rigid head *means*, rather than something the rig is told.
  const shells = ROBOT_FACE_PARTS.filter((asset) => asset.category === 'head');
  assert.equal(shells.length, 4);
  for (const shell of shells) {
    assert.equal(shell.parts?.jaw, undefined, `${shell.id} ships a jaw it cannot move`);
    assert.deepEqual(shell.capabilities, ['headX', 'headY', 'headTilt']);
    assert.deepEqual(Object.keys(shell.roles), ['head']);
  }
  // And it is the only category in the library where that is true, so the
  // absence reads as a decision rather than as an oversight.
  const jawless = FACE_PART_LIBRARY.list('head').filter((asset) => !asset.parts?.jaw).map((asset) => asset.id);
  assert.deepEqual(jawless.sort(), shells.map((shell) => shell.id).sort());
});

test('a speaker is a mouth, and no new control was invented anywhere in the pack', () => {
  for (const speaker of ROBOT_FACE_PARTS.filter((asset) => asset.category === 'mouth')) {
    for (const control of ['mouthOpen', 'smile', 'mouthWidth']) {
      assert.ok(speaker.capabilities.includes(control), `${speaker.id} carries ${control}, as a person's mouth does`);
    }
  }
  // The whole pack, against the controls the library already had: not one of
  // the twenty-eight claims anything a human drawing could not have claimed.
  const known = new Set(FACE_PART_LIBRARY.list().filter((asset) => !ids.has(asset.id) && !asset.morphologies?.includes('beak')).flatMap((asset) => [
    ...asset.capabilities, ...Object.values(asset.parts || {}).flatMap((drawn) => drawn.capabilities || [])
  ]));
  for (const asset of ROBOT_FACE_PARTS) {
    for (const control of [...asset.capabilities, ...Object.values(asset.parts || {}).flatMap((drawn) => drawn.capabilities || [])]) {
      assert.ok(known.has(control), `${asset.id} claims ${control}, which nothing else in the library has`);
    }
  }
});

test('the two accessory rows say how they turn, because nothing else could say it for them', () => {
  // An accessory that says nothing about the 2.5D turn does not turn at all,
  // and no row of the role table could ever answer for one -- `element` is the
  // role every accessory plays. An antenna stands well off the crown and
  // sweeps; a panel is flush with the shell and barely moves against it.
  for (const asset of ROBOT_FACE_PARTS.filter((item) => assetSlot(item) === 'antenna')) {
    assert.deepEqual(asset.turn.element, { depth: 0.35, side: null, narrow: true }, asset.id);
    assert.equal(asset.mountPoint, 'head.top', `${asset.id} stands on the crown, where MASC-09 proposed`);
  }
  for (const asset of ROBOT_FACE_PARTS.filter((item) => assetSlot(item) === 'panels')) {
    assert.deepEqual(asset.turn.element, { depth: 0.08, side: null, narrow: true }, asset.id);
    assert.equal(asset.mountPoint, 'head.center', `${asset.id} lies on the shell`);
  }
  // Everything else in the pack is what its category already says it is.
  const declared = ROBOT_FACE_PARTS.filter((asset) => asset.turn).map((asset) => asset.category);
  assert.deepEqual([...new Set(declared)], ['accessory'], 'only the accessories had anything to declare');
});

test('a panel paints over the shell, and that costs nothing: the muzzle problem inverted', () => {
  // A panel is drawn at `head.center` -- the same anchor the shell uses -- and
  // has to be *on top of* it. An accessory installed with nothing before it
  // lands last in its group, which is exactly where a panel wants to be. The
  // muzzle needed the opposite and the animal pack solved it by laying the
  // pieces out in bands; here there was nothing to solve, and it is worth
  // writing down that the two are the same question with opposite answers.
  const panels = ROBOT_FACE_PARTS.filter((asset) => assetSlot(asset) === 'panels');
  assert.equal(panels.length, 4);
  for (const panel of panels) {
    assert.deepEqual(panel.behind, undefined, `${panel.id} asks to be painted behind something`);
    assert.deepEqual(panel.capabilities, [], 'a panel is a marking, not a control');
    // Off the centre line, so the mouth keeps the middle of the face.
    assert.ok(panel.referenceBox.x + panel.referenceBox.width < 100, `${panel.id} crowds the mouth`);
  }
});

/* ── Four kinds, over one set of rows ──────────────────────────────────── */

test('the four robots are four recipes, and nothing is shared between them', () => {
  for (const id of PRESETS) {
    const preset = FACE_PRESET_LIBRARY.get(id);
    assert.ok(preset, `${id} is registered`);
    assert.equal(preset.morphology, 'robot');
    assert.ok(preset.tags.includes('robot'));
    assert.equal(preset.parts.nose, undefined, `${id} is a machine, and the planche draws no nose`);
    assert.equal(preset.parts.hair, undefined, `${id} has an antenna where hair would be`);
    for (const asset of [...Object.values(preset.parts), ...preset.accessories]) {
      assert.ok(ids.has(asset), `${id} names ${asset}, which is not in the pack`);
    }
  }
  // Unlike the animals, nothing is shared -- and that is a finding rather than
  // a failure. A fox and a wolf share their eyes because they are both canids;
  // a screen robot and an industrial one share nothing because the four columns
  // of the planche are four visual languages.
  const named = PRESETS.flatMap((id) => {
    const preset = FACE_PRESET_LIBRARY.get(id);
    return [...Object.values(preset.parts), ...preset.accessories];
  });
  assert.equal(named.length, 28, 'five parts and two accessories each');
  assert.equal(new Set(named).size, 28, 'and every drawing in the pack is wanted by exactly one of them');
  assert.deepEqual(named.slice().sort(), ROBOT_FACE_PARTS.map((asset) => asset.id).sort());
});

test('four palettes, no new token, and nothing named for a colour', () => {
  for (const id of PRESETS) {
    const palette = FACE_PALETTES[FACE_PRESET_LIBRARY.get(id).palette];
    assert.ok(palette, `${id} paints in a palette that exists`);
    assert.deepEqual(Object.keys(palette), [...PALETTE_TOKENS], 'every token a colour, as every palette has');
  }
  // The thirteenth arrived for the iris build and not for a machine: a robot's
  // eye is a lit element in a housing, not a ring of colour round a pupil, and
  // nothing in this pack paints with it.
  assert.equal(PALETTE_TOKENS.length, 13, 'and none of them added by a machine');
  assert.deepEqual(ROBOT_FACE_PARTS.filter((asset) => asset.palette.includes('iris')), []);
  // The rule the variant question rests on: nothing is drawn twice for a
  // colour, and no id carries one. Which matters more here than it did for the
  // animals, because the planche's own triples are partly colour runs.
  for (const asset of ROBOT_FACE_PARTS) {
    assert.doesNotMatch(asset.id, /cream|red|blue|yellow|green|grey|gray|orange|pink|white|black/,
      `${asset.id} is named for a colour, and a colour is a palette`);
  }
});

test('a robot face is offered the machines and the universal drawings, and no animal', () => {
  assert.deepEqual(presetsFor({ morphology: 'robot' }).map((item) => item.id), PRESETS);
  // `robot` the preset stays with the people, and that is right: it is a square
  // head and a bow tie, with neither an antenna nor a panel on it.
  assert.ok(presetsFor({ morphology: 'human' }).map((item) => item.id).includes('robot'));
  assert.ok(FACE_PRESET_LIBRARY.size >= 16);
});

test('every drawing in the pack places, and the review sheet has nothing to say about any of them', () => {
  const reviewed = reviewAssets({ morphology: 'robot' }).filter((item) => ids.has(item.id));
  assert.equal(reviewed.length, 28, 'every one of them is reviewed');
  assert.deepEqual(reviewed.filter((item) => item.geometryIssues.length).map((item) => `${item.id}: ${item.geometryIssues.map((issue) => issue.code).join(', ')}`), []);
  for (const item of reviewed) assert.ok(item.fit, `${item.id} has a fit onto the template`);
  // The antennae are the ones to watch: they stand above the crown, into the
  // sixty units of headroom the artboard keeps above y 0.
  assert.ok(part('accessory.antenna-toy-fun').referenceBox.y < 0, 'the star stands in the headroom above the artboard');
});
