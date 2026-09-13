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
import { FACE_PART_LIBRARY, baseAsset } from './face-part-registry.js';
import { FACE_PRESET_LIBRARY, presetDrawings, presetMorphology, styledAsset, wornFaceParts } from './face-presets.js';
import { isBaseFaceStyle } from './face-styles.js';
import { FACE_MORPHOLOGY_IDS, assetSlot, assetSupportsMorphology, faceMorphology, faceSlot, morphologySlots } from './face-morphologies.js';
import { facePartCategory } from './face-part-model.js';

// The kind of face a preset makes (MASC-08B) lives with the presets, because
// saving one from a face has to reach it and this module reads that one.
export { presetMorphology } from './face-presets.js';

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
 * The visual row a part on the face belongs to (MASC-08B).
 *
 * Design shows the eighteen **slots**, not the eleven categories: a muzzle, a
 * pair of whiskers and a pair of glasses are three rows of one category, and a
 * card pressed in one of them must act on the part that is really in that row.
 * The asset the part was installed from is what says which -- never the name of
 * an element, and never the semantic type, which is `accessory` for all three.
 *
 * A restyle is the same piece in another look, so a variant that did not repeat
 * its slot is read through the drawing it restyles: `head.round-flat` is a head
 * whether or not its author wrote the row down twice.
 *
 * A part with no asset the library still knows -- one somebody drew, one from a
 * project older than all of this, one whose pack has gone -- falls back to its
 * **category**, which is the row it has always been shown in. That is the whole
 * of the migration: there is none.
 *
 * @param {{ assetId?: string|null, category?: string|null }} worn one of {@link wornFaceParts}'s entries
 * @returns {string|null} a slot id
 */
export function wornPartSlot(worn, { library = FACE_PART_LIBRARY } = {}) {
  const fallback = facePartCategory(worn?.category) ? worn.category : null;
  const asset = worn?.assetId ? library?.get?.(worn.assetId) : null;
  if (!asset) return fallback;
  const found = faceSlot(asset.slot) || faceSlot(baseAsset(worn.assetId, library)?.slot) || faceSlot(assetSlot(asset));
  // A slot that does not hold this kind of part is not this part's row.
  // `validateFacePart` refuses the mismatch at the door, so this is a net and
  // not a path: a piece must never fall out of every row and off the screen.
  return found && (!fallback || found.category === fallback) ? found.id : fallback;
}

/**
 * Which kinds of face the library can actually make, and what the others are
 * waiting for (MASC-05).
 *
 * A kind is offered when the library can fill the slots that *make it that
 * kind* -- the ones `human` has not got. The reference is human on purpose and
 * not by accident: the library grew as a human face, and every other kind is
 * that plus its own pieces. A robot with no panels and no antenna is a person
 * with a square head, which `human` already offers, so offering `robot` as well
 * would be offering the same face twice under two names.
 *
 * It is derived rather than declared, so drawing a muzzle and a pair of
 * whiskers is what turns `muzzle` on -- no list to remember to edit, and no
 * kind switched on before there is anything in it.
 *
 * @returns {{ id, label, description, slots, defaultPreset, distinctive: string[], missing: string[], available: boolean }[]}
 */
export function availableMorphologies({ library = FACE_PART_LIBRARY } = {}) {
  const human = new Set(faceMorphology('human')?.slots || []);
  return FACE_MORPHOLOGY_IDS.map((id) => {
    const morphology = faceMorphology(id);
    const distinctive = morphology.slots.filter((slot) => !human.has(slot));
    const missing = distinctive.filter((slot) => !assetsFor({ library, morphology: id, slot }).length);
    return { ...morphology, distinctive, missing, available: missing.length === 0 };
  });
}

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
  // saying `muzzle` and being offered under `beak` would be two answers. A
  // preset claiming nothing is read from its parts rather than treated as
  // universal (MASC-08B), so the six the editor ships stay human.
  const claimed = presetMorphology(preset, { library });
  const suits = !morphology || ((!claimed || claimed === morphology)
    && named.every((assetId) => { const asset = library.get(assetId); return !asset || assetSupportsMorphology(asset, morphology); }));
  return { ok: Boolean(suits), morphology: morphology || claimed || null, style: wanted, restyled, kept };
}

