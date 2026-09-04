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
 *
 * Behind the component lifecycle since VNX-03 step 2 (docs/VNEXT_COMPONENTS.md).
 * `keyforms` notifies on every dragged control point and `rig` on every slider,
 * and neither changes a character of this markup — so the panel derives a flat
 * model and lets the component decide whether it is worth any DOM.
 */
import { createWarpCommands } from '../../core/warp/warp-commands.js';
import { WARP_GRID_SIZES } from '../../../runtime/runtime.js';
import { createComponent } from '../../ui/component.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// The separator the signatures below join on. A NUL cannot occur in an SVG id,
// a parameter name or any attribute text that reaches this panel — it is not a
// legal XML character — so a joined string stays one-to-one with the list it
// came from, and two different lists cannot collide into one model.
const SEP = '\u0000';

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

  // The lists the markup walks, kept beside the model rather than inside it:
  // the component compares models with `shallowEqual`, and a rebuilt array is
  // never equal to the last one, so a nested model would render every time.
  // `render()` recomputes this and the model in the same breath, which is what
  // makes the signatures below descriptions of exactly this list.
  let view = { warps: [], parameters: [], eligible: { ok: false, message: '' } };

  const component = createComponent({
    host,
    onMount: ({ listen }) => {
      listen(host, 'click', (event) => {
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

      listen(host, 'change', (event) => {
        const { warpField, warpId } = event.target.dataset;
        if (!warpField) return;
        if (warpField === 'size' && !warpId) { size = Number(event.target.value); }
        if (warpField === 'size' && warpId) commands.setSize(warpId, Number(event.target.value));
        if (warpField === 'driver') commands.setDriver(warpId, { parameter: event.target.value });
        render();
      });
    },
    render: (model) => {
      host.dataset.warpReady = 'true';
      host.dataset.warpCount = String(model.count);
      host.innerHTML = `<p class="small">For outlines that transforms and shape keys cannot bend — a face outline, hair, a soft cheek. Everything else is better without one.</p>
      <div class="warp-add">
        <label class="small">Grid
          <select data-warp-field="size" aria-label="New warp grid size">
            ${WARP_GRID_SIZES.map((value) => `<option value="${value}"${value === model.size ? ' selected' : ''}>${value} × ${value}</option>`).join('')}
          </select>
        </label>
        <button type="button" data-warp-action="add"${model.eligible ? '' : ' disabled'}>Add warp to selection</button>
      </div>
      ${model.eligible ? '' : `<p class="small" data-warp-hint>${esc(model.message)}</p>`}
      ${model.notice ? `<p class="workspace-hint" data-tone="${model.tone}" role="status">${esc(model.notice)}</p>` : ''}
      <ul class="warp-list">${view.warps.map((warp) => `<li data-warp="${esc(warp.id)}">
        <strong>${esc(warp.target)}</strong>
        <label class="small">Grid<select data-warp-field="size" data-warp-id="${esc(warp.id)}">
          ${WARP_GRID_SIZES.map((value) => `<option value="${value}"${value === warp.grid.columns ? ' selected' : ''}>${value} × ${value}</option>`).join('')}
        </select></label>
        <label class="small">Faded by<select data-warp-field="driver" data-warp-id="${esc(warp.id)}">
          <option value="">Always on</option>
          ${view.parameters.map((name) => `<option value="${esc(name)}"${warp.driver?.parameter === name ? ' selected' : ''}>${esc(name)}</option>`).join('')}
        </select></label>
        <button type="button" class="secondary" data-warp-action="reset" data-warp-id="${esc(warp.id)}">Reset</button>
        <button type="button" class="secondary" data-warp-action="remove" data-warp-id="${esc(warp.id)}" aria-label="Remove warp on ${esc(warp.target)}">✕</button>
      </li>`).join('')}</ul>`;
    }
  });

  /**
   * Flat on purpose: this is what the component compares to decide to redraw.
   *
   * Everything the markup reads is here, as a primitive or as a signature of
   * the list it walks. What is deliberately absent is a warp's control points:
   * the canvas draws those, this panel never mentions them, and dragging one is
   * exactly the `keyforms` notification worth skipping.
   */
  const model = () => ({
    size,                                   // the selected option of the "new warp" grid select
    count: view.warps.length,               // written to the host as data-warp-count
    eligible: view.eligible.ok,             // disables the Add button
    message: view.eligible.ok ? '' : view.eligible.message,
    tone: notice ? notice.tone : '',
    notice: notice ? notice.text : '',
    // Every parameter name, in order: they are the driver <option> list, so a
    // renamed or reordered movement is a different panel.
    parameters: view.parameters.join(SEP),
    // Four fields per warp, always in that order — id, target, grid size,
    // driver — which is every value a <li> reads. Fixed arity is what keeps one
    // flat join unambiguous: a warp cannot borrow a field from its neighbour.
    warps: view.warps.flatMap((warp) => [warp.id, warp.target, warp.grid?.columns, warp.driver?.parameter || '']).join(SEP)
  });

  function render() {
    const state = doc();
    view = { warps: state.warps || [], parameters: Object.keys(state.params || {}), eligible: warpEligibility(state, selectedId()) };
    const next = model();
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  return { render, getSize: () => size, destroy: () => component.destroy(), counters: () => component.counters() };
}
