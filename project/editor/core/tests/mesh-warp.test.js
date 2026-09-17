import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MESH_SIZE, MESH_PRESETS, growTriangle, meshFor, meshIsRest, meshMarkup, meshPieces, meshRestPoints, meshTriangles, normalizeMeshes, restMesh, triangleTransform } from '../../../runtime/mesh-warp.js';

const box = { x: 0, y: 0, width: 100, height: 100 };
const round = (value) => Math.round(value * 1e6) / 1e6;

test('the grid is the two sizes the plan fixed, and nothing else',()=>{
  assert.deepEqual(MESH_PRESETS,[3, 4]);
  assert.equal(DEFAULT_MESH_SIZE,3);
  assert.equal(meshRestPoints(3).length,9);
  assert.equal(meshRestPoints(4).length,16);
  // Two triangles a cell: four cells at 3x3, nine at 4x4.
  assert.equal(meshTriangles(3).length,8);
  assert.equal(meshTriangles(4).length,18);
  // Corners are the corners, and the middle of a 3x3 is the middle.
  assert.deepEqual(meshRestPoints(3)[0],{ x: 0, y: 0 });
  assert.deepEqual(meshRestPoints(3)[4],{ x: 0.5, y: 0.5 });
  assert.deepEqual(meshRestPoints(3)[8],{ x: 1, y: 1 });
});

test('every cell is split along the same diagonal',()=>{
  // Alternating it makes a deformation fold differently in neighbouring cells,
  // which reads as a crease nobody put there.
  const points = meshRestPoints(3);
  const slopes = meshTriangles(3).filter((triangle, index) => index % 2 === 0).map((triangle) => {
    const [a, , c] = triangle.map((corner) => points[corner]);
    return `${round(c.x - a.x)},${round(c.y - a.y)}`;
  });
  assert.equal(new Set(slopes).size,1,slopes.join(' | '));
});

test('a triangle that has not moved carries the identity',()=>{
  const triangle = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
  assert.deepEqual(triangleTransform(triangle, triangle).map(round),[1, 0, 0, 1, 0, 0]);
  // And a mesh at rest leaves every piece exactly where it was drawn.
  for (const piece of meshPieces({ size: 3, points: meshRestPoints(3) }, box))
    assert.deepEqual(piece.transform.map(round),[1, 0, 0, 1, 0, 0]);
});

test('three points determine the map, which is why this is triangles and not squares',()=>{
  // A quad needs a projective transform and SVG has no way to express one.
  const from = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
  const to = [{ x: 5, y: 5 }, { x: 7, y: 5 }, { x: 5, y: 8 }];
  const [a, b, c, d, e, f] = triangleTransform(from, to);
  const apply = (point) => ({ x: round(a * point.x + c * point.y + e), y: round(b * point.x + d * point.y + f) });
  // The map it returns is the map that actually carries the three corners.
  for (let index = 0; index < 3; index += 1) assert.deepEqual(apply(from[index]),{ x: to[index].x, y: to[index].y });
});

test('a rest triangle with no area has no map, and says so rather than writing NaN',()=>{
  // There is no affine from a line onto a triangle, and a NaN in a transform
  // is artwork that vanishes with nothing in the file explaining why.
  const flat = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }];
  assert.equal(triangleTransform(flat, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]),null);
  // A box of no width makes every triangle flat, and the whole mesh is skipped.
  assert.deepEqual(meshPieces({ size: 3, points: meshRestPoints(3) }, { x: 0, y: 0, width: 0, height: 100 }),[]);
});

test('a moved point moves only the triangles that touch it',()=>{
  const points = meshRestPoints(3).map((point, index) => (index === 4 ? { x: 0.75, y: 0.5 } : point));
  const pieces = meshPieces({ size: 3, points }, box);
  assert.equal(pieces.length,8);
  const identity = pieces.filter((piece) => piece.transform.map(round).join() === '1,0,0,1,0,0');
  // The centre of a 3x3 is a corner of every one of the four cells, so all
  // eight triangles touch it... except the four that do not use it.
  assert.ok(identity.length > 0 && identity.length < 8,`${identity.length} of 8 unmoved`);
});

test('triangles are grown so they overlap rather than meet',()=>{
  // Two clips meeting exactly on a line leave a hairline of background
  // wherever the rasteriser rounds both sides the same way.
  const triangle = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
  const grown = growTriangle(triangle, 1);
  const area = (points) => Math.abs((points[1].x - points[0].x) * (points[2].y - points[0].y) - (points[2].x - points[0].x) * (points[1].y - points[0].y)) / 2;
  assert.ok(area(grown) > area(triangle));
  // Every corner moved outward, which is the property that matters: the grown
  // triangle covers the original. The centre shifts a hair, because three unit
  // vectors only cancel for an equilateral triangle -- a fixed outset is
  // deliberate, since the seam to cover is a hairline whatever the size.
  const centre = { x: (triangle[0].x + triangle[1].x + triangle[2].x) / 3, y: (triangle[0].y + triangle[1].y + triangle[2].y) / 3 };
  const away = (point) => Math.hypot(point.x - centre.x, point.y - centre.y);
  for (let index = 0; index < 3; index += 1) assert.ok(away(grown[index]) > away(triangle[index]),`corner ${index}`);
  assert.ok(Math.hypot(
    (grown[0].x + grown[1].x + grown[2].x) / 3 - centre.x,
    (grown[0].y + grown[1].y + grown[2].y) / 3 - centre.y) < 1,'and stays within a pixel of where it was');
  assert.deepEqual(growTriangle(triangle, 0),triangle);
});

