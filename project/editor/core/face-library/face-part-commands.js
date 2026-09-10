/**
 * Replace a part of the face with a library asset, as one undo step
 * (docs/FACE_PART_LIBRARY.md, "Installing").
 *
 * The same bargain as drawing a pair of hands: the artwork goes onto the
 * canvas first, with the store untouched, and the rig that follows is one
 * command over it, so one undo takes both back. If anything in between
 * refuses, the canvas is put back to the markup the document still holds and
 * nothing reaches the history.
 */
import { FACE_PART_LIBRARY } from './face-part-registry.js';
import { documentIds, remapArtworkIds } from './face-part-artwork.js';
import { artworkIds } from './face-part-model.js';
import { FACE_PART_DOMAINS, FACE_PART_FIELDS, applyFacePartReplacement, planFacePartReplacement } from './face-part-install.js';
import { createFaceLayoutContext, fitFacePart, layoutThroughRoot } from './face-layout.js';

/**
 * @param {object} store
 * @param {object} history
 * @param {object} canvas `replaceArtwork`, `measureElement`, `loadSvgFromText`
 * @param {{ library?: object, onInstalled?: (summary: object) => void }} [options]
 */
export function createFacePartCommands(store, history, canvas, { library = FACE_PART_LIBRARY, onInstalled = () => {} } = {}) {
  const measure = (id) => canvas.measureElement?.(id) || null;
  return {
    library,
    /** What replacing would do, for a card to say whether it can be pressed. */
    plan: (categoryId, assetId) => planFacePartReplacement(store.getDocument(), categoryId, library.get(assetId)),
    /** Where things are on this face, measured now (docs/FACE_PART_LIBRARY.md, "Layout and auto-fit"). */
    layout: () => createFaceLayoutContext(store.getDocument(), measure),
    /**
     * @returns {{ ok: true, partId, rootId, ids, roles, enabled, disabled, fitted } | { ok: false, reason: string }}
     */
    replace(categoryId, assetId) {
      const before = store.getDocument();
      const asset = library.get(assetId);
      if (!asset) return { ok: false, reason: `There is no asset called "${assetId}".` };
      const plan = planFacePartReplacement(before, categoryId, asset);
      if (!plan.ok) return plan;
      // Free the ids the old part held; rename past everything else.
      const kept = documentIds(before.svgMarkup);
      for (const id of plan.removeIds) kept.delete(id);
      const remapped = remapArtworkIds(asset.artwork, { taken: (id) => kept.has(id) });
      // Measured before the swap: the anchor a part is fitted to is the old
      // part's own place, and that part is about to leave the canvas. A part
      // that came from the library carries the anchor through its root, so
      // replacing it again lands exactly where the last fit did.
      let layout = createFaceLayoutContext(before, measure, { mountPoint: plan.mountPoint });
      if (plan.previousFitted) layout = layoutThroughRoot(layout, before, { rootId: plan.previousRoot, mountPoint: asset.mountPoint, parentId: plan.mountPoint });
      const fit = fitFacePart(asset, layout);
      try {
        const artwork = canvas.replaceArtwork(plan.removeIds, remapped.markup, { mountPoint: plan.mountPoint, before: plan.before });
        if (!artwork) return { ok: false, reason: 'There is no artwork on the canvas to replace.' };
        const candidate = structuredClone(before);
        const summary = applyFacePartReplacement(candidate, plan, { asset, artwork, renamed: remapped.renamed, ids: artworkIds(remapped.markup), measure, fit });
        history?.snapshot();
        store.execute({
          type: 'face-part/replace', source: 'character-builder', domains: [...FACE_PART_DOMAINS],
          apply: (document) => { for (const field of FACE_PART_FIELDS) document[field] = structuredClone(candidate[field]); }
        });
        onInstalled(summary);
        return { ok: true, ...summary };
      } catch (error) {
        canvas.loadSvgFromText?.(before.svgMarkup, before.layerMetadata, { recordHistory: false, updateStore: false });
        return { ok: false, reason: error.message };
      }
    }
  };
}
