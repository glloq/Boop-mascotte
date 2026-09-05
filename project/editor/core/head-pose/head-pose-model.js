/**
 * Head Pose 2.5D (docs/HEAD_POSE_2_5D.md).
 *
 * A head pose is a grid of captures over `headX × headY`. Each cell records,
 * for every participating element, how far it moved, turned, scaled or faded
 * away from its rest transform. Between cells the keyform engine interpolates,
 * which reads as a head turning.
 *
 * It is a **cartoon illusion of rotation**, not a 3D rotation. Nothing here
 * projects, and no element is ever aware of a camera.
 *
 * Storage is ordinary v4 keyforms — one record per (element, channel) — so the
 * runtime needs no head-pose concept at all. Every function is pure and returns
 * a new keyform list, which is what makes a cancelled capture restore the exact
 * previous state.
 */
import {
  normalizeKeyform, normalizeAxis, keyformChannelNeutral, KEYFORM_CHANNELS
} from '../../../runtime/keyforms.js';
import {
  setKeyformCell, clearKeyformCell, getKeyformCell, mirrorAxisIndex, HORIZONTAL_MIRROR_SIGN
} from '../keyforms/keyform-model.js';

/** Prefix that marks a keyform as belonging to a head-pose grid. */
export const HEAD_POSE_PREFIX = 'headPose';

/** Channels a head-pose cell can capture, in application order. */
export const HEAD_POSE_CHANNELS = Object.freeze(['translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity']);

export const DEFAULT_HEAD_POSE_AXES = Object.freeze({
  x: Object.freeze({ parameter: 'headX', values: Object.freeze([-1, 0, 1]) }),
  y: Object.freeze({ parameter: 'headY', values: Object.freeze([-1, 0, 1]) })
});

export function createHeadPoseAxes({ x, y } = {}) {
  return {
    x: normalizeAxis(x || DEFAULT_HEAD_POSE_AXES.x),
    y: normalizeAxis(y || DEFAULT_HEAD_POSE_AXES.y)
  };
}

const axisList = (axes) => [axes.x, axes.y];

export function headPoseKeyformId(elementId, channel, shapeKey = null) {
  return shapeKey
    ? `${HEAD_POSE_PREFIX}:${elementId}:${channel}:${shapeKey}`
    : `${HEAD_POSE_PREFIX}:${elementId}:${channel}`;
}

export function isHeadPoseKeyform(keyform) {
  return typeof keyform?.id === 'string' && keyform.id.startsWith(`${HEAD_POSE_PREFIX}:`);
}

/* ── Outlines a cell owns (3D-06) ─────────────────────────────────────────
 *
 * A cell can hold an outline as well as a movement: the author node-edits the
 * artwork, and what is stored is an ordinary additive shape key plus a
 * `pathShape` keyform that weights it — no new runtime concept, and nothing
 * head-pose-specific to play it back.
 *
 * The id is the address, so re-capturing a cell replaces the same shape rather
 * than growing a second one; `generatedBy` is the owner, marked the way every
 * generated shape key is, so a reset knows what to take with it.
 */

export function headPoseShapeKeyId(elementId, cell = { i: 0, j: 0 }) {
  return `${HEAD_POSE_PREFIX}-${elementId}-${cell.i}-${cell.j}`;
}

export const headPoseShapeOwner = (cell = { i: 0, j: 0 }) => ({ semanticPart: HEAD_POSE_PREFIX, control: `${cell.i},${cell.j}` });

/** Whether this shape belongs to the grid — to one cell of it, when asked. */
export function isHeadPoseShapeKey(shapeKey, cell = null) {
  if (shapeKey?.generatedBy?.semanticPart !== HEAD_POSE_PREFIX) return false;
  return !cell || shapeKey.generatedBy.control === `${cell.i},${cell.j}`;
}

/** The shapes a cell owns, in a stable order. */
export function headPoseCellShapes(shapeKeys = [], cell = null) {
  return (shapeKeys || []).filter((shapeKey) => isHeadPoseShapeKey(shapeKey, cell));
}

/**
 * Drop the shapes a reset takes with it — one cell's, or the whole grid's.
 *
 * The keyform that weighted them goes at the same time, so a shape left behind
 * would deform nothing; it would only sit in the shape-key list forever.
 */
