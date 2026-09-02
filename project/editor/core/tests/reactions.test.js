import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createReactionCommands } from '../reactions/reaction-commands.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { createExportRig } from '../export/export-rig.js';
import { validateProject } from '../validation/validate-project.js';
import { deriveTaskReadiness } from '../validation/task-readiness.js';
import { createReaction, reactionIssues, timingPresetOf, triggerLabel } from '../reactions/reaction-model.js';
import { evaluateAnimationClip as editorEvaluate } from '../../animation-editor/timeline/clip-evaluator.js';
import { REACTION_TIMINGS, createMascotEngine, createReactionController, evaluateAnimationClip, normalizeAnimations, normalizeReactions } from '../../../runtime/runtime.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const params = () => ({ headY: number(-1, 1), mouthOpen: number(0, 1), eyeOpen: number(0, 1, 1), smile: number(-1, 1) });
const headPop = { id: 'head-pop', name: 'Head Pop', duration: .6, loop: false, tracks: { headY: [{ time: 0, value: 0, easing: 'linear' }, { time: .12, value: -.7, easing: 'easeOut' }, { time: .3, value: 0, easing: 'easeIn' }, { time: .6, value: 0, easing: 'linear' }] } };
const surprised = { id: 'surprised', name: 'Surprised', controls: { mouthOpen: 1, eyeOpen: 1 }, source: 'preset' };
const project = () => ({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>', elements: { head: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: { translateY: { enabled: true, mode: 'simple', expression: 'headY', curve: 'linear', amplitude: 8, offset: 0 } }, meta: { nodeType: 'path' } } },
  layers: [{ id: 'head', name: 'Head', type: 'path', visible: true, children: [] }], layerMetadata: {}, params: params(),
  states: { idle: { headY: 0, mouthOpen: 0, eyeOpen: 1, smile: 0 } }, activeState: 'idle', transitions: {}, semanticParts: {}, animationClips: [structuredClone(headPop)], behaviors: [], expressions: [structuredClone(surprised)], reactions: []
});
const reaction = (extra = {}) => ({ id: 'surprise', name: 'Surprise', trigger: { type: 'click' }, expression: { id: 'surprised', weight: 1 }, motion: { clipId: 'head-pop' }, timing: 'fast', ...extra });

test('runtime normalizes reactions and animations tolerantly and shares the clip evaluator with the editor', () => {
  assert.equal(editorEvaluate, evaluateAnimationClip);
  assert.deepEqual(normalizeReactions({ reactions: [reaction(), { id: 'later', trigger: 'timer', timing: { attack: -1, hold: 'x', release: .1 }, after: 'stay', priority: 2.4, interrupt: 'ignore' }, null, 'junk'] }), [
    { id: 'surprise', name: 'Surprise', enabled: true, trigger: { type: 'click' }, expression: { id: 'surprised', weight: 1 }, motion: { clipId: 'head-pop' }, timing: { attack: .1, hold: .6, release: .3 }, after: 'return', priority: 0, interrupt: 'replace' },
    { id: 'later', name: 'later', enabled: true, trigger: { type: 'timer', interval: 5 }, expression: null, motion: null, timing: { attack: 0, hold: 1.2, release: .1 }, after: 'stay', priority: 2, interrupt: 'ignore' }
  ]);
  assert.deepEqual(normalizeReactions({ reactions: [{ id: 'x', trigger: { type: 'custom', name: 'wave' } }] })[0].trigger, { type: 'custom', name: 'wave' });
  assert.deepEqual(normalizeReactions({}), []);
  const clips = normalizeAnimations({ animations: [headPop, { id: 'bad', duration: 0, tracks: {} }, { id: 'loose', duration: 1, loop: 1, tracks: { headY: [{ time: 5, value: 1, easing: 'nope' }, { time: 'x', value: 1 }], skip: 'no' } }] });
  assert.deepEqual(clips.map((clip) => clip.id), ['head-pop', 'loose']);
  assert.deepEqual(clips[1], { id: 'loose', name: 'loose', duration: 1, loop: true, tracks: { headY: [{ time: 1, value: 1, easing: 'linear' }] } });
  assert.equal(timingPresetOf(REACTION_TIMINGS.slow), 'slow');
  assert.equal(timingPresetOf({ attack: .1, hold: .6, release: .31 }), 'custom');
  assert.equal(triggerLabel({ type: 'custom', name: 'wave' }), 'On "wave"');
});

