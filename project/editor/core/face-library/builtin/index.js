/**
 * The assets the editor ships (docs/FACE_PART_LIBRARY.md): the basic face
 * library of the roadmap (PR 6), a few of each part, all drawn in the
 * template face's frame so the same reference boxes fit them onto any face.
 * One file per category; the V1 library of the roadmap (phase 45) grows
 * these files.
 */
import { MOUTH_SIMPLE } from './mouth-simple.js';
import { MOUTH_WIDE } from './mouth-wide.js';
import { NOSE_DOT } from './nose-dot.js';
import { HEADS } from './heads.js';
import { EYE_SETS } from './eyes.js';
import { BROW_SETS } from './brows.js';
import { NOSES } from './noses.js';
import { MOUTHS } from './mouths.js';
import { EAR_SETS } from './ears.js';
import { HAIR_STYLES } from './hair.js';
import { FACIAL_HAIR } from './facial-hair.js';
import { ACCESSORIES } from './accessories.js';

export const BUILTIN_FACE_PARTS = Object.freeze([...HEADS, ...EYE_SETS, ...BROW_SETS, NOSE_DOT, ...NOSES, MOUTH_SIMPLE, MOUTH_WIDE, ...MOUTHS, ...EAR_SETS, ...HAIR_STYLES, ...FACIAL_HAIR, ...ACCESSORIES]);
