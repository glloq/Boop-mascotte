import test from 'node:test';
import assert from 'node:assert/strict';
import { controlMeta, availableControlGroups } from '../../ui/control-catalog.js';
import { selectionFocus } from '../../animation-editor/timeline/timeline-panel.js';

/**
 * Reading a timeline (VNX-33, VNX-34).
 *
 * Two complaints, one cause. A hand's controls are *generated* — `handLX`,
 * `handRGrip`, `handLIndex`, `handRFist` — so no static table could name them,
 * and they fell through to the fallback: fifteen raw ids under "Other", in the
 * timeline, the palette and every message that names a movement. And with them
 * named, a clip that moves a hand and a face still shows every track at once.
 */

test('a hand control has a name and a home, whatever suffix it was generated with', () => {
  assert.deepEqual(controlMeta('handRX'), { label: 'Move left / right', part: 'hand-right', group: 'Right hand', section: 'Transform' });
  assert.deepEqual(controlMeta('handLGrip'), { label: 'Close the hand', part: 'hand-left', group: 'Left hand', section: 'Shape' });
  assert.equal(controlMeta('handRIndex').section, 'Fingers');
  assert.equal(controlMeta('handLThumb').label, 'Thumb');
  // A pose an author named is read back as words, not as the parameter it made.
  assert.deepEqual(controlMeta('handRThumbsUp'), { label: 'Thumbs up', part: 'hand-right', group: 'Right hand', section: 'Poses' });
  assert.equal(controlMeta('handLFist').label, 'Fist');
});

test('the fallback still catches what is genuinely unknown', () => {
  // The rule reads the hand naming convention back; it does not claim anything
  // that merely starts with "hand".
  assert.deepEqual(controlMeta('wobble'), { label: 'wobble', part: null, group: 'Other' });
  assert.deepEqual(controlMeta('handshake'), { label: 'handshake', part: null, group: 'Other' });
  assert.equal(controlMeta('headX').group, 'Head', 'and the declared catalogue still wins');
});

test('the two hands are two groups, not fifteen rows of Other', () => {
  const params = { handLX: {}, handLY: {}, handLGrip: {}, handRX: {}, handRIndex: {}, headX: {}, wobble: {} };
  const groups = availableControlGroups(params);
  assert.deepEqual([...groups.keys()].sort(), ['Head', 'Left hand', 'Other', 'Right hand']);
  assert.deepEqual(groups.get('Left hand').map((item) => item.id).sort(), ['handLGrip', 'handLX', 'handLY']);
  assert.deepEqual(groups.get('Other').map((item) => item.id), ['wobble'], 'and Other holds only what really is other');
});

test('the timeline follows the part the author is working on, and falls back to the artwork', () => {
  // A semantic part is the strong answer; a selected piece of artwork is the
  // fallback, resolved through the same catalogue the tracks are grouped by —
  // so the filter can never disagree with the grouping.
  assert.equal(selectionFocus({}, { get: () => ({ activeSemanticPartId: 'mouth' }) }), 'mouth');
  assert.equal(selectionFocus({ selectedId: 'handRX' }, { get: () => ({}) }), 'hand-right');
  assert.equal(selectionFocus({ selectedId: 'nothing-known' }, { get: () => ({}) }), null);
  assert.equal(selectionFocus({}, null), null, 'and with nothing selected there is nothing to filter by');
});
