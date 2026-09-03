/**
 * Depth and parallax (docs/DEPTH_PARALLAX.md).
 *
 * There is no Z axis and no camera. Every element carries a scalar `depth`,
 * and the head pose nudges it sideways by a fraction of that:
 *
 * ```text
 * hairFront   +0.8
 * nose        +0.6
 * eyes        +0.3
 * face         0
 * ears        -0.2
 * hairBack    -0.8
 * ```
 *
 * ```js
 * offsetX = headX * depth * parallaxAmount
 * offsetY = headY * depth * parallaxAmount
 * ```
 *
 * That is enough to sell volume, and it costs two multiplications.
 */
import { finite, clamp } from './numeric.js';

export const DEFAULT_PARALLAX = Object.freeze({
  enabled: true, amount: 6, parameterX: 'headX', parameterY: 'headY',
  // Draw-order bands, and the margin that has to be crossed to change band.
  bands: [-0.35, 0.35], hysteresis: 0.08
});

/** Named bands, back to front. Hands use these as well as elements. */
export const DEPTH_BANDS = Object.freeze(['behind', 'normal', 'front']);

export function normalizeParallax(source = {}) {
  const raw = Array.isArray(source?.bands) ? source.bands.map(Number).filter((value) => Number.isFinite(value)) : null;
  return {
    enabled: source?.enabled !== false,
    amount: finite(source?.amount, DEFAULT_PARALLAX.amount),
    parameterX: typeof source?.parameterX === 'string' && source.parameterX ? source.parameterX : DEFAULT_PARALLAX.parameterX,
    parameterY: typeof source?.parameterY === 'string' && source.parameterY ? source.parameterY : DEFAULT_PARALLAX.parameterY,
    bands: raw && raw.length === 2 ? [...raw].sort((a, b) => a - b) : [...DEFAULT_PARALLAX.bands],
    hysteresis: Math.max(0, finite(source?.hysteresis, DEFAULT_PARALLAX.hysteresis))
  };
}

/** The sideways nudge a depth value earns at the current head pose. */
export function parallaxOffset(depth, values = {}, parallax = DEFAULT_PARALLAX) {
  if (!parallax.enabled) return { x: 0, y: 0 };
  const scale = finite(depth, 0) * finite(parallax.amount, 0);
  return {
    x: finite(values[parallax.parameterX], 0) * scale,
    y: finite(values[parallax.parameterY], 0) * scale
  };
}

/**
 * Which band a depth belongs to.
 *
 * `previous` adds hysteresis: an element already at the front has to come back
 * past the boundary *plus* a margin before it drops behind. Without it a depth
 * hovering on a boundary would swap draw order every frame and flicker.
 */
export function depthBand(depth, parallax = DEFAULT_PARALLAX, previous = null) {
  const value = finite(depth, 0);
  const [low, high] = parallax.bands;
  const margin = previous ? parallax.hysteresis : 0;
  const lowEdge = previous === 'behind' ? low + margin : low;
  const highEdge = previous === 'front' ? high - margin : high;
  if (value <= lowEdge) return 'behind';
  if (value >= highEdge) return 'front';
  return 'normal';
}

/**
 * Assign a stable band to every element with a depth.
 *
 * @param {Record<string, number>} depths
 * @param {Record<string, string>} previous last frame's bands
 */
export function depthBands(depths = {}, parallax = DEFAULT_PARALLAX, previous = {}) {
  const bands = {};
  for (const [id, depth] of Object.entries(depths)) bands[id] = depthBand(depth, parallax, previous?.[id] || null);
  return bands;
}

/** Draw order within a band, back to front — a stable sort by depth then id. */
export function depthOrder(depths = {}) {
  return Object.entries(depths)
    .sort(([idA, a], [idB, b]) => (finite(a, 0) - finite(b, 0)) || idA.localeCompare(idB))
    .map(([id]) => id);
}

export function clampDepth(value) {
  return clamp(finite(value, 0), -1, 1);
}
