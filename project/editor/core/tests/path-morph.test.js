import test from 'node:test';
import assert from 'node:assert/strict';
import { morphPath } from '../morph/path-morph.js';

test('morphPath interpolates numeric tokens', () => {
  const out = morphPath('M 0 0 L 10 10', 'M 0 0 L 20 20', 0.5);
  assert.equal(out, 'M 0 0 L 15 15');
});

test('morphPath throws for incompatible token length', () => {
  assert.throws(() => morphPath('M 0 0', 'M 0 0 L 10 10', 0.5));
});
