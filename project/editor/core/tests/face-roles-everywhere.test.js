import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { FACE_ROLE_CHECKLIST, FACE_ROLE_EXTRAS, deriveFaceRoleChecklist, deriveFaceRoleExtras, findFaceRoleUsage } from '../../rig-editor/semantic-parts/face-roles.js';
import { FACE_ROLE_VOCABULARY, roleVocabularyEntry, roleVocabularyGroups, rolesInUse, rolesOfElement } from '../../rig-editor/semantic-parts/face-role-vocabulary.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { faceLibraryModel, libraryCards, wornAsset } from '../face-library/face-library-model.js';
import { FACE_PART_CATEGORIES } from '../face-library/face-part-model.js';
import { INTAKE_ROLES } from '../../ui/picture-intake.js';

/**
 * Saying what a drawing is, and choosing one from the library.
 *
 * Two things an author could not do. An imported picture had nowhere to be
 * named — the Inspector asked only how it moved, and the checklist covered
 * eight roles of twenty-five — and the hundred and fifty drawings the editor
 * ships could not be put on a face at all, because the only caller of
 * `facePartCommands.replace()` left with the Character Builder.
 */

const template = () => createTemplateProjectState();

/* ══ THE VOCABULARY ═════════════════════════════════════════════════════════ */

test('every role the registry knows can be said, and the words are the author’s', () => {
  // Nothing assignable is missing: a part added to the registry is assignable
  // the day it exists, because this is derived rather than written out.
  const declared = [];
  for (const [part, definition] of Object.entries(SEMANTIC_PART_REGISTRY)) {
    if (part === 'leftHand' || part === 'rightHand') continue;
    for (const role of definition.roles || []) declared.push(`${part}.${role}`);
  }
  const known = new Set(FACE_ROLE_VOCABULARY.map((entry) => entry.id));
  assert.deepEqual(declared.filter((id) => !known.has(id)), [], 'roles nothing in the editor can assign');
  // And every one of them reads as words rather than as an id.
  assert.deepEqual(FACE_ROLE_VOCABULARY.filter((entry) => entry.label === entry.role).map((entry) => entry.id), []);
  assert.ok(FACE_ROLE_VOCABULARY.every((entry) => entry.partLabel));
  // A hand is drawn as a pair from Design ▸ Hands, not handed out as a role.
  assert.equal(known.has('leftHand.hand'), false);
});

test('the eight are the checklist and the rest are optional, and the two do not overlap', () => {
  assert.equal(FACE_ROLE_CHECKLIST.length, 8);
  assert.equal(FACE_ROLE_EXTRAS.length, 17);
  assert.equal(FACE_ROLE_CHECKLIST.length + FACE_ROLE_EXTRAS.length, FACE_ROLE_VOCABULARY.length);
  const basic = new Set(FACE_ROLE_CHECKLIST.map((entry) => `${entry.part}.${entry.role}`));
  assert.deepEqual(FACE_ROLE_EXTRAS.filter((entry) => basic.has(entry.id)), []);
  // The ones that had nowhere at all before.
  for (const id of ['eyelids.leftUpper', 'nose.nose', 'ears.leftEar', 'hair.hair', 'hair.hairBack', 'jaw.jaw', 'tongue.tongue', 'mouth.teeth', 'mouth.cavity', 'facialHair.facialHair']) {
    assert.ok(FACE_ROLE_EXTRAS.some((entry) => entry.id === id), `${id} can be assigned`);
  }
  assert.ok(FACE_ROLE_EXTRAS.every((entry) => entry.optional));
});

test('the optional rows never change what "complete" means', () => {
  // A face with no ears and no jaw is finished. A count that said 8 / 25 would
  // call every mascot in the world unfinished for ever.
  const state = template();
  const checklist = deriveFaceRoleChecklist(state);
  assert.equal(checklist.total, 8);
  assert.equal(checklist.assigned, 8);
  assert.equal(checklist.complete, true);
  const extras = deriveFaceRoleExtras(state);
  assert.equal(extras.total, 17);
  assert.equal(extras.groups.length, 9, 'grouped by the part that owns them');
  assert.ok(extras.assigned > 0, 'the template draws lids, a nose, ears, hair, a jaw and a tongue');
});

test('one drawing in two parts is not a clash, and the checklist still catches the one that is', () => {
  // The guard the checklist refuses on covers the eight and no more. The
  // template itself puts one drawing in two parts: the head shape is the
  // `head` *and* the `jaw`, because on a face with no separate chin the whole
  // head is what drops when the mouth opens. Reporting that as "already used"
  // made *Replace Head* refuse the head.
  const state = template();
  const jaw = Object.values(state.semanticParts).find((part) => part.type === 'jaw');
  assert.equal(jaw.roles.jaw, 'head', 'the template shares one drawing across two parts');
  assert.equal(findFaceRoleUsage(state, 'head'), null, 'and that is not a clash to report');
  // Two of the eight sharing a drawing is, because it has no reading: a left
  // eye that is also the right eye is a mistake.
  assert.equal(findFaceRoleUsage(state, 'mouth').id, 'mouth');
  assert.equal(findFaceRoleUsage(state, 'eyeLeft').id, 'leftEye');
  assert.equal(findFaceRoleUsage(state, 'eyeLeft', 'leftEye'), null, 'except the role asking');
  assert.equal(findFaceRoleUsage(state, 'nothing-like-that'), null);
});

