/**
 * The Soft Cartoon robot pack (MASC-11B), following the **ROBOT-V1** planche
 * and the manifest written from it
 * (`core/face-library/pilots/robot-soft-cartoon.js`,
 * docs/ROBOT_SOFT_CARTOON_PILOT.md).
 *
 * Twenty-eight drawings, one per family the planche labels: seven rows across
 * four kinds of robot — Écran, Rétro, Industriel and Jouet. The planche draws
 * three variants of each family; which of those triples are really three
 * drawings and which are one drawing in three colours is settled on the review
 * sheets, because a colour is a palette in this library and not a drawing.
 *
 * Kept together, as the animal pack is, because a robot face is a *set* rather
 * than one more of each: the four columns are four visual languages, and
 * nothing is shared between them.
 *
 * ```text
 * shells     head        the bare case, and no jaw — a bolted plate does not chew
 * sides      ears        the Modules latéraux, where an ear goes, so they wiggle
 * eyes       eyes        composites: the lit element is the pupil
 * visors     eyebrows    the Sourcils / visière, so they raise and tilt
 * mouths     mouth       a speaker keeps mouthOpen, smile and mouthWidth
 * antennae   antenna     ← the first drawings this slot has ever had
 * panels     panels      ← and this one
 * ```
 *
 * The order below is the order the planche lays the rows out, which is also the
 * order `npm run face:assets` reviews them in.
 */
import { ROBOT_SHELLS } from './shells.js';
import { ROBOT_SIDES } from './sides.js';
import { ROBOT_EYES } from './eyes.js';
import { ROBOT_MOUTHS, ROBOT_VISORS } from './features.js';
import { ROBOT_ANTENNAE, ROBOT_PANELS } from './fittings.js';

export { ROBOT_SHELLS, ROBOT_SIDES, ROBOT_EYES, ROBOT_VISORS, ROBOT_MOUTHS, ROBOT_ANTENNAE, ROBOT_PANELS };

export const ROBOT_FACE_PARTS = Object.freeze([
  ...ROBOT_SHELLS, ...ROBOT_SIDES, ...ROBOT_EYES, ...ROBOT_VISORS,
  ...ROBOT_MOUTHS, ...ROBOT_ANTENNAE, ...ROBOT_PANELS
]);
