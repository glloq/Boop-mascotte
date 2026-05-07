import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFaceSvg } from '../assets/face-builder.js';

test('face builder generates svg with expected ids', () => {
  const svg = buildFaceSvg({ head: 'square', eyes: 'dot', mouth: 'flat' });
  assert.ok(svg.includes('id="head"'));
  assert.ok(svg.includes('id="eyeLeft"'));
  assert.ok(svg.includes('id="mouth"'));
});
