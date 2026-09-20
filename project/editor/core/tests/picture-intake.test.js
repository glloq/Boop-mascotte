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
  // The rest of the face, in both languages: the reading used to stop at the
  // eyes, the brows, the pupils, the mouth and the head, so importing hair or
  // an ear proposed nothing at all.
  assert.equal(roleForName('cheveux.png'), 'hair');
  assert.equal(roleForName('ear-left.png'), 'leftEar');
  assert.equal(roleForName('oreille-droite.webp'), 'rightEar');
  assert.equal(roleForName('nez.png'), 'nose');
  assert.equal(roleForName('museau.png'), 'nose', 'a snout is where a nose goes');
  assert.equal(roleForName('langue.svg'), 'tongue');
  assert.equal(roleForName('dents.png'), 'teeth');
  assert.equal(roleForName('machoire.png'), 'jaw');
  assert.equal(roleForName('barbe.png'), 'facialHair');
  assert.equal(roleForName('eyelid-left.png'), 'leftUpper', 'a lid says "eye" too, and the lid is what it is');
  // A head of hair is three pieces, and a name says which: the tokeniser
  // splits `hair-back` into two words, neither of which is the piece.
  assert.equal(roleForName('hair-back.png'), 'hairBack');
  assert.equal(roleForName('cheveux-arriere.png'), 'hairBack');
  assert.equal(roleForName('hair-top.png'), 'hairTop');
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
  // The eight of the checklist, everything else the registry knows, and the one
  // that means none of them. A form that read `cheveux.png` correctly and then
  // had no *Hair* to offer was the gap this closes: hair, ears, a nose, a jaw,
  // a tongue, teeth and the lids had nowhere to be said
  // (semantic-parts/face-role-vocabulary.js).
  // Twenty-six since the gaze grew an iris per side: a build that draws one
  // needs somewhere to say so when the drawing arrives as a picture
  // (docs/EYE_BUILDS.md). Twenty-eight since the mouth grew a lower row of
  // teeth and the tongue a tip (docs/MOUTH_BUILD.md) -- one name each, even
  // though the tip is a role of the mouth *and* of the tongue part.
  assert.equal(INTAKE_ROLES.length, 28);
  assert.ok(INTAKE_ROLES.every((entry) => entry.label && entry.hint));
  assert.deepEqual(INTAKE_ROLES.slice(1, 9).map((entry) => entry.id),
    ['head', 'leftEye', 'rightEye', 'leftPupil', 'rightPupil', 'leftBrow', 'rightBrow', 'mouth'],
    'the beginner eight first, in their own order');
  for (const role of ['hair', 'hairBack', 'leftEar', 'nose', 'jaw', 'tongue', 'tongueTip', 'teeth', 'teethLower', 'leftUpper', 'leftIris', 'rightIris', 'facialHair']) {
    assert.ok(INTAKE_ROLES.some((entry) => entry.id === role), `${role} can be said`);
  }
  // One name for one role: the tongue is a role of the mouth *and* a part of
  // its own, and offering it twice would be offering a choice between the same
  // two words.
  const ids = INTAKE_ROLES.map((entry) => entry.id);
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
  // A hand is drawn as a pair from Design ▸ Hands, not handed out as a role.
  assert.equal(ids.includes('hand'), false);
});

test('the two boxes are said back as one line', () => {
  assert.equal(describeIntake(intakeFor('eye-left.png')), 'Left eye · several drawings');
  assert.equal(describeIntake(intakeFor('arm.png')), 'Just a piece · moves as one piece');
  assert.equal(describeIntake(null), '');
});
