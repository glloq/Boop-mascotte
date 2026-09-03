/**
 * Additive shape keys.
 *
 * ```text
 * REST
 *  ├─ SmileDelta   × smile
 *  ├─ OpenDelta    × mouthOpen
 *  ├─ AngryDelta   × angry
 *  └─ PoseDelta    × headPose
 *
 * finalShape = restShape + Σ(deltaShape × weight)
 * ```
 *
 * This is what replaces the one-morph-per-element limit: a mouth can smile,
 * open and be corrected by the head pose at the same time (docs/SHAPE_KEYS.md).
 * Paths are parsed once into numeric vectors; a frame only sums and, when the
 * numbers changed, rebuilds one string.
 */
import { parsePath, serializePath, PathParseError } from './path-vector.js';
import { finite } from './numeric.js';

/** How a shape key gets its weight. */
export const SHAPE_DRIVER_MODES = Object.freeze(['range', 'expression', 'none']);

export function normalizeShapeDriver(source) {
  if (!source || typeof source !== 'object') return { mode: 'none' };
  if (source.mode === 'expression') {
    return {
      mode: 'expression',
      expression: String(source.expression ?? '0'),
      curve: typeof source.curve === 'string' ? source.curve : 'linear',
      amplitude: finite(source.amplitude, 1),
      offset: finite(source.offset, 0)
    };
  }
  if (source.mode === 'range' || typeof source.parameter === 'string') {
    const min = finite(source.min, -1);
    const max = finite(source.max, 1);
    return { mode: 'range', parameter: String(source.parameter ?? ''), min, max, clamp: source.clamp !== false };
  }
  return { mode: 'none' };
}

export function normalizeShapeKey(source = {}) {
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : '',
    target: typeof source?.target === 'string' ? source.target : '',
    name: typeof source?.name === 'string' && source.name ? source.name : (source?.id || ''),
    driver: normalizeShapeDriver(source?.driver),
    delta: Array.from(source?.delta || [], (value) => finite(value, 0))
  };
}

export function normalizeShapeKeys(rig = {}) {
  if (!Array.isArray(rig?.shapeKeys)) return [];
  return rig.shapeKeys
    .filter((item) => item && typeof item === 'object')
    .map(normalizeShapeKey)
    .filter((item) => item.id && item.target && item.delta.length > 0);
}

/**
 * Build the delta between a rest path and an authored pose path.
 * Returns `null` when the two shapes do not share a command layout — the
 * caller reports that to the author, nothing is thrown into a render loop.
 */
export function shapeDeltaFromPaths(restPath, posePath) {
  let rest;
  let pose;
  try { rest = parsePath(restPath); pose = parsePath(posePath); } catch { return null; }
  if (rest.signature !== pose.signature) return null;
  return Array.from(pose.values, (value, index) => value - rest.values[index]);
}

/** Apply a delta to a rest path — the inverse of `shapeDeltaFromPaths`. */
export function applyShapeDelta(restPath, delta, weight = 1) {
  const rest = parsePath(restPath);
  if (rest.values.length !== delta.length) return restPath;
  const values = Float64Array.from(rest.values, (value, index) => value + delta[index] * weight);
  return serializePath(rest.commands, values);
}

/* ── Compilation ─────────────────────────────────────────────────────────── */

/**
 * Group shape keys by target and parse each rest path once.
 *
 * A key whose delta does not match its target's rest vector is **excluded and
 * reported** rather than dropped silently or allowed to corrupt a frame; the
 * project keeps the record so the author can supply a compatible shape.
 *
 * @returns {{ targets: Map<string, object>, incompatible: {id,target,reason}[] }}
 */
