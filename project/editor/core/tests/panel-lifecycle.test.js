import test from 'node:test';
import assert from 'node:assert/strict';
import { clickTarget } from './helpers/stub-dom.js';
import { createGuideBar } from '../../ui/guide-bar.js';
import { createAutomaticPanel } from '../../ui/automatic-panel.js';
import { createWarpPanel } from '../../rig-editor/warp/warp-panel.js';
import { deriveGuide } from '../validation/guide.js';
import { deriveAutomaticStatus } from '../behaviors/automatic-presets.js';
import { createWarpCommands } from '../warp/warp-commands.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSampleProject } from '../state/store.js';

/**
 * The three panels of VNX-03 step 2 — guide bar, automatic panel, warp panel —
 * behind the component lifecycle (docs/VNEXT_COMPONENTS.md).
 *
 * What is worth proving is not the markup, which each panel's own test already
 * covers, but the two promises the lifecycle adds on top of it: an unchanged
 * model costs a comparison instead of a render, and `destroy()` actually lets
 * go. The trap is the third: a panel that keeps UI state of its own — the guide
 * bar's expanded list — folds itself up on the next unrelated keystroke unless
 * that state is part of the model it hands the component.
 *
 * These run in Node with no DOM, like `ui-component.test.js`: a host is an
 * object with the handful of properties the panels touch, which keeps the
 * coupling visible rather than hidden behind a browser.
 */
function fakeHost() {
  const listeners = new Map();
  const host = {
    innerHTML: '',
    hidden: false,
    dataset: {},
    // The automatic panel checks that the button a click landed on is one of
    // its own before acting on it; here every button is.
    contains: () => true,
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    dispatch(type, event = {}) { for (const handler of [...(listeners.get(type) || [])]) handler({ type, target: host, preventDefault() {}, ...event }); },
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0)
  };
  return host;
}

// A render leaves markup behind; a skipped one must leave this untouched. It is
// the DOM-side proof of what `counters()` reports as a number.
const SENTINEL = 'the last render, still on screen';

// ---------------------------------------------------------------------------
// Guide bar
// ---------------------------------------------------------------------------

/** A readiness model with nothing wrong, so a test can move one field at a time. */
const readiness = () => ({
  faceSetup: { status: 'todo' }, movements: { status: 'todo' },
  export: { status: 'warning', summary: '', route: { task: 'preview' } }
});

function guideBar({ project = { svgMarkup: '<svg/>' } } = {}) {
  const host = fakeHost();
  const routes = [];
  let document = project;
  let dismissed = false;
  let derived = 0;
  const bar = createGuideBar(host, {
    // Derived afresh on every pass, which is the case that matters: every step
    // is a new object, so nothing but the model's signature can make two
    // identical journeys compare equal.
    guide: () => { derived += 1; return deriveGuide(document, readiness()); },
    navigate: (route) => routes.push(route),
    isDismissed: () => dismissed,
    setDismissed: (value) => { dismissed = value; }
  });
  return {
    host, bar, routes,
    click: (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) }),
    setProject: (next) => { document = next; },
    get derived() { return derived; },
    get dismissed() { return dismissed; }
  };
}

test('the guide bar compares a rebuilt journey instead of redrawing it', () => {
  const ui = guideBar();
  assert.equal(ui.bar.render(), true, 'the first render is the mount');
  assert.deepEqual(ui.bar.counters(), { renders: 1, skipped: 0 });

  ui.host.innerHTML = SENTINEL;
  for (let pass = 0; pass < 6; pass += 1) assert.equal(ui.bar.render(), false);
  assert.deepEqual(ui.bar.counters(), { renders: 1, skipped: 6 }, 'six validation passes, no DOM');
  assert.equal(ui.host.innerHTML, SENTINEL, 'and the markup from the first render was never rebuilt');
  assert.equal(ui.derived, 7, 'the guide really was re-derived each time — new step objects every pass');
});

test('the guide bar redraws as soon as the journey moves', () => {
  const ui = guideBar();
  ui.bar.render();
  assert.match(ui.host.innerHTML, /Assign the face parts/);
  assert.equal(ui.host.dataset.guideDone, '1');

  ui.setProject({ svgMarkup: '<svg/>', expressions: [{ id: 'happy' }] });
  assert.equal(ui.bar.render(), true, 'a finished step is a different journey');
  assert.equal(ui.bar.counters().renders, 2);
  assert.equal(ui.host.dataset.guideDone, '3', 'the expression finished its own step and reached Try it out');
});

