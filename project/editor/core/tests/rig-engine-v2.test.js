import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, evaluateExpression } from '../../../runtime/runtime.js';
import { compileFrame } from '../preview-runtime/frame-compiler.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { validateRig } from '../validation/rig-validator.js';
import { addParam, removeParam, renameParam } from '../rig/parameters.js';
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';

const binding = (expression, amplitude = 1, offset = 0) => ({ enabled: true, expression, curve: 'linear', amplitude, offset });
const element = (overrides = {}) => ({ baseTransform: { x: 100, y: 8, rotation: 20, scaleX: 2, scaleY: 3, pivotX: 12, pivotY: 14 }, baseOpacity: .8, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, ...overrides });

test('base transform and all generic bindings compose into a final frame', () => {
  const subject = element({ bindings: { translateX: binding('customFoo', 20), translateY: binding('customBar', 4), rotation: binding('customFoo', 15), scaleX: binding('customFoo', 1.5), scaleY: binding('customFoo', .5), opacity: binding('customFoo', .5) } });
  const frame = compileRigFrame({ face: subject }, { customFoo: 1, customBar: .5 }).face;
  assert.deepEqual(frame.transform, { x: 120, y: 10, rotation: 35, scaleX: 3, scaleY: 1.5, pivotX: 12, pivotY: 14 });
  assert.equal(frame.opacity, .4);
});

test('constraints scale only animation and preserve base values', () => {
  const subject = element({ constraints: { translate: false, rotate: false, scale: false }, bindings: { translateX: binding('p', 10), rotation: binding('p', 15), scaleX: binding('p', 2) } });
  assert.deepEqual(compileRigFrame({ e: subject }, { p: 1 }).e.transform, subject.baseTransform);
  subject.constraints = { translate: true, rotate: true, scale: true };
  const actual = compileRigFrame({ e: subject }, { p: 1 }, { translate: .8, rotate: 1, scale: 1 }, { translate: .5, rotate: 1, scale: 1 }).e.transform;
  assert.equal(actual.x, 104);
});

test('curve, amplitude and offset retain correct magnitudes', () => {
  for (const value of [-1, -.5, 0, .5, 1]) {
    const frame = compileRigFrame({ e: element({ bindings: { translateX: binding('p', 8, 2) } }) }, { p: value }).e;
    assert.equal(frame.transform.x, 100 + value * 8 + 2);
  }
});

test('safe expressions accept dynamic parameters and reject executable syntax', () => {
  assert.equal(evaluateExpression('customFoo * 4 + customBar * 2', { customFoo: 2, customBar: 3 }), 14);
  assert.equal(evaluateExpression('-(customFoo + 1)', { customFoo: 2 }), -3);
  for (const expression of ['headX ** 2', 'foo()', 'window.alert()', 'constructor']) assert.equal(evaluateExpression(expression, {}), 0);
});

test('editor wrapper and runtime compiler have numeric parity', () => {
  const elements = { e: element({ bindings: { translateX: binding('p', 8), opacity: binding('p', .5) } }) };
  const runtime = compileRigFrame(elements, { p: .5 }, { translate: .8 }, { translate: .5 });
  const editor = compileFrame(elements, { p: .5 }, { translate: .8 }, { translate: .5 });
  assert.deepEqual(editor.frames, runtime);
});

test('legacy rigs migrate and round-trip as current schema', () => {
  const legacy = { params: { headX: 0 }, states: { idle: { headX: 1 } }, activeState: 'idle', elements: { e: { x: 5, y: 2, rotation: 3, scaleX: 1, scaleY: 1, bindings: { translateX: 'headX * 8' }, bindingCurves: { translateX: 'linear' } } } };
  const migrated = normalizeRig(legacy), roundTrip = normalizeRig(JSON.parse(JSON.stringify(migrated)));
  assert.equal(migrated.schemaVersion, RIG_SCHEMA_VERSION);
  assert.deepEqual(roundTrip, migrated);
  assert.equal(compileRigFrame(migrated.elements, { headX: 1 }).e.transform.x, 13);
});

test('validator reports unknown params and parameter API supports management', () => {
  const params = {}; addParam(params, 'customFoo', { min: 0, max: 2, default: 1 }); renameParam(params, 'customFoo', 'customBar'); removeParam(params, 'customBar'); assert.deepEqual(params, {});
  const rig = normalizeRig({ params: { known: 0 }, states: { idle: { known: 0 } }, activeState: 'idle', elements: { eye: element({ bindings: { rotation: binding('lookZ') } }) } });
  assert.match(validateRig(rig).join('\n'), /Element "eye": binding rotation references unknown parameter "lookZ"/);
});
