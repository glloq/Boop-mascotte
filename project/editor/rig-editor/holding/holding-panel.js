/**
 * Pins and holding, as a panel (docs/FACE_CONTROL_RIG.md, CR-20, CR-35 … CR-38).
 *
 * Three things live here, and they are the same idea at three scales:
 *
 * ```text
 * PINS           the points a piece of artwork is held by
 * RELATIONSHIPS  what must stay true while anything moves
 * POINTS         the places on the mascot that can be held
 * HOLDS          what is currently holding on to what
 * ```
 *
 * The pins themselves are placed and dragged **on the canvas**, because a pin
 * is a place on artwork and no list can say where that is. What the panel is
 * for is everything a drag cannot say: how far each one reaches, how softly it
 * lets go, **what moves it** — and, for a hold, the parameter that fades the
 * contact in and out.
 *
 * A pin nobody has told what to follow holds its artwork perfectly still
 * forever, which is a rig an author can build and cannot use. So "moved by" is
 * a field of the pin's own row, written the way a binding is: a movement, and
 * how far the pin goes when it reaches 1. Two of them, because the two
 * directions can follow different movements — a mouth's corner rises with the
 * smile and widens with the width, and one field would make that unsayable.
 */
import { PIN_SOFTNESS_PRESETS, PIN_TYPE_LABELS, RIG_PIN_TYPES, rigPinModel } from '../../core/rig/pin-model.js';
import { createPinCommands } from '../../core/rig/pin-commands.js';
import { attachmentRigModel } from '../../core/rig/attachment-model.js';
import { createHoldingCommands } from './holding-commands.js';
import { hasSurfacePins } from '../../core/rig/surface-pins.js';
import { rigConstraintModel } from '../../core/rig/constraint-model.js';
import { createConstraintCommands } from '../../core/rig/constraint-commands.js';
import { constraintChange, constraintSection } from './constraint-section.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const round = (value) => Math.round(Number(value) * 10) / 10;

/**
 * Whether an expression names anything the mascot can actually do.
 *
 * A pin whose movement is a typo is a pin that quietly does nothing: the
 * evaluator reads an unknown name as 0, which is indistinguishable from a
 * movement resting at 0. It is not a validator — an expression may be
 * arithmetic over several movements — it just asks whether *one* of the names
 * in it is a movement, which is the difference between a sentence and a typo.
 */
export function namesAMovement(expression, known = []) {
  const names = String(expression || '').match(/[A-Za-z_]\w*/g) || [];
  return names.some((name) => known.includes(name));
}

