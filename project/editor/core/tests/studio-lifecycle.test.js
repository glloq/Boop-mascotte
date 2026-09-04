import test from 'node:test';
import assert from 'node:assert/strict';
import { clickTarget } from './helpers/stub-dom.js';
import { createContextInspector } from '../../ui/context-inspector.js';
import { createExpressionStudio } from '../../ui/expression-studio.js';
import { createMotionStudio } from '../../ui/motion-studio.js';
import { createReactionStudio } from '../../ui/reaction-studio.js';
import { createEditorContext } from '../../ui/editor-context.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';

/**
 * The four panels of VNX-03 steps 3 and 4 — the context inspector and the
 * three studios — behind the component lifecycle (docs/VNEXT_COMPONENTS.md).
 *
 * Each studio's markup is covered by its own e2e spec; what is proved here is
 * what the lifecycle adds on top of it, and it is the same four promises every
 * time: an unchanged model costs a comparison instead of a render, a model that
 * moved is drawn, `destroy()` lets go of every listener, and the public API the
 * editor calls by name still answers. The fifth is the inspector's alone: its
 * `render()` returns the context `workspace-manager.js` reads, and it has to
 * return it whether it drew anything or not.
 *
 * The trap each panel is checked against is the guide bar's from step 2: state
 * the *panel* owns rather than state the document supplies. A notice nobody
 * authored, a half-typed name, an open disclosure and a layout that has nothing
 * to do with the store all have to be in the model, or the next unrelated
 * keystroke redraws them away.
 *
 * These run in Node with no DOM, like `panel-lifecycle.test.js`: a host is an
 * object with the handful of properties the panels touch.
 */
