/**
 * What the vector tools are open on, in words (UIR-06,
 * docs/UIR_REFACTOR_BASELINE.md).
 *
 * ```text
 * Design / Hands / Left hand / Point          ← editing one state of one hand
 * Design / Face / Mouth                       ← editing one piece of the face
 * Design / Artwork                            ← the whole drawing
 * ```
 *
 * The canvas has always been able to limit an edit to one element -- the rest
 * of the mascot dimmed and inert, a shape drawn going inside it -- and it has
 * never been able to *say* so. An author who pressed **Edit SVG** on a hand's
 * Point drawing arrived in a workspace called Artwork with something selected,
 * and nothing on screen said which of four hand states they were inside or how
 * to get back out.
 *
 * A scope is a *view*, never data: it is derived from the element the canvas is
 * scoped to and the document it belongs to, and describing one writes nothing.
 * That is the whole reason it is a pure function -- there is no third place
 * holding "what am I editing" to come apart from the other two.
 */
import { HAND_LABELS } from './character-builder/hand-placement-panel.js';
import { handStateElementId, handStates } from '../core/hands/hand-state-model.js';

/** The scope an author is in, from the element the canvas is limited to. */
export function describeArtworkScope(document = {}, elementId = null) {
  if (!elementId) return { kind: 'face', id: null, crumbs: ['Design', 'Artwork'], label: 'the whole drawing', back: null };
  for (const side of ['left', 'right']) {
    const state = handStates(document, side).find((item) => handStateElementId(side, item.id) === elementId);
    if (!state) continue;
    return {
      kind: 'hand-state',
      id: elementId,
      side,
      stateId: state.id,
      crumbs: ['Design', 'Hands', HAND_LABELS[side], state.name],
      label: `${HAND_LABELS[side].toLowerCase()} · ${state.name}`,
      // A hand state is reached from Hands and nowhere else, so that is the way
      // back -- not the workspace the vector tools happen to live in.
      back: { mode: 'design.hands', label: 'Back to Hands' }
    };
  }
  const name = document.layerMetadata?.[elementId]?.name || elementId;
  return {
    kind: 'element',
    id: elementId,
    crumbs: ['Design', 'Artwork', name],
    label: name,
    back: { mode: 'design.face', label: 'Back to Face' }
  };
}

/** The breadcrumb over the canvas: where this is, and the way out of it. */
export function artworkScopeMarkup(scope) {
  if (!scope || scope.kind === 'face') return '';
  const crumbs = scope.crumbs.map((crumb, index) => `<span class="artwork-crumb"${index === scope.crumbs.length - 1 ? ' data-artwork-crumb-last' : ''}>${crumb}</span>`).join('<span class="artwork-crumb-sep" aria-hidden="true">/</span>');
  return `<span class="artwork-scope-what" data-artwork-scope-kind="${scope.kind}">Editing: ${crumbs}</span>`
    + (scope.back ? `<button type="button" class="secondary" data-artwork-scope-back="${scope.back.mode}">↩ ${scope.back.label}</button>` : '');
}
