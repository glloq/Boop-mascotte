/**
 * The target `●` — a point in space (docs/FACE_CONTROL_RIG.md, CR-02).
 *
 * A pad says "two movements, one at a time or both at once". A **target** says
 * something narrower and more useful: *this is a place, and the character is
 * pointed at it*. A gaze is a target, an eye's own aim is a target, and a hand
 * reaching for something is a target — none of them is "`lookX` and `lookY`
 * happen to share a widget".
 *
 * Drawn as a reticle rather than a field: rings out from the centre, crosshairs
 * through it, and the dot where the value is. The rings are what make "how far
 * from straight ahead is this" readable at a glance, which is the question an
 * animator asks of a gaze and never asks of a pad.
 */
import { esc, percent, place, round } from './control-geometry.js';

/** Where the dot sits, as CSS custom properties the frame positions it with. */
export const targetControlPosition = (x, y) => ({ x: percent(place(x)), y: percent(place(y)) });

/**
 * @param {object} handle a board row
 * @param {object} x the sideways axis
 * @param {object} y the up-and-down axis
 * @param {{live?:boolean, describe?:function}} options
 */
export function renderTargetControl(handle, x, y, { live = false, describe = () => '' } = {}) {
  const label = `${x.label} · ${y.label}`;
  const at = targetControlPosition(x, y);
  return `<figure class="pad-frame handle-target">
    <figcaption class="pad-caption"><b>${esc(label)}</b> <span class="pad-hint">${round(x.value)} · ${round(y.value)}</span></figcaption>
    <div class="target-pad" data-handle-drag="target" data-handle-id="${esc(handle.id)}" role="application"${describe(handle, 'target', label)}
      style="--x:${at.x};--y:${at.y}">
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-opacity=".18"/>
        <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-opacity=".14"/>
        <circle cx="32" cy="32" r="7" fill="none" stroke="currentColor" stroke-opacity=".14"/>
        <line x1="32" y1="2" x2="32" y2="12" stroke="currentColor" stroke-opacity=".3"/>
        <line x1="32" y1="52" x2="32" y2="62" stroke="currentColor" stroke-opacity=".3"/>
        <line x1="2" y1="32" x2="12" y2="32" stroke="currentColor" stroke-opacity=".3"/>
        <line x1="52" y1="32" x2="62" y2="32" stroke="currentColor" stroke-opacity=".3"/>
      </svg>
      <i class="target-dot"></i>
    </div>
    ${live ? '' : '<figcaption class="pad-hint">read-only</figcaption>'}
  </figure>`;
}
