import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { suggestFaceRoles, tokenize } from '../../rig-editor/semantic-parts/face-role-detection.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id, name, type = 'path', children = []) => ({ id, name, type, visible: true, children });
const frame = (x, y, width, height) => ({ x, y, width, height, cx: x + width / 2, cy: y + height / 2 });
function project(layers, geometry = {}) {
  const elements = {};
  const visit = (items) => items.forEach((item) => { elements[item.id] = element(); visit(item.children); });
  visit(layers);
  return { document: { svgMarkup: '<svg/>', elements, layers, layerMetadata: {}, semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', animationClips: [] }, geometry: (id) => geometry[id] || null };
}

test('tokenize splits camelCase, kebab, snake and digit suffixes into lowercase words', () => {
  assert.deepEqual(tokenize('journeyEyeL'), ['journey', 'eye', 'l']);
  assert.deepEqual(tokenize('pupil-left_2'), ['pupil', 'left', '2']);
  assert.deepEqual(tokenize('Left eyebrow'), ['left', 'eyebrow']);
  assert.deepEqual(tokenize(''), []);
});

test('explicit side names give high-confidence suggestions for every basic role without geometry', () => {
  const { document } = project([layer('faceRoot', 'Face', 'g', [
    layer('head', 'Head shape'), layer('eyeLeft', 'Left eye'), layer('eyeRight', 'Right eye'), layer('pupilLeft', 'Left pupil'), layer('pupilRight', 'Right pupil'),
    layer('browLeft', 'Left eyebrow'), layer('browRight', 'Right eyebrow'), layer('mouth', 'Mouth'), layer('upperLidLeft', 'Left upper eyelid')
  ])]);
  const before = structuredClone(document);
  const { suggestions, acceptable } = suggestFaceRoles(document);
  assert.deepEqual(document, before, 'detection never mutates the document');
  assert.deepEqual(Object.fromEntries(Object.entries(suggestions).map(([role, s]) => [role, s.elementId])), {
    head: 'faceRoot', leftEye: 'eyeLeft', rightEye: 'eyeRight', leftPupil: 'pupilLeft', rightPupil: 'pupilRight', leftBrow: 'browLeft', rightBrow: 'browRight', mouth: 'mouth'
  });
  assert.ok(Object.values(suggestions).every((s) => s.confidence === 'high' || s.confidence === 'medium'));
  assert.equal(acceptable.length, 8);
  assert.equal(suggestions.leftEye.confidence, 'high');
  assert.match(suggestions.leftEye.reasons[0], /Left eye/);
});

test('unsided pairs are ordered by canvas position with medium confidence, or flagged low without geometry', () => {
  const layers = [layer('bg', 'Background'), layer('eyeA', 'Eye'), layer('eyeB', 'Eye'), layer('grin', 'Mouth')];
  const geometry = { eyeA: frame(150, 100, 40, 30), eyeB: frame(50, 100, 40, 30), grin: frame(80, 160, 80, 20), bg: frame(0, 0, 240, 240) };
  const { document, geometry: lookup } = project(layers, geometry);
  const positioned = suggestFaceRoles(document, { geometry: lookup });
  assert.equal(positioned.suggestions.leftEye.elementId, 'eyeB', 'smaller canvas x is the left eye');
  assert.equal(positioned.suggestions.rightEye.elementId, 'eyeA');
  assert.equal(positioned.suggestions.leftEye.confidence, 'medium');
  assert.equal(positioned.suggestions.mouth.confidence, 'high');
  assert.equal(positioned.suggestions.head, undefined, 'a background containing only two features is not the head');
  const blind = suggestFaceRoles(document);
  assert.equal(blind.suggestions.leftEye.confidence, 'low');
  assert.equal(blind.suggestions.rightEye.confidence, 'low');
  assert.ok(!blind.acceptable.includes('leftEye'), 'low confidence is never accept-all material');
});

test('unnamed artwork only yields a medium head-by-containment suggestion', () => {
  const layers = ['s1', 's2', 's3', 's4', 's5'].map((id) => layer(id, id));
  const geometry = { s1: frame(0, 0, 200, 200), s2: frame(40, 60, 30, 20), s3: frame(120, 60, 30, 20), s4: frame(70, 140, 60, 15), s5: frame(300, 300, 10, 10) };
  const { document, geometry: lookup } = project(layers, geometry);
  const { suggestions, acceptable } = suggestFaceRoles(document, { geometry: lookup });
  assert.deepEqual(Object.keys(suggestions), ['head']);
  assert.equal(suggestions.head.elementId, 's1');
  assert.equal(suggestions.head.confidence, 'medium');
  assert.deepEqual(acceptable, ['head']);
});

test('assigned roles and their artwork are excluded, and groups lose to leaf shapes except for the head', () => {
  const { document, geometry } = project([layer('face', 'Face', 'g', [layer('head', 'Head'), layer('eyeLeftGroup', 'Left eye group', 'g', [layer('eyeLeft', 'Left eye'), layer('pupilLeft', 'Left pupil')]), layer('mouthBase', 'Mouth base'), layer('mouth', 'Mouth')])],
    { face: frame(0, 0, 240, 240), head: frame(10, 10, 220, 220), eyeLeftGroup: frame(50, 90, 60, 40), eyeLeft: frame(50, 90, 60, 40), pupilLeft: frame(70, 100, 16, 16), mouthBase: frame(60, 150, 120, 40), mouth: frame(80, 160, 80, 20) });
  document.semanticParts = { head: { id: 'head', type: 'head', name: 'Head', roles: { head: 'face' }, controls: [], controlDrivers: {}, calibration: {} } };
  const { suggestions } = suggestFaceRoles(document, { geometry });
  assert.equal(suggestions.head, undefined, 'assigned roles get no suggestion');
  assert.equal(suggestions.leftEye.elementId, 'eyeLeft', 'leaf shape beats its wrapping group');
  assert.equal(suggestions.leftPupil.elementId, 'pupilLeft');
  assert.equal(suggestions.mouth.elementId, 'mouth', 'exclusion words remove decorative bases');
  assert.equal(suggestions.rightEye, undefined);
});

test('assignFaceRoles applies an accepted batch as one undoable command and rejects it atomically', () => {
  const { document } = project([layer('head', 'Head'), layer('eyeLeft', 'Left eye'), layer('eyeRight', 'Right eye')]);
  const store = createEditorStore(document), history = createHistory(store), commands = createSemanticRigCommands(store, history);
  const revision = store.getPersistentRevision();
  const parts = commands.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'eyes', role: 'leftEye', elementId: 'eyeLeft' }, { type: 'eyes', role: 'rightEye', elementId: 'eyeRight' }]);
  assert.deepEqual(parts, ['head', 'eyes', 'eyes']);
  assert.equal(store.getPersistentRevision(), revision + 1);
  assert.deepEqual(store.getDocument().semanticParts.eyes.roles, { leftEye: 'eyeLeft', rightEye: 'eyeRight' });
  history.undo();
  assert.deepEqual(store.getDocument().semanticParts, {}, 'one undo reverts the whole batch');
  const before = structuredClone(store.getDocument()), undoable = history.getState();
  assert.throws(() => commands.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'mouth', role: 'mouth', elementId: 'missing' }]), /does not exist/);
  assert.deepEqual(store.getDocument(), before, 'a failing entry cancels the whole batch');
  assert.deepEqual(history.getState(), undoable);
});
