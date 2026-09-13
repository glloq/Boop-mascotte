import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PILOT_ASSETS, PILOT_ID, PILOT_MORPHOLOGY, PILOT_OPEN_QUESTIONS, PILOT_PALETTES, PILOT_PRESETS,
  PILOT_REUSE, PILOT_REUSE_VERDICTS, PILOT_REVIEW_GROUPS, PILOT_SHEET, PILOT_STATUSES, PILOT_STYLE,
  PILOT_TYPES, PILOT_VARIANT_AXES, pilotAsset, pilotAssets, pilotAssetsForSlot, pilotAssetsForType,
  pilotDrawingRange, pilotPreset, pilotReuse, pilotSummary, presetAssetIds, presetCoverage
} from '../face-library/pilots/robot-soft-cartoon.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';
import { FACE_MOUNT_POINTS, FACE_TAG, PALETTE_TOKENS, facePartCategory } from '../face-library/face-part-model.js';
import { FACE_MORPHOLOGY_IDS, faceMorphology, faceSlot, morphologySlots } from '../face-library/face-morphologies.js';
import { FACE_BASE_STYLE_ID } from '../face-library/face-styles.js';

/**
 * MASC-11A — the brief for the first robot faces.
 *
 * Nothing here is drawn and nothing here is registered: this is a cahier des
 * charges, and what these tests defend is that it is a *usable* one. Four kinds
 * of robot must be four recipes over shared drawings rather than four
 * libraries; every planned id must be something the library could actually
 * hold; every recipe must name only things that will exist; and the shipped
 * library must be exactly as it was.
 *
 * One thing is asked here that the animal brief did not have to ask. The
 * planche draws three variants of every family it labels, and some of those
 * triples are three shapes while others are one shape in three colours — and a
 * colour is a palette in this library, never a drawing. So the manifest carries
 * a *range* rather than a count, and the tests hold the range to being honest
 * about which end it is at.
 */

/* ── The manifest is a manifest, not a library ─────────────────────────── */

test('not one production drawing is added, and not one preset is registered', () => {
  assert.equal(FACE_PART_LIBRARY.list().length, 92, 'the shipped library is exactly as it was');
  assert.equal(BUILTIN_FACE_PARTS.length, 92);
  for (const item of PILOT_ASSETS) {
    assert.equal(FACE_PART_LIBRARY.has(item.id), false, `${item.id} is planned, not registered`);
    assert.equal(BUILTIN_FACE_PARTS.some((asset) => asset.id === item.id), false, `${item.id} is not a built-in`);
  }
  for (const preset of PILOT_PRESETS) assert.equal(FACE_PRESET_LIBRARY.has(preset.id), false, `${preset.id} is a recipe, not a preset`);
  assert.equal(FACE_PRESET_LIBRARY.size, 12, 'the six people and the six animals, and nothing else');
  // And a planned entry is not a face part: the validator would refuse it,
  // which is the point — it has no artwork yet.
  assert.equal('artwork' in PILOT_ASSETS[0], false);
  assert.ok(Object.isFrozen(PILOT_ASSETS) && Object.isFrozen(PILOT_ASSETS[0]) && Object.isFrozen(PILOT_ASSETS[0].tags));
});

test('the pilot says which morphology and which style it is for', () => {
  assert.equal(PILOT_ID, 'robot-soft-cartoon');
  assert.equal(PILOT_MORPHOLOGY, 'robot');
  assert.ok(faceMorphology(PILOT_MORPHOLOGY), 'and it is a kind of face that exists');
  assert.equal(PILOT_STYLE, FACE_BASE_STYLE_ID, 'the style the library is drawn in: no -soft-cartoon twins');
  assert.match(PILOT_SHEET, /ROBOT-V1/);
  assert.deepEqual([...PILOT_TYPES], ['screen', 'retro', 'industrial', 'toy']);
  for (const type of PILOT_TYPES) {
    assert.equal(FACE_MORPHOLOGY_IDS.includes(type), false, `${type} is a preset inside robot, never a morphology`);
  }
});

/* ── Every planned drawing is something the library could hold ─────────── */

test('every planned id is unique, well formed, and in a slot that exists', () => {
  assert.equal(new Set(PILOT_ASSETS.map((item) => item.id)).size, PILOT_ASSETS.length, 'no id planned twice');
  for (const item of PILOT_ASSETS) {
    assert.match(item.id, /^[a-z][a-zA-Z]*\.[a-z0-9-]+$/, `${item.id} is a library id`);
    const slot = faceSlot(item.slot);
    assert.ok(slot, `${item.id} names a slot that exists: ${item.slot}`);
    assert.equal(slot.category, item.category, `${item.id} installs through ${slot.category}, not ${item.category}`);
    assert.ok(facePartCategory(item.category), `${item.id} is in a real category`);
    assert.equal(item.id.split('.')[0], item.category === 'accessory' ? 'accessory' : item.category,
      `${item.id} is prefixed by the category it installs through`);
  }
});

