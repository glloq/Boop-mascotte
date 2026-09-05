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
import { PIN_SOFTNESS_PRESETS, PIN_TYPE_LABELS, RIG_PIN_TYPES, pinAngle, pinDirection, rigPinModel } from '../../core/rig/pin-model.js';
import { createPinCommands } from '../../core/rig/pin-commands.js';
import { attachmentRigModel } from '../../core/rig/attachment-model.js';
import { createHoldingCommands } from './holding-commands.js';
import { hasSurfacePins } from '../../core/rig/surface-pins.js';
import { ATTACHMENT_SPACES, parsePath } from '../../../runtime/runtime.js';
import { pinOverlay } from '../../core/rig/pin-model.js';
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
/**
 * The points, gathered by what they are part of.
 *
 * The space is never read by the solver — a hold is between two points and
 * neither needs a space to be resolved — so it earns its keep here: seventeen
 * points in one list is a list nobody reads, and "the face's" and "the left
 * hand's" is how an author already thinks about them.
 */
export function bySpace(points = []) {
  const groups = new Map();
  for (const point of points) {
    const space = point.space || 'world';
    if (!groups.has(space)) groups.set(space, []);
    groups.get(space).push(point);
  }
  return [...groups];
}

export function namesAMovement(expression, known = []) {
  const names = String(expression || '').match(/[A-Za-z_]\w*/g) || [];
  return names.some((name) => known.includes(name));
}

