import test from 'node:test';
import assert from 'node:assert/strict';
import { clickTarget } from './helpers/stub-dom.js';
import { createReactionStudio } from '../../ui/reaction-studio.js';
import { createAutomaticPanel } from '../../ui/automatic-panel.js';
import { createEditorContext } from '../../ui/editor-context.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';

/**
 * One vocabulary for the Behaviors stage (VNX-09).
 *
 * A reaction already *was* a trigger, an expression, a motion, gestures, timing
 * and an after-state; what it was not was readable. These tests pin the reading
 * rather than the layout: the same sentence in the list row and above the
 * fields, three clauses named When / Do / Then, and — the case that decides
 * whether it is a sentence or a form — a reaction that is missing pieces, which
 * must still say something rather than offer empty slots.
 *
 * IF is deliberately absent. The runtime has no conditions (`createReactionController`
 * filters candidates by trigger type and priority, nothing else), so a
 * condition here would be UI for something that cannot run. That is VNX-39.
 *
 * These run in Node with no DOM, like `studio-lifecycle.test.js`: a host is an
 * object with the handful of properties the panels touch.
 */
function fakeHost() {
  const listeners = new Map();
  const host = {
    innerHTML: '', hidden: false, dataset: {},
    contains: () => true,
    fields: {},
    querySelector: (selector) => host.fields[selector] || null,
    querySelectorAll: () => [],
    addEventListener(type, handler, options) { const key = `${type}:${options === true ? 'capture' : 'bubble'}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(handler); },
    removeEventListener(type, handler, options) { listeners.get(`${type}:${options === true ? 'capture' : 'bubble'}`)?.delete(handler); },
    dispatch(type, event = {}) { for (const key of [`${type}:capture`, `${type}:bubble`]) for (const handler of [...(listeners.get(key) || [])]) handler({ type, target: host, preventDefault() {}, ...event }); }
  };
  return host;
}

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id) => ({ id, name: id, type: 'path', visible: true, children: [] });
const ARTWORK = ['head', 'eyeL', 'eyeR', 'mouth'];

const blankProject = () => ({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>',
  elements: Object.fromEntries(ARTWORK.map((id) => [id, element()])), layers: ARTWORK.map(layer), layerMetadata: {},
  semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', transitions: {},
  animationClips: [], behaviors: [], expressions: [], reactions: []
});

/** A face that moves, so the preset catalogues offer something and the Inspector has sliders. */
function riggedStore() {
  const store = createEditorStore(blankProject()), history = createHistory(store);
  const rig = createSemanticRigCommands(store, history);
  rig.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'eyes', role: 'leftEye', elementId: 'eyeL' }, { type: 'eyes', role: 'rightEye', elementId: 'eyeR' }, { type: 'mouth', role: 'mouth', elementId: 'mouth' }]);
  rig.enableControl('eyes', 'eyeOpen');
  rig.enableControl('head', 'headY');
  rig.enableControl('mouth', 'smile');
  return { store, history };
}

/** Everything the reaction studio asks of the preview, and nothing else. */
const preview = () => ({ fireReaction: () => true, getActiveReaction: () => null, getStayedExpressions: () => ({}), clearReactions: () => {} });

function studio() {
  const listHost = fakeHost(), inspectorHost = fakeHost();
  const { store, history } = riggedStore();
  const editorContext = createEditorContext('reactions', store);
  const routes = [];
  const it = {
    listHost, inspectorHost, store, history, routes,
    studio: createReactionStudio({ listHost, inspectorHost, store, history, preview: preview(), editorContext, navigate: (route) => routes.push(route) }),
    render: () => it.studio.render(),
    // Typing fills the field the form reads back, as the browser would.
    create: (name) => { listHost.fields['[data-reaction-name]'] = { value: name }; listHost.dispatch('input', { target: clickTarget({ tag: 'input', dataset: { reactionName: '' }, value: name }) }); listHost.dispatch('submit', { target: { dataset: { reactionForm: '' } } }); },
    // One `change` on the Inspector, as one `<select>` or `<input>` would send it.
    edit: (dataset, value, checked) => { inspectorHost.dispatch('change', { target: clickTarget({ tag: 'select', dataset, value, checked }) }); it.render(); },
    mutate: (type, apply) => { store.execute({ type, domains: [type.split('/')[0]], source: 'test', apply }); it.render(); },
    row: () => listHost.innerHTML,
    inspector: () => inspectorHost.innerHTML
  };
  return it;
}

/** The two things a reaction can point at, plus a hand that can wave. */
const withTargets = (it) => {
  it.mutate('expressions/create', (document) => { document.expressions.push({ id: 'surprised', name: 'Surprised', controls: { smile: 1 }, source: 'manual' }); });
  it.mutate('animation/create', (document) => { document.animationClips.push({ id: 'head-pop', name: 'Head Pop', duration: .6, loop: false, tracks: {} }); });
  it.mutate('hands/pose', (document) => { document.hands = { right: { poses: [{ id: 'wave', name: 'Wave' }] } }; });
  return it;
};

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

test('a whole reaction reads as one sentence: when, do, then', () => {
  const it = withTargets(studio());
  it.create('Surprise');
  it.edit({ reactionMotion: '' }, 'head-pop');

  // The row is the sentence, and this exact phrase is what ux13 reads back.
  assert.match(it.row(), /When clicked → Surprised → Head Pop → then return to idle/);
  // The Inspector says the same thing in the same words, above the fields that
  // change it: one string, two places, so the two cannot drift.
  assert.match(it.inspector(), /data-reaction-sentence>When clicked → Surprised → Head Pop → then return to idle</);

  // Three clauses, named and in reading order. `Timing` and `After` are gone as
  // separate fieldsets: how long the doing lasts belongs to Do, and what comes
  // after it is Then.
  assert.deepEqual([...it.inspector().matchAll(/data-reaction-clause="(\w+)"/g)].map((match) => match[1]), ['when', 'do', 'then']);
  assert.deepEqual([...it.inspector().matchAll(/<legend>(\w+)<\/legend>/g)].map((match) => match[1]), ['When', 'Do', 'Then']);
  assert.equal(it.inspector().includes('<legend>Timing</legend>'), false);
  assert.equal(it.inspector().includes('<legend>After</legend>'), false);
  // One clause is everything between its marker and the next one, gestures
  // included: the hand group is a `<fieldset>` inside Do, not a fourth clause.
  const clause = (name) => it.inspector().split(`data-reaction-clause="${name}"`)[1].split('data-reaction-clause=')[0].split('</div>')[0];
  assert.match(clause('when'), /data-reaction-trigger/);
  for (const hook of ['data-reaction-expression', 'data-reaction-motion', 'data-reaction-timing', 'data-reaction-gesture']) assert.match(clause('do'), new RegExp(hook), `${hook} is part of what it does`);
  assert.match(clause('then'), /data-reaction-after/);

  // Every clause of the sentence follows what the fields say, including the
  // parts that are not selects: the gesture and the intensity.
  it.edit({ reactionGesture: 'right:wave' }, undefined, true);
  it.edit({ reactionWeight: '' }, '0.5');
  assert.match(it.row(), /When clicked → Surprised at 50% → Head Pop → Right hand Wave → then return to idle/);
  it.edit({ reactionAfter: '' }, 'stay');
  assert.match(it.row(), /→ then stay like this/);
  it.edit({ reactionTrigger: '' }, 'timer');
  assert.match(it.row(), /^.*Every 5 s → Surprised at 50%/m);
});

test('the three triggers the runtime has each open the sentence, and no condition does', () => {
  const it = withTargets(studio());
  it.create('Surprise');
  // Escaped as the row writes it: the custom clause names the event in quotes.
  for (const [type, phrase] of [['hover', 'When hovered'], ['timer', 'Every 5 s'], ['custom', 'On &quot;custom&quot;'], ['click', 'When clicked']]) {
    it.edit({ reactionTrigger: '' }, type);
    assert.match(it.row(), new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${type} opens the sentence with "${phrase}"`);
  }
  // IF is not in the runtime, so it is not in the vocabulary: no condition
  // control, and no clause between When and Do (VNX-39).
  assert.equal(/data-reaction-(if|condition)/.test(it.inspector()), false);
  assert.equal(/<legend>If<\/legend>/.test(it.inspector()), false);
});

