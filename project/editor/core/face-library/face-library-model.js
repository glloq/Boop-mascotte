/**
 * What the face part library offers this mascot, as data
 * (docs/FACE_PART_LIBRARY.md).
 *
 * The library ships **a hundred and fifty drawings** — heads, eyes, brows,
 * noses, mouths, ears, hair, facial hair and accessories, plus the animal,
 * robot and bird packs — and for a while nothing in the editor could reach
 * one. `facePartCommands.replace()` had no caller: the Character Builder that
 * used to drive it was taken out and nothing replaced it, so an author could
 * *add* to a library (••• → Import face pack) they could not browse or use.
 *
 * This is the reading half. It says, per category, which drawings there are,
 * which one the face is wearing, and what installing one would do — and it
 * knows nothing about markup, presses or panels.
 *
 * ## The preview
 *
 * Each card carries its drawing, ready to put in an `<svg>`: the library's own
 * artwork with **its ids renamed** per card. That matters more than it looks.
 * Several of the assets clip with `<clipPath id="socketLeft">` and reference it
 * by `url(#socketLeft)`, and twenty cards sharing one id in one document is
 * twenty eyes clipped to the first card's socket. `remapArtworkIds` is the
 * same function the install uses, for the same reason.
 */
import { FACE_PART_LIBRARY } from './face-part-registry.js';
import { FACE_PART_CATEGORIES, facePartCategory, partArtworkMarkup } from './face-part-model.js';
import { remapArtworkIds } from './face-part-artwork.js';
import { morphologiesOfFace } from './compatibility.js';
import { assetSupportsMorphology } from './face-morphologies.js';
import { findFacePartByType } from '../../rig-editor/semantic-parts/face-roles.js';

/** A little air around the drawing, so a card is not a crop. */
const PREVIEW_PAD = 6;

/**
 * One card's preview: a viewBox and the markup to put inside it.
 *
 * The viewBox is the asset's own reference box — the frame the library drew it
 * in — padded. An asset with no box gets the template's square, which is where
 * every built-in drawing lives anyway.
 */
export function assetPreview(asset, { key = '' } = {}) {
  const box = asset?.referenceBox;
  const frame = box && box.width > 0 && box.height > 0
    ? { x: box.x - PREVIEW_PAD, y: box.y - PREVIEW_PAD, width: box.width + PREVIEW_PAD * 2, height: box.height + PREVIEW_PAD * 2 }
    : { x: 0, y: 0, width: 240, height: 240 };
  // Every id suffixed with the card's own key: a preview's `url(#…)` has to
  // resolve inside the preview and not into the card above it.
  const suffix = key || asset?.id?.replace(/[^a-z0-9]+/gi, '-') || 'preview';
  const { markup } = remapArtworkIds(partArtworkMarkup(asset), { rename: (id) => `preview-${suffix}-${id}` });
  return { viewBox: `${frame.x} ${frame.y} ${frame.width} ${frame.height}`, markup };
}

/**
 * Which drawing of one category the face is wearing, if the library put it
 * there.
 *
 * A part an author drew themselves, or imported as an SVG, has no `assetId`:
 * it is wearing nothing *from the library*, which is a different answer from
 * wearing nothing at all and the cards say so.
 */
export function wornAsset(document = {}, categoryId) {
  const category = facePartCategory(categoryId);
  if (!category?.part) return null;
  const part = findFacePartByType(document, category.part);
  return part?.assetId ? { assetId: part.assetId, partId: part.id, name: FACE_PART_LIBRARY.get(part.assetId)?.name || part.assetId } : null;
}

/**
 * One category's cards, in library order.
 *
 * `compatible` is whether the drawing suits the morphologies this face already
 * wears — a muzzle's mouth on a human head is the mismatch the packs exist to
 * avoid (`compatibility.js`). It is a **warning and never a filter**: an author
 * who wants a beak on a round head is allowed one, and a card that silently
 * vanished would read as a library that had lost something.
 */
export function libraryCards(document = {}, categoryId, { library = FACE_PART_LIBRARY } = {}) {
  const category = facePartCategory(categoryId);
  if (!category) return [];
  const worn = wornAsset(document, categoryId);
  const morphologies = morphologiesOfFace(document, { library });
  return library.cards(categoryId).map((asset) => ({
    id: asset.id, name: asset.name, description: asset.description || '',
    tags: asset.tags || [], origin: asset.origin || 'builtin',
    worn: worn?.assetId === asset.id,
    styles: library.variantsOf(asset.id).length,
    compatible: !morphologies.length || morphologies.some((item) => assetSupportsMorphology(asset, item)),
    preview: assetPreview(asset)
  }));
}

/**
 * Every category, with what it holds and what the face wears.
 *
 * A category the library has nothing for is reported with `count: 0` rather
 * than left out: *Pupils* and *Eyelids* are installable parts the library ships
 * no drawing for yet, and an author looking for them deserves to be told that
 * rather than left wondering where they went.
 */
export function faceLibraryModel(document = {}, { library = FACE_PART_LIBRARY, category = null } = {}) {
  const categories = FACE_PART_CATEGORIES.map((item) => ({
    id: item.id, label: item.label, part: item.part, installable: item.installable,
    count: library.cards(item.id).length,
    worn: wornAsset(document, item.id)
  }));
  const active = categories.find((item) => item.id === category && item.count) || categories.find((item) => item.count) || categories[0];
  return {
    categories,
    active: active?.id || null,
    cards: active ? libraryCards(document, active.id, { library }) : [],
    // Which face this is, in the library's own words, so a panel can say why a
    // card is marked as a mismatch.
    morphologies: morphologiesOfFace(document, { library }),
    total: categories.reduce((sum, item) => sum + item.count, 0)
  };
}
