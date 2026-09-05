/**
 * Rig handles as records an author owns (docs/DIRECT_CONTROLS.md).
 *
 * The handles on the mascot were a hard-coded list: eleven definitions keyed to
 * semantic part types, plus whatever the hands generate. Good defaults, and
 * nothing an author could change — not where a handle sits, not how far it may
 * go, not what it is called, not whether it is there at all. That is the
 * difference between a poser and a rig.
 *
 * A handle is a record now. `document.rigHandles` is **sparse**: it holds only
 * what an author changed, and everything else comes from the generated set. So
 * a project that has authored nothing behaves exactly as before, and improving
 * the defaults still improves every project that already exists — which is how
 * the set grew from five handles to fifteen without anyone reopening a file.
 *
 * Pure. It reads the document and reports handles; the canvas draws them and
 * the board lists them.
 */
import { puppetHandles } from './puppet-handles.js';
import { RIG_HANDLE_CONTROLLERS, normalizeRigHandles } from './handle-record.js';

export { RIG_HANDLE_SHAPES, RIG_HANDLE_SIZES, RIG_HANDLE_COLOURS, RIG_HANDLE_SPOTS, RIG_HANDLE_CONTROLLERS, RIG_CONTROL_WIDGETS, normalizeRigHandle, normalizeRigHandles } from './handle-record.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 1000) / 1000;

/** Apply an author's limits, lock and snap to one resolved axis. */
function applyAxisOverride(axis, override) {
  if (!axis) return axis;
  if (!override) return { ...axis, locked: false, snap: 0 };
  const min = override.min !== undefined ? Math.max(axis.min, override.min) : axis.min;
  const max = override.max !== undefined ? Math.min(axis.max, override.max) : axis.max;
  return {
    ...axis,
    // A limit narrows what the movement allows; it can never widen it, or a
    // handle would drive a parameter past its own range.
    min: Math.min(min, max), max: Math.max(min, max),
    locked: override.locked === true,
    snap: number(override.snap, 0)
  };
}

const DEFAULT_WIDGET = Object.freeze({ shape: 'circle', size: 'normal', colour: 'default' });

/** An axis a drag can still reach: a locked one is not a direction any more. */
const free = (axis) => Boolean(axis) && axis.locked !== true;
/** Past this many stops a list stops reading as a list and becomes a range. */
const STOP_LIMIT = 9;

/**
 * The places a stepped axis can land on, in order (VNX-14).
 *
 * A step is already what a drag lands on, so a movement an author cut into a
 * handful of steps is not a range any more — it is a short list of places, and
 * a list is picked from rather than dragged through. An axis with no step, or
 * with more steps than anyone can pick from, has no stops.
 */
export function controllerStops(axis) {
  const step = free(axis) ? number(axis.snap, 0) : 0;
  if (step <= 0) return [];
  const count = Math.round((axis.max - axis.min) / step);
  if (!Number.isFinite(count) || count < 1 || count + 1 > STOP_LIMIT) return [];
  return Array.from({ length: count + 1 }, (_, index) => round(Math.min(axis.max, axis.min + index * step)));
}

/**
 * Which control this handle wants: the shape of the control matches the
 * movement it drives (VNX-14, docs/VNEXT_ROADMAP.md).
 *
 * It is derived from the axes the handle already has — how many of them a drag
 * can still reach, whether one of them is a turn, whether its steps make it
 * discrete — rather than from a table of part types, so a hand, an eyelid and
 * a control an author invented on a mascot the registry has never seen all get
 * the answer their own movement deserves.
 */
export function handleController(handle) {
  const linear = [handle?.x, handle?.y].filter(free);
  // A turn is a turn however many steps it has: an orbit alone is an arc.
  if (free(handle?.orbit) && !linear.length) return 'arc';
  if (linear.length === 1 && controllerStops(linear[0]).length) return 'chips';
  // What the *definition* asks for, where the axes can honestly carry it: a
  // gaze is a target rather than a pad and a pupil is a ring rather than a
  // slider, and neither of those is derivable from the numbers alone
  // (docs/FACE_CONTROL_RIG.md). Anything the axes cannot support falls through
  // to the derivation, so a target with one axis left is still a slider.
  if (handle?.controller === 'target' && linear.length === 2) return 'target';
  if (handle?.controller === 'radial' && linear.length === 1) return 'radial';
  if (linear.length === 2) return 'pad';
  if (linear.length === 1) return 'slider';
  // Every axis locked is an author's decision, not a missing control: it still
  // says where the movement is, it just cannot be moved.
  return 'locked';
}

/**
 * The kind a resolved handle ends up with. An author's choice wins — that is
 * what the record is for — and everything else is derived from the axes as
 * they ended up, so narrowing, locking or stepping one changes the control.
 */
function withController(handle) {
  const chosen = handle.widget?.controller;
  const controller = RIG_HANDLE_CONTROLLERS.includes(chosen) ? chosen : handleController(handle);
  return { ...handle, widget: { ...handle.widget, controller } };
}

/**
 * Every handle this project has, generated and authored, ready to draw.
 *
 * @param {object} document
 * @returns {object[]} the same shape the canvas has always consumed, plus
 *   `widget`, `layer`, and axes carrying `locked` and `snap`.
 */
export function resolveRigHandles(document = {}) {
  const overrides = new Map(normalizeRigHandles(document).map((item) => [item.id, item]));
  const generated = puppetHandles(document);
  const resolved = [];
  for (const handle of generated) {
    const override = overrides.get(handle.id);
    overrides.delete(handle.id);
    if (override?.hidden) continue;
    resolved.push(withController(mergeHandle(handle, override)));
  }
  // Authored handles that no generated one matches: they carry their own
  // artwork and axes, so they can exist on a project the registry knows
  // nothing about.
  for (const override of overrides.values()) {
    if (override.hidden || !override.authored) continue;
    const handle = authoredHandle(document, override);
    if (handle) resolved.push(withController(handle));
  }
  return resolved;
}

