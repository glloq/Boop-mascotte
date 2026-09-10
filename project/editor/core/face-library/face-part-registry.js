/**
 * The face part library (docs/FACE_PART_LIBRARY.md, roadmap phase 2).
 *
 * A registry is a map of validated, frozen assets by id, with the categories
 * over them. It is deliberately dumb: registering validates and stores,
 * listing lists, and nothing here touches a document -- installing an asset
 * onto a mascot is a command over the document (roadmap PR 3), and this is
 * what that command reads.
 *
 * `createFacePartRegistry` is for tests and for a pack that wants a registry
 * of its own; `FACE_PART_LIBRARY` is the one the editor holds, with the
 * built-in assets in it, and `registerFacePart` is how a module outside the
 * editor adds to it (roadmap phase 44).
 */
import { FACE_PART_CATEGORIES } from './face-part-model.js';
import { validateFacePart } from './face-part-validation.js';
import { BUILTIN_FACE_PARTS } from './builtin/index.js';

export class FacePartError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'FacePartError';
    this.issues = issues;
  }
}

export function createFacePartRegistry() {
  const assets = new Map();
  const validate = (input) => validateFacePart(input, { taken: (id) => assets.has(id) });

  function register(input) {
    const result = validate(input);
    if (!result.ok) throw new FacePartError(`Face part "${result.asset.id || '?'}" was refused: ${result.errors.map((item) => item.message).join(' ')}`, result.issues);
    assets.set(result.asset.id, result.asset);
    return result.asset;
  }

  return {
    register,
    /** All or nothing: a pack with one bad asset registers none of them. */
    registerMany(list = []) {
      const results = list.map((item) => validate(item));
      const refused = results.find((item) => !item.ok);
      if (refused) throw new FacePartError(`Face part "${refused.asset.id || '?'}" was refused: ${refused.errors.map((item) => item.message).join(' ')}`, refused.issues);
      const ids = results.map((item) => item.asset.id);
      const twice = ids.find((id, index) => ids.indexOf(id) !== index);
      if (twice) throw new FacePartError(`Face part "${twice}" appears twice in the same pack.`, [{ severity: 'error', code: 'id-taken', message: `"${twice}" appears twice.`, field: 'id' }]);
      for (const item of results) assets.set(item.asset.id, item.asset);
      return results.map((item) => item.asset);
    },
    validate,
    has: (id) => assets.has(id),
    get: (id) => assets.get(id) || null,
    /** In registration order, the whole library or one category. */
    list: (category = null) => [...assets.values()].filter((asset) => !category || asset.category === category),
    /** Every category, with how many assets it holds. */
    categories: () => FACE_PART_CATEGORIES.map((category) => ({ ...category, count: [...assets.values()].filter((asset) => asset.category === category.id).length })),
    remove: (id) => assets.delete(id),
    get size() { return assets.size; }
  };
}

/** The editor's library, with the built-in assets in it. */
export const FACE_PART_LIBRARY = createFacePartRegistry();
FACE_PART_LIBRARY.registerMany(BUILTIN_FACE_PARTS);

/** Add an asset to the editor's library, from a pack or a plugin. Throws a `FacePartError` with its issues when refused. */
export const registerFacePart = (asset) => FACE_PART_LIBRARY.register(asset);
/** The same, for an accessory: glasses, a hat, an earring. */
export const registerAccessory = (asset) => FACE_PART_LIBRARY.register({ ...asset, category: 'accessory' });

/* ── The author's own parts (docs/FACE_PART_LIBRARY.md, "Custom parts") ──── */

export const CUSTOM_PARTS_KEY = 'boop.faceParts';

/** The parts an author saved, read from storage into the registry; ones the validator refuses now are skipped. */
export function loadCustomParts(storage, registry = FACE_PART_LIBRARY) {
  let saved = [];
  try { saved = JSON.parse(storage?.getItem?.(CUSTOM_PARTS_KEY) || '[]'); } catch { saved = []; }
  const loaded = [];
  for (const item of Array.isArray(saved) ? saved : []) {
    if (!item || registry.has(item.id)) continue;
    try { loaded.push(registry.register({ ...item, origin: 'custom' })); } catch { /* a part the validator refuses now */ }
  }
  return loaded;
}

/** The author's parts, written to storage: the custom ones only, built-ins never. */
export function saveCustomParts(storage, registry = FACE_PART_LIBRARY) {
  const custom = registry.list().filter((asset) => asset.origin === 'custom');
  try { storage?.setItem?.(CUSTOM_PARTS_KEY, JSON.stringify(custom)); return true; } catch { return false; }
}
