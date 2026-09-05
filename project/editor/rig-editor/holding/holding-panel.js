/**
 * Pins and holding, as a panel (docs/FACE_CONTROL_RIG.md, CR-20, CR-35 … CR-38).
 *
 * Three things live here, and they are the same idea at three scales:
 *
 * ```text
 * PINS          the points a piece of artwork is held by
 * POINTS        the places on the mascot that can be held
 * HOLDS         what is currently holding on to what
 * ```
 *
 * The pins themselves are placed and dragged **on the canvas**, because a pin
 * is a place on artwork and no list can say where that is. What the panel is
 * for is everything a drag cannot say: how far each one reaches, how softly it
 * lets go, which axis it may use — and, for a hold, the parameter that fades
 * the contact in and out.
 */
import { PIN_SOFTNESS_PRESETS, PIN_TYPE_LABELS, RIG_PIN_TYPES, rigPinModel } from '../../core/rig/pin-model.js';
import { createPinCommands } from '../../core/rig/pin-commands.js';
import { attachmentRigModel } from '../../core/rig/attachment-model.js';
import { createHoldingCommands } from './holding-commands.js';
import { hasSurfacePins } from '../../core/rig/surface-pins.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const round = (value) => Math.round(Number(value) * 10) / 10;

export function createHoldingPanel(host, store, history, { measure = () => null, onStatus = () => {} } = {}) {
  const pins = createPinCommands(store, history);
  // The commands need the same ruler the panel does: a suggested point is a
  // fraction of a measured box, and only the canvas can measure one.
  const holding = createHoldingCommands(store, history, { measure });
  const doc = () => store.getDocument();

  host.addEventListener('change', (event) => {
    const field = event.target.dataset.pinField, id = event.target.dataset.pinId;
    if (field && id) {
      const value = field === 'type' || field === 'falloff' ? event.target.value : Number(event.target.value);
      const result = pins.configure(id, { [field]: value });
      if (!result.ok) onStatus(result.message, 'error');
      render();
      return;
    }
    const hold = event.target.dataset.holdField;
    if (hold) {
      holding.configureHold(event.target.dataset.holdId, { [hold]: event.target.value || null });
      render();
    }
  });

  host.addEventListener('click', (event) => {
    const button = event.target.closest?.('button[data-holding-action]');
    if (!button) return;
    const { holdingAction: action, holdingId: id } = button.dataset;
    if (action === 'remove-pin') { pins.remove(id); render(); return; }
    if (action === 'add-point') {
      const result = holding.addPoint(id);
      if (!result.ok) onStatus(result.message, 'error');
      else onStatus(`“${id}” can be held now. Pick something to hold it with.`);
      render();
      return;
    }
    if (action === 'remove-point') { holding.removePoint(id); render(); return; }
    if (action === 'remove-hold') { holding.removeHold(id); render(); return; }
    if (action === 'hold') {
      const form = host.querySelector('[data-holding-form]');
      const result = holding.hold(form?.querySelector('[data-holding-hand]')?.value, form?.querySelector('[data-holding-anchor]')?.value);
      if (!result.ok) onStatus(result.message, 'error');
      else onStatus('Contact added. Key its weight to make the hand arrive, hold and let go.');
      render();
    }
  });

  function pinRow(pin) {
    const id = esc(pin.id);
    return `<div class="holding-row" data-rig-pin-row="${id}">
      <b>${id}</b>
      <label>Kind<select data-pin-field="type" data-pin-id="${id}" aria-label="What kind of pin ${id} is">${RIG_PIN_TYPES.map((type) => `<option value="${type}"${type === pin.type ? ' selected' : ''}>${esc(PIN_TYPE_LABELS[type] || type)}</option>`).join('')}</select></label>
      <label>Softness<select data-pin-field="falloff" data-pin-id="${id}" aria-label="How softly ${id} lets go">${PIN_SOFTNESS_PRESETS.map((preset) => `<option value="${preset.id}"${preset.id === pin.falloff ? ' selected' : ''} title="${esc(preset.hint)}">${esc(preset.label)}</option>`).join('')}</select></label>
      <label>Reach<input type="number" min="1" step="1" data-pin-field="radius" data-pin-id="${id}" aria-label="How far ${id} reaches" value="${round(pin.radius.x)}"></label>
      <button type="button" class="secondary" data-holding-action="remove-pin" data-holding-id="${id}" aria-label="Remove ${id}">×</button>
    </div>`;
  }

  function render() {
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; return; }
    const groups = rigPinModel(state);
    const attachments = attachmentRigModel(state, measure);
    host.hidden = false;
    host.dataset.holdingPins = String(groups.reduce((count, group) => count + group.pins.length, 0));
    host.dataset.holdingHolds = String(attachments.holds.length);
    host.innerHTML = `<div class="holding-panel" data-holding-panel>
      <p class="small">A <b>pin</b> holds a piece of artwork by a point, and the artwork near it follows. A <b>point</b> is a place on the mascot with a name. A <b>hold</b> puts one point on another and keeps it there.</p>
      <h4>Pins</h4>
      ${groups.length
        ? groups.map((group) => `<section class="holding-group" data-holding-target="${esc(group.target)}">
            <b>${esc(group.name)}</b>${group.missing ? ' <small class="small">artwork missing</small>' : ''}
            ${group.pins.map(pinRow).join('')}
          </section>`).join('')
        : '<p class="small">None yet. Select a piece of artwork in Rig and drag a pin onto it.</p>'}
      ${hasSurfacePins(state) ? '<p class="small">The head carries its silhouette pins: the near cheek comes round as it turns, and the far one compresses.</p>' : ''}

      <h4>Points that can be held</h4>
      ${attachments.points.length
        ? `<ul class="holding-points">${attachments.points.map((point) => `<li><b>${esc(point.id)}</b> <small class="small">on ${esc(point.target)}</small><button type="button" class="secondary" data-holding-action="remove-point" data-holding-id="${esc(point.id)}" aria-label="Remove ${esc(point.id)}">×</button></li>`).join('')}</ul>`
        : '<p class="small">None yet.</p>'}
      ${attachments.available.length
        ? `<div class="chip-row">${attachments.available.map((point) => `<button type="button" class="chip" data-holding-action="add-point" data-holding-id="${esc(point.id)}" title="${esc(point.id)}">+ ${esc(point.label || point.id)}</button>`).join('')}</div>`
        : ''}

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
