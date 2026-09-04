/**
 * The control board (docs/DIRECT_CONTROLS.md).
 *
 * The handles are on the mascot, which is where they belong and also where
 * they are hardest to see: a control on a part that is off-screen, folded into
 * a group, or under another handle cannot be found by looking. Every animation
 * package answers this the same way — one panel listing every control, what it
 * drives, and where it is now.
 *
 * It is also where a handle stops being hard-coded: rename it, narrow how far
 * it may go, lock an axis, snap it to a step, give it a colour, hide it, or
 * add one of your own on any artwork and any movement.
 *
 * Thin DOM layer. The model is `core/puppet/handle-model.js`, every change is
 * a command, and nothing here knows how a movement is implemented.
 */
import { RIG_HANDLE_COLOURS } from '../core/puppet/handle-model.js';
import { handleIdFrom } from '../core/puppet/handle-commands.js';
import { rememberOpen, setPanelHtml } from './panel-render.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const round = (value) => Math.round(Number(value) * 100) / 100;

export function createHandleBoard(host, {
  model = () => ({ layers: [], count: 0 }), commands, movements = () => [], artwork = () => [],
  selected = () => [], onSelect = () => {}, onStatus = () => {}
} = {}) {
  const sections = rememberOpen(host);
  let creating = false, draft = { name: '', element: '', x: '', y: '' };

  host.addEventListener('click', (event) => {
    const button = event.target.closest?.('button[data-handle-action]');
    if (!button) return;
    const { handleAction: action, handleId: id, handleAxis: axis } = button.dataset;
    if (action === 'select') { onSelect(id, { additive: event.shiftKey }); render(); return; }
    if (action === 'lock') { commands.setAxis(id, axis, { locked: button.getAttribute('aria-pressed') !== 'true' }); render(); return; }
    if (action === 'hide') { commands.hide(id, true); onStatus('Control hidden. Reset brings it back.'); render(); return; }
    if (action === 'show') { commands.hide(id, false); render(); return; }
    if (action === 'reset') { commands.reset(id); onStatus('Back to the control this project generates.'); render(); return; }
    if (action === 'remove') { commands.remove(id); render(); return; }
    if (action === 'new') { creating = !creating; render(); return; }
    if (action === 'create') {
      const taken = model().layers.flatMap((layer) => layer.items.flatMap((item) => [item.id, ...item.members.map((member) => member.id)]));
      const result = commands.create(handleIdFrom(draft.name, taken), {
        elements: [draft.element], x: draft.x || null, y: draft.y || null, name: draft.name || 'Control'
      });
      if (!result.ok) { onStatus(result.message, 'error'); return; }
      creating = false; draft = { name: '', element: '', x: '', y: '' };
      onStatus('Control added. Drag it on the mascot like any other.');
      render();
    }
  });

  host.addEventListener('change', (event) => {
    const field = event.target.closest?.('[data-handle-field]');
    if (!field) return;
    const { handleField: key, handleId: id, handleAxis: axis } = field.dataset;
    if (key === 'draft') { draft = { ...draft, [field.dataset.handleDraft]: field.value }; return; }
    if (key === 'name') { commands.rename(id, field.value); render(); return; }
    if (key === 'colour') { commands.setWidget(id, { colour: field.value }); render(); return; }
    if (key === 'min' || key === 'max' || key === 'snap') {
      const value = field.value === '' ? null : Number(field.value);
      commands.setAxis(id, axis, { [key]: value });
      render();
    }
  });

  function axisRow(handle, axis) {
    const id = esc(handle.id), key = esc(axis.key);
    return `<div class="handle-axis" data-handle-axis-row="${key}">
      <b title="${esc(axis.control)}">${esc(axis.label)}</b>
      <output>${round(axis.value)}</output>
      <label>min<input type="number" step=".05" data-handle-field="min" data-handle-id="${id}" data-handle-axis="${key}" aria-label="Lowest ${esc(axis.label)} this control reaches" value="${round(axis.min)}"></label>
      <label>max<input type="number" step=".05" data-handle-field="max" data-handle-id="${id}" data-handle-axis="${key}" aria-label="Highest ${esc(axis.label)} this control reaches" value="${round(axis.max)}"></label>
      <label>step<input type="number" min="0" step=".05" data-handle-field="snap" data-handle-id="${id}" data-handle-axis="${key}" aria-label="Snap ${esc(axis.label)} to this step" value="${axis.snap || ''}"></label>
      <button type="button" data-handle-action="lock" data-handle-id="${id}" data-handle-axis="${key}" aria-pressed="${axis.locked}" aria-label="${axis.locked ? 'Unlock' : 'Lock'} ${esc(axis.label)}">${axis.locked ? '🔒' : '🔓'}</button>
    </div>`;
  }

  function handleCard(handle, { member = false } = {}) {
    const id = esc(handle.id);
    const chosen = selected().includes(handle.id);
    return `<details class="handle-card${member ? ' handle-member' : ''}" data-handle-card="${id}" data-keep-open="handle:${id}"${sections.attr(`handle:${id}`)}>
      <summary>
        <span class="handle-dot" data-handle-colour="${esc(handle.widget.colour)}" aria-hidden="true"></span>
        <b>${esc(handle.label)}</b>
        <small>${handle.axes.map((axis) => `${esc(axis.label)} ${round(axis.value)}`).join(' · ') || 'nothing yet'}</small>
      </summary>
      <div class="handle-body">
        <label class="handle-name">Name<input data-handle-field="name" data-handle-id="${id}" aria-label="Name of this control" value="${esc(handle.label)}"></label>
        ${handle.axes.map((axis) => axisRow(handle, axis)).join('')}
        <div class="handle-actions">
          <label>Colour<select data-handle-field="colour" data-handle-id="${id}" aria-label="Colour of this control">${RIG_HANDLE_COLOURS.map((colour) => `<option value="${colour}"${colour === handle.widget.colour ? ' selected' : ''}>${colour}</option>`).join('')}</select></label>
          <button type="button" class="secondary" data-handle-action="select" data-handle-id="${id}" aria-pressed="${chosen}">${chosen ? 'Selected' : 'Select'}</button>
          ${handle.authored
            ? `<button type="button" class="danger secondary" data-handle-action="remove" data-handle-id="${id}">Delete</button>`
            : `<button type="button" class="secondary" data-handle-action="hide" data-handle-id="${id}">Hide</button><button type="button" class="secondary" data-handle-action="reset" data-handle-id="${id}">Reset</button>`}
        </div>
      </div>
    </details>${handle.members?.length ? `<div class="handle-members">${handle.members.map((member) => handleCard(member, { member: true })).join('')}</div>` : ''}`;
  }

  function creator() {
    const parts = movements();
    if (!creating) return `<button type="button" class="secondary" data-handle-action="new">+ New control</button>`;
    return `<form class="handle-new" data-handle-new>
      <label>Name<input data-handle-field="draft" data-handle-draft="name" aria-label="Name of the new control" value="${esc(draft.name)}" placeholder="Tail swing"></label>
      <label>On<select data-handle-field="draft" data-handle-draft="element" aria-label="Artwork the new control sits on"><option value="">Choose artwork…</option>${artwork().map((item) => `<option value="${esc(item.id)}"${item.id === draft.element ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
      <label>Sideways<select data-handle-field="draft" data-handle-draft="x" aria-label="Movement the new control drives sideways"><option value="">none</option>${parts.map((item) => `<option value="${esc(item.id)}"${item.id === draft.x ? ' selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>
      <label>Up and down<select data-handle-field="draft" data-handle-draft="y" aria-label="Movement the new control drives up and down"><option value="">none</option>${parts.map((item) => `<option value="${esc(item.id)}"${item.id === draft.y ? ' selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>
      <div class="handle-actions"><button type="button" data-handle-action="create">Add it</button><button type="button" class="secondary" data-handle-action="new">Cancel</button></div>
    </form>`;
  }

  // A board nobody is looking at is not worth resolving the whole handle set
  // for on every edit — but it has to be there the moment the section opens.
  host.closest?.('details')?.addEventListener?.('toggle', (event) => { if (event.target.open) render(); });
  const folded = () => host.closest?.('details')?.open === false;

  function render() {
    if (folded()) return;
    const board = model();
    const hidden = board.hidden || [];
    setPanelHtml(host, `<div class="handle-board" data-handle-board data-handle-count="${board.count}">
      <p class="small">Every control on the mascot. Drag them there; name them, limit them and lock them here.</p>
      ${board.layers.map((layer) => `<section class="handle-layer" data-handle-layer="${esc(layer.name)}"><h4>${esc(layer.name)}</h4>${layer.items.map((item) => handleCard(item)).join('')}</section>`).join('')
        || '<p class="small">No controls yet: turn a movement on in Movements, and its control appears on the mascot.</p>'}
      ${hidden.length ? `<section class="handle-layer"><h4>Hidden</h4>${hidden.map((item) => `<div class="handle-hidden" data-handle-hidden="${esc(item.id)}"><b>${esc(item.label || item.id)}</b><button type="button" class="secondary" data-handle-action="show" data-handle-id="${esc(item.id)}">Show</button></div>`).join('')}</section>` : ''}
      ${creator()}
    </div>`);
  }

  return { render };
}
