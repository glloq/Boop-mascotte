import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PILOT_ASSETS, PILOT_ID, PILOT_MORPHOLOGY, PILOT_OPEN_QUESTIONS, PILOT_PALETTES, PILOT_PRESETS,
  PILOT_REUSE, PILOT_REUSE_VERDICTS, PILOT_REVIEW_GROUPS, PILOT_SPECIES, PILOT_STATUSES, PILOT_STYLE,
  PILOT_SHEET, catalogueAssets, duplicateConcerns, pilotAsset, pilotAssets, pilotAssetsForSlot,
  pilotAssetsForSpecies, pilotPreset, pilotReuse, pilotSummary, presetAssetIds, presetCoverage
} from '../face-library/pilots/muzzle-soft-cartoon.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';
import { FACE_MOUNT_POINTS, FACE_TAG, facePartCategory } from '../face-library/face-part-model.js';
import { FACE_MORPHOLOGY_IDS, faceMorphology, faceSlot } from '../face-library/face-morphologies.js';
import { FACE_BASE_STYLE_ID } from '../face-library/face-styles.js';

/**
 * MASC-10A — the brief for the first animal faces.
 *
 * Nothing here is drawn and nothing here is registered: this is a cahier des
 * charges, and what the tests defend is that it is a *usable* one. Four
 * species must be four recipes over shared drawings rather than four
 * libraries; every planned id must be something the library could actually
 * hold; every recipe must name only things that will exist; and the shipped
 * library must be exactly as it was.
 */

const PLANNED = new Set(PILOT_ASSETS.map((item) => item.id));
const drawings = pilotAssets({ standalone: true });

/* ── The manifest is a manifest, not a library ─────────────────────────── */

test('not one production drawing is added, and not one preset is registered', () => {
  assert.equal(FACE_PART_LIBRARY.list().length, 47, 'the shipped library is exactly as it was');
  assert.equal(BUILTIN_FACE_PARTS.length, 47);
  for (const item of PILOT_ASSETS) {
    assert.equal(FACE_PART_LIBRARY.has(item.id), false, `${item.id} is planned, not registered`);
    assert.equal(BUILTIN_FACE_PARTS.some((asset) => asset.id === item.id), false, `${item.id} is not a built-in`);
  }
  for (const preset of PILOT_PRESETS) {
    assert.equal(FACE_PRESET_LIBRARY.has(preset.id), false, `${preset.id} is a recipe, not a preset`);
  }
  assert.deepEqual(FACE_PRESET_LIBRARY.list().map((item) => item.id), ['classic', 'professor', 'young', 'old', 'robot', 'minimal']);
  // And a planned entry is not a face part: the validator would refuse it,
  // which is the point — it has no artwork yet.
  assert.equal('artwork' in PILOT_ASSETS[0], false);
});

test('the pilot says which morphology and which style it is for', () => {
  assert.equal(PILOT_ID, 'muzzle-soft-cartoon');
  assert.equal(PILOT_MORPHOLOGY, 'muzzle');
  assert.ok(faceMorphology(PILOT_MORPHOLOGY), 'and it is a kind of face that exists');
  assert.equal(PILOT_STYLE, FACE_BASE_STYLE_ID, 'the style the library is drawn in: no -soft-cartoon twins');
  assert.equal(PILOT_SHEET, 'Soft Cartoon — Face Parts V1');
  assert.deepEqual([...PILOT_SPECIES], ['cat', 'dog', 'fox', 'bear', 'rabbit', 'wolf']);
  for (const species of PILOT_SPECIES) {
    assert.equal(FACE_MORPHOLOGY_IDS.includes(species), false, `${species} is a preset inside muzzle, never a morphology`);
  }
});

/* ── Every planned drawing is something the library could hold ─────────── */

