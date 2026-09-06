import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createHeadPosePanel, cellArrow, axisReadout } = await import('../../rig-editor/head-pose/head-pose-panel.js');
const { createHeadPoseCommands } = await import('../head-pose/head-pose-commands.js');
const { createHeadPoseAxes, headPoseCellState, headPoseCellSamples, headPoseCellShapes } = await import('../head-pose/head-pose-model.js');
const { createExportRig } = await import('../export/export-rig.js');
const { normalizeRig } = await import('../rig/normalize-rig.js');
const { compileRigFrame } = await import('../../../runtime/runtime.js');
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
    // Enough of a rig for a generated turn: a head and one feature inside it.
    semanticParts: {
      head: { id: 'head', type: 'head', name: 'Head', roles: { head: 'face' }, controls: ['headX', 'headY'], controlDrivers: {}, calibration: {} },
      nose: { id: 'nose', type: 'nose', name: 'Nose', roles: { nose: 'nose' }, controls: [], controlDrivers: {}, calibration: {} }
    },
    keyforms: []
  };
}

/** A mouth drawn as a triangle, and the same triangle with its top pulled up. */
const REST = 'M0 0 L10 0 L10 10 Z';
const POSE = 'M0 -4 L10 0 L10 10 Z';

function harness({ measure = false, selected = null, paths = {}, elements = {} } = {}) {
  const base = project();
  const store = createEditorStore({ ...base, elements: { ...base.elements, ...elements } });
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const previews = [];
  // Stand in for the canvas pose session: whatever `posed` holds is what the
  // author moved on the canvas before pressing Capture.
  let posed = {};
  let session = null;
  let shapeSession = null;
  let selection = selected;
  const panel = createHeadPosePanel(host, store, history, {
    beginPose: (ids, handlers) => { session = { ids, handlers }; return true; },
    cancelPose: () => { session = null; shapeSession = null; },
    // Stand in for the canvas node-edit session: `path` is what it puts on
    // screen, and whatever is handed to `capture` is what the author dragged.
    beginShapePose: (id, path, handlers) => { shapeSession = { id, path, handlers }; return true; },
    pathOf: (id) => paths[id] ?? null,
    selectedId: () => selection,
    onPreview: (values) => previews.push(values),
    // The editor measures the artwork on the canvas; here one box stands in.
    measure: measure ? (id) => ({ x: id === 'face' ? 20 : 90, y: 20, width: id === 'face' ? 200 : 20, height: 200 }) : () => null
  });
  panel.render();
  const click = (dataset) => { host.dispatch('click', { target: clickTarget({ dataset }) }); };
  const change = (dataset, value) => { host.dispatch('change', { target: { ...clickTarget({ dataset }), value } }); };
  const pose = (next) => { posed = next; };
  const finishCapture = () => { session?.handlers.capture(posed); };
  const shape = (posePath) => { shapeSession?.handlers.capture(posePath); };
  const select = (id) => { selection = id; panel.render(); };
  return {
    store, history, host, panel, previews, click, change, pose, finishCapture, shape, select,
    session: () => session, shapeSession: () => shapeSession,
    keyforms: () => store.getDocument().keyforms, shapeKeys: () => store.getDocument().shapeKeys || []
  };
}

/** A project whose mouth is a path the author can reshape. */
const shapeable = (over = {}) => harness({ selected: 'mouth', paths: { mouth: REST }, elements: { mouth: { baseTransform: transform(), baseOpacity: 1, meta: { nodeType: 'path' } } }, ...over });

test('the grid reads as directions, with up at the top of the parameter range', () => {
  // The rig's vertical parameters are calibrated UP at -1 and DOWN at +1.
  assert.deepEqual([-1, 0, 1].map((y) => [-1, 0, 1].map((x) => cellArrow(x, y)).join('')), ['↖↑↗', '←●→', '↙↓↘']);
});

