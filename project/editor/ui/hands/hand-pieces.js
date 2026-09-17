/**
 * What a piece is, on Design ▸ Hands (docs/HAND_STYLES.md).
 *
 * The canvas knows SVG elements; it does not know that a palm, four fingers
 * and a thumb are one drawing of one hand. On the screen where hands are
 * designed, a click has to land on the drawing -- which is the thing an author
 * can use, duplicate, mirror, rename or delete -- and a double-click steps
 * inside it to the layer whose points they want to drag.
 *
 * This used to come from the Character Builder, which derived it from the face
 * library's visual rows: every named part of a mascot, hands among them. It is
 * the hands' own now (V5-07), and it is smaller for it -- a hand is two
 * generations deep and the document already says which drawings each hand has,
 * so nothing has to be inferred from a library that a mascot made of pictures
 * does not have.
 *
 * Pure over plain data. The writing is the caller's: this says *which* element
 * a gesture is about, never what to do to it.
 */
import { layerParents } from '../../core/face-library/face-layout.js';
import { handStateElementId } from '../../core/hands/hand-state-model.js';
import { handElementId } from '../../core/hands/hand-style-art.js';
import { HAND_SIDES } from '../../core/hands/hand-model.js';

/**
 * Every element on this mascot that is a hand or one of a hand's drawings.
 *
 * Both, because both are things a person handles: the hand is what moves and
 * the drawing is what it shows. A hand with no drawings is still a hand.
 */
export function handPieceIds(document = {}) {
  const ids = new Set();
  for (const side of HAND_SIDES) {
    const hand = document.hands?.[side];
    if (!hand) continue;
    ids.add(hand.element || handElementId(side));
    for (const entry of hand.styles?.library || []) {
      const id = typeof entry === 'string' ? entry : entry?.id;
      if (id) ids.add(handStateElementId(side, id));
    }
  }
  // Only the ones actually drawn: a library entry whose artwork was deleted is
  // a name, and resolving a click onto a name selects nothing.
  return new Set([...ids].filter((id) => document.elements?.[id]));
}

/**
 * The piece model the canvas takes, for the hands surface.
 *
 * `resolve` answers with the piece a click means, `contains` whether one piece
 * is inside another (which is how the canvas knows a double-click stepped
 * inside rather than sideways), and `commit` hands a finished drag back.
 *
 * @param {object} deps
 * @param {() => object} deps.document
 * @param {(id: string, transform: object) => boolean} deps.writeTransform
 */
export function createHandPieceModel({ document, writeTransform }) {
  // Derived per call rather than cached: a drawing added, duplicated or
  // deleted changes both maps, and the alternative is an invalidation rule
  // that has to be remembered at six call sites.
  const maps = () => { const doc = document() || {}; return { pieces: handPieceIds(doc), parents: layerParents(doc.layers) }; };

  /** The nearest hand or hand drawing at or above this element; the element itself if there is none. */
  function resolve(id) {
    if (!id) return id;
    const { pieces, parents } = maps();
    for (let at = id, seen = new Set(); at && !seen.has(at); at = parents[at]) {
      seen.add(at);
      if (pieces.has(at)) return at;
    }
    return id;
  }

  /** Whether `id` is drawn inside `root`. A piece never contains itself. */
  function contains(root, id) {
    if (!root || !id || root === id) return false;
    const { parents } = maps();
    for (let at = parents[id], seen = new Set(); at && !seen.has(at); at = parents[at]) {
      seen.add(at);
      if (at === root) return true;
    }
    return false;
  }

  return {
    resolve,
    contains,
    commit: (id, transform) => writeTransform(resolve(id), transform)
  };
}
