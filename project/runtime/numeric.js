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
