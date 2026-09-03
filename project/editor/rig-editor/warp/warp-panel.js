/**
 * Warp panel (docs/WARP_GRID.md).
 *
 * ```text
 * Select element → Add Warp → choose 3×3 / 4×4 → drag handles → Capture
 * ```
 *
 * The panel is deliberately reluctant: a warp is the escape hatch for shapes
 * that transforms and shape keys cannot do, and the panel says so rather than
 * offering it as the obvious next step.
 */
import { createWarpCommands } from '../../core/warp/warp-commands.js';
import { WARP_GRID_SIZES } from '../../../runtime/runtime.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Whether an element can carry a warp, and if not, why not. */
export function warpEligibility(document, elementId) {
  if (!elementId) return { ok: false, reason: 'no-selection', message: 'Select a shape on the canvas first.' };
  const element = document?.elements?.[elementId];
  if (!element) return { ok: false, reason: 'missing', message: 'That artwork no longer exists.' };
  if ((document.warps || []).some((warp) => warp.target === elementId)) return { ok: false, reason: 'exists', message: 'This shape already has a warp.' };
  return { ok: true };
}

export function createWarpPanel(host, store, history, { selectedId = () => null, geometry = () => null, pathOf = () => null } = {}) {
  if (!host) throw new Error('Missing required UI element: #warp-panel');
  const commands = createWarpCommands(store, history);
  let notice = null;
  let size = 3;
  const doc = () => store.getDocument();
  const say = (tone, text) => { notice = { tone, text }; };

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { warpAction, warpId } = button.dataset;
    if (!warpAction) return;
    if (warpAction === 'add') {
      const id = selectedId();
      const eligible = warpEligibility(doc(), id);
      if (!eligible.ok) say('warn', eligible.message);
      else if (commands.add(id, { size, box: geometry(id), restPath: pathOf(id) })) say('ok', 'Warp added. Drag its handles on the canvas.');
      else say('warn', 'This shape is not an outline Boop can bend. Transforms and shape keys usually do the job instead.');
    }
    if (warpAction === 'remove') commands.remove(warpId);
    if (warpAction === 'reset') { commands.reset(warpId); say('ok', 'Control points are back at rest.'); }
    render();
  });

  host.addEventListener('change', (event) => {
    const { warpField, warpId } = event.target.dataset;
    if (!warpField) return;
    if (warpField === 'size' && !warpId) { size = Number(event.target.value); }
    if (warpField === 'size' && warpId) commands.setSize(warpId, Number(event.target.value));
    if (warpField === 'driver') commands.setDriver(warpId, { parameter: event.target.value });
    render();
  });

  function render() {
    const state = doc();
    const warps = state.warps || [];
    const eligible = warpEligibility(state, selectedId());
    const parameters = Object.keys(state.params || {});
    host.dataset.warpReady = 'true';
    host.dataset.warpCount = String(warps.length);
    host.innerHTML = `<h3>Warp</h3>
      <p class="small">For outlines that transforms and shape keys cannot bend — a face outline, hair, a soft cheek. Everything else is better without one.</p>
      <div class="warp-add">
        <label class="small">Grid
          <select data-warp-field="size" aria-label="New warp grid size">
            ${WARP_GRID_SIZES.map((value) => `<option value="${value}"${value === size ? ' selected' : ''}>${value} × ${value}</option>`).join('')}
          </select>
        </label>
        <button type="button" data-warp-action="add"${eligible.ok ? '' : ' disabled'}>Add warp to selection</button>
      </div>
      ${eligible.ok ? '' : `<p class="small" data-warp-hint>${esc(eligible.message)}</p>`}
      ${notice ? `<p class="workspace-hint" data-tone="${notice.tone}" role="status">${esc(notice.text)}</p>` : ''}
      <ul class="warp-list">${warps.map((warp) => `<li data-warp="${esc(warp.id)}">
        <strong>${esc(warp.target)}</strong>
        <label class="small">Grid<select data-warp-field="size" data-warp-id="${esc(warp.id)}">
          ${WARP_GRID_SIZES.map((value) => `<option value="${value}"${value === warp.grid.columns ? ' selected' : ''}>${value} × ${value}</option>`).join('')}
        </select></label>
        <label class="small">Faded by<select data-warp-field="driver" data-warp-id="${esc(warp.id)}">
          <option value="">Always on</option>
          ${parameters.map((name) => `<option value="${esc(name)}"${warp.driver?.parameter === name ? ' selected' : ''}>${esc(name)}</option>`).join('')}
        </select></label>
        <button type="button" class="secondary" data-warp-action="reset" data-warp-id="${esc(warp.id)}">Reset</button>
        <button type="button" class="secondary" data-warp-action="remove" data-warp-id="${esc(warp.id)}" aria-label="Remove warp on ${esc(warp.target)}">✕</button>
      </li>`).join('')}</ul>`;
  }

  return { render, getSize: () => size };
}
