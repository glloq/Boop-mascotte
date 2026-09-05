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

test('every movement the registry declares has a name, not a parameter id', async () => {
  const { SEMANTIC_PART_REGISTRY } = await import('../../rig-editor/semantic-parts/part-registry.js');
  const declared = [...new Set(Object.values(SEMANTIC_PART_REGISTRY).flatMap((part) => part.controls || []))];
  assert.ok(declared.length > 10, 'the registry declares movements to check');
  // A control with no entry reads as "Other · earWiggle" in the timeline, the
  // arrangement rows, the palette and the motion composer at once — the same
  // complaint VNX-34 fixed for hands, which are generated and cannot be listed.
  const unnamed = declared.filter((control) => controlMeta(control).group === 'Other');
  assert.deepEqual(unnamed, [], `these movements have no catalogue entry: ${unnamed.join(', ')}`);
  for (const control of declared) assert.notEqual(controlMeta(control).label, control, `${control} shows its own id as its name`);
});

test('every parameter the rig itself generates has a name too, not a parameter id', async () => {
  // The registry check above only reaches the movements a *part* declares. The
  // control rig generates parameters of its own — a mouth corner's offset, a
  // brow's inner end, the lock, a hold's contact weight — and those reach the
  // timeline, the palette and the arrangement rows exactly like the rest. This
  // walks what the template actually builds, so a rig added after this was
  // written is checked by the same test rather than by nobody.
  const { createCleanProjectState } = await import('../state/store.js');
  const { PROJECT_TEMPLATES, applyTemplateProject } = await import('../sample/templates/index.js');
  const paths = new Set(['head', 'mouth', 'teeth', 'tongue', 'lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight', 'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'shadeLeft', 'shadeRight']);
  const eyeChildren = (side) => [`eyeWhite${side}`, `pupil${side}`, `glint${side}`, `lidUpper${side}`, `lidLower${side}`, `rim${side}`];
  const earChildren = (side) => [`ear${side}Shape`, `ear${side}Fold`];
  const faceChildren = ['hairBack', 'earLeft', 'earRight', 'head', 'shadeLeft', 'shadeRight',
    'mouth', 'tongue', 'teeth', 'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair'];
  const ids = ['faceRoot', ...faceChildren, ...eyeChildren('Left'), ...eyeChildren('Right'), ...earChildren('Left'), ...earChildren('Right')];
  const element = (id) => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: paths.has(id) ? 'path' : 'circle' } });
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  const leaf = (id) => ({ id, type: state.elements[id].meta.nodeType, name: id, children: [] });
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: faceChildren.map((id) => (id === 'eyeLeft' || id === 'eyeRight'
    ? { id, type: 'g', name: id, children: eyeChildren(id === 'eyeLeft' ? 'Left' : 'Right').map(leaf) }
    : leaf(id))) }];
  applyTemplateProject(state);

  const generated = Object.keys(state.params);
  assert.ok(generated.length > 40, 'the template builds a rig to check');
  const unnamed = generated.filter((control) => controlMeta(control).group === 'Other');
  assert.deepEqual(unnamed, [], `these parameters have no catalogue entry: ${unnamed.join(', ')}`);
  for (const control of generated) assert.notEqual(controlMeta(control).label, control, `${control} shows its own id as its name`);

  // And a contact — the parameter a hold is keyed by, generated from the two
  // points it joins, so no table could ever list it.
  assert.deepEqual(controlMeta('contactIndexTipNose'),
    { label: 'Contact · index tip nose', part: null, group: 'Holding', section: 'Contacts' });
});