test('a fresh panel offers five directions, not nine chores', () => {
  // The four corners are a refinement (VNX-17): a head turned left *and* up is
  // not what anyone asks for first, and offering it beside "left" makes the
  // grid read as nine tasks rather than four directions.
  const it = harness();
  assert.equal(it.host.dataset.headPoseReady, 'true');
  assert.equal(it.host.dataset.headPoseCaptured, '0');
  assert.equal(it.host.dataset.headPoseDetail, 'simple');
  assert.equal((it.host.innerHTML.match(/data-head-cell="/g) || []).length, 5);
  assert.equal((it.host.innerHTML.match(/data-head-state="empty"/g) || []).length, 5);
  assert.match(it.host.innerHTML, /five directions/);
});

test('the corners are one choice away, and the whole grid still works', () => {
  const it = harness();
  it.change({ headDetail: '' }, 'standard');
  assert.equal(it.host.dataset.headPoseDetail, 'standard');
  assert.equal((it.host.innerHTML.match(/data-head-cell="/g) || []).length, 9);
  assert.match(it.host.innerHTML, /nine positions/);
});

test('folding the corners away never leaves the author standing on one', () => {
  const it = harness();
  it.change({ headDetail: '' }, 'standard');
  it.click({ headCell: '0,0' });
  assert.match(it.host.innerHTML, /data-head-cell="0,0"[^>]*aria-pressed="true"/);
  it.change({ headDetail: '' }, 'simple');
  // The corner is gone from the grid, so the selection cannot still be on it.
  assert.equal(it.host.innerHTML.includes('data-head-cell="0,0"'), false);
  assert.match(it.host.innerHTML, /data-head-cell="1,1"[^>]*aria-pressed="true"/);
});

test('a corner an author captured is always offered, whatever the level', () => {
  // Hiding a pose someone made would be a lie, not a simplification.
  const it = harness();
  it.change({ headDetail: '' }, 'standard');
  it.click({ headCell: '0,0' });
  it.click({ headAction: 'capture' });
  it.pose({ headX: -1, headY: -1 });
  it.finishCapture();
  it.change({ headDetail: '' }, 'simple');
  assert.equal(it.host.dataset.headPoseDetail, 'simple');
  assert.ok(it.host.innerHTML.includes('data-head-cell="0,0"'), 'the captured corner disappeared');
  assert.equal((it.host.innerHTML.match(/data-head-cell="/g) || []).length, 6, 'five directions plus the corner that exists');
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
  assert.equal(it.panel.getLiveParams().headY, -0.5, 'up is a negative headY, which is what moves the head up');
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

test('the pad readout says which way the head is turned, not a signed parameter', () => {
  assert.equal(axisReadout(0, ['left', 'right']), 'centred');
  assert.equal(axisReadout(-0.96, ['up', 'down']), 'up 0.96', 'a negative headY is the head looking up');
  assert.equal(axisReadout(1, ['up', 'down']), 'down 1.00');
  assert.equal(axisReadout(0.5, ['left', 'right']), 'right 0.50');
  assert.equal(axisReadout(undefined, ['left', 'right']), 'centred');
});

test('generating a turn writes the whole grid in one undoable step', () => {
  const it = harness({ measure: true });
  assert.equal(it.host.dataset.headPoseCaptured, '0');
  assert.match(it.host.innerHTML, /Generate turn/);
  it.host.dispatch('click', { target: clickTarget({ dataset: { headAction: 'generate' } }) });
  assert.equal(it.host.dataset.headPoseCaptured, '9', 'nine positions');
  assert.match(it.host.innerHTML, /Regenerate turn/);
  assert.match(it.host.innerHTML, /Turn generated from \d+ parts/);
  const keyforms = it.store.getDocument().keyforms;
  assert.ok(keyforms.length > 0 && keyforms.every((keyform) => keyform.id.startsWith('headPose:')));
  it.history.undo();
  assert.deepEqual(it.store.getDocument().keyforms, [], 'one command, one undo');
});

test('generating a turn turns the axes on, so a face somebody drew can play it', () => {
  // The template has `headX` and `headY` on before anyone presses Generate, so
  // nothing noticed that generating did not turn them on. A face drawn from
  // the blank canvas has neither, and the press wrote a full grid driven by
  // parameters that did not exist: a turn nothing could play.
  const base = project();
  const store = createEditorStore({
    ...base,
    params: {},
    semanticParts: { ...base.semanticParts, head: { ...base.semanticParts.head, controls: [] } }
  });
  const history = createHistory(store);
  const commands = createHeadPoseCommands(store, history);
  assert.equal(commands.generateTurn({}), true);
  const after = store.getDocument();
  assert.ok(after.params.headX && after.params.headY, 'the turn is played by the head\'s own axes');
  assert.deepEqual(after.semanticParts.head.controls.filter((control) => control.startsWith('head')).sort(), ['headX', 'headY']);
  assert.ok(after.keyforms.length > 0);
  // Still one command and one undo, axes included.
  history.undo();
  assert.deepEqual(store.getDocument().keyforms, []);
  assert.deepEqual(store.getDocument().params, {});
});

test('a generated turn only scales what the editor could measure', () => {
  const blind = harness();
  blind.click({ headAction: 'generate' });
  // A cell records every channel, so what says "nothing scaled here" is the
  // neutral 1 — scaling around an unknown centre would drag the part away.
  const cell = headPoseCellSamples(blind.keyforms(), createHeadPoseAxes(), { i: 2, j: 1 });
  assert.equal(cell.face.scaleX, 1);
  assert.equal(cell.nose.scaleX, 1);
  assert.ok(cell.nose.translateX > 0, 'it still travels');

  const seen = harness({ measure: true });
  seen.click({ headAction: 'generate' });
  const measured = headPoseCellSamples(seen.keyforms(), createHeadPoseAxes(), { i: 2, j: 1 });
  assert.ok(measured.face.scaleX < 1, 'the outline can be squashed once it has a centre');
});

test('a turn needs face parts, and says so rather than writing nothing quietly', () => {
  const it = harness();
  it.store.execute({ type: 'test/clear-parts', domains: ['semanticParts'], apply: (document) => { document.semanticParts = {}; } });
  it.panel.render();
  it.click({ headAction: 'generate' });
  assert.equal(it.host.dataset.headPoseCaptured, '0');
  assert.match(it.host.innerHTML, /Assign the face parts first/);
});

/* ── An outline captured into a cell (3D-06) ──────────────────────────────── */

test('shaping a position is advanced, and asks for a selection before it offers', () => {
  // "New function -> not a new panel": the grid an author already knows gains
  // one section, at the tier that names artwork rather than directions.
  const it = harness();
  assert.match(it.host.innerHTML, /data-disclosure="head-pose-shape" data-disclosure-level="advanced"/);
  assert.match(it.host.innerHTML, /Select a path on the canvas/);
  assert.equal(it.host.dataset.headPoseShapes, '0');
  it.click({ headAction: 'shape' });
  assert.equal(it.shapeSession(), null, 'nothing to shape, so no canvas session');
  assert.match(it.host.innerHTML, /Select a path on the canvas first/);
});

test('an outline captured into a cell is an ordinary shape key the grid weights', () => {
  const it = shapeable();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'shape' });
  assert.equal(it.shapeSession().id, 'mouth');
  assert.equal(it.shapeSession().path, REST, 'the session starts from the outline as drawn');
  assert.equal(it.host.dataset.headPoseShaping, 'true');
  assert.deepEqual(it.keyforms(), [], 'nothing authored while the author is still dragging');

  it.shape(POSE);
  const axes = createHeadPoseAxes();
  const [key] = it.shapeKeys();
  assert.equal(key.target, 'mouth');
  assert.ok(key.delta.some((value) => value !== 0), 'the delta is the difference from rest');
  assert.deepEqual(headPoseCellShapes(it.shapeKeys(), { i: 2, j: 1 }), [key], 'the cell owns it');
  assert.deepEqual(headPoseCellShapes(it.shapeKeys(), { i: 1, j: 1 }), [], 'and no other cell claims it');

  // One keyform, on the channel the runtime already knows: `pathShape`.
  const shapes = it.keyforms().filter((keyform) => keyform.channel === 'pathShape');
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].shapeKey, key.id);
  assert.equal(headPoseCellState(it.keyforms(), axes, { i: 2, j: 1 }), 'captured');
  assert.equal(headPoseCellState(it.keyforms(), axes, { i: 1, j: 1 }), 'neutral', 'rest still rests');
  assert.equal(it.host.dataset.headPoseShapes, '1');
  assert.match(it.host.innerHTML, /Outline captured for mouth/);

  // The rest outline is captured with it, because a delta needs one to mean
  // anything -- and it is the shape that was on the canvas, not the pose.
  assert.equal(it.store.getDocument().elements.mouth.restPath, REST);
});

test('a captured outline plays back from an exported rig, as a keyform and nothing else', () => {
  const it = shapeable();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'shape' });
  it.shape(POSE);

  const rig = normalizeRig(createExportRig(it.store.getDocument()));
  assert.equal(rig.shapeKeys.length, 1, 'the shape survives the export normalizer');
  assert.equal(rig.keyforms.filter((keyform) => keyform.channel === 'pathShape').length, 1);
  const path = (headX) => compileRigFrame(rig.elements, { headX, headY: 0 }, {}, {}, { keyforms: rig.keyforms, shapeKeys: rig.shapeKeys }).mouth.path;
  assert.equal(path(0), REST, 'at rest the exported mascot is the drawing');
  assert.equal(path(1), POSE, 'and at a full turn it is the outline that was captured');
  assert.notEqual(path(0.5), REST);
  assert.notEqual(path(0.5), POSE);
  assert.equal(path(-1), REST, 'the other side was never captured, so it clamps to rest');
});

test('capturing an outline is one undo step, shape and weight together', () => {
  const it = shapeable();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'shape' });
  it.shape(POSE);
  it.history.undo();
  assert.deepEqual(it.store.getDocument().keyforms, []);
  assert.deepEqual(it.store.getDocument().shapeKeys, [], 'a shape left behind would deform the mascot after the undo');
  assert.equal(it.store.getDocument().elements.mouth.restPath, undefined);
  it.history.redo();
  assert.equal(it.shapeKeys().length, 1);
});

test('editing again continues from the shape already stored there', () => {
  const it = shapeable();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'shape' });
  it.shape(POSE);
  assert.match(it.host.innerHTML, /Edit mouth again/);
  it.click({ headAction: 'shape' });
  assert.equal(it.shapeSession().path, POSE, 'a second pass is a correction, not a redraw');
  // Another cell starts from rest again: each position holds its own outline.
  it.shapeSession().handlers.cancel();
  it.click({ headCell: '0,1' });
  it.click({ headAction: 'shape' });
  assert.equal(it.shapeSession().path, REST);
});

test('an outline whose points changed is refused, and says why', () => {
  const it = shapeable();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'shape' });
  it.shape('M0 0 C1 1 2 2 3 3');
  assert.deepEqual(it.shapeKeys(), [], 'a delta needs the same points to be a delta at all');
  assert.deepEqual(it.keyforms(), []);
  assert.match(it.host.innerHTML, /different outline structure/);
});

