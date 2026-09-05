/**
 * The two numeric guards every runtime module needs.
 *
 * They live in their own module because the runtime is exported as one
 * concatenated file: a helper declared twice would be a duplicate top-level
 * name, and therefore a syntax error, in the bundle.
 */

/** `value` when it is a finite number, otherwise `fallback`. */
export function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * `value` rounded to `places` decimals.
 *
 * Solvers accumulate: a contribution added to a parameter and read back next
 * frame drags a tail of binary noise behind it, and a pose that should be
 * exactly at rest reads as `-2.7e-17` instead. Rounding where a value leaves a
 * solver keeps "at rest" comparable and keeps a saved project diffable.
 */
export function roundTo(value, places = 5) {
  const scale = 10 ** places;
  return Math.round(finite(value, 0) * scale) / scale;
}
