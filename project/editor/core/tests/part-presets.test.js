import test from 'node:test';
import assert from 'node:assert/strict';
import { PART_PRESETS, suggestPresetForElement } from '../assets/part-presets.js';

test('suggestPresetForElement maps ids to semantic part presets', () => {
  assert.equal(suggestPresetForElement('eyeLeft'), 'eye');
  assert.equal(suggestPresetForElement('mouthMain'), 'mouth');
  assert.equal(suggestPresetForElement('headRoot'), 'head');
});

test('mouth preset enables morph defaults', () => {
  const element = { morph: {}, constraints: {}, bindings: {}, bindingCurves: {} };
  PART_PRESETS.mouth.apply(element);
  assert.equal(element.morph.enabled, true);
  assert.equal(element.morph.param, 'mouthOpen');
  assert.equal(element.bindings.translateX, 'mouthOpen * 1.5');
});
