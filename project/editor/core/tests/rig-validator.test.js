import test from 'node:test';
import assert from 'node:assert/strict';
import { validateElementRig } from '../validation/rig-validator.js';

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