test('every planned id is unique, well formed, and in a slot that exists', () => {
  assert.equal(new Set(PILOT_ASSETS.map((item) => item.id)).size, PILOT_ASSETS.length, 'no id twice');
  for (const item of PILOT_ASSETS) {
    assert.match(item.id, /^[a-z][a-z0-9]*\.[a-z0-9][a-z0-9-]*$/, `${item.id} is a face part id`);
    const slot = faceSlot(item.slot);
    assert.ok(slot, `${item.id} names a slot that exists`);
    assert.equal(slot.category, item.category, `${item.id}: the slot decides the category`);
    assert.equal(item.id.split('.')[0], item.category, `${item.id} is prefixed with what the rig gets`);
    assert.ok(facePartCategory(item.category)?.installable, `${item.id} installs as something`);
  }
});

test('every planned drawing is for muzzle faces, mounts somewhere a face has, and is tagged in words', () => {
  for (const item of PILOT_ASSETS) {
    assert.deepEqual([...item.morphologies], ['muzzle'], `${item.id} is drawn for animal faces`);
    assert.ok(FACE_MOUNT_POINTS.includes(item.mountPoint), `${item.id} mounts at ${item.mountPoint}, which exists`);
    assert.ok(item.tags.length, `${item.id} can be found by a word`);
    for (const tag of item.tags) assert.match(tag, FACE_TAG, `"${tag}" on ${item.id} is a tag`);
    assert.equal(item.status, 'needs-art', `${item.id} starts where everything starts`);
    assert.ok(PILOT_STATUSES.includes(item.status));
    assert.equal(item.priority, 'pilot');
  }
  // Every drawing carries the sheet's own caption, so the planche and the
  // manifest are the same list read two ways.
  assert.equal(pilotAsset('accessory.muzzle-rodent-small').sheetLabel, 'Rongeur petit');
  assert.equal(pilotAsset('nose.button-tiny').sheetLabel, 'Minuscule bouton');
  // The muzzle and the whiskers take the anchor MASC-09 proposed for them.
  for (const item of [...pilotAssetsForSlot('muzzle'), ...pilotAssetsForSlot('whiskers')]) {
    assert.equal(item.mountPoint, 'nose.center', `${item.id} starts at the nose, as MASC-09's candidate table says`);
    assert.equal(item.category, 'accessory', 'and installs as an accessory: no new semantic part');
  }
});

test('every planned drawing names the roles and the movements its category already has — and no new control', () => {
  for (const item of PILOT_ASSETS) {
    const category = facePartCategory(item.category);
    assert.deepEqual([...item.requiredRoles], [...category.required], `${item.id} names its category's required roles`);
    for (const control of item.capabilities) {
      assert.ok(category.controls.includes(control), `${control} on ${item.id} is a control ${item.category} already has`);
    }
  }
  // The four species run on the controls a person runs on. Nothing in the
  // pilot asks the runtime for a word it does not know.
  const asked = new Set(PILOT_ASSETS.flatMap((item) => item.capabilities));
  const known = new Set(Object.values(Object.fromEntries(PILOT_ASSETS.map((item) => [item.category, facePartCategory(item.category).controls]))).flat());
  for (const control of asked) assert.ok(known.has(control), `${control} is a control the rig already understands`);
});

