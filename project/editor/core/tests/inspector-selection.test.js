import test from 'node:test';
import assert from 'node:assert/strict';
import { createContextInspector, resolveInspectorPresentation } from '../../ui/context-inspector.js';
import { resolveSelectionContext } from '../../ui/selection-context.js';
import { createEditorContext } from '../../ui/editor-context.js';
import { createInspector, inspectorSubject } from '../../inspector/inspector.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { createEditorStore } from '../state/editor-store.js';
import { createCleanProjectState } from '../state/store.js';
import { createHistory } from '../undo/history.js';
import { createStateMachinePanel } from '../../animation-editor/state-machine/state-machine-panel.js';
import { installStubDom } from './helpers/stub-dom.js';

/**
 * The inspector follows the selection and nothing else (VNX-11,
 * docs/VNEXT_ROADMAP.md).
 *
 * The roadmap's complaint is that clicking the mouth should give a Mouth
 * inspector and never a generic list of parameters, so the deliverable is a
 * table: for every thing the author can select, which adapter the Properties
 * column reveals, what its heading says, and — where no adapter answers yet —
 * that the column still names what was picked instead of going blank.
 *
 * Three rows are deliberately negative. A rig handle, a hand and a warp are
 * selectable on screen and reach the inspector through nothing at all; they are
 * pinned as they behave today so that wiring them is a test that flips rather
 * than a test that appears.
 *
 * DOM-less, like `studio-lifecycle.test.js`: a host is an object with the
 * handful of properties the panels touch.
 */

/** The shell's inspector section: a heading, an empty line and five adapters. */
function inspectorRoot() {
  const heading = { textContent: '' };
  const empty = { textContent: '', hidden: false };
  const adapters = ['semantic', 'artwork', 'expression', 'motion', 'reaction'].map((kind) => ({ dataset: { inspectorAdapter: kind }, hidden: false }));
  return {
    innerHTML: 'the shell markup this section is made of',
    hidden: false, dataset: {}, heading, empty,
    querySelector: (selector) => (selector === '[data-context-inspector-heading]' ? heading : selector === '[data-context-inspector-empty]' ? empty : null),
    querySelectorAll: () => adapters,
    addEventListener() { throw new Error('the context inspector registers no listeners'); },
    removeEventListener() {},
    shown: () => adapters.filter((adapter) => !adapter.hidden).map((adapter) => adapter.dataset.inspectorAdapter)
  };
}

/** One inspector, on one task, showing one session. */
function showing(task, session) {
  const root = inspectorRoot();
  const editorContext = createEditorContext('create');
  editorContext.update(session);
  const inspector = createContextInspector(root, editorContext, () => task);
  const context = inspector.render();
  return { root, context, editorContext, inspector };
}

/**
 * The audit, as a table. `session` is what the click actually writes, taken
 * from the panel that writes it, so a row proves the whole path from the
 * author's click to the revealed adapter.
 */
