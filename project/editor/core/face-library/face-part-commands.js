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
import { FACE_PART_LIBRARY, loadCustomParts, saveCustomParts } from './face-part-registry.js';
import { installFacePack } from './face-pack.js';
import { documentIds, elementSpan, remapArtworkIds } from './face-part-artwork.js';
import { artworkIds, facePartCategory } from './face-part-model.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { FACE_PART_DOMAINS, FACE_PART_FIELDS, applyFacePartRemoval, applyFacePartReplacement, planFacePartRemoval, planFacePartReplacement } from './face-part-install.js';
import { createFaceLayoutContext, fitFacePart, layoutFromBoxes, layoutThroughRoot } from './face-layout.js';
import { derivePalette, paletteRoleTokens, paletteRolesFromPaints, tintArtwork, tokenWrites } from './palette-model.js';
import { FACE_PRESET_LIBRARY, facePresetFromDocument, loadCustomPresets, planFacePreset, presetOfFace, saveCustomPresets } from './face-presets.js';
import { createArtworkCommands } from '../commands/artwork-commands.js';
import { createHandCommands } from '../hands/hand-commands.js';

/**
 * @param {object} store
 * @param {object} history
 * @param {object} canvas `replaceArtwork`, `measureElement`, `loadSvgFromText`
 * @param {{ library?: object, presets?: object, presetStorage?: Storage|null, onInstalled?: (summary: object) => void }} [options]
 *   `presets` is the preset registry; `presetStorage` is where the author's own presets are kept (the browser's localStorage)
 */
