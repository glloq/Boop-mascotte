/**
 * Keyform core — parameter → value interpolation over a 1D axis or a 2D grid.
 *
 * Pure numeric and DOM-free so the editor preview and the exported runtime can
 * evaluate identical poses (docs/KEYFORM_ENGINE.md).  The keyform concept is a
 * reimplementation, not a port; see docs/OSS_REFERENCES.md.
 *
 * Two properties drive the whole module:
 *
 *   * axes are **irregular** — `[-1, -0.4, 0, 0.7, 1]` is as valid as `[-1, 0, 1]`;
 *   * grids are **sparse** — an author captures the cells they care about, and
 *     the evaluator interpolates between the nearest captured neighbours.
 */

export const KEYFORM_EXTRAPOLATIONS = Object.freeze(['clamp', 'linear']);

/**
 * `depth` is last because the order is what an author reads in a channel list,
 * and it is the newest.  It moves an element through the depth bands
 * (docs/DEPTH_PARALLAX.md) instead of moving its artwork, which is what lets a
 * head pose say "this ear goes behind the face" with no new runtime concept.
 */
export const KEYFORM_CHANNELS = Object.freeze([
  'translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity', 'pathShape', 'depth'
]);

/**
 * Value a channel must resolve to when a keyform contributes nothing.
 *
 * `depth` is 0 like the other additive channels: a cell records how far a pose
 * pushes an element *away from* its authored depth, never an absolute depth, so
 * an uncaptured cell leaves the element exactly where the rig put it.
 */
export const KEYFORM_CHANNEL_NEUTRAL = Object.freeze({
  translateX: 0, translateY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, pathShape: 0, depth: 0
});

export function keyformChannelNeutral(channel) {
  return Object.prototype.hasOwnProperty.call(KEYFORM_CHANNEL_NEUTRAL, channel)
    ? KEYFORM_CHANNEL_NEUTRAL[channel] : 0;
}

/* ── Axes ────────────────────────────────────────────────────────────────── */

/** Finite, ascending, duplicate-free. An empty result means "invalid axis". */
export function normalizeAxisValues(values) {
  const list = Array.isArray(values) ? values.map(Number).filter((n) => Number.isFinite(n)) : [];
  return [...new Set(list)].sort((a, b) => a - b);
}

export function normalizeAxis(source = {}) {
  return {
    parameter: typeof source?.parameter === 'string' ? source.parameter : '',
    values: normalizeAxisValues(source?.values)
  };
}

export function createAxis(parameter, values) {
  return normalizeAxis({ parameter, values });
}

export function isAxisValid(axis) {
  return Boolean(axis && typeof axis.parameter === 'string' && axis.parameter
    && Array.isArray(axis.values) && axis.values.length > 0);
}

/**
 * Where `value` sits on an ascending axis.
 *
 * Returns `{ lower, upper, t }` as indices into `values` plus a blend factor.
 * `clamp` keeps `t` inside `[0,1]`; `linear` lets it run past the ends so the
 * outermost segment is extended.  A non-finite input is read as the neutral 0.
 */
export function locateAxis(values, value, extrapolation = 'clamp') {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (values.length === 1) return { lower: 0, upper: 0, t: 0 };
  const raw = Number(value);
  const x = Number.isFinite(raw) ? raw : 0;
  const last = values.length - 1;
  if (x <= values[0]) {
    if (extrapolation !== 'linear') return { lower: 0, upper: 0, t: 0 };
    return { lower: 0, upper: 1, t: (x - values[0]) / (values[1] - values[0]) };
  }
  if (x >= values[last]) {
    if (extrapolation !== 'linear') return { lower: last, upper: last, t: 0 };
    return { lower: last - 1, upper: last, t: (x - values[last - 1]) / (values[last] - values[last - 1]) };
  }
  let lower = 0;
  let upper = last;
  while (upper - lower > 1) {
    const mid = (lower + upper) >> 1;
    if (values[mid] <= x) lower = mid; else upper = mid;
  }
  return { lower, upper, t: (x - values[lower]) / (values[upper] - values[lower]) };
}

/* ── Weights ─────────────────────────────────────────────────────────────── */

/**
 * Blend weights over the *captured* positions of one axis.
 *
 * `defined` is the ascending list of axis indices that actually hold data, so a
 * gap in the middle of an axis interpolates across it instead of collapsing to
 * the neutral value.  Weights always sum to 1 when at least one index exists.
 */
export function axisWeights(values, defined, value, extrapolation = 'clamp') {
  if (!Array.isArray(defined) || defined.length === 0) return [];
  if (defined.length === 1) return [{ index: defined[0], weight: 1 }];
  const span = locateAxis(defined.map((index) => values[index]), value, extrapolation);
  if (!span) return [];
  if (span.lower === span.upper) return [{ index: defined[span.lower], weight: 1 }];
  const t = span.t;
  const weights = [];
  if (1 - t !== 0) weights.push({ index: defined[span.lower], weight: 1 - t });
  if (t !== 0) weights.push({ index: defined[span.upper], weight: t });
  return weights;
}

