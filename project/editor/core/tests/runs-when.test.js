import test from 'node:test';
import assert from 'node:assert/strict';
import { clickTarget } from './helpers/stub-dom.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createEditorContext } from '../../ui/editor-context.js';
import { createReactionStudio } from '../../ui/reaction-studio.js';
import { createReaction, reactionIssues, triggerLabel } from '../reactions/reaction-model.js';
import { RUNS_WHEN, deriveRunsWhen, motionsNotRunning, runsWhenOf, triggerForRunsWhen } from '../reactions/runs-when.js';
import { createExportRig } from '../export/export-rig.js';
import {
  HELD_REACTION_TRIGGERS, REACTION_TRIGGERS, RIG_SCHEMA_VERSION, RUNTIME_FEATURES, UNPROMPTED_REACTION_TRIGGERS,
  createMascotEngine, createReactionController, normalizeReactions, rigRequirements, unsupportedRequirements
} from '../../../runtime/runtime.js';

/**
 * V3-09 (the vocabulary) and V3-10 (the one surface that says what runs when).
 *
 * The two slices are one file because they are one question asked twice: the
 * runtime has to be able to *say* "with no interaction" and "following the
 * pointer" before a panel can offer them, and the panel has to offer every when
 * the runtime has or the vocabulary is decoration.
 */

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const params = () => ({ headY: number(-1, 1), mouthOpen: number(0, 1), eyeOpen: number(0, 1, 1), gazeX: number(-1, 1), gazeY: number(-1, 1) });
const reactions = (list) => normalizeReactions({ reactions: list });
const controllerOf = (list, clips = []) => createReactionController(() => ({ reactions: reactions(list), clips }));

// ---------------------------------------------------------------------------
// V3-09 — the vocabulary
// ---------------------------------------------------------------------------

test('the runtime can say "with no interaction" and "following the pointer"', () => {
  assert.deepEqual([...REACTION_TRIGGERS], ['click', 'hover', 'gaze-follow', 'idle', 'timer', 'custom']);
  // Each new one is sorted into the two behaviours that are not "fire once".
  assert.deepEqual([...HELD_REACTION_TRIGGERS], ['hover', 'gaze-follow']);
  assert.deepEqual([...UNPROMPTED_REACTION_TRIGGERS], ['idle', 'timer']);
  assert.equal(triggerLabel({ type: 'idle', after: 8 }), 'After 8 s alone');
  assert.equal(triggerLabel({ type: 'gaze-follow' }), 'While following you');
  // A hover holds now, so it is a *while*, not a *when*.
  assert.equal(triggerLabel({ type: 'hover' }), 'While hovered');
});

test('an unknown trigger declines instead of mis-firing as a click', () => {
  // The mis-fire VNX-39 wrote down: an older runtime turned anything it did not
  // know into a `click`, so a reaction meant for an idle page fired the moment
  // someone touched the mascot. Wrong is worse than nothing.
  const [unknown] = reactions([{ id: 'future', trigger: { type: 'telepathy' } }]);
  assert.deepEqual(unknown.trigger, { type: 'unsupported', of: 'telepathy' });
  const controller = controllerOf([{ id: 'future', trigger: { type: 'telepathy' } }]);
  assert.equal(controller.trigger('click', 0), null, 'it is not a click');
  assert.equal(controller.trigger('unsupported', 0), null);
  assert.equal(controller.fire('future', 0), false, 'and asking for it by name does not get past the refusal');
  // A trigger left out entirely is still a click, exactly as before.
  assert.deepEqual(reactions([{ id: 'plain' }])[0].trigger, { type: 'click' });
});

test('a rig names what it needs, and a runtime missing it declines by name', () => {
  assert.equal(RIG_SCHEMA_VERSION, 5, 'the one change in V3 that an older runtime cannot safely ignore');
  const rig = { reactions: [{ id: 'a', trigger: { type: 'idle', after: 5 } }, { id: 'b', trigger: { type: 'gaze-follow' } }, { id: 'c', trigger: { type: 'click' } }] };
  assert.deepEqual(rigRequirements(rig), ['trigger:gaze-follow', 'trigger:idle']);
  assert.deepEqual(rigRequirements({ reactions: [{ id: 'c', trigger: { type: 'click' } }] }), [], 'a rig that uses neither asks for nothing');
  // This build has both, so it runs everything it can write.
  assert.deepEqual(unsupportedRequirements(rig), []);
  assert.deepEqual(unsupportedRequirements({ requires: ['trigger:telepathy'] }), ['trigger:telepathy']);
  // An export written before the marker existed is judged on its contents
  // rather than waved through on a missing field.
  assert.deepEqual(unsupportedRequirements({ reactions: [{ id: 'a', trigger: { type: 'idle' } }] }), []);
  assert.ok(RUNTIME_FEATURES.includes('trigger:idle') && RUNTIME_FEATURES.includes('trigger:gaze-follow'));
});