test('an unrelated update leaves the guide bar exactly as expanded as the user left it', () => {
  const ui = guideBar();
  ui.bar.render();
  assert.equal(ui.host.dataset.guideExpanded, 'false');
  assert.doesNotMatch(ui.host.innerHTML, /guide-steps/, 'the whole journey stays collapsed until asked for');

  // Opening the list is a render even though no project data moved: `expanded`
  // is in the model, so the component can see it change.
  ui.click({ guideAction: 'toggle' });
  assert.equal(ui.bar.expanded, true);
  assert.equal(ui.bar.counters().renders, 2);
  assert.match(ui.host.innerHTML, /guide-steps/);

  // The trap. A validation pass has nothing to do with the list the user just
  // opened; if `expanded` were not part of the model, this render would derive
  // the collapsed markup and fold the list up under their hand.
  ui.setProject({ svgMarkup: '<svg/>', expressions: [{ id: 'happy' }] });
  assert.equal(ui.bar.render(), true);
  assert.equal(ui.bar.expanded, true, 'the panel still believes it is open');
  assert.equal(ui.host.dataset.guideExpanded, 'true');
  assert.match(ui.host.innerHTML, /guide-steps/, 'and the list is still on screen, in the redrawn markup');

  // The other direction is the same promise: an update must not open a list
  // nobody asked for.
  ui.click({ guideAction: 'toggle' });
  assert.equal(ui.bar.expanded, false);
  assert.doesNotMatch(ui.host.innerHTML, /guide-steps/);
  ui.setProject({ svgMarkup: '<svg/>', expressions: [{ id: 'happy' }], animationClips: [{ id: 'nod' }] });
  assert.equal(ui.bar.render(), true);
  assert.equal(ui.host.dataset.guideExpanded, 'false');
  assert.doesNotMatch(ui.host.innerHTML, /guide-steps/, 'a collapsed bar stays collapsed across a redraw');
});

test('the guide bar keeps its dismissed state across an unrelated update too', () => {
  const ui = guideBar();
  ui.bar.render();
  ui.click({ guideAction: 'dismiss' });
  assert.equal(ui.dismissed, true);
  assert.match(ui.host.innerHTML, /guide-restore/);

  ui.setProject({ svgMarkup: '<svg/>', expressions: [{ id: 'happy' }] });
  ui.bar.render();
  assert.match(ui.host.innerHTML, /guide-restore/, 'the handle stays a handle; a redraw is not an undismiss');
  assert.match(ui.host.innerHTML, /Steps 3\/10/, 'and it still counts the journey behind it');
});

test('destroying the guide bar takes its click listener with it', () => {
  const ui = guideBar();
  ui.bar.render();
  assert.equal(ui.host.listenerCount(), 1);
  ui.click({ guideAction: 'go', guideStep: 'face-parts' });
  assert.deepEqual(ui.routes, [{ task: 'face-setup', focus: 'face-setup-checklist' }]);

  const before = ui.bar.counters();
  assert.equal(ui.bar.destroy(), true);
  assert.equal(ui.host.listenerCount(), 0);
  assert.equal(ui.host.innerHTML, '', 'the markup goes with the listeners');

  ui.click({ guideAction: 'toggle' });
  ui.click({ guideAction: 'go', guideStep: 'movements' });
  ui.click({ guideAction: 'dismiss' });
  assert.deepEqual(ui.routes, [{ task: 'face-setup', focus: 'face-setup-checklist' }], 'a destroyed bar navigates nowhere');
  assert.equal(ui.bar.expanded, false);
  assert.equal(ui.dismissed, false);
  assert.deepEqual(ui.bar.counters(), before, 'and nothing was rendered');
  assert.equal(ui.host.innerHTML, '');
});