test('every planned drawing is for robot faces, mounts somewhere a face has, and is tagged in words', () => {
  for (const item of PILOT_ASSETS) {
    assert.deepEqual([...item.morphologies], ['robot'], `${item.id} is drawn for machines`);
    assert.ok(FACE_MOUNT_POINTS.includes(item.mountPoint), `${item.id} mounts at ${item.mountPoint}, which exists`);
    assert.ok(item.tags.length, `${item.id} can be found by a word`);
    for (const tag of item.tags) assert.match(tag, FACE_TAG, `"${tag}" on ${item.id} is a tag`);
    assert.equal(item.status, 'needs-art', `${item.id} starts where everything starts`);
    assert.ok(PILOT_STATUSES.includes(item.status));
    assert.equal(item.priority, 'pilot');
    assert.ok(item.direction.length > 25, `${item.id} says what it looks like`);
    assert.ok(item.distinct.length > 15, `${item.id} says how it differs from its neighbours`);
  }
  // Every drawing carries the planche's own caption and the planche's own id,
  // so the sheet and the manifest are the same list read two ways.
  assert.equal(pilotAsset('accessory.antenna-toy-fun').sheetLabel, 'Antenne · Jouet');
  assert.equal(pilotAsset('accessory.antenna-toy-fun').sheetId, 'antenna.toy-fun');
  for (const item of PILOT_ASSETS) assert.ok(item.sheetId, `${item.id} records the id the planche printed`);
  // The two slots that make a robot a robot take the anchors MASC-09 proposed.
  for (const item of pilotAssetsForSlot('antenna')) assert.equal(item.mountPoint, 'head.top', `${item.id} stands on the crown`);
  for (const item of pilotAssetsForSlot('panels')) assert.equal(item.mountPoint, 'head.center', `${item.id} lies on the shell`);
});

test('the seven rows of the planche are the seven rows of the library, four families each', () => {
  assert.deepEqual([...PILOT_REVIEW_GROUPS], ['shells', 'sides', 'eyes', 'visors', 'mouths', 'antennae', 'panels']);
  for (const group of PILOT_REVIEW_GROUPS) {
    const families = pilotAssets({ group });
    assert.equal(families.length, 4, `${group} has one family per kind of robot`);
    assert.deepEqual(families.flatMap((item) => item.types), [...PILOT_TYPES], `${group} is in the planche's own order`);
  }
  // Seven rows onto seven slots, and not one of them is new: this is MASC-01's
  // prediction holding for the third time.
  assert.deepEqual([...new Set(PILOT_ASSETS.map((item) => item.slot))],
    ['head', 'ears', 'eyes', 'eyebrows', 'mouth', 'antenna', 'panels']);
});

/* ── The count is a range, and says which end honestly ─────────────────── */

test('the planche draws 84 cells and the pilot plans 28 families, because a colour is a palette', () => {
  const range = pilotDrawingRange();
  assert.deepEqual(range, { families: 28, cells: 84, floor: 28, ceiling: 74 });
  assert.equal(range.cells, PILOT_ASSETS.length * 3, 'three variants of every family the planche labels');
  assert.ok(range.floor <= range.ceiling && range.ceiling <= range.cells, 'the range is a range');
  // The ceiling is below the cell count precisely because five families read as
  // one silhouette in three colours. If that reading survives the review sheet,
  // those fifteen cells are five drawings and ten palette entries.
  const colour = pilotAssets({ axis: 'colour' });
  assert.equal(colour.length, 5);
  assert.equal(range.cells - range.ceiling, colour.length * 2, 'two cells saved by every family that is really a palette');
  for (const item of colour) assert.ok(item.notes.length > 20, `${item.id} says what the three cells are, so the sheet can check`);
  for (const item of PILOT_ASSETS) {
    assert.ok(PILOT_VARIANT_AXES.includes(item.variantAxis), `${item.id} reads its variants as something`);
    assert.equal(item.variants, 3, 'the planche draws three of everything');
  }
});

/* ── Four recipes, not four libraries ──────────────────────────────────── */

