/**
 * Pose chips (docs/DIRECT_CONTROLS.md).
 *
 * One row of buttons that put a part somewhere useful: *angry* eyebrows, a
 * *half-closed* eye, a hand *waving*. Expressions name whole faces and the
 * handles let you place a part anywhere; this is the rung between them, and it
 * is the same markup wherever it appears — under a group of movements, in
 * Preview, or on a hand card.
 *
 * It renders a model and nothing else: the panel that owns it decides what a
 * press means.
 */
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * @param {object} options
 * @param {string} [options.label]  a heading for the row
 * @param {{id,name,active?,disabled?,offer?,title?}[]} options.poses
 * @param {string} options.attribute the data attribute a press carries
 * @param {string} [options.group]   prefix for that attribute's value
 * @returns {string} markup
 */
export function poseChipRow({ label = '', poses = [], attribute = 'data-pose-chip', group = '' } = {}) {
  if (!poses.length) return '';
  const chips = poses.map((pose) => {
    const value = group ? `${group}:${pose.id}` : pose.id;
    const classes = ['chip', 'pose-chip', pose.active ? 'chip-active' : '', pose.offer ? 'pose-offer' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" ${attribute}="${esc(value)}"
      aria-pressed="${Boolean(pose.active)}"${pose.disabled ? ' disabled' : ''}${pose.title ? ` title="${esc(pose.title)}"` : ''}>${pose.offer ? '+ ' : ''}${esc(pose.name)}</button>`;
  }).join('');
  return `<div class="pose-chips">${label ? `<span class="pose-chips-label">${esc(label)}</span>` : ''}${chips}</div>`;
}
