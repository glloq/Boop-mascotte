/**
 * An old project through the library (docs/FACE_PART_LIBRARY.md, "Migration";
 * roadmap phases 42 and 43).
 *
 * A project saved before the library has semantic parts and no word about
 * where their drawings came from. Opening it, the parts that are a library
 * asset drawn *exactly* -- the same shapes, whatever the ids were renamed
 * to and wherever the whole part was moved -- are identified, so the builder
 * marks their card current and the next replacement fits through their
 * root; the rest are the author's own, which the builder already reads as
 * a part with no card current. Nothing about the artwork changes, nothing
 * is deleted, and nothing here can keep a project from opening: a document
 * this cannot read is returned as it was.
 */
import { FACE_PART_CATEGORIES, scanArtwork } from './face-part-model.js';
import { recordTurnProfiles } from './face-part-install.js';
import { elementSpan, matchesInstalledId, shapeSignature } from './face-part-artwork.js';
import { FACE_PART_LIBRARY } from './face-part-registry.js';

/** Layer id → the layer it sits in. */
function parentsOf(layers = [], parent = null, out = {}) {
  for (const layer of Array.isArray(layers) ? layers : []) {
    if (!layer?.id) continue;
    out[layer.id] = parent;
    parentsOf(layer.children, layer.id, out);
  }
  return out;
}

/** The artwork with some elements cut out of it: the asset's root as it stands in a document, its back pieces lifted out. */
function without(markup, ids) {
  let text = String(markup ?? '');
  for (const id of ids) { const span = elementSpan(text, id); if (span) text = text.slice(0, span.start) + text.slice(span.end); }
  return text;
}

/** The ids an installed asset's element may have in a document: its own, or its own past a suffix. */
const namedAfter = (document, id) => Object.keys(document.elements || {}).filter((candidate) => matchesInstalledId(candidate, id));

/**
 * The word an asset's drawing signs as, as it stands once installed: the
 * root without the pieces painted behind the face, which sit outside it.
 */
function assetSignature(asset) {
  const root = scanArtwork(asset.artwork).elements.find((item) => item.depth === 0)?.id;
  if (!root) return null;
  return { root, word: shapeSignature(without(asset.artwork, asset.behind || []), [root]) };
}

/**
 * Identify, on a document, the parts that are a library asset drawn exactly.
 *
 * Only parts with no asset yet are looked at, so a project the library
 * already knows about is left as it is. A part is matched by its shapes:
 * the root the asset would have left (named after the asset's root, or the
 * element a role names, or a group above it) must sign as the asset's
 * artwork does. Ids and the whole part's transform are not in the word.
 *
 * @param {object} document a ProjectDocument or project state; its semantic parts are written to
 * @param {object} [library]
 * @returns {{ identified: { partId: string, assetId: string, rootId: string }[] }}
 */
export function identifyFaceParts(document, library = FACE_PART_LIBRARY) {
  const identified = [];
  try {
    if (!document?.svgMarkup || !document.semanticParts || typeof document.semanticParts !== 'object') return { identified };
    const parents = parentsOf(document.layers);
    const words = new Map();
    for (const category of FACE_PART_CATEGORIES) {
      if (!category.installable) continue;
      const assets = library.list(category.id);
      if (!assets.length) continue;
      for (const part of Object.values(document.semanticParts)) {
        if (!part || part.type !== category.part || part.assetId) continue;
        const roleIds = Object.values(part.roles || {}).filter((id) => document.elements?.[id]);
        const above = roleIds.flatMap((id) => { const chain = [id]; for (let up = parents[id]; up; up = parents[up]) chain.push(up); return chain; });
        for (const asset of assets) {
          if (!words.has(asset.id)) words.set(asset.id, assetSignature(asset));
          const signature = words.get(asset.id);
          if (!signature) continue;
          const candidates = [...new Set([...namedAfter(document, signature.root), ...above])];
          const root = candidates.find((id) => document.elements?.[id] && shapeSignature(document.svgMarkup, [id]) === signature.word);
          if (!root) continue;
          const detached = (asset.behind || []).flatMap((id) => namedAfter(document, id)).filter((id) => id !== root && elementSpan(document.svgMarkup, id));
          part.assetId = asset.id;
          part.assetRoot = root;
          part.assetMount = asset.mountPoint;
      // The part *is* this asset, drawn exactly -- that is what the shape
      // signature above just established -- so how the asset turns is the
      // truth about it too, and a project drawn before V3-02 gets it back
      // here. The grid itself is not regenerated: an author's captured
      // cells are theirs, and rebuilding the turn to pick this up is a
      // press they make, not one made behind them.
      recordTurnProfiles(part, asset.turn);
          part.assetShape = shapeSignature(document.svgMarkup, [root, ...detached]);
          if (detached.length) part.assetDetached = detached; else delete part.assetDetached;
          delete part.assetFit;
          identified.push({ partId: part.id, assetId: asset.id, rootId: root });
          break;
        }
      }
    }
  } catch { /* an old project opens whatever this could not read */ }
  return { identified };
}
