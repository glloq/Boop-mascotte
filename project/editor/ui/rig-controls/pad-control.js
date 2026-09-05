/**
 * The pad `▦` — two movements at once (docs/FACE_CONTROL_RIG.md, CR-02).
 *
 * Where a target says "a place", a pad says "two movements that are worth
 * moving together": a brow that raises *and* tilts, a mouth that smiles *and*
 * opens. Both ends of both axes are labelled, because unlike a gaze there is
 * no obvious middle to read from.
 */
import { esc, percent, place, round } from './control-geometry.js';
import { padFrame } from '../pad-frame.js';

export function renderPadControl(handle, x, y, { live = false, describe = () => '' } = {}) {
  const label = `${x.label} · ${y.label}`;
  return padFrame({
    label, hint: live ? 'preview only' : 'read-only',
    pad: `<div class="xy-pad" data-handle-drag="pad" data-handle-id="${esc(handle.id)}" role="application"${describe(handle, 'pad', label)} style="--x:${percent(place(x))};--y:${percent(place(y))}"><i></i></div>`,
    x: [`${round(x.min)}`, `${round(x.max)}`],
    // Top first: an inverted axis has its largest value up there.
    y: y.invert ? [`${round(y.max)}`, `${round(y.min)}`] : [`${round(y.min)}`, `${round(y.max)}`]
  });
}
