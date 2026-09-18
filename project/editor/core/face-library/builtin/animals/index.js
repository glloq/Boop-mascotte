/**
 * The Soft Cartoon animal pack (MASC-10B): the drawings the parts sheet of
 * MASC-10A asked for, in the style the library is drawn in.
 *
 * ```text
 * 2  heads      1  brow      6  ear pairs
 * 6  muzzles    4  noses     4  mouths      4  sets of whiskers
 * ```
 *
 * **No eyes.** The pack shipped six, and all six were the shipped construction
 * at other radii — a socket, a white, a pupil, a glint, an outline and two
 * parked lids, which its own header said out loud. An animal's eye is not a
 * different drawing from a person's, it is the same drawing at another size
 * with its lids somewhere else, so the three builds in `builtin/eyes.js` serve
 * a muzzle exactly as they serve a face (docs/EYE_BUILDS.md). A slit pupil is
 * the one thing that was genuinely a shape rather than a size, and it is the
 * pupil's own scale: `eyes.iris` at a narrow `pupilScale` is a cat's eye.
 *
 * Every one of them declares `slot` and `morphologies: ['muzzle']`, so Design
 * offers them when an author is making an animal and never when they are
 * making a person — and every one installs through a category the rig already
 * understands. Nothing here adds a semantic part, a mount point or a control.
 */
import { ANIMAL_HEADS } from './heads.js';
import { ANIMAL_EARS } from './ears.js';
import { ANIMAL_MUZZLES } from './muzzles.js';
import { ANIMAL_BROWS, ANIMAL_MOUTHS, ANIMAL_NOSES, ANIMAL_WHISKERS } from './features.js';

export { ANIMAL_HEADS, ANIMAL_EARS, ANIMAL_MUZZLES, ANIMAL_BROWS, ANIMAL_MOUTHS, ANIMAL_NOSES, ANIMAL_WHISKERS };

export const ANIMAL_FACE_PARTS = Object.freeze([
  ...ANIMAL_HEADS, ...ANIMAL_BROWS, ...ANIMAL_EARS,
  ...ANIMAL_MUZZLES, ...ANIMAL_NOSES, ...ANIMAL_MOUTHS, ...ANIMAL_WHISKERS
]);
