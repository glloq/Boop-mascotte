import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, normalizeShapeKeys } from '../../../runtime/runtime.js';
import { evaluateShapeTarget, compileShapeKeys, shapeKeyWeight } from '../../../runtime/shape-keys.js';
import {
  createShapeKey, upsertShapeKey, removeShapeKey, setShapeKeyDriver, shapeKeysForTarget,
  previewShapeKey, previewShapeKeys, shapeKeyFromLegacyMorph, migrateLegacyMorphs
} from '../shape-keys/shape-key-model.js';
import { validateShapeKeys } from '../validation/rig-validator.js';
import { normalizeRig } from '../rig/normalize-rig.js';

const REST = 'M0 0 L10 0 L10 10 Z';
const SMILE = 'M0 -2 L10 0 L10 10 Z';
const OPEN = 'M0 0 L10 0 L10 14 Z';

const key = (id, posePath, driver) => {
  const created = createShapeKey({ id, target: 'mouth', restPath: REST, posePath, driver });
  assert.equal(created.ok, true, created.message);
  return created.shapeKey;
};

const elements = () => ({ mouth: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, restPath: REST } });

test('a shape key is the difference between a rest shape and a posed one', () => {
  assert.deepEqual(key('smile', SMILE).delta, [0, -2, 0, 0, 0, 0]);
  assert.deepEqual(key('open', OPEN).delta, [0, 0, 0, 0, 0, 4]);
});

test('capturing against an incompatible outline explains the problem', () => {
  const created = createShapeKey({ id: 'bad', target: 'mouth', restPath: REST, posePath: 'M0 0 C1 1 2 2 3 3' });
  assert.equal(created.ok, false);
  assert.equal(created.reason, 'topology-mismatch');
  assert.match(created.message, /different outline structure/);
});

test('capturing refuses missing pieces before it refuses geometry', () => {
  assert.equal(createShapeKey({ target: 'mouth', restPath: REST, posePath: SMILE }).reason, 'missing-id');
  assert.equal(createShapeKey({ id: 'a', restPath: REST, posePath: SMILE }).reason, 'missing-target');
  assert.equal(createShapeKey({ id: 'a', target: 'mouth', restPath: 'nope', posePath: SMILE }).reason, 'unparsable-rest');
  assert.equal(createShapeKey({ id: 'a', target: 'mouth', restPath: REST, posePath: 'nope' }).reason, 'unparsable-pose');
});

test('one shape key at full weight reproduces the captured shape', () => {
  assert.equal(previewShapeKey(REST, key('smile', SMILE), 1), 'M0 -2 L10 0 L10 10 Z');
});

test('weight zero leaves the rest shape untouched', () => {
  assert.equal(previewShapeKey(REST, key('smile', SMILE), 0), REST.replace(/ Z$/, ' Z'));
});

test('a negative weight deforms the other way', () => {
  assert.equal(previewShapeKey(REST, key('smile', SMILE), -1), 'M0 2 L10 0 L10 10 Z');
});

test('several shape keys on one element add up — smile and mouthOpen together', () => {
  const keys = [key('smile', SMILE), key('open', OPEN)];
  assert.equal(previewShapeKeys(REST, keys, { smile: 1, open: 1 }), 'M0 -2 L10 0 L10 14 Z');
  assert.equal(previewShapeKeys(REST, keys, { smile: 0.8, open: 0.5 }), 'M0 -1.6 L10 0 L10 12 Z');
});

test('a key whose outline does not match is excluded and reported, not applied', () => {
  const { targets, incompatible } = compileShapeKeys(
    [key('smile', SMILE), { id: 'bad', target: 'mouth', delta: [1, 2] }],
    elements()
  );
  assert.deepEqual(incompatible, [{ id: 'bad', target: 'mouth', reason: 'topology-mismatch' }]);
  assert.deepEqual(targets.get('mouth').keys.map((item) => item.id), ['smile']);
});

test('a shape key without a rest outline is reported rather than dropped silently', () => {
  const { targets, incompatible } = compileShapeKeys([key('smile', SMILE)], { mouth: {} });
  assert.equal(targets.size, 0);
  assert.deepEqual(incompatible, [{ id: 'smile', target: 'mouth', reason: 'missing-rest' }]);
});

