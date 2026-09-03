import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom } from './helpers/stub-dom.js';

installStubDom();

const { createTransformGizmo } = await import('../../svg-editor/transform-gizmo.js');
const { cursorForHandle, createSelectionOverlay } = await import('../../svg-editor/selection-overlay.js');
const { gizmoModel } = await import('../../svg-editor/gizmo-geometry.js');

const BOX = { x: 0, y: 0, width: 100, height: 50 };
const rest = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 50, pivotY: 25, ...over });

function harness({ transform = rest(), scale = 1 } = {}) {
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const surface = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const previews = [];
  const commits = [];
  let current = { ...transform };
  const gizmo = createTransformGizmo({
    layer, surface,
    getTarget: () => ({ id: 'head', box: BOX, transform: current, scale }),
    onPreview: (next) => { previews.push(next); current = next; },
    onCommit: (next) => { commits.push(next); current = next; },
    toCanvas: (event) => ({ x: event.x, y: event.y })
  });
  const down = (x, y, options = {}) => gizmo.onPointerDown({ button: 0, pointerId: 1, x, y, preventDefault() {}, ...options });
  const move = (x, y, options = {}) => gizmo.onPointerMove({ pointerId: 1, x, y, shiftKey: false, preventDefault() {}, ...options });
  const up = (x, y, options = {}) => gizmo.onPointerUp({ pointerId: 1, x, y, shiftKey: false, preventDefault() {}, ...options });
  return { gizmo, layer, surface, previews, commits, down, move, up, transform: () => current };
}

test('the overlay is a separate layer that never paints over the artwork', () => {
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const overlay = createSelectionOverlay(layer);
  assert.equal(overlay.node.getAttribute('fill'), 'none');
  assert.equal(overlay.node.getAttribute('pointer-events'), 'none');
  assert.equal(overlay.node.hidden, true, 'nothing is drawn until something is selected');
  overlay.render(gizmoModel(BOX, rest()));
  assert.equal(overlay.node.hidden, false);
  const outline = overlay.node.children.find((child) => child.getAttribute('data-gizmo-part') === 'outline');
  assert.equal(outline.getAttribute('fill'), 'none');
  assert.equal(outline.getAttribute('points'), '0,0 100,0 100,50 0,50');
});

test('the overlay draws eight handles, a rotate handle and a pivot marker', () => {
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const overlay = createSelectionOverlay(layer);
  overlay.render(gizmoModel(BOX, rest()));
  const named = overlay.node.children.filter((child) => child.getAttribute('data-gizmo-handle')).map((child) => child.getAttribute('data-gizmo-handle'));
  assert.deepEqual(named.sort(), ['e', 'n', 'ne', 'nw', 'pivot', 'rotate', 's', 'se', 'sw', 'w']);
});

test('the overlay hides again when nothing is selected', () => {
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const overlay = createSelectionOverlay(layer);
  overlay.render(gizmoModel(BOX, rest()));
  overlay.render(null);
  assert.equal(overlay.node.hidden, true);
  assert.equal(overlay.node.getAttribute('visibility'), 'hidden');
});

test('each handle offers the cursor that describes what it does', () => {
  assert.equal(cursorForHandle('nw'), 'nwse-resize');
  assert.equal(cursorForHandle('e'), 'ew-resize');
  assert.equal(cursorForHandle('rotate'), 'grab');
  assert.equal(cursorForHandle('pivot'), 'move');
  assert.equal(cursorForHandle(null), 'default');
});

test('a drag produces transient previews and exactly one commit', () => {
  const it = harness();
  assert.equal(it.down(30, 30), true, 'grabbed the body');
  it.move(40, 30);
  it.move(50, 30);
  it.move(60, 35);
  assert.equal(it.commits.length, 0, 'history sees nothing mid-drag');
  assert.equal(it.previews.length, 3);
  it.up(60, 35);
  assert.equal(it.commits.length, 1, 'one command for the whole gesture');
  assert.deepEqual(it.commits[0], rest({ x: 30, y: 5 }));
});

