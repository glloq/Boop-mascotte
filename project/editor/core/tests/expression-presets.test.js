import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPRESSION_PRESETS, instantiatePreset, presetAvailability } from '../expressions/expression-presets.js';
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

test('presets only use basic movement names and degrade to the controls a project has', () => {
  const basic = new Set(BASIC_MOVEMENTS.map((item) => item.id));
  for (const preset of EXPRESSION_PRESETS) for (const name of Object.keys(preset.controls)) assert.ok(basic.has(name), `${preset.id} uses unknown control ${name}`);
  assert.deepEqual(EXPRESSION_PRESETS.map((preset) => preset.id), ['happy', 'sad', 'angry', 'surprised', 'sleepy', 'confused', 'excited']);

  const basicFace = { params: { smile: number(-1, 1), mouthOpen: number(0, 1), eyeOpen: number(0, 1, 1), lookX: number(-1, 1) } };
  const surprised = instantiatePreset(basicFace, 'surprised');
  assert.deepEqual(surprised.controls, { mouthOpen: 1, eyeOpen: 1 });
  assert.deepEqual(surprised.missing, [{ control: 'browRaise', label: 'Eyebrows · Raise', part: 'eyebrows' }]);
  assert.equal(surprised.usable, true);

  const none = instantiatePreset({ params: {} }, 'angry');
  assert.equal(none.usable, false);
  assert.equal(none.missing.length, 4);
  assert.throws(() => instantiatePreset(basicFace, 'nope'), /Unknown expression preset/);

  const availability = presetAvailability(basicFace);
  assert.equal(availability.length, EXPRESSION_PRESETS.length);
  assert.equal(availability.find((item) => item.id === 'confused').usable, true, 'confused keeps smile even without brows or head');
  assert.deepEqual(availability.find((item) => item.id === 'confused').controls, { smile: -.2 });
});