test('which roles one drawing plays, and which drawing plays one role', () => {
  const state = template();
  assert.deepEqual(rolesOfElement(state, 'nose').map((item) => item.id), ['nose.nose']);
  // Legitimately two: the mouth's `tongue` role says whether it shows and the
  // tongue part's own says where it is (docs/FACE_CONTROL_RIG.md §12).
  assert.deepEqual(rolesOfElement(state, 'tongue').map((item) => item.id).sort(), ['mouth.tongue', 'tongue.tongue']);
  assert.deepEqual(rolesOfElement(state, 'nothing'), []);
  const used = rolesInUse(state);
  assert.equal(used.get('hair.hair'), 'hair');
  assert.equal(used.get('ears.leftEar'), 'earLeft');
  assert.equal(roleVocabularyEntry('ears.leftEar').label, 'Left ear');
  assert.equal(roleVocabularyEntry('nothing.at-all'), null);
  assert.equal(roleVocabularyGroups().reduce((sum, group) => sum + group.roles.length, 0), FACE_ROLE_VOCABULARY.length);
});

/* ══ SAYING WHAT A PIECE IS ═════════════════════════════════════════════════ */

test('one command moves a drawing from one role to another, and one undo takes it back', () => {
  const state = template();
  const store = createEditorStore(state);
  const history = createHistory(store);
  const commands = createSemanticRigCommands(store, history);
  const before = store.getPersistentRevision();

  // A drawing the face was not using: the left ear's fold.
  commands.setFaceRole('earLeftFold', { part: 'accessory', role: 'element' });
  assert.deepEqual(rolesOfElement(store.getDocument(), 'earLeftFold').map((item) => item.id), ['accessory.element']);
  assert.equal(store.getPersistentRevision(), before + 1, 'one write');

  // Moved, not added: the clear and the assign are one step, so there is no
  // moment where the drawing plays both roles or neither.
  commands.setFaceRole('earLeftFold', { part: 'hair', role: 'hairBack' });
  assert.deepEqual(rolesOfElement(store.getDocument(), 'earLeftFold').map((item) => item.id), ['hair.hairBack']);
  history.undo();
  assert.deepEqual(rolesOfElement(store.getDocument(), 'earLeftFold').map((item) => item.id), ['accessory.element']);

  // And off the face entirely.
  commands.setFaceRole('earLeftFold', {});
  assert.deepEqual(rolesOfElement(store.getDocument(), 'earLeftFold'), []);
});

test('a role the rig refuses is refused, and nothing is half-written', () => {
  const store = createEditorStore(template());
  const history = createHistory(store);
  const commands = createSemanticRigCommands(store, history);
  const revision = store.getPersistentRevision();
  // A role no part has, a part that does not exist, a drawing that does not
  // exist. Each is refused by the rig itself rather than by a second set of
  // rules here (part-model.js).
  assert.throws(() => commands.setFaceRole('mouth', { part: 'mouth', role: 'nonsense' }), /not supported by/);
  assert.throws(() => commands.setFaceRole('mouth', { part: 'nowhere', role: 'nose' }), /Unknown semantic part/);
  assert.throws(() => commands.setFaceRole('not-a-drawing', { part: 'nose', role: 'nose' }), /does not exist/);
  // The one that matters: a move *clears the roles the piece played first*, so
  // a refusal that arrived after the clear would leave the mouth playing
  // nothing. The preflight runs the whole command on a copy, so it does not.
  assert.equal(store.getPersistentRevision(), revision, 'no write');
  assert.equal(history.getState().canUndo, false);
  assert.deepEqual(rolesOfElement(store.getDocument(), 'mouth').map((item) => item.id), ['mouth.mouth'], 'and the piece keeps the role it had');
  assert.deepEqual(rolesOfElement(store.getDocument(), 'nose').map((item) => item.id), ['nose.nose']);
});

test('a role one drawing takes is a role another drawing loses', () => {
  // Clearing first is what makes *moving* a piece one step, and it is also why
  // one drawing cannot end up playing two roles of one part: the rig refuses
  // that (`assignSemanticRole`) and the clear means the question never arises.
  const store = createEditorStore(template());
  const commands = createSemanticRigCommands(store, createHistory(store));
  commands.setFaceRole('mouth', { part: 'mouth', role: 'teeth' });
  const document = store.getDocument();
  assert.deepEqual(rolesOfElement(document, 'mouth').map((item) => item.id), ['mouth.teeth'], 'one role, not two');
  // And the drawing that used to be the teeth is no longer on the face, which
  // is exactly what the `<select>` warns about before the press: `rolesInUse`
  // says who holds a role so an author is told what they are taking it from.
  assert.deepEqual(rolesOfElement(document, 'teeth'), []);
  assert.equal(rolesInUse(document).get('mouth.mouth'), undefined, 'the mouth now has no lips, and the checklist says so');
  assert.equal(deriveFaceRoleChecklist(document).complete, false);
});

