/**
 * The hands, in the builder (docs/CHARACTER_BUILDER.md, docs/HAND_STYLES.md).
 *
 * A hand is placed like any piece -- its artwork's position, turn and size
 * are the fields every piece has -- and the rig adds its own movement on top
 * of them every frame (`carry`, in `runtime/hands.js`). What is the hand's
 * alone is its depth, the mirror of its placement onto the other side, the
 * drawings it can show, and the door to its anchor and its reach (roadmap
 * phases 17, 18 and 19): the rest of the hand model stays in Hand setup,
 * untouched.
 */
import { partDragPayload } from './part-drag.js';
import { handStylePresets } from '../../core/puppet/hand-handles.js';
import { HAND_STYLE_PIVOT as handStylePivot, handStyleElementId, handStyleLabel, handStyleThumbnail, handStyleViewBox } from '../../core/hands/hand-style-art.js';
import { handDrawingIsCustom } from '../../core/hands/hand-drawing.js';
import { installedHandLook } from '../../core/sample/hand-feature.js';
import { esc } from '../escape-html.js';

const number = (value, digits = 2) => { const n = Number(value); return Number.isFinite(n) ? String(Math.round(n * 10 ** digits) / 10 ** digits) : '0'; };

export const HAND_LABELS = Object.freeze({ left: 'Left hand', right: 'Right hand' });
export const OTHER_HAND = Object.freeze({ left: 'right', right: 'left' });

/** One drawing as a picture, in a box of its own: the picker's thumbnail, id-free. */
const handThumbnail = (side, style, look) =>
  `<svg viewBox="${handStyleViewBox()}" class="hand-thumb" aria-hidden="true" focusable="false">${handStyleThumbnail(side, style, { at: { x: handStylePivot()[0], y: handStylePivot()[1] }, size: 2 * handStylePivot()[0] * 0.86, look })}</svg>`;

/**
 * Both sides, whether or not the mascot has them.
 *
 * `styles` is the hand's drawings as cards (docs/HAND_STYLES.md, "The
 * library"): the six the registry knows, each drawn on this hand or not, one
 * of them the one it rests on, with a picture of each.
 *
 * @returns {{ side: string, label: string, element: string|null, style: string|null, styleCount: number, depth: number, resting: string|null, styles: { id: string, name: string, drawn: boolean, resting: boolean, thumb: string }[] }[]}
 */
export function describeHands(document = {}, { pictures = true, drawings = pictures } = {}) {
  // The pictures are for the cards only: a reader of sides, depths and drawings
  // asks without them. `drawings` is the other half of that bargain -- whether
  // each drawing has been reshaped, which costs a signature apiece and is asked
  // for by the panels that offer to put the set's drawing back.
  const look = pictures ? installedHandLook(document) : null;
  return ['left', 'right'].map((side) => {
    const hand = document.hands?.[side];
    const element = hand?.element && document.elements?.[hand.element] ? hand.element : null;
    const showing = hand?.styles?.showing || null;
    const styles = element && hand?.styles ? handStylePresets(document, side).map((style) => ({
      id: style.id, name: style.name, drawn: Boolean(style.added), resting: style.id === showing,
      element: handStyleElementId(side, style.id),
      // Whether an author has reshaped this drawing, so the row can say so and
      // offer the set's own back (docs/HAND_STYLES.md, "A gesture is a file").
      // Only for what is drawn, and only when somebody asked: a reader of sides
      // and depths does not pay for eight signatures a hand.
      custom: Boolean(drawings && style.added && handDrawingIsCustom(document, side, style.id) === true),
      thumb: pictures ? handThumbnail(side, style.id, look) : ''
    })) : [];
    return { side, label: HAND_LABELS[side], element, style: showing ? (handStyleLabel(showing) || showing) : null, styleCount: hand?.styles?.library?.length || 0, depth: Number(hand?.depth) || 0, resting: showing, styles };
  });
}

/** A hand's drawings as cards: the one it rests on marked, one not drawn yet offered. */
export function handStyleCardsMarkup(hand) {
  if (!hand?.element || !hand.styles?.length) return '';
  const title = (style) => (style.resting ? `${style.name}: what ${hand.label.toLowerCase()} rests on` : style.drawn ? `Rest ${hand.label.toLowerCase()} on ${style.name}` : `${style.name} is not drawn on this hand yet: press to draw it and rest on it`);
  const badge = (style) => (style.resting ? '<span class="part-style-badge">Resting</span>' : style.drawn ? '' : '<span class="part-style-badge part-style-offer-badge">Draw</span>');
  const cards = hand.styles.map((style) => `<button type="button" class="part-style hand-style${style.resting ? ' part-style-current' : ''}${style.drawn ? '' : ' hand-style-offer'}" data-hand-style="${esc(hand.side)}:${esc(style.id)}" aria-pressed="${style.resting}" title="${esc(title(style))}" draggable="true" data-drag="${esc(partDragPayload('hand-style', `${hand.side}:${style.id}`))}"><span class="part-style-thumb hand-style-thumb">${style.thumb}</span><span class="part-style-name">${esc(style.name)}</span>${badge(style)}</button>`).join('');
  return `<h4 class="hand-styles-heading">${esc(hand.label)} · drawings</h4><div class="part-styles hand-styles" role="group" aria-label="Drawings of the ${esc(hand.label.toLowerCase())}" data-hand-styles="${esc(hand.side)}">${cards}</div>`;
}

