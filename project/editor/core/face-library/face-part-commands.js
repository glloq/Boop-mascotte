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
import { FACE_PART_DOMAINS, FACE_PART_FIELDS, applyFacePartRemoval, applyFacePartReplacement, planFacePartRemoval, planFacePartReplacement } from './face-part-install.js';
import { createFaceLayoutContext, fitFacePart, layoutFromBoxes, layoutThroughRoot } from './face-layout.js';
import { derivePalette, tintArtwork, tokenWrites } from './palette-model.js';
import { FACE_PRESET_LIBRARY, facePresetFromDocument, loadCustomPresets, planFacePreset, presetOfFace, saveCustomPresets } from './face-presets.js';

/**
 * @param {object} store
 * @param {object} history
 * @param {object} canvas `replaceArtwork`, `measureElement`, `loadSvgFromText`
 * @param {{ library?: object, presets?: object, presetStorage?: Storage|null, onInstalled?: (summary: object) => void }} [options]
 *   `presets` is the preset registry; `presetStorage` is where the author's own presets are kept (the browser's localStorage)
 */
export function createFacePartCommands(store, history, canvas, { library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY, presetStorage = null, onInstalled = () => {} } = {}) {
  const measure = (id) => canvas.measureElement?.(id) || null;
  if (presetStorage) loadCustomPresets(presetStorage, presets);
  const commands = {
    library,
    presets,
    /** The preset the face wears, read from its parts (docs/FACE_PART_LIBRARY.md, "Presets"), or null. */
    presetOf: () => presetOfFace(store.getDocument(), presets.list()),
    /**
     * A whole preset on the face that is there, as one undo step: the extras
     * it does not name come off, each part is replaced, the accessories go
     * on, the palette paints it. A step that refuses stops the rest and is
     * reported; what went on before it stays, undoable as one.
     * @returns {{ ok: boolean, preset: string, steps: number, refused: { step: object, reason: string }|null }}
     */
    applyPreset(presetId) {
      const item = presets.get(presetId);
      if (!item) return { ok: false, preset: presetId, steps: 0, refused: { step: null, reason: `There is no preset called "${presetId}".` } };
      if (!store.getDocument().svgMarkup) return { ok: false, preset: presetId, steps: 0, refused: { step: null, reason: 'Start from a face before choosing a preset.' } };
      const steps = planFacePreset(store.getDocument(), item);
      let done = 0, refused = null;
      const opened = history?.beginTransaction?.() === true;
      try {
        for (const step of steps) {
          const result = step.kind === 'remove' ? commands.remove(step.partId) : step.kind === 'replace' ? commands.replace(step.category, step.assetId, { fresh: true }) : commands.retint(step.token, step.colour);
          // A colour nothing on the face is painted as is not a refusal: the preset names every token, the face has some.
          if (!result.ok && !(step.kind === 'retint')) { refused = { step, reason: result.reason }; break; }
          if (result.ok) done += 1;
        }
      } finally { if (opened) history.commitTransaction(); }
      return { ok: !refused, preset: item.id, steps: done, refused };
    },
    /** The face as it is, saved as a preset of the author's own, kept in the browser. */
    saveAsPreset({ name, id = null, description = '' } = {}) {
      const slug = String(id || name || '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      const unique = presets.has(slug) ? `${slug}-${Date.now().toString(36)}` : slug;
      const item = facePresetFromDocument(store.getDocument(), commands.palette(), { id: unique, name: String(name || '').trim(), description });
      const result = presets.validate(item);
      if (!result.ok) return { ok: false, reason: result.issues.map((issue) => issue.message).join(' ') };
      presets.register(item);
      if (presetStorage) saveCustomPresets(presetStorage, presets);
      return { ok: true, preset: result.preset };
    },
    /** One of the author's own presets, forgotten. */
    removePreset(presetId) {
      const item = presets.get(presetId);
      if (!item || item.origin !== 'custom') return { ok: false, reason: item ? 'A built-in preset stays.' : `There is no preset called "${presetId}".` };
      presets.remove(presetId);
      if (presetStorage) saveCustomPresets(presetStorage, presets);
      return { ok: true };
    },
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
      const opened = history?.beginTransaction?.() === true;
      try { for (const write of writes) canvas.setAppearance(write.id, write.property, write.value); }
      finally { if (opened) history.commitTransaction(); }
      return { ok: true, token, colour: writes[0].value, uses: writes.length };
    },
    /**
     * Take a library part off the face -- an accessory, a beard -- as one undo step.
     * @returns {{ ok: true, partId, removed } | { ok: false, reason: string }}
     */
    remove(partId) {
      const before = store.getDocument();
      const plan = planFacePartRemoval(before, partId);
      if (!plan.ok) return plan;
      try {
        const artwork = canvas.replaceArtwork(plan.removeIds, '', {});
        if (!artwork) return { ok: false, reason: 'There is no artwork on the canvas.' };
        const candidate = structuredClone(before);
        const summary = applyFacePartRemoval(candidate, plan, { artwork });
        history?.snapshot();
        store.execute({
          type: 'face-part/remove', source: 'character-builder', domains: [...FACE_PART_DOMAINS],
          apply: (document) => { for (const field of FACE_PART_FIELDS) document[field] = structuredClone(candidate[field]); }
        });
        onInstalled(summary);
        return { ok: true, ...summary };
      } catch (error) {
        canvas.loadSvgFromText?.(before.svgMarkup, before.layerMetadata, { recordHistory: false, updateStore: false });
        return { ok: false, reason: error.message };
      }
    },
    /**
     * @param {{ fresh?: boolean }} [options] `fresh` puts the part where the library puts it in proportion to this head,
     *   whatever the author had moved, turned or resized on the old one; a preset applies this way
     * @returns {{ ok: true, partId, rootId, ids, roles, enabled, disabled, fitted } | { ok: false, reason: string }}
     */
    replace(categoryId, assetId, { fresh = false } = {}) {
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
      // The head is what the face's scale is measured from: replacing it, the
      // reference is the scale the old head was fitted at, not its own skull's width.
      const previousFit = plan.previousFitted ? before.semanticParts?.[plan.partId]?.assetFit || null : null;
      const carriedScale = plan.category.id === 'head' && Number(previousFit?.scaleX) > 0 ? previousFit.scaleX : null;
      let layout = createFaceLayoutContext(before, measure, { mountPoint: plan.mountPoint });
      if (fresh) {
        // Where the library puts the part in proportion to this head, whatever
        // the author had moved: a first install's place. The head itself stays
        // where it is -- it is the face -- at the size its fit gave it.
        layout = layoutFromBoxes({ head: layout.headBox });
        if (carriedScale) layout = { ...layout, scaleReference: carriedScale };
      } else if (plan.previousFitted) layout = layoutThroughRoot(layout, before, { rootId: plan.previousRoot, mountPoint: asset.mountPoint, parentId: plan.mountPoint, scaleReference: carriedScale });
      const fit = fitFacePart(asset, layout);
      try {
        const behind = plan.behind ? { ids: plan.behind.ids.map((id) => remapped.renamed[id] ?? id), before: plan.behind.before } : null;
        const artwork = canvas.replaceArtwork(plan.removeIds, tint.markup, { mountPoint: plan.mountPoint, before: plan.before, behind });
        if (!artwork) return { ok: false, reason: 'There is no artwork on the canvas to replace.' };
        const candidate = structuredClone(before);
        const summary = applyFacePartReplacement(candidate, fresh ? { ...plan, previousTransform: null } : plan, { asset, artwork, renamed: remapped.renamed, ids: artworkIds(remapped.markup), measure, fit });
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
  return commands;
}
