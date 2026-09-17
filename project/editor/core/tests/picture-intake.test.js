import test from 'node:test';
import assert from 'node:assert/strict';
import { INTAKE_ROLES, describeIntake, intakeFor, roleForName } from '../../ui/picture-intake.js';

/**
 * What a dropped file is, and how it should move
 * (V5-03, docs/V5_MASCOTTE_IMAGES_ETUDE.md).
 *
 * The editor already knew how to read a file name — `face-role-detection.js`
 * has understood `eye`, `brow`, `pupil`, `mouth`, `head` and the sides since
 * V3 — and never used it for this, which is why it was possible to import
 * `eye-left.png` and be told three screens later that every role was still
 * missing. Nothing here is new cleverness; it is the reading that already
 * happens, happening where it can fill in a form.
 */

test('a file name answers the first question when it can', () => {
  assert.equal(roleForName('eye-left.png'), 'leftEye');
  assert.equal(roleForName('oeil-gauche.png'), 'leftEye', 'a French file name is a file name');
  assert.equal(roleForName('EyeRight.webp'), 'rightEye', 'camel case is two words');
  assert.equal(roleForName('pupil-right.png'), 'rightPupil');
  assert.equal(roleForName('sourcil-droite.png'), 'rightBrow');
  assert.equal(roleForName('bouche.png'), 'mouth');
  assert.equal(roleForName('head.png'), 'head');
});

test('and says nothing rather than guessing', () => {
  // A missing role is a `<select>` an author uses; a wrong one is a piece
  // silently rigged as something it is not.
  assert.equal(roleForName('IMG_2043.png'), '', 'a camera name says nothing');
  assert.equal(roleForName('eyes.png'), '', 'both eyes in one drawing is not one of the two');
  assert.equal(roleForName('eye-left-right.png'), '', 'a name that says both sides says neither');
  assert.equal(roleForName(''), '');
  assert.equal(roleForName('arm.png'), '', 'an arm is a piece, and that is a first-class answer');
});

test('the role proposes the movement, and a picture is never offered what it cannot have', () => {
  assert.deepEqual(
    ['eye-left.png', 'mouth.png', 'head.png', 'IMG_1.png'].map((name) => intakeFor(name).rigging),
    ['states', 'states', 'rigid', 'rigid']
  );
  // Both boxes are `<select>`s: this proposes and never decides.
  const forced = intakeFor('eye-left.png', { role: '', rigging: 'fixed' });
  assert.equal(forced.role, '');
  assert.equal(forced.rigging, 'fixed');
  assert.equal(forced.detected, 'leftEye', 'and it still says what it read, so the proposal can be put back');

  const picture = intakeFor('drawing.png', { nodeType: 'image' });
  assert.deepEqual(picture.riggings.filter((entry) => !entry.allowed).map((entry) => entry.id), ['outline']);
  assert.deepEqual(intakeFor('drawing.svg', { nodeType: 'path' }).riggings.filter((entry) => !entry.allowed), []);
});

test('"just a piece" is an answer, and it is the first one offered', () => {
  assert.equal(INTAKE_ROLES[0].id, '');
  assert.equal(INTAKE_ROLES[0].label, 'Just a piece');
  assert.equal(INTAKE_ROLES.length, 9, 'the eight face roles and the one that means none of them');
  assert.ok(INTAKE_ROLES.every((entry) => entry.label && entry.hint));
});

test('the two boxes are said back as one line', () => {
  assert.equal(describeIntake(intakeFor('eye-left.png')), 'Left eye · several drawings');
  assert.equal(describeIntake(intakeFor('arm.png')), 'Just a piece · moves as one piece');
  assert.equal(describeIntake(null), '');
});
