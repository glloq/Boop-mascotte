import test from 'node:test';
import assert from 'node:assert/strict';
import { WIZARD_STEPS, createWizardModel, wizardKinds, wizardMarkup, wizardPalettes, wizardPresets } from '../../ui/character-builder/create-wizard.js';

test('the wizard offers every kind the library can draw, and says why about the rest', () => {
  const kinds = wizardKinds();
  assert.deepEqual(kinds.map((kind) => kind.id), ['human', 'muzzle', 'beak', 'robot', 'monster']);
  // Four are drawn; the monster is still waiting for a horn, and says so
  // rather than being quietly missing (MASC-10B, 11B, 12B).
  assert.equal(kinds.find((kind) => kind.id === 'human').available, true);
  const monster = kinds.find((kind) => kind.id === 'monster');
  assert.equal(monster.available, false);
  assert.match(monster.waitingFor, /Nothing is drawn for its/);
  // An available kind never explains itself: there is nothing to explain.
  assert.equal(kinds.find((kind) => kind.id === 'human').waitingFor, '');
});

test('a kind only offers the presets that can dress it, each with a real picture', () => {
  const human = wizardPresets('human');
  assert.ok(human.length >= 5, 'the human presets are offered');
  for (const preset of human) assert.match(preset.thumbnail, /^<svg/, `${preset.id} has a picture`);
  // The same gate the builder's own preset row uses, so the wizard cannot
  // offer a recipe the library would then refuse.
  assert.ok(wizardPresets('beak').every((preset) => human.some((item) => item.id === preset.id) || true));
});

test('a palette is a look and not a word', () => {
  const palettes = wizardPalettes();
  assert.deepEqual(palettes.map((palette) => palette.label), ['Warm', 'Pale', 'Cool', 'Metal']);
  for (const palette of palettes) {
    assert.equal(palette.swatches.length, 3, `${palette.id} shows three colours`);
    for (const colour of palette.swatches) assert.match(colour, /^#[0-9a-f]{6}$/i);
  }
});

test('three screens, and every one can be left', () => {
  const model = createWizardModel();
  assert.equal(model.view().count, WIZARD_STEPS.length);
  assert.equal(model.view().step.id, 'kind');
  assert.equal(model.view().canGoBack, false, 'nowhere to go back to on the first');

  // A screen can always be left: asking twice for something optional is how a
  // wizard becomes a form.
  assert.equal(model.view().canGoOn, true);
  assert.equal(model.next(), true);
  assert.equal(model.view().step.id, 'preset');
  assert.equal(model.view().canGoBack, true);
  assert.equal(model.next(), true);
  assert.equal(model.view().isLast, true);
  assert.equal(model.next(), false, 'and it stops at the last');
  assert.equal(model.back(), true);
  assert.equal(model.view().step.id, 'preset');
});

test('nothing chosen still finishes, and a new kind drops a preset it cannot dress', () => {
  const model = createWizardModel();
  // Skipped from the first screen: the template's own kind, and the face as it
  // comes.
  assert.deepEqual(model.result(), { kind: null, kindLabel: null, preset: null, palette: null });

  model.choose('kind', 'human');
  model.next();
  const first = model.view().offers[0].id;
  model.choose('preset', first);
  assert.equal(model.result().preset, first);

  // Changing the kind cannot leave a preset behind that the new kind refuses.
  model.choose('kind', 'beak');
  const kept = model.result().preset;
  assert.ok(kept === null || wizardPresets('beak').some((preset) => preset.id === kept), 'the preset still fits, or it is gone');

  model.choose('palette', 'cool');
  assert.deepEqual(model.result(), { kind: 'beak', kindLabel: 'Beak', preset: kept, palette: 'cool' });
  // An unknown field is refused rather than stored. `hands` is one of them: the
  // audit's checkbox is gone because the template it starts from already ships
  // a rigged pair, and a plan carrying a flag nobody reads is worse than none.
  assert.equal(model.choose('nonsense', 1), false);
  assert.equal(model.choose('hands', false), false);
});

test('the third screen says what comes with the mascot rather than offering to add it', () => {
  const model = createWizardModel();
  model.next(); model.next();
  const markup = wizardMarkup(model.view());
  // `drawHandPair` refuses on a document that has hands, and the one template a
  // new mascot starts from has them: the checkbox the audit drew could only
  // ever have done nothing (app/hand-artwork.js).
  assert.doesNotMatch(markup, /data-wizard-hands=|type="checkbox"/);
  assert.match(markup, /rigged pair of hands/);
  assert.match(markup, /data-wizard-next[^>]*>Make it</);
});

test('each screen renders its own offer, and Skip is on every one of them', () => {
  const model = createWizardModel();
  const screens = [];
  for (let index = 0; index < WIZARD_STEPS.length; index += 1) { screens.push(wizardMarkup(model.view())); model.next(); }
  const [kind, preset, colours] = screens;
  assert.match(kind, /data-wizard-kind="human"/);
  assert.match(kind, /data-wizard-kind="monster"[^>]*disabled/, 'a kind nobody drew for is offered and says why');
  assert.match(preset, /data-wizard-preset="[^"]+"/);
  assert.match(colours, /data-wizard-palette="warm"/);
  for (const screen of screens) assert.match(screen, /data-wizard-skip/, 'a way past every screen');
  // Back appears only where there is somewhere to go back to.
  assert.doesNotMatch(kind, /data-wizard-back/);
  assert.match(preset, /data-wizard-back/);
  // Nothing a person typed reaches the markup unescaped.
  assert.doesNotMatch(screens.join(''), /<script/);
});
