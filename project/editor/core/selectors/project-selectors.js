/**
 * The project ViewModels (VNX-04).
 *
 * One module the UI can import instead of five, and one place where the shapes
 * a panel consumes are written down. Every function here is pure over a
 * ProjectDocument, and none of them does any arithmetic of its own: the derive
 * functions in `core/validation` and `core/puppet` are the truth, and a
 * selector either calls one or assembles what a panel needs from several. The
 * one computation that is spelt out below -- the project shell -- is spelt out
 * because it had no home at all; it lived inline in `renderProjectUi()`.
 *
 * Memoisation is deliberately not baked in: these stay callable directly (a
 * test, a diagnostic, an export), and `createProjectSelectors()` is the same
 * set wrapped in a revision cache for the editor to hold.
 */
import { createSelector } from './create-selector.js';
import { deriveSetupSections } from '../validation/setup-sections.js';
import { deriveTaskReadiness, worstStatus } from '../validation/task-readiness.js';
import { deriveGuide } from '../validation/guide.js';
import { handleBoardModel } from '../puppet/handle-model.js';
import { FACE_FEATURES, describeFaceFeature } from '../sample/face-features.js';
import { areHandsInstalled } from '../sample/hand-feature.js';

/** The four the home screen grades, in the order it shows them. */
const CORE_PARTS = Object.freeze([['head', 'Face'], ['eyes', 'Eyes'], ['gaze', 'Gaze'], ['mouth', 'Mouth']]);

/**
 * What the project menu and the home screen show about the project as a whole:
 * is there artwork, which optional features are already in, can more be added,
 * and how far the four core parts got.
 *
 * @returns {{loaded:boolean, features:Record<string,{installed:boolean, available:boolean, reason:string|null}>,
 *            featureCompatible:boolean, core:{label:string, ready:boolean}[]}}
 */
export function selectProjectShell(document = {}) {
  const parts = Object.values(document.semanticParts || {});
  // Complete, not merely present: a part whose roles point at artwork that was
  // deleted is a part the user still has work to do on.
  const ready = (type) => {
    const part = parts.find((item) => item.type === type), roles = part && Object.values(part.roles || {});
    return Boolean(roles?.length && roles.every((id) => document.elements?.[id]));
  };
  const head = parts.find((part) => part.type === 'head');
  // A face feature is drawn where the head is drawn and fitted to what it
  // measures, so what it needs is a head with artwork -- not the template's own
  // `faceRoot` group, which is what it used to insist on and is why adding a
  // part to a mascot somebody drew was refused.
  const featureCompatible = Boolean(document.elements?.[head?.roles?.head]);
  // Per feature: whether the mascot has it, whether pressing Add would work,
  // and why not when it would not. A card that says "+ Add" and then fails --
  // which is what Eyelids did on the template's own eyelids -- is the bug this
  // shape exists to make impossible.
  const feature = (id) => {
    const described = describeFaceFeature(document, id);
    if (described.installed || !described.available || featureCompatible) return described;
    return { ...described, available: false, reason: 'Assign the head in Face Setup first: a part is drawn on the face it joins.' };
  };
  return {
    loaded: Boolean(document.svgMarkup),
    features: {
      ...Object.fromEntries(Object.keys(FACE_FEATURES).map((id) => [id, feature(id)])),
      // Hands are drawn from nothing rather than fitted onto a starter face, so
      // they are offered whatever the artwork is.
      hands: (installed => ({ installed, available: !installed, reason: null }))(areHandsInstalled(document))
    },
    featureCompatible,
    core: CORE_PARTS.map(([type, label]) => ({ label, ready: ready(type) }))
  };
}

/** The collapsible headings of Face Setup, each graded without being opened. */
export const selectSetupSections = (document = {}) => deriveSetupSections(document);

/**
 * Task readiness, plus the one thing the editor adds on top of it: the workspace
 * tabs show a single mark for Face Setup, which covers two sections.
 *
 * Frozen because this ViewModel is shared by the badges, Preview, Problems and
 * Export, and compared by identity -- a consumer that edited it would make
 * every other consumer wrong without changing the revision it was cached under.
 *
 * @param {object} document
 * @param {object[]} issues the canonical `validateProject` issues
 */
export function selectReadiness(document = {}, issues = []) {
  const model = deriveTaskReadiness(document, issues);
  return Object.freeze({ ...model, faceSetupBadge: worstStatus(model.faceSetup.status, model.movements.status) });
}

/**
 * What to do next. Takes the readiness model rather than deriving its own, so
 * the guide bar and the badges can never disagree about the same project.
 */
export const selectGuide = (document = {}, readiness = selectReadiness(document)) => deriveGuide(document, readiness);

/**
 * Every control of the rig, grouped by layer, with where each axis is now.
 *
 * `values` are the live preview parameters, which move without the document
 * changing -- a caller memoising this has to say so in the key.
 */
export const selectHandleBoard = (document = {}, values = {}) => handleBoardModel(document, values);

export const PROJECT_SELECTORS = Object.freeze({
  projectShell: selectProjectShell,
  setupSections: selectSetupSections,
  readiness: selectReadiness,
  guide: selectGuide,
  handleBoard: selectHandleBoard
});

/**
 * The same set, each memoised on a revision token: `selectors.readiness(key,
 * document, issues)`. One set per editor, because the cache is one entry deep
 * and two callers on different revisions would evict each other.
 */
export function createProjectSelectors() {
  return Object.fromEntries(Object.entries(PROJECT_SELECTORS).map(([name, compute]) => [name, createSelector(compute)]));
}
