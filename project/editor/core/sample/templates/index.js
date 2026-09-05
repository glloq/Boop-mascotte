import { MASCOT_FACE_SVG } from './face-artwork.js';
export { applyTemplateProject } from './template-project.js';

/**
 * One template. Three starter faces meant three sets of artwork to keep rigged,
 * and the two extra ones were strictly smaller than this one; what a beginner
 * needs is a complete face they can strip down.
 */
export const MASCOT_TEMPLATE = Object.freeze({ id: 'mascot-face', name: 'Mascot Face', svg: MASCOT_FACE_SVG, kind: 'basic' });
/**
 * Nothing drawn yet: an empty working area the same size as the template's,
 * for a mascot made from scratch with the shape tools. It carries no rig at
 * all — Face Setup starts from the artwork that gets drawn.
 */
export const BLANK_TEMPLATE = Object.freeze({ id: 'blank-canvas', name: 'Blank canvas', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"></svg>', kind: 'blank' });
export const PROJECT_TEMPLATES = Object.freeze({ basic: MASCOT_TEMPLATE, blank: BLANK_TEMPLATE });

/**
 * The rig of a blank canvas: one resting state and nothing bound to it. That is
 * the least a project needs to validate, save and export — a rig with no state
 * at all reports "active state null does not exist" — and it is what Face Setup
 * builds on once something is drawn.
 */
export function applyBlankProject(state) {
  state.params = {};
  state.states = { idle: {} };
  state.transitions = { idle: [] };
  state.activeState = 'idle';
  state.stateConstraints = { idle: { ...(state.globalConstraints || {}) } };
  state.semanticParts = {};
  state.animationClips = [];
  state.animationEditor = { activeClipId: null, playhead: 0, panel: 'preview' };
  return state;
}
