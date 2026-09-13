/**
 * The rows Design ▸ Face really shows (MASC-08B, docs/CHARACTER_BUILDER.md).
 *
 * ```text
 * SEMANTIC CATEGORY   what the rig understands         accessory
 * VISUAL SLOT         what the author picks in Design  Muzzle · Whiskers · Accessories
 * ```
 *
 * Three rows, three semantic parts, one category. Until now the browser was
 * built out of the eleven categories, so a cat's muzzle and its whiskers would
 * have been listed together under *Accessories* and a press in one would have
 * reached the other. This layer is the correction: it regroups what
 * `deriveCharacterParts` read out of the document into the **slots** of
 * `face-morphologies.js`, and hands the browser rows that are the thing an
 * author is choosing.
 *
 * What it is not:
 *
 * ```text
 * it does not change FACE_PART_CATEGORIES      the eleven are the rig's
 * it does not add a semantic part              no muzzle, whiskers or beak type
 * it does not touch a document                 nothing here is stored or exported
 * ```
 *
 * A row is authoring, and authoring only. The rule the whole file turns on:
 *
 * ```text
 * the slot decides what is offered
 * the category decides what is installed
 * ```
 *
 * The output has the same shape `deriveCharacterParts` returns -- `categories`,
 * `owners`, `instances`, `detached`, `parents` -- so `categoryForElement`,
 * `instanceRootOf`, `resolveActiveCategory`, `pairOf` and `characterSnapshot`
 * read rows with no change to any of them. `owners` maps a piece of artwork to
 * its *row*, which is what makes a click on a whisker open Whiskers.
 */
import { FACE_SLOTS, FACE_SLOT_IDS, faceMorphology, faceSlot } from '../../core/face-library/face-morphologies.js';
import { wornPartSlot } from '../../core/face-library/compatibility.js';
import { CHARACTER_CATEGORIES } from './character-model.js';

/** The glyph and the hint for the slots that are not one of the eleven categories. */
const SLOT_GLYPHS = Object.freeze({ muzzle: '▽', whiskers: '⋙', beak: '◣', horns: '⋏', crest: '♜', antenna: '⑂', panels: '▤' });
const SLOT_HINTS = Object.freeze({
  muzzle: 'The snout out in front of the face', whiskers: 'The whiskers to each side', beak: 'The beak, which opens and closes like a mouth',
  horns: 'The horns on top', crest: 'The crest, where hair would be', antenna: 'The antenna of a machine', panels: 'The plates a machine is built from'
});

/** Piece labels joined, as a category summarises itself: the same sentence, per row. */
function summarize(pieces, limit = 3) {
  const names = pieces.map((piece) => piece.label);
  return names.length > limit ? `${names.slice(0, limit).join(' · ')} +${names.length - limit}` : names.join(' · ');
}

/**
 * The slots in the order Design lists them for this kind of face: the
 * morphology's own first, and then every other one, so a row that is only here
 * because the mascot is wearing something in it is still somewhere sensible.
 */
export function slotOrder(morphology) {
  const declared = faceMorphology(morphology)?.slots || [];
  return [...declared, ...FACE_SLOT_IDS.filter((id) => !declared.includes(id))];
}

/**
 * Which row each semantic part of the face belongs to.
 *
 * Read through the asset, never through the artwork: a part is in the Muzzle
 * row because the drawing it was installed from is a muzzle, and a part whose
 * asset the library does not know falls back to its category -- so a project
 * from before any of this opens with its accessories under Accessories, with
 * nothing migrated (§5). A part reshaped by hand since it went on is still the
 * muzzle it was installed as, which is why the asset is read from the document
 * rather than from the list of pristine ones.
 *
 * @returns {Record<string, string>} part id → slot id
 */
export function partRowIndex(document, model, { library = null } = {}) {
  const index = {};
  for (const category of model?.categories || []) {
    if (!category.part) continue;
    for (const partId of category.partIds || []) {
      index[partId] = wornPartSlot({ assetId: document?.semanticParts?.[partId]?.assetId || null, category: category.id }, { library }) || category.id;
    }
  }
  return index;
}

/**
 * The rows, with the pieces of the mascot that are in each.
 *
 * @param {object} model from `deriveCharacterParts`
 * @param {{ document?: object, library?: object|null, morphology?: string|null }} [options]
 * @returns {{ categories: object[], owners: Record<string,string>, instances: Record<string,string>, detached: Record<string,string[]>, parents: object, rowOfPart: Record<string,string> }}
 */