const SELECTIONS = [
  {
    what: 'an artwork element clicked on the canvas',
    where: 'svg-canvas.js writes session.selectedId on element click',
    task: 'artwork', session: { selectedId: 'mouth' },
    context: { kind: 'artwork', id: 'mouth' }, id: 'mouth',
    heading: 'Artwork Inspector', adapters: ['artwork'], empty: ''
  },
  {
    // The same context on purpose: the Structure column and the canvas are two
    // doors onto one selection, not two selections.
    what: 'a layer row in the Structure column',
    where: 'layers-panel.js writes the same session.selectedId',
    task: 'artwork', session: { selectedId: 'mouth' },
    context: { kind: 'artwork', id: 'mouth' }, id: 'mouth',
    heading: 'Artwork Inspector', adapters: ['artwork'], empty: ''
  },
  {
    what: 'a semantic part',
    where: 'rig-panel.js / face-setup-panel.js write activeSemanticPartId',
    task: 'face-setup', session: { activeSemanticPartId: 'mouth' },
    context: { kind: 'semantic-part', id: 'mouth' }, id: 'mouth',
    heading: 'Face Part Inspector', adapters: ['semantic'], empty: ''
  },
  {
    what: 'a semantic control',
    where: 'face-movements-panel.js / rig-panel.js write activeControl beside the part',
    task: 'face-setup', session: { activeSemanticPartId: 'mouth', activeControl: 'smile' },
    context: { kind: 'semantic-control', part: 'mouth', control: 'smile' }, id: 'mouth',
    heading: 'Movement Inspector', adapters: ['semantic'], empty: ''
  },
  {
    what: 'an expression',
    where: 'expression-studio.js writes activeExpressionId',
    task: 'expressions', session: { activeExpressionId: 'happy' },
    context: { kind: 'expression', id: 'happy' }, id: 'happy',
    heading: 'Expression Inspector', adapters: ['expression'], empty: ''
  },
  {
    what: 'a motion clip',
    where: 'motion-studio.js and the timeline navigator write animationEditor.activeClipId',
    task: 'animate', session: { animationEditor: { activeClipId: 'nod' } },
    context: { kind: 'clip', id: 'nod' }, id: 'nod',
    heading: 'Motion Inspector', adapters: ['motion'], empty: ''
  },
  {
    what: 'a reaction',
    where: 'reaction-studio.js writes activeReactionId',
    task: 'reactions', session: { activeReactionId: 'onClick' },
    context: { kind: 'reaction', id: 'onClick' }, id: 'onClick',
    heading: 'Reaction Inspector', adapters: ['reaction'], empty: ''
  },
  {
    what: 'a timeline track',
    where: 'timeline-panel.js writes selectedTrackParameter when a key is pressed',
    task: 'animate', session: { selectedTrackParameter: 'mouthOpen' },
    context: { kind: 'timeline-track', parameter: 'mouthOpen' }, id: 'mouthOpen',
    heading: 'Motion Inspector', adapters: ['motion'], empty: ''
  },
  {
    // Reachable only through a route target today; see the timeline test below.
    what: 'a timeline key',
    where: 'selectionPatchForTarget writes selectedKey; no panel does',
    task: 'animate', session: { selectedKey: { parameter: 'mouthOpen', time: 0.12 } },
    context: { kind: 'timeline-key', parameter: 'mouthOpen', time: 0.12 }, id: 'mouthOpen',
    heading: 'Motion Inspector', adapters: ['motion'], empty: ''
  },
  {
    // The gap this change closes: a heading with nothing under it.
    what: 'a state',
    where: 'state-machine-panel.js writes activeStateId',
    task: 'animate', session: { activeStateId: 'idle' },
    context: { kind: 'state', id: 'idle' }, id: 'idle',
    heading: 'State Inspector', adapters: [],
    empty: 'State “idle” is edited in the State machine, in the left column.'
  }
];

test('every selection the editor supports reveals the one adapter that names it, and no other', () => {
  for (const row of SELECTIONS) {
    const ui = showing(row.task, row.session);
    assert.deepEqual(ui.context, row.context, `${row.what} resolves to its own context (${row.where})`);
    assert.equal(ui.root.dataset.contextKind, row.context.kind, `${row.what} publishes its kind for the sheet and the e2e hooks`);
    assert.equal(ui.root.dataset.contextId, row.id, `${row.what} publishes what was selected`);
    assert.deepEqual(ui.root.shown(), row.adapters, `${row.what} reveals exactly ${row.adapters.join(', ') || 'no adapter'}`);
    assert.equal(ui.root.heading.textContent, row.heading, `${row.what} is announced as ${row.heading}`);
    assert.equal(ui.root.empty.textContent, row.empty, `${row.what} says the right thing on the empty line`);
    assert.equal(ui.root.hidden, false, `${row.what} leaves the inspector on screen`);
  }
});

