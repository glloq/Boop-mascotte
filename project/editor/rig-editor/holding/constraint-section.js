/**
 * Constraints, as a section of the rig's relationships panel
 * (docs/FACE_CONTROL_RIG.md, §10).
 *
 * A binding says *this movement moves that piece*. A constraint says what a
 * binding cannot: **this piece must stay in a relationship to that one**,
 * whatever moved either of them. The solver has been able to keep six of them
 * true since CR-25; this is where an author says which ones they want.
 *
 * Two things drive the shape of this section.
 *
 * Each kind is set by different things — a distance has a distance, an axis has
 * a line, a limit has bounds — so a row shows the fields *its own kind* uses
 * and none of the others. A panel that shows every field of every kind is a
 * panel where the two that matter are invisible.
 *
 * And the list is **ordered**: constraints are solved top to bottom, each one
 * reading the frame as the ones above it left it. So the order is the rule, not
 * a sort, and every row can be moved.
 */
import { CONSTRAINT_NEEDS_SOURCE, RIG_CONSTRAINT_LABELS, RIG_CONSTRAINT_TYPES } from '../../core/rig/constraint-model.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const num = (value) => (Number.isFinite(Number(value)) ? String(Math.round(Number(value) * 1000) / 1000) : '');

/** The four things a `limit` can bound, in the words a panel uses. */
const LIMIT_CHANNELS = Object.freeze([
  Object.freeze({ key: 'x', label: 'Sideways' }),
  Object.freeze({ key: 'y', label: 'Up / down' }),
  Object.freeze({ key: 'rotation', label: 'Turn' }),
  Object.freeze({ key: 'scale', label: 'Size' })
]);

/**
 * One change, read back from the field that produced it.
 *
 * Returns `null` for anything that is not a constraint field, so the caller can
 * fall through to its own handlers, and the nested records — the limits, the
 * axis, what a parent copies — are rebuilt from the constraint rather than from
 * the form, so a field nobody touched keeps what it had.
 */
export function constraintChange(dataset, value, checked, constraint) {
  const field = dataset.constraintField;
  if (!field || !constraint) return null;
  switch (field) {
    case 'type': return { type: value };
    case 'source': return { source: value || null };
    case 'influence': return { influence: Number(value) };
    case 'weight': return { weight: value.trim() || null };
    case 'enabled': return { enabled: Boolean(checked) };
    case 'distance': return { distance: Number(value) };
    case 'axis': return { axis: { ...constraint.axis, [dataset.constraintAxis]: Number(value) } };
    case 'offset': return { offset: { ...constraint.offset, [dataset.constraintAxis]: Number(value) } };
    case 'copy': return { copy: { ...constraint.copy, [dataset.constraintCopy]: Boolean(checked) } };
    case 'limit': {
      // An empty box is "as far as it likes", which is `null` and emphatically
      // not 0: a bound that read back as 0 would pin the channel to the origin.
      const bound = value.trim() === '' ? null : Number(value);
      const pair = [...(constraint.limits[dataset.constraintChannel] || [null, null])];
      pair[dataset.constraintBound === 'max' ? 1 : 0] = Number.isFinite(bound) ? bound : null;
      return { limits: { ...constraint.limits, [dataset.constraintChannel]: pair } };
    }
    default: return null;
  }
}

/** The kind-specific half of a row: only what this kind is actually set by. */
function fieldsFor(constraint, id) {
  const has = (field) => constraint.fields.includes(field);
  const axis = (key, label) => `<label>${label}<input type="number" step="0.1" data-constraint-field="axis" data-constraint-axis="${key}" data-constraint-id="${id}" value="${num(constraint.axis[key])}" aria-label="The ${label.toLowerCase()} part of the line ${id} may move along"></label>`;
  const offset = (key, label) => `<label>${label}<input type="number" step="1" data-constraint-field="offset" data-constraint-axis="${key}" data-constraint-id="${id}" value="${num(constraint.offset[key])}" aria-label="How far ${id} sits from it, ${label.toLowerCase()}"></label>`;
  return [
    has('distance') ? `<label>Distance<input type="number" min="0" step="1" data-constraint-field="distance" data-constraint-id="${id}" value="${num(constraint.distance)}" aria-label="How far ${id} stays away"></label>` : '',
    has('axis') ? `<span class="holding-axis">Along ${axis('x', 'across')} ${axis('y', 'down')}</span>` : '',
    has('offset') ? `<span class="holding-axis">Offset ${offset('x', 'across')} ${offset('y', 'down')}</span>` : '',
    has('copy')
      ? `<span class="holding-copy">Copy ${['translate', 'rotate', 'scale'].map((key, index) => `<label><input type="checkbox" data-constraint-field="copy" data-constraint-copy="${key}" data-constraint-id="${id}"${constraint.copy[key] ? ' checked' : ''}> ${['place', 'turn', 'size'][index]}</label>`).join(' ')}</span>`
      : '',
    has('limits')
      ? `<span class="holding-limits">${LIMIT_CHANNELS.map((channel) => `<label>${channel.label}
          <input type="number" step="1" placeholder="−∞" data-constraint-field="limit" data-constraint-channel="${channel.key}" data-constraint-bound="min" data-constraint-id="${id}" value="${num(constraint.limits[channel.key]?.[0])}" aria-label="The least ${channel.label.toLowerCase()} ${id} may go">
          <input type="number" step="1" placeholder="+∞" data-constraint-field="limit" data-constraint-channel="${channel.key}" data-constraint-bound="max" data-constraint-id="${id}" value="${num(constraint.limits[channel.key]?.[1])}" aria-label="The most ${channel.label.toLowerCase()} ${id} may go">
        </label>`).join('')}<small class="small">An empty box is no limit at all, which is not the same as a limit of nothing.</small></span>`
      : ''
  ].join('');
}