test('a reaction missing its pieces still reads as a sentence, and offers no empty slot', () => {
  // A project with artwork and nothing to point at: the reaction it can make is
  // the one that does nothing.
  const it = studio();
  it.render();
  it.create('Wave');
  assert.match(it.row(), /When clicked → does nothing yet → then return to idle/);
  assert.match(it.inspector(), /data-reaction-sentence>When clicked → does nothing yet → then return to idle</);

  // A `<select>` whose only option is "nothing" is an empty slot: the clause
  // says what is missing and where it is made instead.
  assert.equal(it.inspector().includes('data-reaction-expression'), false, 'no select with nothing in it');
  assert.equal(it.inspector().includes('data-reaction-motion'), false);
  assert.match(it.inspector(), /No expressions to show yet · <button type="button" class="link" data-reaction-go="expressions">Make one<\/button>/);
  assert.match(it.inspector(), /No motions to play yet · <button type="button" class="link" data-reaction-go="animate">Make one<\/button>/);
  it.inspectorHost.dispatch('click', { target: clickTarget({ dataset: { reactionGo: 'expressions' } }) });
  assert.deepEqual(it.routes, [{ task: 'expressions' }], 'and the way out of the empty clause works');

  // The gesture clause has the same rule and had it already: no hand, a line
  // saying where a hand comes from rather than an empty group of checkboxes.
  assert.match(it.inspector(), /data-reaction-gestures="none"/);
  // The Then clause never goes missing: a reaction always returns or stays.
  assert.match(it.inspector(), /data-reaction-after/);

  // Half a reaction reads as half a sentence, not as a blank.
  withTargets(it);
  it.edit({ reactionMotion: '' }, 'head-pop');
  assert.match(it.row(), /When clicked → Head Pop → then return to idle/);

  // And a piece that used to be there says so in the sentence, where the row is
  // the only place the author sees every reaction at once.
  it.edit({ reactionExpression: '' }, 'surprised');
  it.mutate('expressions/remove', (document) => { document.expressions.length = 0; });
  assert.match(it.row(), /When clicked → missing “surprised” → Head Pop → then return to idle/);
  assert.match(it.inspector(), /data-reaction-guidance/);

  // Switched off, it never reaches its Then, so the sentence ends there.
  it.edit({ reactionEnabled: '' }, undefined, false);
  assert.match(it.row(), /→ Head Pop → off/);
  assert.equal(/→ off → then/.test(it.row()), false);
});

