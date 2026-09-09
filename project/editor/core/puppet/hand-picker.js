/**
 * Which style a hand is showing, picked on the canvas
 * (docs/HAND_STYLES.md, docs/DIRECT_CONTROLS.md).
 *
 * ```text
 *        ┌ the face ┐
 *   ▣    │          │        ▣  the styles, beside the face, on the hand's
 *   ▣    └──────────┘        ▣  own side: which drawing this hand is
 *   ▣  ▲    ╭─────╮      ▲   ▣
 *      │ ╭──┤ ✋  ├──╮   │      the slider that brings it out
 *        ╰─────────────╯
 *            ▬▬▬▬▬            the turn
 * ```
 *
 * A hand has no fingers to curl and no angle to slide: it **is** one of a
 * handful of drawings. The quickest way to say which is to show them, so every
 * cell holds the drawing it selects — a name says which hand you asked for,
 * only the drawing says which one you got.
 *
 * A press writes one parameter. It goes through the same channel every other
 * control on the canvas uses, so picking a hand keys with Auto Key on and lands
 * in an expression while one is being shaped, without this knowing.
 *
 * Pure: it reads the document and reports cells; the canvas draws them.
 */
import { DEFAULT_HAND_STYLE, handStyleId, handStyleLabel } from '../../../runtime/hand-vocabulary.js';
import { handStyleFromValues } from '../../../runtime/runtime.js';
import { handReachEllipse } from '../hands/hand-model.js';
import { handStyleOffers } from '../hands/hand-style-install.js';
import { handShowParameter } from '../sample/hand-feature.js';
import { HAND_CONSOLE_GATE, handDrawnAnchor } from './hand-handles.js';
import { handPickerLayout } from './hand-console.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * The cells for one hand, or `null` when it has no styles to pick between.
 *
 * `values` are the live ones, so a cell knows whether it is the one showing.
 * A hand still resting behind the head has no picker: a column of drawings
 * beside a hand nobody can see is clutter around nothing.
 *
 * @returns {{side, group, cells: object[]}|null}
 */
export function handPickerModel(document = {}, side = 'left', values = {}) {
  const hand = document?.hands?.[side];
  const styles = hand?.styles;
  if (!styles || !document?.elements?.[hand.element]) return null;
  const show = handShowParameter(side);
  if (show in (document.params || {}) && number(values[show], 0) <= HAND_CONSOLE_GATE) return null;

  const drawn = styles.library.map((entry) => entry.id);
  // Every style the library can draw, not only the ones this hand already has:
  // a column with one cell in it is not a picker, and "as easily as possible"
  // means the hand you want is one press away whether it is drawn yet or not.
  const offered = handStyleOffers(document, side);
  const ellipse = handReachEllipse(hand, document.elements);
  const anchor = handDrawnAnchor(hand, document.elements);
  const rest = ellipse ? { x: ellipse.cx, y: ellipse.cy } : anchor;
  const reach = ellipse ? { x: ellipse.rx, y: ellipse.ry } : hand.reach;
  const layout = handPickerLayout({ rest, reach, side, drawings: offered.length });

  const showing = handStyleFromValues(hand, values);
  const label = side === 'right' ? 'Right hand' : 'Left hand';

  const cells = offered.map((item, index) => {
    const name = handStyleLabel(item.id, styles.library);
    return {
      id: `hand-${side}-pick-${item.id}`, kind: 'style', side, style: item.id,
      label: `${label}: ${name}`,
      hint: item.drawn ? `Show the ${name.toLowerCase()} hand` : `Draw the ${name.toLowerCase()} hand and show it`,
      // A drawing the hand already has is a choice; one it has not is an offer,
      // and pressing it draws the drawing before showing it. Either way it is
      // one press, which is the whole point of a picker.
      parameter: item.drawn ? hand.parameters.style : null,
      value: item.drawn ? drawn.indexOf(item.id) : null,
      offer: !item.drawn,
      active: item.drawn && item.id === showing, disabled: false,
      cell: layout.drawings[index]
    };
  }).filter((entry) => entry.cell && entry.cell.size > 0);

  return cells.length ? { side, group: `hand-${side}`, cells } : null;
}

/** Both hands' pickers, in side order; a hand without styles simply has none. */
export function handPickerOverlay(document = {}, values = {}) {
  return ['left', 'right'].map((side) => handPickerModel(document, side, values)).filter(Boolean);
}

/**
 * What a press on a cell writes, or `null` when the press is not a value at
 * all -- an offer draws its drawing first, and only then is there an index to
 * write (`handPickerOffer`).
 */
export const handPickerChange = (cell) => (cell && cell.parameter && !cell.disabled ? { [cell.parameter]: cell.value } : null);

/** The style a press has to draw before it can show it, or `null`. */
export const handPickerOffer = (cell) => (cell?.offer && !cell.disabled ? { side: cell.side, style: cell.style } : null);

/** The style a cell stands for, for a caller that wants the id rather than the index. */
export const handPickerStyle = (cell) => handStyleId(cell?.style) || DEFAULT_HAND_STYLE;