/** One constraint, as a row. `pieces` are the elements it could be held to. */
export function constraintRow(constraint, { pieces = [], movements = [], last = 0 } = {}) {
  const id = esc(constraint.id);
  const needsSource = CONSTRAINT_NEEDS_SOURCE.includes(constraint.type);
  return `<div class="holding-row" data-rig-constraint-row="${id}"${constraint.unanchored ? ' data-constraint-unanchored="true"' : ''}>
    <label class="holding-enabled"><input type="checkbox" data-constraint-field="enabled" data-constraint-id="${id}"${constraint.enabled ? ' checked' : ''} aria-label="Whether ${id} is enforced"> <b>${esc(constraint.target)}</b></label>
    <label>must<select data-constraint-field="type" data-constraint-id="${id}" aria-label="What kind of relationship ${id} is">${RIG_CONSTRAINT_TYPES.map((type) => `<option value="${type}"${type === constraint.type ? ' selected' : ''}>${esc(RIG_CONSTRAINT_LABELS[type])}</option>`).join('')}</select></label>
    ${needsSource
      ? `<label>to<select data-constraint-field="source" data-constraint-id="${id}" aria-label="The artwork ${id} is held to"><option value="">—</option>${pieces.map((piece) => `<option value="${esc(piece)}"${piece === constraint.source ? ' selected' : ''}>${esc(piece)}</option>`).join('')}</select></label>`
      : ''}
    ${fieldsFor(constraint, id)}
    <label>Amount<input type="number" min="0" max="1" step="0.05" data-constraint-field="influence" data-constraint-id="${id}" value="${num(constraint.influence)}" aria-label="How much of the relationship ${id} enforces"></label>
    <label>Faded by<input list="holding-movements" data-constraint-field="weight" data-constraint-id="${id}" value="${esc(constraint.weight || '')}" placeholder="always" aria-label="The movement that fades ${id} in and out"></label>
    <button type="button" class="secondary" data-holding-action="constraint-up" data-holding-id="${id}" aria-label="Solve ${id} earlier"${constraint.order === 0 ? ' disabled' : ''}>↑</button>
    <button type="button" class="secondary" data-holding-action="constraint-down" data-holding-id="${id}" aria-label="Solve ${id} later"${constraint.order === last ? ' disabled' : ''}>↓</button>
    <button type="button" class="secondary" data-holding-action="remove-constraint" data-holding-id="${id}" aria-label="Remove ${id}">×</button>
    ${constraint.missing ? '<small class="small">its artwork is missing</small>' : ''}
    ${constraint.unanchored ? '<small class="small">nothing is on the other end, so this does nothing yet</small>' : ''}
    ${movements.length && constraint.weight && !movements.includes(constraint.weight) ? `<small class="small">“${esc(constraint.weight)}” is a new movement; it rests fully on.</small>` : ''}
  </div>`;
}

/** The whole section: the rules in solve order, and the form that adds one. */
export function constraintSection(constraints, { pieces = [], movements = [] } = {}) {
  const last = constraints.length - 1;
  return `<h4>Relationships</h4>
    <p class="small">A relationship is kept true whatever moved either piece — and they are kept <b>in this order</b>, each one reading the rig as the ones above it left it.</p>
    ${constraints.length
      ? constraints.map((constraint) => constraintRow(constraint, { pieces, movements, last })).join('')
      : '<p class="small">None yet. A binding moves a piece; a relationship says what must stay true while it does.</p>'}
    ${pieces.length
      ? `<form class="holding-new" data-constraint-form>
          <label>Hold<select data-constraint-target aria-label="The artwork to hold">${pieces.map((piece) => `<option value="${esc(piece)}">${esc(piece)}</option>`).join('')}</select></label>
          <label>so it must<select data-constraint-type aria-label="What kind of relationship to add">${RIG_CONSTRAINT_TYPES.map((type) => `<option value="${type}">${esc(RIG_CONSTRAINT_LABELS[type])}</option>`).join('')}</select></label>
          <label>to<select data-constraint-source aria-label="The artwork to hold it to"><option value="">—</option>${pieces.map((piece, index) => `<option value="${esc(piece)}"${index === 1 ? ' selected' : ''}>${esc(piece)}</option>`).join('')}</select></label>
          <button type="button" data-holding-action="add-constraint">Add it</button>
        </form>`
      : '<p class="small">This mascot has no artwork to hold yet.</p>'}`;
}