test('a selection with no adapter of its own is still named, never left under an empty heading', () => {
  // The rule, over every kind the resolver can produce: an adapter is on, or
  // the empty line says what is selected. Both false is the VNX-11 failure.
  const kinds = ['artwork', 'semantic-part', 'semantic-control', 'expression', 'reaction', 'clip', 'timeline-track', 'timeline-key', 'state'];
  for (const task of ['artwork', 'face-setup', 'expressions', 'animate', 'reactions']) {
    for (const kind of kinds) {
      const view = resolveInspectorPresentation(task, { kind, id: 'thing', parameter: 'thing' });
      const adapted = view.artwork || view.semantic || view.expression || view.motion || view.reaction;
      assert.ok(adapted || view.emptyCopy, `${kind} in ${task} either has an adapter or says why not`);
      assert.notEqual(view.heading, 'Inspector', `${kind} is announced as itself, whatever task is open`);
    }
  }
  // The generic half of that rule names the selection rather than the task.
  assert.equal(resolveInspectorPresentation('artwork', { kind: 'clip', id: 'nod' }).emptyCopy, 'The motion “nod” has no editor in this panel yet.');
  assert.equal(resolveInspectorPresentation('face-setup', { kind: 'timeline-key', parameter: 'mouthOpen' }).emptyCopy, 'The keyframe “mouthOpen” has no editor in this panel yet.');
  // Nothing selected keeps the task's invitation, which is a different sentence.
  assert.equal(resolveInspectorPresentation('artwork', { kind: 'none' }).emptyCopy, 'Select an element on the canvas to edit it.');
  assert.equal(resolveInspectorPresentation('animate', { kind: 'none' }).emptyCopy, 'Add a motion preset or select an animation to edit it.');
  assert.equal(resolveInspectorPresentation('face-setup', { kind: 'none' }).emptyCopy, '', 'Face Setup hands an empty task to the rig panel, which has its own first-run copy');
});

test('a rig handle, a hand and a warp are selectable on screen and reach the inspector through nothing', () => {
  // Pinned as they behave, not as they should: each of these needs a file this
  // change may not touch, and the report says which one.

  // A control-board or canvas handle: editor-app.js keeps `selectedHandles` in
  // a module variable and hands it to the canvas. The session never hears.
  const handle = showing('face-setup', { activeSemanticPartId: 'mouth' });
  assert.deepEqual(handle.context, { kind: 'semantic-part', id: 'mouth' }, 'selecting a handle leaves the previous context standing');
  assert.deepEqual(handle.root.shown(), ['semantic']);

  // Hand Setup's Select button: it writes the hand's artwork id, and Face Setup
  // reads parts, not artwork, so the column keeps showing the last face part.
  const hand = showing('face-setup', { activeSemanticPartId: 'mouth', selectedId: 'handLeft' });
  assert.deepEqual(hand.context, { kind: 'semantic-part', id: 'mouth' }, 'the hand is selected, the inspector is not told');
  assert.equal(hand.root.heading.textContent, 'Face Part Inspector');

  // A warp has no selection at all: the list lives in the left column and picks
  // its subject from the artwork selection.
  const warp = showing('face-setup', { activeSemanticPartId: 'mouth', activeControl: null });
  assert.equal(warp.context.kind, 'semantic-part');
});

test('a timeline key click lands on its track, because nothing in the editor writes the selected key', () => {
  // What timeline-panel.js actually writes when a key is pressed: the track,
  // the movement and its part — never `selectedKey`.
  const afterKeyClick = { selectedTrackParameter: 'mouthOpen', activeControl: 'mouthOpen', activeSemanticPartId: 'mouth' };
  assert.deepEqual(resolveSelectionContext(afterKeyClick, 'animate'), { kind: 'timeline-track', parameter: 'mouthOpen' });

  // And the track outranks a state chosen afterwards, because nothing clears it
  // the way motion-studio clears the state.
  assert.equal(resolveSelectionContext({ ...afterKeyClick, activeStateId: 'idle' }, 'animate').kind, 'timeline-track');
  assert.equal(resolveSelectionContext({ activeStateId: 'idle' }, 'animate').kind, 'state');
});

test('Preview has no inspector, and the panel says so by hiding rather than by emptying', () => {
  const ui = showing('preview', { selectedId: 'mouth' });
  assert.equal(ui.root.hidden, true);
  assert.deepEqual(ui.context, { kind: 'none', task: 'preview' });
  assert.deepEqual(ui.root.shown(), []);
});

// ---------------------------------------------------------------------------
// The artwork adapter: the generic list the roadmap complains about
// ---------------------------------------------------------------------------

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, morph: {}, meta: { nodeType: 'path' } });
const layer = (id) => ({ id, name: id, type: 'path', visible: true, children: [] });
const ARTWORK = ['head', 'mouth', 'sparkle'];

