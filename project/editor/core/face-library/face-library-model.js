/**
 * What the face part library offers this mascot, as data
 * (docs/FACE_PART_LIBRARY.md).
 *
 * The library holds a hundred and thirty-two drawings, and **offers
 * forty-two**: the human heads, eyes, brows, noses, mouth, ears, hair, facial
 * hair and accessories. The other ninety are the animal, robot and bird packs,
 * which V6 declassed to legacy — kept, so that a face already wearing one goes
 * on opening and wearing it, and not offered, because the editor is about human
 * faces (`face-catalogue.js`; §3 of the V6 brief).
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
import { FACE_PART_CATEGORIES, describeFacePartCapabilities, facePartCategory, partArtworkMarkup } from './face-part-model.js';
import { remapArtworkIds } from './face-part-artwork.js';
import { morphologiesOfFace } from './compatibility.js';
import { assetSupportsMorphology } from './face-morphologies.js';
import { catalogueAssets, isLegacyAsset } from './face-catalogue.js';
import { findFacePartByType } from '../../rig-editor/semantic-parts/face-roles.js';

/** A little air around the drawing, so a card is not a crop. */
const PREVIEW_PAD = 6;

/** Where the library opens when nothing has said otherwise. */
const DEFAULT_LIBRARY_CATEGORY = 'eyes';

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
  // What this mascot can currently do with this part of its face. A drawing
  // that cannot carry `mouthRound` costs nothing on a mouth that never rounds,
  // and costs an author their work on one that does — so the warning is about
  // *this* face, not about the asset in the abstract (UX-50 PR 7).
  const part = category.part ? findFacePartByType(document, category.part) : null;
  const inUse = Array.isArray(part?.controls) ? part.controls : [];
  return library.cards(categoryId).map((asset) => {
    const capabilities = describeFacePartCapabilities(asset);
    const loses = inUse.filter((control) => capabilities.missing.includes(control));
    return {
      id: asset.id, name: asset.name, description: asset.description || '',
      tags: asset.tags || [], origin: asset.origin || 'builtin',
      worn: worn?.assetId === asset.id,
      // Kept rather than offered (V6, §3): a drawing no human face can wear.
      // It is a *reading* here and never a removal -- a face already wearing
      // one still shows it, because the one thing hiding must never do is hide
      // the door to something somebody has already put on (`face-catalogue.js`).
      legacy: isLegacyAsset(asset),
      styles: library.variantsOf(asset.id).length,
      compatible: !morphologies.length || morphologies.some((item) => assetSupportsMorphology(asset, item)),
      // The movements the drawing carries, and the ones this face would lose by
      // wearing it. `loses` is what the *Limited animation* badge says, and it
      // is said **before** the press: the install already reported what it
      // switched off afterwards, which is the wrong end of the decision.
      supports: [...capabilities.supported],
      missing: [...capabilities.missing],
      loses,
      preview: assetPreview(asset)
    };
  });
}

/**
 * Every category, with what it holds and what the face wears.
 *
 * A category the library has nothing for is reported with `count: 0` rather
 * than left out: *Pupils* and *Eyelids* are installable parts the library ships
 * no drawing for yet, and an author looking for them deserves to be told that
 * rather than left wondering where they went.
 */
/**
 * Which part of the face the cards are for, without building a single one
 * (UX-50 PR 7).
 *
 * The selection wins when it names a part the library has drawings for — an
 * author with a mouth in hand is not looking for eyes, and asking them to find
 * the Mouth tab by eye is asking them to tell the editor something it already
 * knows (§6 of the brief). Below it, whatever the author last asked for by
 * pressing a tab, because a press is still a choice and outlives the selection
 * that preceded it.
 *
 * Separate from the model because the panel needs the answer *before* deciding
 * whether to redraw: the library follows the selection now, so it is asked on
 * every canvas click, and building a hundred and fifty previews to discover
 * that nothing changed is the rebuild §31 is about.
 *
 * With neither a selection nor a press it opens where it always opened, on the
 * eyes: nothing about following the selection is a reason to move the landing
 * an author already knows.
 *
 * @returns {{ active: string|null, following: boolean }}
 */
