/**
 * The slider `◆│` — one movement (docs/FACE_CONTROL_RIG.md, CR-02).
 *
 * The oldest shape here, and still the right one for a movement that has one
 * direction: an eyelid opens and closes, a jaw drops, a mouth widens. It is
 * also the **accessible** path to every other control — a target, a ring and an
 * arc are all pointer gestures first, and a range input is what a keyboard and
 * a screen reader can always reach (docs/UX21_ACCESSIBILITY.md).
 */
import { esc, round } from './control-geometry.js';

export function renderSliderControl(handle, axis, { live = false } = {}) {
  const id = esc(handle.id), key = esc(axis.key);
  return `<label class="handle-slider">${esc(axis.label)}
      <input type="range" data-handle-slider="${key}" data-handle-id="${id}" data-handle-axis="${key}"
        min="${round(axis.min)}" max="${round(axis.max)}" step="${axis.snap || 0.01}" value="${round(axis.value)}"
        aria-label="${esc(axis.label)}"${live ? '' : ' disabled'}>
      <output data-handle-output="${esc(axis.control)}">${round(axis.value)}</output>
    </label>`;
}

/**
 * A movement cut into a handful of steps is not a range any more: it is a
 * short list of places, and a list is picked from rather than dragged through.
 */
export function renderChipsControl(handle, axis, { live = false } = {}) {
  const stops = axis.stops.length ? axis.stops : [...new Set([axis.min, axis.rest, axis.max])].sort((a, b) => a - b);
  const reach = Math.max(0.005, Number(axis.snap) > 0 ? Number(axis.snap) / 2 : 0);
  return `<div class="chip-row" role="group" aria-label="${esc(axis.label)}">${stops.map((stop) => {
    const on = Math.abs(axis.value - stop) < reach;
    return `<button type="button" class="chip${on ? ' chip-active' : ''}" data-handle-stop="${stop}" data-handle-id="${esc(handle.id)}" data-handle-axis="${esc(axis.key)}"
        aria-pressed="${on}" aria-label="${esc(axis.label)} ${round(stop)}"${live ? '' : ' disabled'}>${round(stop)}</button>`;
  }).join('')}</div>`;
}