/**
 * Blend weights over a sparse 1D or 2D keyform.
 *
 * `has(i, j)` reports whether a cell holds a sample.  For 2D the resolution is
 * separable — rows are resolved along X first, then blended along Y — which is
 * exactly bilinear interpolation on a full grid and degrades gracefully on a
 * partially captured one.  Returned cells are `{ i, j, weight }` with `j === 0`
 * for the 1D case, and the weights sum to 1 whenever anything is captured.
 */
export function keyformWeights(axes, parameterValues = {}, has = () => true, extrapolation = 'clamp') {
  return resolveKeyformWeights(buildKeyformLayout(axes, has), parameterValues, extrapolation);
}

/**
 * The part of a keyform that never changes between frames: the axes and, per
 * row of the grid, which cells actually hold a sample.  Building it once is
 * what keeps per-frame evaluation free of scanning (docs/RUNTIME_PERFORMANCE.md).
 */
export function buildKeyformLayout(axes, has = () => true) {
  const list = Array.isArray(axes) ? axes.filter(isAxisValid) : [];
  if (list.length === 0) return { parameters: [], xValues: [], yValues: null, rows: [] };
  const xValues = list[0].values;
  const yValues = list.length > 1 ? list[1].values : null;
  const rows = [];
  const height = yValues ? yValues.length : 1;
  for (let j = 0; j < height; j += 1) {
    const defined = [];
    for (let i = 0; i < xValues.length; i += 1) if (has(i, j)) defined.push(i);
    if (defined.length) rows.push({ j, defined });
  }
  return {
    parameters: list.map((axis) => axis.parameter),
    xValues, yValues, rows,
    rowIndices: rows.map((row) => row.j)
  };
}

/** Resolve a prebuilt layout at a parameter vector. */
export function resolveKeyformWeights(layout, parameterValues = {}, extrapolation = 'clamp') {
  if (!layout || layout.rows.length === 0) return [];
  const x = parameterValues?.[layout.parameters[0]];
  if (!layout.yValues) {
    return axisWeights(layout.xValues, layout.rows[0].defined, x, extrapolation)
      .map((entry) => ({ i: entry.index, j: 0, weight: entry.weight }));
  }
  const y = parameterValues?.[layout.parameters[1]];
  const rowWeights = axisWeights(layout.yValues, layout.rowIndices, y, extrapolation);
  const cells = new Map();
  rowWeights.forEach(({ index: j, weight }) => {
    const row = layout.rows.find((entry) => entry.j === j);
    if (!row) return;
    axisWeights(layout.xValues, row.defined, x, extrapolation).forEach((cell) => {
      const key = `${cell.index}|${j}`;
      const previous = cells.get(key);
      cells.set(key, { i: cell.index, j, weight: (previous ? previous.weight : 0) + cell.weight * weight });
    });
  });
  return [...cells.values()].filter((cell) => cell.weight !== 0);
}

/* ── Convenience evaluators (also the shape used by the unit tests) ──────── */

/**
 * Interpolate a value from samples aligned with `values`.  Holes (`null`,
 * `undefined`, non-finite) are skipped, so `[0, null, 1]` interpolates straight
 * across the middle sample.  Returns `fallback` when nothing is defined.
 */
export function interpolate1D(values, samples, value, { extrapolation = 'clamp', fallback = 0 } = {}) {
  const axis = normalizeAxisValues(values);
  const list = Array.isArray(samples) ? samples : [];
  // Only a real finite number is a sample: `null`/`undefined` are holes, and
  // `Number(null)` is 0, so the check must not go through `Number()`.
  const has = (i) => Number.isFinite(list[i]);
  const weights = axisWeights(axis, axis.map((_, i) => i).filter(has), value, extrapolation);
  if (weights.length === 0) return fallback;
  return weights.reduce((sum, entry) => sum + Number(list[entry.index]) * entry.weight, 0);
}

/**
 * Bilinear interpolation over a grid indexed `grid[j][i]` (row-major by Y).
 * Sparse rows and cells are handled exactly as `keyformWeights` describes.
 */
export function interpolate2D(xValues, yValues, grid, x, y, { extrapolation = 'clamp', fallback = 0 } = {}) {
  const axisX = normalizeAxisValues(xValues);
  const axisY = normalizeAxisValues(yValues);
  const sample = (i, j) => (Array.isArray(grid?.[j]) ? grid[j][i] : undefined);
  const has = (i, j) => Number.isFinite(sample(i, j));
  const axes = [{ parameter: 'x', values: axisX }, { parameter: 'y', values: axisY }];
  const weights = keyformWeights(axes, { x, y }, has, extrapolation);
  if (weights.length === 0) return fallback;
  return weights.reduce((sum, cell) => sum + sample(cell.i, cell.j) * cell.weight, 0);
}