test('the guide bar still renders, reports and expands the way the editor asks it to', () => {
  const ui = guideBar();
  assert.equal(ui.bar.expanded, false, 'the journey starts collapsed');
  assert.equal(ui.bar.render(), true);

  assert.equal(ui.bar.expand(), true, 'expanding from the outside is a redraw, like the toggle');
  assert.equal(ui.bar.expanded, true);
  assert.match(ui.host.innerHTML, /guide-steps/);
  assert.equal(ui.bar.expand(), false, 'expanding an expanded bar has nothing left to draw');
  assert.equal(ui.bar.counters().renders, 2);

  // Every step is reachable from the open list, and the list closes behind it:
  // it covered the panel the click just opened.
  ui.click({ guideAction: 'go', guideStep: 'reactions' });
  assert.deepEqual(ui.routes, [{ task: 'reactions' }]);
  assert.equal(ui.bar.expanded, false);
});

// ---------------------------------------------------------------------------
// Automatic panel
// ---------------------------------------------------------------------------

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

const automaticProject = () => ({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>', elements: {}, layers: [], layerMetadata: {},
  params: { eyeOpen: number(0, 1, 1), lookX: number(-1, 1), lookY: number(-1, 1), headY: number(-1, 1) },
  states: { idle: { eyeOpen: 1, lookX: 0, lookY: 0, headY: 0 } }, activeState: 'idle', transitions: {},
  semanticParts: {}, animationClips: [], behaviors: [], expressions: [], reactions: []
});

function automaticPanel() {
  const host = fakeHost();
  const store = createEditorStore(automaticProject());
  const history = createHistory(store);
  const statuses = [];
  const tested = [];
  const opened = [];
  const panel = createAutomaticPanel(
    host, store, history,
    { testBehavior: (id) => { tested.push(id); return true; } },   // the preview, as far as this panel knows it
    { update: (context) => opened.push(context) },                 // the editor context, likewise
    { onStatus: (message) => statuses.push(message) }
  );
  return {
    host, store, history, panel, statuses, tested, opened,
    // The toggle handler authors behaviors but does not redraw: the store
    // notification does, which is `panel.render()` here.
    toggle: (id, checked) => host.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { automaticToggle: id }, checked }) }),
    click: (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) }),
    behaviors: () => store.getDocument().behaviors
  };
}

test('the automatic panel compares a rebuilt status instead of redrawing it', () => {
  const ui = automaticPanel();
  assert.equal(ui.panel.render(), true);
  assert.deepEqual(ui.panel.counters(), { renders: 1, skipped: 0 });

  ui.host.innerHTML = SENTINEL;
  for (let pass = 0; pass < 6; pass += 1) assert.equal(ui.panel.render(), false);
  assert.deepEqual(ui.panel.counters(), { renders: 1, skipped: 6 }, '`deriveAutomaticStatus` ran seven times and drew once');
  assert.equal(ui.host.innerHTML, SENTINEL);

  // A rig notification that changes nothing this panel shows — posing the idle
  // state — is exactly the keystroke the lifecycle exists to absorb.
  ui.store.execute({ type: 'state/pose', domains: ['rig'], source: 'test', apply: (document) => { document.states.idle.lookX = .4; } });
  assert.equal(ui.panel.render(), false);
  assert.equal(ui.host.innerHTML, SENTINEL, 'a pose is not an automatic preset');
});

test('the automatic panel redraws when a preset changes status', () => {
  const ui = automaticPanel();
  ui.panel.render();
  assert.equal(ui.host.dataset.automaticOn, '0');
  assert.match(ui.host.innerHTML, /data-automatic-card="blink"/);

  ui.toggle('blink', true);
  assert.deepEqual(ui.behaviors().map((item) => item.id), ['auto-blink'], 'the toggle authored an ordinary behavior');
  assert.deepEqual(ui.statuses, ['Blink turned on.']);
  assert.equal(ui.panel.render(), true, 'the notification that follows finds a different status');
  assert.equal(ui.panel.counters().renders, 2);
  assert.equal(ui.host.dataset.automaticOn, '1');
  assert.match(ui.host.innerHTML, /data-automatic-card="blink" data-automatic-status="on"/);
  assert.match(ui.host.innerHTML, /is on\. It runs in Preview/, 'the notice the toggle left is part of the model too');

  ui.toggle('blink', false);
  assert.equal(ui.panel.render(), true);
  assert.equal(ui.host.dataset.automaticOn, '0');
  assert.match(ui.host.innerHTML, /data-automatic-status="disabled"/, 'off but kept, so the tweaks survive');
});

