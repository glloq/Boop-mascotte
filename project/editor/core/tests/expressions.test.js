import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createExpressionCommands } from '../expressions/expression-commands.js';
import { captureExpression, createExpression, expressionIssues, significantControls, slugify } from '../expressions/expression-model.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { createExportRig } from '../export/export-rig.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';
import { validateProject } from '../validation/validate-project.js';
import { composeExpressionParams, createMascotEngine, normalizeExpressions } from '../../../runtime/runtime.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: { translateY: { enabled: true, mode: 'simple', expression: 'smile', curve: 'linear', amplitude: 8, offset: 0 } }, meta: { nodeType: 'path' } });
const project = () => ({
  svgMarkup: '<svg><path id="mouth" d="M0 0"/></svg>', elements: { mouth: element() }, layers: [{ id: 'mouth', name: 'Mouth', type: 'path', visible: true, children: [] }], layerMetadata: {},
  params: { smile: number(-1, 1), mouthOpen: number(0, 1), eyeOpen: number(0, 1, 1) }, states: { idle: { smile: 0, mouthOpen: 0, eyeOpen: 1 } }, activeState: 'idle', transitions: {}, semanticParts: {}, animationClips: [], behaviors: [], expressions: []
});

test('expression model creates slug ids, sanitizes controls and captures only significant values', () => {
  assert.equal(slugify('Très Heureux !'), 'tres-heureux');
  const document = project();
  const happy = createExpression(document, { name: 'Happy', controls: { smile: 5, unknown: 1, mouthOpen: '0.4' } });
  assert.deepEqual(happy, { id: 'happy', name: 'Happy', controls: { smile: 1, mouthOpen: .4 }, source: 'manual' });
  assert.equal(createExpression(document, { name: 'Happy' }).id, 'happy-2');
  assert.deepEqual(significantControls(document, { smile: 0, eyeOpen: 1, mouthOpen: .3 }), { mouthOpen: .3 }, 'neutral values are not stored');
  captureExpression(document, 'happy', { smile: .9, eyeOpen: 1, mouthOpen: 0 });
  assert.deepEqual(document.expressions[0].controls, { smile: .9 });
  assert.equal(document.expressions[0].source, 'capture');
  document.expressions[0].controls.gone = 1;
  assert.deepEqual(expressionIssues(document), [{ id: 'happy', name: 'Happy', unknown: ['gone'] }]);
  assert.ok(validateProject(document).some((issue) => issue.id === 'expression.happy.unknown-parameter' && issue.severity === 'warning' && issue.fix.workspace === 'expressions'));
});

test('expression commands are atomic, undoable and never touch states', () => {
  const store = createEditorStore(project()), history = createHistory(store), commands = createExpressionCommands(store, history);
  const statesBefore = structuredClone(store.getDocument().states), revisions = store.getDomainRevisions();
  const id = commands.create({ name: 'Happy' });
  assert.equal(id, 'happy');
  commands.setControl('happy', 'smile', 1);
  assert.deepEqual(store.getDocument().expressions[0].controls, { smile: 1 });
  assert.equal(store.getDomainRevisions().expressions, revisions.expressions + 2);
  assert.equal(store.getDomainRevisions().stateMachine, revisions.stateMachine, 'no state machine writes');
  assert.deepEqual(store.getDocument().states, statesBefore);
  assert.throws(() => commands.setControl('happy', 'nope', 1), /not available/);
  assert.throws(() => commands.rename('happy', '   '), /needs a name/);
  assert.deepEqual(store.getDocument().expressions[0].controls, { smile: 1 }, 'failed commands change nothing');
  commands.rename('happy', 'Very happy');
  assert.equal(commands.duplicate('happy'), 'very-happy-copy');
  assert.equal(store.getDocument().expressions.length, 2);
  commands.remove('very-happy-copy');
  commands.setControl('happy', 'smile', null);
  assert.deepEqual(store.getDocument().expressions[0].controls, {});
  history.undo();
  assert.deepEqual(store.getDocument().expressions[0].controls, { smile: 1 });
  while (history.getState().canUndo) history.undo();
  assert.deepEqual(store.getDocument().expressions, []);
});

test('expressions round-trip through snapshots, load as empty from older snapshots and export additively', () => {
  const state = { ...createCleanProjectState(), ...project() };
  state.expressions = [{ id: 'happy', name: 'Happy', controls: { smile: 1 }, source: 'manual' }];
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  assert.deepEqual(snapshot.document.editor.expressions, state.expressions);
  const restored = createCleanProjectState();
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.expressions, state.expressions);
  const legacy = structuredClone(snapshot); delete legacy.document.editor.expressions;
  const older = createCleanProjectState();
  applyProjectSnapshot(older, legacy);
  assert.deepEqual(older.expressions, []);
  const rig = createExportRig(state);
  assert.deepEqual(rig.expressions, [{ id: 'happy', name: 'Happy', controls: { smile: 1 }, source: 'manual' }]);
  assert.equal(rig.schemaVersion, 3);
  assert.deepEqual(normalizeExpressions({ expressions: [{ id: 'x', controls: { smile: '0.5', bad: 'no' } }, { nope: true }] }), [{ id: 'x', name: 'x', source: 'manual', controls: { smile: .5 } }]);
});

test('editor preview and exported runtime compose expressions identically at every intensity', () => {
  const state = project();
  state.expressions = [{ id: 'happy', name: 'Happy', controls: { smile: 1, mouthOpen: .4 }, source: 'manual' }, { id: 'wide', name: 'Wide', controls: { eyeOpen: 1, mouthOpen: 1 } }];
  const params = state.params, base = { smile: 0, mouthOpen: 0, eyeOpen: 1 };
  assert.deepEqual(composeExpressionParams(base, state.expressions, {}, params), base);
  assert.deepEqual(composeExpressionParams(base, state.expressions, { happy: .5 }, params), { smile: .5, mouthOpen: .2, eyeOpen: 1 });
  assert.deepEqual(composeExpressionParams(base, state.expressions, { happy: 1, wide: 1 }, params), { smile: 1, mouthOpen: 1, eyeOpen: 1 }, 'stacking is additive and clamped');
  const store = createEditorStore(state), frames = [];
  const preview = createPreviewController({ store, canvas: { applyFrame: (frame) => frames.push(frame) }, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });
  const revision = store.getPersistentRevision();
  preview.setExpression('happy', .5);
  assert.equal(preview.getEffectiveParams().smile, .5);
  assert.equal(preview.getEffectiveParams().mouthOpen, .2);
  assert.deepEqual(preview.getSession().expressionWeights, { happy: .5 });
  assert.equal(store.getPersistentRevision(), revision, 'preview expressions never author');
  const rig = createExportRig(state);
  const engine = createMascotEngine({ svgRoot: { id: '', querySelector: () => null }, rig, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });
  assert.equal(engine.setExpression('happy', .5), true);
  assert.equal(engine.setExpression('missing'), false);
  assert.deepEqual(engine.getParams(), preview.getEffectiveParams(), 'runtime parity with the editor preview');
  engine.setExpression('happy', 0);
  assert.deepEqual(engine.getExpressions(), {});
  preview.clearExpressions();
  assert.deepEqual(preview.getEffectiveParams(), base);
  preview.setExpression('happy', 1); preview.reset();
  assert.deepEqual(preview.getExpressionWeights(), {});
});
