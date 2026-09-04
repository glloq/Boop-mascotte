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
 * **The shape of a control matches the movement** (VNX-14). Every handle used
 * to be three number fields whatever it drove, so a gaze, a jaw and a tilt all
 * read the same. Now the model says which controller each one wants and this
 * draws it: a pad for two directions, a slider for one, an arc for a turn,
 * chips for a movement cut into steps. The numbers stay underneath, because a
 * limit is authoring rather than posing.
 *
 * Thin DOM layer. The model is `core/puppet/handle-model.js`, every change is
 * a command, and nothing here knows how a movement is implemented.
 */
import { RIG_HANDLE_COLOURS } from '../core/puppet/handle-model.js';
import { handleIdFrom } from '../core/puppet/handle-commands.js';
import { padFrame } from './pad-frame.js';
import { rememberOpen, setPanelHtml } from './panel-render.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const round = (value) => Math.round(Number(value) * 100) / 100;
const exact = (value) => Math.round(Number(value) * 1000) / 1000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * Where a value sits along its own control, 0 at the start and 1 at the end.
 *
 * An inverted axis reads **upwards** — `eyeOpen` closes as the pointer goes
 * down — so the control has to agree with the handle on the mascot, or the
 * same movement would go two ways in two places.
 */
const place = (axis, value = axis.value) => {
  const span = axis.max - axis.min;
  const at = span ? (clamp(number(value, axis.min), axis.min, axis.max) - axis.min) / span : 0.5;
  return axis.invert ? 1 - at : at;
};
/** The same mapping read backwards, landed on the axis's own step. */
const valueAt = (axis, at) => {
  const t = clamp(axis.invert ? 1 - at : at, 0, 1);
  const step = number(axis.snap, 0);
  const raw = axis.min + t * (axis.max - axis.min);
  return exact(clamp(step > 0 ? Math.round(raw / step) * step : raw, axis.min, axis.max));
};
const percent = (fraction) => `${round(clamp(fraction, 0, 1) * 100)}%`;

const RAD = Math.PI / 180;
/** A point on the dial, `angle` degrees clockwise from straight up. */
const dialPoint = (angle, radius) => [round(32 + radius * Math.sin(angle * RAD)), round(32 - radius * Math.cos(angle * RAD))];
const dialArc = (from, to, radius) => {
  const [x1, y1] = dialPoint(from, radius), [x2, y2] = dialPoint(to, radius);
  return `M${x1} ${y1}A${radius} ${radius} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to >= from ? 1 : 0} ${x2} ${y2}`;
};
/** How many degrees of turn cover an arc's whole range, kept drawable. */
const sweepOf = (handle) => clamp(Math.abs(number(handle.throw, 120)), 30, 340);

