/**
 * Authoring helpers for additive shape keys (docs/SHAPE_KEYS.md).
 *
 * Pure and immutable: every function returns new records so undo keeps working
 * by snapshot. The maths itself lives in the runtime and is not duplicated here.
 */
import {
  normalizeShapeKey, normalizeShapeKeys, shapeDeltaFromPaths, applyShapeDelta,
  compileShapeKeys, parsePath, pathsCompatible, pathSignature, canParsePath
} from '../../../runtime/runtime.js';

export {
  normalizeShapeKey, normalizeShapeKeys, shapeDeltaFromPaths, applyShapeDelta,
  compileShapeKeys, pathsCompatible, pathSignature, canParsePath
};

/**
 * Create a shape key by comparing an authored pose against the element's rest
 * shape. Returns `{ ok: false, reason }` instead of throwing, because the
 * caller is a UI that has to explain the problem.
 */
export function createShapeKey({ id, target, name, restPath, posePath, driver = null, generatedBy = null }) {
  if (!id) return { ok: false, reason: 'missing-id', message: 'Give the shape key a name first.' };
  if (!target) return { ok: false, reason: 'missing-target', message: 'Choose the shape this key deforms.' };
  if (!canParsePath(restPath)) return { ok: false, reason: 'unparsable-rest', message: 'The rest shape is not a path this editor can deform.' };
  if (!canParsePath(posePath)) return { ok: false, reason: 'unparsable-pose', message: 'The posed shape is not a path this editor can deform.' };
  const delta = shapeDeltaFromPaths(restPath, posePath);
  if (!delta) {
    return {
      ok: false, reason: 'topology-mismatch',
      message: 'The posed shape has a different outline structure than the rest shape. Move the existing points instead of adding or removing any, then capture again.'
    };
  }
  return { ok: true, shapeKey: normalizeShapeKey({ id, target, name: name || id, driver, delta, ...(generatedBy ? { generatedBy } : {}) }) };
}

/** Shape keys attached to one element, in authoring order. */
export function shapeKeysForTarget(shapeKeys = [], target) {
  return (shapeKeys || []).filter((key) => key.target === target);
}

export function upsertShapeKey(shapeKeys = [], shapeKey) {
  const next = normalizeShapeKey(shapeKey);
  const index = (shapeKeys || []).findIndex((key) => key.id === next.id);
  if (index < 0) return [...(shapeKeys || []), next];
  const copy = [...shapeKeys];
  copy[index] = next;
  return copy;
}

export function removeShapeKey(shapeKeys = [], id) {
  return (shapeKeys || []).filter((key) => key.id !== id);
}

export function setShapeKeyDriver(shapeKeys = [], id, driver) {
  return (shapeKeys || []).map((key) => key.id === id ? normalizeShapeKey({ ...key, driver }) : key);
}

/** Preview one key on its own, at a given weight — what the capture UI shows. */
export function previewShapeKey(restPath, shapeKey, weight = 1) {
  if (!shapeKey?.delta?.length) return restPath;
  return applyShapeDelta(restPath, shapeKey.delta, weight);
}

/** Preview several keys together, which is the point of the additive model. */
export function previewShapeKeys(restPath, shapeKeys = [], weights = {}) {
  const rest = parsePath(restPath);
  const values = Float64Array.from(rest.values);
  for (const key of shapeKeys) {
    const weight = Number(weights?.[key.id] ?? 0);
    if (!Number.isFinite(weight) || weight === 0 || key.delta.length !== values.length) continue;
    for (let i = 0; i < values.length; i += 1) values[i] += key.delta[i] * weight;
  }
  return applyShapeDelta(restPath, Array.from(values, (value, index) => value - rest.values[index]), 1);
}

/**
 * Legacy A/B morph → rest + delta (docs/SHAPE_KEYS.md, "Legacy morphs").
 *
 * This is an explicit, opt-in upgrade, not something `normalizeRig` does behind
 * an author's back: an old project keeps rendering through the original morph
 * path until someone chooses to convert it.
 */
export function shapeKeyFromLegacyMorph(elementId, morph) {
  if (!morph?.pathA || !morph?.pathB) return { ok: false, reason: 'incomplete-morph', message: 'This morph has no start or end shape to convert.' };
  const created = createShapeKey({
    id: `${elementId}-morph`,
    target: elementId,
    name: 'Morph',
    restPath: morph.pathA,
    posePath: morph.pathB,
    driver: { mode: 'range', parameter: morph.param || 'mouthOpen', min: Number(morph.min ?? -1), max: Number(morph.max ?? 1) }
  });
  if (!created.ok) return created;
  return { ok: true, restPath: morph.pathA, shapeKey: created.shapeKey };
}

/**
 * Convert every legacy morph in a rig. Returns the new records plus the
 * elements that could not be converted, so the caller can report them.
 */
export function migrateLegacyMorphs(state = {}) {
  const shapeKeys = [];
  const restPaths = {};
  const skipped = [];
  for (const [id, element] of Object.entries(state.elements || {})) {
    if (!element?.morph?.enabled) continue;
    const converted = shapeKeyFromLegacyMorph(id, element.morph);
    if (!converted.ok) { skipped.push({ id, reason: converted.reason, message: converted.message }); continue; }
    shapeKeys.push(converted.shapeKey);
    restPaths[id] = converted.restPath;
  }
  return { shapeKeys, restPaths, skipped };
}