/** The presets that can dress this kind of face, in the order they were registered. */
export const presetsFor = ({ presets = FACE_PRESET_LIBRARY, library = FACE_PART_LIBRARY, morphology = null, style = null } = {}) =>
  presets.list().filter((preset) => presetCompatibility(preset, { library, morphology, style }).ok);

/** Whether a drawing already *is* the library's drawing for one style (MASC-08A). */
const drawnInStyle = (asset, style) => Boolean(asset) && (isBaseFaceStyle(style) ? !asset.variant : asset.variant?.style === style);

/**
 * What changes on the face that is there if every part it wears is asked for
 * in one style (MASC-06, three-way since MASC-08A).
 *
 * A plan, not an edit: it names the replacements a caller would then run
 * through the commands it already has. Each worn part lands in exactly one of
 * three groups, and the middle one is the whole point of this revision:
 *
 * ```text
 * replace   another drawing exists for the style asked for
 * already   the drawing worn *is* the style asked for
 * kept      nobody has drawn this part in that style
 * ```
 *
 * `already` and `kept` both leave the face alone, and telling them apart is
 * what stops the editor saying "nothing is drawn in this style" to somebody
 * whose face is entirely drawn in it. `kept` stays as important as `replace`:
 * a part whose restyle nobody has drawn is never removed and never silently
 * swapped, and an author not told it stayed would read the difference as
 * something lost.
 *
 * Every comparison goes through the canonical base, so the style can be
 * changed as many times as anybody likes -- base → flat → retro → base is
 * three ordinary restyles and not a chain.
 *
 * @returns {{ style, replace: { partId, category, from, to }[], already: { partId, category, assetId }[], kept: { partId, category, assetId }[] }}
 */
export function restylePlan(document = {}, style = '', { library = FACE_PART_LIBRARY } = {}) {
  const replace = [], already = [], kept = [];
  for (const worn of wornFaceParts(document)) {
    const here = { partId: worn.partId, category: worn.category, assetId: worn.assetId };
    const asset = library.get(worn.assetId);
    // A part whose drawing the library has forgotten is kept: there is nothing
    // to resolve it through, and taking it off would be the one thing a
    // restyle must never do.
    if (!asset) { kept.push(here); continue; }
    if (drawnInStyle(asset, style)) { already.push(here); continue; }
    const to = styledAsset(worn.assetId, style, library);
    if (to === worn.assetId) kept.push(here);
    else replace.push({ partId: worn.partId, category: worn.category, from: worn.assetId, to });
  }
  return { style, replace, already, kept };
}

/**
 * The sentence a restyle owes the author, in three numbers.
 *
 * The rule it exists to keep: a part that is **already** in the style asked for
 * is never described as one the style could not reach. Before MASC-08A a face
 * entirely in Soft Cartoon, asked for Soft Cartoon, was told "nothing is drawn
 * in this style yet" — which is the opposite of what had happened.
 */
export function describeRestylePlan(plan) {
  const restyled = plan?.replace?.length || 0, already = plan?.already?.length || 0, kept = plan?.kept?.length || 0;
  if (!restyled && !already && !kept) return 'Nothing on this face comes from the library yet.';
  const parts = (count) => `${count} part${count === 1 ? '' : 's'}`;
  if (!restyled && !kept) return already === 1 ? 'The one library part on this face is already in this style.' : `All ${already} library parts are already in this style.`;
  if (!restyled) return `Nothing can be redrawn in this style; ${parts(kept)} stay as ${kept === 1 ? 'it is' : 'they are'}${already ? `, and ${parts(already)} ${already === 1 ? 'is' : 'are'} already in it` : ''}.`;
  const tail = [already ? `${already} already in this style` : '', kept ? `${kept} kept as ${kept === 1 ? 'it is' : 'they are'}` : ''].filter(Boolean);
  return `${parts(restyled)} restyled${tail.length ? `, ${tail.join(', ')}` : ''}.`;
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