export function resolveLibraryCategory(document = {}, { library = FACE_PART_LIBRARY, category = null, subject = null } = {}) {
  const has = (id) => Boolean(id) && library.cards(id).length > 0;
  const followed = has(subject) ? subject : null;
  const active = has(category) ? category : followed
    || (has(DEFAULT_LIBRARY_CATEGORY) ? DEFAULT_LIBRARY_CATEGORY : null)
    || FACE_PART_CATEGORIES.find((item) => has(item.id))?.id || FACE_PART_CATEGORIES[0]?.id || null;
  return { active, following: Boolean(followed) && active === followed && !category };
}

/**
 * Which cards a shelf shows, before anything is sorted.
 *
 * Two filters, and they are not the same question:
 *
 * ```text
 * legacy       is this drawing part of what the editor offers at all?
 * compatible   does it suit the kind of face this mascot already is?
 * ```
 *
 * The first is the V6 recentring (§3 of the brief): the animal, robot and bird
 * packs are kept and not offered, so a human face's Mouth row is one mouth
 * rather than sixteen. The second is MASC-04's, and it was already here.
 *
 * Both have the same exception, for the same reason: **a card the face is
 * wearing is always shown**. Hiding the only door to a part somebody has
 * already put on is the failure this layer exists to prevent, and it is worse
 * for legacy than for compatibility — an author who opened an animal made
 * before the recentring must still be able to see, and change, its muzzle.
 */
const shelf = (cards, { showAll, showLegacy }) =>
  cards.filter((card) => card.worn || ((showLegacy || !card.legacy) && (showAll || card.compatible)));

export function faceLibraryModel(document = {}, { library = FACE_PART_LIBRARY, category = null, subject = null, showAll = false, showLegacy = false } = {}) {
  const categories = FACE_PART_CATEGORIES.map((item) => ({
    id: item.id, label: item.label, part: item.part, installable: item.installable,
    count: library.cards(item.id).length,
    worn: wornAsset(document, item.id)
  }));
  const resolved = resolveLibraryCategory(document, { library, category, subject });
  const active = categories.find((item) => item.id === resolved.active) || categories[0];
  const all = active ? libraryCards(document, active.id, { library }) : [];
  // Compatible drawings first (§6: "afficher d'abord les remplacements
  // compatibles"), and that is the *only* thing the order says.
  //
  // It sorted by animation cost too, briefly, and that was wrong twice over: it
  // reordered a shelf whose order the library authors on purpose, and it fought
  // the affinity ordering that already sorts by the character being made
  // (`compatibility.js`). What a drawing costs is said on the drawing, as a
  // badge — which is information the author can act on without the row moving
  // under them. An author may well want the drawing more than the movement.
  const sorted = [...all].sort((left, right) => Number(right.compatible) - Number(left.compatible));
  const cards = shelf(sorted, { showAll, showLegacy });
  const shown = new Set(cards.map((card) => card.id));
  return {
    categories,
    active: active?.id || null,
    /** Whether the cards are the ones the selection asked for, or a tab the author pressed. */
    following: resolved.following,
    cards,
    showAll,
    showLegacy,
    /** How many drawings the compatibility filter is holding back, for the button that undoes it. */
    filtered: all.filter((card) => !shown.has(card.id) && !card.legacy).length,
    /** And how many the recentring is: the packs, in this row (V6, §3). */
    legacy: all.filter((card) => !shown.has(card.id) && card.legacy).length,
    // Which face this is, in the library's own words, so a panel can say why a
    // card is marked as a mismatch.
    morphologies: morphologiesOfFace(document, { library }),
    total: categories.reduce((sum, item) => sum + item.count, 0),
    /**
     * And how many of those the editor actually offers (V6, §3).
     *
     * `total` is what the library *holds*, which is what an importer and a pack
     * reader care about; `offered` is what an author is choosing from, which is
     * what a panel should say out loud. They were the same number until the
     * animal, robot and bird packs were declassed, and now they are 132 and 42.
     */
    offered: catalogueAssets({ library }).length
  };
}
