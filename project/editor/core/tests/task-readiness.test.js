import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { deriveTaskReadiness, groupReadiness, readinessVerdict, worstStatus } from '../validation/task-readiness.js';
import { validateProject } from '../validation/validate-project.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id) => ({ id, name: id, type: 'path', visible: true, children: [] });
function faceProject() {
  const ids = ['head', 'eyeL', 'eyeR', 'pupilL', 'pupilR', 'browL', 'browR', 'mouth'];
  return { svgMarkup: '<svg/>', elements: Object.fromEntries(ids.map((id) => [id, element()])), layers: ids.map(layer), layerMetadata: {}, semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', animationClips: [], behaviors: [] };
}

test('task readiness reports plain statuses, stable codes and routes for an empty project', () => {
  const empty = deriveTaskReadiness({ svgMarkup: '', layers: [] }, validateProject({ svgMarkup: '' }));
  assert.equal(empty.artwork.status, 'error'); assert.equal(empty.artwork.code, 'artwork.missing');
  assert.deepEqual(empty.artwork.route, { task: 'artwork' });
  assert.equal(empty.faceSetup.status, 'todo'); assert.equal(empty.movements.status, 'todo');
  assert.equal(empty.export.status, 'error'); assert.equal(empty.export.code, 'export.blocked');
  assert.equal(empty.export.issueId, 'artwork.missing');
  assert.deepEqual(empty.export.route, { task: 'create', target: { kind: 'diagnostic', diagnosticId: 'artwork.missing' } });
  assert.equal(empty.next.id, 'artwork');
  assert.deepEqual(empty.order, ['artwork', 'faceSetup', 'movements', 'expressions', 'animate', 'reactions', 'export']);
  assert.equal(empty.expressions.status, 'todo');
  assert.equal(worstStatus('ready', 'warning', 'todo'), 'warning');
  assert.equal(worstStatus('todo', 'error'), 'error');
});

test('face parts and movements progress through todo, warning and ready with deep-link targets', () => {
  const store = createEditorStore(faceProject()), commands = createSemanticRigCommands(store, createHistory(store));
  const at = () => deriveTaskReadiness(store.getDocument(), validateProject(store.getDocument()));
  let model = at();
  assert.equal(model.artwork.status, 'ready'); assert.equal(model.artwork.summary, '8 layers');
  assert.equal(model.faceSetup.status, 'todo'); assert.equal(model.faceSetup.code, 'face.roles.none');
  assert.equal(model.next.id, 'faceSetup');
  commands.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'gaze', role: 'leftPupil', elementId: 'pupilL' }, { type: 'gaze', role: 'rightPupil', elementId: 'pupilR' }]);
  model = at();
  assert.equal(model.faceSetup.status, 'warning'); assert.equal(model.faceSetup.code, 'face.roles.missing');
  assert.deepEqual(model.faceSetup.missing, ['leftEye', 'rightEye', 'leftBrow', 'rightBrow', 'mouth']);
  assert.match(model.faceSetup.action, /Assign left eye/);
  assert.equal(model.movements.status, 'todo'); assert.equal(model.movements.code, 'face.movements.none');
  commands.enableControl('gaze', 'lookX');
  model = at();
  assert.equal(model.movements.status, 'warning'); assert.equal(model.movements.code, 'face.movements.uncalibrated');
  assert.deepEqual(model.movements.route, { task: 'face-setup', target: { kind: 'semantic-control', part: 'gaze', control: 'lookX' }, focus: 'face-movements' });
  const pose = (x) => ({ leftPupil: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, rightPupil: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } });
  commands.captureAndCalibrate('gaze', 'lookX', { key: 'left', value: -1, pose: pose(-10) });
  commands.captureAndCalibrate('gaze', 'lookX', { key: 'right', value: 1, pose: pose(10) });
  model = at();
  assert.equal(model.movements.status, 'ready'); assert.equal(model.movements.summary, '1 on · 1 set up');
  assert.equal(model.animate.status, 'optional');
  assert.equal(model.expressions.status, 'optional');
  assert.equal(model.export.status, 'ready');
  assert.equal(model.blocking, 0);
  assert.equal(Object.isFrozen(model), true, 'readiness is a detached, read-only projection');
});

