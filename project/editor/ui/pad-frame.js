/**
 * A labelled XY pad (docs/GUIDED_JOURNEY.md).
 *
 * The pads were unlabelled rectangles with a dot in them: nothing on screen
 * said what they moved, which way was "left", or that dragging one changes
 * nothing in the project. Screen readers had a label; everyone else did not.
 *
 * This frames a pad that a panel already renders — its class, dataset, aria and
 * handle stay exactly as they were — so Preview, Face Setup and Head Pose all
 * label their pads the same way instead of each inventing a caption.
 */
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * @param {object} options
 * @param {string} options.label   what the pad moves, in plain words
 * @param {string} [options.hint]  a short aside, e.g. "preview only"
 * @param {string} options.pad     the pad markup the panel already builds
 * @param {[string, string]} [options.x] the horizontal ends, left then right
 * @param {[string, string]} [options.y] the vertical ends, top then bottom
 * @returns {string} markup
 */
export function padFrame({ label, hint = '', pad = '', x = ['left', 'right'], y = ['up', 'down'] } = {}) {
  // Two lines of chrome, no more: the panel around a pad is already tall, and
  // the pad's own aria-label says all this to a reader, so the axes are
  // decoration for the pointer.
  return `<figure class="pad-frame">
    <figcaption class="pad-caption"><b>${esc(label)}</b>${hint ? ` <span class="pad-hint">${esc(hint)}</span>` : ''}</figcaption>
    ${pad}
    <div class="pad-axes" aria-hidden="true"><span>← ${esc(x[0])} · ${esc(x[1])} →</span><span>↑ ${esc(y[0])} · ${esc(y[1])} ↓</span></div>
  </figure>`;
}