test('reaction controller sequences attack, hold (covering the motion), release and return deterministically', () => {
  const controller = createReactionController({ reactions: normalizeReactions({ reactions: [reaction()] }), clips: [headPop] });
  assert.deepEqual(controller.evaluate(0), { expressions: {}, params: {}, active: null });
  assert.equal(controller.trigger({ type: 'hover' }, 0), null);
  assert.equal(controller.trigger({ type: 'click' }, 1), 'surprise');
  const attack = controller.evaluate(1.05, { headY: 0 });
  assert.equal(attack.active.phase, 'attack');
  assert.ok(attack.expressions.surprised > .5 && attack.expressions.surprised < 1, 'attack eases in');
  assert.ok(Math.abs(attack.params.headY - evaluateAnimationClip(headPop, .05).headY) < 1e-9, 'the motion plays from the fire time');
  const hold = controller.evaluate(1.3);
  assert.deepEqual([hold.active.phase, hold.expressions.surprised], ['hold', 1]);
  assert.equal(controller.evaluate(1.65).active.phase, 'hold', 'hold lasts at least attack + hold (0.7 s)');
  const release = controller.evaluate(1.85);
  assert.equal(release.active.phase, 'release');
  assert.ok(release.expressions.surprised > 0 && release.expressions.surprised < 1);
  assert.deepEqual(release.params, {}, 'the motion is over after its duration');
  assert.deepEqual(controller.evaluate(2.1), { expressions: {}, params: {}, active: null }, 'return leaves nothing behind');
  assert.equal(controller.getActive(), null);

  const stay = createReactionController({ reactions: normalizeReactions({ reactions: [reaction({ after: 'stay', motion: null })] }), clips: [] });
  stay.fire('surprise', 0);
  assert.equal(stay.evaluate(.5).active.phase, 'hold');
  assert.deepEqual(stay.evaluate(2), { expressions: { surprised: 1 }, params: {}, active: null }, 'stay keeps the expression applied');
  assert.deepEqual(stay.getStayed(), { surprised: 1 });
  stay.clearStayed('surprised');
  assert.deepEqual(stay.evaluate(3).expressions, {});

  const same = createReactionController({ reactions: normalizeReactions({ reactions: [reaction()] }), clips: [headPop] });
  same.fire('surprise', 0); same.evaluate(.5);
  assert.equal(same.fire('surprise', .5), true, 'equal priority replaces (restarts) the active reaction');
  assert.equal(same.evaluate(.55).active.phase, 'attack');
  assert.equal(same.fire('missing', 1), false);
});

test('priority, interrupt policy, timers and custom events', () => {
  const list = normalizeReactions({ reactions: [reaction({ id: 'low', priority: 0 }), reaction({ id: 'high', priority: 5, trigger: { type: 'custom', name: 'boo' } }), reaction({ id: 'shy', interrupt: 'ignore', trigger: { type: 'hover' } }), reaction({ id: 'tick', trigger: { type: 'timer', interval: 2 }, priority: -1 })] });
  const controller = createReactionController(() => ({ reactions: list, clips: [headPop] }));
  assert.equal(controller.trigger('click', 0), 'low');
  controller.evaluate(.1);
  assert.equal(controller.trigger({ type: 'hover' }, .2), null, 'ignore never interrupts');
  assert.equal(controller.trigger({ type: 'custom', name: 'nope' }, .2), null);
  assert.equal(controller.trigger({ type: 'custom', name: 'boo' }, .2), 'high', 'higher priority replaces');
  controller.evaluate(.3);
  assert.equal(controller.trigger('click', .3), null, 'lower priority cannot replace a higher active reaction');
  assert.equal(controller.evaluate(.3).active.id, 'high');
  assert.equal(controller.evaluate(2).active, null);
  assert.equal(controller.evaluate(2.15).active.id, 'tick', 'timer fires 2 s after it was first seen (0.1 s)');
  assert.equal(controller.evaluate(2.15).active.phase, 'attack');
  assert.equal(controller.trigger('hover', 2.2), null, 'ignore also waits while a timer reaction is active');
  controller.reset();
  assert.deepEqual(controller.evaluate(2.2), { expressions: {}, params: {}, active: null });
});

