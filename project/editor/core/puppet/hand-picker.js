/**
 * Which drawing a hand is showing, picked on the canvas
 * (docs/HANDS_2D.md, docs/DIRECT_CONTROLS.md).
 *
 * ```text
 *        ┌ the face ┐
 *   ▣    │          │        ▣  the poses, beside the face, on the hand's
 *   ▣    └──────────┘        ▣  own side: which *kind* of hand this is
 *   ▣  ▲    ╭─────╮      ▲   ▣
 *   ▣  │ ╭──┤ ✋  ├──╮   │   ▣  the slider that brings it out, as it was
 *        ╰─────────────╯
 *            ▬▬▬▬▬            the turn, as it was
 *        ▣  ▣  ▣  ▣  ▣        the views, in the order they turn
 * ```
 *
 * A hand made of drawings has no fingers to curl and no facing to slide: it
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
import { DEFAULT_HAND_POSE, DEFAULT_HAND_VIEW, HAND_POSES, HAND_VIEWS, handPoseId, handViewId } from '../../../runtime/hand-vocabulary.js';
import { handPoseFromValues, handSpritePoses, handViewFromValues } from '../../../runtime/runtime.js';
import { handReachEllipse } from '../hands/hand-model.js';
import { handSetPoses } from '../hands/hand-sprite-install.js';
import { handShowParameter } from '../sample/hand-feature.js';
import { HAND_CONSOLE_GATE, handDrawnAnchor } from './hand-handles.js';
import { handPickerLayout } from './hand-console.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const nameOf = (list, id) => (list.find((item) => item.id === id) || {}).name || id;

/**
 * The cells for one hand, or `null` when it has no drawings to pick between.
 *
 * `values` are the live ones, so a cell knows whether it is the one showing.
 * A hand still resting behind the head has no picker: a column of pictures
 * beside a hand nobody can see is the same clutter around nothing the rest of
 * the console is gated on, and the slider that brings it out is ungated.
 *
 * @returns {{side, group, gate, cells: object[]}|null}
 */
export function handPickerModel(document = {}, side = 'left', values = {}) {
  const hand = document?.hands?.[side];
  const sprites = hand?.sprites;
  if (!sprites || !document?.elements?.[hand.element]) return null;
  const show = handShowParameter(side);
  if (show in (document.params || {}) && number(values[show], 0) <= HAND_CONSOLE_GATE) return null;

  const poses = handSpritePoses(sprites);
  // Every hand the generator can draw, not only the ones this set already has:
  // a column with one cell in it is not a picker, and "as easily as possible"
  // means the hand you want is one press away whether it is drawn yet or not.
  const offered = handSetPoses(document, side);
  const ellipse = handReachEllipse(hand, document.elements);
  const drawn = handDrawnAnchor(hand, document.elements);
  const rest = ellipse ? { x: ellipse.cx, y: ellipse.cy } : drawn;
  const reach = ellipse ? { x: ellipse.rx, y: ellipse.ry } : hand.reach;
  const layout = handPickerLayout({ rest, reach, side, poses: offered.length, views: HAND_VIEWS.length });

  const pose = handPoseFromValues(hand, values);
  // In automatic mode the view is the orientation's to choose, so the row says
  // what is showing and does not offer to override it: a press that the next
  // frame takes back reads as a broken button.
  const auto = sprites.viewMode === 'auto';
  const view = auto ? (handViewId(sprites.view) || DEFAULT_HAND_VIEW) : handViewFromValues(hand, values);
  const label = side === 'right' ? 'Right hand' : 'Left hand';

  const cells = [
    ...offered.map((item, index) => ({
      id: `hand-${side}-pick-pose-${item.id}`, kind: 'pose', side, pose: item.id,
      // Drawn **front on**, whatever the hand is turned to. A column asking
      // "which shape" has to show the shapes, and seven hands seen edge-on are
      // seven near-identical slivers -- the question the view row answers is
      // the other one, and it is the one that uses the current pose.
      drawing: { side, pose: item.id, view: DEFAULT_HAND_VIEW },
      label: `${label}: ${nameOf(HAND_POSES, item.id)}`,
      hint: item.drawn
        ? `Show the ${nameOf(HAND_POSES, item.id).toLowerCase()} hand`
        : `Draw the ${nameOf(HAND_POSES, item.id).toLowerCase()} hand and show it`,
      // A pose the hand already draws is a choice; one it does not is an offer,
      // and pressing it draws the five views before showing one. Either way it
      // is one press, which is the whole point of a picker.
      parameter: item.drawn ? hand.parameters.pose : null,
      value: item.drawn ? poses.indexOf(item.id) : null,
      offer: !item.drawn,
      active: item.drawn && item.id === pose, disabled: false,
      cell: layout.poses[index]
    })),
    ...HAND_VIEWS.map((item, index) => ({
      id: `hand-${side}-pick-view-${item.id}`, kind: 'view', side,
      drawing: { side, pose, view: item.id },
      label: `${label}: ${item.name}`,
      hint: auto ? 'The view follows how the hand is turned; turn automatic off to pick one' : `Turn the hand: ${item.name.toLowerCase()}`,
      parameter: hand.parameters.view, value: index,
      active: item.id === view, disabled: auto,
      cell: layout.views[index]
    }))
  ].filter((entry) => entry.cell && entry.cell.size > 0);

  return cells.length ? { side, group: `hand-${side}`, cells } : null;
}

/** Both hands' pickers, in side order; a hand without drawings simply has none. */
export function handPickerOverlay(document = {}, values = {}) {
  return ['left', 'right'].map((side) => handPickerModel(document, side, values)).filter(Boolean);
}

/**
 * What a press on a cell writes, or `null` when the press is not a value at
 * all -- an offer draws its pose first, and only then is there an index to
 * write (`handPickerOffer`).
 */
export const handPickerChange = (cell) => (cell && cell.parameter && !cell.disabled ? { [cell.parameter]: cell.value } : null);

/** The pose a press has to draw before it can show it, or `null`. */
export const handPickerOffer = (cell) => (cell?.offer && !cell.disabled ? { side: cell.side, pose: cell.pose } : null);

/** The pose a cell stands for, for a caller that wants the id rather than the index. */
export const handPickerPose = (cell) => handPoseId(cell?.drawing?.pose) || DEFAULT_HAND_POSE;