test('preview behavior overrides are transient and never touch the document', () => {
  const document = { ...faceProject(), params: { eyeOpen: { type: 'number', min: 0, max: 1, default: 1, value: 1 } }, states: { idle: { eyeOpen: 1 } }, behaviors: [{ id: 'blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', intervalMin: 0, intervalMax: 0, duration: .1, closedValue: 0 }] };
  const store = createEditorStore(document), frames = [];
  const canvas = { applyFrame: (frame) => frames.push(frame) };
  const preview = createPreviewController({ store, canvas, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });
  const revision = store.getPersistentRevision(), before = structuredClone(store.getDocument());
  preview.setBehaviorOverride('blink', false);
  assert.deepEqual(preview.getBehaviorOverrides(), { blink: false });
  assert.deepEqual(preview.getSession().behaviorOverrides, { blink: false });
  assert.deepEqual(store.getDocument(), before);
  assert.equal(store.getPersistentRevision(), revision);
  preview.setBehaviorOverride('blink', true);
  assert.deepEqual(preview.getBehaviorOverrides(), { blink: true });
  preview.reset();
  assert.deepEqual(preview.getBehaviorOverrides(), {});
  assert.deepEqual(store.getDocument(), before);
  assert.ok(frames.length > 0, 'overrides recompute the frame');
});

test('the artwork summary counts the whole layer tree, like the panel above it', () => {
  const nested = { svgMarkup: '<svg/>', layers: [{ id: 'face', children: [{ id: 'eyes', children: [{ id: 'left', children: [] }, { id: 'right', children: [] }] }] }] };
  assert.equal(deriveTaskReadiness(nested, []).artwork.summary, '4 layers', 'one root, one group and two leaves');
  assert.equal(deriveTaskReadiness({ svgMarkup: '<svg/>', layers: [{ id: 'only' }] }, []).artwork.summary, '1 layer');
  assert.equal(deriveTaskReadiness({ svgMarkup: '<svg/>' }, []).artwork.summary, '0 layers');
});

/**
 * UIR-14 — readiness is transversal, and the reading is per workspace.
 *
 * Two questions the app bar asks of the same model: what is the whole project
 * right now (the verdict), and where does the work that is left live (the
 * grouping). Both are derived, so neither can drift from the sections.
 */
test('readiness groups into the four workspaces, in navigation order, and Export belongs to none', () => {
  const grouped = groupReadiness(deriveTaskReadiness({ svgMarkup: '', layers: [] }, validateProject({ svgMarkup: '' })));
  assert.deepEqual(grouped.map((group) => group.id), ['design', 'rig', 'animate', 'behavior', null]);
  assert.deepEqual(grouped.map((group) => group.label), ['Design', 'Rig', 'Animate', 'Behavior', 'Export']);
  assert.deepEqual(grouped.map((group) => group.sections.map((section) => section.id)),
    [['artwork'], ['faceSetup', 'movements'], ['expressions', 'animate'], ['reactions'], ['export']]);
  // Every section of the model reaches exactly one group: a row with no
  // workspace would be a capability with no door, which is what UIR-00 is for.
  const readiness = deriveTaskReadiness({ svgMarkup: '', layers: [] }, validateProject({ svgMarkup: '' }));
  assert.deepEqual(grouped.flatMap((group) => group.sections.map((section) => section.id)), [...readiness.order]);
  // A group is as bad as its worst section, never an average of them.
  assert.equal(grouped.find((group) => group.id === 'design').status, 'error');
  assert.equal(grouped.find((group) => group.id === 'rig').status, 'todo');
});

test('the verdict counts what wants attention, and says Ready when nothing does', () => {
  assert.deepEqual(readinessVerdict(deriveTaskReadiness({ svgMarkup: '', layers: [] }, validateProject({ svgMarkup: '' }))),
    { status: 'error', count: 2, label: '● 2 issues' }, 'artwork and export are both blocking');
  // Neither `todo` nor `optional` is a problem: they are work not started, and
  // a bar that called them issues would never read Ready on a young project.
  const quiet = { order: ['artwork', 'faceSetup'], artwork: { status: 'ready' }, faceSetup: { status: 'todo' } };
  assert.deepEqual(readinessVerdict(quiet), { status: 'todo', count: 0, label: '✓ Ready' });
  const one = { order: ['artwork'], artwork: { status: 'warning' } };
  assert.deepEqual(readinessVerdict(one), { status: 'warning', count: 1, label: '⚠ 1 issue' }, 'singular, not "1 issues"');
});
