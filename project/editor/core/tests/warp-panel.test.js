import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createWarpPanel, warpEligibility } = await import('../../rig-editor/warp/warp-panel.js');
const { createWarpCommands } = await import('../warp/warp-commands.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createSampleProject } = await import('../state/store.js');
const { compileRigFrame } = await import('../../../runtime/runtime.js');

const SQUARE = 'M0 0 L10 0 L10 10 L0 10 Z';
const BOX = { x: 0, y: 0, width: 10, height: 10 };

const project = () => ({
  ...createSampleProject(),
  svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><path id="cheek"/><rect id="block"/></svg>',
  elements: { cheek: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, restPath: SQUARE }, block: { baseTransform: {} } },
  warps: []
});

function harness({ selected = 'cheek' } = {}) {
  const store = createEditorStore(project());
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  let selection = selected;
  const panel = createWarpPanel(host, store, history, {
    selectedId: () => selection,
    geometry: () => BOX,
    pathOf: (id) => store.getDocument().elements?.[id]?.restPath || null
  });
  panel.render();
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  const change = (dataset, value) => host.dispatch('change', { target: clickTarget({ tag: 'select', dataset, value }) });
  return { store, history, host, panel, click, change, select: (id) => { selection = id; panel.render(); }, warps: () => store.getDocument().warps };
}

test('the panel says what a warp is for, and when it is not the answer', () => {
  const it = harness();
  assert.equal(it.host.dataset.warpReady, 'true');
  assert.match(it.host.innerHTML, /cannot bend/);
  assert.match(it.host.innerHTML, /Everything else is better without one/);
});

test('eligibility explains itself rather than only disabling a button', () => {
  const document = project();
  assert.match(warpEligibility(document, null).message, /Select a shape/);
  assert.match(warpEligibility(document, 'ghost').message, /no longer exists/);
  assert.equal(warpEligibility(document, 'cheek').ok, true);
  const taken = { ...document, warps: [{ id: 'w', target: 'cheek' }] };
  assert.match(warpEligibility(taken, 'cheek').message, /already has a warp/);
});

test('adding a warp builds the rest lattice over the element box', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  const [warp] = it.warps();
  assert.equal(warp.target, 'cheek');
  assert.equal(warp.grid.points.length, 9);
  assert.deepEqual(warp.grid.points[0], { x: 0, y: 0 });
  assert.deepEqual(warp.grid.points[8], { x: 10, y: 10 });
  assert.equal(it.host.dataset.warpCount, '1');
  assert.match(it.host.innerHTML, /Drag its handles on the canvas/);
});

test('adding is one undo step', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  it.history.undo();
  assert.deepEqual(it.warps(), []);
  it.history.redo();
  assert.equal(it.warps().length, 1);
});

test('a shape with no outline to bend is refused with a reason', () => {
  const it = harness({ selected: 'block' });
  it.click({ warpAction: 'add' });
  assert.deepEqual(it.warps(), []);
  assert.match(it.host.innerHTML, /Transforms and shape keys usually do the job instead/);
});

test('a second warp on the same shape is refused', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  it.click({ warpAction: 'add' });
  assert.equal(it.warps().length, 1);
  assert.match(it.host.innerHTML, /already has a warp/);
});

test('the grid size is chosen before adding, and retunable after', () => {
  const it = harness();
  it.change({ warpField: 'size' }, '4');
  assert.equal(it.panel.getSize(), 4);
  it.click({ warpAction: 'add' });
  assert.equal(it.warps()[0].grid.points.length, 16);
  it.change({ warpField: 'size', warpId: it.warps()[0].id }, '3');
  assert.equal(it.warps()[0].grid.points.length, 9);
});

test('retuning the grid puts the control points back at rest', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  const commands = createWarpCommands(it.store, it.history);
  const id = it.warps()[0].id;
  commands.movePoint(id, 4, { x: 8, y: 5 });
  assert.deepEqual(it.warps()[0].grid.points[4], { x: 8, y: 5 });
  it.change({ warpField: 'size', warpId: id }, '4');
  assert.deepEqual(it.warps()[0].grid.points[5], { x: 10 / 3, y: 10 / 3 });
});

test('reset returns the control points to rest without removing the warp', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  const id = it.warps()[0].id;
  createWarpCommands(it.store, it.history).movePoint(id, 4, { x: 9, y: 1 });
  it.click({ warpAction: 'reset', warpId: id });
  assert.deepEqual(it.warps()[0].grid.points[4], { x: 5, y: 5 });
  assert.equal(it.warps().length, 1);
});

test('a warp can be faded by a movement, or always on', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  const id = it.warps()[0].id;
  it.change({ warpField: 'driver', warpId: id }, 'headX');
  assert.deepEqual(it.warps()[0].driver, { parameter: 'headX', min: 0, max: 1 });
  it.change({ warpField: 'driver', warpId: id }, '');
  assert.equal(it.warps()[0].driver, null);
});

test('removing a warp leaves the rest outline in place', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  it.click({ warpAction: 'remove', warpId: it.warps()[0].id });
  assert.deepEqual(it.warps(), []);
  assert.equal(it.store.getDocument().elements.cheek.restPath, SQUARE);
});

test('a warp authored through the panel actually bends the shape', () => {
  const it = harness();
  it.click({ warpAction: 'add' });
  const id = it.warps()[0].id;
  createWarpCommands(it.store, it.history).movePoint(id, 0, { x: -4, y: 0 });
  const state = it.store.getDocument();
  const frame = compileRigFrame(state.elements, {}, {}, {}, { warps: state.warps });
  assert.match(frame.cheek.path, /^M-4 0/);
});

test('the commands refuse what they cannot do', () => {
  const store = createEditorStore(project());
  const commands = createWarpCommands(store, createHistory(store));
  assert.equal(commands.add('ghost', { box: BOX }), false);
  assert.equal(commands.add('cheek', {}), false, 'no box');
  assert.equal(commands.remove('nope'), false);
  assert.equal(commands.movePoint('nope', 0, { x: 0, y: 0 }), false);
  assert.equal(commands.setSize('nope', 4), false);
  assert.deepEqual(store.getDocument().warps, []);
});
