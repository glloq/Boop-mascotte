/**
 * The two questions a new mascot is (UI-REDESIGN-03).
 *
 * What is being held still here is not the markup — it is the **shape of the
 * journey**, because that shape is the whole finding of the redesign study:
 * the library holds 150 drawings and 22 characters across four kinds, and the
 * path that did not ask which kind showed 48 and 6.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { characterStepMarkup, typeStepMarkup } from '../../ui/new-mascot/wizard.js';
import { mascotCharacters, mascotTypes, newMascotSteps } from '../../ui/new-mascot/wizard-model.js';
import { FACE_PART_LIBRARY, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';
import { availableFaceStyles } from '../face-library/face-styles.js';
import { presetsFor } from '../face-library/compatibility.js';

test('the first question is the kind, and every kind offered can really be made', () => {
  const types = mascotTypes();
  assert.deepEqual(types.map((type) => type.id), ['human', 'muzzle', 'beak', 'robot']);
  assert.deepEqual(types.map((type) => type.label), ['Human', 'Animal', 'Bird', 'Robot']);
  for (const type of types) {
    assert.ok(type.count > 0, `${type.id} has characters behind it`);
    assert.match(type.thumbnail, /^<svg/, `${type.id} has a picture, drawn from the real assets`);
  }
  // `monster` is drawable in principle and has no horns and no characters, so
  // it is not a card. A card that leads to an empty second step is worse than
  // one that is missing.
  assert.equal(types.some((type) => type.id === 'monster'), false);
});

test('the kinds between them reach every character the library holds', () => {
  const reachable = new Set(mascotTypes().flatMap((type) => mascotCharacters(type.id).map((item) => item.id)));
  const everything = FACE_PRESET_LIBRARY.list().map((preset) => preset.id);
  // The count that names the problem: the wizard reaches all 22, the old
  // default path reached the six `presetsFor({morphology:'human'})` returns.
  assert.equal(reachable.size, everything.length);
  assert.ok(reachable.size > presetsFor({ morphology: 'human' }).length * 3);
  for (const id of everything) assert.ok(reachable.has(id), `${id} is reachable from some kind`);
});

test('each kind offers its own characters and no other kind\'s', () => {
  const birds = mascotCharacters('beak').map((item) => item.id);
  assert.deepEqual(birds, ['owl', 'duck', 'parrot', 'crow', 'cute-bird', 'slim-bird']);
  const animals = mascotCharacters('muzzle').map((item) => item.id);
  assert.equal(birds.some((id) => animals.includes(id)), false, 'no character is offered under two kinds');
  assert.deepEqual(mascotCharacters('human').map((item) => item.id), ['classic', 'professor', 'young', 'old', 'robot', 'minimal']);
});

/**
 * The step this library cannot ask about.
 *
 * One style is catalogued and zero variants are drawn, so "choose a style"
 * shows one card, already chosen and not pressable. It is counted rather than
 * assumed, so the day a pack brings variants the step appears with nothing to
 * remember.
 */
test('the style step is asked only when there is a choice to make', () => {
  assert.deepEqual(newMascotSteps(), ['type', 'character']);
  assert.equal(availableFaceStyles(FACE_PART_LIBRARY).filter((style) => style.variants > 0).length, 0,
    'nothing is drawn in a second style yet; when something is, this test says so');

  const library = createFacePartRegistry();
  for (const asset of FACE_PART_LIBRARY.list()) library.register({ ...asset, origin: 'custom' });
  const base = library.get('head.round') || library.list().find((asset) => asset.category === 'head');
  for (const style of ['flat', 'retro']) {
    library.register({ ...base, id: `${base.id}-${style}`, variant: { of: base.id, style }, origin: 'custom' });
  }
  assert.deepEqual(newMascotSteps({ library }), ['type', 'style', 'character']);
});

test('the first screen is pictures and short words, and never a dropdown', () => {
  const markup = typeStepMarkup(mascotTypes());
  assert.match(markup, /What kind of mascot do you want to make\?/);
  assert.equal(markup.includes('<select'), false, 'an important choice is cards, not a list');
  for (const label of ['Human', 'Animal', 'Bird', 'Robot']) assert.match(markup, new RegExp(`>${label}<`));
  // The two escapes the brief asks for, kept secondary.
  assert.match(markup, /data-wizard-other="blank"/);
  assert.match(markup, /data-wizard-other="import"/);
});

test('the second screen keeps the mascot in front of the choices', () => {
  const characters = mascotCharacters('beak');
  const markup = characterStepMarkup({ type: 'beak', characters, selected: 'duck' });
  // The kind, in the author's word, so it is clear what is being narrowed.
  assert.match(markup, /Bird/);
  assert.match(markup, /Which one\?/);
  // One selected card, one preview, one primary action.
  assert.equal((markup.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(markup, /data-wizard-character="duck"[^>]*aria-pressed="true"/);
  assert.match(markup, /data-wizard-preview/);
  assert.equal((markup.match(/class="primary btn-lg/g) || []).length, 1);
  // Named after the character, because hovering another card peeks at it: a
  // button reading "this mascot" would point at whichever face the pointer is
  // over rather than at the one it would make.
  assert.match(markup, /Create Duck →/);
  // With no characters at all, nothing can be created.
  assert.match(characterStepMarkup({ type: 'beak', characters: [] }), /data-wizard-create disabled/);
});

test('an unknown selection falls back to the first character rather than to none', () => {
  const characters = mascotCharacters('robot');
  const markup = characterStepMarkup({ type: 'robot', characters, selected: 'not-a-character' });
  assert.match(markup, new RegExp(`data-wizard-character="${characters[0].id}"[^>]*aria-pressed="true"`));
});
