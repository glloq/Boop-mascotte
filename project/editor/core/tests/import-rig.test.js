import test from 'node:test';
import assert from 'node:assert/strict';
import { applyImportedRig } from '../state/import-rig.js';

test('applyImportedRig merges known fields and keeps unknown elements untouched', () => {
  const state = {
    params: { headX: 0 },
    states: { idle: { headX: 0 } },
    transitions: { idle: ['happy'] },
    activeState: 'idle',
    elements: { mouth: { x: 0 }, eye: { x: 0 } },
    globalConstraints: { translate: 1 },
    stateConstraints: { idle: { translate: 1 } },
    runtimeConfig: { blink: true }
  };

  applyImportedRig(state, {
    params: { headX: 0.7 },
    activeState: 'idle',
    elements: { mouth: { x: 5 }, unknown: { x: 9 } },
    globalConstraints: { translate: 0.5 },
    stateConstraints: { idle: { translate: 0.8 } },
    runtimeConfig: { blink: false }
  });

  assert.equal(state.params.headX, 0.7);
  assert.equal(state.elements.mouth.x, 5);
  assert.equal(state.elements.eye.x, 0);
  assert.equal(state.globalConstraints.translate, 0.5);
  assert.equal(state.stateConstraints.idle.translate, 0.8);
  assert.equal(state.runtimeConfig.blink, false);
});