export function createHandleBoard(host, {
  model = () => ({ layers: [], count: 0 }), commands, movements = () => [], artwork = () => [],
  selected = () => [], onSelect = () => {}, onStatus = () => {},
  // Operating a control is a live preview, exactly like the sliders and the
  // pads in Preview: it sets parameters and never touches the project. Without
  // it the controls still draw where every movement is, read-only.
  applyPose = null
} = {}) {
  const sections = rememberOpen(host);
  const live = typeof applyPose === 'function';
  let creating = false, draft = { name: '', element: '', x: '', y: '' };
  let dragging = null;

  /** One row of the board by id, members included: the model is the truth. */
  const rowOf = (id) => model().layers
    .flatMap((layer) => layer.items)
    .flatMap((item) => [item, ...(item.members || [])])
    .find((item) => item.id === id) || null;
  const axisOf = (row, key) => row?.axes.find((axis) => axis.key === key && !axis.locked) || null;
  const write = (values) => { if (live && Object.keys(values).length) applyPose(values); };

  host.addEventListener('click', (event) => {
    // A chip is a place on the movement worth having: picking one is the same
    // write a drag makes, it just lands exactly.
    const chip = event.target.closest?.('[data-handle-stop]');
    if (chip) {
      const row = rowOf(chip.dataset.handleId), axis = axisOf(row, chip.dataset.handleAxis);
      if (axis) { write({ [axis.control]: exact(chip.dataset.handleStop) }); render(); }
      return;
    }
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

  host.addEventListener('input', (event) => {
    const slider = event.target.closest?.('[data-handle-slider]');
    if (!slider) return;
    const row = rowOf(slider.dataset.handleId), axis = axisOf(row, slider.dataset.handleAxis);
    if (!axis) return;
    // Dragging a slider redraws its own readout and nothing else: rebuilding
    // the board under the pointer would take the slider away mid-gesture.
    write({ [axis.control]: exact(slider.value) });
    const output = slider.parentElement?.querySelector?.('output');
    if (output) output.textContent = String(round(slider.value));
  });

  host.addEventListener('change', (event) => {
    if (event.target.closest?.('[data-handle-slider]')) { render(); return; }
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

  // A pad and an arc are dragged, so they are pointer-captured like the pads in
  // Preview: the values go out on every move, the board is rebuilt on release.
  host.addEventListener('pointerdown', (event) => {
    const node = event.target.closest?.('[data-handle-drag]');
    if (!node || !live || event.button) return;
    event.preventDefault();
    node.setPointerCapture?.(event.pointerId);
    dragging = node;
    apply(node, event);
  });
  host.addEventListener('pointermove', (event) => { if (dragging && (dragging.hasPointerCapture?.(event.pointerId) ?? true)) apply(dragging, event); });
  host.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging.releasePointerCapture?.(event.pointerId);
    dragging = null;
    render();
  });

  host.addEventListener('keydown', (event) => {
    const node = event.target.closest?.('[data-handle-drag]');
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (!node || !live || step === undefined) return;
    event.preventDefault();
    const row = rowOf(node.dataset.handleId);
    if (!row) return;
    // A step of the movement's own if it has one, otherwise a twentieth of the
    // range; Shift covers ground, the way it does on every other control here.
    const nudge = (axis, direction) => {
      const span = axis.max - axis.min || 1;
      const fraction = (number(axis.snap, 0) > 0 ? axis.snap / span : 0.05) * (event.shiftKey ? 5 : 1);
      return valueAt(axis, place(axis) + direction * fraction);
    };
    if (node.dataset.handleDrag === 'arc') {
      const axis = axisOf(row, 'orbit');
      if (axis) write({ [axis.control]: nudge(axis, step) });
    } else {
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const axis = axisOf(row, horizontal ? 'x' : 'y');
      // Up is up on a pad: the vertical axis moves against the screen, and an
      // inverted one is already read upwards by `place`.
      if (axis) write({ [axis.control]: nudge(axis, horizontal ? step : -step) });
    }
    render();
    host.querySelector?.(`[data-handle-drag][data-handle-id="${row.id}"]`)?.focus?.();
  });

  /** Where the pointer has taken a pad or an arc, in the axis's own units. */
  function apply(node, event) {
    const box = node.getBoundingClientRect?.();
    const row = rowOf(node.dataset.handleId);
    if (!box?.width || !row) return;
    if (node.dataset.handleDrag === 'arc') {
      const axis = axisOf(row, 'orbit');
      if (!axis) return;
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      const angle = Math.atan2(event.clientX - cx, cy - event.clientY) / RAD;
      write({ [axis.control]: valueAt(axis, angle / sweepOf(row) + 0.5) });
      return;
    }
    const x = axisOf(row, 'x'), y = axisOf(row, 'y'), values = {};
    if (x) values[x.control] = valueAt(x, (event.clientX - box.left) / box.width);
    if (y) values[y.control] = valueAt(y, (event.clientY - box.top) / box.height);
    if (x) node.style?.setProperty?.('--x', percent(place(x, values[x.control])));
    if (y) node.style?.setProperty?.('--y', percent(place(y, values[y.control])));
    write(values);
  }

  /** What a control is, to a reader: the same words the mascot's handle uses. */
  const operable = (handle, kind, label) => (live
    ? ` tabindex="0" aria-label="${esc(label)}. ${kind === 'arc' ? 'Turn it' : 'Drag it'}, or use the arrow keys."`
    : ` aria-label="${esc(label)}, at ${handle.axes.map((axis) => round(axis.value)).join(' · ')}"`);

  function padControl(handle, x, y) {
    const label = `${x.label} · ${y.label}`;
    return padFrame({
      label, hint: live ? 'preview only' : 'read-only',
      pad: `<div class="xy-pad" data-handle-drag="pad" data-handle-id="${esc(handle.id)}" role="application"${operable(handle, 'pad', label)} style="--x:${percent(place(x))};--y:${percent(place(y))}"><i></i></div>`,
      x: [`${round(x.min)}`, `${round(x.max)}`],
      // Top first: an inverted axis has its largest value up there.
      y: y.invert ? [`${round(y.max)}`, `${round(y.min)}`] : [`${round(y.min)}`, `${round(y.max)}`]
    });
  }

  function sliderControl(handle, axis) {
    const id = esc(handle.id), key = esc(axis.key);
    return `<label class="handle-slider">${esc(axis.label)}
      <input type="range" data-handle-slider="${key}" data-handle-id="${id}" data-handle-axis="${key}"
        min="${round(axis.min)}" max="${round(axis.max)}" step="${axis.snap || 0.01}" value="${round(axis.value)}"
        aria-label="${esc(axis.label)}"${live ? '' : ' disabled'}>
      <output data-handle-output="${esc(axis.control)}">${round(axis.value)}</output>
    </label>`;
  }

  function arcControl(handle, axis) {
    const sweep = sweepOf(handle), angle = (place(axis) - 0.5) * sweep;
    const [nx, ny] = dialPoint(angle, 22);
    return `<figure class="pad-frame handle-arc">
      <figcaption class="pad-caption"><b>${esc(axis.label)}</b> <span class="pad-hint">${round(axis.value)}</span></figcaption>
      <svg viewBox="0 0 64 64" width="76" height="76" data-handle-drag="arc" data-handle-id="${esc(handle.id)}"
        role="slider" aria-valuemin="${round(axis.min)}" aria-valuemax="${round(axis.max)}" aria-valuenow="${round(axis.value)}"${operable(handle, 'arc', axis.label)}>
        <path d="${dialArc(-sweep / 2, sweep / 2, 22)}" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="4" stroke-linecap="round"/>
        <path d="${dialArc(0, angle, 22)}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <line x1="32" y1="32" x2="${nx}" y2="${ny}" stroke="currentColor" stroke-width="2"/>
        <circle cx="${nx}" cy="${ny}" r="5" fill="currentColor"/>
      </svg>
    </figure>`;
  }

  function chipsControl(handle, axis) {
    // A stepped movement carries its own stops. One an author asked to chip
    // without stepping it still has the three places it names by itself.
    const stops = axis.stops.length ? axis.stops : [...new Set([axis.min, axis.rest, axis.max])].sort((a, b) => a - b);
    const reach = Math.max(0.005, number(axis.snap, 0) / 2);
    return `<div class="chip-row" role="group" aria-label="${esc(axis.label)}">${stops.map((stop) => {
      const on = Math.abs(axis.value - stop) < reach;
      return `<button type="button" class="chip${on ? ' chip-active' : ''}" data-handle-stop="${stop}" data-handle-id="${esc(handle.id)}" data-handle-axis="${esc(axis.key)}"
        aria-pressed="${on}" aria-label="${esc(axis.label)} ${round(stop)}"${live ? '' : ' disabled'}>${round(stop)}</button>`;
    }).join('')}</div>`;
  }

  /**
   * The control this handle's movement deserves, where the numbers used to be.
   *
   * The kind comes from the model; it falls back to what the axes can honestly
   * show, so an author who asks a one-way movement for a pad gets the control
   * it can actually offer rather than half a pad.
   */
  function control(handle) {
    const free = handle.axes.filter((axis) => !axis.locked);
    const x = free.find((axis) => axis.key === 'x'), y = free.find((axis) => axis.key === 'y');
    const orbit = free.find((axis) => axis.key === 'orbit');
    const kind = handle.controller === 'pad' && x && y ? 'pad'
      : handle.controller === 'arc' && orbit ? 'arc'
        : handle.controller === 'chips' && free.length ? 'chips'
          : free.length ? 'slider' : 'locked';
    const body = kind === 'pad' ? padControl(handle, x, y)
      : kind === 'arc' ? arcControl(handle, orbit)
        : kind === 'chips' ? chipsControl(handle, free[0])
          : kind === 'slider' ? free.map((axis) => sliderControl(handle, axis)).join('')
            : '<p class="small">Every axis is locked: this control says where the movement is and nothing moves it.</p>';
    return `<div class="handle-control" data-handle-control="${kind}" data-handle-id="${esc(handle.id)}">${body}</div>`;
  }

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
    return `<details class="handle-card${member ? ' handle-member' : ''}" data-handle-card="${id}" data-handle-controller="${esc(handle.controller)}" data-keep-open="handle:${id}"${sections.attr(`handle:${id}`)}>
      <summary>
        <span class="handle-dot" data-handle-colour="${esc(handle.widget.colour)}" aria-hidden="true"></span>
        <b>${esc(handle.label)}</b>
        <small>${handle.axes.map((axis) => `${esc(axis.label)} ${round(axis.value)}`).join(' · ') || 'nothing yet'}</small>
      </summary>
      <div class="handle-body">
        <label class="handle-name">Name<input data-handle-field="name" data-handle-id="${id}" aria-label="Name of this control" value="${esc(handle.label)}"></label>
        ${control(handle)}
        <div class="handle-limits" data-handle-limits><small class="small">How far it may go</small>${handle.axes.map((axis) => axisRow(handle, axis)).join('')}</div>
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
      <p class="small">Every control on the mascot, in the shape of the movement it drives. Drag them here or there; name them, limit them and lock them here.</p>
      ${board.layers.map((layer) => `<section class="handle-layer" data-handle-layer="${esc(layer.name)}"><h4>${esc(layer.name)}</h4>${layer.items.map((item) => handleCard(item)).join('')}</section>`).join('')
        || '<p class="small">No controls yet: turn a movement on in Movements, and its control appears on the mascot.</p>'}
      ${hidden.length ? `<section class="handle-layer"><h4>Hidden</h4>${hidden.map((item) => `<div class="handle-hidden" data-handle-hidden="${esc(item.id)}"><b>${esc(item.label || item.id)}</b><button type="button" class="secondary" data-handle-action="show" data-handle-id="${esc(item.id)}">Show</button></div>`).join('')}</section>` : ''}
      ${creator()}
    </div>`);
  }

  return { render };
}
