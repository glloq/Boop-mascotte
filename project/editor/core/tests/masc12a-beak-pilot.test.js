import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PILOT_ASSETS, PILOT_ID, PILOT_MORPHOLOGY, PILOT_OPEN_QUESTIONS, PILOT_PALETTES, PILOT_PRESETS,
  PILOT_REUSE, PILOT_REUSE_VERDICTS, PILOT_REVIEW_GROUPS, PILOT_SHEET, PILOT_SPECIES, PILOT_STATUSES,
  PILOT_STYLE, pilotAsset, pilotAssets, pilotAssetsForSlot, pilotAssetsForSpecies, pilotPreset,
  pilotReuse, pilotSummary, presetAssetIds, presetCoverage
} from '../face-library/pilots/beak-soft-cartoon.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';
import { FACE_MOUNT_POINTS, FACE_TAG, PALETTE_TOKENS, facePartCategory } from '../face-library/face-part-model.js';
import { FACE_MORPHOLOGY_IDS, assetSlot, faceMorphology, faceSlot, morphologySlots } from '../face-library/face-morphologies.js';
import { FACE_BASE_STYLE_ID } from '../face-library/face-styles.js';

/**
 * MASC-12A — the brief for the first bird faces.
 *
 * Nothing here is drawn and nothing here is registered: a cahier des charges,
 * and what these tests defend is that it is a *usable* one. Six birds must be
 * six recipes over shared rows rather than six libraries; every planned id must
 * be something the library could actually hold; every recipe must name only
 * things that will exist; and the shipped library must be exactly as it was.
 *
 * The reading that makes this pilot different from the other two is in the
 * third test. Six rows of the planche land on six slots, and **every one of
 * them is already in the `beak` morphology's own list** — MASC-01 drew a bird
 * correctly, down to leaving out the nose, the mouth, the ears and the hair.
 * The robot pack needed two slots added before a line could be drawn; this one
 * needs nothing, and that is worth an assertion rather than a sentence.
 */

/* ── The manifest is a manifest, not a library ─────────────────────────── */

test('every planned drawing is a drawing now, and every recipe a preset', () => {
  // The library has grown past this pilot since -- MASC-12B drew it -- so what
  // is asked is that every planned id is in it, under the planned name, in the
  // planned slot. The manifest stays hand-written, and this is where it and the
  // library are made to agree.
  for (const item of PILOT_ASSETS) {
    const shipped = FACE_PART_LIBRARY.get(item.id);
    assert.ok(shipped, `${item.id} was planned and is not drawn`);
    assert.equal(shipped.category, item.category, `${item.id} is a ${shipped.category}, and was planned as a ${item.category}`);
    // Compared through `assetSlot`, not through the field: the library's rule is
    // that a slot left out *is* the category, and `accessory.monocle` leaves it
    // out because it is an ordinary accessory. The manifest spells it.
    assert.equal(assetSlot(shipped), item.slot, `${item.id} is offered under ${assetSlot(shipped)}, and was planned for ${item.slot}`);
    assert.equal(shipped.mountPoint, item.mountPoint, `${item.id} mounts at ${shipped.mountPoint}, and was planned at ${item.mountPoint}`);
    assert.equal(shipped.name, item.proposedName, `${item.id} shipped under another name`);
    assert.equal(shipped.origin, 'builtin');
  }
  for (const preset of PILOT_PRESETS) {
    const shipped = FACE_PRESET_LIBRARY.get(preset.id);
    assert.ok(shipped, `${preset.id} is a recipe with no preset`);
    assert.deepEqual(Object.entries(shipped.parts).sort(), Object.entries(preset.parts).sort(), `${preset.id} wears what it named`);
    assert.deepEqual([...shipped.accessories], [...preset.accessories], `${preset.id} wears the accessories it named`);
    assert.equal(shipped.palette, preset.palette);
    assert.equal(shipped.morphology, 'beak');
  }
  assert.equal('artwork' in PILOT_ASSETS[0], false, 'a planned entry has no artwork, which is the point');
  assert.ok(Object.isFrozen(PILOT_ASSETS) && Object.isFrozen(PILOT_ASSETS[0]) && Object.isFrozen(PILOT_ASSETS[0].tags));
});

