/**
 * Shape keys, as commands (docs/SHAPE_KEYS.md).
 *
 * A shape key is a named difference between a rest outline and a posed one,
 * and the maths for making one lives in `shape-key-model.js`. What was missing
 * is everywhere *else*: the editor could create them — a head-pose cell, a face
 * state, a morph movement all capture one — and then had no surface at all for
 * the set of them. So a key whose driver was wrong, or whose driver had been
 * deleted, was a deformation nobody could find, rename, re-drive or remove.
 *
 * These are the three operations that surface needs. Each is one undo step and
 * writes the `keyforms` domain, which is the domain a captured corrective
 * already writes (`core/state/render-plan.js`).
 */
import { removeShapeKey, setShapeKeyDriver, upsertShapeKey } from './shape-key-model.js';
import { normalizeShapeDriver } from '../../../runtime/runtime.js';

export function createShapeKeyCommands(store, history) {
  const run = (type, apply) => { history?.snapshot(); return store.execute({ type, source: 'shape-keys', domains: ['keyforms'], apply }); };
  const find = (document, id) => (document.shapeKeys || []).find((key) => key.id === id) || null;
  return {
    /**
     * Which movement moves this key, or nothing.
     *
     * The record is the runtime's: a `range` driver names a parameter and the
     * two values it reads between, and `none` is a key something else poses —
     * a head-pose cell drives its keys by cell rather than by parameter, and a
     * corrective by an expression. So "nothing" is a real answer here rather
     * than a refusal, and re-pointing a range keeps the range it was reading.
     */
    setDriver(id, parameter) {
      const key = find(store.getDocument(), id);
      if (!key) return { ok: false, message: `No shape key called “${id}”.` };
      const name = typeof parameter === 'string' && parameter.trim() ? parameter.trim() : '';
      const next = name
        ? { mode: 'range', parameter: name, min: key.driver?.min ?? 0, max: key.driver?.max ?? 1, clamp: key.driver?.clamp !== false }
        : { mode: 'none' };
      if (JSON.stringify(key.driver) === JSON.stringify(normalizeShapeDriver(next))) return { ok: true };
      run('shape-keys/driver', (document) => { document.shapeKeys = setShapeKeyDriver(document.shapeKeys || [], id, next); });
      return { ok: true };
    },
    /** The name the author reads. The id is what everything else points at, and does not move. */
    rename(id, name) {
      const current = store.getDocument(), key = find(current, id);
      if (!key) return { ok: false, message: `No shape key called “${id}”.` };
      const next = String(name || '').trim();
      if (!next || next === key.name) return { ok: true };
      run('shape-keys/rename', (document) => { document.shapeKeys = upsertShapeKey(document.shapeKeys || [], { ...find(document, id), name: next }); });
      return { ok: true };
    },
    /**
     * Forget one.
     *
     * The artwork is not touched: a shape key is a difference applied at draw
     * time, so removing it leaves the rest outline exactly as it was.
     */
    remove(id) {
      if (!find(store.getDocument(), id)) return { ok: false, message: `No shape key called “${id}”.` };
      run('shape-keys/remove', (document) => { document.shapeKeys = removeShapeKey(document.shapeKeys || [], id); });
      return { ok: true };
    }
  };
}
