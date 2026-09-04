import { MASCOT_FACE_SVG } from './face-artwork.js';
export { applyTemplateProject } from './template-project.js';

/**
 * One template. Three starter faces meant three sets of artwork to keep rigged,
 * and the two extra ones were strictly smaller than this one; what a beginner
 * needs is a complete face they can strip down.
 */
export const MASCOT_TEMPLATE = Object.freeze({ id: 'mascot-face', name: 'Mascot Face', svg: MASCOT_FACE_SVG, kind: 'basic' });
export const PROJECT_TEMPLATES = Object.freeze({ basic: MASCOT_TEMPLATE });
