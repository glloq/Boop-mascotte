import test from 'node:test';
import assert from 'node:assert/strict';
import { deletePathNode, insertPathNode, nearestPathPoint, pathSegments, remapValues } from '../path/path-edit.js';
import { migrateElementTopology, describeMigration } from '../path/path-topology.js';
import { pathNodes } from '../path/path-nodes.js';
import { parsePath, serializePath } from '../../../runtime/path-vector.js';
import { MOUTH_REST, mouthPath } from '../sample/templates/face-artwork.js';

const values = (d) => parsePath(d).values;

test('a path is a list of segments, the closing line included', () => {
  assert.deepEqual(pathSegments(MOUTH_REST).map((segment) => `${segment.index}:${segment.command}:${segment.kind}`),
    ['1:Q:quad', '2:Q:quad', '3:Z:close']);
  assert.deepEqual(pathSegments('M0 0 L10 0 C10 5 5 10 0 10 Z').map((segment) => segment.kind),
    ['line', 'cubic', 'close']);
  assert.deepEqual(pathSegments('nonsense'), []);
});

test('splitting a segment adds a point without moving the curve', () => {
  const edit = insertPathNode(MOUTH_REST, 1, 0.5);
  assert.equal(edit.from, 10);
  assert.equal(edit.to, 14);
  assert.equal(pathNodes(edit.d).length, pathNodes(MOUTH_REST).length + 1);
  // The endpoints are untouched and the new node sits on the old curve: at
  // t = .5 a quadratic through (88,172)-(120,168)-(152,172) is (120,170).
  const nodes = pathNodes(edit.d);
  assert.deepEqual([nodes[0].x, nodes[0].y], [88, 172]);
  assert.deepEqual([nodes[1].x, nodes[1].y], [120, 170]);
  assert.deepEqual([nodes[2].x, nodes[2].y], [152, 172]);
});

test('every command a face is drawn with can take a point', () => {
  for (const [d, index, expected] of [
    ['M0 0 L20 0 Z', 1, 'M0 0 L10 0 L20 0 Z'],
    ['M0 0 H20 Z', 1, 'M0 0 H10 H20 Z'],
    ['M0 0 V20 Z', 1, 'M0 0 V10 V20 Z'],
    ['M0 0 L20 0 Z', 2, 'M0 0 L20 0 L10 0 Z']
  ]) {
    assert.equal(insertPathNode(d, index, 0.5).d, expected, d);
  }
  // A cubic splits by de Casteljau: same curve, two commands.
  const cubic = insertPathNode('M0 0 C0 10 10 10 10 0', 1, 0.5);
  assert.equal(cubic.d, 'M0 0 C0 5 2.5 7.5 5 7.5 C7.5 7.5 10 5 10 0');
  // And what cannot be split exactly says so instead of guessing.
  for (const [d, index, reason] of [
    ['M0 0 A5 5 0 0 1 10 0', 1, 'arc'],
    ['M0 0 l20 0 Z', 1, 'relative'],
    ['M0 0 C0 10 10 10 10 0 S20 -10 20 0', 2, 'shorthand'],
    ['M0 0 L10 0', 0, 'not-a-segment']
  ]) {
    assert.equal(insertPathNode(d, index, 0.5).reason, reason, d);
  }
});

test('the map an edit reports carries a shape key exactly', () => {
  // This is the whole reason a topology edit is expressed as a linear map: a
  // shape key is a per-point delta, and `remap(rest) + remap(delta)` has to be
  // `remap(rest + delta)` to the last decimal (docs/SHAPE_KEYS.md).
  const smile = mouthPath({ smile: 1 });
  const rest = values(MOUTH_REST), posed = values(smile);
  const delta = rest.map((value, index) => posed[index] - value);
  const edit = insertPathNode(MOUTH_REST, 1, 0.35);
  const carried = serializePath(edit.commands,
    remapValues(edit, rest).map((value, index) => value + remapValues(edit, delta)[index]));
  assert.equal(carried, insertPathNode(smile, 1, 0.35).d);
});

test('removing a point merges the segments that met at it, and refuses the impossible', () => {
  const four = insertPathNode(MOUTH_REST, 1, 0.5).d;
  const edit = deletePathNode(four, 2);
  assert.equal(pathNodes(edit.d).length, pathNodes(MOUTH_REST).length);
  assert.equal(edit.from - edit.to, 4, 'a quadratic takes its control point with it');
  assert.equal(deletePathNode(MOUTH_REST, 0).reason, 'subpath-start');
  assert.equal(deletePathNode('M0 0 L10 0 L10 10 Z', 1).reason, 'last-node', 'a shape needs three points');
});

test('the nearest point on the outline is the one a double-click means', () => {
  const found = nearestPathPoint(MOUTH_REST, { x: 120, y: 178 });
  assert.equal(found.index, 2, 'the lower lip, not the upper one');
  assert.ok(Math.abs(found.x - 120) < 1);
  assert.ok(found.distance < 8);
  assert.equal(nearestPathPoint('nonsense', { x: 0, y: 0 }), null);
});

test('a topology edit carries the whole rig on that element, or refuses', () => {
  const rest = MOUTH_REST;
  const posed = mouthPath({ smile: 1 });
  const delta = values(rest).map((value, index) => values(posed)[index] - value);
  const document = {
    elements: { mouth: { restPath: rest, morph: { enabled: false, pathA: rest, pathB: rest } } },
    shapeKeys: [
      { id: 'mouth-smile', target: 'mouth', delta },
      { id: 'other', target: 'nose', delta: [1, 2] }
    ],
    semanticParts: { mouth: { roles: { mouth: 'mouth' }, calibration: { smile: { open: { mouth: rest } } } } }
  };
  const edit = insertPathNode(rest, 1, 0.5);
  const plan = migrateElementTopology(document, 'mouth', edit);
  assert.equal(plan.ok, true);
  assert.equal(plan.elements.mouth.restPath, edit.d);
  assert.equal(plan.shapeKeys[0].delta.length, edit.to, 'the delta is as long as the outline');
  assert.deepEqual(plan.shapeKeys[1].delta, [1, 2], 'another element is left alone');
  assert.equal(plan.semanticParts.mouth.calibration.smile.open.mouth, edit.d);
  assert.equal(plan.elements.mouth.morph.pathA, edit.d);
  assert.equal(describeMigration(plan.migrated), '1 shape and its morph and 1 captured pose');

  // A rig that is already out of step is not quietly patched over.
  const broken = { ...document, elements: { mouth: { restPath: 'M0 0 L1 1' } } };
  assert.equal(migrateElementTopology(broken, 'mouth', edit).reason, 'unparsable-rest');
  assert.equal(migrateElementTopology(document, 'missing', edit).reason, 'missing-element');
  const mismatch = { ...document, shapeKeys: [{ id: 'x', target: 'mouth', delta: [1, 2, 3] }] };
  assert.equal(migrateElementTopology(mismatch, 'mouth', edit).reason, 'delta-mismatch');
});