export function resetHeadPoseShapes(shapeKeys = [], cell = null) {
  return (shapeKeys || []).filter((shapeKey) => !isHeadPoseShapeKey(shapeKey, cell));
}

/**
 * Where the grid rests: the cell both axes read 0 at, or `null` when an axis
 * was retuned to one that never passes through the centre.
 */
export function headPoseRestCell(axes = createHeadPoseAxes()) {
  const i = axes.x.values.indexOf(0);
  const j = axes.y.values.indexOf(0);
  return i < 0 || j < 0 ? null : { i, j };
}

/** Head-pose keyforms whose axes match the grid being edited. */
export function headPoseKeyforms(keyforms = [], axes = createHeadPoseAxes()) {
  return (keyforms || []).filter((keyform) => isHeadPoseKeyform(keyform)
    && keyform.axes?.[0]?.parameter === axes.x.parameter
    && keyform.axes?.[1]?.parameter === axes.y.parameter);
}

/** Every cell of the grid, row-major, with the arrow a UI can label it with. */
export function headPoseCells(axes = createHeadPoseAxes()) {
  const cells = [];
  for (let j = 0; j < axes.y.values.length; j += 1) {
    for (let i = 0; i < axes.x.values.length; i += 1) {
      cells.push({ i, j, x: axes.x.values[i], y: axes.y.values[j], center: axes.x.values[i] === 0 && axes.y.values[j] === 0 });
    }
  }
  return cells;
}

/* ── Reading a cell ──────────────────────────────────────────────────────── */

/** What a cell holds: `{ [elementId]: { channel: value, … } }`. */
export function headPoseCellSamples(keyforms = [], axes = createHeadPoseAxes(), cell = { i: 0, j: 0 }) {
  const samples = {};
  for (const keyform of headPoseKeyforms(keyforms, axes)) {
    const value = getKeyformCell(keyform, cell.i, cell.j);
    if (value === null) continue;
    const elementId = keyform.target.id;
    samples[elementId] ||= {};
    const slot = keyform.channel === 'pathShape' ? `shape:${keyform.shapeKey}` : keyform.channel;
    samples[elementId][slot] = value;
  }
  return samples;
}

/** `empty` when nothing is captured, `neutral` when everything captured is at rest. */
export function headPoseCellState(keyforms = [], axes = createHeadPoseAxes(), cell = { i: 0, j: 0 }) {
  let captured = false;
  let moved = false;
  for (const keyform of headPoseKeyforms(keyforms, axes)) {
    const value = getKeyformCell(keyform, cell.i, cell.j);
    if (value === null) continue;
    captured = true;
    if (value !== keyformChannelNeutral(keyform.channel)) moved = true;
  }
  if (!captured) return 'empty';
  return moved ? 'captured' : 'neutral';
}

/** Grid state for the UI: one entry per cell, plus how many elements it holds. */
export function headPoseSummary(keyforms = [], axes = createHeadPoseAxes()) {
  return headPoseCells(axes).map((cell) => {
    const samples = headPoseCellSamples(keyforms, axes, cell);
    return { ...cell, state: headPoseCellState(keyforms, axes, cell), elements: Object.keys(samples).length };
  });
}

/** Elements that take part in the grid, in a stable order. */
export function headPoseElements(keyforms = [], axes = createHeadPoseAxes()) {
  return [...new Set(headPoseKeyforms(keyforms, axes).map((keyform) => keyform.target.id))].sort();
}

/* ── Capture ─────────────────────────────────────────────────────────────── */

/**
 * Turn posed transforms into the offsets a cell stores.
 *
 * Additive channels record a difference from rest, multiplicative ones a
 * factor, matching how `compileRigFrame` composes keyforms with bindings — so a
 * captured cell reproduces exactly the transform the author posed.
 */
