/**
 * The assets the editor ships (docs/FACE_PART_LIBRARY.md).
 *
 * Three, on purpose: enough to prove the registry on a category with optional
 * roles (a mouth with and without teeth) and on a single-shape category, and
 * no more until the parts can be installed. The V1 library of the roadmap
 * (phase 45) grows this list, one file per asset, drawn in the template
 * face's frame so the same reference boxes fit them onto any face.
 */
import { MOUTH_SIMPLE } from './mouth-simple.js';
import { MOUTH_WIDE } from './mouth-wide.js';
import { NOSE_DOT } from './nose-dot.js';

export const BUILTIN_FACE_PARTS = Object.freeze([MOUTH_SIMPLE, MOUTH_WIDE, NOSE_DOT]);
