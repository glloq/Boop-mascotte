import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createHeadPosePanel, cellArrow } = await import('../../rig-editor/head-pose/head-pose-panel.js');
const { createHeadPoseCommands } = await import('../head-pose/head-pose-commands.js');
const { createHeadPoseAxes, headPoseCellState, headPoseCellSamples } = await import('../head-pose/head-pose-model.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createSampleProject } = await import('../state/store.js');

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });

function project() {
  return {
    ...createSampleProject(),
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="face"/><g id="nose"/></svg>',
    elements: { face: { baseTransform: transform({ x: 6 }), baseOpacity: 1 }, nose: { baseTransform: transform({ x: 9 }), baseOpacity: 1 } },
    params: { headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 }, headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 } },
    keyforms: []
  };
}

function harness() {
  const store = createEditorStore(project());
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const previews = [];
  // Stand in for the canvas pose session: whatever `posed` holds is what the
  // author moved on the canvas before pressing Capture.
  let posed = {};
  let session = null;
  const panel = createHeadPosePanel(host, store, history, {
    beginPose: (ids, handlers) => { session = { ids, handlers }; return true; },
    cancelPose: () => { session = null; },
    onPreview: (values) => previews.push(values)
  });
  panel.render();
  const click = (dataset) => { host.dispatch('click', { target: clickTarget({ dataset }) }); };
  const pose = (next) => { posed = next; };
  const finishCapture = () => { session?.handlers.capture(posed); };
  return { store, history, host, panel, previews, click, pose, finishCapture, session: () => session, keyforms: () => store.getDocument().keyforms };
}

test('the grid reads as directions', () => {
  assert.deepEqual([1, 0, -1].map((y) => [-1, 0, 1].map((x) => cellArrow(x, y)).join('')), ['↖↑↗', '←●→', '↙↓↘']);
});