export function deriveVisualRows(model, { document = {}, library = null, morphology = null } = {}) {
  const byId = new Map((model?.categories || []).map((category) => [category.id, category]));
  const rowOfPart = partRowIndex(document, model, { library });
  const owners = {}, instances = {}, detached = {};
  const drawn = (partId) => { const part = document?.semanticParts?.[partId]; return Boolean(part?.assetId && part.assetRoot && document?.elements?.[part.assetRoot]); };

  const partRow = (slot) => {
    const category = byId.get(slot.category);
    // A category with no semantic part yet has no row of its own to fill.
    if (!category?.part) return null;
    const mine = (partId) => (rowOfPart[partId] || slot.category) === slot.id;
    const pieces = (category.pieces || []).filter((piece) => mine(piece.partId));
    const partIds = (category.partIds || []).filter(mine);
    // What the row wears: the library drawings on it, and which part each is.
    // A part reshaped by hand is the author's, so no card is current for it --
    // the same reading a category made, per row.
    const worn = (category.worn || []).filter((item) => mine(item.partId));
    const installed = partIds.filter(drawn);
    const own = slot.id === slot.category;
    return {
      // The row's own identity first, then what it shares with its category.
      ...category,
      id: slot.id, slot, categoryId: slot.category, label: slot.label,
      // Whether the row is a visual slot of its own rather than the catch-all
      // its category has always been. It is what decides where a card lands:
      // a slot of its own holds one piece, the catch-all sorts by mount point.
      dedicated: !own,
      glyph: own ? category.glyph : SLOT_GLYPHS[slot.id] || '◆',
      hint: own ? category.hint : SLOT_HINTS[slot.id] || slot.label,
      pieces, partIds, worn,
      partId: partIds[0] || null,
      assetId: document?.semanticParts?.[installed[0]]?.assetId || null,
      assetIds: worn.map((item) => item.assetId),
      custom: installed.length > worn.length,
      status: pieces.length ? 'ready' : 'missing',
      summary: pieces.length ? summarize(pieces) : `No ${slot.label.toLowerCase()} on this mascot yet`
    };
  };

  const order = slotOrder(morphology);
  const rows = [];
  for (const category of model?.categories || []) if (category.kind && category.kind !== 'hands') rows.push({ ...category, slot: null, categoryId: null, dedicated: false });
  for (const id of order) { const row = faceSlot(id) ? partRow(FACE_SLOTS[id]) : null; if (row) rows.push(row); }
  for (const category of model?.categories || []) if (category.kind === 'hands') rows.push({ ...category, slot: null, categoryId: null, dedicated: false });

  for (const row of rows) {
    for (const piece of row.pieces || []) {
      owners[piece.id] ||= row.id;
      if (piece.role === 'instance') {
        instances[piece.id] = row.id;
        detached[piece.id] = piece.detached || [];
        for (const id of piece.detached || []) owners[id] ||= row.id;
      }
    }
  }
  return { categories: rows, owners, instances, detached, parents: model?.parents || {}, rowOfPart };
}

/**
 * Where a card pressed in a row lands (§10–§11).
 *
 * ```text
 * a slot of its own, holding a piece    that piece is what the card replaces
 * a slot of its own, empty              a new part: never something at the same mount
 * the catch-all row                     the mount point decides, among this row's parts
 * ```
 *
 * The middle line is the one that had to be added. *Accessories* and *Muzzle*
 * are both `accessory` parts at `head.center` with no host, so before this the
 * mount-point rule could not tell them apart and putting a muzzle on would have
 * taken the glasses off. `within` is how the row says which parts the rule may
 * look at, and `[]` -- the empty row -- says none of them, which is the same
 * sentence as *add a new part here*.
 *
 * A category a face wears one of is not affected: there is one mouth, and a
 * beak replaces it whichever row the card was found in.
 *
 * @returns {{ targetPartId: string|null, within: string[] }} for `commands.replace`
 */
export function rowInstallTarget(row) {
  const parts = row?.partIds || [];
  if (row?.dedicated) return { targetPartId: parts[0] || null, within: [] };
  return { targetPartId: null, within: [...parts] };
}