/* ── Keyform records ─────────────────────────────────────────────────────── */

/**
 * A keyform record binds one channel of one target to one or two parameter
 * axes.  Samples address grid *cells by index* (`at: [i]` or `at: [i, j]`),
 * never by parameter value, so a float never has to be compared for equality
 * and an author can retune an axis without orphaning captures.
 *
 * ```js
 * { id: 'head-face-pose', target: { kind: 'element', id: 'face' },
 *   channel: 'translateX',
 *   axes: [{ parameter: 'headX', values: [-1, 0, 1] },
 *          { parameter: 'headY', values: [-1, 0, 1] }],
 *   keyforms: [{ at: [0, 1], value: -6 }, { at: [2, 1], value: 6 }],
 *   extrapolation: 'clamp' }
 * ```
 */
export function normalizeKeyform(source = {}) {
  const axes = (Array.isArray(source?.axes) ? source.axes : []).slice(0, 2).map(normalizeAxis);
  const width = axes[0]?.values.length ?? 0;
  const height = axes[1]?.values.length ?? (axes.length > 1 ? 0 : 1);
  const cells = new Map();
  (Array.isArray(source?.keyforms) ? source.keyforms : []).forEach((entry) => {
    const at = Array.isArray(entry?.at) ? entry.at : [];
    const i = Number(at[0]);
    const j = axes.length > 1 ? Number(at[1]) : 0;
    if (!Number.isInteger(i) || i < 0 || i >= width) return;
    if (!Number.isInteger(j) || j < 0 || j >= height) return;
    if (!Number.isFinite(Number(entry?.value))) return;
    cells.set(`${i}|${j}`, { at: axes.length > 1 ? [i, j] : [i], value: Number(entry.value) });
  });
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : '',
    target: {
      kind: source?.target?.kind === 'element' ? 'element' : 'element',
      id: typeof source?.target?.id === 'string' ? source.target.id : ''
    },
    channel: KEYFORM_CHANNELS.includes(source?.channel) ? source.channel : 'translateX',
    shapeKey: typeof source?.shapeKey === 'string' && source.shapeKey ? source.shapeKey : null,
    axes,
    keyforms: [...cells.values()].sort((a, b) => (a.at[1] ?? 0) - (b.at[1] ?? 0) || a.at[0] - b.at[0]),
    extrapolation: KEYFORM_EXTRAPOLATIONS.includes(source?.extrapolation) ? source.extrapolation : 'clamp'
  };
}

export function normalizeKeyforms(rig = {}) {
  if (!Array.isArray(rig?.keyforms)) return [];
  return rig.keyforms
    .filter((item) => item && typeof item === 'object')
    .map(normalizeKeyform)
    .filter((item) => item.id && item.target.id && item.axes.length > 0 && item.axes.every(isAxisValid));
}

/**
 * Freeze a record into the flat form the render loop uses: a dense sample
 * buffer, a prebuilt layout, and the parameter names resolved up front.
 */
export function compileKeyform(record) {
  const keyform = normalizeKeyform(record);
  const width = keyform.axes[0]?.values.length ?? 0;
  const height = keyform.axes[1]?.values.length ?? 1;
  const samples = new Float64Array(width * height).fill(Number.NaN);
  keyform.keyforms.forEach((entry) => {
    const [i, j = 0] = entry.at;
    samples[j * width + i] = entry.value;
  });
  const has = (i, j) => Number.isFinite(samples[j * width + i]);
  return {
    id: keyform.id,
    targetId: keyform.target.id,
    channel: keyform.channel,
    shapeKey: keyform.shapeKey,
    extrapolation: keyform.extrapolation,
    neutral: keyformChannelNeutral(keyform.channel),
    parameters: keyform.axes.map((axis) => axis.parameter),
    width, height, samples,
    layout: buildKeyformLayout(keyform.axes, has)
  };
}

export function compileKeyforms(records = []) {
  return (Array.isArray(records) ? records : []).map(compileKeyform).filter((item) => item.layout.rows.length > 0);
}

/** Evaluate one compiled keyform. Returns the channel neutral when uncaptured. */
export function evaluateCompiledKeyform(compiled, parameterValues = {}) {
  if (!compiled) return 0;
  const weights = resolveKeyformWeights(compiled.layout, parameterValues, compiled.extrapolation);
  if (weights.length === 0) return compiled.neutral;
  let total = 0;
  for (const cell of weights) total += compiled.samples[cell.j * compiled.width + cell.i] * cell.weight;
  return total;
}

/** Evaluate a record directly — convenience for the editor and for tests. */
export function evaluateKeyform(record, parameterValues = {}) {
  return evaluateCompiledKeyform(compileKeyform(record), parameterValues);
}
