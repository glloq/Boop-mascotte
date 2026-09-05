/**
 * Carrying a rig through a change in a path's shape (docs/VECTOR_EDITING.md).
 *
 * A shape key is a per-point delta against `element.restPath`
 * (docs/SHAPE_KEYS.md); a legacy morph is two paths that must have the same
 * commands; a calibration pose is a captured path. All of them are pinned to
 * one point count. Add a node and every one of them stops matching — the
 * runtime drops the shape keys as a topology mismatch and the mouth loses its
 * poses.
 *
 * `core/path/path-edit.js` reports the **linear map** behind each edit, and
 * linearity is what makes this sound: applying the same map to the rest
 * outline and to each delta preserves their sum, so
 *
 *     remap(rest) + remap(delta) === remap(rest + delta)
 *
 * to the last decimal. This module applies that map to everything on one
 * element and hands back the records to write — or refuses, because a
 * half-migrated rig is worse than an edit that did not happen.
 */
import { canParsePath, parsePath, pathSignature, serializePath } from '../../../runtime/path-vector.js';
import { remapValues } from './path-edit.js';

const clone = (value) => structuredClone(value);

/** Run a path through the edit's own map. Null when it cannot be read. */
function remapPath(edit, d) {
  if (typeof d !== 'string' || !canParsePath(d)) return null;
  const parsed = parsePath(d);
  if (parsed.values.length !== edit.from) return null;
  return serializePath(edit.commands, remapValues(edit, parsed.values));
}

const refuse = (reason, message) => ({ ok: false, reason, message });

/**
 * Everything on one element that a topology edit has to carry with it.
 *
 * @param {object} document the project document
 * @param {string} elementId
 * @param {import('./path-edit.js').PathEdit} edit
 * @param {string} [posedPath] the `d` the canvas currently draws, when the
 *        element is deformed — the edit was made on *that*, and the rest
 *        outline moves by the same map.
 * @returns {{ok: true, elements, shapeKeys, semanticParts, migrated} | {ok: false, reason, message}}
 */
export function migrateElementTopology(document, elementId, edit, posedPath = null) {
  if (!edit || edit.ok === false) return refuse('no-edit', 'There is nothing to apply.');
  const element = document?.elements?.[elementId];
  if (!element) return refuse('missing-element', 'That piece of artwork is gone.');

  const migrated = { shapeKeys: 0, morphs: 0, calibrations: 0 };
  const elements = {};
  const restPath = typeof element.restPath === 'string' ? element.restPath : null;

  if (restPath) {
    // The author dragged the *posed* shape, and a posed shape is the rest
    // outline plus its deltas: the same map carries the rest outline under it.
    if (posedPath && pathSignature(posedPath) !== pathSignature(restPath)) {
      return refuse('rest-mismatch', 'This shape and the outline its poses are measured from no longer match. Reset the shape keys on it first.');
    }
    const next = remapPath(edit, restPath);
    if (!next) return refuse('unparsable-rest', 'The outline this shape is measured from cannot be read.');
    elements[elementId] = { restPath: next };
  }

  // A legacy morph is two whole paths, and every imported path carries a
  // disabled one holding a copy of itself. Those are simply re-copied.
  const morph = element.morph;
  if (morph && (typeof morph.pathA === 'string' || typeof morph.pathB === 'string')) {
    const same = morph.pathA === morph.pathB;
    const pathA = remapPath(edit, morph.pathA);
    const pathB = same ? pathA : remapPath(edit, morph.pathB);
    if (morph.enabled && (!pathA || !pathB)) return refuse('unparsable-morph', 'One of this shape\'s morph poses cannot be read.');
    if (pathA || pathB) {
      elements[elementId] = { ...(elements[elementId] || {}), morph: { ...clone(morph), ...(pathA ? { pathA } : {}), ...(pathB ? { pathB } : {}) } };
      // The disabled copy every imported path carries is not "its morph".
      if (morph.enabled) migrated.morphs += 1;
    }
  }

  const shapeKeys = [];
  for (const key of document.shapeKeys || []) {
    if (key.target !== elementId) { shapeKeys.push(key); continue; }
    // A stored delta is a plain array; one straight out of `parsePath` is a
    // typed one. Both are a list of numbers as far as the map is concerned.
    const delta = key.delta && typeof key.delta.length === 'number' ? key.delta : null;
    if (!delta || delta.length !== edit.from) return refuse('delta-mismatch', `The shape "${key.name || key.id}" no longer matches this outline.`);
    shapeKeys.push({ ...clone(key), delta: remapValues(edit, delta) });
    migrated.shapeKeys += 1;
  }

  // A calibration pose is a path an author captured. It is authoring history
  // rather than something the runtime reads, so a pose that cannot be carried
  // is dropped rather than blocking the edit.
  const semanticParts = clone(document.semanticParts || {});
  for (const part of Object.values(semanticParts)) {
    const roles = Object.entries(part.roles || {}).filter(([, id]) => id === elementId).map(([role]) => role);
    if (!roles.length) continue;
    for (const poses of Object.values(part.calibration || {})) {
      for (const pose of Object.values(poses || {})) {
        for (const role of roles) {
          if (typeof pose?.[role] !== 'string') continue;
          const next = remapPath(edit, pose[role]);
          if (next) { pose[role] = next; migrated.calibrations += 1; } else delete pose[role];
        }
      }
    }
  }

  return { ok: true, elements, shapeKeys, semanticParts, migrated };
}

/** "two poses and a shape" — what to say after an edit that carried a rig with it. */
export function describeMigration(migrated = {}) {
  const parts = [];
  if (migrated.shapeKeys) parts.push(`${migrated.shapeKeys} shape${migrated.shapeKeys === 1 ? '' : 's'}`);
  if (migrated.morphs) parts.push('its morph');
  if (migrated.calibrations) parts.push(`${migrated.calibrations} captured pose${migrated.calibrations === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' and ') : '';
}
