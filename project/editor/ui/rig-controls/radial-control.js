/**
 * The ring `○` — a size (docs/FACE_CONTROL_RIG.md, CR-02).
 *
 * A pupil dilating is not a value between two ends, it is a **size**, and a
 * slider is the wrong shape for one: nothing about a horizontal bar says
 * "bigger". A ring does, because the ring *is* the size — drag it outwards and
 * the pupil widens, inwards and it shrinks.
 *
 * The hole in the middle is not decoration. A ring an author can drag to
 * nothing collapses the artwork it scales and leaves nowhere to grab it again,
 * so the smallest radius is a real radius (`RADIAL_INNER`).
 */
import { RADIAL_INNER, RADIAL_OUTER, esc, place, radialRadius, round } from './control-geometry.js';

/**
 * A ring reads outwards, never upwards.
 *
 * `invert` says which way a *vertical* drag runs, and the pupil handles are
 * inverted so that dragging up on the mascot dilates. A ring has no up: out is
 * bigger whichever way the pointer came, so the flag is dropped before the
 * radius is worked out — otherwise the widest pupil would draw the smallest
 * ring (docs/FACE_CONTROL_RIG.md).
 */
export const radialAxis = (axis) => (axis?.invert ? { ...axis, invert: false } : axis);

/**
 * @param {object} handle a board row
 * @param {object} axis the one axis the ring drives
 */
export function renderRadialControl(handle, axis, { live = false, describe = () => '' } = {}) {
  const radius = radialRadius(radialAxis(axis));
  return `<figure class="pad-frame handle-radial">
    <figcaption class="pad-caption"><b>${esc(axis.label)}</b> <span class="pad-hint">${round(axis.value)}</span></figcaption>
    <svg viewBox="0 0 64 64" width="76" height="76" data-handle-drag="radial" data-handle-id="${esc(handle.id)}"
      role="slider" aria-valuemin="${round(axis.min)}" aria-valuemax="${round(axis.max)}" aria-valuenow="${round(axis.value)}"${describe(handle, 'radial', axis.label)}>
      <circle cx="32" cy="32" r="${round(RADIAL_INNER * 64)}" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 3"/>
      <circle cx="32" cy="32" r="${round(RADIAL_OUTER * 64)}" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 3"/>
      <circle cx="32" cy="32" r="${radius}" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle cx="32" cy="${round(32 - radius)}" r="4" fill="currentColor"/>
    </svg>
  </figure>`;
}

/** How full the ring is, for a caller that wants the number rather than the markup. */
export const radialControlFill = (axis) => place(radialAxis(axis));