test('the pilot says which morphology and which style it is for', () => {
  assert.equal(PILOT_ID, 'beak-soft-cartoon');
  assert.equal(PILOT_MORPHOLOGY, 'beak');
  assert.ok(faceMorphology(PILOT_MORPHOLOGY), 'and it is a kind of face that exists');
  assert.equal(PILOT_STYLE, FACE_BASE_STYLE_ID, 'the style the library is drawn in: no -soft-cartoon twins');
  assert.match(PILOT_SHEET, /BIRD-10A/);
  assert.deepEqual([...PILOT_SPECIES], ['owl', 'duck', 'parrot', 'crow', 'cute', 'slim']);
  for (const species of PILOT_SPECIES) {
    assert.equal(FACE_MORPHOLOGY_IDS.includes(species), false, `${species} is a preset inside beak, never a morphology`);
  }
});

test('MASC-01 drew a bird correctly: six rows, six slots, and no table to amend', () => {
  // The assertion this pilot exists to make. Every slot the planche needs is
  // already what `beak` offers, and `beak` offers nothing the planche does not
  // draw for -- so unlike MASC-11B there is no decision to take before drawing.
  const offered = morphologySlots('beak').map((slot) => slot.id);
  assert.deepEqual(offered, ['head', 'eyes', 'pupils', 'eyebrows', 'beak', 'crest', 'accessory']);
  const wanted = [...new Set(PILOT_ASSETS.map((item) => item.slot))];
  assert.deepEqual(wanted, ['head', 'eyes', 'eyebrows', 'beak', 'crest', 'accessory']);
  assert.deepEqual(wanted.filter((slot) => !offered.includes(slot)), [], 'every row of the planche has somewhere to be offered');
  // `pupils` is the one slot offered and not drawn for, and that is correct:
  // an eye set brings its own, and no preset may name one.
  assert.deepEqual(offered.filter((slot) => !wanted.includes(slot)), ['pupils']);
  // And what a bird has not got, the morphology already leaves out.
  for (const absent of ['nose', 'mouth', 'ears', 'hair', 'facialHair']) {
    assert.equal(offered.includes(absent), false, `a bird is not made of ${absent}`);
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
    assert.equal(item.id.split('.')[0], item.category, `${item.id} is prefixed by the category it installs through`);
  }
  // The one that looks wrong and is right: a beak's id begins `mouth.`, because
  // a beak *is* a mouth to the rig. `beak` is what an author picks it from.
  for (const item of pilotAssetsForSlot('beak')) {
    assert.equal(item.category, 'mouth', `${item.id} installs as a mouth`);
    assert.match(item.id, /^mouth\.beak-/);
    for (const control of ['mouthOpen', 'smile', 'mouthWidth']) {
      assert.ok(item.capabilities.includes(control), `${item.id} keeps ${control}: a beak opens`);
    }
  }
});

test('every planned drawing is for bird faces, mounts somewhere a face has, and is tagged in words', () => {
  for (const item of PILOT_ASSETS) {
    assert.ok(FACE_MOUNT_POINTS.includes(item.mountPoint), `${item.id} mounts at ${item.mountPoint}, which exists`);
    assert.ok(item.tags.length, `${item.id} can be found by a word`);
    for (const tag of item.tags) assert.match(tag, FACE_TAG, `"${tag}" on ${item.id} is a tag`);
    assert.equal(item.status, 'candidate', `${item.id} is drawn, and nobody has signed it off`);
    assert.ok(PILOT_STATUSES.includes(item.status));
    assert.equal(item.priority, 'pilot');
    assert.ok(item.direction.length > 25, `${item.id} says what it looks like`);
    assert.ok(item.distinct.length > 15, `${item.id} says how it differs from its neighbours`);
    assert.ok(item.sheetLabel, `${item.id} carries the planche's own caption`);
  }
  // Everything is drawn for a bird except the monocle, which is eyewear and
  // suits any face. An empty `morphologies` is how the library says universal.
  const narrowed = PILOT_ASSETS.filter((item) => item.morphologies.length);
  assert.deepEqual(PILOT_ASSETS.filter((item) => !item.morphologies.length).map((item) => item.id), ['accessory.monocle']);
  for (const item of narrowed) assert.deepEqual([...item.morphologies], ['beak'], `${item.id} is drawn for birds`);
  // The crest takes `head.top`, which closes MASC-09's two-candidate question.
  for (const item of pilotAssetsForSlot('crest')) assert.equal(item.mountPoint, 'head.top', `${item.id} stands on the crown`);
  assert.equal(pilotAsset('mouth.beak-duck').sheetLabel, 'Bec canard (plat et large)');
  assert.equal(pilotAsset('accessory.crest-parrot-tall').sheetLabel, 'Crête perroquet (haute)');
});