test('an automatic behaviour is a when the mascot does not have to be told', () => {
  const ui = automaticPanel();
  ui.panel.render();
  // The heading and the intro name the same two keywords the reactions above
  // use, so the column reads as one idea rather than two panels.
  assert.match(ui.host.innerHTML, /<b>when<\/b> the mascot is idle, it <b>does<\/b> these on its own/);

  // Every card opens with its own when, and which one it is comes from the
  // runtime types the preset is built from: a timer for the ones that rest
  // between moves, all the time for the oscillators.
  assert.match(ui.host.innerHTML, /data-automatic-card="blink"[^>]*>.*?data-automatic-when="timer">When idle, every few seconds</);
  assert.match(ui.host.innerHTML, /data-automatic-card="idle-head"[^>]*>.*?data-automatic-when="always">When idle, all the time</);
  assert.match(ui.host.innerHTML, /data-automatic-card="eye-wander"[^>]*>.*?data-automatic-when="timer"/);
  assert.match(ui.host.innerHTML, /data-automatic-card="breathing"[^>]*>.*?data-automatic-when="always"/);

  // The description and the status still say what they said: the when is a
  // clause added in front of them, not a replacement for either.
  assert.match(ui.host.innerHTML, /The eyes close briefly every few seconds\./);
  ui.toggle('blink', true);
  ui.panel.render();
  assert.match(ui.host.innerHTML, /data-automatic-card="blink" data-automatic-status="on"/);
});

// ---------------------------------------------------------------------------
// The hooks
// ---------------------------------------------------------------------------