export function headPoseSamplesFromTransforms(elements = {}, posed = {}) {
  const samples = {};
  for (const [id, transform] of Object.entries(posed)) {
    const base = elements?.[id]?.baseTransform || {};
    const sample = {};
    const put = (channel, value, neutral) => { if (Number.isFinite(value) && value !== neutral) sample[channel] = value; };
    if (transform.x !== undefined) put('translateX', Number(transform.x) - number(base.x, 0), 0);
    if (transform.y !== undefined) put('translateY', Number(transform.y) - number(base.y, 0), 0);
    if (transform.rotation !== undefined) put('rotation', Number(transform.rotation) - number(base.rotation, 0), 0);
    if (transform.scaleX !== undefined) put('scaleX', safeRatio(transform.scaleX, base.scaleX), 1);
    if (transform.scaleY !== undefined) put('scaleY', safeRatio(transform.scaleY, base.scaleY), 1);
    if (transform.opacity !== undefined) put('opacity', safeRatio(transform.opacity, elements?.[id]?.baseOpacity ?? 1), 1);
    for (const [shapeKeyId, weight] of Object.entries(transform.shapeKeys || {})) {
      if (Number.isFinite(Number(weight)) && Number(weight) !== 0) sample[`shape:${shapeKeyId}`] = Number(weight);
    }
    // A neutral element is still recorded, so "captured but unchanged" is a
    // state an author can see and rely on rather than an absence.
    samples[id] = sample;
  }
  return samples;
}

/**
 * Write one cell of the grid.
 *
 * Every channel the samples mention is written, including the ones that are at
 * their neutral value, so a cell that deliberately says "this element does not
 * move here" holds instead of interpolating through from its neighbours.
 */
export function captureHeadPose(keyforms = [], { axes = createHeadPoseAxes(), cell = { i: 0, j: 0 }, samples = {}, channels = HEAD_POSE_CHANNELS } = {}) {
  let next = [...(keyforms || [])];
  const rest = headPoseRestCell(axes);
  for (const [elementId, sample] of Object.entries(samples)) {
    const slots = new Set([...channels, ...Object.keys(sample)]);
    for (const slot of slots) {
      const shapeKey = slot.startsWith('shape:') ? slot.slice(6) : null;
      const channel = shapeKey ? 'pathShape' : slot;
      if (!KEYFORM_CHANNELS.includes(channel)) continue;
      const value = sample[slot] ?? (shapeKey ? 0 : keyformChannelNeutral(channel));
      next = writeCell(next, axes, elementId, channel, shapeKey, cell, value);
      // A lone sample holds across the whole axis (docs/KEYFORM_ENGINE.md,
      // "Sparse grids"), so a shape captured in one cell would deform the
      // mascot everywhere, the rest pose included. The zero pins it: rest
      // stays the outline that was drawn, and the cell reads `neutral` there
      // rather than `captured`, because that is exactly what it now holds.
      if (shapeKey && rest && !sameCell(rest, cell)) next = anchorAtRest(next, axes, elementId, shapeKey, rest);
    }
  }
  return next;
}

const sameCell = (a, b) => a.i === b.i && a.j === b.j;

/** Write the rest cell's zero, unless the author already captured a weight there. */
function anchorAtRest(keyforms, axes, elementId, shapeKey, rest) {
  const existing = keyforms.find((keyform) => keyform.id === headPoseKeyformId(elementId, 'pathShape', shapeKey));
  if (existing && getKeyformCell(existing, rest.i, rest.j) !== null) return keyforms;
  return writeCell(keyforms, axes, elementId, 'pathShape', shapeKey, rest, 0);
}

function writeCell(keyforms, axes, elementId, channel, shapeKey, cell, value) {
  const id = headPoseKeyformId(elementId, channel, shapeKey);
  const index = keyforms.findIndex((keyform) => keyform.id === id);
  const existing = index >= 0 ? keyforms[index] : normalizeKeyform({
    id, target: { kind: 'element', id: elementId }, channel, shapeKey,
    axes: axisList(axes), keyforms: [], extrapolation: 'clamp'
  });
  const updated = setKeyformCell(existing, cell.i, cell.j, value);
  if (index >= 0) { const copy = [...keyforms]; copy[index] = updated; return copy; }
  return [...keyforms, updated];
}

/* ── Reset, copy, paste ──────────────────────────────────────────────────── */

/** Clear one cell. Keyforms that end up empty are removed entirely. */
export function resetHeadPoseCell(keyforms = [], axes = createHeadPoseAxes(), cell = { i: 0, j: 0 }) {
  const rest = headPoseRestCell(axes);
  return (keyforms || [])
    .map((keyform) => headPoseKeyforms([keyform], axes).length ? clearCell(keyform, cell, rest) : keyform)
    .filter((keyform) => !isHeadPoseKeyform(keyform) || keyform.keyforms.length > 0);
}