export function createHoldingPanel(host, store, history, {
  measure = () => null, onStatus = () => {},
  selectedId = () => null, select = () => {}, elementKind = () => null, authoredPath = () => null,
  placePin = null, convertToPath = null, mirrorAxis = () => null, createHandle = null
} = {}) {
  /** The pieces a pin can go on: paths, by name, the selected one first. */
  const pinnable = () => {
    const state = doc();
    const ids = Object.keys(state.elements || {}).filter((id) => elementKind(id) === 'path' || typeof state.elements[id]?.restPath === 'string');
    const current = selectedId();
    return current && ids.includes(current) ? [current, ...ids.filter((id) => id !== current)] : ids;
  };
  const nameOf = (id) => doc().layerMetadata?.[id]?.name || id;
  /** Put a pin on a piece at a point, carrying the outline over when the piece has none yet. */
  const placeAt = (target, point, options = {}) => {
    history.beginTransaction();
    const result = pins.create(target, point, { restPath: authoredPath(target), ...options });
    if (!result.ok) { history.commitTransaction(); onStatus(result.message, 'error'); return null; }
    // A pin holding no point is a pin in the wrong place — and a thin eyelid's
    // middle is often empty. The reach grows to the nearest point of the
    // outline, so a new pin always holds something and says how much.
    const placed = pinOverlay(doc(), target)?.pins.find((pin) => pin.id === result.id);
    if (placed && !placed.reach) {
      const outline = doc().elements?.[target]?.restPath;
      let nearest = Infinity;
      try { const values = parsePath(outline).values; for (let index = 0; index + 1 < values.length; index += 2) nearest = Math.min(nearest, Math.hypot(values[index] - point.x, values[index + 1] - point.y)); } catch { nearest = Infinity; }
      if (Number.isFinite(nearest)) { const radius = Math.ceil(nearest * 1.15) + 1; pins.configure(result.id, { radiusX: Math.max(placed.radius.x, radius), radiusY: Math.max(placed.radius.y, radius) }); }
    }
    history.commitTransaction();
    onStatus(`Pin added on ${nameOf(target)}. Drag it where it should hold; its reach handles set how far.`);
    select(target);
    render();
    return result.id;
  };
  const middleOf = (target) => { const box = measure(target); return box ? { x: Math.round((box.x + box.width / 2) * 100) / 100, y: Math.round((box.y + box.height / 2) * 100) / 100 } : null; };
  const pins = createPinCommands(store, history);
  // The commands need the same ruler the panel does: a suggested point is a
  // fraction of a measured box, and only the canvas can measure one.
  const holding = createHoldingCommands(store, history, { measure });
  const constraints = createConstraintCommands(store, history);
  const doc = () => store.getDocument();
  const constraintById = (id) => rigConstraintModel(doc()).find((item) => item.id === id) || null;

  host.addEventListener('change', (event) => {
    const field = event.target.dataset.pinField, id = event.target.dataset.pinId;
    if (field === 'angle' && id) {
      // An angle is a direction, not a number the pin keeps as it is.
      const result = pins.configure(id, { direction: pinDirection(event.target.value) });
      if (!result.ok) onStatus(result.message, 'error');
      render();
      return;
    }
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
    const said = (result) => { if (!result.ok) onStatus(result.message, 'error'); return result.ok; };
    if (action === 'remove-pin') { said(pins.remove(id)); render(); return; }
    if (action === 'remove-constraint') { said(constraints.remove(id)); render(); return; }
    if (action === 'show-pins') { select(id); onStatus(`${nameOf(id)} is selected: its pins are on the canvas. Drag one to move it, drag the small squares to set its reach.`); return; }
    if (action === 'pin-middle') {
      const target = host.querySelector('[data-pin-target]')?.value;
      const point = target && middleOf(target);
      if (!point) { onStatus('Pick a path to pin first.', 'error'); return; }
      placeAt(target, point);
      return;
    }
    if (action === 'pin-place') {
      const target = host.querySelector('[data-pin-target]')?.value || null;
      if (!placePin) return;
      placePin({ target, label: target ? nameOf(target) : null, place: (element, point) => placeAt(element, point), cancel: () => onStatus('No pin added.') });
      onStatus('Click the artwork where the pin goes. Esc cancels.');
      return;
    }
    if (action === 'convert-selected') {
      const target = selectedId();
      const result = convertToPath ? convertToPath(target) : { ok: false, message: 'Not here.' };
      if (said(result)) onStatus(`${nameOf(target)} is a path now: it can be pinned, warped and reshaped.`);
      render();
      return;
    }
    if (action === 'mirror-pin') {
      const pin = rigPinModel(doc()).flatMap((group) => group.pins).find((item) => item.id === id);
      const about = pin ? mirrorAxis(pin.target) : null;
      if (about === null || about === undefined) { onStatus('Nothing to mirror about: the working area has no middle.', 'error'); return; }
      // A left eyelid's twin belongs on the right eyelid, not on the left one.
      const peer = /left/i.test(pin.target) ? pin.target.replace(/left/i, (word) => (word[0] === 'L' ? 'Right' : 'right')) : /right/i.test(pin.target) ? pin.target.replace(/right/i, (word) => (word[0] === 'R' ? 'Left' : 'left')) : null;
      const twinTarget = peer && peer !== pin.target && doc().elements?.[peer] && (elementKind(peer) === 'path' || typeof doc().elements[peer].restPath === 'string') ? peer : null;
      const result = pins.mirror(id, { about, ...(twinTarget ? { target: twinTarget, restPath: authoredPath(twinTarget) } : {}) });
      if (said(result)) onStatus(`${result.id} added on the other side. Move it if the face is not symmetric.`);
      render();
      return;
    }
    if (action === 'restore-pins') {
      const result = holding.restorePins(id);
      if (said(result)) onStatus(`${result.count} ${id} pin${result.count === 1 ? '' : 's'} put back, moved by the movements the face template uses.`);
      render();
      return;
    }
    if (action === 'group-pins') {
      const form = host.querySelector('[data-pin-group-form]');
      const picked = [...host.querySelectorAll('[data-pin-pick]:checked')].map((box) => box.dataset.pinPick);
      const chosen = form?.querySelector('[data-group-movement]')?.value || '';
      const parameter = chosen === '__new__' ? form?.querySelector('[data-group-name]')?.value?.trim() : chosen;
      const amount = (axis) => { const value = form?.querySelector(`[data-group-amount="${axis}"]`)?.value; return value === '' || value === undefined ? null : Number(value); };
      history.beginTransaction();
      const result = pins.group(picked, { parameter, x: amount('x'), y: amount('y') });
      if (!said(result)) { history.commitTransaction(); return; }
      let control = '';
      if (createHandle && form?.querySelector('[data-group-handle]')?.checked) {
        const targets = [...new Set(rigPinModel(doc()).flatMap((group) => group.pins).filter((pin) => picked.includes(pin.id)).map((pin) => pin.target))];
        const made = createHandle({ id: `${result.parameter}-control`, name: result.parameter.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(), elements: targets, y: amount('y') !== null ? result.parameter : null, x: amount('y') === null ? result.parameter : null });
        control = made?.ok ? ' A control for it is on the canvas and in Controls.' : made?.message ? ` (${made.message})` : '';
      }
      history.commitTransaction();
      onStatus(`${result.pins.length} pin${result.pins.length === 1 ? '' : 's'} now move with “${result.parameter}”: key it in Motions or Expressions.${control}`);
      render();
      return;
    }
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
    if (action === 'remove-point') { said(holding.removePoint(id)); render(); return; }
    if (action === 'add-own-point') {
      const form = host.querySelector('[data-point-form]');
      const name = form?.querySelector('[data-point-name]')?.value?.trim();
      const result = name
        ? holding.createPoint(name, form?.querySelector('[data-point-target]')?.value, null, form?.querySelector('[data-point-space]')?.value)
        : { ok: false, message: 'A point needs a name before anything can hold it.' };
      if (!result.ok) onStatus(result.message, 'error');
      else { onStatus(`“${name}” is at the middle of its artwork. Move it from there.`); form.querySelector('[data-point-name]').value = ''; }
      render();
      return;
    }
    if (action === 'remove-hold') { said(holding.removeHold(id)); render(); return; }
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
    const axial = pin.type === 'directional' || pin.type === 'slide';
    return `<div class="holding-row" data-rig-pin-row="${id}">
      <input type="checkbox" class="holding-pick" data-pin-pick="${id}" aria-label="Pick ${id} to move it with others">
      <b>${id}</b>
      <label>Kind<select data-pin-field="type" data-pin-id="${id}" aria-label="What kind of pin ${id} is">${RIG_PIN_TYPES.map((type) => `<option value="${type}"${type === pin.type ? ' selected' : ''}>${esc(PIN_TYPE_LABELS[type] || type)}</option>`).join('')}</select></label>
      <label>Softness<select data-pin-field="falloff" data-pin-id="${id}" aria-label="How softly ${id} lets go">${PIN_SOFTNESS_PRESETS.map((preset) => `<option value="${preset.id}"${preset.id === pin.falloff ? ' selected' : ''} title="${esc(preset.hint)}">${esc(preset.label)}</option>`).join('')}</select></label>
      <label>Reach across<input type="number" min="1" step="1" data-pin-field="radiusX" data-pin-id="${id}" aria-label="How far ${id} reaches sideways" value="${round(pin.radius.x)}"></label>
      <label>Reach down<input type="number" min="1" step="1" data-pin-field="radiusY" data-pin-id="${id}" aria-label="How far ${id} reaches up and down" value="${round(pin.radius.y)}"></label>
      ${axial ? `<label>Along<input type="number" step="5" data-pin-field="angle" data-pin-id="${id}" aria-label="The angle ${id} may move along, 0 is to the right and 90 is down" value="${pinAngle(pin)}" title="0° to the right, 90° down">°</label>` : ''}
      <button type="button" class="secondary" data-holding-action="mirror-pin" data-holding-id="${id}" title="The same pin on the other side of the face">Mirror</button>
      <button type="button" class="secondary" data-holding-action="remove-pin" data-holding-id="${id}" aria-label="Remove ${id}">×</button>
      <div class="holding-motion" data-rig-pin-motion="${id}">
        ${motionRow(pin, 'x', 'Moved sideways by', known)}
        ${motionRow(pin, 'y', 'Moved up / down by', known)}
      </div>
      ${pin.motion || pin.type === 'surface' ? '' : '<small class="small">Nothing moves this pin yet, so it holds its artwork still.</small>'}
    </div>`;
  }

  /** Add a pin: on which path, placed by a click or at the middle; a shape offers to become a path. */
  function pinForm(state) {
    const paths = pinnable();
    const current = selectedId();
    const kind = current ? elementKind(current) : null;
    const convertible = kind && ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'].includes(kind);
    if (!paths.length) return `<div class="holding-pin-new"><p class="small">${convertible ? `${esc(nameOf(current))} is a ${kind}, and a pin holds a path.` : 'A pin holds a path, and this mascot has no path yet.'}</p>${convertible ? '<div class="holding-row-actions"><button type="button" data-holding-action="convert-selected">Convert it to a path</button></div>' : ''}</div>`;
    return `<div class="holding-pin-new" data-pin-form>
      <label>Pin<select data-pin-target aria-label="The path the new pin holds">${paths.map((id) => `<option value="${esc(id)}">${esc(nameOf(id))}${id === current ? ' · selected' : ''}</option>`).join('')}</select></label>
      <div class="holding-row-actions">
        <button type="button" data-holding-action="pin-place" title="Then click on the artwork where the pin goes">Place it on the canvas</button>
        <button type="button" class="secondary" data-holding-action="pin-middle" title="At the middle of the path, to drag from there">At the middle</button>
        ${convertible ? `<button type="button" class="secondary" data-holding-action="convert-selected" title="${esc(nameOf(current))} is a ${kind}; a pin needs a path">Convert ${esc(nameOf(current))} to a path</button>` : ''}
      </div>
      <p class="small">Pins hold paths, one piece at a time: pin an eyelid, a cheek or a lip, not the group around them. A pin's own movement is set below, and several pins can move together.</p>
    </div>`;
  }

  /** The template's pin sets, put back when their parts are here and their pins are not. */
  function restoreRow(state, groups) {
    const has = (prefix) => groups.some((group) => group.pins.some((pin) => pin.id.startsWith(prefix)));
    const parts = state.semanticParts || {};
    const mouth = Object.values(parts).find((part) => part.type === 'mouth')?.roles?.mouth;
    const brows = Object.values(parts).find((part) => part.type === 'eyebrows')?.roles;
    const offers = [];
    if (mouth && !has('mouth-')) offers.push('<button type="button" class="secondary" data-holding-action="restore-pins" data-holding-id="mouth" title="Two corners and the lower lip, moved by the smile, the width and the jaw">Pin the mouth like the template</button>');
    if (brows?.leftBrow && brows?.rightBrow && !has('brow-')) offers.push('<button type="button" class="secondary" data-holding-action="restore-pins" data-holding-id="brow" title="Both ends of each brow, moved by the inner and outer raise">Pin the brows like the template</button>');
    return offers.length ? `<div class="holding-row-actions">${offers.join('')}</div>` : '';
  }

  /** Several pins, one movement: pick them above, say what moves them and how far. */
  function togetherForm(known) {
    return `<div class="holding-together" data-pin-group-form>
      <b>Move together</b>
      <p class="small">Tick the pins above, then give them one movement — one the mascot has, or a new one to key in Motions and Expressions.</p>
      <div class="holding-new">
        <label>Moved by<select data-group-movement aria-label="The movement the picked pins follow"><option value="__new__">a new movement…</option>${known.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></label>
        <label>Named<input data-group-name placeholder="cheekPuff" aria-label="The name of the new movement"></label>
        <label>Sideways by<input type="number" step="0.5" data-group-amount="x" aria-label="How far the pins go sideways at full movement" placeholder="—"></label>
        <label>Up / down by<input type="number" step="0.5" data-group-amount="y" aria-label="How far the pins go up and down at full movement" value="8"></label>
      </div>
      <div class="holding-row-actions"><label class="check"><input type="checkbox" data-group-handle checked>Add a control on the canvas</label><button type="button" data-holding-action="group-pins">Move them together</button></div>
    </div>`;
  }

  // Rendered only while its section is open: the panel follows every
  // selection change now, and measuring every point of a face a hundred
  // times for a closed section is work nobody sees. The section renders the
  // moment it opens.
  let stale = false;
  const section = host.closest?.('details');
  section?.addEventListener('toggle', () => { if (section.open && stale) render(); });

  function render() {
    if (section && !section.open) { stale = true; return; }
    stale = false;
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; return; }
    const groups = rigPinModel(state);
    // The selected piece's pins first: that is the piece whose pins are on the canvas.
    const current = selectedId();
    const ordered = [...groups].sort((a, b) => (a.target === current ? -1 : b.target === current ? 1 : 0));
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
      ${pinForm(state)}
      ${ordered.length
        ? ordered.map((group) => `<section class="holding-group" data-holding-target="${esc(group.target)}"${group.target === current ? ' data-holding-selected="true"' : ''}>
            <b>${esc(group.name)}${group.missing ? ' <small class="small">artwork missing</small>' : ''}${group.target === current ? ' <small class="small">selected · pins on the canvas</small>' : `<button type="button" class="secondary" data-holding-action="show-pins" data-holding-id="${esc(group.target)}" title="Select it: its pins and their reach appear on the canvas">Show on canvas</button>`}</b>
            ${group.pins.map((pin) => pinRow(pin, known)).join('')}
          </section>`).join('')
        : '<p class="small">None yet. Pin a path above: click where the pin goes, then drag it and its reach on the canvas.</p>'}
      ${restoreRow(state, groups)}
      ${groups.length ? togetherForm(known) : ''}
      ${hasSurfacePins(state) ? '<p class="small">The head carries its silhouette pins: the near cheek comes round as it turns, and the far one compresses.</p>' : ''}

      ${constraintSection(rigConstraintModel(state), { pieces: Object.keys(state.elements || {}), movements: known })}

      <h4>Points that can be held</h4>
      ${attachments.points.length
        ? bySpace(attachments.points).map(([space, points]) => `<section class="holding-group" data-holding-space="${esc(space)}">
            <b>${esc(space)}</b>
            <ul class="holding-points">${points.map(pointRow).join('')}</ul>
          </section>`).join('')
        : '<p class="small">None yet.</p>'}
      ${attachments.available.length
        ? `<div class="chip-row">${attachments.available.map((point) => `<button type="button" class="chip" data-holding-action="add-point" data-holding-id="${esc(point.id)}" title="${esc(point.id)}">+ ${esc(point.label || point.id)}</button>`).join('')}</div>`
        : ''}
      <form class="holding-new" data-point-form>
        <label>A point of your own<input data-point-name placeholder="snout.tip" aria-label="What to call the new point"></label>
        <label>on<select data-point-target aria-label="The artwork to put it on">${Object.keys(state.elements || {}).map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join('')}</select></label>
        <label>part of<select data-point-space aria-label="What the new point is part of">${ATTACHMENT_SPACES.map((space) => `<option value="${space}">${space}</option>`).join('')}</select></label>
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
            <label>on<select data-holding-anchor aria-label="The point it holds on to">${attachments.points.map((point, index) => `<option value="${esc(point.id)}"${index === 1 ? ' selected' : ''}>${esc(point.id)}</option>`).join('')}</select></label>
            <button type="button" data-holding-action="hold">Hold it</button>
          </form>`
        : '<p class="small">Name two points before one can hold the other.</p>'}
    </div>`;
  }

  return { render };
}