test('range drivers map a parameter window onto 0..1 and clamp', () => {
  const driver = { mode: 'range', parameter: 'mouthOpen', min: 0, max: 1 };
  const record = { id: 'open', driver: { ...driver, clamp: true } };
  assert.equal(shapeKeyWeight(record, { mouthOpen: 0.5 }), 0.5);
  assert.equal(shapeKeyWeight(record, { mouthOpen: -3 }), 0);
  assert.equal(shapeKeyWeight(record, { mouthOpen: 9 }), 1);
  assert.equal(shapeKeyWeight({ id: 'open', driver: { ...driver, clamp: false } }, { mouthOpen: 2 }), 2);
});

test('a keyform contribution adds to a key own driver weight', () => {
  const record = { id: 'smile', driver: { mode: 'range', parameter: 'smile', min: 0, max: 1, clamp: true } };
  assert.equal(shapeKeyWeight(record, { smile: 0.5 }, { smile: 0.25 }), 0.75);
  assert.equal(shapeKeyWeight({ id: 'smile', driver: { mode: 'none' } }, {}, { smile: 0.4 }), 0.4);
});

test('the frame compiler resolves the final shape for an element', () => {
  const shapeKeys = [
    key('smile', SMILE, { mode: 'range', parameter: 'smile', min: 0, max: 1 }),
    key('open', OPEN, { mode: 'range', parameter: 'mouthOpen', min: 0, max: 1 })
  ];
  const frame = compileRigFrame(elements(), { smile: 0.8, mouthOpen: 0.5 }, {}, {}, { shapeKeys });
  assert.equal(frame.mouth.path, 'M0 -1.6 L10 0 L10 12 Z');
});

test('an expression driver reuses the binding maths', () => {
  const shapeKeys = [key('smile', SMILE, { mode: 'expression', expression: 'smile * 0.5', amplitude: 1, offset: 0 })];
  const frame = compileRigFrame(elements(), { smile: 1 }, {}, {}, { shapeKeys });
  assert.equal(frame.mouth.path, 'M0 -1 L10 0 L10 10 Z');
});

test('a pathShape pose drives a shape key through the frame compiler', () => {
  const shapeKeys = [key('smile', SMILE)];
  const keyforms = [{
    id: 'mouth-smile-pose', target: { kind: 'element', id: 'mouth' }, channel: 'pathShape', shapeKey: 'smile',
    axes: [{ parameter: 'headX', values: [-1, 0, 1] }],
    keyforms: [{ at: [0], value: 0 }, { at: [2], value: 1 }]
  }];
  const frame = compileRigFrame(elements(), { headX: 1 }, {}, {}, { shapeKeys, keyforms });
  assert.equal(frame.mouth.path, 'M0 -2 L10 0 L10 10 Z');
});

test('an unchanged weight vector returns the previous string with no rebuild', () => {
  const { targets } = compileShapeKeys([key('smile', SMILE)], elements());
  const target = targets.get('mouth');
  const first = evaluateShapeTarget(target, Float64Array.from([0.5]));
  const again = evaluateShapeTarget(target, Float64Array.from([0.5]));
  assert.equal(first, again);
  assert.notEqual(evaluateShapeTarget(target, Float64Array.from([0.6])), first);
});

test('shape-key records are added, replaced and removed immutably', () => {
  const first = upsertShapeKey([], key('smile', SMILE));
  const replaced = upsertShapeKey(first, { ...key('smile', OPEN) });
  assert.equal(first.length, 1);
  assert.equal(replaced.length, 1);
  assert.deepEqual(replaced[0].delta, [0, 0, 0, 0, 0, 4]);
  assert.deepEqual(removeShapeKey(replaced, 'smile'), []);
  const driven = setShapeKeyDriver(first, 'smile', { mode: 'range', parameter: 'smile', min: 0, max: 1 });
  assert.equal(driven[0].driver.parameter, 'smile');
  assert.equal(first[0].driver.mode, 'none');
  assert.deepEqual(shapeKeysForTarget(driven, 'mouth').map((item) => item.id), ['smile']);
});

test('normalizeShapeKeys drops records that cannot be evaluated', () => {
  const records = normalizeShapeKeys({ shapeKeys: [key('smile', SMILE), { id: '', target: 'mouth', delta: [1] }, { id: 'x', target: '', delta: [1] }, { id: 'y', target: 'mouth', delta: [] }] });
  assert.deepEqual(records.map((item) => item.id), ['smile']);
});