test('the exported engine fires reactions from events and plays animations on demand', () => {
  let time = 0;
  const rig = { schemaVersion: 3, params: params(), states: { idle: { headY: 0, mouthOpen: 0, eyeOpen: 1, smile: 0 } }, activeState: 'idle', transitions: {}, elements: {}, expressions: [surprised], animations: [headPop], reactions: [reaction()] };
  const listeners = {};
  const root = { id: 'mascot', querySelector: () => null, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: (name) => { delete listeners[name]; } };
  const engine = createMascotEngine({ svgRoot: root, rig, requestFrame: () => 1, cancelFrame: () => {}, now: () => time });
  assert.deepEqual(engine.getReactions(), [{ id: 'surprise', name: 'Surprise', trigger: { type: 'click' }, enabled: true }]);
  assert.deepEqual(engine.getAnimations(), [{ id: 'head-pop', name: 'Head Pop', duration: .6, loop: false }]);
  engine.start();
  const unbind = engine.bindEvents();
  assert.deepEqual(Object.keys(listeners).sort(), ['click', 'pointerenter']);
  time = 1000; listeners.click();
  assert.equal(engine.getActiveReaction().id, 'surprise');
  time = 1300;
  const held = engine.getParams();
  assert.equal(held.mouthOpen, 1, 'the expression is applied at full weight during hold');
  assert.ok(Math.abs(held.headY - evaluateAnimationClip(headPop, .3).headY) < 1e-9, 'the motion drives the head');
  time = 2200;
  assert.deepEqual(engine.getParams(), { headY: 0, mouthOpen: 0, eyeOpen: 1, smile: 0 }, 'return restores the pose');
  assert.equal(engine.getActiveReaction(), null);
  assert.equal(engine.trigger('custom', { name: 'anything' }), null);
  assert.equal(engine.fire('surprise'), true);
  engine.clearReactions();
  assert.equal(engine.getActiveReaction(), null);
  assert.equal(engine.playAnimation('nope'), false);
  assert.equal(engine.playAnimation('head-pop'), true);
  time = 2320;
  assert.ok(Math.abs(engine.getParams().headY - evaluateAnimationClip(headPop, .12).headY) < 1e-9);
  assert.equal(engine.getAnimation(), 'head-pop');
  time = 3000;
  engine.getParams();
  assert.equal(engine.getAnimation(), null, 'a finished animation stops by itself');
  unbind();
  assert.deepEqual(Object.keys(listeners), []);
  engine.stop();
});