test('every kind of robot is a full face, and no recipe names a drawing that will not exist', () => {
  assert.equal(PILOT_PRESETS.length, PILOT_TYPES.length);
  for (const preset of PILOT_PRESETS) {
    assert.equal(preset.morphology, PILOT_MORPHOLOGY);
    assert.equal(preset.style, PILOT_STYLE);
    assert.ok(PILOT_PALETTES[preset.palette], `${preset.id} paints in a palette the pilot defines`);
    assert.equal(PILOT_PALETTES[preset.palette].type, preset.type, 'and in its own kind\'s palette');
    assert.ok(preset.tags.includes('robot'), `${preset.id} says what it is`);

    for (const id of presetAssetIds(preset)) {
      const planned = pilotAsset(id), shipped = FACE_PART_LIBRARY.get(id);
      assert.ok(planned || shipped, `${preset.id} names ${id}, which is neither planned nor shipped`);
      if (shipped && !planned) assert.equal(pilotReuse(id)?.verdict, 'reuse', `${id} is named by ${preset.id}, so the audit must call it a reuse`);
      if (planned) assert.ok(planned.types.includes(preset.type), `${preset.id} names ${id}, which is drawn for ${planned.types.join('/')}`);
    }
    // Five parts and two accessories: a robot wears its antenna and its panel
    // the way an animal wears its muzzle and its whiskers.
    const worn = presetCoverage(preset.id);
    for (const row of ['head', 'ears', 'eyes', 'eyebrows', 'mouth', 'antenna', 'panels']) {
      assert.ok(worn[row], `${preset.id} has a ${row}: ${JSON.stringify(worn)}`);
    }
    // And the two a robot has not got, answered rather than left out.
    assert.equal(worn.nose, null, `${preset.id} has no nose, and the planche draws none`);
    assert.equal(worn.hair, null, `${preset.id} has no hair: an antenna stands where hair would`);
    assert.equal('pupils' in preset.parts, false, `${preset.id} does not name pupils: no preset may`);
  }
  assert.equal(presetCoverage('nope'), null);
  assert.equal(pilotPreset('nope'), null);
});

test('every planned drawing is wanted by a recipe: four kinds over one set of rows', () => {
  const named = new Set(PILOT_PRESETS.flatMap(presetAssetIds));
  for (const item of PILOT_ASSETS) assert.ok(named.has(item.id), `${item.id} is planned and no recipe wants it`);
  assert.equal(named.size, PILOT_ASSETS.length, 'and nothing is named that is not planned');
  // Each kind takes exactly one family from each of the seven rows, which is
  // what makes this a parts library rather than four separate mascots.
  for (const type of PILOT_TYPES) {
    const mine = pilotAssetsForType(type);
    assert.equal(mine.length, PILOT_REVIEW_GROUPS.length, `${type} is one family per row`);
    assert.deepEqual(mine.map((item) => item.reviewGroup), [...PILOT_REVIEW_GROUPS]);
  }
  // Nothing is shared here, and that is a finding rather than a failure: an
  // animal pack shares because a fox and a wolf are both canids, and a screen
  // robot shares nothing with an industrial one by design.
  assert.equal(PILOT_ASSETS.filter((item) => item.types.length > 1).length, 0);
});

/* ── The audit, and what a robot is worth from the shipped library ─────── */

test('the shipped library was audited, and a robot shares almost nothing with a person', () => {
  const verdicts = new Map(PILOT_REUSE.map((item) => [item.id, item.verdict]));
  assert.equal(verdicts.size, PILOT_REUSE.length, 'no drawing judged twice');
  for (const item of PILOT_REUSE) {
    assert.ok(FACE_PART_LIBRARY.has(item.id), `${item.id} is a drawing that exists`);
    assert.ok(PILOT_REUSE_VERDICTS.includes(item.verdict), `${item.id} has a real verdict`);
    assert.ok(item.why.length > 30, `${item.id} says why, in a sentence`);
  }
  // The bow tie is the one thing a robot takes off the shelf wholesale, and it
  // is an accessory rather than a face part — which is the shape of the answer.
  assert.deepEqual(PILOT_REUSE.filter((item) => item.verdict === 'reuse').map((item) => item.id), ['accessory.bow-tie']);
  assert.equal(pilotReuse('accessory.hat').verdict, 'possible-reuse');
  assert.equal(pilotReuse('nose.cartoon').verdict, 'not-relevant', 'the planche has no nose row at all');
  assert.equal(pilotReuse('hair.bald').verdict, 'not-relevant');
  assert.equal(pilotReuse('nope'), null);
});

/* ── The questions, and the two that block ─────────────────────────────── */