function fakeHost() {
  const listeners = new Map();
  const host = {
    innerHTML: '',
    hidden: false,
    dataset: {},
    // The studios check that the button a click landed on is one of their own
    // before acting on it; here every button is.
    contains: () => true,
    // The few elements a studio reads back out of its own markup: the name
    // field a form submit takes its value from, and the live outputs a drag
    // writes into, which are not in this DOM at all.
    fields: {},
    querySelector: (selector) => host.fields[selector] || null,
    querySelectorAll: () => [],
    addEventListener(type, handler, options) { const key = `${type}:${options === true ? 'capture' : 'bubble'}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(handler); },
    removeEventListener(type, handler, options) { listeners.get(`${type}:${options === true ? 'capture' : 'bubble'}`)?.delete(handler); },
    dispatch(type, event = {}) { for (const key of [`${type}:capture`, `${type}:bubble`]) for (const handler of [...(listeners.get(key) || [])]) handler({ type, target: host, preventDefault() {}, ...event }); },
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0)
  };
  return host;
}

/** A `<details>` as the toggle listeners see it: an id and an open flag. */
const toggleTarget = ({ dataset = {}, attribute = null, open = true } = {}) =>
  ({ dataset, open, getAttribute: (name) => (attribute && name === attribute.name ? attribute.value : null) });

// A render leaves markup behind; a skipped one must leave this untouched. It is
// the DOM-side proof of what `counters()` reports as a number.
const SENTINEL = 'the last render, still on screen';

/** Everything the three studios ask of the preview, and what they asked for. */
function fakePreview() {
  const calls = [];
  const record = (name, ...args) => { calls.push([name, ...args]); };
  let weights = {}, clipId = null, playing = false, reaction = null;
  return {
    calls,
    getEffectiveParams: () => ({}),
    getExpressionWeights: () => ({ ...weights }),
    setExpression(id, intensity) { weights[id] = intensity; record('setExpression', id, intensity); },
    clearExpressions() { weights = {}; record('clearExpressions'); },
    setLiveParam(name, value) { record('setLiveParam', name, value); },
    clearLiveParam(name) { record('clearLiveParam', name); },
    clearLiveParams() { record('clearLiveParams'); },
    getActiveClipId: () => clipId,
    setClip(id) { clipId = id; record('setClip', id); },
    playMotion(id) { playing = true; record('playMotion', id); },
    stopMotion() { playing = false; record('stopMotion'); },
    isPlaying: () => playing,
    fireReaction(id) { reaction = id; record('fireReaction', id); return true; },
    getActiveReaction: () => reaction,
    getStayedExpressions: () => ({}),
    clearReactions() { reaction = null; record('clearReactions'); }
  };
}

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id) => ({ id, name: id, type: 'path', visible: true, children: [] });
const ARTWORK = ['head', 'eyeL', 'eyeR', 'mouth'];

const studioProject = () => ({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>',
  elements: Object.fromEntries(ARTWORK.map((id) => [id, element()])), layers: ARTWORK.map(layer), layerMetadata: {},
  semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', transitions: {},
  animationClips: [], behaviors: [], expressions: [], reactions: []
});

/**
 * A project with a face that moves: three movements assigned and enabled, which
 * is what makes the preset catalogues offer anything and the Inspector show its
 * sliders. Built through the real rig commands rather than hand-written state.
 */
function riggedStore() {
  const store = createEditorStore(studioProject()), history = createHistory(store);
  const rig = createSemanticRigCommands(store, history);
  rig.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'eyes', role: 'leftEye', elementId: 'eyeL' }, { type: 'eyes', role: 'rightEye', elementId: 'eyeR' }, { type: 'mouth', role: 'mouth', elementId: 'mouth' }]);
  rig.enableControl('eyes', 'eyeOpen');
  rig.enableControl('head', 'headY');
  rig.enableControl('mouth', 'smile');
  return { store, history };
}

// ---------------------------------------------------------------------------
// Context inspector (step 3)
// ---------------------------------------------------------------------------

/** The shell's inspector section: a heading, an empty line and five adapters. */
function inspectorRoot() {
  const heading = { textContent: '' };
  const empty = { textContent: '', hidden: false };
  const adapters = ['semantic', 'artwork', 'expression', 'motion', 'reaction'].map((kind) => ({ dataset: { inspectorAdapter: kind }, hidden: false }));
  const root = {
    innerHTML: 'the shell markup this section is made of',
    hidden: false, dataset: {}, heading, empty, adapters,
    querySelector: (selector) => (selector === '[data-context-inspector-heading]' ? heading : selector === '[data-context-inspector-empty]' ? empty : null),
    querySelectorAll: () => adapters,
    addEventListener() { throw new Error('the context inspector registers no listeners'); },
    removeEventListener() {},
    shown: () => adapters.filter((adapter) => !adapter.hidden).map((adapter) => adapter.dataset.inspectorAdapter)
  };
  return root;
}

function contextInspector(task = 'expressions') {
  const root = inspectorRoot();
  const { store } = riggedStore();
  const editorContext = createEditorContext('expressions', store);
  const inspector = createContextInspector(root, editorContext, () => task);
  return {
    root, inspector, editorContext,
    setTask: (next) => { task = next; },
    select: (id) => editorContext.update({ activeExpressionId: id })
  };
}

test('the context inspector returns the inspector context whether it renders or skips', () => {
  const ui = contextInspector();
  ui.select('happy');
  assert.deepEqual(ui.inspector.render(), { kind: 'expression', id: 'happy' }, 'the first render is the mount, and it answers');
  assert.deepEqual(ui.inspector.counters(), { renders: 1, skipped: 0 });
  assert.equal(ui.root.dataset.contextKind, 'expression');
  assert.equal(ui.root.dataset.contextId, 'happy');
  assert.deepEqual(ui.root.shown(), ['expression']);

  ui.root.heading.textContent = SENTINEL;
  for (let pass = 0; pass < 6; pass += 1) {
    assert.deepEqual(ui.inspector.render(), { kind: 'expression', id: 'happy' }, 'a skipped render still answers the question the caller asked');
  }
  assert.deepEqual(ui.inspector.counters(), { renders: 1, skipped: 6 }, 'six context changes, no DOM');
  assert.equal(ui.root.heading.textContent, SENTINEL, 'and the heading from the first render was never rewritten');
});

test('the context inspector redraws as soon as the selection moves', () => {
  const ui = contextInspector();
  assert.deepEqual(ui.inspector.render(), { kind: 'none', task: 'expressions' });
  assert.equal(ui.root.empty.textContent, '', 'the expression adapter answers for an empty expressions task');
  assert.deepEqual(ui.root.shown(), ['expression']);

  ui.select('happy');
  assert.deepEqual(ui.inspector.render(), { kind: 'expression', id: 'happy' });
  assert.equal(ui.inspector.counters().renders, 2);
  assert.equal(ui.root.heading.textContent, 'Expression Inspector');

  // A different task with nothing selected is a different heading, a different
  // adapter and an empty line that says what to do.
  ui.setTask('artwork');
  assert.deepEqual(ui.inspector.render(), { kind: 'none', task: 'artwork' });
  assert.equal(ui.root.heading.textContent, 'Inspector');
  assert.equal(ui.root.empty.textContent, 'Select an element on the canvas to edit it.');
  assert.equal(ui.root.empty.hidden, false);
  assert.deepEqual(ui.root.shown(), []);

  // Preview has no inspector at all: the panel writes `hidden` as content,
  // which is the one attribute the component also owns.
  ui.setTask('preview');
  assert.deepEqual(ui.inspector.render(), { kind: 'none', task: 'preview' });
  assert.equal(ui.root.hidden, true);
  assert.equal(ui.inspector.counters().renders, 4);
});

test('destroying the context inspector stops the work, and takes the shell markup with it', () => {
  const ui = contextInspector();
  ui.select('happy');
  ui.inspector.render();
  const before = ui.inspector.counters();

  assert.equal(ui.inspector.destroy(), true);
  // Nothing to unregister — this panel never had a listener, which is why it
  // was the cheap step — but the host is emptied all the same, and this host is
  // the shell's own: the heading, the empty line and three other panels' hosts.
  assert.equal(ui.root.innerHTML, '');

  assert.equal(ui.inspector.destroy(), false, 'destroy is idempotent');
  assert.throws(() => ui.inspector.render(), /destroyed: create a new one/, 'and render after destroy throws rather than half-drawing');
  assert.deepEqual(ui.inspector.counters(), before);
});

// ---------------------------------------------------------------------------
// Expression studio (step 4)
// ---------------------------------------------------------------------------

function expressionStudio() {
  const listHost = fakeHost(), inspectorHost = fakeHost();
  const { store, history } = riggedStore();
  const preview = fakePreview();
  const editorContext = createEditorContext('expressions', store);
  const statuses = [], routes = [];
  const studio = createExpressionStudio({
    listHost, inspectorHost, store, history, preview, editorContext,
    onStatus: (message) => statuses.push(message), navigate: (route) => routes.push(route)
  });
  return {
    listHost, inspectorHost, store, history, preview, editorContext, studio, statuses, routes,
    click: (dataset) => listHost.dispatch('click', { target: clickTarget({ dataset }) }),
    clickInspector: (dataset) => inspectorHost.dispatch('click', { target: clickTarget({ dataset }) }),
    // Typing fills the field the form reads back, as the browser would.
    type: (value) => { listHost.fields['[data-expression-name]'] = { value }; listHost.dispatch('input', { target: clickTarget({ tag: 'input', dataset: { expressionName: '' }, value }) }); },
    submit: () => listHost.dispatch('submit', { target: { dataset: { expressionForm: '' } } }),
    openBlend: () => listHost.dispatch('toggle', { target: toggleTarget({ dataset: { expressionBlend: '' } }) }),
    expressions: () => store.getDocument().expressions
  };
}

test('the expression studio compares a rebuilt catalogue instead of redrawing it', () => {
  const ui = expressionStudio();
  assert.equal(ui.studio.render(), true, 'the first render is the mount');
  assert.deepEqual(ui.studio.counters(), { renders: 1, skipped: 0 });
  assert.equal(ui.listHost.dataset.expressionsCount, '0');

  ui.listHost.innerHTML = SENTINEL;
  ui.inspectorHost.innerHTML = SENTINEL;
  for (let pass = 0; pass < 6; pass += 1) assert.equal(ui.studio.render(), false);
  assert.deepEqual(ui.studio.counters(), { renders: 1, skipped: 6 }, 'twenty-six presets resolved seven times and drawn once');
  assert.equal(ui.listHost.innerHTML, SENTINEL);
  assert.equal(ui.inspectorHost.innerHTML, SENTINEL);

  // The notification this panel is redrawn for and does not care about: posing
  // the rig reaches `expressionStudio` through the render plan, and changes not
  // one character of a list of named faces.
  ui.store.execute({ type: 'state/pose', domains: ['rig'], source: 'test', apply: (document) => { document.states.idle.smile = .4; } });
  assert.equal(ui.studio.render(), false);
  assert.equal(ui.listHost.innerHTML, SENTINEL, 'and the panel never noticed');
});

test('the expression studio redraws when the collection it shows actually changes', () => {
  const ui = expressionStudio();
  ui.studio.render();

  ui.click({ expressionPreset: 'happy' });
  assert.deepEqual(ui.expressions().map((item) => item.id), ['happy'], 'the preset was authored');
  assert.equal(ui.listHost.dataset.expressionsCount, '1');
  assert.match(ui.listHost.innerHTML, /data-expression-select="happy"/);
  assert.match(ui.listHost.innerHTML, /aria-pressed="true"/, 'and selected, so the Inspector has something to show');
  assert.match(ui.inspectorHost.innerHTML, /data-expression-rename/);
  assert.equal(ui.inspectorHost.dataset.expressionId, 'happy');
  assert.equal(ui.studio.render(), false, 'and the notification that follows finds the same model');

  // Renaming moves the list row, the Inspector field and nothing else.
  const renders = ui.studio.counters().renders;
  ui.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { expressionRename: '' }, value: 'Very happy' }) });
  assert.equal(ui.studio.counters().renders, renders + 1);
  assert.match(ui.listHost.innerHTML, /Very happy/);

  // A slider commit is a different control set, which the row signature carries.
  ui.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { expressionControl: 'smile' }, value: '0.5' }) });
  assert.equal(ui.expressions()[0].controls.smile, .5);
  assert.match(ui.inspectorHost.innerHTML, /data-expression-output="smile">0\.50/);

  // And a face the author is *not* editing: renamed from anywhere else, it is
  // one row in a list the Inspector never mentions, so only the list signature
  // can tell the two passes apart.
  ui.click({ expressionPreset: 'sad' });
  ui.click({ expressionPresetSelect: 'very-happy' });
  assert.equal(ui.studio.activeExpressionId(), 'very-happy');
  ui.store.execute({ type: 'expressions/rename', domains: ['expressions'], source: 'test', apply: (document) => { document.expressions[1].name = 'Miserable'; } });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.listHost.innerHTML, /Miserable/);
});

test('a warning the expression studio invented itself still reaches the screen', () => {
  // The trap. "Capture" with a neutral face authors nothing at all: no
  // document, no session, no preview. If the notice were not part of the model,
  // this render would derive an identical one, be skipped, and the author would
  // press the button and see nothing happen.
  const ui = expressionStudio();
  ui.studio.render();
  const renders = ui.studio.counters().renders;

  ui.click({ expressionCaptureNew: '' });
  assert.deepEqual(ui.expressions(), [], 'nothing was authored');
  assert.equal(ui.studio.counters().renders, renders + 1);
  assert.match(ui.listHost.innerHTML, /The face is neutral right now/);

  // And the same in the other direction: the notice is cleared by the next
  // thing that works, and the panel has to redraw without it.
  ui.click({ expressionPreset: 'happy' });
  assert.doesNotMatch(ui.listHost.innerHTML, /The face is neutral right now/);
  assert.match(ui.listHost.innerHTML, /Happy added with/);
});

test('an unrelated update leaves the expression studio exactly as the author left it', () => {
  const ui = expressionStudio();
  ui.studio.render();

  // A half-typed name and an opened cross-fade are the panel's own state. The
  // browser already holds both; the model has to hold them too, or the next
  // redraw hands back an empty field and a folded disclosure.
  ui.type('Grumpy');
  ui.openBlend();
  ui.click({ expressionPreset: 'happy' });
  assert.match(ui.listHost.innerHTML, /value="Grumpy"/, 'the name survived a redraw it did not ask for');
  assert.match(ui.listHost.innerHTML, /data-expression-blend [^>]*open/, 'and so did the open cross-fade');

  // Test intensity is the third: a preview setting the expression itself never
  // stores, which the Inspector has to keep showing after the next redraw.
  ui.inspectorHost.dispatch('input', { target: clickTarget({ tag: 'input', dataset: { expressionIntensity: '' }, value: '0.5' }) });
  assert.deepEqual(ui.preview.getExpressionWeights(), { happy: .5 }, 'the preview follows the slider straight away');
  ui.click({ expressionPreset: 'sad' });
  assert.match(ui.inspectorHost.innerHTML, /data-expression-intensity-output>50%/);
  assert.match(ui.inspectorHost.innerHTML, /data-expression-intensity [^>]*value="0.5"/);

  // Creating from that name empties it, which is a change like any other.
  ui.submit();
  assert.deepEqual(ui.expressions().map((item) => item.name), ['Happy', 'Sad', 'Grumpy']);
  assert.doesNotMatch(ui.listHost.innerHTML, /value="Grumpy"/, 'the field the name came from is empty again');
  assert.match(ui.listHost.innerHTML, /data-expression-blend [^>]*open/, 'and the disclosure is still open across that one too');
});

test('a studio with no artwork yet says so, and stops saying it when the artwork lands', () => {
  const ui = expressionStudio();
  ui.store.execute({ type: 'artwork/replace', domains: ['artwork'], source: 'test', apply: (document) => { document.svgMarkup = ''; } });
  ui.studio.render();
  assert.match(ui.listHost.innerHTML, /Add artwork first/);
  assert.equal(ui.inspectorHost.innerHTML, '', 'and the Inspector says nothing at all rather than half a form');
  assert.equal(ui.studio.render(), false, 'which is one model like any other');

  ui.store.execute({ type: 'artwork/replace', domains: ['artwork'], source: 'test', apply: (document) => { document.svgMarkup = '<svg><path id="head" d="M0 0"/></svg>'; } });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.listHost.innerHTML, /Ready-made faces/);
  assert.match(ui.inspectorHost.innerHTML, /Select an expression on the left/);
});

test('the expression studio still answers the editor by name after the conversion', () => {
  const ui = expressionStudio();
  ui.studio.render();
  ui.click({ expressionPreset: 'happy' });
  assert.equal(ui.studio.activeExpressionId(), 'happy');

  // `writeControls` is what a drag on the mascot commits to.
  assert.equal(ui.studio.writeControls({ smile: .8 }), true);
  assert.equal(ui.expressions()[0].controls.smile, .8);
  assert.equal(ui.studio.writeControls({}), false, 'an empty drag writes nothing');
  assert.deepEqual(ui.studio.snapshot(), { activeId: 'happy', intensity: 1, weights: { happy: 1 } });

  // `leave` and `enter` keep their own job — disarming and re-arming the live
  // expression — and gained the lifecycle's.
  ui.studio.leave();
  assert.deepEqual(ui.preview.getExpressionWeights(), {}, 'the preview is disarmed');
  const drawn = ui.studio.counters().renders;
  ui.listHost.innerHTML = SENTINEL;
  ui.store.execute({ type: 'expressions/rename', domains: ['expressions'], source: 'test', apply: (document) => { document.expressions[0].name = 'Delighted'; } });
  assert.equal(ui.studio.render(), false, 'a workspace nobody is looking at does no DOM work');
  assert.equal(ui.listHost.innerHTML, SENTINEL);
  assert.equal(ui.studio.counters().renders, drawn);

  ui.studio.enter();
  assert.deepEqual(ui.preview.getExpressionWeights(), { happy: 1 }, 'the preview is armed again');
  assert.equal(ui.studio.counters().renders, drawn + 1, 'and the render owed from while it was hidden is paid once');
  assert.match(ui.listHost.innerHTML, /Delighted/);
});

test('destroying the expression studio takes all ten listeners with it', () => {
  const ui = expressionStudio();
  ui.studio.render();
  assert.equal(ui.listHost.listenerCount(), 6, 'submit, input, change, click, the cross-fade toggle and the preset groups own toggle');
  assert.equal(ui.inspectorHost.listenerCount(), 4, 'two clicks, input and change');
  ui.click({ expressionPreset: 'happy' });
  assert.equal(ui.expressions().length, 1);

  assert.equal(ui.studio.destroy(), true);
  assert.equal(ui.listHost.listenerCount(), 0, 'including the capture-phase toggle that remembers open groups');
  assert.equal(ui.inspectorHost.listenerCount(), 0);
  assert.equal(ui.listHost.innerHTML, '');
  assert.equal(ui.inspectorHost.innerHTML, '', 'the second host is emptied by hand: the component only owns the first');

  const before = ui.studio.counters();
  ui.click({ expressionPreset: 'sad' });
  ui.clickInspector({ expressionDelete: '' });
  ui.type('Grumpy');
  assert.deepEqual(ui.expressions().map((item) => item.id), ['happy'], 'a destroyed studio authors nothing and deletes nothing');
  assert.deepEqual(ui.studio.counters(), before);
  assert.equal(ui.studio.destroy(), false);
  assert.throws(() => ui.studio.render(), /destroyed: create a new one/);
});

// ---------------------------------------------------------------------------
// Motion studio (step 4)
// ---------------------------------------------------------------------------

function motionStudio() {
  const listHost = fakeHost(), inspectorHost = fakeHost();
  const { store, history } = riggedStore();
  const preview = fakePreview();
  const editorContext = createEditorContext('animate', store);
  const statuses = [], opened = [];
  let timeline = true;
  const studio = createMotionStudio({
    listHost, inspectorHost, store, history, preview, editorContext,
    onStatus: (message, tone) => statuses.push([message, tone]),
    openTimeline: (id) => opened.push(id),
    canOpenTimeline: () => timeline
  });
  return {
    listHost, inspectorHost, store, history, preview, studio, statuses, opened,
    click: (dataset) => listHost.dispatch('click', { target: clickTarget({ dataset }) }),
    clickInspector: (dataset) => inspectorHost.dispatch('click', { target: clickTarget({ dataset }) }),
    setTimeline: (value) => { timeline = value; },
    clips: () => store.getDocument().animationClips
  };
}

test('the motion studio compares a rebuilt catalogue instead of redrawing it', () => {
  const ui = motionStudio();
  assert.equal(ui.studio.render(), true);
  assert.deepEqual(ui.studio.counters(), { renders: 1, skipped: 0 });

  ui.listHost.innerHTML = SENTINEL;
  ui.inspectorHost.innerHTML = SENTINEL;
  for (let pass = 0; pass < 6; pass += 1) assert.equal(ui.studio.render(), false);
  assert.deepEqual(ui.studio.counters(), { renders: 1, skipped: 6 });
  assert.equal(ui.listHost.innerHTML, SENTINEL);

  // Animate is redrawn on every `rig` notification too, and a pose is not a
  // motion.
  ui.store.execute({ type: 'state/pose', domains: ['rig'], source: 'test', apply: (document) => { document.states.idle.headY = .3; } });
  assert.equal(ui.studio.render(), false);
  assert.equal(ui.listHost.innerHTML, SENTINEL);
});

test('the motion studio redraws when a motion is added, retuned or renamed', () => {
  const ui = motionStudio();
  ui.studio.render();
  assert.equal(ui.listHost.dataset.motionsCount, '0');

  ui.click({ motionPreset: 'nod' });
  assert.equal(ui.clips().length, 1);
  assert.equal(ui.listHost.dataset.motionsCount, '1');
  assert.match(ui.listHost.innerHTML, /data-motion-badge="simple">Preset/);
  assert.equal(ui.inspectorHost.dataset.motionId, ui.clips()[0].id);
  assert.equal(ui.studio.render(), false, 'the notification that follows finds the same model');

  // A setting is one number in the summary the list line and the Inspector are
  // both made of.
  const renders = ui.studio.counters().renders;
  ui.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { motionSetting: 'duration' }, value: '2' }) });
  assert.equal(ui.studio.render(), true);
  assert.equal(ui.studio.counters().renders, renders + 1);
  assert.match(ui.listHost.innerHTML, /2 s/);

  ui.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { motionRename: '' }, value: 'Slow nod' }) });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.listHost.innerHTML, /Slow nod/);
});

test('the motion studio says what is missing, and says why nothing was added', () => {
  const ui = motionStudio();
  ui.studio.render();
  assert.doesNotMatch(ui.listHost.innerHTML, /Turn on a head movement in Face Setup/);

  // With every movement off, no preset can be built at all — a gate that comes
  // from the rig rather than from anything this panel owns.
  const rig = createSemanticRigCommands(ui.store, ui.history);
  rig.disableControl('head', 'headY');
  rig.disableControl('eyes', 'eyeOpen');
  rig.disableControl('mouth', 'smile');
  assert.equal(ui.studio.render(), true);
  assert.match(ui.listHost.innerHTML, /Turn on a head movement in Face Setup/);

  // And pressing Add anyway authors nothing, so only the notice in the model
  // can say why.
  const renders = ui.studio.counters().renders;
  ui.click({ motionPreset: 'nod' });
  assert.deepEqual(ui.clips(), []);
  assert.equal(ui.studio.counters().renders, renders + 1);
  assert.match(ui.listHost.innerHTML, /Nod needs a movement that is off/);
});

test('the motion studio keeps the reset question and the layout in its model', () => {
  const ui = motionStudio();
  ui.studio.render();
  ui.click({ motionPreset: 'nod' });
  const id = ui.clips()[0].id;

  // Editing a key by hand turns a preset into an edited clip, which is what
  // offers "Reset to preset" at all.
  ui.store.execute({ type: 'timeline/edit', domains: ['animation'], source: 'test', apply: (document) => { document.animationClips[0].tracks.headY[0].value = .9; } });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.inspectorHost.innerHTML, /data-motion-reset>/);
  assert.match(ui.statuses.at(-1)?.[0] || '', /is now edited by hand/, 'the one conversion notice still fires from render');

  // The question is panel state: it authors nothing, so only the model can put
  // it on screen.
  const renders = ui.studio.counters().renders;
  ui.clickInspector({ motionReset: '' });
  assert.equal(ui.studio.counters().renders, renders + 1);
  assert.match(ui.inspectorHost.innerHTML, /data-motion-reset-confirm/);
  ui.clickInspector({ motionResetCancel: '' });
  assert.doesNotMatch(ui.inspectorHost.innerHTML, /data-motion-reset-confirm/);

  // The layout is not in the store at all, and `__boopLayoutChanged` calls
  // `render()` for it: left out of the model, the button would keep the
  // disabled state of the layout before.
  assert.match(ui.inspectorHost.innerHTML, /data-motion-open-timeline >/);
  ui.setTimeline(false);
  assert.equal(ui.studio.render(), true, 'a phone is a different model');
  assert.match(ui.inspectorHost.innerHTML, /data-motion-open-timeline disabled/);
  ui.setTimeline(true);
  assert.equal(ui.studio.render(), true);
  assert.match(ui.inspectorHost.innerHTML, /data-motion-open-timeline >/);
  assert.deepEqual(ui.clips()[0].id, id);
});

test('destroying the motion studio takes all eight listeners with it', () => {
  const ui = motionStudio();
  ui.studio.render();
  assert.equal(ui.listHost.listenerCount(), 5, 'input, change, click, the cross-fade toggle and the preset groups own toggle');
  assert.equal(ui.inspectorHost.listenerCount(), 3, 'click, input, change');
  ui.click({ motionPreset: 'nod' });
  assert.equal(ui.clips().length, 1);

  assert.equal(ui.studio.destroy(), true);
  assert.equal(ui.listHost.listenerCount(), 0);
  assert.equal(ui.inspectorHost.listenerCount(), 0);
  assert.equal(ui.listHost.innerHTML, '');
  assert.equal(ui.inspectorHost.innerHTML, '');

  const before = ui.studio.counters();
  ui.click({ motionPreset: 'bounce' });
  ui.clickInspector({ motionDelete: '' });
  ui.clickInspector({ motionOpenTimeline: '' });
  assert.equal(ui.clips().length, 1, 'a destroyed studio neither adds nor deletes');
  assert.deepEqual(ui.opened, []);
  assert.deepEqual(ui.studio.counters(), before);
  assert.throws(() => ui.studio.render(), /destroyed: create a new one/);
});

test('the motion studio still reports its snapshot the way the editor asks it to', () => {
  const ui = motionStudio();
  ui.studio.render();
  assert.deepEqual(ui.studio.snapshot(), { activeId: null, motions: [] });

  ui.click({ motionPreset: 'nod' });
  const snapshot = ui.studio.snapshot();
  assert.equal(snapshot.activeId, ui.clips()[0].id, 'adding a motion selects it');
  assert.deepEqual(snapshot.motions.map((item) => [item.kind, item.presetName]), [['simple', 'Nod']]);
  assert.deepEqual(ui.preview.calls.filter(([name]) => name === 'playMotion').length, 1, 'and plays it once');
});

// ---------------------------------------------------------------------------
// Reaction studio (step 4)
// ---------------------------------------------------------------------------

function reactionStudio() {
  const listHost = fakeHost(), inspectorHost = fakeHost();
  const { store, history } = riggedStore();
  const preview = fakePreview();
  const editorContext = createEditorContext('reactions', store);
  const statuses = [], routes = [];
  const studio = createReactionStudio({
    listHost, inspectorHost, store, history, preview, editorContext,
    onStatus: (message) => statuses.push(message), navigate: (route) => routes.push(route)
  });
  return {
    listHost, inspectorHost, store, history, preview, studio, statuses, routes,
    click: (dataset) => listHost.dispatch('click', { target: clickTarget({ dataset }) }),
    clickInspector: (dataset) => inspectorHost.dispatch('click', { target: clickTarget({ dataset }) }),
    // Typing fills the field the form reads back, as the browser would.
    type: (value) => { listHost.fields['[data-reaction-name]'] = { value }; listHost.dispatch('input', { target: clickTarget({ tag: 'input', dataset: { reactionName: '' }, value }) }); },
    submit: () => listHost.dispatch('submit', { target: { dataset: { reactionForm: '' } } }),
    openAdvanced: () => inspectorHost.dispatch('toggle', { target: toggleTarget({ attribute: { name: 'data-keep-open', value: 'advanced' } }) }),
    addExpression: (id, name) => store.execute({ type: 'expressions/create', domains: ['expressions'], source: 'test', apply: (document) => { document.expressions.push({ id, name, controls: { smile: 1 }, source: 'manual' }); } }),
    reactions: () => store.getDocument().reactions
  };
}

test('the reaction studio compares a rebuilt list instead of redrawing it', () => {
  const ui = reactionStudio();
  assert.equal(ui.studio.render(), true);
  assert.deepEqual(ui.studio.counters(), { renders: 1, skipped: 0 });
  assert.equal(ui.listHost.dataset.reactionsCount, '0');

  ui.listHost.innerHTML = SENTINEL;
  ui.inspectorHost.innerHTML = SENTINEL;
  for (let pass = 0; pass < 6; pass += 1) assert.equal(ui.studio.render(), false);
  assert.deepEqual(ui.studio.counters(), { renders: 1, skipped: 6 });
  assert.equal(ui.listHost.innerHTML, SENTINEL);

  // Reactions are redrawn on every `expressions` and `animation` notification
  // because they can point at either; a rig pose is neither.
  ui.store.execute({ type: 'state/pose', domains: ['rig'], source: 'test', apply: (document) => { document.states.idle.smile = .2; } });
  assert.equal(ui.studio.render(), false);
  assert.equal(ui.listHost.innerHTML, SENTINEL);
});

test('the reaction studio redraws when what a reaction points at changes', () => {
  const ui = reactionStudio();
  ui.studio.render();
  assert.match(ui.listHost.innerHTML, /A reaction shows an expression or a motion/, 'nothing to point at yet');

  // Authoring an expression elsewhere changes both the gate and the Inspector's
  // options, and both are in the model.
  ui.addExpression('happy', 'Happy');
  assert.equal(ui.studio.render(), true);
  assert.doesNotMatch(ui.listHost.innerHTML, /A reaction shows an expression or a motion/);

  ui.submit();
  assert.equal(ui.reactions().length, 0, 'an empty name authors nothing');
  ui.type('Surprise');
  ui.submit();
  assert.deepEqual(ui.reactions().map((item) => item.name), ['Surprise']);
  assert.equal(ui.listHost.dataset.reactionsCount, '1');
  assert.match(ui.listHost.innerHTML, /When clicked → Happy/, 'the row describes what it does');
  assert.equal(ui.inspectorHost.dataset.reactionId, ui.reactions()[0].id);
  assert.equal(ui.studio.render(), false);

  // A field only the Inspector shows: the priority under Advanced is in no list
  // row, so nothing but the detail signature carries it.
  ui.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { reactionPriority: '' }, value: '3' }) });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.inspectorHost.innerHTML, /data-reaction-priority aria-label="Priority" step="1" value="3"/);

  // And a reaction the author is *not* editing: switched off from the list, it
  // is one row the Inspector never mentions.
  ui.type('Wave');
  ui.submit();
  assert.equal(ui.inspectorHost.dataset.reactionId, 'wave', 'creating selects the new one');
  ui.listHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { reactionToggle: 'surprise' }, checked: false }) });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.listHost.innerHTML, /When clicked → Happy → off/);

  // An expression no reaction points at is still one of the Inspector's
  // options, and nothing else in this panel mentions it.
  ui.addExpression('zebra', 'Zebra');
  assert.equal(ui.studio.render(), true);
  ui.store.execute({ type: 'expressions/rename', domains: ['expressions'], source: 'test', apply: (document) => { document.expressions.at(-1).name = 'Zorro'; } });
  assert.equal(ui.studio.render(), true, 'a renamed option is a different Inspector');
  assert.match(ui.inspectorHost.innerHTML, /<option value="zebra" >Zorro<\/option>/);

  // Renaming the expression the reaction points at moves the row's description
  // and the Inspector's `<select>`, and nothing in the reaction itself.
  ui.store.execute({ type: 'expressions/rename', domains: ['expressions'], source: 'test', apply: (document) => { document.expressions[0].name = 'Delighted'; } });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.listHost.innerHTML, /When clicked → Delighted/);
  assert.match(ui.inspectorHost.innerHTML, /Delighted/);

  // And deleting it leaves a reaction that points at nothing, which the row,
  // the guidance and the Inspector all say.
  ui.store.execute({ type: 'expressions/remove', domains: ['expressions'], source: 'test', apply: (document) => { document.expressions.length = 0; } });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.listHost.innerHTML, /data-reaction-issue="true"/);
  assert.match(ui.inspectorHost.innerHTML, /no longer exists/);
});

test('the reaction studio offers a gesture as soon as the hand has a pose', () => {
  const ui = reactionStudio();
  ui.addExpression('happy', 'Happy');
  ui.studio.render();
  ui.type('Wave hello');
  ui.submit();
  assert.match(ui.inspectorHost.innerHTML, /data-reaction-gestures="none"/, 'no hand, nothing to raise');

  // The poses live outside everything else this panel shows, so nothing but
  // their own signature can put the checkboxes on screen.
  ui.store.execute({ type: 'hands/pose', domains: ['hands'], source: 'test', apply: (document) => { document.hands = { right: { poses: [{ id: 'wave', name: 'Wave' }] } }; } });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.inspectorHost.innerHTML, /data-reaction-gesture="right:wave"/);
  assert.match(ui.inspectorHost.innerHTML, /Right · Wave/);

  // Renaming the pose leaves the same number of checkboxes and a different
  // label on one of them.
  ui.store.execute({ type: 'hands/pose', domains: ['hands'], source: 'test', apply: (document) => { document.hands.right.poses[0].name = 'Big wave'; } });
  assert.equal(ui.studio.render(), true);
  assert.match(ui.inspectorHost.innerHTML, /Right · Big wave/);
});

test('an unrelated update leaves the reaction studio exactly as the author left it', () => {
  const ui = reactionStudio();
  ui.addExpression('happy', 'Happy');
  ui.studio.render();
  ui.type('Wave hello');
  ui.addExpression('sad', 'Sad');
  assert.equal(ui.studio.render(), true, 'a second expression is a different set of options');
  assert.match(ui.listHost.innerHTML, /value="Wave hello"/, 'and the half-typed name survived a redraw it did not ask for');
  ui.submit();
  assert.equal(ui.reactions().length, 1);
  assert.doesNotMatch(ui.listHost.innerHTML, /value="Wave hello"/, 'and the field it came from is empty again');

  // The disclosure is the one that bit: ticking Enabled inside Advanced used to
  // close Advanced, because the rebuilt markup did not know it was open.
  ui.openAdvanced();
  ui.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { reactionEnabled: '' }, checked: false }) });
  assert.equal(ui.studio.render(), true, 'disabling a reaction is a different list row');
  assert.match(ui.inspectorHost.innerHTML, /data-keep-open="advanced" open/, 'and Advanced is still open under the tick');
});

test('a warning the reaction studio invented itself still reaches the screen', () => {
  const ui = reactionStudio();
  ui.addExpression('happy', 'Happy');
  ui.studio.render();
  const renders = ui.studio.counters().renders;

  // A preset that needs a face and a motion this project has not got authors
  // nothing at all: no document, no session, no preview. Only the model can put
  // the reason on screen.
  ui.click({ reactionPresetAdd: 'surprise' });
  assert.deepEqual(ui.reactions(), []);
  assert.equal(ui.studio.counters().renders, renders + 1);
  assert.match(ui.listHost.innerHTML, /Surprise needs a surprised expression or a head pop motion/);
});

test('destroying the reaction studio takes all nine listeners with it', () => {
  const ui = reactionStudio();
  ui.studio.render();
  assert.equal(ui.listHost.listenerCount(), 5, 'submit, input, change, click and the preset groups own toggle');
  assert.equal(ui.inspectorHost.listenerCount(), 4, 'click, input, change and the toggle that remembers Advanced');
  ui.addExpression('happy', 'Happy');
  ui.studio.render();
  ui.type('Surprise');
  ui.submit();
  assert.equal(ui.reactions().length, 1);

  assert.equal(ui.studio.destroy(), true);
  assert.equal(ui.listHost.listenerCount(), 0);
  assert.equal(ui.inspectorHost.listenerCount(), 0, 'including the capture-phase toggle on the second host');
  assert.equal(ui.listHost.innerHTML, '');
  assert.equal(ui.inspectorHost.innerHTML, '');

  const before = ui.studio.counters();
  ui.clickInspector({ reactionTest: '' });
  ui.clickInspector({ reactionDelete: '' });
  ui.type('Another');
  assert.equal(ui.reactions().length, 1, 'a destroyed studio fires nothing and deletes nothing');
  assert.deepEqual(ui.preview.calls.filter(([name]) => name === 'fireReaction'), []);
  assert.deepEqual(ui.studio.counters(), before);
  assert.throws(() => ui.studio.render(), /destroyed: create a new one/);
});

test('the reaction studio still leaves and reports the way the editor asks it to', () => {
  const ui = reactionStudio();
  ui.addExpression('happy', 'Happy');
  ui.studio.render();
  ui.type('Surprise');
  ui.submit();
  const id = ui.reactions()[0].id;
  assert.deepEqual(ui.studio.snapshot(), {
    activeId: id,
    reactions: [{ id, name: 'Surprise', trigger: { type: 'click' }, expression: { id: 'happy', weight: 1 }, motion: null, timing: 'normal', issue: null }]
  });

  ui.clickInspector({ reactionTest: '' });
  assert.equal(ui.preview.getActiveReaction(), id);

  // `leave` clears what Test left running. It is deliberately *not* `hide()`:
  // `WORKSPACE_OCCUPANTS` gives this panel no `onEnter`, so a hidden panel
  // would never be shown again.
  const drawn = ui.studio.counters().renders;
  ui.studio.leave();
  assert.equal(ui.preview.getActiveReaction(), null);
  ui.store.execute({ type: 'reactions/rename', domains: ['reactions'], source: 'test', apply: (document) => { document.reactions[0].name = 'Wow'; } });
  assert.equal(ui.studio.render(), true, 'and it keeps rendering after leaving');
  assert.equal(ui.studio.counters().renders, drawn + 1);
  assert.match(ui.listHost.innerHTML, /Wow/);
});

test('a hidden expression studio still says how many expressions it holds', () => {
  // What `hide()` defers is the markup, not the truth. The stress suite grows a
  // project from another workspace and then reads this attribute; a studio that
  // stopped answering while hidden would be lying rather than saving work.
  const ui = expressionStudio();
  ui.studio.render();
  assert.equal(ui.listHost.dataset.expressionsReady, 'true');
  const before = ui.listHost.dataset.expressionsCount;
  ui.studio.leave();
  ui.store.execute({ type: 'test/expressions', domains: ['expressions'], source: 'test', apply: (document) => {
    document.expressions = [{ id: 'happy', name: 'Happy', controls: {} }, { id: 'sad', name: 'Sad', controls: {} }];
  } });
  ui.studio.render();
  assert.notEqual(ui.listHost.dataset.expressionsCount, before, 'the readout went stale while the studio was hidden');
  assert.equal(ui.listHost.dataset.expressionsCount, '2');
});