test('the exported rig carries the marker, and only when it needs one', () => {
  const state = { params: params(), states: { idle: {} }, elements: {}, reactions: [], animationClips: [] };
  assert.deepEqual(createExportRig(state).requires, []);
  createReaction(state, { name: 'Wake up', trigger: { type: 'idle', after: 12 } });
  const exported = createExportRig(state);
  assert.deepEqual(exported.requires, ['trigger:idle']);
  assert.equal(exported.schemaVersion, 5);
  assert.deepEqual(exported.reactions[0].trigger, { type: 'idle', after: 12 });
});

test('an idle reaction waits for nothing to happen, where a timer only watches a clock', () => {
  const idle = controllerOf([{ id: 'yawn', trigger: { type: 'idle', after: 5 }, expression: { id: 'sleepy' } }]);
  assert.equal(idle.evaluate(4.9).active, null, 'not yet: the page has only been quiet for 4.9 s');
  assert.equal(idle.evaluate(5).active.id, 'yawn');
  idle.cancel();

  // Anything at all resets the clock, and the wait starts over in full.
  const touched = controllerOf([{ id: 'yawn', trigger: { type: 'idle', after: 5 }, expression: { id: 'sleepy' } }]);
  touched.evaluate(4);
  touched.notifyActivity(4);
  assert.equal(touched.evaluate(5).active, null, 'one second after a click is not five seconds of quiet');
  assert.equal(touched.evaluate(8.9).active, null);
  assert.equal(touched.evaluate(9).active.id, 'yawn', 'five seconds after the last thing that happened');
  assert.equal(touched.getIdleSince(), 4);

  // Left alone it keeps going: the mascot does not act once and freeze.
  touched.cancel();
  assert.equal(touched.evaluate(14).active.id, 'yawn');

  // A timer is the other thing, and it still is: it counts from when it was
  // first seen and an interaction means nothing to it.
  const timer = controllerOf([{ id: 'tick', trigger: { type: 'timer', interval: 5 }, expression: { id: 'sleepy' } }]);
  timer.evaluate(0);
  timer.notifyActivity(4);
  assert.equal(timer.evaluate(5).active.id, 'tick', 'a clock does not care that you were there');
});

test('a hover holds while the pointer is there, and releases when it leaves', () => {
  const controller = controllerOf([{ id: 'notice', trigger: { type: 'hover' }, expression: { id: 'happy' }, timing: { attack: .2, hold: .5, release: .4 } }]);
  assert.equal(controller.trigger('hover', 0), 'notice');
  assert.equal(controller.evaluate(.1).active.phase, 'attack');
  assert.equal(controller.evaluate(1).active.phase, 'hold');
  // Well past attack + hold, and still held: before V3-09 this reaction had
  // ended at 0.7 s whether or not the pointer had gone anywhere.
  assert.equal(controller.evaluate(20).active.phase, 'hold');
  assert.equal(controller.evaluate(20).expressions.happy, 1);
  // The pointer arriving again while it is already there is not a new event:
  // re-firing would restart the attack, which is what every single pointer move
  // would do to a `gaze-follow` reaction.
  assert.equal(controller.trigger('hover', 20), null);
  assert.equal(controller.evaluate(20).active.phase, 'hold');

  assert.equal(controller.release('hover', 20), 'notice');
  assert.equal(controller.evaluate(20.2).active.phase, 'release');
  assert.ok(controller.evaluate(20.2).expressions.happy < 1);
  assert.equal(controller.evaluate(20.5).active, null, 'and it is over one release time after the pointer left');
  // Releasing a trigger nothing is holding is a no-op, not a way to cut short
  // whatever happens to be playing.
  assert.equal(controller.release('hover', 21), null);
});