test('cancelling the shape session changes nothing at all', () => {
  const it = shapeable();
  it.click({ headAction: 'shape' });
  it.shapeSession().handlers.cancel();
  assert.equal(it.host.dataset.headPoseShaping, 'false');
  assert.deepEqual(it.shapeKeys(), []);
  assert.deepEqual(it.keyforms(), []);
  assert.match(it.host.innerHTML, /Nothing changed/);
});

test('an outline can be taken back out without losing what was posed there', () => {
  const it = shapeable();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'capture' });
  it.pose({ nose: transform({ x: 16 }) });
  it.finishCapture();
  it.click({ headAction: 'shape' });
  it.shape(POSE);
  assert.equal(it.host.dataset.headPoseShapes, '1');

  it.click({ headAction: 'reset-shape', headShapeTarget: 'mouth' });
  assert.deepEqual(it.shapeKeys(), []);
  assert.equal(it.host.dataset.headPoseShapes, '0');
  assert.equal(headPoseCellSamples(it.keyforms(), createHeadPoseAxes(), { i: 2, j: 1 }).nose.translateX, 7, 'the movement posed here is untouched');
  assert.match(it.host.innerHTML, /back to the one that was drawn/);
});

test('clearing a cell, or the whole grid, takes the outlines it was weighting', () => {
  const it = shapeable();
  it.click({ headCell: '2,1' });
  it.click({ headAction: 'shape' });
  it.shape(POSE);
  it.click({ headAction: 'reset-cell' });
  assert.deepEqual(it.shapeKeys(), [], 'a shape nothing weights any more only clutters the rig');
  assert.deepEqual(it.keyforms(), []);

  it.click({ headAction: 'shape' });
  it.shape(POSE);
  it.click({ headAction: 'reset-all' });
  assert.deepEqual(it.shapeKeys(), []);
  assert.deepEqual(it.keyforms(), []);
});