/** Every `data-` hook name in a rendered panel, plus the ones written to the host itself. */
const hooks = (...panels) => {
  const found = new Set();
  for (const { innerHTML, dataset } of panels) {
    for (const match of String(innerHTML).matchAll(/\s(data-[\w-]+)/g)) found.add(match[1]);
    for (const key of Object.keys(dataset || {})) found.add(`data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  return found;
};

/**
 * Every `data-` hook the two panels rendered before the vocabulary landed,
 * dumped from the panels themselves and cross-checked against the specs that
 * address them (`ux13`, `ux14`, `ux15`, `ux16`, `ux28`, plus `studio-lifecycle`
 * and `panel-lifecycle` here). Rewording is presentation; losing a hook is a
 * silently broken spec, and half of these are addressed from nowhere else.
 */
const HOOKS_BEFORE_VOCABULARY = Object.freeze([
  // Reaction list
  'data-reactions-ready', 'data-reactions-count', 'data-reaction-form', 'data-reaction-name',
  'data-reaction-select', 'data-reaction-issue', 'data-reaction-toggle', 'data-reaction-go', 'data-tone',
  // The shared preset catalogue and the starter kit, rendered into the same host
  'data-preset-catalogue', 'data-preset-group', 'data-preset-group-usable', 'data-preset-usable', 'data-preset-missing',
  'data-reaction-preset-card', 'data-reaction-preset-add', 'data-reaction-preset-fix',
  'data-starter-kit', 'data-starter-kit-add', 'data-starter-kit-add-count',
  // Reaction Inspector
  'data-reaction-id', 'data-reaction-rename', 'data-reaction-guidance', 'data-keep-open',
  'data-reaction-trigger', 'data-reaction-event', 'data-reaction-interval',
  'data-reaction-expression', 'data-reaction-weight', 'data-reaction-weight-output', 'data-reaction-motion',
  'data-reaction-gestures', 'data-reaction-gesture',
  'data-reaction-timing', 'data-reaction-timing-field', 'data-reaction-after',
  'data-reaction-enabled', 'data-reaction-priority', 'data-reaction-interrupt',
  'data-reaction-test', 'data-reaction-duplicate', 'data-reaction-delete',
  // Automatic panel
  'data-automatic-ready', 'data-automatic-on', 'data-automatic-card', 'data-automatic-status',
  'data-automatic-toggle', 'data-automatic-test', 'data-automatic-fix-movements',
  'data-automatic-other', 'data-automatic-advanced'
]);

/** What the vocabulary added. Nothing else may appear without being written down here. */
const HOOKS_ADDED = Object.freeze(['data-reaction-sentence', 'data-reaction-clause', 'data-automatic-when']);

/**
 * No single render shows every hook — a trigger is either a timer or a custom
 * event, a preset is either usable or waiting — so the inventory is the union
 * over the states an author walks through.
 */
function everyHook() {
  const found = new Set();
  const collect = (...panels) => { for (const hook of hooks(...panels)) found.add(hook); };

  // Nothing to point at: the gate, the presets that wait, the starter kit, and
  // the reaction that does nothing.
  const it = studio();
  it.render();
  collect(it.listHost, it.inspectorHost);
  it.create('Wave');
  collect(it.listHost, it.inspectorHost);

  // With an expression, a motion and a hand pose: the usable presets, the full
  // Inspector, and a reaction pointing at all three.
  withTargets(it);
  it.edit({ reactionExpression: '' }, 'surprised');
  it.edit({ reactionMotion: '' }, 'head-pop');
  it.edit({ reactionGesture: 'right:wave' }, undefined, true);
  collect(it.listHost, it.inspectorHost);

  // The trigger fields are exclusive, and so is custom timing.
  for (const type of ['custom', 'timer']) { it.edit({ reactionTrigger: '' }, type); collect(it.inspectorHost); }
  it.edit({ reactionTiming: '' }, 'custom');
  collect(it.inspectorHost);

  // A target that disappears is the guidance and the issue mark.
  it.mutate('expressions/remove', (document) => { document.expressions.length = 0; });
  collect(it.listHost, it.inspectorHost);

  // The automatic panel: one preset that waits for movements, one turned on
  // (which is what shows Test and the notice), and one behavior no preset owns.
  const auto = automaticPanel();
  auto.panel.render();
  collect(auto.host);
  auto.toggle('blink', true);
  auto.panel.render();
  auto.store.execute({ type: 'behaviors/add', domains: ['rig'], source: 'test', apply: (document) => { document.behaviors.push({ id: 'hand-made', type: 'oscillator', name: 'Hand made', enabled: true, parameter: 'headTilt', amplitude: .1, frequency: .5, offset: 0, waveform: 'sine' }); } });
  auto.panel.render();
  collect(auto.host);
  return found;
}

test('no hook left the two panels when the vocabulary arrived', () => {
  const rendered = everyHook();
  assert.deepEqual(HOOKS_BEFORE_VOCABULARY.filter((hook) => !rendered.has(hook)), [], 'rewording a label is fine, dropping a hook breaks a spec that cannot be seen from here');
  for (const hook of HOOKS_ADDED) assert.ok(rendered.has(hook), `${hook} is what the sentence added`);
  assert.deepEqual([...rendered].filter((hook) => !HOOKS_BEFORE_VOCABULARY.includes(hook) && !HOOKS_ADDED.includes(hook)), [], 'a new hook is fine, an undeclared one is a hook nobody is guarding');
});

// ---------------------------------------------------------------------------
// The lifecycle the vocabulary had to keep
// ---------------------------------------------------------------------------

// A render leaves markup behind; a skipped one must leave this untouched.
const SENTINEL = 'the last render, still on screen';

test('the sentence did not cost the panels their skipped renders', () => {
  const it = withTargets(studio());
  it.create('Surprise');
  // Creating puts the project's first expression in it, so take that back out:
  // choosing it again is one of the changes the loop below measures.
  it.edit({ reactionExpression: '' }, '');
  const drawn = it.studio.counters().renders;
  it.listHost.innerHTML = SENTINEL;
  it.inspectorHost.innerHTML = SENTINEL;
  for (let pass = 0; pass < 4; pass += 1) assert.equal(it.studio.render(), false);
  assert.deepEqual(it.studio.counters(), { renders: drawn, skipped: 4 });
  assert.equal(it.listHost.innerHTML, SENTINEL, 'the sentence is derived from the model, not from the DOM');
  assert.equal(it.inspectorHost.innerHTML, SENTINEL);

  // And every clause is still in the model: each of these changes one word of
  // the sentence and nothing else, so a missing field would show up as a
  // skipped render rather than as a wrong one.
  for (const [dataset, value, checked] of [
    [{ reactionTrigger: '' }, 'hover'], [{ reactionExpression: '' }, 'surprised'], [{ reactionWeight: '' }, '0.5'],
    [{ reactionMotion: '' }, 'head-pop'], [{ reactionGesture: 'right:wave' }, undefined, true], [{ reactionAfter: '' }, 'stay']
  ]) {
    it.inspectorHost.innerHTML = SENTINEL;
    it.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'select', dataset, value, checked }) });
    assert.equal(it.studio.render(), true, `${Object.keys(dataset)[0]} is a different sentence`);
    assert.notEqual(it.inspectorHost.innerHTML, SENTINEL);
  }

  // Renaming what a reaction points at is the same question one level away.
  it.listHost.innerHTML = SENTINEL;
  it.mutate('expressions/rename', (document) => { document.expressions[0].name = 'Amazed'; });
  assert.match(it.row(), /→ Amazed at 50%/);
});

test('the automatic panel still skips an unchanged status with its when clause on', () => {
  const ui = automaticPanel();
  ui.panel.render();
  const drawn = ui.panel.counters().renders;
  ui.host.innerHTML = SENTINEL;
  for (let pass = 0; pass < 4; pass += 1) assert.equal(ui.panel.render(), false);
  assert.deepEqual(ui.panel.counters(), { renders: drawn, skipped: 4 });
  assert.equal(ui.host.innerHTML, SENTINEL);

  // The when clause is a pure function of the preset, which is already in the
  // signature, so it costs no extra field and no extra render.
  ui.toggle('blink', true);
  assert.equal(ui.panel.render(), true);
  assert.match(ui.host.innerHTML, /data-automatic-when="timer"/);
});

// ---------------------------------------------------------------------------
// Automatic panel harness
// ---------------------------------------------------------------------------

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

function automaticPanel() {
  const host = fakeHost();
  const store = createEditorStore({
    ...blankProject(),
    params: { eyeOpen: number(0, 1, 1), lookX: number(-1, 1), lookY: number(-1, 1), headY: number(-1, 1) },
    states: { idle: { eyeOpen: 1, lookX: 0, lookY: 0, headY: 0 } }
  });
  const history = createHistory(store);
  const panel = createAutomaticPanel(host, store, history, { testBehavior: () => true }, { update: () => {} }, {});
  return {
    host, store, panel,
    toggle: (id, checked) => host.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { automaticToggle: id }, checked }) })
  };
}