test('bindEvents listens for the way a hover ends, and drives the gaze from the pointer', () => {
  const rig = {
    schemaVersion: RIG_SCHEMA_VERSION, params: params(), states: { idle: { headY: 0, mouthOpen: 0, eyeOpen: 1, gazeX: 0, gazeY: 0 } },
    activeState: 'idle', transitions: {}, elements: {},
    reactions: [{ id: 'follow', name: 'Follow', trigger: { type: 'gaze-follow' } }, { id: 'notice', name: 'Notice', trigger: { type: 'hover' } }]
  };
  const page = { listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener(name) { delete this.listeners[name]; } };
  const listeners = {};
  const root = {
    id: 'mascot', ownerDocument: page, querySelector: () => null,
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 100, height: 100 }),
    addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: (name) => { delete listeners[name]; }
  };
  let time = 0;
  const engine = createMascotEngine({ svgRoot: root, rig, requestFrame: () => 1, cancelFrame: () => {}, now: () => time });
  engine.start();
  const unbind = engine.bindEvents();
  // `pointerleave` is what a hover has been missing since UX-13; `pointermove`
  // goes on the document because the pointer is hardly ever over the mascot
  // when you want the eyes to find it.
  assert.deepEqual(Object.keys(listeners).sort(), ['click', 'pointerenter', 'pointerleave']);
  assert.deepEqual(Object.keys(page.listeners).sort(), ['pointerleave', 'pointermove']);

  // The centre of the mascot is straight ahead; two mascot-widths away saturates.
  page.listeners.pointermove({ clientX: 150, clientY: 150 });
  assert.equal(engine.getParams().gazeX, 0);
  page.listeners.pointermove({ clientX: 250, clientY: 150 });
  assert.equal(engine.getParams().gazeX, 1);
  time = 3000;
  page.listeners.pointermove({ clientX: 200, clientY: 100 });
  assert.deepEqual([engine.getParams().gazeX, engine.getParams().gazeY], [.5, -.5]);
  // Three moves, one reaction, still holding: a hold that restarted on every
  // pointer move would never get out of its attack.
  assert.deepEqual([engine.getActiveReaction().id, engine.getActiveReaction().phase], ['follow', 'hold']);

  // Off the page: the gaze goes back to what the rig says it is.
  page.listeners.pointerleave();
  assert.equal(engine.getParams().gazeX, 0);
  unbind();
  assert.deepEqual(Object.keys(page.listeners), []);
});

test('nothing follows the pointer unless something asked to', () => {
  // A mascot that suddenly starts staring at the cursor is a behaviour change
  // for every rig ever exported, so the move listener is bound only when a
  // gaze-follow reaction is enabled.
  const rig = {
    schemaVersion: RIG_SCHEMA_VERSION, params: params(), states: { idle: { headY: 0, mouthOpen: 0, eyeOpen: 1, gazeX: 0, gazeY: 0 } },
    activeState: 'idle', transitions: {}, elements: {}, reactions: [{ id: 'follow', trigger: { type: 'gaze-follow' }, enabled: false }]
  };
  const page = { listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener(name) { delete this.listeners[name]; } };
  const root = { id: 'mascot', ownerDocument: page, querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {} };
  const engine = createMascotEngine({ svgRoot: root, rig, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0 });
  engine.bindEvents();
  assert.deepEqual(Object.keys(page.listeners), []);
  // The seam is still there for a page that drives the pointer itself.
  assert.equal(engine.followPointer(10, 10, { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }), true);
  assert.equal(engine.getParams().gazeX, -.4);
  engine.clearPointer();
  assert.equal(engine.getParams().gazeX, 0);
});

// ---------------------------------------------------------------------------
// V3-10 — one surface that says what runs when
// ---------------------------------------------------------------------------

test('every trigger belongs to a when, and moving between them keeps what carries over', () => {
  assert.deepEqual(RUNS_WHEN.map((entry) => entry.id), ['click', 'hover', 'gaze', 'idle', 'page']);
  // Every trigger the runtime can run is filed somewhere: a when with no
  // trigger, or a trigger with no when, is a thing an author cannot choose.
  for (const type of REACTION_TRIGGERS) assert.ok(runsWhenOf({ type }), type);
  assert.deepEqual([...new Set(RUNS_WHEN.flatMap((entry) => entry.triggers))].sort(), [...REACTION_TRIGGERS].sort());
  assert.equal(runsWhenOf({ type: 'unsupported', of: 'telepathy' }), null, 'and one nothing can run belongs nowhere');

  assert.deepEqual(triggerForRunsWhen('idle', { type: 'click' }), { type: 'idle', after: 8 });
  assert.deepEqual(triggerForRunsWhen('idle', { type: 'timer', interval: 30 }), { type: 'timer', interval: 30 }, 'a metronome stays a metronome');
  assert.deepEqual(triggerForRunsWhen('page', { type: 'custom', name: 'success' }), { type: 'custom', name: 'success' });
  // An event name survives a trip through another when and back.
  const away = triggerForRunsWhen('hover', { type: 'custom', name: 'success' });
  assert.deepEqual(triggerForRunsWhen('page', away), { type: 'custom', name: 'custom' });
  assert.throws(() => triggerForRunsWhen('whenever'), /Unknown "runs when" group/);
});

