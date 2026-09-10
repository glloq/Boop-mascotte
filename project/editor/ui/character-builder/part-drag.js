/**
 * A card dragged onto the mascot (docs/CHARACTER_BUILDER.md, "Drag & drop").
 *
 * The browser's cards are buttons: a press puts the style on. A drag is the
 * same press told through the drag data instead. The card writes what it is
 * -- a library asset, or a drawing of one hand -- as one string; the canvas
 * reads it back on the drop; the builder runs the command the press runs.
 * Nothing but that string crosses, and this module is both ends of it, so
 * the browser and the drop target agree by construction.
 *
 * ```text
 * face-part:eyes.cartoon      a library asset, by id
 * hand-style:left:fist        a drawing of one hand: the side, then the style
 * ```
 */
import { HAND_SIDES } from '../../../runtime/hand-vocabulary.js';

/** The drag's own type: a drop that carries it is a card's; anything else (a file, text) is left alone. */
export const PART_DRAG_TYPE = 'application/x-boop-character-part';

const KINDS = Object.freeze(['face-part', 'hand-style']);

/**
 * @param {'face-part'|'hand-style'} kind
 * @param {string} id  the asset id, or `side:style` for a hand's drawing
 * @returns {string}
 */
export function partDragPayload(kind, id) {
  return `${kind}:${id}`;
}

/**
 * @param {string} text
 * @returns {{ kind: 'face-part', id: string } | { kind: 'hand-style', id: string, side: string, style: string } | null}
 */
export function parsePartDrag(text) {
  const match = /^([a-z-]+):(.+)$/.exec(String(text || '').trim());
  if (!match || !KINDS.includes(match[1])) return null;
  const [, kind, rest] = match;
  if (kind === 'hand-style') {
    const [side, style, ...more] = rest.split(':');
    if (!HAND_SIDES.includes(side) || !style || more.length) return null;
    return { kind, id: `${side}:${style}`, side, style };
  }
  return { kind, id: rest };
}

/** Whether a drag over the canvas carries a card: the types are readable before the drop, the data is not. */
export function carriesPart(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes(PART_DRAG_TYPE);
}

/** What a drop carries, or null when it is not a card's. */
export function readPartDrag(dataTransfer) {
  if (typeof dataTransfer?.getData !== 'function') return null;
  return parsePartDrag(dataTransfer.getData(PART_DRAG_TYPE));
}

/**
 * Put a card on a drag: its type for the canvas, plain text for anywhere
 * else it might land, and a copy cursor (the card stays in the browser).
 *
 * @returns {boolean} whether the transfer took it
 */
export function writePartDrag(dataTransfer, payload) {
  if (typeof dataTransfer?.setData !== 'function' || !parsePartDrag(payload)) return false;
  dataTransfer.setData(PART_DRAG_TYPE, payload);
  try { dataTransfer.setData('text/plain', payload); } catch { /* a transfer that takes one type keeps the one that matters */ }
  try { dataTransfer.effectAllowed = 'copy'; } catch { /* read-only on some transfers */ }
  return true;
}