test('the six rows of the planche are six rows of the library, in its own order', () => {
  assert.deepEqual([...PILOT_REVIEW_GROUPS], ['heads', 'eyes', 'brows', 'beaks', 'crests', 'accessories']);
  assert.deepEqual(PILOT_REVIEW_GROUPS.map((group) => pilotAssets({ group }).length), [6, 6, 5, 6, 6, 1]);
  // Thirty drawings for thirty-three pieces on the planche: two of the four
  // accessories are drawings the library already has, whole.
  const summary = pilotSummary();
  assert.equal(summary.drawings, 30);
  assert.equal(summary.reused, 2);
  assert.equal(summary.onSheet, 32, 'the thirty drawn and the two reused; the small hat is still a question');
});

/* ── Six recipes, not six libraries ────────────────────────────────────── */

test('every bird is a full face, and no recipe names a drawing that will not exist', () => {
  assert.equal(PILOT_PRESETS.length, PILOT_SPECIES.length);
  for (const preset of PILOT_PRESETS) {
    assert.equal(preset.morphology, PILOT_MORPHOLOGY);
    assert.equal(preset.style, PILOT_STYLE);
    assert.ok(PILOT_PALETTES[preset.palette], `${preset.id} paints in a palette the pilot defines`);
    assert.equal(PILOT_PALETTES[preset.palette].species, preset.species, 'and in its own bird\'s plumage');
    assert.ok(preset.tags.includes('bird'), `${preset.id} says what it is`);

    for (const id of presetAssetIds(preset)) {
      const planned = pilotAsset(id), shipped = FACE_PART_LIBRARY.get(id);
      assert.ok(planned || shipped, `${preset.id} names ${id}, which is neither planned nor shipped`);
      if (shipped && !planned) assert.equal(pilotReuse(id)?.verdict, 'reuse', `${id} is named by ${preset.id}, so the audit must call it a reuse`);
      if (planned && planned.species.length) assert.ok(planned.species.includes(preset.species), `${preset.id} names ${id}, which is drawn for ${planned.species.join('/')}`);
    }
    // Four parts and a crest. The beak sits under `mouth`, because that is the
    // category it installs through and a preset is keyed by category.
    const worn = presetCoverage(preset.id);
    for (const row of ['head', 'eyes', 'eyebrows', 'beak', 'crest']) assert.ok(worn[row], `${preset.id} has a ${row}: ${JSON.stringify(worn)}`);
    assert.equal(worn.beak, preset.parts.mouth, 'and the beak is what the mouth key holds');
    // And the four rows a bird has not got, answered rather than left out.
    for (const absent of ['nose', 'ears', 'hair', 'facialHair']) {
      assert.equal(worn[absent], null, `${preset.id} names a ${absent}, which a bird has not got`);
      assert.equal(absent in preset.parts, false);
    }
    assert.equal('pupils' in preset.parts, false, `${preset.id} does not name pupils: no preset may`);
  }
  assert.equal(presetCoverage('nope'), null);
  assert.equal(pilotPreset('nope'), null);
});

test('the birds share what the planche lets them share, and the sharing is the point', () => {
  const named = new Set(PILOT_PRESETS.flatMap(presetAssetIds));
  for (const item of PILOT_ASSETS) {
    assert.ok(named.has(item.id) || item.catalogue, `${item.id} is named by a recipe or marked catalogue`);
  }
  // Five brows for six birds, which the planche sets up by drawing five: the
  // duck and the parrot are both curious, and that is the only piece two birds
  // share. Six species over five rows would be thirty drawings if each owned
  // its own; these six name twenty-nine between them.
  const shared = PILOT_ASSETS.filter((item) => item.species.length > 1);
  assert.deepEqual(shared.map((item) => item.id), ['eyebrows.bird-curious']);
  assert.deepEqual([...shared[0].species], ['duck', 'parrot']);
  const all = PILOT_PRESETS.flatMap(presetAssetIds);
  assert.equal(all.length, 30, 'five pieces each');
  assert.equal(new Set(all).size, 29, 'over twenty-nine drawings');
  // The monocle is the catalogue: an accessory any of the six may wear, and
  // none of them is written as wearing.
  assert.deepEqual(PILOT_ASSETS.filter((item) => item.catalogue).map((item) => item.id), ['accessory.monocle']);
  assert.deepEqual([...pilotAsset('accessory.monocle').species], [], 'a catalogue piece belongs to no species');
  // Every bird is fully specified, which is why six recipes and not four.
  for (const species of PILOT_SPECIES) assert.equal(pilotAssetsForSpecies(species).length, 5, `${species} is five pieces`);
});

