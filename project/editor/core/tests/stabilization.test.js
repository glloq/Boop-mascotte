import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCurve } from '../bindings/curve.js';
import { compileFrame } from '../preview-runtime/frame-compiler.js';
import { evaluateExpression, curveValue, canTransition } from '../../../runtime/runtime.js';
import { sanitizeSvgMarkup } from '../security/sanitize-svg.js';
import { createSampleProject, createStore } from '../state/store.js';
import { applyImportedRig } from '../state/import-rig.js';

const element = (extra = {}) => ({
  x: 12, y: 7, rotation: 30, scaleX: 2, scaleY: 3, pivotX: 0, pivotY: 0,
  constraints: { translate: true, rotate: true, scale: true },
  bindings: { translateX: 'headX * 8' }, bindingCurves: { translateX: 'linear' },
  morph: { enabled: false }, ...extra
});

test('binding amplitude is preserved consistently by preview and runtime', () => {
  assert.equal(applyCurve(8, 'linear'), 8);
  assert.equal(curveValue(evaluateExpression('headX * 8', { headX: 1 }), 'linear'), 8);
  assert.equal(compileFrame({ head: element() }, { headX: 1 }).transforms.head.x, 20);
});

test('animation is a delta and disabled constraints preserve base transform', () => {
  const frame = compileFrame({ head: element({ constraints: { translate: false, rotate: false, scale: false } }) }, { headX: 1 });
  assert.deepEqual(frame.transforms.head, { x: 12, y: 7, rotation: 30, scaleX: 2, scaleY: 3, pivotX: 0, pivotY: 0 });
});

test('invalid morph cannot break frame compilation', () => {
  const broken = element({ morph: { enabled: true, param: 'x', min: 0, max: 0, pathA: 'M 0 0', pathB: 'M 0' } });
  assert.deepEqual(compileFrame({ broken }, { x: Infinity }).paths, {});
});

test('runtime expression evaluator rejects code and handles invalid arithmetic', () => {
  assert.equal(evaluateExpression('unknown + 2', {}), 2);
  assert.equal(evaluateExpression('1 / 0', {}), 0);
  assert.equal(evaluateExpression('globalThis.alert(1)', {}), 0);
  assert.equal(evaluateExpression('2 * (3 + 1)', {}), 8);
});

test('SVG sanitizer removes common script execution vectors', () => {
  const clean = sanitizeSvgMarkup('<svg onload="evil()"><script>evil()</script><foreignObject>x</foreignObject><a href="javascript:evil()" onclick="evil()"/></svg>');
  assert.doesNotMatch(clean, /script|foreignObject|onload|onclick|javascript:/i);
});

test('SVG sanitizer preserves quoted local CSS fragments and rejects external CSS', () => {
  const safe=sanitizeSvgMarkup(`<svg><defs><linearGradient id="g"/><clipPath id="c"/></defs><rect fill='url("#g")' clip-path="url('#c')"/><circle style="filter:url('#g')"/></svg>`);
  assert.match(safe,/url\(&quot;#g&quot;\)|url\("#g"\)/);assert.match(safe,/url\(&apos;#c&apos;\)|url\('#c'\)/);
  const hostile=sanitizeSvgMarkup(`<svg><rect style="fill:url(https://evil.test/x)"/><style>@import 'https://evil.test/x';</style></svg>`);
  assert.doesNotMatch(hostile,/evil\.test|@import/);
});

test('stores are isolated and partial rigs merge nested element defaults', () => {
  const first = createStore();
  first.replaceState(createSampleProject());
  first.setState((state) => { state.params.headX.value = 1; state.elements.head = element(); });
  const second = createStore();
  second.replaceState(createSampleProject());
  assert.equal(second.getState().params.headX.value, 0);
  first.setState((state) => applyImportedRig(state, { elements: { head: { constraints: { rotate: false } } }, runtimeConfig: { blink: false }, activeState: 'missing' }));
  assert.deepEqual(first.getState().elements.head.constraints, { translate: true, rotate: false, scale: true });
  assert.equal(first.getState().activeState, 'idle');
  assert.equal(first.getState().runtimeConfig.idleMotion, 0);
});

test('transition policy rejects invalid runtime states', () => {
  assert.equal(canTransition({ idle: ['happy'] }, 'idle', 'sad'), false);
});
