import test from 'node:test';
import assert from 'node:assert/strict';
import { validateElementRig, validateRig } from '../validation/rig-validator.js';
import { normalizeRig } from '../rig/normalize-rig.js';

test('validator catches missing morph paths when enabled', () => {
  const issues = validateElementRig({
    bindings: { translateX: 'headX * 2' },
    morph: { enabled: true, min: -1, max: 1, pathA: '', pathB: '' }
  });
  assert.ok(issues.some((s) => s.includes('pathA/pathB')));
});

test('validator catches invalid characters in binding expression', () => {
  const issues = validateElementRig({
    bindings: { translateX: 'headX; alert(1)' },
    morph: { enabled: false }
  });
  assert.ok(issues.some((s) => s.includes('unsupported characters')));
});

test('validator reports malformed behaviors and transition settings precisely', () => {
  const rig = normalizeRig({ params: { eyeOpen: 1 }, states: { idle: { eyeOpen: 1 }, happy: { eyeOpen: .5 } }, activeState: 'idle', transitions: { idle: [] }, elements: {} });
  rig.behaviors = [
    { type: 'unknown', parameter: 'missing' },
    { type: 'blink', parameter: 'eyeOpen', duration: 0, intervalMin: 5, intervalMax: 2 },
    { type: 'oscillator', parameter: 'eyeOpen', frequency: -1, amplitude: Number.NaN }
  ];
  rig.transitionSettings = { 'idle->happy': { duration: 0, easing: 'bounce' }, 'missing->idle': { duration: 10, easing: 'linear' } };
  const issues = validateRig(rig).join('\n');
  assert.match(issues, /unknown behavior type/); assert.match(issues, /parameter "missing" does not exist/);
  assert.match(issues, /duration must be finite and greater than 0/); assert.match(issues, /intervalMin must be less than or equal/);
  assert.match(issues, /frequency must be finite and non-negative/); assert.match(issues, /amplitude must be finite/);
  assert.match(issues, /corresponding transition is not allowed/); assert.match(issues, /unsupported easing "bounce"/); assert.match(issues, /source state does not exist/);
});