test('a planned drawing says what it is for, how it differs, and where it is reviewed', () => {
  for (const item of PILOT_ASSETS) {
    assert.ok(item.proposedName, `${item.id} has a name to draw under`);
    assert.ok(item.direction.length > 10, `${item.id} tells an artist what to draw`);
    assert.ok(PILOT_REVIEW_GROUPS.includes(item.reviewGroup), `${item.id} is reviewed with something`);
    assert.ok(Number.isInteger(item.reviewOrder), `${item.id} has a place in the order`);
    assert.ok(item.sheetLabel, `${item.id} says which drawing on the sheet it is`);
    assert.ok(item.species.length || item.catalogue, `${item.id} is wanted by somebody, or is a catalogue piece`);
    for (const species of item.species) assert.ok(PILOT_SPECIES.includes(species), `${species} is one of the six`);
  }
  // The order is stable and total: a sheet drawn twice is the same sheet.
  const orders = PILOT_ASSETS.map((item) => item.reviewOrder);
  assert.equal(new Set(orders).size, orders.length, 'no two drawings share a place');
  assert.deepEqual(pilotAssets().map((item) => item.id), [...PILOT_ASSETS].sort((a, b) => a.reviewOrder - b.reviewOrder).map((item) => item.id));
  // And the groups run coarse to fine, heads first and whiskers last.
  const groups = [...new Set(pilotAssets().map((item) => item.reviewGroup))];
  assert.deepEqual(groups, [...PILOT_REVIEW_GROUPS]);
});

/* ── Four recipes, not four libraries ──────────────────────────────────── */

test('the six species are recipes over shared drawings, not six libraries', () => {
  assert.deepEqual(PILOT_PRESETS.map((item) => item.id), ['cat', 'dog', 'fox', 'bear', 'rabbit', 'wolf']);
  for (const species of PILOT_SPECIES) assert.ok(pilotPreset(species), `${species} exists`);
  for (const preset of PILOT_PRESETS) {
    assert.equal(preset.morphology, 'muzzle');
    assert.equal(preset.style, FACE_BASE_STYLE_ID);
    assert.ok(preset.direction.length > 20, `${preset.id} tells an artist what it should feel like`);
    assert.ok(PILOT_PALETTES[preset.palette], `${preset.id} names a palette that exists`);
    for (const name of preset.alternatePalettes) assert.ok(PILOT_PALETTES[name], `${name} exists`);
    for (const tag of preset.tags) assert.match(tag, FACE_TAG);
  }
  // The whole point: drawings used by more than one species, and no species
  // owning a private copy of a shared piece.
  const shared = drawings.filter((item) => item.species.length > 1).map((item) => item.id);
  assert.ok(shared.includes('eyes.animal-almond-alert'), 'one pair of eyes dresses the fox and the wolf');
  assert.ok(shared.includes('nose.triangle-small'), 'one nose dresses the cat and the fox');
  assert.ok(shared.includes('accessory.muzzle-canine-medium'), 'one muzzle dresses the dog and the wolf');
  assert.ok(shared.length >= 6, `${shared.length} drawings are shared between species`);
  // Forty-five drawings, of which thirty-eight are claimed by a recipe: six
  // species over eight slots would be forty-eight if each owned its own.
  assert.equal(drawings.length, 45);
  assert.equal(drawings.filter((item) => !item.catalogue).length, 38);
  assert.ok(38 < PILOT_SPECIES.length * 8, 'six independent libraries would be more');
});

test('every recipe dresses a whole face, and the pupils come with the eyes', () => {
  for (const preset of PILOT_PRESETS) {
    const worn = presetCoverage(preset.id);
    for (const category of ['head', 'eyes', 'pupils', 'eyebrows', 'ears', 'muzzle', 'nose', 'mouth']) {
      assert.ok(worn[category], `${preset.id} has a ${category}: ${JSON.stringify(worn)}`);
    }
    // Whiskers are optional, and two of the four have none — which is the
    // absence of an accessory, never an empty drawing.
    assert.equal(typeof worn.whiskers === 'string' || worn.whiskers === null, true);
  }
  assert.equal(presetCoverage('dog').whiskers, null, 'a dog has no whiskers');
  assert.equal(presetCoverage('bear').whiskers, null, 'nor a bear');
  assert.ok(presetCoverage('cat').whiskers, 'a cat does');
  assert.equal(pilotAssets({ slot: 'whiskers' }).length, 4, 'four sets of whiskers, and "none" is not a fifth drawing');
  // No preset may name a pupils part -- the eye set brings them -- so the
  // promise is kept through the eye set and checked there.
  for (const preset of PILOT_PRESETS) {
    assert.equal('pupils' in preset.parts, false, `${preset.id} does not name pupils: no preset may`);
    const pupils = pilotAsset(presetCoverage(preset.id).pupils);
    assert.ok(pupils.drawnBy.includes(preset.parts.eyes), `${preset.id}'s pupils are drawn by its eyes`);
    assert.equal(pupils.standalone, false, 'and are not a card of their own');
  }
  assert.equal(presetCoverage('cat').pupils, 'pupils.vertical', 'a cat has slit pupils');
  assert.equal(presetCoverage('nope'), null);
});

