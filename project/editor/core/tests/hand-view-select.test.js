import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_VIEW_HYSTERESIS, HAND_VIEW_THRESHOLDS, createHandViewSelector, handRotationAdvice, handViewAngleFromValue,
  handViewBand, handViewMode, normalizeHandViewThresholds, selectHandView, viewForAngle
} from '../../../runtime/hand-view-select.js';

/**
 * Picking a view from an orientation (docs/HANDS_2D.md, PHASES 16-19).
 * The interesting property is the one hysteresis buys: a hand sitting on a
 * boundary keeps one drawing instead of strobing between two.
 */

test('an angle falls in the view whose band it is in', () => {
  assert.equal(viewForAngle(-90), 'sideLeft');
  assert.equal(viewForAngle(-68), 'sideLeft');
  assert.equal(viewForAngle(-45), 'threeQuarterLeft');
  assert.equal(viewForAngle(0), 'front');
  assert.equal(viewForAngle(45), 'threeQuarterRight');
  assert.equal(viewForAngle(90), 'sideRight');
  assert.equal(viewForAngle(1000), 'sideRight');
  assert.equal(viewForAngle(-1000), 'sideLeft');
});

test('a band is half-open, so a threshold belongs to the view above it', () => {
  assert.equal(viewForAngle(-67.5), 'threeQuarterLeft');
  assert.equal(viewForAngle(-22.5), 'front');
  assert.equal(viewForAngle(22.5), 'threeQuarterRight');
  assert.equal(viewForAngle(67.5), 'sideRight');
});

test('an angle that is not a number is the front', () => {
  assert.equal(viewForAngle(NaN), 'front');
  assert.equal(viewForAngle(undefined), 'front');
  assert.equal(viewForAngle('nonsense'), 'front');
});

test('the thresholds are configurable, and rubbish falls back to the defaults', () => {
  // Wider bands: -30 is still the front here, where the default thresholds
  // would already have called it a three quarter.
  assert.equal(viewForAngle(-30, [-80, -40, 40, 80]), 'front');
  assert.equal(viewForAngle(-50, [-80, -40, 40, 80]), 'threeQuarterLeft');
  assert.equal(viewForAngle(-30), 'threeQuarterLeft');
  assert.deepEqual(normalizeHandViewThresholds([1, 2]), [...HAND_VIEW_THRESHOLDS]);
  assert.deepEqual(normalizeHandViewThresholds(null), [...HAND_VIEW_THRESHOLDS]);
  assert.deepEqual(normalizeHandViewThresholds([40, -80, 80, -40]), [-80, -40, 40, 80]);
});

test('each view owns a band, open at either end of the row', () => {
  assert.deepEqual(handViewBand('sideLeft'), [-Infinity, -67.5]);
  assert.deepEqual(handViewBand('front'), [-22.5, 22.5]);
  assert.deepEqual(handViewBand('sideRight'), [67.5, Infinity]);
});

test('a normalized orientation is degrees, clamped to the sweep', () => {
  assert.equal(handViewAngleFromValue(0), 0);
  assert.equal(handViewAngleFromValue(1), 90);
  assert.equal(handViewAngleFromValue(-1), -90);
  assert.equal(handViewAngleFromValue(5), 90);
  assert.equal(handViewAngleFromValue(0.5, 60), 30);
  assert.equal(handViewAngleFromValue('nonsense'), 0);
});

test('a hand sitting on a boundary keeps the drawing it has', () => {
  const selector = createHandViewSelector({});
  assert.equal(selector.select(0), 'front');
  // Past the threshold, but not past it by the hysteresis.
  assert.equal(selector.select(23), 'front');
  assert.equal(selector.select(28), 'front');
  // Past it properly.
  assert.equal(selector.select(30), 'threeQuarterRight');
  // ...and coming back costs the same margin the other way.
  assert.equal(selector.select(20), 'threeQuarterRight');
  assert.equal(selector.select(17), 'threeQuarterRight');
  assert.equal(selector.select(14), 'front');
});

test('a hand shaking on a boundary changes drawing once, not once a frame', () => {
  const selector = createHandViewSelector({});
  selector.select(0);
  const seen = [];
  for (let i = 0; i < 40; i += 1) seen.push(selector.select(22.5 + Math.sin(i) * 4));
  assert.deepEqual([...new Set(seen)], ['front']);
});

test('hysteresis holds a decision back, it never drags one along', () => {
  const selector = createHandViewSelector({});
  selector.select(0);
  assert.equal(selector.select(-90), 'sideLeft');
  assert.equal(selector.select(90), 'sideRight');
});

test('the hysteresis is configurable, and zero restores bare thresholds', () => {
  assert.equal(HAND_VIEW_HYSTERESIS, 6);
  const sharp = createHandViewSelector({ hysteresis: 0 });
  sharp.select(0);
  assert.equal(sharp.select(23), 'threeQuarterRight');
  assert.equal(sharp.select(22), 'front');
  const wide = createHandViewSelector({ hysteresis: 20 });
  wide.select(0);
  assert.equal(wide.select(40), 'front');
  assert.equal(wide.select(43), 'threeQuarterRight');
});

test('manual mode keeps the view it is given and never consults an angle', () => {
  const selector = createHandViewSelector({});
  assert.equal(selectHandView({ mode: 'manual', view: 'sideLeft', orientation: 1 }, selector), 'sideLeft');
  assert.equal(selector.view, 'sideLeft');
  assert.equal(selectHandView({ view: 'front', orientation: 1 }, selector), 'front');
  assert.equal(handViewMode('anything'), 'manual');
  assert.equal(handViewMode('auto'), 'auto');
});

test('automatic mode reads the orientation, and prefers an explicit angle to it', () => {
  assert.equal(selectHandView({ mode: 'auto', orientation: 1 }), 'sideRight');
  assert.equal(selectHandView({ mode: 'auto', orientation: -0.6 }), 'threeQuarterLeft');
  assert.equal(selectHandView({ mode: 'auto', angle: -80, orientation: 1 }), 'sideLeft');
  // A null angle is "none given", not zero.
  assert.equal(selectHandView({ mode: 'auto', angle: null, orientation: 1 }), 'sideRight');
});

test('switching to manual takes the selector with it, so automatic resumes from there', () => {
  const selector = createHandViewSelector({});
  selectHandView({ mode: 'auto', orientation: 1 }, selector);
  assert.equal(selector.view, 'sideRight');
  selectHandView({ mode: 'manual', view: 'front' }, selector);
  assert.equal(selector.view, 'front');
  assert.equal(selectHandView({ mode: 'auto', orientation: 0.3 }, selector), 'front');
});

test('a preferred rotation range is advice, and reports the nearest turn inside it', () => {
  assert.deepEqual(handRotationAdvice(30, [-70, 70]), { within: true, nearest: 30, range: [-70, 70] });
  assert.deepEqual(handRotationAdvice(120, [-70, 70]), { within: false, nearest: 70, range: [-70, 70] });
  assert.deepEqual(handRotationAdvice(-200, [-70, 70]).nearest, -70);
  assert.equal(handRotationAdvice(179, null).within, true);
  assert.equal(handRotationAdvice('nonsense', [-70, 70]).nearest, 0);
});