test('what runs when reads reactions, automatic behaviours and the motions nothing runs', () => {
  const document = {
    params: { eyeOpen: number(0, 1, 1), lookX: number(-1, 1), headY: number(-1, 1) },
    behaviors: [{ id: 'auto-blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen' }],
    animationClips: [{ id: 'wave', name: 'Wave' }, { id: 'nod', name: 'Nod' }],
    reactions: [
      { id: 'hello', name: 'Hello', trigger: { type: 'click' }, motion: { clipId: 'wave' }, enabled: true },
      { id: 'yawn', name: 'Yawn', trigger: { type: 'idle', after: 20 }, enabled: false },
      { id: 'future', name: 'From the future', trigger: { type: 'unsupported', of: 'shake' }, enabled: true }
    ]
  };
  const derived = deriveRunsWhen(document);
  assert.deepEqual(derived.groups.map((group) => [group.id, group.count]), [['click', 1], ['hover', 0], ['gaze', 0], ['idle', 2], ['page', 0]]);
  // The "by itself" bucket holds both kinds, and each one says which it is.
  assert.deepEqual(derived.groups[3].reactions.map((item) => [item.kind, item.id, item.enabled]), [['reaction', 'yawn', false]]);
  assert.deepEqual(derived.groups[3].automatic.map((item) => [item.kind, item.id, item.enabled]), [['automatic', 'blink', true]]);
  assert.equal(derived.running, 2, 'the click reaction and the blink; the yawn is switched off');
  // A trigger nothing can run is reported, never filed under a when it has not got.
  assert.deepEqual(derived.unsupported, [{ kind: 'reaction', id: 'future', name: 'From the future', needs: 'shake' }]);
  // A clip no reaction plays never reaches the exported mascot.
  assert.deepEqual(derived.motions, [{ id: 'nod', name: 'Nod' }]);
  assert.deepEqual(motionsNotRunning({ animationClips: [{ id: 'wave', name: 'Wave' }], reactions: [] }), [{ id: 'wave', name: 'Wave' }]);
});

test('a gaze reaction with nothing attached is not an empty reaction', () => {
  // Following *is* the doing: the runtime drives the gaze target for as long as
  // the reaction holds, so it moves the mascot with no expression and no motion.
  const document = { reactions: [], expressions: [], animationClips: [] };
  createReaction(document, { name: 'Follow', trigger: { type: 'gaze-follow' } });
  assert.deepEqual(reactionIssues(document), []);
  createReaction(document, { name: 'Nothing', trigger: { type: 'click' } });
  assert.deepEqual(reactionIssues(document).map((item) => [item.id, item.empty]), [['nothing', true]]);
});

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

