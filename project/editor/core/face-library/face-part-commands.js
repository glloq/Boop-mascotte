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
import { derivePalette, tintArtwork, tokenWrites } from './palette-model.js';

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
    /** The face's colours as tokens, read now (docs/FACE_PART_LIBRARY.md, "Palette tokens"). */
    palette: () => derivePalette(store.getDocument(), canvas.describePaints?.() || []),
    /**
     * One token everywhere it is used, as one undo step.
     * @returns {{ ok: true, token, colour, uses: number } | { ok: false, reason: string }}
     */
    retint(token, colour) {
      const writes = tokenWrites(derivePalette(store.getDocument(), canvas.describePaints?.() || []), token, colour);
      if (!writes.length) return { ok: false, reason: `Nothing on this face is painted as ${token}.` };
      history?.beginTransaction?.();
      try { for (const write of writes) canvas.setAppearance(write.id, write.property, write.value); }
      finally { history?.commitTransaction?.(); }
      return { ok: true, token, colour: writes[0].value, uses: writes.length };
    },
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
      // Painted in this face's colours: every paint that plays a token the
      // face has a colour for takes that colour, before the drawing goes on.
      const roles = Object.fromEntries(Object.entries(asset.paletteRoles || {}).map(([id, entry]) => [remapped.renamed[id] ?? id, entry]));
      const tint = tintArtwork(remapped.markup, roles, derivePalette(before, canvas.describePaints?.() || []));
      // Measured before the swap: the anchor a part is fitted to is the old
      // part's own place, and that part is about to leave the canvas. A part
      // that came from the library carries the anchor through its root, so
      // replacing it again lands exactly where the last fit did.
      let layout = createFaceLayoutContext(before, measure, { mountPoint: plan.mountPoint });
      if (plan.previousFitted) layout = layoutThroughRoot(layout, before, { rootId: plan.previousRoot, mountPoint: asset.mountPoint, parentId: plan.mountPoint });
      const fit = fitFacePart(asset, layout);
      try {
        const behind = plan.behind ? { ids: plan.behind.ids.map((id) => remapped.renamed[id] ?? id), before: plan.behind.before } : null;
        const artwork = canvas.replaceArtwork(plan.removeIds, tint.markup, { mountPoint: plan.mountPoint, before: plan.before, behind });
        if (!artwork) return { ok: false, reason: 'There is no artwork on the canvas to replace.' };
        const candidate = structuredClone(before);
        const summary = applyFacePartReplacement(candidate, plan, { asset, artwork, renamed: remapped.renamed, ids: artworkIds(remapped.markup), measure, fit });
        history?.snapshot();
        store.execute({
          type: 'face-part/replace', source: 'character-builder', domains: [...FACE_PART_DOMAINS],
          apply: (document) => { for (const field of FACE_PART_FIELDS) document[field] = structuredClone(candidate[field]); }
        });
        onInstalled(summary);
        return { ok: true, ...summary, tinted: tint.tinted };
      } catch (error) {
        canvas.loadSvgFromText?.(before.svgMarkup, before.layerMetadata, { recordHistory: false, updateStore: false });
        return { ok: false, reason: error.message };
      }
    }
  };
}
