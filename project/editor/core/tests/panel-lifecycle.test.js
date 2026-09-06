import test from 'node:test';
import assert from 'node:assert/strict';
import { clickTarget } from './helpers/stub-dom.js';
import { createAutomaticPanel } from '../../ui/automatic-panel.js';
import { createWarpPanel } from '../../rig-editor/warp/warp-panel.js';
import { deriveAutomaticStatus } from '../behaviors/automatic-presets.js';
import { createWarpCommands } from '../warp/warp-commands.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSampleProject } from '../state/store.js';

/**
 * The panels of VNX-03 step 2 — the automatic panel and the warp panel —
 * behind the component lifecycle (docs/VNEXT_COMPONENTS.md).
 *
 * What is worth proving is not the markup, which each panel's own test already
 * covers, but the two promises the lifecycle adds on top of it: an unchanged
 * model costs a comparison instead of a render, and `destroy()` actually lets
 * go. The third promise — that a panel's own UI state has to be part of the
 * model it hands the component, or an unrelated keystroke folds it away — was
 * pinned by the guide bar, which the workspace no longer carries.
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
  const automatic = automaticPanel();
  automatic.panel.render();
  automatic.panel.destroy();
  assert.throws(() => automatic.panel.render(), /destroyed: create a new one/);

  const warp = warpPanel();
  warp.panel.render();
  warp.panel.destroy();
  assert.throws(() => warp.panel.render(), /destroyed: create a new one/);

  // Destroy itself is idempotent, so tearing a workspace down twice is safe.
  assert.equal(automatic.panel.destroy(), false);
  assert.equal(warp.panel.destroy(), false);
});
