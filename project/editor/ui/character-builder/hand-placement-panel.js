/**
 * The hands, in the builder (docs/CHARACTER_BUILDER.md, docs/HAND_STYLES.md).
 *
 * A hand is placed like any piece -- its artwork's position, turn and size
 * are the fields every piece has -- and the rig adds its own movement on top
 * of them every frame (`carry`, in `runtime/hands.js`). What is the hand's
 * alone is its depth, the mirror of its placement onto the other side, and
 * the door to its anchor, its reach and its drawings (roadmap phases 17 and
 * 19): the rest of the hand model stays in Hand setup, untouched.
 */
import { handStyleLabel } from '../../../runtime/hand-vocabulary.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value, digits = 2) => { const n = Number(value); return Number.isFinite(n) ? String(Math.round(n * 10 ** digits) / 10 ** digits) : '0'; };

export const HAND_LABELS = Object.freeze({ left: 'Left hand', right: 'Right hand' });
export const OTHER_HAND = Object.freeze({ left: 'right', right: 'left' });

/**
 * Both sides, whether or not the mascot has them.
 *
 * @returns {{ side: string, label: string, element: string|null, style: string|null, styleCount: number, depth: number }[]}
 */
export function describeHands(document = {}) {
  return ['left', 'right'].map((side) => {
    const hand = document.hands?.[side];
    const element = hand?.element && document.elements?.[hand.element] ? hand.element : null;
    const showing = hand?.styles?.showing || null;
    return { side, label: HAND_LABELS[side], element, style: showing ? (handStyleLabel(showing) || showing) : null, styleCount: hand?.styles?.library?.length || 0, depth: Number(hand?.depth) || 0 };
  });
}

/** The Hands category, opened in the browser: the pair as chips, and the way to their setup. */
export function handRowsMarkup(hands = [], { selectedId = null } = {}) {
  const present = hands.filter((hand) => hand.element);
  if (!present.length) return '<p class="small">No hands yet. A pair is drawn and rigged in one press.</p><button type="button" class="secondary" data-character-route="hand-setup">Draw a pair of hands…</button>';
  return `<div class="part-pieces" role="group" aria-label="Hands">${present.map((hand) => `<button type="button" class="chip${hand.element === selectedId ? ' chip-active' : ''}" data-part-piece="${esc(hand.element)}" aria-pressed="${hand.element === selectedId}">${esc(hand.label)}</button>`).join('')}</div><p class="small">Pick a hand: its position, turn, size and depth are on the right, and the rig moves it from there. Its anchor, its reach and its drawings are in Hand setup.</p><button type="button" class="secondary" data-character-route="hand-setup">Hand setup…</button>`;
}

/**
 * What the inspector adds under a hand's position, size and turn: its depth,
 * the mirror of its placement, and what it draws.
 *
 * @param {{ side, label, style, styleCount, depth, other: { label, present } }} hand
 */
export function handPlacementMarkup(hand) {
  if (!hand) return '';
  const drawing = hand.style ? `It shows its <b>${esc(hand.style)}</b> drawing${hand.styleCount ? `, one of ${hand.styleCount}` : ''}.` : (hand.styleCount ? `It has ${hand.styleCount} drawings.` : 'It has no drawings yet.');
  const otherLabel = hand.other?.label || HAND_LABELS[OTHER_HAND[hand.side]];
  const mirror = hand.other?.present
    ? `<button type="button" class="secondary" data-hand-mirror aria-label="Mirror the placement of ${esc(hand.label)} onto ${esc(otherLabel)}">Mirror placement</button>`
    : `<button type="button" class="secondary" data-hand-mirror disabled title="Draw the ${esc(otherLabel.toLowerCase())} first">Mirror placement</button>`;
  return `<h4>Depth</h4><div class="part-fields"><label>Depth<input type="number" step="0.05" min="-1" max="1" data-hand-depth aria-label="Depth, from behind the head to in front" value="${number(hand.depth)}"></label></div>
    <p class="small" data-hand-placement="${esc(hand.side)}">−1 rests behind the head, 1 in front. The rig moves ${esc(hand.label.toLowerCase())} from where it is put here: its reach, its turn and its size ride on top. ${drawing}</p>
    <div class="action-row">${mirror}<button type="button" class="secondary" data-character-route="hand-setup">Anchor, reach and drawings…</button></div>
    <p class="small" data-hand-mirror-note>Mirror placement makes ${esc(otherLabel.toLowerCase())} the mirror image of this one: place, turn, size, depth, anchor and reach, as one undo step. Its drawings stay its own.</p>`;
}