test('reaction commands validate targets, stay atomic and undo', () => {
  const store = createEditorStore(project()), history = createHistory(store), commands = createReactionCommands(store, history);
  const revisions = store.getDomainRevisions();
  assert.equal(commands.create({ name: 'Surprise', expressionId: 'surprised', clipId: 'head-pop', timing: 'fast' }), 'surprise');
  assert.deepEqual(store.getDocument().reactions[0], { id: 'surprise', name: 'Surprise', enabled: true, trigger: { type: 'click' }, expression: { id: 'surprised', weight: 1 }, motion: { clipId: 'head-pop' }, timing: { attack: .1, hold: .6, release: .3 }, after: 'return', priority: 0, interrupt: 'replace' });
  assert.equal(store.getDomainRevisions().reactions, revisions.reactions + 1);
  assert.equal(store.getDomainRevisions().expressions, revisions.expressions, 'reactions never write expressions');
  assert.equal(store.getDomainRevisions().animation, revisions.animation, 'reactions never write clips');
  assert.throws(() => commands.create({ name: 'Broken', expressionId: 'nope' }), /does not exist. Create it in Expressions/);
  assert.throws(() => commands.create({ name: 'Broken', clipId: 'nope' }), /Add it in Animate/);
  assert.throws(() => commands.create({ name: '  ' }), /Give the reaction a name/);
  assert.throws(() => commands.update('surprise', { trigger: { type: 'shake' } }), /Unknown trigger/);
  assert.throws(() => commands.update('surprise', { timing: 'glacial' }), /Unknown timing/);
  assert.equal(store.getDocument().reactions.length, 1, 'failed commands change nothing');
  commands.update('surprise', { trigger: { type: 'custom', name: 'Boo!' }, weight: .5, timing: { attack: 0, hold: 1, release: 2 }, after: 'stay', priority: 3 });
  let current = store.getDocument().reactions[0];
  assert.deepEqual(current.trigger, { type: 'custom', name: 'Boo!' });
  assert.deepEqual(current.expression, { id: 'surprised', weight: .5 });
  assert.deepEqual([current.timing, current.after, current.priority], [{ attack: 0, hold: 1, release: 2 }, 'stay', 3]);
  commands.update('surprise', { clipId: null, expressionId: null });
  current = store.getDocument().reactions[0];
  assert.deepEqual([current.expression, current.motion], [null, null]);
  assert.deepEqual(reactionIssues(store.getDocument()), [{ id: 'surprise', name: 'Surprise', missingExpression: null, missingClip: null, empty: true }]);
  commands.update('surprise', { expressionId: 'surprised' });
  assert.deepEqual(store.getDocument().reactions[0].expression, { id: 'surprised', weight: 1 });
  commands.rename('surprise', 'Boo');
  assert.equal(commands.duplicate('surprise'), 'surprise-copy');
  assert.equal(store.getDocument().reactions[1].name, 'Boo Copy');
  assert.equal(commands.create({ name: 'Surprise' }), 'surprise-2');
  commands.remove('surprise-copy');
  assert.deepEqual(store.getDocument().reactions.map((item) => item.id), ['surprise', 'surprise-2']);
  const withMissing = project(); createReaction(withMissing, { name: 'Gone', expressionId: 'surprised', clipId: 'head-pop' }); withMissing.expressions = []; withMissing.animationClips = [];
  assert.deepEqual(reactionIssues(withMissing), [{ id: 'gone', name: 'Gone', missingExpression: 'surprised', missingClip: 'head-pop', empty: false }]);
  while (history.getState().canUndo) history.undo();
  assert.deepEqual(store.getDocument().reactions, []);
});

test('reactions round-trip through snapshots, export additively with animations, and validate as warnings', () => {
  const state = { ...createCleanProjectState(), ...project() };
  createReaction(state, { name: 'Surprise', expressionId: 'surprised', clipId: 'head-pop', timing: 'fast' });
  state.animationClips[0].motion = { preset: 'head-pop', amplitude: .7, repeats: 1, controls: { headY: 'headY' } };
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  assert.deepEqual(snapshot.document.editor.reactions, state.reactions);
  const restored = createCleanProjectState();
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.reactions, state.reactions);
  const legacy = structuredClone(snapshot); delete legacy.document.editor.reactions;
  const older = createCleanProjectState(); applyProjectSnapshot(older, legacy);
  assert.deepEqual(older.reactions, []);

  const rig = createExportRig(state);
  assert.deepEqual(rig.reactions, state.reactions);
  assert.deepEqual(rig.animations, [{ id: 'head-pop', name: 'Head Pop', duration: .6, loop: false, tracks: headPop.tracks }], 'clips export without editor metadata');
  assert.equal(rig.schemaVersion, 3);
  const engine = createMascotEngine({ svgRoot: { id: '', querySelector: () => null }, rig, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });
  assert.equal(engine.getReactions()[0].id, 'surprise');
  assert.equal(engine.getAnimations()[0].id, 'head-pop');

  assert.deepEqual(validateProject(state).filter((item) => item.domain === 'reactions'), []);
  assert.equal(deriveTaskReadiness(state, validateProject(state)).reactions.status, 'ready');
  state.expressions = [];
  const issues = validateProject(state).filter((item) => item.domain === 'reactions');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'warning');
  assert.equal(issues[0].id, 'reaction.surprise.missing-expression');
  assert.deepEqual(issues[0].fix, { workspace: 'reactions', activeReactionId: 'surprise' });
  const readiness = deriveTaskReadiness(state, validateProject(state));
  assert.equal(readiness.reactions.status, 'warning');
  assert.deepEqual(readiness.reactions.route, { task: 'reactions', target: { kind: 'reaction', id: 'surprise' } });
  assert.equal(readiness.order.indexOf('reactions'), readiness.order.indexOf('animate') + 1);
  assert.equal(deriveTaskReadiness({ ...state, reactions: [] }, []).reactions.status, 'optional');
});
