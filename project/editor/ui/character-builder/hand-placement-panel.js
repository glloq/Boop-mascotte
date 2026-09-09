/**
 * The hands, in the builder (docs/CHARACTER_BUILDER.md, docs/HAND_STYLES.md).
 *
 * A hand is placed by its anchor and its reach and moved by the rig every
 * frame, so the builder does not offer its artwork a position: a number
 * written there would be written over by the next frame. What it offers is
 * the pair -- pick one, recolour it, reshape it -- and the door to where the
 * placement is set up. The simple placement panel of the roadmap (PR 12)
 * grows from here; nothing about the hand model changes for it.
 */
import { handStyleLabel } from '../../../runtime/hand-vocabulary.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export const HAND_LABELS = Object.freeze({ left: 'Left hand', right: 'Right hand' });

/**
 * Both sides, whether or not the mascot has them.
 *
 * @returns {{ side: string, label: string, element: string|null, style: string|null, styleCount: number }[]}
 */
export function describeHands(document = {}) {
  return ['left', 'right'].map((side) => {
    const hand = document.hands?.[side];
    const element = hand?.element && document.elements?.[hand.element] ? hand.element : null;
    const showing = hand?.styles?.showing || null;
    return { side, label: HAND_LABELS[side], element, style: showing ? (handStyleLabel(showing) || showing) : null, styleCount: hand?.styles?.library?.length || 0 };
  });
}

/** The Hands category, opened in the browser: the pair as chips, and the way to their setup. */
export function handRowsMarkup(hands = [], { selectedId = null } = {}) {
  const present = hands.filter((hand) => hand.element);
  if (!present.length) return '<p class="small">No hands yet. A pair is drawn and rigged in one press.</p><button type="button" class="secondary" data-character-route="hand-setup">Draw a pair of hands…</button>';
  return `<div class="part-pieces" role="group" aria-label="Hands">${present.map((hand) => `<button type="button" class="chip${hand.element === selectedId ? ' chip-active' : ''}" data-part-piece="${esc(hand.element)}" aria-pressed="${hand.element === selectedId}">${esc(hand.label)}</button>`).join('')}</div><p class="small">A hand is placed by its anchor and reach, and the rig moves it. Set that up in Face Setup.</p><button type="button" class="secondary" data-character-route="hand-setup">Hand setup…</button>`;
}

/** What the inspector says about a hand in place of a position. */
export function handPlacementMarkup(hand) {
  if (!hand) return '';
  const drawing = hand.style ? `It shows its <b>${esc(hand.style)}</b> drawing${hand.styleCount ? `, one of ${hand.styleCount}` : ''}.` : (hand.styleCount ? `It has ${hand.styleCount} drawings.` : 'It has no drawings yet.');
  return `<h4>Placement</h4><p class="small" data-hand-placement="${esc(hand.side)}">${esc(hand.label)} hangs from its anchor and stays within its reach; the rig moves it, so its position is not a number to type here. ${drawing}</p><button type="button" class="secondary" data-character-route="hand-setup">Anchor, reach and drawings…</button>`;
}
