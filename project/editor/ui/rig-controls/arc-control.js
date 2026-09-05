/**
 * The arc `↻` — a turn (docs/FACE_CONTROL_RIG.md, CR-02).
 *
 * A tilt is a turn of the wrist. Dragging a bar sideways to rotate something is
 * a translation standing in for a rotation, and it reads as one: the arc puts
 * the gesture and the movement in the same shape.
 *
 * `throw` is how many degrees of pointer travel cover the movement's whole
 * range, which is the same number the canvas turns a wrist by — so the dial and
 * the mascot agree about how far a turn is.
 */
import { dialArc, dialPoint, esc, place, round, sweepOf } from './control-geometry.js';

export function renderArcControl(handle, axis, { live = false, describe = () => '' } = {}) {
  const sweep = sweepOf(handle), angle = (place(axis) - 0.5) * sweep;
  const [nx, ny] = dialPoint(angle, 22);
  return `<figure class="pad-frame handle-arc">
    <figcaption class="pad-caption"><b>${esc(axis.label)}</b> <span class="pad-hint">${round(axis.value)}</span></figcaption>
    <svg viewBox="0 0 64 64" width="76" height="76" data-handle-drag="arc" data-handle-id="${esc(handle.id)}"
      role="slider" aria-valuemin="${round(axis.min)}" aria-valuemax="${round(axis.max)}" aria-valuenow="${round(axis.value)}"${describe(handle, 'arc', axis.label)}>
      <path d="${dialArc(-sweep / 2, sweep / 2, 22)}" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="4" stroke-linecap="round"/>
      <path d="${dialArc(0, angle, 22)}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <line x1="32" y1="32" x2="${nx}" y2="${ny}" stroke="currentColor" stroke-width="2"/>
      <circle cx="${nx}" cy="${ny}" r="5" fill="currentColor"/>
    </svg>
  </figure>`;
}