test('no recipe names a drawing that will not exist', () => {
  for (const preset of PILOT_PRESETS) {
    for (const id of presetAssetIds(preset)) {
      const planned = pilotAsset(id), shipped = FACE_PART_LIBRARY.get(id);
      assert.ok(planned || shipped, `${preset.id} names ${id}, which is neither planned nor shipped`);
      if (shipped) assert.equal(pilotReuse(id)?.verdict, 'reuse', `${id} is named by ${preset.id}, so the audit must call it a reuse`);
    }
    // And every id it names is one the category expects.
    for (const [category, id] of Object.entries(preset.parts)) {
      const item = pilotAsset(id) || FACE_PART_LIBRARY.get(id);
      assert.equal(item.category, category, `${preset.id}'s ${category} is a ${item.category}`);
    }
    for (const id of preset.accessories) {
      const item = pilotAsset(id);
      assert.equal(item.category, 'accessory', `${id} installs as an accessory`);
      assert.ok(['muzzle', 'whiskers'].includes(item.slot), `${id} is a muzzle or a pair of whiskers`);
    }
  }
});

test('every planned drawing is wanted by a recipe, or is a catalogue piece that says so', () => {
  const named = new Set(PILOT_PRESETS.flatMap(presetAssetIds));
  for (const item of drawings) {
    assert.ok(named.has(item.id) || item.catalogue, `${item.id} is named by a recipe or marked catalogue`);
    if (item.catalogue) {
      assert.equal(named.has(item.id), false, `${item.id} is catalogue, so no recipe names it`);
      assert.ok(item.notes.length > 10, `${item.id} says why it is in the catalogue`);
      assert.deepEqual([...item.species], [], 'a catalogue piece belongs to no species');
    }
  }
  // The catalogue is the seven the sheet draws beyond the six recipes: a parts
  // library exists to be combined, and its own header says so.
  assert.deepEqual(catalogueAssets().map((item) => item.id),
    ['eyes.animal-sleepy', 'eyes.animal-happy', 'eyebrows.animal-worried', 'ears.small-round', 'ears.tufted', 'accessory.muzzle-feline-rounded', 'mouth.animal-happy-curve']);
  // The pupils are the exception, and say so rather than being missing.
  for (const item of pilotAssets({ group: 'pupils' })) {
    assert.equal(named.has(item.id), false);
    assert.equal(item.standalone, false, `${item.id} is drawn by its eye set, not named by a recipe`);
    for (const id of item.drawnBy) assert.ok(PLANNED.has(id), `${id} draws ${item.id} and is planned`);
  }
});

/* ── The audit, and the discipline that keeps the count down ───────────── */