test('destroying the automatic panel takes its change and click listeners with it', () => {
  const ui = automaticPanel();
  ui.panel.render();
  assert.equal(ui.host.listenerCount(), 2, 'one change listener, one click listener');
  ui.click({ automaticAdvanced: '' });
  assert.deepEqual(ui.opened, [{ authorMode: 'behaviors' }], 'the default openAdvanced goes through the editor context');

  assert.equal(ui.panel.destroy(), true);
  assert.equal(ui.host.listenerCount(), 0);
  assert.equal(ui.host.innerHTML, '');

  const before = ui.panel.counters();
  ui.toggle('natural-gaze', true);
  ui.click({ automaticAdvanced: '' });
  ui.click({ automaticTest: 'blink' });
  assert.deepEqual(ui.behaviors(), [], 'a destroyed panel authors nothing');
  assert.deepEqual(ui.opened, [{ authorMode: 'behaviors' }]);
  assert.deepEqual(ui.tested, []);
  assert.deepEqual(ui.panel.counters(), before);
});

test('the automatic panel still renders and reports its snapshot the way the editor asks it to', () => {
  const ui = automaticPanel();
  assert.equal(ui.panel.render(), true);
  assert.equal(ui.host.dataset.automaticReady, 'true');

  // `snapshot` is the panel's answer to "what is on?", read by the editor
  // rather than by the markup, and it is derived fresh rather than from the
  // model the component compares.
  assert.deepEqual(ui.panel.snapshot(), deriveAutomaticStatus(ui.store.getDocument()));
  assert.equal(ui.panel.snapshot().on, 0);
  ui.toggle('blink', true);
  assert.equal(ui.panel.snapshot().on, 1, 'and it is current even before the redraw');
  assert.deepEqual(ui.panel.snapshot().presets[0].behaviorIds, ['auto-blink']);
});

// ---------------------------------------------------------------------------
// Warp panel
// ---------------------------------------------------------------------------

const SQUARE = 'M0 0 L10 0 L10 10 L0 10 Z';
const BOX = { x: 0, y: 0, width: 10, height: 10 };

const warpProject = () => ({
  ...createSampleProject(),
  svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><path id="cheek"/></svg>',
  elements: { cheek: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, restPath: SQUARE } },
  warps: []
});

function warpPanel() {
  const host = fakeHost();
  const store = createEditorStore(warpProject());
  const history = createHistory(store);
  let selection = 'cheek';
  const panel = createWarpPanel(host, store, history, {
    selectedId: () => selection,
    geometry: () => BOX,
    pathOf: (id) => store.getDocument().elements?.[id]?.restPath || null
  });
  return {
    host, store, history, panel,
    click: (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) }),
    change: (dataset, value) => host.dispatch('change', { target: clickTarget({ tag: 'select', dataset, value }) }),
    select: (id) => { selection = id; },
    warps: () => store.getDocument().warps
  };
}

test('the warp panel compares a rebuilt document instead of redrawing it', () => {
  const ui = warpPanel();
  assert.equal(ui.panel.render(), true);
  ui.click({ warpAction: 'add' });
  assert.equal(ui.warps().length, 1);
  assert.deepEqual(ui.panel.counters(), { renders: 2, skipped: 0 });

  ui.host.innerHTML = SENTINEL;
  for (let pass = 0; pass < 6; pass += 1) assert.equal(ui.panel.render(), false);
  assert.deepEqual(ui.panel.counters(), { renders: 2, skipped: 6 });

  // The notification this panel was converted for: dragging a control point
  // notifies `keyforms` on every pointer move and changes not one character of
  // the list, which never mentions control points.
  const commands = createWarpCommands(ui.store, ui.history);
  for (let step = 1; step <= 5; step += 1) commands.movePoint(ui.warps()[0].id, 4, { x: step, y: step });
  for (let step = 1; step <= 5; step += 1) assert.equal(ui.panel.render(), false);
  assert.deepEqual(ui.warps()[0].grid.points[4], { x: 5, y: 5 }, 'the drag did land in the document');
  assert.deepEqual(ui.panel.counters(), { renders: 2, skipped: 11 });
  assert.equal(ui.host.innerHTML, SENTINEL, 'and the panel never noticed');
});