/* ── The audit, and why it is the happiest of the three ────────────────── */

test('an accessory drawn for a person is already drawn for a bird', () => {
  const verdicts = new Map(PILOT_REUSE.map((item) => [item.id, item.verdict]));
  assert.equal(verdicts.size, PILOT_REUSE.length, 'no drawing judged twice');
  for (const item of PILOT_REUSE) {
    assert.ok(FACE_PART_LIBRARY.has(item.id), `${item.id} is a drawing that exists`);
    assert.ok(PILOT_REUSE_VERDICTS.includes(item.verdict), `${item.id} has a real verdict`);
    assert.ok(item.why.length > 30, `${item.id} says why, in a sentence`);
  }
  // The structural reason this audit is short and happy: an accessory that says
  // nothing is universal, so two of the planche's four already exist whole.
  assert.deepEqual(PILOT_REUSE.filter((item) => item.verdict === 'reuse').map((item) => item.id),
    ['accessory.glasses', 'accessory.bow-tie']);
  for (const id of ['accessory.glasses', 'accessory.bow-tie']) {
    assert.deepEqual([...FACE_PART_LIBRARY.get(id).morphologies], [], `${id} says nothing, so it suits every kind of face`);
  }
  // And the rows a bird has not got are `not-relevant` rather than `replace`:
  // there is nothing to replace when the morphology offers no row at all.
  for (const id of ['ears.round', 'nose.dot', 'hair.short', 'facialhair.beard']) {
    assert.equal(pilotReuse(id).verdict, 'not-relevant', id);
  }
  assert.equal(pilotReuse('mouth.small').verdict, 'replace', 'a beak installs as a mouth, so it replaces one');
  assert.equal(pilotReuse('nope'), null);
});

/* ── The questions ─────────────────────────────────────────────────────── */

test('what the drawings have to settle is written down, and none of it blocks', () => {
  const ids = PILOT_OPEN_QUESTIONS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'no question asked twice');
  for (const item of PILOT_OPEN_QUESTIONS) {
    assert.ok(PILOT_REVIEW_GROUPS.includes(item.about), `${item.id} is about a row of the planche`);
    assert.ok(item.question.length > 60, `${item.id} states the problem`);
    assert.ok(item.proposal.length > 60, `${item.id} proposes an answer rather than only worrying`);
  }
  // Nothing blocks, which is the difference between this pilot and MASC-11A:
  // every question here is about a drawing, not about the shape of the library.
  assert.deepEqual(PILOT_OPEN_QUESTIONS.filter((item) => item.blocking).map((item) => item.id), []);
  assert.equal(pilotSummary().blocking, 0);
  // And one of them closes a question MASC-09 left open rather than opening a
  // new one, which is what a second pilot on the same machinery should do.
  assert.ok(ids.includes('crest-anchor'));
  assert.match(pilotAsset('accessory.crest-owl-tufts').mountPoint, /^head\.top$/);
});

/* ── Colours are palettes ──────────────────────────────────────────────── */

test('six plumages, no new token, and nothing named for a colour', () => {
  assert.equal(Object.keys(PILOT_PALETTES).length, PILOT_SPECIES.length);
  for (const [id, palette] of Object.entries(PILOT_PALETTES)) {
    assert.ok(PILOT_SPECIES.includes(palette.species), `${id} belongs to one of the six`);
    const tokens = Object.keys(palette).filter((key) => key !== 'species');
    for (const token of tokens) {
      assert.ok(PALETTE_TOKENS.includes(token), `${id} paints ${token}, which is not a token`);
      assert.match(palette[token], /^#[0-9a-f]{6}$/, `${id}.${token} is a colour`);
    }
    // A manifest names what it paints. A bird has no hair and a beak has no
    // tongue and no teeth, so those four are left out on purpose; a registered
    // palette carries all twelve and MASC-12B fills them in at that point.
    assert.deepEqual(PALETTE_TOKENS.filter((token) => !tokens.includes(token)),
      ['hair', 'hairShadow', 'tongue', 'teeth'], `${id} omits exactly what a bird has no surface for`);
  }
  for (const item of PILOT_ASSETS) {
    assert.doesNotMatch(item.id, /cream|orange|slate|amber|blue|yellow|green|grey|gray|pink|white|black/,
      `${item.id} is named for a colour, and a colour is a palette`);
  }
});
