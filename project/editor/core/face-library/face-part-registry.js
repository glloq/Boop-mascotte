/**
 * The face part library (docs/FACE_PART_LIBRARY.md, roadmap phase 2).
 *
 * A registry is a map of validated, frozen assets by id, with the categories
 * over them. It is deliberately dumb: registering validates and stores,
 * listing lists, and nothing here touches a document -- installing an asset
 * onto a mascot is a command over the document (roadmap PR 3), and this is
 * what that command reads.
 *
 * One asset may say it *restyles* another (`variant`, docs/FACE_PART_LIBRARY.md,
 * "The style axis"). Such a drawing is held like any other -- `get` finds it,
 * the animation matrix drives it, an install puts it on -- and is reached
 * through the drawing it restyles: `variant(asset, style)` is what a preset
 * asking for a style gets, `cards(category)` is what a category offers on its
 * own, and `list(category)` is still everything the library holds.
 *
 * `createFacePartRegistry` is for tests and for a pack that wants a registry
 * of its own; `FACE_PART_LIBRARY` is the one the editor holds, with the
 * built-in assets in it, and `registerFacePart` is how a module outside the
 * editor adds to it (roadmap phase 44).
 */
import { FACE_PART_CATEGORIES, normalizeFacePart } from './face-part-model.js';
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
  /** The drawing that restyles another into one style, by the two together (docs/FACE_PART_LIBRARY.md, "The style axis"): resolving a style is a lookup, never a scan. */
  const variantOf = (asset, style) => [...assets.values()].find((item) => item.variant?.of === asset && item.variant?.style === style) || null;
  const view = { get: (id) => assets.get(id) || null, variant: variantOf };
  const validate = (input) => validateFacePart(input, { taken: (id) => assets.has(id), library: view });

  function register(input) {
    const result = validate(input);
    if (!result.ok) throw new FacePartError(`Face part "${result.asset.id || '?'}" was refused: ${result.errors.map((item) => item.message).join(' ')}`, result.issues);
    assets.set(result.asset.id, result.asset);
    return result.asset;
  }

  return {
    register,
    /**
     * All or nothing: a pack with one bad asset registers none of them.
     *
     * Each is checked against the library *and the rest of the batch*, so a
     * pack may ship a drawing and the styles of it in whichever order it
     * likes -- a variant listed before the drawing it restyles is not a
     * variant of nothing.
     */
    registerMany(list = []) {
      const staged = list.map((item) => normalizeFacePart(item));
      const batch = {
        get: (id) => assets.get(id) || staged.find((asset) => asset.id === id) || null,
        variant: (asset, style) => variantOf(asset, style) || staged.find((item) => item.variant?.of === asset && item.variant?.style === style) || null
      };
      const results = list.map((item) => validateFacePart(item, { taken: (id) => assets.has(id), library: batch }));
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
    /** In registration order, the whole library or one category: every asset, the styles of a drawing among them. */
    list: (category = null) => [...assets.values()].filter((asset) => !category || asset.category === category),
    /**
     * What a category offers on its own: a drawing that restyles another is
     * reached through it, so it is not a card of its own (the roadmap's
     * V3-05 -- six presets of restyled parts are not six libraries).
     */
    cards: (category = null) => [...assets.values()].filter((asset) => !asset.variant && (!category || asset.category === category)),
    /** The drawing that restyles this one into that style, or null: what a preset asking for a style gets. */
    variant: (asset, style) => (asset && style ? variantOf(asset, style) : null),
    /** Every style of one drawing, in registration order. */
    variantsOf: (asset) => [...assets.values()].filter((item) => item.variant?.of === asset),
    /** Every category, with how many assets it holds. */
    categories: () => FACE_PART_CATEGORIES.map((category) => ({ ...category, count: [...assets.values()].filter((asset) => asset.category === category.id).length })),
    remove: (id) => assets.delete(id),
    get size() { return assets.size; }
  };
}

/* ── Canonical identity (MASC-08A) ────────────────────────────────────────── */

/**
 * The drawing a drawing **is a style of** -- itself, when it is not a restyle.
 *
 * ```text
 * head.round        → head.round
 * head.round-flat   → head.round        variant: { of: 'head.round', style: 'flat' }
 * ```
 *
 * This is what makes a style changeable more than once. Without it, restyling
 * an already-restyled face asks the library for "the retro variant of
 * `head.round-flat`" -- which nobody has drawn and nobody ever will, because
 * the validator refuses a style of a style. Every restyle therefore starts by
 * coming home: current drawing → canonical base → the style being asked for.
 *
 * The chain is one link long by construction (`variant-chained` is an error),
 * so this is a single lookup and never a walk. A variant naming a base the
 * library has since forgotten answers with the id it names, which is the only
 * honest answer available and keeps the function total.
 */
export const baseAssetId = (assetId, library = FACE_PART_LIBRARY) => library?.get?.(assetId)?.variant?.of || assetId;

/** The same, as the asset; null when neither the drawing nor the one it restyles is in the library. */
export const baseAsset = (assetId, library = FACE_PART_LIBRARY) => library?.get?.(baseAssetId(assetId, library)) || null;

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
  const list = Array.isArray(saved) ? saved : [];
  const loaded = [];
  // A drawing before the styles of it: they go in one at a time here, and a
  // style of a part not yet registered is a style of nothing. A style of a
  // style is refused, so one pass is enough.
  for (const item of [...list].sort((a, b) => Number(Boolean(a?.variant)) - Number(Boolean(b?.variant)))) {
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