test('the warp panel redraws when the list it shows actually changes', () => {
  const ui = warpPanel();
  ui.panel.render();
  assert.equal(ui.host.dataset.warpCount, '0');

  ui.click({ warpAction: 'add' });
  assert.equal(ui.panel.counters().renders, 2);
  assert.equal(ui.host.dataset.warpCount, '1');
  assert.match(ui.host.innerHTML, /data-warp="/);
  assert.match(ui.host.innerHTML, /Drag its handles on the canvas/, 'the notice is part of the model, so it reaches the screen');

  // Retuning a warp's grid and giving it a driver are both in the signature.
  const id = ui.warps()[0].id;
  ui.change({ warpField: 'size', warpId: id }, '4');
  assert.equal(ui.panel.counters().renders, 3);
  assert.equal(ui.warps()[0].grid.columns, 4);
  ui.change({ warpField: 'driver', warpId: id }, 'headX');
  assert.equal(ui.panel.counters().renders, 4);
  assert.match(ui.host.innerHTML, /value="headX" selected/);

  // A different selection changes the Add button and its reason, both of which
  // the model carries.
  ui.select(null);
  assert.equal(ui.panel.render(), true);
  assert.match(ui.host.innerHTML, /Select a shape on the canvas first/);

  ui.click({ warpAction: 'remove', warpId: id });
  assert.deepEqual(ui.warps(), []);
  assert.equal(ui.host.dataset.warpCount, '0');
});

test('destroying the warp panel takes its click and change listeners with it', () => {
  const ui = warpPanel();
  ui.panel.render();
  assert.equal(ui.host.listenerCount(), 2, 'one click listener, one change listener');
  ui.click({ warpAction: 'add' });
  assert.equal(ui.warps().length, 1);

  assert.equal(ui.panel.destroy(), true);
  assert.equal(ui.host.listenerCount(), 0);
  assert.equal(ui.host.innerHTML, '');

  const before = ui.panel.counters();
  ui.click({ warpAction: 'remove', warpId: ui.warps()[0].id });
  ui.click({ warpAction: 'add' });
  ui.change({ warpField: 'size' }, '4');
  assert.equal(ui.warps().length, 1, 'a destroyed panel neither adds nor removes');
  assert.equal(ui.panel.getSize(), 3, 'nor retunes itself');
  assert.deepEqual(ui.panel.counters(), before);
  assert.equal(ui.host.innerHTML, '');
});

test('the warp panel still renders and reports its grid size the way the editor asks it to', () => {
  const ui = warpPanel();
  assert.equal(ui.panel.render(), true);
  assert.equal(ui.panel.getSize(), 3, 'the size for the next warp starts at the smallest grid');
  assert.match(ui.host.innerHTML, /<option value="3" selected>/);

  ui.change({ warpField: 'size' }, '4');
  assert.equal(ui.panel.getSize(), 4);
  assert.match(ui.host.innerHTML, /<option value="4" selected>/, 'the new size is panel state, so it has to be in the model');
  ui.click({ warpAction: 'add' });
  assert.equal(ui.warps()[0].grid.points.length, 16, 'and it is the size the warp is built at');
});

// ---------------------------------------------------------------------------
// The one they share
// ---------------------------------------------------------------------------

test('a destroyed panel throws rather than half-rendering when the editor calls it again', () => {
  // NOT a bug in these three: `createComponent` refuses to mount a destroyed
  // component on purpose, and `render()` is a mount until the panel is mounted.
  // It is pinned here because it is the trap VNX-56 inherits — `main.js` calls
  // `render()` on every panel on every notification, so whoever destroys a
  // workspace has to stop calling it in the same breath. `artboard-panel` (step
  // 1) behaves identically.
  const bar = guideBar();
  bar.bar.render();
  bar.bar.destroy();
  assert.throws(() => bar.bar.render(), /destroyed: create a new one/);

  const automatic = automaticPanel();
  automatic.panel.render();
  automatic.panel.destroy();
  assert.throws(() => automatic.panel.render(), /destroyed: create a new one/);

  const warp = warpPanel();
  warp.panel.render();
  warp.panel.destroy();
  assert.throws(() => warp.panel.render(), /destroyed: create a new one/);

  // Destroy itself is idempotent, so tearing a workspace down twice is safe.
  assert.equal(bar.bar.destroy(), false);
  assert.equal(automatic.panel.destroy(), false);
  assert.equal(warp.panel.destroy(), false);
});
