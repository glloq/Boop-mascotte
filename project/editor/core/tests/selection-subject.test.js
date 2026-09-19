/**
 * The one answer to "what is in hand" (UX-50 PR 1).
 *
 * These are the rules every contextual panel inherits, so they are worth being
 * explicit about: which half of the selection wins, what happens when the two
 * disagree, and what a panel is told when the answer is "nothing".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { partBand, partCategory, partsInBand, selectionBand, selectionSubject } from '../selectors/selection-subject.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { MOVEMENT_BANDS } from '../../rig-editor/semantic-parts/face-movements.js';

/** The template, which is the one fixture with a whole rigged face in it. */
const face = () => createTemplateProjectState();
const partOfType = (state, type) => Object.values(state.semanticParts).find((part) => part.type === type);

test('nothing selected is answered as nothing, not as everything', () => {
  const state = face();
  assert.equal(selectionSubject(state, {}), null);
  assert.equal(selectionSubject(state, { selectedId: null, activeSemanticPartId: null }), null);
  assert.equal(selectionBand(state, {}), null);
  // An empty document with a selection left over from a project since replaced.
  assert.equal(selectionSubject({}, { selectedId: 'mouth', activeSemanticPartId: 'mouth-1' }), null);
});

test('an active part with nothing in hand is a panel default, not a selection', () => {
  // `rig-panel.js` writes its own fallback back into the session so its
  // navigator has a row to highlight. A freshly loaded template therefore
  // reports `head` while the author has touched nothing, and reading that as a
  // selection made the movements panel open on the head's movements and the
  // parts library open on heads — in answer to a choice nobody made.
  const state = face();
  const head = partOfType(state, 'head');
  assert.equal(selectionSubject(state, { activeSemanticPartId: head.id }), null);
  assert.equal(selectionSubject(state, { selectedId: null, activeSemanticPartId: head.id }), null);
  // With something in hand it counts again, which is the whole of the rule.
  assert.equal(selectionSubject(state, { selectedId: head.roles.head, activeSemanticPartId: head.id })?.partId, head.id);
});

test('the piece in hand outranks the part a panel left active', () => {
  // The bug this rule exists for: a bare canvas click writes `selectedId` and
  // nothing else, so a reader that trusted `activeSemanticPartId` was still
  // showing the eyes after the author had clicked the mouth.
  const state = face();
  const mouth = partOfType(state, 'mouth'), eyes = partOfType(state, 'eyes');
  assert.ok(mouth && eyes, 'the template has a mouth and eyes');
  const subject = selectionSubject(state, { selectedId: mouth.roles.mouth, activeSemanticPartId: eyes.id });
  assert.equal(subject.partId, mouth.id);
  assert.equal(subject.partType, 'mouth');
  assert.equal(subject.band, 'Mouth');
  assert.equal(subject.via, 'role');
});

test('a piece that is nobody’s role leaves the active part alone', () => {
  // Containment is generous -- everything on a face is inside the head's group
  // -- so letting it outrank the active part would mean clicking a decoration
  // threw away the mouth somebody was working on.
  const state = face();
  const mouth = partOfType(state, 'mouth');
  state.elements.sparkle = { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } };
  const subject = selectionSubject(state, { selectedId: 'sparkle', activeSemanticPartId: mouth.id });
  assert.equal(subject.partId, mouth.id, 'the mouth is still the subject');
  assert.equal(subject.via, 'part');
});

test('with nothing active, a piece drawn inside a part answers that part', () => {
  const state = face();
  const head = partOfType(state, 'head');
  const subject = selectionSubject(state, { selectedId: head.roles.head });
  assert.equal(subject.partId, head.id);
  assert.equal(subject.band, 'Head');
  assert.equal(subject.via, 'role');
});

test('a movement only belongs to the subject when the subject carries it', () => {
  const state = face();
  const mouth = partOfType(state, 'mouth');
  const held = selectionSubject(state, { selectedId: mouth.roles.mouth, activeControl: 'mouthOpen' });
  assert.equal(held.control, 'mouthOpen');
  // The Inspector's last movement, left over from the brows. Reporting it as
  // the mouth's would put a brow control in a mouth heading.
  const stale = selectionSubject(state, { selectedId: mouth.roles.mouth, activeControl: 'browRaise' });
  assert.equal(stale.control, null);
});

test('a subject names its band and its library category, so panels need no table of their own', () => {
  const state = face();
  const eyes = partOfType(state, 'eyes');
  const subject = selectionSubject(state, { selectedId: eyes.roles.leftEye, activeSemanticPartId: eyes.id });
  assert.equal(subject.band, 'Eyes');
  assert.equal(subject.category, 'eyes', 'the library category that dresses this part');
  assert.equal(typeof subject.label, 'string');
  assert.ok(subject.label.length, 'and something to put in a heading');
});

test('every band a part can be filed under is one the movements panel knows', () => {
  // A part filed under a band the panel has no column for is a part whose
  // movements nobody can reach.
  for (const type of ['head', 'eyes', 'eyelids', 'gaze', 'eyebrows', 'nose', 'mouth', 'jaw', 'tongue', 'hair', 'ears', 'teeth', 'mouthCavity']) {
    assert.ok(MOVEMENT_BANDS.includes(partBand(type)), `${type} is filed under a real band`);
  }
  assert.equal(partBand('somethingNobodyHasInvented'), 'Extra', 'and an unknown part falls to Extra rather than vanishing');
});

test('the parts drawn inside a face part are filed with it, not dumped in Extra', () => {
  // Teeth and a mouth cavity carry no movement of their own, so deriving the
  // band from the movement table alone would file them under Extra, which is
  // the one place an author looking for the mouth would not look.
  assert.equal(partBand('teeth'), 'Mouth');
  assert.equal(partBand('mouthCavity'), 'Mouth');
  assert.ok(partsInBand('Mouth').includes('teeth'));
});

test('a part with no library drawings says so rather than naming a category that is not there', () => {
  assert.equal(partCategory('mouth'), 'mouth');
  assert.equal(partCategory('eyebrows'), 'eyebrows');
  assert.equal(partCategory('jaw'), null, 'the library ships no jaws');
});

test('the group a library drawing was installed as is that part, not the part above it', () => {
  // Installing a pair of eyes selects the group it arrived as, and that group
  // is not one of the part's roles — the roles are inside it. Reading it by
  // containment answers nothing (containment only looks downwards), so the
  // answer used to fall through to whatever part was active: choosing new eyes
  // left the parts library showing heads.
  const state = face();
  const eyes = partOfType(state, 'eyes'), head = partOfType(state, 'head');
  eyes.assetRoot = 'installedEyes';
  state.elements.installedEyes = { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'g' } };
  const subject = selectionSubject(state, { selectedId: 'installedEyes', activeSemanticPartId: head.id });
  assert.equal(subject.partId, eyes.id);
  assert.equal(subject.category, 'eyes');
  assert.equal(subject.via, 'role');
});