/** The same host the other panel tests use: what the panel touches, no more. */
function fakeHost() {
  const listeners = new Map();
  const host = {
    innerHTML: '', hidden: false, dataset: {}, fields: {},
    contains: () => true,
    querySelector: (selector) => host.fields[selector] || null,
    querySelectorAll: () => [],
    addEventListener(type, handler, options) { const key = `${type}:${options === true ? 'capture' : 'bubble'}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(handler); },
    removeEventListener(type, handler, options) { listeners.get(`${type}:${options === true ? 'capture' : 'bubble'}`)?.delete(handler); },
    dispatch(type, event = {}) { for (const key of [`${type}:capture`, `${type}:bubble`]) for (const handler of [...(listeners.get(key) || [])]) handler({ type, target: host, preventDefault() {}, ...event }); }
  };
  return host;
}

function studio() {
  const listHost = fakeHost(), inspectorHost = fakeHost();
  const store = createEditorStore({
    svgMarkup: '<svg><path id="head" d="M0 0"/></svg>', elements: {}, layers: [], layerMetadata: {},
    params: { eyeOpen: number(0, 1, 1), headY: number(-1, 1) }, states: { idle: { eyeOpen: 1, headY: 0 } },
    activeState: 'idle', transitions: {}, semanticParts: {}, behaviors: [],
    expressions: [{ id: 'happy', name: 'Happy', controls: { headY: 1 }, source: 'manual' }],
    animationClips: [{ id: 'wave', name: 'Wave', duration: 1, loop: false, tracks: {} }], reactions: []
  });
  const history = createHistory(store);
  const editorContext = createEditorContext('reactions', store);
  const routes = [];
  const it = {
    listHost, inspectorHost, store, history, routes,
    studio: createReactionStudio({ listHost, inspectorHost, store, history, preview: { fireReaction: () => true, getActiveReaction: () => null, getStayedExpressions: () => ({}), clearReactions: () => {} }, editorContext, navigate: (route) => routes.push(route) }),
    render: () => it.studio.render(),
    click: (dataset) => { listHost.dispatch('click', { target: clickTarget({ dataset }) }); it.render(); },
    change: (dataset, value) => { listHost.dispatch('change', { target: clickTarget({ tag: 'select', dataset, value }) }); it.render(); },
    row: () => listHost.innerHTML,
    reactions: () => store.getDocument().reactions
  };
  it.render();
  return it;
}

test('the list is bucketed by when, and a reaction moves between buckets in place', () => {
  const it = studio();
  // Every when is drawn, including the empty ones: a bucket left out is a when
  // the author never learns they could use.
  assert.deepEqual([...it.row().matchAll(/data-runs-when-group="([\w-]+)"/g)].map((match) => match[1]), ['click', 'hover', 'gaze', 'idle', 'page']);

  it.click({ reactionPresetAdd: 'greet' });
  const id = it.reactions()[0].id;
  assert.equal(it.reactions()[0].trigger.type, 'click');
  assert.match(it.row(), new RegExp(`data-runs-when-group="click" data-runs-when-count="1"`));
  assert.match(it.row(), new RegExp(`data-reaction-when="${id}"`));

  // The move is one command on the reactions domain and one history step: the
  // catalogue could bucket a *new* reaction by when and never an existing one.
  const mutations = it.store.getDomainRevisions().reactions;
  it.change({ reactionWhen: id }, 'idle');
  assert.deepEqual(it.reactions()[0].trigger, { type: 'idle', after: 8 });
  assert.equal(it.store.getDomainRevisions().reactions, mutations + 1);
  assert.match(it.row(), /data-runs-when-group="idle" data-runs-when-count="1"/);
  assert.match(it.row(), /data-runs-when-group="click" data-runs-when-count="0"/);
  it.history.undo();
  it.render();
  assert.equal(it.reactions()[0].trigger.type, 'click', 'one step back, not two');

  // And through every when, without the reaction losing what carries over.
  for (const when of RUNS_WHEN.map((entry) => entry.id)) {
    it.change({ reactionWhen: id }, when);
    assert.equal(runsWhenOf(it.reactions()[0].trigger), when, when);
  }
});

test('a motion can be selected to run, in a when, without being wrapped by hand', () => {
  const it = studio();
  // Before: a clip authored in Animate had nowhere to go. An arrangement is
  // editor-only and never exported, so nothing in the published mascot played it.
  assert.match(it.row(), /data-runs-when-motions="1"/);
  assert.match(it.row(), /data-motion-card="wave"/);

  it.click({ motionRun: 'wave' });
  const [reaction] = it.reactions();
  assert.equal(reaction.name, 'Wave');
  assert.deepEqual(reaction.motion, { clipId: 'wave' });
  // "By itself" is the default, and it is an idle wait rather than a clock.
  assert.deepEqual(reaction.trigger, { type: 'idle', after: 8 });
  // Once something runs it, it leaves the list of motions that never run.
  assert.equal(/data-runs-when-motions/.test(it.row()), false);
  assert.match(it.row(), /data-runs-when-group="idle" data-runs-when-count="1"/);
});

test('the "by itself" bucket names the automatic behaviours that share it', () => {
  const it = studio();
  assert.equal(/data-runs-when-automatic/.test(it.row()), false, 'nothing automatic yet');
  it.store.execute({
    type: 'automatic/enable', domains: ['stateMachine'], source: 'test',
    apply: (document) => { document.behaviors.push({ id: 'auto-blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', intervalMin: 2, intervalMax: 6, duration: .12, closedValue: 0 }); }
  });
  it.render();
  assert.match(it.row(), /data-runs-when-automatic="1">Also here: Blink/);
  // It is listed where it runs and moved nowhere: it is a `stateMachine`
  // behaviour, and the switch that turns it off is its own card below.
  assert.equal(/data-reaction-when="blink"/.test(it.row()), false);
  it.listHost.dispatch('click', { target: clickTarget({ dataset: { reactionGo: 'reactions', reactionFocus: 'automatic-panel' } }) });
  assert.deepEqual(it.routes, [{ task: 'reactions', focus: 'automatic-panel' }]);
});