export function createHoldingPanel(host, store, history, { measure = () => null, onStatus = () => {} } = {}) {
  const pins = createPinCommands(store, history);
  // The commands need the same ruler the panel does: a suggested point is a
  // fraction of a measured box, and only the canvas can measure one.
  const holding = createHoldingCommands(store, history, { measure });
  const constraints = createConstraintCommands(store, history);
  const doc = () => store.getDocument();
  const constraintById = (id) => rigConstraintModel(doc()).find((item) => item.id === id) || null;

  host.addEventListener('change', (event) => {
    const field = event.target.dataset.pinField, id = event.target.dataset.pinId;
    if (field && id) {
      const value = field === 'type' || field === 'falloff' ? event.target.value : Number(event.target.value);
      const result = pins.configure(id, { [field]: value });
      if (!result.ok) onStatus(result.message, 'error');
      render();
      return;
    }
    const axis = event.target.dataset.pinMotionAxis;
    if (axis) {
      const result = pins.drive(event.target.dataset.pinId, motionWith(event.target.dataset.pinId, axis, event.target.dataset.pinMotionField, event.target.value));
      if (!result.ok) onStatus(result.message, 'error');
      render();
      return;
    }
    const hold = event.target.dataset.holdField;
    if (hold) {
      holding.configureHold(event.target.dataset.holdId, { [hold]: event.target.value || null });
      render();
      return;
    }
    const pointField = event.target.dataset.pointField, pointId = event.target.dataset.pointId;
    if (pointField && pointId) {
      const at = attachmentRigModel(doc(), measure).points.find((item) => item.id === pointId);
      if (at) {
        const result = holding.movePoint(pointId, { ...at.point, [pointField]: Number(event.target.value) });
        if (!result.ok) onStatus(result.message, 'error');
      }
      render();
      return;
    }
    const constraintId = event.target.dataset.constraintId;
    const change = constraintId && constraintChange(event.target.dataset, event.target.value, event.target.checked, constraintById(constraintId));
    if (change) {
      const result = constraints.configure(constraintId, change);
      if (!result.ok) onStatus(result.message, 'error');
      render();
    }
  });

  host.addEventListener('click', (event) => {
    const button = event.target.closest?.('button[data-holding-action]');
    if (!button) return;
    const { holdingAction: action, holdingId: id } = button.dataset;
    if (action === 'remove-pin') { pins.remove(id); render(); return; }
    if (action === 'remove-constraint') { constraints.remove(id); render(); return; }
    if (action === 'constraint-up' || action === 'constraint-down') {
      const at = constraintById(id)?.order ?? 0;
      constraints.reorder(id, at + (action === 'constraint-up' ? -1 : 1));
      render();
      return;
    }
    if (action === 'add-constraint') {
      const form = host.querySelector('[data-constraint-form]');
      const result = constraints.create(
        form?.querySelector('[data-constraint-target]')?.value,
        form?.querySelector('[data-constraint-type]')?.value,
        form?.querySelector('[data-constraint-source]')?.value || null
      );
      if (!result.ok) onStatus(result.message, 'error');
      else onStatus('Relationship added. It is kept after the ones above it, and “Faded by” makes it something you can key.');
      render();
      return;
    }
    if (action === 'add-point') {
      const result = holding.addPoint(id);
      if (!result.ok) onStatus(result.message, 'error');
      else onStatus(`“${id}” can be held now. Pick something to hold it with.`);
      render();
      return;
    }
    if (action === 'remove-point') { holding.removePoint(id); render(); return; }
    if (action === 'add-own-point') {
      const form = host.querySelector('[data-point-form]');
      const name = form?.querySelector('[data-point-name]')?.value?.trim();
      const result = name
        ? holding.createPoint(name, form?.querySelector('[data-point-target]')?.value, null, 'world')
        : { ok: false, message: 'A point needs a name before anything can hold it.' };
      if (!result.ok) onStatus(result.message, 'error');
      else { onStatus(`“${name}” is at the middle of its artwork. Move it from there.`); form.querySelector('[data-point-name]').value = ''; }
      render();
      return;
    }
    if (action === 'remove-hold') { holding.removeHold(id); render(); return; }
    if (action === 'hold') {
      const form = host.querySelector('[data-holding-form]');
      const result = holding.hold(form?.querySelector('[data-holding-hand]')?.value, form?.querySelector('[data-holding-anchor]')?.value);
      if (!result.ok) onStatus(result.message, 'error');
      else onStatus('Contact added. Key its weight to make the hand arrive, hold and let go.');
      render();
    }
  });

  /**
   * The pin's motion with one field of one axis changed.
   *
   * Built from the record rather than from the form, so the axis nobody
   * touched keeps exactly what it had — including a sampled grid, which is how
   * the head's own silhouette pins are driven and is not a thing a text field
   * could ever round-trip.
   */
  function motionWith(id, axis, field, value) {
    const pin = rigPinModel(doc()).flatMap((group) => group.pins).find((item) => item.id === id);
    const motion = pin?.motion || {};
    if (motion.grid) return motion;
    const entry = { expression: '', amplitude: 1, offset: 0, ...(motion[axis] || {}) };
    const next = { ...motion, [axis]: { ...entry, [field]: field === 'expression' ? String(value).trim() : Number(value) } };
    // An axis with nothing to follow is an axis that does not move, not an
    // axis that follows nothing by a factor of one.
    if (!next[axis].expression) delete next[axis];
    return next;
  }

  function motionRow(pin, axis, label, known) {
    const id = esc(pin.id);
    if (pin.motion?.grid) return `<small class="small">${esc(label)}: sampled over the head turn</small>`;
    const entry = pin.motion?.[axis];
    const unknown = entry && !namesAMovement(entry.expression, known);
    return `<label>${esc(label)}<input list="holding-movements" data-pin-motion-axis="${axis}" data-pin-motion-field="expression" data-pin-id="${id}" value="${esc(entry?.expression || '')}" placeholder="a movement" aria-label="What moves ${id} ${axis === 'x' ? 'sideways' : 'up and down'}"${unknown ? ' aria-invalid="true"' : ''}></label>
      <label>by<input type="number" step="0.5" data-pin-motion-axis="${axis}" data-pin-motion-field="amplitude" data-pin-id="${id}" value="${round(entry?.amplitude ?? 1)}" aria-label="How far ${id} goes ${axis === 'x' ? 'sideways' : 'up and down'} at full movement"${entry ? '' : ' disabled'}></label>
      ${unknown ? `<small class="small">“${esc(entry.expression)}” is not a movement this mascot has, so nothing moves it.</small>` : ''}`;
  }

  /**
   * One named point, with where it is.
   *
   * A suggestion is a *starting place*, not a decision: a cheek is a fraction
   * of the way across a head, and the fraction that is right for one mascot is
   * wrong for the next. So the two numbers are editable, in the artwork's own
   * units, which is the coordinate system every other number in this panel is
   * already in.
   */
  function pointRow(point) {
    const id = esc(point.id);
    const axis = (key, label) => `<input type="number" step="1" data-point-field="${key}" data-point-id="${id}" value="${round(point.point[key])}" aria-label="Where ${id} is, ${label}">`;
    return `<li${point.missing ? ' data-point-missing="true"' : ''}><b>${id}</b> <small class="small">on ${esc(point.target)}${point.missing ? ' · artwork missing' : ''}</small>
      <span class="holding-axis">${axis('x', 'across')} ${axis('y', 'down')}</span>
      <button type="button" class="secondary" data-holding-action="remove-point" data-holding-id="${id}" aria-label="Remove ${id}">×</button></li>`;
  }

  function pinRow(pin, known) {
    const id = esc(pin.id);
    return `<div class="holding-row" data-rig-pin-row="${id}">
      <b>${id}</b>
      <label>Kind<select data-pin-field="type" data-pin-id="${id}" aria-label="What kind of pin ${id} is">${RIG_PIN_TYPES.map((type) => `<option value="${type}"${type === pin.type ? ' selected' : ''}>${esc(PIN_TYPE_LABELS[type] || type)}</option>`).join('')}</select></label>
      <label>Softness<select data-pin-field="falloff" data-pin-id="${id}" aria-label="How softly ${id} lets go">${PIN_SOFTNESS_PRESETS.map((preset) => `<option value="${preset.id}"${preset.id === pin.falloff ? ' selected' : ''} title="${esc(preset.hint)}">${esc(preset.label)}</option>`).join('')}</select></label>
      <label>Reach across<input type="number" min="1" step="1" data-pin-field="radiusX" data-pin-id="${id}" aria-label="How far ${id} reaches sideways" value="${round(pin.radius.x)}"></label>
      <label>Reach down<input type="number" min="1" step="1" data-pin-field="radiusY" data-pin-id="${id}" aria-label="How far ${id} reaches up and down" value="${round(pin.radius.y)}"></label>
      <button type="button" class="secondary" data-holding-action="remove-pin" data-holding-id="${id}" aria-label="Remove ${id}">×</button>
      <div class="holding-motion" data-rig-pin-motion="${id}">
        ${motionRow(pin, 'x', 'Moved sideways by', known)}
        ${motionRow(pin, 'y', 'Moved up / down by', known)}
      </div>
      ${pin.motion || pin.type === 'surface' ? '' : '<small class="small">Nothing moves this pin yet, so it holds its artwork still.</small>'}
    </div>`;
  }

  function render() {
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; return; }
    const groups = rigPinModel(state);
    const attachments = attachmentRigModel(state, measure);
    // What an author may type into "moved by": every movement the mascot has,
    // offered as a list so the common case is a pick and the composite case --
    // `jawOpen - jawOpen * mouthLock`, the lock the lips are held by -- is
    // still a sentence they can write.
    const known = Object.keys(state.params || {});
    host.hidden = false;
    host.dataset.holdingPins = String(groups.reduce((count, group) => count + group.pins.length, 0));
    host.dataset.holdingHolds = String(attachments.holds.length);
    host.dataset.holdingConstraints = String((state.rigConstraints || []).length);
    host.innerHTML = `<div class="holding-panel" data-holding-panel>
      <datalist id="holding-movements">${known.map((name) => `<option value="${esc(name)}"></option>`).join('')}</datalist>
      <p class="small">A <b>pin</b> holds a piece of artwork by a point, and the artwork near it follows. Its reach is an ellipse, so a mouth's corner can hold the lip line without taking the upper lip with it. A <b>point</b> is a place on the mascot with a name. A <b>hold</b> puts one point on another and keeps it there.</p>
      <h4>Pins</h4>
      ${groups.length
        ? groups.map((group) => `<section class="holding-group" data-holding-target="${esc(group.target)}">
            <b>${esc(group.name)}</b>${group.missing ? ' <small class="small">artwork missing</small>' : ''}
            ${group.pins.map((pin) => pinRow(pin, known)).join('')}
          </section>`).join('')
        : '<p class="small">None yet. Select a piece of artwork in Rig and drag a pin onto it.</p>'}
      ${hasSurfacePins(state) ? '<p class="small">The head carries its silhouette pins: the near cheek comes round as it turns, and the far one compresses.</p>' : ''}

      ${constraintSection(rigConstraintModel(state), { pieces: Object.keys(state.elements || {}), movements: known })}

      <h4>Points that can be held</h4>
      ${attachments.points.length
        ? `<ul class="holding-points">${attachments.points.map(pointRow).join('')}</ul>`
        : '<p class="small">None yet.</p>'}
      ${attachments.available.length
        ? `<div class="chip-row">${attachments.available.map((point) => `<button type="button" class="chip" data-holding-action="add-point" data-holding-id="${esc(point.id)}" title="${esc(point.id)}">+ ${esc(point.label || point.id)}</button>`).join('')}</div>`
        : ''}
      <form class="holding-new" data-point-form>
        <label>A point of your own<input data-point-name placeholder="snout.tip" aria-label="What to call the new point"></label>
        <label>on<select data-point-target aria-label="The artwork to put it on">${Object.keys(state.elements || {}).map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join('')}</select></label>
        <button type="button" data-holding-action="add-own-point">Name it</button>
      </form>

      <h4>Holds</h4>
      ${attachments.holds.length
        ? attachments.holds.map((hold) => `<div class="holding-row" data-holding-hold="${esc(hold.id)}">
            <b>${esc(hold.hold)}</b> on <b>${esc(hold.to)}</b>${hold.ready ? '' : ' <small class="small">a point is missing</small>'}
            <label>Weight<input data-hold-field="weight" data-hold-id="${esc(hold.id)}" value="${esc(hold.weight || '')}" placeholder="contact" aria-label="The parameter that fades this contact"></label>
            <button type="button" class="secondary" data-holding-action="remove-hold" data-holding-id="${esc(hold.id)}" aria-label="Remove this hold">×</button>
          </div>`).join('')
        : '<p class="small">Nothing is holding anything yet.</p>'}
      ${attachments.points.length > 1
        ? `<form class="holding-new" data-holding-form>
            <label>Hold<select data-holding-hand aria-label="The point that moves">${attachments.points.map((point) => `<option value="${esc(point.id)}">${esc(point.id)}</option>`).join('')}</select></label>
            <label>on<select data-holding-anchor aria-label="The point it holds on to">${attachments.points.map((point) => `<option value="${esc(point.id)}">${esc(point.id)}</option>`).join('')}</select></label>
            <button type="button" data-holding-action="hold">Hold it</button>
          </form>`
        : '<p class="small">Name two points before one can hold the other.</p>'}
    </div>`;
  }

  return { render };
}
