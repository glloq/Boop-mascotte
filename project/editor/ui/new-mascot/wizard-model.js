/**
 * The two questions a new mascot is (UI-REDESIGN-03,
 * docs/REDESIGN_UI_2026-09/03_CREATION.md).
 *
 * ```text
 * 1. What kind of mascot?     Human · Animal · Bird · Robot
 * 2. Which one?               Owl · Duck · Parrot · Crow · Cute bird · Slim bird
 * ```
 *
 * Two, and not the five the brief sketched, because three of those five are not
 * questions this library can answer:
 *
 * ```text
 * a family between Animal and Cat   the six muzzle presets are all mammals;
 *                                   the level would divide nothing
 * a style                           one style is catalogued and zero variants
 *                                   are drawn, so the step has one option
 * a base after the family           `cat` IS the base -- a preset is a whole
 *                                   face, not a category above one
 * ```
 *
 * The style step is **counted, not assumed**: {@link newMascotSteps} reads the
 * variants the library actually holds, so the day a pack brings a second style
 * it answers three steps and `core/tests/new-mascot-wizard.test.js` fails. The
 * wizard renders two today; that failure is the reminder to wire the third,
 * rather than a silent option nobody notices is now worth offering.
 *
 * Pure over the library. Nothing here touches a document, and the wizard's
 * controller is the only thing that writes.
 */
import { FACE_PART_LIBRARY } from '../../core/face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY, presetThumbnail } from '../../core/face-library/face-presets.js';
import { availableFaceStyles } from '../../core/face-library/face-styles.js';
import { availableMorphologies, presetsFor } from '../../core/face-library/compatibility.js';
import { faceMorphology } from '../../core/face-library/face-morphologies.js';

/**
 * The kinds worth offering, each with a picture and how many characters it
 * holds.
 *
 * A kind the library cannot fill is not here — the same rule the Type row
 * follows. A kind that is drawable but has no preset is not here either: it
 * would be a card that leads to an empty second step, which is worse than a
 * card that is missing.
 */
export function mascotTypes({ library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY } = {}) {
  return availableMorphologies({ library })
    .filter((type) => type.available)
    .map((type) => {
      const characters = presetsFor({ presets, library, morphology: type.id });
      // The card's picture is the kind's default character, which is why
      // `defaultPreset` being stale mattered: a kind with six birds drawn and
      // no default had nothing to show for itself.
      const cover = presets.get?.(type.defaultPreset) || characters[0] || null;
      return {
        id: type.id,
        label: type.label,
        description: type.description,
        count: characters.length,
        thumbnail: cover ? presetThumbnail(cover, library, { size: 160 }) : ''
      };
    })
    .filter((type) => type.count > 0);
}

/**
 * The characters of one kind, in the order the library registered them.
 *
 * One picture each, not two. `presetThumbnail` caches per preset *and size*, so
 * asking for a card-sized one and a preview-sized one would evict each other on
 * every render and redraw twelve faces per press. The drawing carries a
 * `viewBox`, so the same markup is the 128px card and the 420px preview — the
 * stylesheet decides which.
 */
export function mascotCharacters(morphology, { library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY } = {}) {
  return presetsFor({ presets, library, morphology }).map((preset) => ({
    id: preset.id,
    name: preset.name || preset.id,
    description: preset.description || '',
    thumbnail: presetThumbnail(preset, library, { size: 128 })
  }));
}

/**
 * The steps this library can actually ask about.
 *
 * `style` is conditional and counted, never assumed: a step with one option is
 * not a question. Two styles with drawings behind them is the threshold,
 * because choosing between one style and nothing is the same non-question.
 */
export function newMascotSteps({ library = FACE_PART_LIBRARY } = {}) {
  const drawn = availableFaceStyles(library).filter((style) => style.variants > 0);
  return drawn.length >= 2 ? ['type', 'style', 'character'] : ['type', 'character'];
}

/** The kind's own word, for a heading. Falls back to the id rather than to nothing. */
export const mascotTypeLabel = (id) => faceMorphology(id)?.label || String(id ?? '');
