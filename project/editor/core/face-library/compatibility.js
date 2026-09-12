/**
 * What can go with what (MASC-04, docs/MASC_LIBRARY_BASELINE.md).
 *
 * One pure layer between the library and the Character Builder. It answers
 * questions — which drawings suit this kind of face, in this slot; whether a
 * preset can make one; what would change if the whole face were restyled — and
 * it never touches a document. Every answer is derived from the asset metadata
 * of MASC-02 and the preset metadata of MASC-03, so a pack that arrives with
 * new drawings changes the answers without changing this file.
 *
 * The rule that shapes all of it is the fallback the library already had: a
 * style is a **wish**. Where a restyle exists it goes on, and where it does not
 * the drawing stays as it is. Nothing is ever taken off a face because nobody
 * has drawn its replacement yet, and every answer here says out loud how much
 * of the wish it could grant.
 */
import { FACE_PART_LIBRARY } from './face-part-registry.js';
import { FACE_PRESET_LIBRARY, presetDrawings, styledAsset, wornFaceParts } from './face-presets.js';
import { FACE_MORPHOLOGY_IDS, assetSlot, assetSupportsMorphology, faceSlot, morphologySlots } from './face-morphologies.js';

/**
 * The drawings on offer, in one slot of one kind of face, in one style.
 *
 * Cards, never variants: a restyle is reached through the drawing it restyles,
 * so six looks of one mouth are six drawings and one card. Each answer carries
 * both — `card` is what is listed and named, `drawing` is what a press would
 * actually install — because those are two different things the moment a style
 * is chosen, and a caller that conflated them would show one name and install
 * another.
 *
 * @param {{ library?, morphology?: string|null, style?: string, slot?: string|null }} [query]
 * @returns {{ card: object, drawing: object, restyled: boolean }[]}
 */
export function assetsFor({ library = FACE_PART_LIBRARY, morphology = null, style = '', slot = null } = {}) {
  const wanted = faceSlot(slot);
  return library.cards()
    .filter((card) => (!wanted || assetSlot(card) === wanted.id))
    .filter((card) => (!morphology || assetSupportsMorphology(card, morphology)))
    .map((card) => {
      const drawing = library.get(styledAsset(card.id, style, library)) || card;
      return { card, drawing, restyled: drawing.id !== card.id };
    });
}

/**
 * The slots a kind of face is made of, each with what the library can fill it
 * with — so a slot nobody has drawn for reads as empty rather than as missing.
 *
 * @returns {{ slot: object, assets: object[], count: number }[]}
 */
export const slotsFor = ({ library = FACE_PART_LIBRARY, morphology, style = '' } = {}) =>
  morphologySlots(morphology).map((slot) => {
    const assets = assetsFor({ library, morphology, style, slot: slot.id });
    return { slot, assets, count: assets.length };
  });

/**
 * Whether a preset can dress this kind of face, and how much of its style the
 * library can grant.
 *
 * `ok` is the only thing that gates an offer, and it is about the *parts*: a
 * preset whose nose is drawn for people cannot make a bird, whatever it claims.
 * `restyled` and `kept` are a reading, and between them they are MASC-06's
 * summary line — the parts kept are exactly the ones whose restyle nobody has
 * drawn, which is why there is no third list.
 *
 * @returns {{ ok: boolean, morphology: string|null, style: string, restyled: string[], kept: string[] }}
 */
export function presetCompatibility(preset, { library = FACE_PART_LIBRARY, morphology = null, style = null } = {}) {
  const wanted = style === null ? (preset?.style || '') : style;
  const named = [...Object.values(preset?.parts || {}), ...(preset?.accessories || [])];
  const restyled = [], kept = [];
  for (const assetId of named) {
    const drawing = styledAsset(assetId, wanted, library);
    (drawing === assetId ? kept : restyled).push(assetId);
  }
  // A preset claiming a kind of face is checked against that claim as well:
  // saying `muzzle` and being offered under `beak` would be two answers.
  const claimed = preset?.morphology || '';
  const suits = !morphology || ((!claimed || claimed === morphology)
    && named.every((assetId) => { const asset = library.get(assetId); return !asset || assetSupportsMorphology(asset, morphology); }));
  return { ok: Boolean(suits), morphology: morphology || claimed || null, style: wanted, restyled, kept };
}

/** The presets that can dress this kind of face, in the order they were registered. */
export const presetsFor = ({ presets = FACE_PRESET_LIBRARY, library = FACE_PART_LIBRARY, morphology = null, style = null } = {}) =>
  presets.list().filter((preset) => presetCompatibility(preset, { library, morphology, style }).ok);

/**
 * What changes on the face that is there if every part it wears is asked for
 * in one style (MASC-06).
 *
 * A plan, not an edit: it names the replacements a caller would then run
 * through the commands it already has. `kept` is as important as `replace` and
 * is why the summary reads "7 restyled, 2 kept" rather than "7 restyled" — a
 * part whose restyle nobody has drawn stays exactly as it is, and an author who
 * is not told so would read the difference as something lost.
 *
 * @returns {{ style: string, replace: { partId, category, from, to }[], kept: { partId, category, assetId }[] }}
 */
export function restylePlan(document = {}, style = '', { library = FACE_PART_LIBRARY } = {}) {
  const replace = [], kept = [];
  for (const worn of wornFaceParts(document)) {
    const to = styledAsset(worn.assetId, style, library);
    if (to === worn.assetId) kept.push({ partId: worn.partId, category: worn.category, assetId: worn.assetId });
    else replace.push({ partId: worn.partId, category: worn.category, from: worn.assetId, to });
  }
  return { style, replace, kept };
}

/** "7 parts restyled, 2 kept" — the sentence a restyle owes the author. */
export function describeRestylePlan(plan) {
  const restyled = plan?.replace?.length || 0, kept = plan?.kept?.length || 0;
  if (!restyled && !kept) return 'Nothing on this face comes from the library yet.';
  if (!restyled) return `Nothing is drawn in this style yet, so all ${kept} part${kept === 1 ? '' : 's'} stay as they are.`;
  return `${restyled} part${restyled === 1 ? '' : 's'} restyled${kept ? `, ${kept} kept as ${kept === 1 ? 'it is' : 'they are'}` : ''}.`;
}

/**
 * The kind of face a document is already wearing: the kinds every one of its
 * parts suits, narrowest first.
 *
 * Derived, never stored. A face has parts, and which kind of creature they add
 * up to is a reading of them — the same choice `presetOfFace` makes, and for
 * the same reason: a stored answer would drift from the parts the moment
 * anybody changed one, and a morphology in `ProjectDocument` would be a UI
 * preference in the project (Règle D).
 *
 * @returns {string[]} every kind all the worn drawings suit; all five for a face wearing only universal ones
 */
export function morphologiesOfFace(document = {}, { library = FACE_PART_LIBRARY } = {}) {
  const worn = wornFaceParts(document).map((part) => library.get(part.assetId)).filter(Boolean);
  return FACE_MORPHOLOGY_IDS.filter((id) => worn.every((asset) => assetSupportsMorphology(asset, id)));
}
