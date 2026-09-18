/**
 * The Soft Cartoon bird pack (MASC-12B), following the **BIRD-10A** planche and
 * the manifest written from it (`core/face-library/pilots/beak-soft-cartoon.js`,
 * docs/BEAK_SOFT_CARTOON_PILOT.md).
 *
 * Twenty-four drawings for the planche's thirty-three pieces: two of its four
 * accessories already existed, because an accessory that declares no
 * `morphologies` is universal and `accessory.glasses` *is* Lunettes rondes,
 * `accessory.bow-tie` *is* Nœud papillon — and the six eye sets turned out to
 * be the shipped construction at other radii, which the three builds in
 * `builtin/eyes.js` cover for every head there is (docs/EYE_BUILDS.md). A
 * bird's eye is a big round white with a disc in it, which is `eyes.simple`.
 *
 * ```text
 * heads       head        the bare feathered silhouette, and a jaw — a bird is soft
 * brows       eyebrows    the "formes d'yeux / sourcils", drawn as brows
 * beaks       beak        ← the first drawings this slot has ever had
 * crests      crest       ← and this one; head.top, closing MASC-09's question
 * monocle     accessory   the one piece of row 6 that had to be made
 * ```
 *
 * Six rows onto six slots, and **every one already in the `beak` morphology's
 * own list**. Where the robot pack had to amend `MORPHOLOGY_TABLE` first, this
 * one amends nothing: MASC-01 drew a bird correctly, down to leaving out the
 * nose, the mouth, the ears and the hair. A beak *is* the mouth; a crest is
 * what a bird has instead of hair.
 *
 * The order below is the order the planche lays its rows out, which is also the
 * order `npm run face:assets` reviews them in.
 */
import { BIRD_HEADS } from './heads.js';
import { BIRD_BEAKS, BIRD_BROWS } from './features.js';
import { ACCESSORY_MONOCLE, BIRD_CRESTS } from './crests.js';

export { BIRD_HEADS, BIRD_BROWS, BIRD_BEAKS, BIRD_CRESTS, ACCESSORY_MONOCLE };

export const BIRD_FACE_PARTS = Object.freeze([
  ...BIRD_HEADS, ...BIRD_BROWS, ...BIRD_BEAKS, ...BIRD_CRESTS, ACCESSORY_MONOCLE
]);
