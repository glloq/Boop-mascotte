/**
 * The maths every rig control shares (docs/FACE_CONTROL_RIG.md).
 *
 * A control has to answer two questions and no more: *where does this value
 * sit on me*, and *what value is the pointer asking for*. Everything else —
 * the reticle, the ring, the dial — is drawing. Keeping the two questions in
 * one module is what stops a target and a pad from disagreeing about which way
 * up an inverted axis reads.
 *
 * Pure, DOM-free, and unit-testable: the controls build markup from it, the
 * board maps pointers through it.
 */
export const round = (value) => Math.round(Number(value) * 100) / 100;
export const exact = (value) => Math.round(Number(value) * 1000) / 1000;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
export const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * Where a value sits along its own control, 0 at the start and 1 at the end.
 *
 * An inverted axis reads **upwards** — `eyeOpen` closes as the pointer goes
 * down — so the control has to agree with the handle on the mascot, or the
 * same movement would go two ways in two places.
 */
export const place = (axis, value = axis?.value) => {
  const span = axis.max - axis.min;
  const at = span ? (clamp(number(value, axis.min), axis.min, axis.max) - axis.min) / span : 0.5;
  return axis.invert ? 1 - at : at;
};

/** The same mapping read backwards, landed on the axis's own step. */
export const valueAt = (axis, at) => {
  const t = clamp(axis.invert ? 1 - at : at, 0, 1);
  const step = number(axis.snap, 0);
  const raw = axis.min + t * (axis.max - axis.min);
  return exact(clamp(step > 0 ? Math.round(raw / step) * step : raw, axis.min, axis.max));
};

export const percent = (fraction) => `${round(clamp(fraction, 0, 1) * 100)}%`;

const RAD = Math.PI / 180;
/** A point on a dial, `angle` degrees clockwise from straight up. */
export const dialPoint = (angle, radius, centre = 32) => [round(centre + radius * Math.sin(angle * RAD)), round(centre - radius * Math.cos(angle * RAD))];

export const dialArc = (from, to, radius, centre = 32) => {
  const [x1, y1] = dialPoint(from, radius, centre), [x2, y2] = dialPoint(to, radius, centre);
  return `M${x1} ${y1}A${radius} ${radius} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to >= from ? 1 : 0} ${x2} ${y2}`;
};

/** How many degrees of turn cover an arc's whole range, kept drawable. */
export const sweepOf = (handle) => clamp(Math.abs(number(handle?.throw, 120)), 30, 340);

/** The angle the pointer is at, around a box's centre, in degrees. */
export const angleIn = (box, point) => Math.atan2(point.clientX - (box.left + box.width / 2), (box.top + box.height / 2) - point.clientY) / RAD;

/**
 * A ring's smallest and largest radius, as a fraction of its own box.
 *
 * The hole in the middle is deliberate: a ring an author can drag to nothing
 * would collapse the artwork it scales, and there is nowhere left to grab.
 */
export const RADIAL_INNER = 0.16;
export const RADIAL_OUTER = 0.46;

/** Where the pointer sits between the ring's two radii, 0 to 1. */
export function radialFraction(box, point) {
  const size = Math.min(box.width, box.height) || 1;
  const distance = Math.hypot(point.clientX - (box.left + box.width / 2), point.clientY - (box.top + box.height / 2)) / size;
  return clamp((distance - RADIAL_INNER) / (RADIAL_OUTER - RADIAL_INNER), 0, 1);
}

/** The radius a value is drawn at, in a 64×64 dial's own units. */
export const radialRadius = (axis, value = axis?.value) =>
  round((RADIAL_INNER + place(axis, value) * (RADIAL_OUTER - RADIAL_INNER)) * 64);