test('a click with no movement commits nothing', () => {
  const it = harness();
  it.down(30, 30);
  it.up(30, 30);
  assert.equal(it.commits.length, 0);
  assert.deepEqual(it.transform(), rest());
});

test('Escape mid-drag restores exactly the previous state and commits nothing', () => {
  const it = harness();
  it.down(30, 30);
  it.move(90, 45);
  assert.notDeepEqual(it.transform(), rest());
  assert.equal(it.gizmo.onKeyDown({ key: 'Escape' }), true);
  assert.deepEqual(it.transform(), rest(), 'exact previous state');
  assert.equal(it.commits.length, 0);
  assert.equal(it.gizmo.dragging, false);
  it.up(90, 45);
  assert.equal(it.commits.length, 0, 'the released pointer does not resurrect the drag');
});

test('grabbing a corner scales even while the tool says Move', () => {
  const it = harness();
  assert.equal(it.gizmo.mode, 'move');
  it.down(100, 50);
  it.move(150, 75);
  it.up(150, 75);
  assert.equal(it.commits.length, 1);
  assert.ok(Math.abs(it.commits[0].scaleX - 2) < 1e-6);
});

test('grabbing the rotate handle rotates', () => {
  const it = harness();
  it.down(50, -28);
  it.move(78, 25);
  it.up(78, 25);
  assert.ok(Math.abs(it.commits[0].rotation - 90) < 1e-6);
});

test('grabbing the pivot moves the pivot and leaves the artwork still', () => {
  const it = harness();
  // Only in Pivot mode: in every other mode the middle of the selection drags
  // the artwork, which is what a press there means.
  it.gizmo.setMode('pivot');
  it.down(50, 25);
  it.move(10, 40);
  it.up(10, 40);
  assert.equal(it.commits.length, 1);
  assert.ok(Math.abs(it.commits[0].pivotX - 10) < 1e-6);
  assert.ok(Math.abs(it.commits[0].pivotY - 40) < 1e-6);
});

test('a pointer outside the gizmo is left for the canvas to handle', () => {
  const it = harness();
  assert.equal(it.down(-500, -500), false);
  assert.equal(it.gizmo.dragging, false);
  assert.equal(it.up(-500, -500), false);
});

test('a non-primary button never starts a drag', () => {
  const it = harness();
  assert.equal(it.down(30, 30, { button: 2 }), false);
});

test('G, R, S and P switch mode; other keys are left alone', () => {
  const it = harness();
  assert.equal(it.gizmo.onKeyDown({ key: 'r' }), true);
  assert.equal(it.gizmo.mode, 'rotate');
  assert.equal(it.gizmo.onKeyDown({ key: 'S' }), true);
  assert.equal(it.gizmo.mode, 'scale');
  assert.equal(it.gizmo.onKeyDown({ key: 'p' }), true);
  assert.equal(it.gizmo.mode, 'pivot');
  assert.equal(it.gizmo.onKeyDown({ key: 'g' }), true);
  assert.equal(it.gizmo.mode, 'move');
  assert.equal(it.gizmo.onKeyDown({ key: 'q' }), false);
  assert.equal(it.gizmo.onKeyDown({ key: 'r', ctrlKey: true }), false, 'never steals a browser shortcut');
});

test('mode cannot change mid-drag', () => {
  const it = harness();
  it.down(30, 30);
  assert.equal(it.gizmo.onKeyDown({ key: 'r' }), false);
  assert.equal(it.gizmo.mode, 'move');
});

test('setMode rejects an unknown mode', () => {
  const it = harness();
  assert.equal(it.gizmo.setMode('warp'), false);
  assert.equal(it.gizmo.setMode('scale'), true);
  assert.equal(it.gizmo.mode, 'scale');
});

test('shift constrains a drag while it is running', () => {
  const it = harness();
  it.down(30, 30);
  it.move(61, 35, { shiftKey: true });
  it.up(61, 35, { shiftKey: true });
  assert.deepEqual(it.commits[0], rest({ x: 32, y: 0 }));
});

