import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gizmoModel, localHandlePoints, hitTestGizmo, pointInQuad, snapValue,
  beginGizmoDrag, updateGizmoDrag, cancelGizmoDrag,
  GIZMO_MODES, GIZMO_SHORTCUTS, SNAP, ROTATE_HANDLE_OFFSET
} from '../../svg-editor/gizmo-geometry.js';
import { applyElementTransform, inverseElementTransform, rotateAround, angleAround } from '../../../runtime/runtime.js';

const BOX = { x: 0, y: 0, width: 100, height: 50 };
const rest = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 50, pivotY: 25, ...over });
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} ${actual} != ${expected}`);
const nearPoint = (actual, expected, message) => { near(actual.x, expected.x, `${message} x`); near(actual.y, expected.y, `${message} y`); };

/* Transform maths */

test('the forward and inverse transforms are exact inverses', () => {
  for (const transform of [rest(), rest({ rotation: 37, scaleX: 1.8, scaleY: 0.6, x: 12, y: -4 }), rest({ pivotX: 0, pivotY: 0, rotation: -90 })]) {
    for (const point of [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: -20, y: 7 }]) {
      nearPoint(inverseElementTransform(transform, applyElementTransform(transform, point)), point, 'round trip');
    }
  }
});

test('rotateAround and angleAround agree in SVG y-down space', () => {
  nearPoint(rotateAround({ x: 10, y: 0 }, { x: 0, y: 0 }, 90), { x: 0, y: 10 });
  near(angleAround({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }), 90);
});

/* Model */

test('the gizmo exposes eight handles, a rotate handle and the pivot', () => {
  const model = gizmoModel(BOX, rest());
  assert.deepEqual(model.handles.nw, { x: 0, y: 0 });
  assert.deepEqual(model.handles.se, { x: 100, y: 50 });
  assert.deepEqual(model.handles.e, { x: 100, y: 25 });
  assert.deepEqual(model.pivot, { x: 50, y: 25 });
  assert.equal(model.outline.length, 4);
  assert.deepEqual(localHandlePoints(BOX).s, { x: 50, y: 50 });
});

test('the rotate handle floats above the box and follows its rotation', () => {
  assert.deepEqual(gizmoModel(BOX, rest()).rotate, { x: 50, y: -ROTATE_HANDLE_OFFSET });
  const rotated = gizmoModel(BOX, rest({ rotation: 90 }));
  // The handle floats beyond the box's own north edge, which is now to the east.
  nearPoint(rotated.rotate, { x: 75 + ROTATE_HANDLE_OFFSET, y: 25 }, 'rotate handle turns with the box');
});

test('handles keep a constant screen size as the canvas zooms', () => {
  const zoomedIn = gizmoModel(BOX, rest(), { scale: 4 });
  const zoomedOut = gizmoModel(BOX, rest(), { scale: 0.25 });
  assert.equal(zoomedIn.handleRadius * 4, zoomedOut.handleRadius * 0.25);
  assert.equal(zoomedIn.rotate.y, -ROTATE_HANDLE_OFFSET / 4);
  assert.equal(zoomedOut.rotate.y, -ROTATE_HANDLE_OFFSET / 0.25);
});

test('the gizmo follows a rotated and scaled element', () => {
  const transform = rest({ rotation: 90, scaleX: 2 });
  const model = gizmoModel(BOX, transform);
  nearPoint(model.handles.nw, applyElementTransform(transform, { x: 0, y: 0 }), 'nw');
  nearPoint(model.handles.se, applyElementTransform(transform, { x: 100, y: 50 }), 'se');
});

/* Hit testing */

test('hit testing finds handles, the pivot, the body and empty space', () => {
  const model = gizmoModel(BOX, rest());
  assert.equal(hitTestGizmo(model, { x: 0, y: 0 }), 'nw');
  assert.equal(hitTestGizmo(model, { x: 100, y: 25 }), 'e');
  assert.equal(hitTestGizmo(model, { x: 50, y: -ROTATE_HANDLE_OFFSET }), 'rotate');
  // The pivot marker sits in the middle of the selection, so it is only
  // grabbable in Pivot mode: everywhere else the middle drags the artwork.
  assert.equal(hitTestGizmo(model, { x: 50, y: 25 }), 'body');
  assert.equal(hitTestGizmo(model, { x: 50, y: 25 }, { mode: 'pivot' }), 'pivot');
  assert.equal(hitTestGizmo(model, { x: 30, y: 35 }), 'body');
  assert.equal(hitTestGizmo(model, { x: -400, y: -400 }), null);
});

test('the hit tolerance follows the zoom so handles stay grabbable', () => {
  const model = gizmoModel(BOX, rest(), { scale: 4 });
  assert.equal(hitTestGizmo(model, { x: 1, y: 1 }, { scale: 4 }), 'nw');
  assert.equal(hitTestGizmo(model, { x: 6, y: 6 }, { scale: 4 }), 'body', 'a tight zoom needs a tight grab');
});

test('the body test works on a rotated box, not just an axis-aligned one', () => {
  const model = gizmoModel(BOX, rest({ rotation: 45 }));
  assert.equal(hitTestGizmo(model, model.pivot, { mode: 'pivot' }), 'pivot');
  assert.equal(pointInQuad(model.outline, { x: 50, y: 30 }), true);
  assert.equal(pointInQuad(model.outline, { x: 0, y: 0 }), false);
});

/* Move */

test('move follows the pointer exactly', () => {
  const drag = beginGizmoDrag({ mode: 'move', transform: rest(), box: BOX, point: { x: 10, y: 10 } });
  assert.deepEqual(updateGizmoDrag(drag, { x: 40, y: 25 }), rest({ x: 30, y: 15 }));
});

test('shift constrains a move to one axis and snaps along it', () => {
  const drag = beginGizmoDrag({ mode: 'move', transform: rest(), box: BOX, point: { x: 0, y: 0 } });
  assert.deepEqual(updateGizmoDrag(drag, { x: 31, y: 5 }, { shift: true }), rest({ x: 32, y: 0 }));
  assert.deepEqual(updateGizmoDrag(drag, { x: 5, y: 31 }, { shift: true }), rest({ x: 0, y: 32 }));
  assert.equal(SNAP.translate, 8);
});

test('a move keeps rotation, scale and pivot untouched', () => {
  const start = rest({ rotation: 30, scaleX: 2, scaleY: 0.5, pivotX: 10, pivotY: 12 });
  const drag = beginGizmoDrag({ mode: 'move', transform: start, box: BOX, point: { x: 0, y: 0 } });
  const next = updateGizmoDrag(drag, { x: 5, y: 5 });
  assert.equal(next.rotation, 30);
  assert.equal(next.scaleX, 2);
  assert.equal(next.pivotX, 10);
});

/* Rotate */

test('rotation follows the pointer around the pivot', () => {
  const clockwise = beginGizmoDrag({ mode: 'rotate', handle: 'rotate', transform: rest(), box: BOX, point: { x: 50, y: -25 } });
  near(updateGizmoDrag(clockwise, { x: 75, y: 25 }).rotation, 90);
  const counter = beginGizmoDrag({ mode: 'rotate', handle: 'rotate', transform: rest(), box: BOX, point: { x: 50, y: -25 } });
  near(updateGizmoDrag(counter, { x: 25, y: 25 }).rotation, -90, 'takes the short way round');
});

test('rotation adds to the rotation the element already had', () => {
  const drag = beginGizmoDrag({ mode: 'rotate', transform: rest({ rotation: 45 }), box: BOX, point: { x: 50, y: -25 } });
  near(updateGizmoDrag(drag, { x: 75, y: 25 }).rotation, 135);
});

test('a rotate drag keeps turning the way the hand is going past 180 degrees', () => {
  const drag = beginGizmoDrag({ mode: 'rotate', transform: rest(), box: BOX, point: { x: 50, y: -25 } });
  const pivot = { x: 50, y: 25 };
  let last = 0;
  for (const step of [60, 120, 170, 200, 260, 330, 350]) {
    last = updateGizmoDrag(drag, rotateAround({ x: 50, y: -25 }, pivot, step)).rotation;
  }
  near(last, 350, 'no wrap back to −10');
});

test('shift snaps rotation to fifteen degrees', () => {
  const drag = beginGizmoDrag({ mode: 'rotate', transform: rest(), box: BOX, point: { x: 50, y: -25 } });
  const point = rotateAround({ x: 50, y: -25 }, { x: 50, y: 25 }, 47);
  near(updateGizmoDrag(drag, point, { shift: true }).rotation, 45);
  assert.equal(SNAP.rotation, 15);
});

test('rotation turns around a moved pivot, not the box centre', () => {
  const transform = rest({ pivotX: 0, pivotY: 0 });
  const drag = beginGizmoDrag({ mode: 'rotate', transform, box: BOX, point: { x: 100, y: 0 } });
  near(updateGizmoDrag(drag, { x: 0, y: 100 }).rotation, 90);
});

/* Scale */

test('dragging a corner scales about the pivot so the handle lands on the pointer', () => {
  const transform = rest();
  const model = gizmoModel(BOX, transform);
  const drag = beginGizmoDrag({ mode: 'scale', handle: 'se', transform, box: BOX, point: model.handles.se });
  const next = updateGizmoDrag(drag, { x: 150, y: 75 });
  near(next.scaleX, 2);
  near(next.scaleY, 2);
  nearPoint(gizmoModel(BOX, next).handles.se, { x: 150, y: 75 }, 'handle under the pointer');
  nearPoint(gizmoModel(BOX, next).pivot, model.pivot, 'pivot held still');
});

test('an edge handle scales one axis only', () => {
  const transform = rest();
  const drag = beginGizmoDrag({ mode: 'scale', handle: 'e', transform, box: BOX, point: { x: 100, y: 25 } });
  const next = updateGizmoDrag(drag, { x: 150, y: 999 });
  near(next.scaleX, 2);
  near(next.scaleY, 1);
  const vertical = updateGizmoDrag(beginGizmoDrag({ mode: 'scale', handle: 's', transform, box: BOX, point: { x: 50, y: 50 } }), { x: 999, y: 75 });
  near(vertical.scaleX, 1);
  near(vertical.scaleY, 2);
});

test('shift on a corner keeps the proportions', () => {
  const transform = rest();
  const drag = beginGizmoDrag({ mode: 'scale', handle: 'se', transform, box: BOX, point: { x: 100, y: 50 } });
  const next = updateGizmoDrag(drag, { x: 200, y: 55 }, { shift: true });
  near(next.scaleX, next.scaleY);
  near(next.scaleX, 3);
});

test('scaling a rotated element still lands the handle under the pointer', () => {
  const transform = rest({ rotation: 30 });
  const model = gizmoModel(BOX, transform);
  const target = rotateAround({ x: 150, y: 75 }, { x: 50, y: 25 }, 30);
  const drag = beginGizmoDrag({ mode: 'scale', handle: 'se', transform, box: BOX, point: model.handles.se });
  const next = updateGizmoDrag(drag, target);
  nearPoint(gizmoModel(BOX, next).handles.se, target, 'rotated handle');
});

test('scale never collapses to zero, which a drag could not recover from', () => {
  const transform = rest();
  const drag = beginGizmoDrag({ mode: 'scale', handle: 'se', transform, box: BOX, point: { x: 100, y: 50 } });
  const next = updateGizmoDrag(drag, { x: 50, y: 25 });
  assert.notEqual(next.scaleX, 0);
  assert.notEqual(next.scaleY, 0);
});

test('scale is a no-op without a handle', () => {
  const drag = beginGizmoDrag({ mode: 'scale', transform: rest(), box: BOX, point: { x: 0, y: 0 } });
  assert.deepEqual(updateGizmoDrag(drag, { x: 500, y: 500 }), rest());
});

/* Pivot */

test('moving the pivot leaves the artwork exactly where it was', () => {
  for (const transform of [rest(), rest({ rotation: 40, scaleX: 1.7, scaleY: 0.8, x: 9, y: -3 })]) {
    const drag = beginGizmoDrag({ mode: 'pivot', transform, box: BOX, point: applyElementTransform(transform, { x: 50, y: 25 }) });
    const target = applyElementTransform(transform, { x: 10, y: 40 });
    const next = updateGizmoDrag(drag, target);
    near(next.pivotX, 10, 'pivot x');
    near(next.pivotY, 40, 'pivot y');
    for (const corner of [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 37, y: 11 }]) {
      nearPoint(applyElementTransform(next, corner), applyElementTransform(transform, corner), 'artwork held still');
    }
  }
});

test('the new pivot sits under the pointer', () => {
  const transform = rest({ rotation: 25, scaleX: 1.4 });
  const drag = beginGizmoDrag({ mode: 'pivot', transform, box: BOX, point: applyElementTransform(transform, { x: 50, y: 25 }) });
  const target = { x: 12, y: 34 };
  nearPoint(gizmoModel(BOX, updateGizmoDrag(drag, target)).pivot, target, 'pivot under pointer');
});

test('shift snaps the pivot to the grid', () => {
  const drag = beginGizmoDrag({ mode: 'pivot', transform: rest(), box: BOX, point: { x: 50, y: 25 } });
  const next = updateGizmoDrag(drag, { x: 11, y: 35 }, { shift: true });
  assert.equal(next.pivotX, 8);
  assert.equal(next.pivotY, 32);
});

/* Cancel */

test('cancel restores exactly the transform the drag started from', () => {
  const start = rest({ rotation: 12, scaleX: 1.3, x: 7 });
  for (const mode of GIZMO_MODES) {
    const drag = beginGizmoDrag({ mode, handle: 'se', transform: start, box: BOX, point: { x: 0, y: 0 } });
    updateGizmoDrag(drag, { x: 300, y: 300 });
    updateGizmoDrag(drag, { x: -80, y: 90 });
    assert.deepEqual(cancelGizmoDrag(drag), start, mode);
  }
});

test('a drag never mutates the transform it started from', () => {
  const start = rest();
  const snapshot = { ...start };
  const drag = beginGizmoDrag({ mode: 'move', transform: start, box: BOX, point: { x: 0, y: 0 } });
  updateGizmoDrag(drag, { x: 99, y: 99 });
  assert.deepEqual(start, snapshot);
});

test('updating without a drag is safe, and cancelling nothing returns nothing', () => {
  assert.equal(updateGizmoDrag(null, { x: 1, y: 1 }), null);
  assert.equal(cancelGizmoDrag(null), null);
});

/* Shortcuts and snapping */

test('the keyboard shortcuts are G, R, S and P', () => {
  assert.deepEqual(GIZMO_SHORTCUTS, { g: 'move', r: 'rotate', s: 'scale', p: 'pivot' });
  assert.deepEqual(GIZMO_MODES, ['move', 'rotate', 'scale', 'pivot']);
});

test('snapValue rounds to a step and passes values through without one', () => {
  assert.equal(snapValue(11, 8), 8);
  assert.equal(snapValue(13, 8), 16);
  assert.equal(snapValue(-11, 8), -8);
  assert.equal(snapValue(11, 0), 11);
});