test('the shipped library was audited, and the sheet drawing its own moved four verdicts', () => {
  const verdicts = new Map(PILOT_REUSE.map((item) => [item.id, item.verdict]));
  assert.equal(verdicts.size, PILOT_REUSE.length, 'no drawing judged twice');
  for (const item of PILOT_REUSE) {
    assert.ok(FACE_PART_LIBRARY.has(item.id), `${item.id} is a drawing that exists`);
    assert.ok(PILOT_REUSE_VERDICTS.includes(item.verdict), `${item.verdict} is a verdict`);
    assert.ok(item.why.length > 15, `${item.id} says why`);
  }
  assert.equal(PILOT_REUSE.length, 47, 'every shipped drawing was looked at');
  // The sheet draws its own brow, its own noses and its own mouths, so nothing
  // is reused outright any more: a recipe names only pilot drawings, and the
  // four that were going to stand in are fallbacks rather than plans.
  assert.deepEqual(PILOT_REUSE.filter((item) => item.verdict === 'reuse'), []);
  for (const id of ['eyebrows.thin', 'nose.cartoon', 'mouth.small', 'mouth.cartoon']) {
    assert.equal(pilotReuse(id).verdict, 'possible-reuse', `${id} is the fallback if a planned drawing is cut`);
  }
  // And what an animal may still wear is what the audit is worth now.
  for (const id of ['accessory.glasses', 'accessory.hat', 'accessory.bow-tie']) {
    assert.equal(pilotReuse(id).verdict, 'possible-reuse', `${id} is universal`);
  }
  const named = new Set(PILOT_PRESETS.flatMap(presetAssetIds));
  for (const id of named) assert.ok(pilotAsset(id), `${id} is a pilot drawing: no recipe leans on a shipped one`);
});

test('two drawings in one slot for one species must say how they differ', () => {
  assert.deepEqual(duplicateConcerns(), [], 'nothing in the manifest is the same drawing twice');
  // The check has teeth: two entries that overlap and say nothing are caught.
  const twin = (id) => ({ ...pilotAsset('accessory.muzzle-feline-short'), id, distinct: '' });
  assert.deepEqual(duplicateConcerns([twin('accessory.a'), twin('accessory.b')]),
    [{ a: 'accessory.a', b: 'accessory.b', slot: 'muzzle', species: ['cat'] }]);
  // And a stated difference settles it, as does a different species.
  const stated = (id) => ({ ...pilotAsset('accessory.muzzle-feline-short'), id, distinct: 'Shorter.' });
  assert.deepEqual(duplicateConcerns([stated('accessory.a'), stated('accessory.b')]), []);
  assert.deepEqual(duplicateConcerns([twin('accessory.a'), { ...twin('accessory.b'), species: ['dog'] }]), []);
});

/* ── Colours are palettes, never drawings ──────────────────────────────── */

