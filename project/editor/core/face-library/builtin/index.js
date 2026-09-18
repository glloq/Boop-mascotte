/**
 * The assets the editor ships (docs/FACE_PART_LIBRARY.md): the basic face
 * library of the roadmap (PR 6), a few of each part, all drawn in the
 * template face's frame so the same reference boxes fit them onto any face.
 * One file per category; the V1 library of the roadmap (phase 45) grows
 * these files. `animals/`, `robots/` and `birds/` are the Soft Cartoon packs
 * (MASC-10B, MASC-11B, MASC-12B), each kept together because such a face is a
 * set rather than one more of each.
 *
 * The **eyes** are three builds and the **mouth** is one card, where they used to
 * be twenty-one and five: what told the retired ones apart was a size, a palette
 * and a movement, which is the scale field, the palette and the controls
 * (docs/EYE_BUILDS.md, docs/MOUTH_BUILD.md). The packs' own eyes and human mouths
 * went with them; their beaks, their ω and their grilles stayed, because those
 * are different constructions rather than this one at another radius.
 */
import { MOUTH_FULL } from './mouth-full.js';
import { NOSE_DOT } from './nose-dot.js';
import { HEADS } from './heads.js';
import { EYE_SETS } from './eyes.js';
import { BROW_SETS } from './brows.js';
import { NOSES } from './noses.js';
import { EAR_SETS } from './ears.js';
import { HAIR_STYLES } from './hair.js';
import { FACIAL_HAIR } from './facial-hair.js';
import { ACCESSORIES } from './accessories.js';
import { ANIMAL_FACE_PARTS } from './animals/index.js';
import { ROBOT_FACE_PARTS } from './robots/index.js';
import { BIRD_FACE_PARTS } from './birds/index.js';

export const BUILTIN_FACE_PARTS = Object.freeze([...HEADS, ...EYE_SETS, ...BROW_SETS, NOSE_DOT, ...NOSES, MOUTH_FULL, ...EAR_SETS, ...HAIR_STYLES, ...FACIAL_HAIR, ...ACCESSORIES, ...ANIMAL_FACE_PARTS, ...ROBOT_FACE_PARTS, ...BIRD_FACE_PARTS]);
