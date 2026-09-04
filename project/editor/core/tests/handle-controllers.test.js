import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { RIG_HANDLE_CONTROLLERS, controllerStops, handleBoardModel, handleController, normalizeRigHandles, resolveRigHandles } = await import('../puppet/handle-model.js');
const { createHandleBoard } = await import('../../ui/handle-board.js');
const { createCleanProjectState } = await import('../state/store.js');
const { PROJECT_TEMPLATES, applyTemplateProject } = await import('../sample/templates/index.js');

/**
 * Universal visual controllers (VNX-14, docs/VNEXT_ROADMAP.md).
 *
 * Every handle was drawn the same way and dragged the same way, whatever it
 * drove: a gaze, a jaw and a tilt all read as three number fields. The shape
 * of a control should match the movement — two directions are a pad, one is a
 * slider, a turn is an arc, a movement cut into steps is a short list of
 * places — and the kind is **derived** from the axes the handle already has,
 * so nothing new is stored for a control that gets what it deserves.
 */
const FACE = ['faceRoot', 'head', 'earLeft', 'earRight', 'shadeLeft', 'shadeRight', 'mouth', 'tongue', 'teeth',
  'eyeLeft', 'eyeRight', 'pupilLeft', 'pupilRight', 'lidUpperLeft', 'lidUpperRight', 'lidLowerLeft', 'lidLowerRight',
  'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'hairFront', 'eyebrows'];
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'path' } });

function project() {
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(FACE.map((id) => [id, element()]));
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: FACE.filter((id) => id !== 'faceRoot').map((id) => ({ id, type: 'path', name: id, children: [] })) }];
  applyTemplateProject(state);
  return state;
}

/** A floating hand, which is where the pad and the arc meet outside the face. */
const range = () => ({ type: 'number', min: -1, max: 1, default: 0, value: 0 });
const handProject = () => ({
  svgMarkup: '<svg/>', elements: { handleft: element() }, semanticParts: {},
  layers: [{ id: 'handleft', name: 'handleft', type: 'path', children: [] }],
  hands: { left: { element: 'handleft', anchor: { x: 40, y: 120 }, restOffset: { x: 0, y: 0 }, reach: { x: 35, y: 28 } } },
  params: { handLX: range(), handLY: range(), handLRotation: range(), handLScale: range(), handLDepth: range() }
});

const kinds = (state) => Object.fromEntries(resolveRigHandles(state).map((handle) => [handle.id, handle.widget.controller]));
const override = (state, ...records) => { state.rigHandles = normalizeRigHandles({ rigHandles: records }); return state; };

test('every control gets the shape its own movement deserves', () => {
  const state = project();
  const kind = kinds(state);
  // Two directions at once is a pad: the gaze, the brows, the mouth, the turn
  // of the head and the hair all move sideways *and* up.
  for (const id of ['gaze', 'eyebrows', 'mouth', 'head', 'hair']) assert.equal(kind[id], 'pad', id);
  // One direction is a slider, whether it opens, widens, scrunches or wiggles.
  for (const id of ['eyes', 'jaw', 'nose', 'mouthWidth', 'ears', 'eyeLeft', 'eyeRight', 'browLeft', 'browRight']) assert.equal(kind[id], 'slider', id);
  // A tilt is a turn of the wrist, and a turn is an arc.
  assert.equal(kind.headTilt, 'arc');
  assert.ok(Object.values(kind).every((item) => RIG_HANDLE_CONTROLLERS.includes(item)), 'and nothing is left without one');

  // The same rule reaches the hands, which the face registry knows nothing
  // about: placing one is a pad, turning it is an arc.
  const hands = kinds(handProject());
  assert.equal(hands['hand-left'], 'pad');
  assert.equal(hands['hand-left-turn'], 'arc');
});

