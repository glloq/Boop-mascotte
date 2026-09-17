import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshGesture, isMeshEdgePoint, meshLattice, meshMirrorIndex, meshOverlay } from '../mesh/mesh-handles.js';
import { meshRestPoints, restMesh } from '../../../runtime/mesh-warp.js';

const box = { x: 0, y: 0, width: 100, height: 100 };
const documentWith = (mesh) => ({ meshes: mesh ? [mesh] : [] });
const gestureOn = (mesh) => {
  const written = [];
  const gesture = createMeshGesture({
    document: () => documentWith(mesh), box: () => box,
    commands: { moveMeshPoints: (target, points) => written.push({ target, points }) }
  });
  return { gesture, written };
};

test('the lattice is a grid, not a constellation of dots',()=>{
  // Twelve edges over nine points, twenty-four over sixteen.
  assert.equal(meshLattice(3).length,12);
  assert.equal(meshLattice(4).length,24);
  assert.deepEqual(meshLattice(3)[0],[0, 1]);
  // Edge points hold a picture's outline straight, and are marked so an author
  // can tell which ones do.
  assert.deepEqual([0,1,2,3,4,5,6,7,8].map((index) => isMeshEdgePoint(index, 3)),[true,true,true,true,false,true,true,true,true]);
});

test('a point knows its mirror across the middle',()=>{
  // A face is symmetrical far more often than not.
  assert.equal(meshMirrorIndex(3, 3),5);
  assert.equal(meshMirrorIndex(5, 3),3);
  assert.equal(meshMirrorIndex(4, 3),4,'a point on the axis is its own mirror');
  assert.equal(meshMirrorIndex(0, 4),3);
});

test('a drag is one command, whatever the pointer did on the way',()=>{
  const { gesture, written } = gestureOn(restMesh('mouth', 3));
  assert.ok(gesture.start('mouth', 4));
  gesture.move({ x: 60, y: 50 });
  gesture.move({ x: 70, y: 50 });
  gesture.move({ x: 75, y: 50 });
  assert.equal(written.length,0,'nothing written while the pointer is down');
  assert.ok(gesture.commit());
  assert.equal(written.length,1);
  assert.deepEqual(written[0].points[4],{ x: 0.75, y: 0.5 });
  // Every other point is exactly where it was.
  assert.deepEqual(written[0].points.filter((point, index) => index !== 4),meshRestPoints(3).filter((point, index) => index !== 4));
});

test('a press that never moved writes nothing',()=>{
  const { gesture, written } = gestureOn(restMesh('mouth', 3));
  gesture.start('mouth', 0);
  assert.equal(gesture.commit(),false);
  assert.deepEqual(written,[]);
  // And a cancelled drag writes nothing either.
  gesture.start('mouth', 4);
  gesture.move({ x: 90, y: 90 });
  assert.ok(gesture.cancel());
  assert.deepEqual(written,[]);
  assert.equal(gesture.preview(),null);
});

test('holding the mirror moves the point opposite, the same distance from the edge',()=>{
  const { gesture, written } = gestureOn(restMesh('mouth', 3));
  gesture.start('mouth', 3, { mirror: true });
  gesture.move({ x: 10, y: 50 });
  gesture.commit();
  assert.deepEqual(written[0].points[3],{ x: 0.1, y: 0.5 });
  assert.deepEqual(written[0].points[5],{ x: 0.9, y: 0.5 });
  // A point on the axis is its own mirror and is written once, not twice.
  const second = gestureOn(restMesh('mouth', 3));
  second.gesture.start('mouth', 4, { mirror: true });
  second.gesture.move({ x: 50, y: 20 });
  second.gesture.commit();
  assert.deepEqual(second.written[0].points[4],{ x: 0.5, y: 0.2 });
});

test('a point may leave the picture, but not leave the building',()=>{
  // Bending a mouth open means pulling past the edge of the drawing, so
  // clamping at 0 and 1 would forbid the most ordinary thing this is for.
  // Clamping somewhere still matters: a point dragged across the canvas folds
  // its triangles inside out and the picture disappears.
  const { gesture, written } = gestureOn(restMesh('mouth', 3));
  gesture.start('mouth', 4);
  gesture.move({ x: 120, y: -40 });
  gesture.commit();
  assert.deepEqual(written[0].points[4],{ x: 1.2, y: -0.4 },'a little past the edge is allowed');
  const far = gestureOn(restMesh('mouth', 3));
  far.gesture.start('mouth', 4);
  far.gesture.move({ x: 9000, y: -9000 });
  far.gesture.commit();
  assert.deepEqual(far.written[0].points[4],{ x: 1.5, y: -0.5 });
});

test('the preview carries the triangles, so the picture bends under the pointer',()=>{
  const { gesture } = gestureOn(restMesh('mouth', 3));
  gesture.start('mouth', 4);
  const shape = gesture.move({ x: 75, y: 50 });
  assert.equal(shape.pieces.length,8);
  const identity = shape.pieces.filter((piece) => piece.transform.every((value, index) => value === [1, 0, 0, 1, 0, 0][index]));
  assert.ok(identity.length < 8,'something bent');
});

test('reset is one step back to the grid it started as',()=>{
  const bent = { ...restMesh('mouth', 3), points: meshRestPoints(3).map((point, index) => (index === 4 ? { x: 0.9, y: 0.1 } : point)) };
  const { gesture, written } = gestureOn(bent);
  assert.ok(gesture.reset('mouth'));
  assert.deepEqual(written[0].points,meshRestPoints(3));
  assert.equal(gesture.reset('nobody'),false);
});

test('nothing is offered for a piece that does not bend',()=>{
  assert.equal(meshOverlay(documentWith(null), 'mouth', box),null);
  assert.equal(meshOverlay(documentWith(restMesh('mouth', 3)), 'nose', box),null);
  // A picture with no size has no space to put points in.
  assert.equal(meshOverlay(documentWith(restMesh('mouth', 3)), 'mouth', { x: 0, y: 0, width: 0, height: 10 }),null);
  assert.equal(meshOverlay(documentWith(restMesh('mouth', 3)), 'mouth', null),null);
  const { gesture } = gestureOn(null);
  assert.equal(gesture.start('mouth', 0),false);
});
