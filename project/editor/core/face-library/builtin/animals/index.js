/**
 * The Soft Cartoon animal pack (MASC-10B): the drawings the parts sheet of
 * MASC-10A asked for, in the style the library is drawn in.
 *
 * ```text
 * 2  heads      3  eye sets   1  brow      6  ear pairs
 * 6  muzzles    4  noses      4  mouths    4  sets of whiskers
 * ```
 *
 * Every one of them declares `slot` and `morphologies: ['muzzle']`, so Design
 * offers them when an author is making an animal and never when they are
 * making a person — and every one installs through a category the rig already
 * understands. Nothing here adds a semantic part, a mount point or a control.
 */
import { ANIMAL_HEADS } from './heads.js';
import { ANIMAL_EARS } from './ears.js';
import { ANIMAL_EYES } from './eyes.js';
import { ANIMAL_MUZZLES } from './muzzles.js';
import { ANIMAL_BROWS, ANIMAL_MOUTHS, ANIMAL_NOSES, ANIMAL_WHISKERS } from './features.js';

export { ANIMAL_HEADS, ANIMAL_EARS, ANIMAL_EYES, ANIMAL_MUZZLES, ANIMAL_BROWS, ANIMAL_MOUTHS, ANIMAL_NOSES, ANIMAL_WHISKERS };

export const ANIMAL_FACE_PARTS = Object.freeze([
  ...ANIMAL_HEADS, ...ANIMAL_EYES, ...ANIMAL_BROWS, ...ANIMAL_EARS,
  ...ANIMAL_MUZZLES, ...ANIMAL_NOSES, ...ANIMAL_MOUTHS, ...ANIMAL_WHISKERS
]);