/** The Hands category, opened in the browser: the pair as chips, their drawings as cards, and the way to their setup. */
export function handRowsMarkup(hands = [], { selectedId = null } = {}) {
  const present = hands.filter((hand) => hand.element);
  if (!present.length) return '<p class="small">No hands yet. A pair is drawn and rigged in one press.</p><button type="button" class="secondary" data-character-route="hand-setup">Draw a pair of hands…</button>';
  const chips = present.map((hand) => `<button type="button" class="chip${hand.element === selectedId ? ' chip-active' : ''}" data-part-piece="${esc(hand.element)}" aria-pressed="${hand.element === selectedId}">${esc(hand.label)}</button>`).join('');
  return `<div class="part-pieces" role="group" aria-label="Hands">${chips}</div><p class="small">Pick a hand: its position, turn, size and depth are on the right, and the rig moves it from there. Below, the drawings each hand can show: press one to rest the hand on it. Anchor and reach are in Hand setup.</p>${present.map(handStyleCardsMarkup).join('')}<button type="button" class="secondary" data-character-route="hand-setup">Hand setup…</button>`;
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
  return `${handDrawingsMarkup(hand)}<h4>Depth</h4><div class="part-fields"><label>Depth<input type="number" step="0.05" min="-1" max="1" data-hand-depth aria-label="Depth, from behind the head to in front" value="${number(hand.depth)}"></label></div>
    <p class="small" data-hand-placement="${esc(hand.side)}">−1 rests behind the head, 1 in front. The rig moves ${esc(hand.label.toLowerCase())} from where it is put here: its reach, its turn and its size ride on top. ${drawing}</p>
    <div class="action-row">${mirror}<button type="button" class="secondary" data-character-route="hand-setup">Anchor, reach and drawings…</button></div>
    <p class="small" data-hand-mirror-note>Mirror placement makes ${esc(otherLabel.toLowerCase())} the mirror image of this one: place, turn, size, depth, anchor and reach, as one undo step. Its drawings stay its own.</p>`;
}

/**
 * The drawings of the hand in hand, each one openable
 * (docs/HAND_STYLES.md, "A gesture is a file").
 *
 * This is what the layers bought. A drawing used to be one path with nothing
 * inside it, so there was nothing to edit and the row would have said nothing;
 * it is a group of named layers now, and **Edit** puts the author inside one
 * with the vector tools, the rest of the mascot out of the way. A drawing the
 * hand is not resting on is hidden behind the one it is -- it is revealed
 * while it is the thing being edited, which is session chrome and not the
 * document.
 *
 * **The set's drawing** is offered only once a drawing has actually been
 * reshaped: an author who has changed nothing is not asked whether they meant
 * to.
 */
export function handDrawingsMarkup(hand) {
  const drawings = (hand?.styles || []).filter((style) => style.drawn);
  if (!drawings.length) return '';
  const rows = drawings.map((style) => {
    const name = `${esc(style.name)}${style.resting ? ' <span class="part-style-badge">Resting</span>' : ''}${style.custom ? ' <span class="part-style-badge part-style-mine">Reshaped</span>' : ''}`;
    const restore = style.custom
      ? `<button type="button" class="secondary" data-hand-drawing-restore="${esc(style.id)}" title="The set's ${esc(style.name)} drawn again, where this one is">Restore the set's drawing</button>`
      : '';
    return `<div class="hand-drawing-row" data-hand-drawing-row="${esc(style.id)}"><span class="hand-drawing-name">${name}</span>`
      + `<button type="button" data-hand-drawing-edit="${esc(style.id)}" aria-label="Edit the ${esc(style.name)} drawing of the ${esc(hand.label.toLowerCase())}">✎ Edit</button>${restore}</div>`;
  }).join('');
  return `<h4>Drawings</h4><div class="hand-drawings" role="group" aria-label="Drawings of the ${esc(hand.label.toLowerCase())}">${rows}</div>`
    + `<p class="small">Each drawing is a palm, its fingers and a thumb, as separate layers. Edit opens one in Artwork with the rest of the mascot out of the way — a drawing the hand is not resting on is shown while you are inside it. Reshaping one never moves the hand.</p>`;
}
