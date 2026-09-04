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
import { normalizeRigHandles } from './handle-record.js';

export { RIG_HANDLE_SHAPES, RIG_HANDLE_SIZES, RIG_HANDLE_COLOURS, RIG_HANDLE_SPOTS, normalizeRigHandle, normalizeRigHandles } from './handle-record.js';

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
    resolved.push(mergeHandle(handle, override));
  }
  // Authored handles that no generated one matches: they carry their own
  // artwork and axes, so they can exist on a project the registry knows
  // nothing about.
  for (const override of overrides.values()) {
    if (override.hidden || !override.authored) continue;
    const handle = authoredHandle(document, override);
    if (handle) resolved.push(handle);
  }
  return resolved;
}

function mergeHandle(handle, override) {
  const widget = { ...DEFAULT_WIDGET, ...(handle.group ? { size: 'small' } : {}), ...(override?.widget || {}) };
  return {
    ...handle,
    label: override?.name || handle.label,
    hint: override?.hint || handle.hint,
    at: override?.at || handle.at,
    offset: override?.offset || null,
    throw: override?.throw ?? handle.throw,
    group: override?.group !== undefined ? override.group : handle.group || null,
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
    group: override.group || null, layer: override.layer || 'custom',
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
  const axis = (item) => (item ? {
    control: item.control, label: item.label, min: item.min, max: item.max,
    locked: Boolean(item.locked), snap: number(item.snap, 0),
    value: round(Math.max(item.min, Math.min(item.max, number(values[item.control], item.rest))))
  } : null);
  return {
    id: handle.id, label: handle.label, layer: handle.layer || 'face', widget: handle.widget || DEFAULT_WIDGET,
    authored: Boolean(handle.authored), group: handle.group || null,
    axes: [['x', handle.x], ['y', handle.y], ['orbit', handle.orbit]].map(([key, item]) => (item ? { key, ...axis(item) } : null)).filter(Boolean)
  };
}
