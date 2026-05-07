import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from '../state/transition-guard.js';

test('transition guard allows transition when listed', () => {
  const graph = { idle: ['happy'] };
  assert.equal(canTransition(graph, 'idle', 'happy'), true);
});

test('transition guard blocks transition when not listed', () => {
  const graph = { idle: ['happy'] };
  assert.equal(canTransition(graph, 'idle', 'sad'), false);
});
