/**
 * Who the library is *offering* something to, and who is merely still able to
 * open it (V6, §2.1 and §3 of the brief; docs/FACE_PART_LIBRARY.md, "Active and
 * legacy").
 *
 * ```text
 *   ACTIVE    human faces: 42 drawings, 6 presets, one kind of face
 *   LEGACY    the animal, robot and bird packs: 90 drawings, 16 presets
 * ```
 *
 * One module, one rule, one place to change it. Everything that shows an author
 * what they may choose asks here; everything that *loads*, *validates*,
 * *installs* or *plays* asks nothing here at all, and that is the whole design.
 * A legacy drawing is a drawing: it registers, it validates, it installs, a
 * document that wears one opens with it, a preset that names one still applies,
 * and a pack that ships for a legacy kind of face still comes in. The only
 * thing it does not do is appear in a list an author is choosing from.
 *
 * ## Why a flag and not a deletion
 *
 * The library grew a hundred and thirty-two drawings, and ninety of them are
 * not people. The brief's §3 asks for the shelves to be cleared; its §3.3 asks,
 * in the same breath, that nothing already made stops opening. Those two are
 * only compatible if "cleared" means *not offered* rather than *not there*:
 *
 * ```text
 * deleted     a muzzle a project wears stops resolving, and the face loses it
 * deleted     a pack that declares `morphologies: ['muzzle']` refuses to register
 * hidden      neither, and the shelf is as short as if they had gone
 * ```
 *
 * So nothing is deleted, and `docs/FACE_PART_LIBRARY.md` says out loud that the
 * packs are closed to new work rather than gone.
 *
 * ## How a thing becomes legacy
 *
 * **By derivation, first.** A drawing that no human face can wear is legacy,
 * and that is the ninety without one of them being edited: every asset of the
 * three packs already declares the kind of face it is for (MASC-02), so the
 * question "can a person wear this?" was already answerable and nobody had
 * thought to ask it. A preset is legacy when the kind of face it makes is.
 *
 * **By saying so, second.** `legacy: true` on an asset or a preset is for the
 * case derivation cannot reach: a *human* drawing that is retired anyway —
 * something experimental, something superseded, something a pack's author no
 * longer stands behind. Silent by default, so everything written before this
 * reads as active.
 *
 * Pure. Nothing here touches a document.
 */
import { FACE_PART_LIBRARY } from './face-part-registry.js';
import { FACE_PRESET_LIBRARY, presetMorphology } from './face-presets.js';
import { ACTIVE_FACE_MORPHOLOGY_IDS, LEGACY_FACE_MORPHOLOGY_IDS, compatibleMorphologies, faceMorphology, isLegacyMorphology } from './face-morphologies.js';

/** The kind of face the editor is for. Everything else is kept, not offered. */
export const ACTIVE_MORPHOLOGY = ACTIVE_FACE_MORPHOLOGY_IDS[0] || 'human';

/**
 * What a caller is asking to see.
 *
 * ```text
 * active    what the editor offers: human drawings and human presets
 * legacy    what it keeps: the three packs, and anything retired by hand
 * all       both, for a panel whose author has pressed "show the rest"
 * ```
 */
export const FACE_CATALOGUE_SCOPES = Object.freeze(['active', 'legacy', 'all']);

/** A scope word, or `active` — which is what a caller that says nothing means. */
export const faceCatalogueScope = (scope) => (FACE_CATALOGUE_SCOPES.includes(scope) ? scope : 'active');

/**
 * Whether a drawing is kept rather than offered.
 *
 * An asset that says nothing about the kinds of face it suits is universal
 * (`compatibleMorphologies`), so it suits a person and is active: that is every
 * one of the forty-two the human library ships and every drawing anybody has
 * ever saved. A drawing that names kinds and leaves the human one out cannot go
 * on a person, which is the ninety of the packs.
 */
export const isLegacyAsset = (asset) => Boolean(asset) && (asset.legacy === true || !compatibleMorphologies(asset).includes(ACTIVE_MORPHOLOGY));

/**
 * And whether a preset is.
 *
 * Read through the kind of face it makes, which a preset answers for itself
 * from its parts when it does not claim one (`presetMorphology`) — so the six
 * human presets stay active without saying anything, and the sixteen of the
 * packs become legacy without being edited.
 *
 * A preset whose kind cannot be read at all — every part of it universal — is
 * **active**: it makes a face a person could wear, and hiding it would hide a
 * preset for having been written carefully.
 */
export function isLegacyPreset(preset, { library = FACE_PART_LIBRARY } = {}) {
  if (!preset) return false;
  if (preset.legacy === true) return true;
  const kind = presetMorphology(preset, { library });
  return Boolean(kind) && isLegacyMorphology(kind);
}

/** Whether one thing belongs in one scope. */
const inScope = (legacy, scope) => (scope === 'all' ? true : scope === 'legacy' ? legacy : !legacy);

/**
 * The drawings of one scope, in the library's own order.
 *
 * Cards rather than every variant, for the same reason `assetsFor` lists cards:
 * a restyle is reached through the drawing it restyles, so six looks of one
 * mouth are six drawings and one card.
 */
export const catalogueAssets = ({ library = FACE_PART_LIBRARY, scope = 'active' } = {}) => {
  const wanted = faceCatalogueScope(scope);
  return library.cards().filter((asset) => inScope(isLegacyAsset(asset), wanted));
};

/** The presets of one scope, in the order they were registered. */
export const cataloguePresets = ({ presets = FACE_PRESET_LIBRARY, library = FACE_PART_LIBRARY, scope = 'active' } = {}) => {
  const wanted = faceCatalogueScope(scope);
  return presets.list().filter((preset) => inScope(isLegacyPreset(preset, { library }), wanted));
};

/**
 * The kinds of face of one scope, as records.
 *
 * `active` is one row long and always will be while the editor is about people;
 * it is derived rather than written down so that un-retiring a kind is one flag
 * in `face-morphologies.js` rather than an edit here as well.
 */
export const catalogueMorphologies = ({ scope = 'active' } = {}) => {
  const wanted = faceCatalogueScope(scope);
  const ids = wanted === 'legacy' ? LEGACY_FACE_MORPHOLOGY_IDS
    : wanted === 'all' ? [...ACTIVE_FACE_MORPHOLOGY_IDS, ...LEGACY_FACE_MORPHOLOGY_IDS]
      : ACTIVE_FACE_MORPHOLOGY_IDS;
  return ids.map((id) => faceMorphology(id)).filter(Boolean);
};

/**
 * What the library holds, split the way an author sees it.
 *
 * The numbers a panel says out loud — "90 drawings from the animal, robot and
 * bird packs are hidden" is a sentence somebody can act on, where a shorter
 * shelf with no explanation is a library that has lost something.
 *
 * @returns {{ assets: { active: number, legacy: number }, presets: { active: number, legacy: number }, morphologies: { active: string[], legacy: string[] } }}
 */
export function faceCatalogueSummary({ library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY } = {}) {
  const cards = library.cards();
  const list = presets.list();
  const legacyAssets = cards.filter((asset) => isLegacyAsset(asset)).length;
  const legacyPresets = list.filter((preset) => isLegacyPreset(preset, { library })).length;
  return {
    assets: { active: cards.length - legacyAssets, legacy: legacyAssets },
    presets: { active: list.length - legacyPresets, legacy: legacyPresets },
    morphologies: { active: [...ACTIVE_FACE_MORPHOLOGY_IDS], legacy: [...LEGACY_FACE_MORPHOLOGY_IDS] }
  };
}