/**
 * Clear one cell — and, for a shape, the zero that was only holding it away
 * from rest. Left behind, that zero keeps a keyform alive that now weights
 * nothing anywhere, which is how a cleared cell stops counting as empty.
 */
function clearCell(keyform, cell, rest) {
  const cleared = clearKeyformCell(keyform, cell.i, cell.j);
  if (keyform.channel !== 'pathShape' || !rest || sameCell(rest, cell)) return cleared;
  const onlyRest = cleared.keyforms.every((entry) => entry.at[0] === rest.i && (entry.at[1] ?? 0) === rest.j);
  return onlyRest ? clearKeyformCell(cleared, rest.i, rest.j) : cleared;
}

/** Clear the whole grid, leaving any non-head-pose keyform untouched. */
export function resetHeadPose(keyforms = [], axes = createHeadPoseAxes()) {
  const grid = new Set(headPoseKeyforms(keyforms, axes).map((keyform) => keyform.id));
  return (keyforms || []).filter((keyform) => !grid.has(keyform.id));
}

export function copyHeadPoseCell(keyforms = [], axes = createHeadPoseAxes(), cell = { i: 0, j: 0 }) {
  const samples = headPoseCellSamples(keyforms, axes, cell);
  return Object.keys(samples).length ? { axes: { x: axes.x.parameter, y: axes.y.parameter }, samples } : null;
}

export function pasteHeadPoseCell(keyforms = [], axes = createHeadPoseAxes(), cell = { i: 0, j: 0 }, clipboard = null) {
  if (!clipboard?.samples) return keyforms;
  return captureHeadPose(keyforms, { axes, cell, samples: clipboard.samples, channels: [] });
}

/* ── Mirror ──────────────────────────────────────────────────────────────── */

/**
 * Mirror the grid across its X axis.
 *
 * Columns swap, direction-dependent channels flip sign, and paired elements
 * swap with each other so a captured "looking left" becomes a correct
 * "looking right" rather than a left ear that grew on the right.
 *
 * `onto` (the default) writes the mirrored cells over the grid and keeps the
 * cells the mirror does not reach — pose one side, get the other. `replace`
 * discards the original grid, which is how a whole rig is flipped.
 *
 * @param {Record<string,string>} pairs left/right element pairs, either direction
 */
export function mirrorHeadPoseHorizontal(keyforms = [], axes = createHeadPoseAxes(), pairs = {}, { mode = 'onto' } = {}) {
  const grid = headPoseKeyforms(keyforms, axes);
  if (grid.length === 0) return keyforms;
  const partner = { ...pairs };
  for (const [left, right] of Object.entries(pairs)) partner[right] ||= left;
  const values = axes.x.values;

  const base = mode === 'replace'
    ? (keyforms || []).filter((keyform) => !grid.includes(keyform))
    : [...(keyforms || [])];
  let next = base;
  for (const keyform of grid) {
    const elementId = partner[keyform.target.id] || keyform.target.id;
    const sign = HORIZONTAL_MIRROR_SIGN[keyform.channel] ?? 1;
    for (const entry of keyform.keyforms) {
      const cell = { i: mirrorAxisIndex(values, entry.at[0]), j: entry.at[1] ?? 0 };
      next = writeCell(next, axes, elementId, keyform.channel, keyform.shapeKey, cell, entry.value * sign);
    }
  }
  return next;
}

/* ── Axes ────────────────────────────────────────────────────────────────── */

/** Retune the grid. Captures outside the new axes are dropped, as elsewhere. */
export function setHeadPoseAxes(keyforms = [], axes = createHeadPoseAxes(), next = createHeadPoseAxes()) {
  const grid = new Set(headPoseKeyforms(keyforms, axes).map((keyform) => keyform.id));
  return (keyforms || []).map((keyform) => grid.has(keyform.id)
    ? normalizeKeyform({ ...keyform, axes: axisList(next) })
    : keyform);
}

function number(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function safeRatio(value, base) {
  const numerator = Number(value);
  const denominator = number(base, 1);
  if (!Number.isFinite(numerator) || denominator === 0) return 1;
  return numerator / denominator;
}