export function createFacePartCommands(store, history, canvas, { library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY, presetStorage = null, partStorage = presetStorage, onInstalled = () => {} } = {}) {
  const measure = (id) => canvas.measureElement?.(id) || null;
  // A preset places a part over its fit and rests a hand on a drawing: the artwork and hand commands, the same as the builder runs.
  const artwork = createArtworkCommands(store, history);
  const hands = createHandCommands(store, history);
  if (partStorage) loadCustomParts(partStorage, library);
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
          const result = step.kind === 'remove' ? commands.remove(step.partId)
            : step.kind === 'replace' ? commands.replace(step.category, step.assetId, { fresh: true })
              : step.kind === 'place' ? commands.place(step.category, step.placement)
                : step.kind === 'handStyle' ? commands.restHand(step.side, step.style)
                  : commands.retint(step.token, step.colour);
          // A colour nothing on the face is painted as, a hand the face has not got, a
          // placement for a part that did not go on: not refusals, the preset names them all.
          if (!result.ok && !['retint', 'place', 'handStyle'].includes(step.kind)) { refused = { step, reason: result.reason }; break; }
          if (result.ok) done += 1;
        }
      } finally { if (opened) history.commitTransaction(); }
      return { ok: !refused, preset: item.id, steps: done, refused };
    },
    /**
     * A part of the face placed as a preset had it over its fit: the root
     * (and the pieces it paints behind the face) at the fit plus the move,
     * at the fit's size times the size, turned (roadmap phase 28).
     * @returns {{ ok: true, rootId: string } | { ok: false, reason: string }}
     */
    place(categoryId, placement = {}) {
      const document = store.getDocument();
      const category = facePartCategory(categoryId);
      const part = category ? Object.values(document.semanticParts || {}).find((item) => item?.type === category.part && item.assetRoot && document.elements?.[item.assetRoot]) : null;
      const fit = part?.assetFit;
      if (!part || !fit || !Number.isFinite(Number(fit.x))) return { ok: false, reason: `No ${category?.label.toLowerCase() || categoryId} from the library is on the face to place.` };
      // A size per axis over the fit's: a flipped part is a negative ratio; `scale` is the shorthand for both.
      const ratio = (value) => { const n = Number(value); return Number.isFinite(n) && n !== 0 ? n : 1; };
      const scaleX = ratio(placement.scaleX ?? placement.scale), scaleY = ratio(placement.scaleY ?? placement.scale);
      const patch = { x: Number(fit.x) + (Number(placement.x) || 0), y: (Number(fit.y) || 0) + (Number(placement.y) || 0), rotation: Number(placement.rotation) || 0, scaleX: (Number(fit.scaleX) || 1) * scaleX, scaleY: (Number(fit.scaleY) || 1) * scaleY };
      const opened = history?.beginTransaction?.() === true;
      try {
        for (const id of [part.assetRoot, ...(part.assetDetached || [])].filter((node) => document.elements?.[node])) {
          artwork.setTransform(id, patch, { source: 'face-preset' });
          canvas.applyElementTransform?.(id, store.getDocument().elements[id]);
        }
      } finally { if (opened) history.commitTransaction(); }
      return { ok: true, rootId: part.assetRoot };
    },
    /** A hand rested on the drawing a preset names, when the face has that hand and that drawing. */
    restHand(side, style) {
      const hand = store.getDocument().hands?.[side];
      if (!hand?.element || !hand.styles?.library?.some((entry) => entry.id === style)) return { ok: false, reason: `The ${side} hand has no drawing called "${style}".` };
      if (hand.styles.showing === style) return { ok: true, side, style, unchanged: true };
      return hands.setStyles(side, { showing: style }) ? { ok: true, side, style } : { ok: false, reason: `The ${side} hand could not rest on "${style}".` };
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
    /**
     * A piece of the face saved into the library as a part of the author's
     * own (docs/FACE_PART_LIBRARY.md, "Custom parts"; roadmap phase 27): its
     * artwork read from the document without the root's own transform (the
     * fit places it), its roles as named, the movements of the part it
     * belongs to, and the palette tokens its paints play read from the
     * face's colours. Validated as any asset is, then kept in the browser.
     *
     * @returns {{ ok: true, asset: object } | { ok: false, reason: string, issues?: object[] }}
     */
    saveAsPart({ rootId, category: categoryId, name, roles = {}, mountPoint = null, description = '' } = {}) {
      const document = store.getDocument();
      const category = facePartCategory(categoryId);
      if (!category?.installable) return { ok: false, reason: `"${categoryId || '?'}" is not a category a part can be saved as.` };
      if (!rootId || !document.elements?.[rootId]) return { ok: false, reason: 'Pick a piece to save first.' };
      const span = elementSpan(document.svgMarkup || '', rootId);
      if (!span) return { ok: false, reason: 'The piece is not in the drawing.' };
      const box = measure(rootId);
      if (!box) return { ok: false, reason: 'The piece has no size to measure.' };
      const slug = String(name || '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      if (!slug) return { ok: false, reason: 'Give the part a name.' };
      const prefix = category.id.toLowerCase();
      const id = library.has(`${prefix}.${slug}`) ? `${prefix}.${slug}-${Date.now().toString(36)}` : `${prefix}.${slug}`;
      // The root's own transform is where the author put it on this face, not part of the drawing.
      const artwork = document.svgMarkup.slice(span.start, span.end).replace(/^(<[A-Za-z][\w:-]*(?:\s+(?!transform\b)[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s+transform\s*=\s*(?:"[^"]*"|'[^']*')/, '$1');
      const ids = artworkIds(artwork);
      const owner = Object.values(document.semanticParts || {}).find((part) => part?.type === category.part && (part.assetRoot === rootId || Object.values(part.roles || {}).some((elementId) => ids.includes(elementId))));
      const capabilities = owner ? [...(owner.controls || [])] : [...(SEMANTIC_PART_REGISTRY[category.part]?.controls || [])];
      const paletteRoles = paletteRolesFromPaints(canvas.describePaints?.(rootId) || [], derivePalette(document, canvas.describePaints?.() || []), ids);
      const item = {
        id, category: category.id, name: String(name).trim(), description: String(description || ''), origin: 'custom', artwork,
        roles: Object.fromEntries(Object.entries(roles).filter(([, elementId]) => elementId)), capabilities,
        mountPoint: mountPoint || category.mountPoint, referenceBox: { x: box.x, y: box.y, width: box.width, height: box.height },
        paletteRoles, palette: paletteRoleTokens(paletteRoles)
      };
      const result = library.validate(item);
      if (!result.ok) return { ok: false, reason: result.errors.map((issue) => issue.message).join(' '), issues: result.issues };
      library.register(item);
      if (partStorage) saveCustomParts(partStorage, library);
      return { ok: true, asset: library.get(id) };
    },
    /**
     * A library instance painted again in the face's colours (roadmap phase
     * 29, "Reset colours"): every paint of it that plays a token in the asset
     * takes the token's colour the face has now, as one undo step. The
     * asset's ids are matched to the instance's, suffix or no suffix.
     * @returns {{ ok: true, uses: number } | { ok: false, reason: string }}
     */
    repaint(partId) {
      const document = store.getDocument();
      const part = document.semanticParts?.[partId];
      const asset = part?.assetId ? library.get(part.assetId) : null;
      if (!asset || !part.assetRoot || !document.elements?.[part.assetRoot]) return { ok: false, reason: 'This part came from no library asset: nothing to paint it from.' };
      const inside = [part.assetRoot, ...(part.assetDetached || [])].flatMap((id) => { const span = elementSpan(document.svgMarkup || '', id); return span ? artworkIds(document.svgMarkup.slice(span.start, span.end)) : []; });
      const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const named = (assetElementId) => inside.find((id) => id === assetElementId) || inside.find((id) => new RegExp(`^${escape(assetElementId)}-\\d+$`).test(id)) || null;
      const colours = Object.fromEntries(derivePalette(document, canvas.describePaints?.() || []).tokens.map((entry) => [entry.token, entry.colour]));
      const writes = [];
      for (const [assetElementId, roles] of Object.entries(asset.paletteRoles || {})) {
        const id = named(assetElementId);
        if (!id) continue;
        for (const property of ['fill', 'stroke']) { const token = roles?.[property]; if (token && colours[token]) writes.push({ id, property, value: colours[token] }); }
      }
      if (!writes.length) return { ok: false, reason: 'Nothing on this part plays a colour the face has.' };
      const opened = history?.beginTransaction?.() === true;
      try { for (const write of writes) canvas.setAppearance(write.id, write.property, write.value); }
      finally { if (opened) history.commitTransaction(); }
      return { ok: true, uses: writes.length };
    },
    /** One of the author's own parts, forgotten; a face wearing it keeps its drawing. */
    removeCustomPart(assetId) {
      const asset = library.get(assetId);
      if (!asset || asset.origin !== 'custom') return { ok: false, reason: asset ? 'A built-in part stays.' : `There is no part called "${assetId}".` };
      library.remove(assetId);
      if (partStorage) saveCustomParts(partStorage, library);
      return { ok: true };
    },
    /**
     * A face pack -- parts and presets from a JSON file -- into the library as
     * the author's own, all or nothing, kept in the browser (docs/FACE_PART_LIBRARY.md,
     * "Face packs"; roadmap phase 44).
     */
    installPack(input) {
      return installFacePack(input, { library, presets, partStorage, presetStorage });
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