test('a ginger cat and a grey cat are one drawing and two palettes', () => {
  const cat = pilotPreset('cat');
  assert.equal(cat.palette, 'cat-ginger');
  assert.equal(Object.keys(PILOT_PALETTES).length, 7, 'one a species, and two for the cat');
  assert.deepEqual([...cat.alternatePalettes], ['cat-grey']);
  // No drawing is named for a colour.
  for (const item of PILOT_ASSETS) {
    for (const colour of ['orange', 'ginger', 'grey', 'brown', 'tan', 'cream']) {
      assert.equal(item.id.includes(colour), false, `${item.id} is not named for a colour`);
    }
  }
  // And no palette invents a token: every key is one of the twelve.
  const tokens = new Set(['skin', 'skinShadow', 'outline', 'hair', 'hairShadow', 'eyeWhite', 'pupil', 'mouth', 'tongue', 'teeth', 'accessoryPrimary', 'accessorySecondary']);
  for (const [name, palette] of Object.entries(PILOT_PALETTES)) {
    assert.ok(PILOT_SPECIES.includes(palette.species), `${name} is for one of the four`);
    for (const key of Object.keys(palette)) {
      if (key === 'species') continue;
      assert.ok(tokens.has(key), `${key} in ${name} is a palette token the library already has`);
      assert.match(palette[key], /^#[0-9a-f]{6}$/, `${name}.${key} is a colour`);
    }
    assert.equal('hair' in palette, false, 'an animal has no hair slot, so no hair colour is invented for it');
  }
});

/* ── What the drawings still have to settle ────────────────────────────── */

test('what is still open is written down, and the turn profiles nobody may guess are marked', () => {
  assert.ok(PILOT_OPEN_QUESTIONS.length >= 8);
  // The sheet settled the worst of it: a muzzle is drawn without a nose or a
  // mouth, so what is left is the order rather than the shape.
  assert.ok(PILOT_OPEN_QUESTIONS.some((item) => item.id === 'muzzle-draw-order'));
  assert.ok(PILOT_OPEN_QUESTIONS.some((item) => item.id === 'closed-eyes-have-no-pupil'), 'the happy eyes are drawn shut and have no pupil to move');
  for (const item of PILOT_OPEN_QUESTIONS) {
    assert.ok(item.id && item.about && item.question.length > 20 && item.proposal.length > 20, `${item.id} states a question and a proposal`);
    assert.ok([...PILOT_REVIEW_GROUPS, 'palettes'].includes(item.about), `${item.about} is something the pilot draws`);
  }
  // Every accessory in the pilot needs a 2.5D profile, because an accessory
  // that says nothing about the turn does not turn: the glasses, the hat and
  // the earrings each declare one, and a muzzle projects further than any.
  for (const item of PILOT_ASSETS.filter((entry) => entry.category === 'accessory')) {
    assert.equal(item.turn, 'needs-profile', `${item.id} will need a turn profile`);
  }
  for (const item of pilotAssets({ group: 'ears' })) assert.equal(item.turn, 'needs-profile', 'ears on top of a skull are new ground');
  // And the categories the engine already understands are left alone.
  for (const group of ['heads', 'eyes', 'pupils', 'brows', 'noses', 'mouths']) {
    for (const item of pilotAssets({ group })) assert.equal(item.turn, 'category-default', `${item.id} rides on what its category already does`);
  }
});

/* ── Reading the manifest ──────────────────────────────────────────────── */

test('the manifest can be read the ways MASC-10B will read it', () => {
  assert.deepEqual(pilotSummary(), {
    drawings: 45, planned: 47, claimed: 38, catalogue: 7, reused: 0, presets: 6,
    groups: { heads: 6, eyes: 6, pupils: 2, brows: 5, ears: 8, muzzles: 6, noses: 5, mouths: 5, whiskers: 4 }
  });
  // The eight sections of the sheet, in its own order.
  assert.deepEqual(PILOT_REVIEW_GROUPS.map((group) => pilotAssets({ group }).length), [6, 6, 2, 5, 8, 6, 5, 5, 4]);
  assert.deepEqual(pilotAssetsForSlot('ears').map((item) => item.sheetLabel),
    ['Chat pointues', 'Renard grandes pointues', 'Chien tombantes', 'Ours rondes', 'Lapin grandes', 'Loup pointues', 'Petites rondes', 'Avec touffes']);
  assert.deepEqual(pilotAssetsForSpecies('bear').map((item) => item.id),
    ['head.animal-wide', 'eyes.animal-small-cute', 'pupils.round', 'eyebrows.animal-thick', 'ears.bear-round', 'accessory.muzzle-bear-broad', 'nose.bear-broad', 'mouth.animal-neutral']);
  assert.deepEqual(pilotAssets({ status: 'approved' }), [], 'nothing is approved: nothing is drawn');
  assert.equal(pilotAssets({ status: 'needs-art' }).length, PILOT_ASSETS.length);
  assert.equal(pilotAsset('nope'), null);
  assert.equal(pilotReuse('nope'), null);
  assert.equal(pilotAsset('ears.cat-pointed').slot, 'ears');
  assert.deepEqual(catalogueAssets().length, 7);
  // Frozen all the way down: a manifest a reader could edit is a manifest
  // that disagrees with the sheet drawn from it.
  assert.ok(Object.isFrozen(PILOT_ASSETS) && Object.isFrozen(PILOT_ASSETS[0]) && Object.isFrozen(PILOT_ASSETS[0].tags));
  assert.ok(Object.isFrozen(PILOT_PRESETS[0].parts));
});