test('what the drawings have to settle is written down, and what blocks them is marked', () => {
  const ids = PILOT_OPEN_QUESTIONS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'no question asked twice');
  for (const item of PILOT_OPEN_QUESTIONS) {
    assert.ok(PILOT_REVIEW_GROUPS.includes(item.about), `${item.id} is about a row of the planche`);
    assert.ok(item.question.length > 60, `${item.id} states the problem`);
    assert.ok(item.proposal.length > 60, `${item.id} proposes an answer rather than only worrying`);
  }
  // Two are decisions somebody takes before a line is drawn, and they are the
  // two that would otherwise be discovered halfway through the row.
  assert.deepEqual(PILOT_OPEN_QUESTIONS.filter((item) => item.blocking).map((item) => item.id),
    ['robot-has-no-ears-slot', 'variants-are-shapes-or-colours']);
});

test('the blocking question is real: the robot morphology does not offer the rows the planche draws', () => {
  // This is the assertion that makes the question a fact rather than a worry.
  // If somebody adds the two slots, this test is what tells them to update the
  // manifest — and if nobody does, it is what stops the pack being drawn into
  // rows Design would never show.
  const offered = morphologySlots('robot').map((slot) => slot.id);
  assert.deepEqual(offered, ['head', 'eyes', 'pupils', 'mouth', 'antenna', 'panels', 'accessory']);
  const wanted = [...new Set(PILOT_ASSETS.map((item) => item.slot))];
  assert.deepEqual(wanted.filter((slot) => !offered.includes(slot)), ['ears', 'eyebrows'],
    'the Modules latéraux and Sourcils / visière rows have nowhere to be offered yet');
  // And the rest do fit, which is why this is two lines and not a redesign.
  assert.deepEqual(wanted.filter((slot) => offered.includes(slot)), ['head', 'eyes', 'mouth', 'antenna', 'panels']);
});

/* ── Colours are palettes ──────────────────────────────────────────────── */

test('four palettes, no new token, and nothing named for a colour', () => {
  assert.equal(Object.keys(PILOT_PALETTES).length, PILOT_TYPES.length);
  for (const [id, palette] of Object.entries(PILOT_PALETTES)) {
    assert.ok(PILOT_TYPES.includes(palette.type), `${id} belongs to a kind of robot`);
    const tokens = Object.keys(palette).filter((key) => key !== 'type');
    for (const token of tokens) {
      assert.ok(PALETTE_TOKENS.includes(token), `${id} paints ${token}, which is not a token`);
      assert.match(palette[token], /^#[0-9a-f]{6}$/, `${id}.${token} is a colour`);
    }
    // A manifest names what it paints; what it leaves out it leaves out on
    // purpose, and these are the two a robot has no surface for. A registered
    // palette carries all twelve, so MASC-11B fills them in at that point.
    assert.deepEqual(PALETTE_TOKENS.filter((token) => !tokens.includes(token)), ['hair', 'hairShadow'], `${id} omits exactly the two a robot never paints`);
  }
  // The rule the whole variant question rests on: nothing is drawn twice for a
  // colour, and no id carries one.
  for (const item of PILOT_ASSETS) {
    assert.doesNotMatch(item.id, /cream|red|blue|yellow|green|grey|gray|orange|pink|white|black/,
      `${item.id} is named for a colour, and a colour is a palette`);
  }
});

/* ── Reading the manifest ──────────────────────────────────────────────── */

test('the manifest can be read the ways MASC-11B will read it', () => {
  assert.deepEqual(pilotSummary(), {
    families: 28, cells: 84, floor: 28, ceiling: 74, types: 4, presets: 4, palettes: 4, blocking: 2,
    groups: { shells: 4, sides: 4, eyes: 4, visors: 4, mouths: 4, antennae: 4, panels: 4 }
  });
  assert.deepEqual(pilotAssetsForSlot('antenna').map((item) => item.sheetId),
    ['antenna.single-short', 'antenna.retro-multi', 'antenna.industrial-robust', 'antenna.toy-fun']);
  assert.deepEqual(pilotAssetsForType('industrial').map((item) => item.id),
    ['head.robot-industrial-plate', 'ears.robot-industrial-bolt', 'eyes.robot-industrial-led',
      'eyebrows.robot-industrial-visor', 'mouth.robot-industrial-vent',
      'accessory.antenna-industrial-robust', 'accessory.panels-warning-stripe']);
  assert.deepEqual(pilotAssets({ status: 'approved' }), [], 'nothing is approved: nothing is drawn');
  assert.equal(pilotAssets({ status: 'needs-art' }).length, PILOT_ASSETS.length);
  assert.equal(pilotAsset('nope'), null);
  assert.equal(pilotAsset('accessory.panels-toy-buttons').slot, 'panels');
  assert.ok(Object.isFrozen(PILOT_PRESETS[0].parts) && Object.isFrozen(PILOT_PALETTES));
});