/**
 * The shape a control wants when nobody has said otherwise.
 *
 * A ring is a size and a size is drawn as a ring, on the mascot as well as on
 * the board -- the two surfaces have to agree or the same control reads as two
 * different things (docs/FACE_CONTROL_RIG.md).
 */
const SHAPE_FOR_CONTROLLER = Object.freeze({ radial: 'ring' });

function mergeHandle(handle, override) {
  const widget = { ...DEFAULT_WIDGET, ...(handle.group ? { size: 'small' } : {}),
    ...(SHAPE_FOR_CONTROLLER[handle.controller] ? { shape: SHAPE_FOR_CONTROLLER[handle.controller] } : {}),
    ...(override?.widget || {}) };
  return {
    ...handle,
    label: override?.name || handle.label,
    hint: override?.hint || handle.hint,
    at: override?.at || handle.at,
    offset: override?.offset || null,
    throw: override?.throw ?? handle.throw,
    group: override?.group !== undefined ? override.group : handle.group || null,
    // The cage it is drawn inside, and the link that decides which of its two
    // parameters it writes. Both are the generated handle's, not an override's:
    // an author renames and limits a control, they do not re-parent the face.
    visualParent: override?.visualParent || handle.visualParent || null,
    link: handle.link || null, linked: Boolean(handle.linked),
    layer: override?.layer || handle.layer || 'face',
    widget,
    x: applyAxisOverride(handle.x, override?.axes?.x),
    y: applyAxisOverride(handle.y, override?.axes?.y),
    orbit: applyAxisOverride(handle.orbit, override?.axes?.orbit),
    authored: false
  };
}

/** A handle an author made from scratch: its own artwork, its own parameters. */
function authoredHandle(document, override) {
  const elements = (override.elements || []).filter((id) => document.elements?.[id]);
  if (!elements.length) return null;
  const axis = (key) => {
    const control = override.axes?.[key]?.parameter;
    const parameter = control ? document.params?.[control] : null;
    if (!parameter) return null;
    const base = { control, label: control, min: number(parameter.min, -1), max: number(parameter.max, 1), rest: number(parameter.default, 0) };
    return applyAxisOverride(base, override.axes[key]);
  };
  const x = axis('x'), y = axis('y'), orbit = axis('orbit');
  if (!x && !y && !orbit) return null;
  return {
    id: override.id, label: override.name || override.id, hint: override.hint || 'Drag to move this control',
    partId: null, elements, anchor: elements[0], at: override.at || 'centre',
    mode: orbit && !x && !y ? 'orbit' : 'drag', grid: false,
    group: override.group || null, visualParent: override.visualParent || null, link: null, linked: false,
    layer: override.layer || 'custom',
    widget: { ...DEFAULT_WIDGET, ...(override.widget || {}) },
    offset: override.offset || null,
    x, y, orbit,
    invertY: Boolean(override.axes?.y?.invert),
    throw: number(override.throw, 0.6),
    authored: true
  };
}

/**
 * The board: every handle grouped by layer, with what it is set to.
 *
 * A handle on a part that is off-screen, or under another handle, is
 * unreachable on the canvas — the board is where the whole rig is visible at
 * once, which is the thing an animator means by a control picker.
 */
export function handleBoardModel(document = {}, values = {}) {
  const handles = resolveRigHandles(document);
  const byId = new Map(handles.map((handle) => [handle.id, handle]));
  const layers = new Map();
  for (const handle of handles) {
    // A member is listed under its group rather than on its own row.
    if (handle.group && byId.has(handle.group)) continue;
    const layer = handle.layer || 'face';
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer).push({
      ...describeHandle(handle, values),
      members: handles.filter((item) => item.group === handle.id).map((item) => describeHandle(item, values))
    });
  }
  // A handle switched off is still an author's decision, so it stays listed —
  // otherwise hiding one is the same as losing it.
  const shown = new Set(handles.map((handle) => handle.id));
  const hidden = normalizeRigHandles(document).filter((item) => item.hidden && !shown.has(item.id))
    .map((item) => ({ id: item.id, label: item.name || item.id }));
  return { layers: [...layers].map(([name, items]) => ({ name, items })), hidden, count: handles.length };
}

/** One row of the board: what it drives, and where each axis is now. */
function describeHandle(handle, values = {}) {
  const axis = (item, key) => (item ? {
    control: item.control, label: item.label, min: item.min, max: item.max, rest: round(item.rest),
    locked: Boolean(item.locked), snap: number(item.snap, 0),
    // Dragging up raises an inverted axis, so the control that draws it has to
    // read upwards too, or the board and the mascot would disagree.
    invert: key === 'y' && Boolean(handle.invertY),
    stops: controllerStops(item),
    value: round(Math.max(item.min, Math.min(item.max, number(values[item.control], item.rest))))
  } : null);
  return {
    id: handle.id, label: handle.label, layer: handle.layer || 'face', widget: handle.widget || DEFAULT_WIDGET,
    visualParent: handle.visualParent || null, link: handle.link || null, linked: Boolean(handle.linked),
    // The kind of control this row renders, and how many degrees of turn cover
    // an arc's whole range — the same `throw` the canvas turns a wrist by.
    controller: handle.widget?.controller || handleController(handle), throw: number(handle.throw, 1),
    authored: Boolean(handle.authored), group: handle.group || null,
    axes: [['x', handle.x], ['y', handle.y], ['orbit', handle.orbit]].map(([key, item]) => (item ? { key, ...axis(item, key) } : null)).filter(Boolean)
  };
}