/** A face with one rigged mouth, one rigged head and one piece nobody uses. */
function riggedStore() {
  const store = createEditorStore({
    svgMarkup: '<svg><path id="mouth" d="M0 0"/></svg>',
    elements: Object.fromEntries(ARTWORK.map((id) => [id, element()])), layers: ARTWORK.map(layer),
    layerMetadata: { mouth: { name: 'Smile shape' }, sparkle: { name: 'Sparkle' } },
    semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', transitions: {},
    animationClips: [], behaviors: [], expressions: [], reactions: []
  });
  const history = createHistory(store);
  createSemanticRigCommands(store, history).assignFaceRoles([
    { type: 'head', role: 'head', elementId: 'head' }, { type: 'mouth', role: 'mouth', elementId: 'mouth' }
  ]);
  return { store, history };
}

/** The artwork adapter's host: it listens, it is written to, it reads nothing back. */
const fakeHost = () => ({ innerHTML: '', addEventListener() {}, querySelector: () => null });

function artworkInspector(selectedId) {
  const { store, history } = riggedStore();
  store.mutateSession('selectedId', (session) => { session.selectedId = selectedId; });
  const host = fakeHost();
  createInspector(host, store, history, { getNode: () => null, applyElementTransform() {}, setAppearance() {} }).render();
  return host.innerHTML;
}

test('the artwork inspector names the face part a piece plays, not only its SVG id', () => {
  const { store } = riggedStore();
  assert.deepEqual(inspectorSubject(store.getDocument(), 'mouth'), { name: 'Smile shape', part: 'Mouth', role: 'mouth' });
  const html = artworkInspector('mouth');
  assert.match(html, /Smile shape/, 'the piece is called what the author called it');
  assert.match(html, /semantic-badge">Mouth</, 'and the part it plays is on the same line as the numbers it drives');
  assert.doesNotMatch(html, /Mouth · Mouth/, 'a role that repeats the part name is not said twice');
  assert.match(html, /Transform/, 'the parameter list is still there — this routes it, it does not replace it');
});

test('artwork that plays no role says so, instead of leaving the author to guess', () => {
  const html = artworkInspector('sparkle');
  assert.match(html, /Sparkle/);
  assert.match(html, /No face part uses this piece/);
  assert.doesNotMatch(html, /semantic-badge/, 'no badge is invented for a piece with no part');
});

test('a selection the artwork inspector cannot edit is named rather than denied', () => {
  const { store, history } = riggedStore();
  store.mutateSession('selectedId', (session) => { session.selectedId = 'ghost'; });
  const host = fakeHost();
  createInspector(host, store, history, { getNode: () => null }).render();
  assert.match(host.innerHTML, /“ghost” is selected/, 'the panel does not tell the author to select something while something is selected');

  store.mutateSession('selectedId', (session) => { session.selectedId = null; });
  const empty = fakeHost();
  createInspector(empty, store, history, { getNode: () => null }).render();
  assert.match(empty.innerHTML, /Select an element on the canvas or in Layers/);
});


installStubDom();

/**
 * The precedence bug recorded in docs/VNEXT_INSPECTOR.md: the inspector reads
 * `selectedTrackParameter` ahead of `activeStateId`, and only the motion studio
 * ever cleared it. A track clicked earlier therefore masked a state clicked
 * later, and the Properties column kept showing the clip.
 */
test('selecting a state clears a track selected earlier, so the inspector follows the author', () => {
  const initial = createCleanProjectState();
  initial.params.x = { min: -1, max: 1, default: 0, value: 0 };
  initial.states = { idle: { x: 0 }, happy: { x: 1 } };
  initial.transitions = { idle: [], happy: [] };
  initial.activeState = 'idle';
  const store = createEditorStore(initial);
  const context = createEditorContext('animate', store);
  context.update({ selectedTrackParameter: 'x', selectedKey: { parameter: 'x', time: 0.5 } });

  const editor = document.createElementNS('', 'div');
  editor.id = 'state-editor';
  const sidebar = document.createElementNS('', 'div');
  sidebar.querySelector = (selector) => (selector === '#state-editor' ? editor : null);
  createStateMachinePanel(sidebar, store, createHistory(store), null, context);

  // The panel's own selector is a comma-separated list, which the shared
  // `clickTarget` stub deliberately does not model; what is under test is what
  // the handler does once it has found the row, so the row answers directly.
  const row = { dataset: { selectState: 'happy' } };
  row.closest = () => row;
  editor.dispatch('click', { target: row });

  assert.equal(context.get().activeStateId, 'happy');
  assert.equal(context.get().selectedTrackParameter, null, 'the stale track still outranks the state');
  assert.equal(context.get().selectedKey, null);
});