test('normalizeRig carries shape keys and rest outlines through migration', () => {
  const rig = normalizeRig({
    params: {}, states: {},
    elements: { mouth: { baseTransform: {}, restPath: REST }, other: { baseTransform: {} } },
    shapeKeys: [key('smile', SMILE)]
  });
  assert.equal(rig.elements.mouth.restPath, REST);
  assert.equal('restPath' in rig.elements.other, false);
  assert.deepEqual(rig.shapeKeys.map((item) => item.id), ['smile']);
  assert.deepEqual(normalizeRig({ params: {}, states: {}, elements: {} }).shapeKeys, []);
});

test('shape-key diagnostics read like advice, not like a schema dump', () => {
  const issues = validateShapeKeys({
    elements: { mouth: { restPath: REST } }, params: {},
    shapeKeys: [{ id: 's', name: 'Smile', target: 'mouth', driver: { mode: 'range', parameter: 'smile', min: 0, max: 1 }, delta: [1, 2] }]
  });
  assert.ok(issues.some((issue) => /uses a movement that no longer exists: "smile"/.test(issue)));
  assert.ok(issues.some((issue) => /no longer matches the rest shape of "mouth"/.test(issue)));
});

test('shape-key diagnostics catch missing targets and rest outlines', () => {
  const of = (state) => validateShapeKeys({ params: {}, ...state });
  assert.ok(of({ elements: {}, shapeKeys: [{ id: 's', target: 'ghost', delta: [1] }] }).some((issue) => /the shape "ghost" it deforms no longer exists/.test(issue)));
  assert.ok(of({ elements: { mouth: {} }, shapeKeys: [{ id: 's', target: 'mouth', delta: [1] }] }).some((issue) => /no rest outline captured yet/.test(issue)));
  assert.ok(of({ elements: { mouth: { restPath: REST } }, shapeKeys: [{ id: 's', target: 'mouth', delta: [] }] }).some((issue) => /has no captured deformation/.test(issue)));
});

/* Legacy morph compatibility (V2-08) */

test('a legacy A/B morph converts to a rest shape plus one shape key', () => {
  const converted = shapeKeyFromLegacyMorph('mouth', { enabled: true, param: 'mouthOpen', min: 0, max: 1, pathA: REST, pathB: OPEN });
  assert.equal(converted.ok, true);
  assert.equal(converted.restPath, REST);
  assert.deepEqual(converted.shapeKey.delta, [0, 0, 0, 0, 0, 4]);
  assert.deepEqual(converted.shapeKey.driver, { mode: 'range', parameter: 'mouthOpen', min: 0, max: 1, clamp: true });
});

test('the converted shape key reproduces the legacy morph geometry', () => {
  const morph = { enabled: true, param: 'mouthOpen', min: 0, max: 1, pathA: REST, pathB: OPEN };
  const { shapeKey, restPath } = shapeKeyFromLegacyMorph('mouth', morph);
  const legacy = compileRigFrame({ mouth: { baseTransform: {}, morph } }, { mouthOpen: 0.25 }, {}, {});
  const upgraded = compileRigFrame({ mouth: { baseTransform: {}, restPath } }, { mouthOpen: 0.25 }, {}, {}, { shapeKeys: [shapeKey] });
  assert.equal(legacy.mouth.morph.progress, 0.25);
  assert.equal(upgraded.mouth.path, 'M0 0 L10 0 L10 11 Z');
});

test('converting a whole rig reports what could not be converted', () => {
  const result = migrateLegacyMorphs({
    elements: {
      mouth: { morph: { enabled: true, param: 'mouthOpen', min: 0, max: 1, pathA: REST, pathB: OPEN } },
      brow: { morph: { enabled: true, param: 'browRaise', pathA: REST, pathB: 'M0 0 C1 1 2 2 3 3' } },
      eye: { morph: { enabled: false, pathA: REST, pathB: OPEN } },
      nose: {}
    }
  });
  assert.deepEqual(result.shapeKeys.map((item) => item.id), ['mouth-morph']);
  assert.deepEqual(result.restPaths, { mouth: REST });
  assert.deepEqual(result.skipped.map((item) => item.id), ['brow']);
  assert.match(result.skipped[0].message, /different outline structure/);
});

test('legacy morphs keep rendering until an author chooses to convert them', () => {
  const morph = { enabled: true, param: 'mouthOpen', min: 0, max: 1, pathA: REST, pathB: OPEN };
  const rig = normalizeRig({ params: {}, states: {}, elements: { mouth: { baseTransform: {}, morph } } });
  assert.equal(rig.elements.mouth.morph.enabled, true);
  assert.deepEqual(rig.shapeKeys, []);
  assert.equal(compileRigFrame(rig.elements, { mouthOpen: 1 }, {}, {}).mouth.morph.progress, 1);
});
