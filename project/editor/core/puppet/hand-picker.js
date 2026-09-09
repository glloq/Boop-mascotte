/**
 * Which drawing a hand is showing, picked on the canvas
 * (docs/HANDS_2D.md, docs/DIRECT_CONTROLS.md).
 *
 * ```text
 *        ┌ the face ┐
 *   ▣    │          │        ▣  the drawings, beside the face, on the hand's
 *   ▣    └──────────┘        ▣  own side: which picture this hand is
 *   ▣  ▲    ╭─────╮      ▲   ▣
 *      │ ╭──┤ ✋  ├──╮   │      the slider that brings it out, as it was
 *        ╰─────────────╯
 *            ▬▬▬▬▬            the turn, as it was
 *            ▬▬▬▬▬            and how far this picture's animation has played
 * ```
 *
 * A hand made of drawings has no fingers to curl and no angle to slide: it
 * **is** one of a handful of pictures. The quickest way to say which is to
 * show them, so every cell holds the drawing it selects, drawn by the same
 * generator that drew the hand — a name says which drawing you asked for, only
 * the drawing says which one you got.
 *
 * A press writes one parameter. It goes through the same channel every other
 * control on the canvas uses, so picking a hand keys with Auto Key on and
 * lands in an expression while one is being shaped, without this knowing.
 *
 * Pure: it reads the document and reports cells; the canvas draws them.
 */
import { DEFAULT_HAND_DRAWING, handDrawingAnim, handDrawingId, handDrawingName } from '../../../runtime/hand-vocabulary.js';
import { handDrawingFromValues } from '../../../runtime/runtime.js';
import { handReachEllipse } from '../hands/hand-model.js';
import { handSetDrawings } from '../hands/hand-sprite-install.js';
import { handShowParameter } from '../sample/hand-feature.js';
import { HAND_CONSOLE_GATE, handDrawnAnchor } from './hand-handles.js';
import { handPickerLayout } from './hand-console.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * The cells for one hand, or `null` when it has no drawings to pick between.
 *
 * `values` are the live ones, so a cell knows whether it is the one showing.
 * A hand still resting behind the head has no picker: a column of pictures
 * beside a hand nobody can see is the same clutter around nothing the rest of
 * the console is gated on, and the slider that brings it out is ungated.
 *
 * @returns {{side, group, cells: object[]}|null}
 */
export function handPickerModel(document = {}, side = 'left', values = {}) {
  const hand = document?.hands?.[side];
  const sprites = hand?.sprites;
  if (!sprites || !document?.elements?.[hand.element]) return null;
  const show = handShowParameter(side);
  if (show in (document.params || {}) && number(values[show], 0) <= HAND_CONSOLE_GATE) return null;

  const drawn = sprites.drawings.map((drawing) => drawing.id);
  // Every hand the generator can draw, not only the ones this set already has:
  // a column with one cell in it is not a picker, and "as easily as possible"
  // means the hand you want is one press away whether it is drawn yet or not.
  const offered = handSetDrawings(document, side);
  const ellipse = handReachEllipse(hand, document.elements);
  const anchor = handDrawnAnchor(hand, document.elements);
  const rest = ellipse ? { x: ellipse.cx, y: ellipse.cy } : anchor;
  const reach = ellipse ? { x: ellipse.rx, y: ellipse.ry } : hand.reach;
  const layout = handPickerLayout({ rest, reach, side, drawings: offered.length });

  const showing = handDrawingFromValues(hand, values);
  const label = side === 'right' ? 'Right hand' : 'Left hand';

  const cells = offered.map((item, index) => {
    const name = handDrawingName(item.id, sprites.drawings);
    const doing = handDrawingAnim(item.id, sprites.drawings);
    return {
      id: `hand-${side}-pick-${item.id}`, kind: 'drawing', side, drawing: item.id,
      label: `${label}: ${name}`,
      hint: item.drawn
        ? (doing ? `Show the ${name.toLowerCase()} hand — it can ${doing.toLowerCase()}` : `Show the ${name.toLowerCase()} hand`)
        : `Draw the ${name.toLowerCase()} hand and show it`,
      // A picture the hand already has is a choice; one it has not is an offer,
      // and pressing it draws the picture before showing it. Either way it is
      // one press, which is the whole point of a picker.
      parameter: item.drawn ? hand.parameters.drawing : null,
      value: item.drawn ? drawn.indexOf(item.id) : null,
      offer: !item.drawn,
      active: item.drawn && item.id === showing, disabled: false,
      cell: layout.drawings[index]
    };
  }).filter((entry) => entry.cell && entry.cell.size > 0);

  return cells.length ? { side, group: `hand-${side}`, cells } : null;
}

/** Both hands' pickers, in side order; a hand without drawings simply has none. */
export function handPickerOverlay(document = {}, values = {}) {
  return ['left', 'right'].map((side) => handPickerModel(document, side, values)).filter(Boolean);
}

/**
 * What a press on a cell writes, or `null` when the press is not a value at
 * all -- an offer draws its picture first, and only then is there an index to
 * write (`handPickerOffer`).
 */
export const handPickerChange = (cell) => (cell && cell.parameter && !cell.disabled ? { [cell.parameter]: cell.value } : null);

/** The picture a press has to draw before it can show it, or `null`. */
export const handPickerOffer = (cell) => (cell?.offer && !cell.disabled ? { side: cell.side, drawing: cell.drawing } : null);

/** The picture a cell stands for, for a caller that wants the id rather than the index. */
export const handPickerDrawing = (cell) => handDrawingId(cell?.drawing) || DEFAULT_HAND_DRAWING;