test('a piece given a role gains that part’s movements, whichever list the role came from', () => {
  const store = createEditorStore(template());
  const commands = createSemanticRigCommands(store, createHistory(store));
  // Hair is one of the sixteen that had no row anywhere. Taking it off and
  // putting it back is the round trip an author makes by mistake.
  commands.setFaceRole('hair', {});
  assert.equal(Object.values(store.getDocument().semanticParts).find((part) => part.type === 'hair')?.roles?.hair, undefined);
  commands.setFaceRole('hair', { part: 'hair', role: 'hair' });
  const part = Object.values(store.getDocument().semanticParts).find((item) => item.type === 'hair');
  assert.equal(part.roles.hair, 'hair');
  assert.ok(part.controls.includes('hairSway'), 'and the movement it had is still the part’s');
});

test('every role a file name can propose is a role the form offers', () => {
  // A form that read `cheveux.png` correctly and had no *Hair* to offer was the
  // gap; the two lists are derived from one vocabulary so they cannot drift.
  const offered = new Set(INTAKE_ROLES.map((entry) => entry.id));
  for (const entry of FACE_ROLE_VOCABULARY) {
    if (entry.role === 'hand' || entry.role === 'element') continue;
    assert.ok(offered.has(entry.role), `${entry.role} is proposed and cannot be chosen`);
  }
});

/* ══ THE LIBRARY ════════════════════════════════════════════════════════════ */

test('the library offers its drawings, by category, with the drawing itself', () => {
  const state = template();
  const model = faceLibraryModel(state, { category: 'eyes' });
  assert.equal(model.total, 150, 'every drawing the editor ships');
  assert.equal(model.active, 'eyes');
  assert.ok(model.cards.length >= 20);
  // Every category the registry declares is reported, even one the library has
  // no drawing for: an author looking for Pupils deserves to be told.
  assert.deepEqual(model.categories.map((item) => item.id), FACE_PART_CATEGORIES.map((item) => item.id));
  assert.equal(model.categories.find((item) => item.id === 'pupils').count, 0);
  assert.ok(model.categories.filter((item) => item.count).length >= 9);
});

test('a card carries the drawing, with its own ids, so twenty previews are twenty drawings', () => {
  const cards = libraryCards(template(), 'eyes');
  const eye = cards.find((card) => card.id === 'eyes.round-large');
  assert.match(eye.preview.viewBox, /^[-\d.]+ [-\d.]+ [\d.]+ [\d.]+$/);
  assert.ok(eye.preview.markup.includes('<g id="preview-eyes-round-large-'));
  // The one that matters: several assets clip with `<clipPath id="socketLeft">`
  // and reference it by `url(#socketLeft)`. Twenty cards sharing that id is
  // twenty eyes clipped to the first card's socket.
  assert.equal(eye.preview.markup.includes('url(#socketLeft)'), false);
  assert.ok(eye.preview.markup.includes('url(#preview-eyes-round-large-socketLeft)'));
  const sleepy = cards.find((card) => card.id === 'eyes.sleepy');
  assert.equal(sleepy.preview.markup.includes('preview-eyes-round-large-'), false, 'and no card borrows another’s ids');
});

test('the cards say which drawing the face is wearing', () => {
  const state = template();
  // The template drew its own face, so it wears nothing *from the library* --
  // which is a different answer from wearing nothing at all.
  assert.equal(wornAsset(state, 'eyes'), null);
  assert.deepEqual(libraryCards(state, 'eyes').filter((card) => card.worn), []);
  // An installed part records the drawing it came from, and the card says so.
  const hair = Object.values(state.semanticParts).find((part) => part.type === 'hair');
  hair.assetId = 'hair.spiky';
  assert.deepEqual(wornAsset(state, 'hair'), { assetId: 'hair.spiky', partId: hair.id, name: 'Spiky' });
  assert.deepEqual(libraryCards(state, 'hair').filter((card) => card.worn).map((card) => card.id), ['hair.spiky']);
});

test('a drawing for another kind of face is marked, never hidden', () => {
  // An author who wants a beak on a round head is allowed one. A card that
  // vanished would read as a library that had lost something.
  const cards = libraryCards(template(), 'mouth');
  assert.ok(cards.length >= 20);
  assert.ok(cards.every((card) => 'compatible' in card));
  assert.deepEqual(cards.filter((card) => card.compatible === undefined), []);
});
