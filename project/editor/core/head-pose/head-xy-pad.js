/**
 * Head XY pad (docs/HEAD_POSE_2_5D.md).
 *
 * Pure geometry for the live preview pad: pointer, touch and keyboard all go
 * through the same three functions, so the three input methods cannot drift.
 *
 * ```text
 *       ↑
 *       │
 * ←─────●─────→
 *       │
 *       ↓
 * ```
 *
 * The pad's Y axis matches `headY` itself, which grows **downwards** like every
 * vertical parameter in the rig (`headY`/`lookY` are calibrated UP at -1, DOWN
 * at +1). So the top of the pad is the axis minimum: drag the handle up and the
 * head goes up. It used to be inverted here, and dragging up moved the head
 * down.
 */
import { createHeadPoseAxes } from './head-pose-model.js';

export const DEFAULT_PAD_STEP = 0.1;
export const PAD_KEYS = Object.freeze({
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
});

const bounds = (axis) => ({ min: axis.values[0], max: axis.values[axis.values.length - 1] });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Pointer or touch position inside the pad → parameter values. */
export function padValueFromPoint({ x, y, width, height }, axes = createHeadPoseAxes()) {
  const horizontal = bounds(axes.x);
  const vertical = bounds(axes.y);
  const u = width > 0 ? clamp(Number(x) / width, 0, 1) : 0.5;
  const v = height > 0 ? clamp(Number(y) / height, 0, 1) : 0.5;
  return {
    [axes.x.parameter]: horizontal.min + u * (horizontal.max - horizontal.min),
    // Top of the pad is the axis minimum, which is where the head looks up.
    [axes.y.parameter]: vertical.min + v * (vertical.max - vertical.min)
  };
}

/** Parameter values → the handle's position inside the pad. */
export function padPointFromValue(values = {}, { width, height } = { width: 1, height: 1 }, axes = createHeadPoseAxes()) {
  const horizontal = bounds(axes.x);
  const vertical = bounds(axes.y);
  const spanX = horizontal.max - horizontal.min || 1;
  const spanY = vertical.max - vertical.min || 1;
  const x = (clamp(number(values[axes.x.parameter]), horizontal.min, horizontal.max) - horizontal.min) / spanX;
  const y = (clamp(number(values[axes.y.parameter]), vertical.min, vertical.max) - vertical.min) / spanY;
  return { x: x * width, y: y * height };
}

/**
 * Keyboard nudge. Returns `null` for a key the pad does not own, so a caller
 * knows not to swallow the event.
 */
export function padKeyboardValue(values = {}, key, { step = DEFAULT_PAD_STEP, axes = createHeadPoseAxes(), coarse = false } = {}) {
  if (key === 'Home' || key === 'Escape') return padCenter(axes);
  const direction = PAD_KEYS[key];
  if (!direction) return null;
  const horizontal = bounds(axes.x);
  const vertical = bounds(axes.y);
  const amount = coarse ? step * 5 : step;
  return {
    ...values,
    [axes.x.parameter]: clamp(number(values[axes.x.parameter]) + direction[0] * amount, horizontal.min, horizontal.max),
    [axes.y.parameter]: clamp(number(values[axes.y.parameter]) + direction[1] * amount, vertical.min, vertical.max)
  };
}

/** The rest position: the axis value nearest zero on each side. */
export function padCenter(axes = createHeadPoseAxes()) {
  const nearestZero = (axis) => axis.values.reduce((best, value) => Math.abs(value) < Math.abs(best) ? value : best, axis.values[0]);
  return { [axes.x.parameter]: nearestZero(axes.x), [axes.y.parameter]: nearestZero(axes.y) };
}

function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