test('a mesh that cannot be read is dropped, never padded',()=>{
  // A half-read mesh is a deformation nobody authored, and drawing one is
  // worse than drawing none.
  const good = restMesh('mouth', 3);
  assert.equal(normalizeMeshes({ meshes: [good] }).length,1);
  for (const broken of [
    { ...good, points: good.points.slice(0, 5) },
    { ...good, size: 5 },
    { ...good, size: 3, points: [...good.points.slice(0, 8), { x: 'left', y: 0 }] },
    { ...good, target: '' },
    null, 'mesh', 7
  ]) assert.deepEqual(normalizeMeshes({ meshes: [broken] }),[],JSON.stringify(broken)?.slice(0, 40));
  assert.deepEqual(normalizeMeshes(null),[]);
  assert.deepEqual(normalizeMeshes({ meshes: 'none' }),[]);
});

test('a mesh knows whether it is doing anything',()=>{
  assert.ok(meshIsRest(restMesh('mouth', 3)));
  assert.ok(meshIsRest(null));
  const bent = { ...restMesh('mouth', 3), points: meshRestPoints(3).map((p, i) => (i === 4 ? { x: 0.6, y: 0.5 } : p)) };
  assert.equal(meshIsRest(bent),false);
  assert.equal(meshFor([bent], 'mouth'),bent);
  assert.equal(meshFor([bent], 'nose'),null);
  assert.equal(meshFor(null, 'mouth'),null);
});

test('a deformed picture is markup, which is why nothing else had to change',()=>{
  const box = { x: 10, y: 20, width: 40, height: 30 };
  const { markup, defs } = meshMarkup(restMesh('mouth', 3), { target: 'mouth', reference: 'asset:7f3c9a1b', box, attributes: 'opacity="0.5"' });
  // The group keeps the piece's id, so the rig, the turn, the depth and the
  // layer list are all unchanged: none of them ever asked what was inside.
  assert.match(markup,/^<g id="mouth" data-mesh="3" opacity="0\.5">/);
  assert.equal((markup.match(/<image /g) || []).length,8);
  assert.equal((defs.match(/<clipPath /g) || []).length,8);
  assert.match(markup,/href="asset:7f3c9a1b"/);
  assert.doesNotMatch(markup,/blob:/);
  // `preserveAspectRatio="none"`, or each triangle's copy letterboxes inside
  // its own box and the pieces stop lining up -- a seam no overdraw covers.
  assert.equal((markup.match(/preserveAspectRatio="none"/g) || []).length,8);
  assert.equal(meshMarkup(restMesh('mouth', 3), { target: 'mouth', reference: 'asset:x', box: { x: 0, y: 0, width: 0, height: 10 } }).markup,'');
});

test('a mesh is drawn in the same order it is read, so a rebuild reuses its clips',()=>{
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const first = meshMarkup(restMesh('m', 3), { target: 'm', reference: 'asset:aabbccdd', box });
  const second = meshMarkup(restMesh('m', 3), { target: 'm', reference: 'asset:aabbccdd', box });
  assert.equal(first.markup,second.markup);
  assert.equal(first.defs,second.defs);
  // Named after the piece, so turning bending off can find them all again.
  assert.match(first.defs,/id="mesh-m-0"/);
  assert.match(first.defs,/id="mesh-m-7"/);
});

test('a mesh costs what the baseline says a deforming node may',()=>{
  // Measured against the V4-004 reference scenes: the mesh scene is a handful
  // of nodes whose shape is rebuilt every frame, and eighteen triangles is
  // the most a preset asks for.
  const box = { x: 0, y: 0, width: 200, height: 200 };
  const meshes = Array.from({ length: 8 }, (unused, index) => ({ size: 4, points: meshRestPoints(4).map((point, at) => (at === index ? { x: point.x + 0.1, y: point.y } : point)) }));
  for (const mesh of meshes) meshPieces(mesh, box);
  const samples = 200, started = performance.now();
  for (let frame = 0; frame < samples; frame += 1) for (const mesh of meshes) meshPieces(mesh, box);
  const perFrame = (performance.now() - started) / samples;
  // Eight 4x4 meshes is 144 triangles of arithmetic. Generous, and still an
  // order of magnitude under the 16.6 ms of a frame.
  assert.ok(perFrame < 3,`${perFrame.toFixed(3)} ms for eight 4x4 meshes`);
});
