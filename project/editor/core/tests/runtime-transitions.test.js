import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from '../../../runtime/runtime.js';

test('canTransition allows unrestricted graph', () => {
  assert.equal(canTransition(undefined, 'idle', 'happy'), true);
});

test('canTransition enforces configured transitions', () => {
  const transitions = { idle: ['happy'], happy: ['idle'] };
  assert.equal(canTransition(transitions, 'idle', 'happy'), true);
  assert.equal(canTransition(transitions, 'idle', 'sad'), false);
});

test('transition contract distinguishes missing, empty, listed, unknown, and same state', () => {
  assert.equal(canTransition({}, 'idle', 'happy'), true);
  assert.equal(canTransition({ idle: [] }, 'idle', 'happy'), false);
  assert.equal(canTransition({ idle: ['happy'] }, 'idle', 'happy'), true);
  assert.equal(canTransition({ idle: ['happy'] }, 'idle', 'unknown'), false);
  assert.equal(canTransition({ idle: [] }, 'idle', 'idle'), true);
});