test('a lock or a step changes the control, because it changes the movement', () => {
  const state = project();
  // Half a pad is a slider: a locked axis is not a direction any more.
  assert.equal(kinds(override(state, { id: 'mouth', axes: { x: { locked: true } } })).mouth, 'slider');
  assert.equal(kinds(override(state, { id: 'mouth', axes: { x: { locked: true }, y: { locked: true } } })).mouth, 'locked');

  // A movement cut into a handful of steps is a short list of places.
  assert.equal(kinds(override(state, { id: 'eyes', axes: { y: { snap: 0.5 } } })).eyes, 'chips');
  const eyes = resolveRigHandles(state).find((handle) => handle.id === 'eyes');
  assert.deepEqual(controllerStops(eyes.y), [0, 0.5, 1]);
  // A step so small nobody could pick from the list is still a range.
  assert.equal(kinds(override(state, { id: 'eyes', axes: { y: { snap: 0.02 } } })).eyes, 'slider');
  assert.deepEqual(controllerStops(resolveRigHandles(state).find((handle) => handle.id === 'eyes').y), []);
  // A turn stays a turn however it is stepped.
  assert.equal(kinds(override(state, { id: 'headTilt', axes: { orbit: { snap: 0.5 } } })).headTilt, 'arc');
  // A limit narrows the list with it: half a mouth, stepped, is three places.
  assert.deepEqual(controllerStops({ min: 0, max: 0.5, snap: 0.25 }), [0, 0.25, 0.5]);
  assert.deepEqual(controllerStops({ min: 0, max: 1, snap: 0.5, locked: true }), [], 'and a locked axis offers none');
});

test('an author can overrule the shape, and rubbish never becomes one', () => {
  const state = project();
  assert.equal(kinds(override(state, { id: 'mouth', widget: { controller: 'slider' } })).mouth, 'slider', 'the record wins over the derivation');
  // Validated like every other token in the record: unknown is dropped on the
  // way in, and the derived kind stands.
  assert.deepEqual(normalizeRigHandles({ rigHandles: [{ id: 'mouth', widget: { controller: 'wheel' } }] }), [{ id: 'mouth' }]);
  assert.equal(kinds(override(state, { id: 'mouth', widget: { controller: 'wheel' } })).mouth, 'pad');
  // An override is one field: the colour beside it is untouched, and so is
  // everything the author did not name.
  const mouth = resolveRigHandles(override(state, { id: 'mouth', widget: { controller: 'chips', colour: 'warm' } })).find((handle) => handle.id === 'mouth');
  assert.deepEqual(mouth.widget, { shape: 'circle', size: 'normal', colour: 'warm', controller: 'chips' });
});

test('deriving a control writes nothing: a project that authored nothing still stores []', () => {
  const state = project();
  assert.deepEqual(state.rigHandles, []);
  const before = structuredClone(state);
  resolveRigHandles(state);
  handleBoardModel(state, { smile: 0.4 });
  assert.deepEqual(state, before, 'the kind is derived on the way out, never stored on the way in');
  assert.deepEqual(state.rigHandles, []);
  // And a handle nobody has still answers, rather than throwing at the caller.
  assert.equal(handleController({}), 'locked');
  assert.equal(handleController(null), 'locked');
});

/* The board is where the whole rig is visible at once, so it is also where the
 * shape of each control has to show. */
const cardOf = (html, id) => {
  const start = html.indexOf(`data-handle-card="${id}"`);
  assert.notEqual(start, -1, `no card for ${id}`);
  return html.slice(start).split('</details>')[0];
};

function board(state, { values = {}, applyPose } = {}) {
  const host = document.createElementNS('', 'div');
  const written = [];
  const panel = createHandleBoard(host, {
    model: () => handleBoardModel(state, values),
    commands: { setAxis() {}, hide() {}, reset() {}, rename() {}, setWidget() {}, remove() {} },
    applyPose: applyPose === null ? undefined : (patch) => written.push(patch)
  });
  panel.render();
  return {
    host, written, panel,
    click: (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) }),
    slide: (dataset, value) => host.dispatch('input', { target: clickTarget({ tag: 'input', dataset, value }) }),
    press: (key, dataset) => host.dispatch('keydown', { key, target: clickTarget({ tag: 'div', dataset }) })
  };
}