export function compileShapeKeys(records = [], elements = {}, { extraTargets = [] } = {}) {
  const targets = new Map();
  const incompatible = [];
  for (const key of normalizeShapeKeys({ shapeKeys: records })) {
    const restPath = elements?.[key.target]?.restPath;
    if (typeof restPath !== 'string' || !restPath.trim()) {
      incompatible.push({ id: key.id, target: key.target, reason: 'missing-rest' });
      continue;
    }
    let target = targets.get(key.target);
    if (!target) {
      let rest;
      try { rest = parsePath(restPath); } catch (error) {
        incompatible.push({ id: key.id, target: key.target, reason: 'unparsable-rest', message: error instanceof PathParseError ? error.message : String(error) });
        continue;
      }
      target = {
        targetId: key.target,
        commands: rest.commands,
        signature: rest.signature,
        rest: rest.values,
        restPath,
        keys: [],
        scratch: new Float64Array(rest.values.length),
        scratchWeights: null,
        lastWeights: null,
        lastPath: restPath
      };
      targets.set(key.target, target);
    }
    if (key.delta.length !== target.rest.length) {
      incompatible.push({ id: key.id, target: key.target, reason: 'topology-mismatch' });
      continue;
    }
    target.keys.push({ id: key.id, name: key.name, driver: key.driver, delta: Float64Array.from(key.delta) });
  }
  // Elements that carry no shape key but still need their path rebuilt -- a
  // warped outline, for instance -- get an empty target rather than a second
  // code path that also parses and serializes.
  for (const id of extraTargets) {
    if (targets.has(id)) continue;
    const restPath = elements?.[id]?.restPath;
    if (typeof restPath !== 'string' || !restPath.trim()) { incompatible.push({ id, target: id, reason: 'missing-rest' }); continue; }
    let rest;
    try { rest = parsePath(restPath); } catch { incompatible.push({ id, target: id, reason: 'unparsable-rest' }); continue; }
    targets.set(id, {
      targetId: id, commands: rest.commands, signature: rest.signature, rest: rest.values, restPath,
      keys: [], scratch: new Float64Array(rest.values.length), scratchWeights: null, lastWeights: null, lastPath: restPath
    });
  }
  for (const target of targets.values()) {
    target.lastWeights = new Float64Array(target.keys.length).fill(Number.NaN);
    target.scratchWeights = new Float64Array(target.keys.length);
    target.lastDisplacement = null;
  }
  return { targets, incompatible };
}

const compileCache = new WeakMap();

/** Compile once per rig, keyed on the records array the rig keeps. */
export function shapeKeyIndex(records, elements, extraTargets = []) {
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0 && extraTargets.length === 0) return null;
  const key = list.length ? list : extraTargets;
  const cached = compileCache.get(key);
  if (cached && cached.elements === elements) return cached.compiled;
  const compiled = compileShapeKeys(list, elements, { extraTargets });
  if (typeof key === 'object') compileCache.set(key, { elements, compiled });
  return compiled;
}

/**
 * Weight of one shape key: its own driver plus anything a `pathShape` keyform
 * contributed for it this frame.
 */
export function shapeKeyWeight(key, parameterValues = {}, extra = null, evaluateExpressionDriver = null) {
  let weight = 0;
  const driver = key.driver;
  if (driver.mode === 'range') {
    const raw = finite(parameterValues?.[driver.parameter], 0);
    const span = driver.max - driver.min;
    const t = span === 0 ? 0 : (raw - driver.min) / span;
    weight += driver.clamp ? Math.max(0, Math.min(1, t)) : t;
  } else if (driver.mode === 'expression' && typeof evaluateExpressionDriver === 'function') {
    weight += finite(evaluateExpressionDriver(driver, parameterValues), 0);
  }
  if (extra && Number.isFinite(Number(extra[key.id]))) weight += Number(extra[key.id]);
  return weight;
}

/**
 * Resolve one target's final path. Returns the previous string unchanged when
 * no weight moved, so an idle mascot performs no string work at all.
 */
export function evaluateShapeTarget(target, weights, displacement = null) {
  let changed = displacement !== target.lastDisplacement;
  if (!changed) for (let k = 0; k < weights.length; k += 1) {
    if (!Object.is(target.lastWeights[k], weights[k])) { changed = true; break; }
  }
  if (!changed) return target.lastPath;
  const values = target.scratch;
  values.set(target.rest);
  for (let k = 0; k < target.keys.length; k += 1) {
    const weight = weights[k];
    if (weight === 0) continue;
    const delta = target.keys[k].delta;
    for (let i = 0; i < values.length; i += 1) values[i] += delta[i] * weight;
  }
  // A warp is another offset on the same vector, so it simply adds.
  if (displacement) for (let i = 0; i < values.length && i < displacement.length; i += 1) values[i] += displacement[i];
  target.lastWeights.set(weights);
  target.lastDisplacement = displacement;
  target.lastPath = serializePath(target.commands, values);
  return target.lastPath;
}

