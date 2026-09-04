/**
 * What a handle override *is*, as data (docs/DIRECT_CONTROLS.md).
 *
 * Split from the model on purpose: the project document normalizes this on
 * every load, undo and snapshot, and it should not have to pull the whole
 * handle-resolution chain in to do it. Nothing here imports anything.
 */
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 1000) / 1000;
const oneOf = (value, allowed) => (allowed.includes(value) ? value : null);
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The widget vocabulary. Tokens, never colours: the theme owns the palette. */
export const RIG_HANDLE_SHAPES = Object.freeze(['circle', 'ring', 'square', 'diamond', 'barH', 'barV']);
export const RIG_HANDLE_SIZES = Object.freeze(['small', 'normal', 'large']);
export const RIG_HANDLE_COLOURS = Object.freeze(['default', 'warm', 'cool', 'green', 'violet', 'grey']);
/** Where on its artwork a handle sits. The canvas turns these into a point. */
export const RIG_HANDLE_SPOTS = Object.freeze(['centre', 'top', 'bottom', 'left', 'right', 'bottomLeft']);

/**
 * One axis override: what an author narrowed, locked or snapped.
 *
 * `min`/`max` are **limits**, not the parameter's range — null means "whatever
 * the movement itself allows". A limit is the thing a rig has and a poser does
 * not: this mouth never opens past 0.7, and no gesture can take it there.
 */
function normalizeAxisOverride(source) {
  if (!source || typeof source !== 'object') return null;
  const axis = {};
  if (Number.isFinite(Number(source.min))) axis.min = round(source.min);
  if (Number.isFinite(Number(source.max))) axis.max = round(source.max);
  if (source.locked === true) axis.locked = true;
  if (Number(source.snap) > 0) axis.snap = round(source.snap);
  if (typeof source.parameter === 'string' && source.parameter) axis.parameter = source.parameter;
  if (source.invert === true) axis.invert = true;
  return Object.keys(axis).length ? axis : null;
}

/** One stored override. Everything but `id` is optional, and absent means "as generated". */
export function normalizeRigHandle(source) {
  const id = text(source?.id);
  if (!id) return null;
  const handle = { id };
  if (source.hidden === true) handle.hidden = true;
  const name = text(source.name); if (name) handle.name = name;
  const hint = text(source.hint); if (hint) handle.hint = hint;
  const at = oneOf(source.at, RIG_HANDLE_SPOTS); if (at) handle.at = at;
  if (source.offset && (Number(source.offset.x) || Number(source.offset.y))) {
    handle.offset = { x: round(source.offset.x), y: round(source.offset.y) };
  }
  if (Number(source.throw) > 0) handle.throw = round(source.throw);
  const axes = {};
  for (const key of ['x', 'y', 'orbit']) { const axis = normalizeAxisOverride(source.axes?.[key]); if (axis) axes[key] = axis; }
  if (Object.keys(axes).length) handle.axes = axes;
  const widget = {};
  const shape = oneOf(source.widget?.shape, RIG_HANDLE_SHAPES); if (shape) widget.shape = shape;
  const size = oneOf(source.widget?.size, RIG_HANDLE_SIZES); if (size) widget.size = size;
  const colour = oneOf(source.widget?.colour, RIG_HANDLE_COLOURS); if (colour) widget.colour = colour;
  if (Object.keys(widget).length) handle.widget = widget;
  const group = text(source.group); if (group && group !== id) handle.group = group;
  const layer = text(source.layer); if (layer) handle.layer = layer;
  // An authored handle carries what it needs to exist at all; an override on a
  // generated one carries none of this.
  const elements = Array.isArray(source.elements) ? source.elements.filter((item) => text(item)) : [];
  if (elements.length) handle.elements = elements;
  if (source.authored === true) handle.authored = true;
  return handle;
}

/** The stored overrides, in the order they were written, with the rubbish dropped. */
export function normalizeRigHandles(candidate) {
  const list = Array.isArray(candidate?.rigHandles) ? candidate.rigHandles : [];
  const seen = new Set();
  const handles = [];
  for (const item of list) {
    const handle = normalizeRigHandle(item);
    if (!handle || seen.has(handle.id)) continue;
    seen.add(handle.id);
    handles.push(handle);
  }
  // A group that points at a handle nobody has is not a group.
  for (const handle of handles) if (handle.group && !seen.has(handle.group) && !handle.authored) delete handle.group;
  return handles;
}