test('the board renders the control each kind names, not three number fields', () => {
  const state = project();
  const { host } = board(override(state, { id: 'eyes', axes: { y: { snap: 0.5 } } }));
  const html = host.innerHTML;

  const mouth = cardOf(html, 'mouth');
  assert.match(mouth, /data-handle-control="pad"/);
  assert.match(mouth, /class="xy-pad" data-handle-drag="pad"/, 'a pad shows both axes at once');
  const nose = cardOf(html, 'nose');
  assert.match(nose, /data-handle-control="slider"/);
  assert.match(nose, /<input type="range" data-handle-slider="y"/);
  const tilt = cardOf(html, 'headTilt');
  assert.match(tilt, /data-handle-control="arc"/);
  assert.match(tilt, /data-handle-drag="arc"[^>]*role="slider"/, 'an arc shows its angle');
  const eyes = cardOf(html, 'eyes');
  assert.match(eyes, /data-handle-control="chips"/);
  assert.match(eyes, /data-handle-stop="0"[\s\S]*data-handle-stop="0.5"[\s\S]*data-handle-stop="1"/, 'chips are the places the movement stops at');
  // A member of a group is an ordinary control and gets its own shape.
  assert.match(cardOf(html, 'eyeLeft'), /data-handle-control="slider"/);
  // The card still says which kind it is, for the mascot to draw the same one.
  assert.match(mouth, /data-handle-controller="pad"/);

  // The limits are still an author's, under the control rather than instead of
  // it: narrowing, stepping and locking are authoring, not posing.
  assert.match(mouth, /data-handle-field="max" data-handle-id="mouth" data-handle-axis="y"/);
  assert.match(mouth, /data-handle-action="lock"[^>]*data-handle-axis="x"/);

  // Every axis locked leaves a control that says where the movement is.
  const locked = board(override(project(), { id: 'mouth', axes: { x: { locked: true }, y: { locked: true } } }));
  assert.match(cardOf(locked.host.innerHTML, 'mouth'), /data-handle-control="locked"/);
});

test('operating a control is a live preview, and writes only what it drives', () => {
  const state = override(project(), { id: 'eyes', axes: { y: { snap: 0.5 } } });
  const it = board(state);
  // Picking a chip lands exactly on that place, and on nothing else.
  it.click({ handleStop: '0.5', handleId: 'eyes', handleAxis: 'y' });
  assert.deepEqual(it.written, [{ eyeOpen: 0.5 }]);
  // A slider is the same write, dragged.
  it.slide({ handleSlider: 'y', handleId: 'nose', handleAxis: 'y' }, '0.6');
  assert.deepEqual(it.written.at(-1), { noseScrunch: 0.6 });
  // A pad answers the keyboard, and dragging up raises an inverted movement
  // exactly as it does on the mascot.
  it.press('ArrowRight', { handleDrag: 'pad', handleId: 'mouth' });
  assert.deepEqual(it.written.at(-1), { smile: 0.1 });
  it.press('ArrowUp', { handleDrag: 'pad', handleId: 'eyebrows' });
  assert.ok(it.written.at(-1).browRaise > 0, 'up raises the brow');
  it.press('ArrowRight', { handleDrag: 'arc', handleId: 'headTilt' });
  assert.ok(it.written.at(-1).headTilt > 0, 'and turning the arc clockwise tilts that way');
  // A locked axis is not reached from the board either.
  const locked = board(override(project(), { id: 'mouth', axes: { x: { locked: true } } }));
  locked.press('ArrowRight', { handleDrag: 'pad', handleId: 'mouth' });
  assert.deepEqual(locked.written, []);
});

test('a board with nowhere to send a value shows the controls read-only rather than lying', () => {
  const it = board(override(project(), { id: 'eyes', axes: { y: { snap: 0.5 } } }), { applyPose: null });
  const html = it.host.innerHTML;
  assert.match(cardOf(html, 'nose'), /<input type="range"[^>]*disabled>/);
  assert.match(cardOf(html, 'eyes'), /data-handle-stop="0.5"[^>]*disabled>/);
  assert.doesNotMatch(cardOf(html, 'mouth'), /data-handle-drag="pad"[^>]*tabindex/);
  it.click({ handleStop: '0.5', handleId: 'eyes', handleAxis: 'y' });
  assert.deepEqual(it.written, []);
});