test('a fresh panel shows nine empty cells', () => {
  const it = harness();
  assert.equal(it.host.dataset.headPoseReady, 'true');
  assert.equal(it.host.dataset.headPoseCaptured, '0');
  assert.equal((it.host.innerHTML.match(/data-head-cell="/g) || []).length, 9);
  assert.equal((it.host.innerHTML.match(/data-head-state="empty"/g) || []).length, 9);
});

test('capture is a canvas pose session: nothing is written until the author confirms', () => {
  const it = harness();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  assert.equal(it.host.dataset.headPosePosing, 'true');
  assert.deepEqual(it.keyforms(), [], 'nothing authored while posing');
  assert.deepEqual(it.session().ids.sort(), ['face', 'nose']);
  assert.match(it.host.innerHTML, /Move the artwork into position/);
  it.pose({ face: transform({ x: 6 }), nose: transform({ x: 9 }) });
  it.finishCapture();
  assert.equal(it.host.dataset.headPosePosing, 'false');
  assert.equal(headPoseCellState(it.keyforms(), createHeadPoseAxes(), { i: 2, j: 1 }), 'neutral', 'parts posed at rest record a neutral cell');
  assert.match(it.host.innerHTML, /Captured 2 parts here/);
});

test('capturing a moved part records the offset it was posed at', () => {
  const it = harness();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  it.pose({ nose: transform({ x: 16 }) });
  it.finishCapture();
  assert.equal(headPoseCellSamples(it.keyforms(), createHeadPoseAxes(), { i: 2, j: 1 }).nose.translateX, 7);
  assert.equal(it.host.dataset.headPoseCaptured, '1');
});

test('cancelling a pose changes nothing at all', () => {
  const it = harness();
  it.click({ headAction: 'capture' });
  it.session().handlers.cancel();
  assert.deepEqual(it.keyforms(), []);
  assert.equal(it.host.dataset.headPosePosing, 'false');
  assert.match(it.host.innerHTML, /Nothing changed/);
});

test('a capture is one undo step and undo restores the previous grid exactly', () => {
  const it = harness();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  it.pose({ face: transform({ x: 16 }) });
  it.finishCapture();
  assert.ok(it.keyforms().length > 0);
  it.history.undo();
  assert.deepEqual(it.store.getDocument().keyforms, []);
  it.history.redo();
  assert.ok(it.store.getDocument().keyforms.length > 0);
});

test('reset clears the selected cell, reset all clears the grid', () => {
  const it = harness();
  it.pose({ face: transform({ x: 16 }) });
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  it.finishCapture();
  it.click({ headCell: '0,1' });
  it.click({ headAction: 'capture' });
  it.finishCapture();
  it.click({ headAction: 'reset-cell' });
  const axes = createHeadPoseAxes();
  assert.equal(headPoseCellState(it.keyforms(), axes, { i: 0, j: 1 }), 'empty');
  assert.notEqual(headPoseCellState(it.keyforms(), axes, { i: 2, j: 1 }), 'empty');
  it.click({ headAction: 'reset-all' });
  assert.deepEqual(it.keyforms(), []);
});

test('copy and paste move a pose between cells, and paste is refused when empty', () => {
  const it = harness();
  it.click({ headAction: 'paste' });
  assert.match(it.host.innerHTML, /Copy a pose first/);
  it.pose({ face: transform({ x: 16 }) });
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  it.finishCapture();
  it.click({ headAction: 'copy' });
  assert.match(it.host.innerHTML, /Pose copied/);
  it.click({ headCell: '0,1' });
  it.click({ headAction: 'paste' });
  const axes = createHeadPoseAxes();
  assert.deepEqual(headPoseCellSamples(it.keyforms(), axes, { i: 0, j: 1 }), headPoseCellSamples(it.keyforms(), axes, { i: 2, j: 1 }));
});

test('copying an empty cell says so instead of pretending', () => {
  const it = harness();
  it.click({ headAction: 'copy' });
  assert.match(it.host.innerHTML, /nothing captured here to copy/);
});

test('mirroring needs a captured pose, then fills in the other side', () => {
  const it = harness();
  it.click({ headAction: 'mirror' });
  assert.match(it.host.innerHTML, /Capture at least one pose before mirroring/);
  it.pose({ face: transform({ x: 12 }) });
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  it.finishCapture();
  it.click({ headAction: 'mirror' });
  const axes = createHeadPoseAxes();
  assert.equal(headPoseCellSamples(it.keyforms(), axes, { i: 0, j: 1 }).face.translateX, -6);
});

test('selecting a cell previews that head direction', () => {
  const it = harness();
  it.click({ headCell: '2,2' });
  assert.deepEqual(it.previews.at(-1), { headX: 1, headY: 1 });
  it.click({ headCell: '1,1' });
  assert.deepEqual(it.previews.at(-1), { headX: 0, headY: 0 });
});

test('the pad moves with the keyboard and recentres', () => {
  const it = harness();
  const pad = clickTarget({ tag: 'div', dataset: { headPad: '' } });
  it.host.dispatch('keydown', { key: 'ArrowRight', target: pad, shiftKey: false });
  assert.equal(it.panel.getLiveParams().headX, 0.1);
  it.host.dispatch('keydown', { key: 'ArrowUp', target: pad, shiftKey: true });
  assert.equal(it.panel.getLiveParams().headY, 0.5);
  it.host.dispatch('keydown', { key: 'Home', target: pad });
  assert.deepEqual(it.panel.getLiveParams(), { headX: 0, headY: 0 });
});

test('the pad leaves keys it does not own alone', () => {
  const it = harness();
  const before = it.previews.length;
  it.host.dispatch('keydown', { key: 'Tab', target: clickTarget({ tag: 'div', dataset: { headPad: '' } }) });
  assert.equal(it.previews.length, before);
});

test('the panel lists the parts a pose covers', () => {
  const it = harness();
  it.pose({ face: transform({ x: 16 }), nose: transform({ x: 20 }) });
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  it.finishCapture();
  assert.match(it.host.innerHTML, /2 parts in this pose/);
  assert.match(it.host.innerHTML, /data-head-part="face"/);
  assert.match(it.host.innerHTML, /data-head-part="nose"/);
});

test('the commands refuse to write when there is nothing to write', () => {
  const store = createEditorStore(project());
  const commands = createHeadPoseCommands(store, createHistory(store));
  assert.equal(commands.paste({ i: 0, j: 0 }, null), false);
  assert.equal(commands.mirror(), false, 'nothing captured yet');
  assert.deepEqual(store.getDocument().keyforms, []);
});