test('hovering offers the right cursor and clears it when leaving', () => {
  const it = harness();
  it.move(0, 0);
  assert.equal(it.surface.style.cursor, 'nwse-resize');
  it.move(-900, -900);
  assert.equal(it.surface.style.cursor, '');
});

test('the gizmo works at any zoom', () => {
  const it = harness({ scale: 4 });
  assert.equal(it.down(0, 0), true, 'a zoomed-in handle is still grabbable');
  it.move(10, 10);
  it.up(10, 10);
  assert.equal(it.commits.length, 1);
});

test('a destroyed gizmo removes its overlay and stops responding', () => {
  const it = harness();
  it.gizmo.destroy();
  assert.equal(it.layer.children.length, 0);
  assert.equal(it.down(30, 30), false);
});

/* A drag reads geometry from the DOM, which does not hand back plain objects. */
test('a live SVGPoint drags the artwork instead of writing NaN into it', () => {
  // The real `toCanvas` used to return the browser's own point object. Its x
  // and y live on the prototype, so `{ ...point }` copied nothing, the drag
  // started from `undefined`, and every gesture wrote translate(NaN NaN) —
  // which is not a wrong position but an invalid attribute: the element
  // vanishes and the damage is serialized into the saved project.
  class StubSVGPoint { constructor(x, y) { this._x = x; this._y = y; } }
  Object.defineProperties(StubSVGPoint.prototype, {
    x: { get() { return this._x; } }, y: { get() { return this._y; } }
  });
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const commits = [];
  const gizmo = createTransformGizmo({
    layer, surface: document.createElementNS('http://www.w3.org/2000/svg', 'g'),
    getTarget: () => ({ id: 'head', box: BOX, transform: rest(), scale: 1 }),
    onPreview: () => {}, onCommit: (next) => commits.push(next),
    toCanvas: (event) => new StubSVGPoint(event.x, event.y)
  });
  // Inside the box but on no handle: the press that drags the selection.
  gizmo.onPointerDown({ button: 0, pointerId: 1, x: 20, y: 40, preventDefault() {} });
  gizmo.onPointerMove({ pointerId: 1, x: 40, y: 60, shiftKey: false, preventDefault() {} });
  gizmo.onPointerUp({ pointerId: 1, x: 40, y: 60, shiftKey: false, preventDefault() {} });
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0], rest({ x: 20, y: 20 }));
  for (const value of Object.values(commits[0])) assert.ok(Number.isFinite(value), `${JSON.stringify(commits[0])}`);
});

test('a transform missing fields cannot poison a drag either', () => {
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const commits = [];
  const gizmo = createTransformGizmo({
    layer, surface: document.createElementNS('http://www.w3.org/2000/svg', 'g'),
    // Imported artwork with no authored transform at all.
    getTarget: () => ({ id: 'head', box: BOX, transform: {}, scale: 1 }),
    onPreview: () => {}, onCommit: (next) => commits.push(next),
    toCanvas: (event) => ({ x: event.x, y: event.y })
  });
  gizmo.onPointerDown({ button: 0, pointerId: 1, x: 50, y: 25, preventDefault() {} });
  gizmo.onPointerMove({ pointerId: 1, x: 60, y: 30, shiftKey: false, preventDefault() {} });
  gizmo.onPointerUp({ pointerId: 1, x: 60, y: 30, shiftKey: false, preventDefault() {} });
  assert.deepEqual(commits[0], { x: 10, y: 5, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    'every field is a number, including the ones the transform never had');
});

test('a box with no height keeps a reachable rotate handle', () => {
  // A stroked line measures zero height: the rotate handle used to collapse
  // onto the outline, where it cannot be grabbed.
  const flat = gizmoModel({ x: 0, y: 10, width: 80, height: 0 }, rest({ pivotX: 40, pivotY: 10 }));
  assert.ok(flat.rotate.y < flat.handles.n.y, 'it floats above the box');
  assert.equal(flat.rotate.x, flat.handles.n.x);
  const tall = gizmoModel(BOX, rest());
  assert.ok(tall.rotate.y < tall.handles.n.y);
});
