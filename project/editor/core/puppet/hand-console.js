/**
 * The hand console (docs/DIRECT_CONTROLS.md, docs/HAND_RIGGING.md).
 *
 * A floating hand has more to say than any other part of a mascot: where it
 * is, how far it has turned, which way it faces, and what each of five fingers
 * is doing. That was eight dots scattered around the hand's own bounding box,
 * folded away behind an opener because eight dots on a hand the size of an eye
 * is a minefield. Nobody could tell which dot did what, and the pair that
 * matters most -- how far the hand is out from behind the head -- was not on
 * the canvas at all.
 *
 * ```text
 *          ┌ the face ┐
 *          │          │
 *      ▲   └──────────┘        ▲  how far out the hand is,
 *      │                       │  beside the face, on its own side
 *      ▼      ╭─────╮
 *          ╭──┤ ✋  ├──╮ ◆      outward: one slider per finger
 *        ◆─┤  ╰─────╯  ├─◆      inward:  the places it is held to
 *          ╰─◆──◆──◆───╯ ◆
 *            ▬▬▬▬  ▬▬▬▬        under it: the turn, and which way it faces
 * ```
 *
 * So the hand's controls become a **console**: a dial drawn around the hand
 * itself, laid out from the reach the hand already has. The ring is the reach
 * -- drag the hand anywhere inside it -- each finger's slider sits on the
 * stretch of rim *its own finger points along*, the places the hand can be
 * *held* to take whatever arc the fingers leave, and the whole-hand turns are
 * a row under it. One more slider, beside the face, brings the hand out from
 * behind the head; while the hand is hidden it is the only one drawn, because
 * a console around a hand nobody can see is clutter around nothing.
 *
 * Everything here is geometry in the artwork's own coordinates, and pure: the
 * canvas draws the tracks and puts the knobs on them, `puppet-handles.js`
 * turns a drag along one into a value, and neither has to know the layout.
 */
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 1000) / 1000;
const radians = (degrees) => (number(degrees) * Math.PI) / 180;

/**
 * The console, in fractions of the ring it is drawn on.
 *
 * Proportions rather than pixels: the same console has to read on a hand the
 * size of a thumbnail and on one that fills a 2000-unit artboard, and the
 * reach is the only measurement that scales with the mascot.
 */
export const HAND_CONSOLE = Object.freeze({
  /**
   * Degrees of rim one finger's slider covers, and the gap the grip keeps from
   * the fan of fingers it closes.
   *
   * A finger's slider is not given a share of some arbitrary sweep: it is put
   * on the stretch of rim *its own finger points along*, so the slider nearest
   * a finger is that finger's. The artwork knows where each one points
   * (`handDigitTip`), and it knows it for a mirrored hand too, so nothing here
   * has to.
   */
  rimSpan: 26,
  rimGap: 6,
  /**
   * What the holds get: whatever arc the fingers leave, less this margin at
   * each end, and this share of each hold's own cell left empty.
   *
   * A hold is a place on the mascot's own face, and the fingers point away
   * from the mascot, so the free arc is the one facing it -- without anything
   * here having to know which way that is.
   */
  holdMargin: 10,
  holdGap: 0.3,
  /**
   * The row of whole-hand turns: how far under the ring it sits, in units of
   * the ring's *shorter* radius, how wide the row is in ring widths, and how
   * much of each slider's cell is left as a gap.
   *
   * One line, side by side, rather than a slider per line: a mascot has only
   * so much room under its own drawing, and a stack of them walks straight off
   * the bottom of the canvas the moment the reach is a tall one.
   */
  rowDrop: 0.34,
  rowWidth: 2,
  rowGap: 0.22,
  /** The way out from behind the head: beside the ring, and above it. */
  showOut: 0.46,
  showTop: 2.15,
  showBottom: 0.1,
  /**
   * The picker: which drawing the hand is showing, chosen by looking at it
   * (docs/HAND_STYLES.md).
   *
   * A hand made of drawings has no fingers to curl and no facing to slide --
   * it *is* one of a handful of pictures, and the quickest way to say which is
   * to show them. So the poses go in a column **beside the face**, on the
   * hand's own side and outside the slider that brings it out, and the views
   * go in a row under the hand where the turn already is: a type of hand is a
   * thing you pick, and how far round it has turned belongs with the turning.
   *
   * `pickOut` is how far out the column sits in ring widths, `pickMax` the
   * biggest a cell may be in units of the ring's shorter radius, and `pickGap`
   * the space between two cells in cell widths. The column shares the show
   * slider's own height, so a set with more poses gets smaller cells rather
   * than a column running off the canvas.
   */
  pickOut: 0.42,
  pickMax: 0.75,
  pickGap: 0.16,
  /**
   * The run the column has, above the hand and below it, in ring heights.
   *
   * Its own, not the show slider's: the slider only has to be long enough to
   * drag, and the column has to hold a picture of every hand the set can show.
   * The room beside a face is vertical, so the column takes it -- up past the
   * slider, level with the face it is beside.
   */
  pickTop: 5,
  pickBottom: 0.1
});

/**
 * Cells of a given count laid along a span, as big as they can be.
 *
 * Fewer drawings means bigger pictures rather than a gappy line, and more of
 * them means smaller ones rather than a line that runs off the canvas -- which
 * is what lets one layout serve a set of one pose and a set of eight.
 */
function fitCells(span, count, biggest) {
  if (count < 1) return { size: 0, step: 0 };
  const size = Math.min(biggest, span / (count + (count - 1) * HAND_CONSOLE.pickGap));
  return { size, step: size * (1 + HAND_CONSOLE.pickGap) };
}

const norm = (degrees) => ((number(degrees) % 360) + 360) % 360;

/**
 * The stretch of rim the fingers occupy, clockwise, and what is left over.
 *
 * The slots arrive in the fan's own order -- the grip, then the thumb through
 * to the last finger -- so the two ends of the fan are its first and last
 * entries. Which of those two comes first *clockwise* depends on the hand: the
 * artwork is mirrored, so one fan runs clockwise and the other does not.
 */
function freeArc(rim, half) {
  if (!rim.length) return { from: 0, sweep: 360 };
  const first = number(rim[0].at), last = number(rim[rim.length - 1].at);
  const clockwise = norm(last - first) <= 180;
  const end = (clockwise ? last : first) + half;
  const start = (clockwise ? first : last) - half;
  return { from: end + HAND_CONSOLE.holdMargin, sweep: Math.max(0, norm(start - end) - HAND_CONSOLE.holdMargin * 2) };
}

/**
 * Where a hand's console goes, given the reach it already has.
 *
 * `rim` and `row` are the slots to lay out, in order, and `show` names the one
 * slider that is not on the console at all. Slots come back keyed by the ids
 * they were asked for, so a hand missing a finger simply has one fewer.
 *
 * @param {{rest: {x,y}, reach: {x,y}, side: 'left'|'right', rim: {id: string, at: number}[], hold: string[], ring: string[], row: string[], show: ?string}} source
 * @returns {{ring: {cx,cy,rx,ry}, tracks: Record<string, object>}}
 */
export function handConsoleLayout({ rest = {}, reach = {}, side = 'left', rim = [], hold = [], ring: ring_ = [], row = [], show = null } = {}) {
  const cx = round(rest.x), cy = round(rest.y);
  const rx = round(Math.max(4, Math.abs(number(reach.x, 40))));
  const ry = round(Math.max(4, Math.abs(number(reach.y, 40))));
  const ring = { cx, cy, rx, ry };
  const tracks = {};

  const arc = (id, from, to) => { tracks[id] = { kind: 'arc', cx, cy, rx, ry, from, to }; };
  // Every finger on its own stretch of rim, and every one of them closing the
  // same way round the ring: **clockwise closes**, on the left hand and on the
  // right. The artwork's own handedness decides where a slider sits; it does
  // not get to decide which way an author has to turn it.
  //
  // No slider is wider than the gap to its neighbour allows, so a hand whose
  // fingers sit close together gets shorter sliders rather than overlapping
  // ones -- and a hand drawn with its fingers spread gets the full width.
  const closest = rim.slice(1).reduce((least, slot, index) =>
    Math.min(least, Math.abs(norm(number(slot.at) - number(rim[index].at) + 180) - 180)), 360);
  const half = Math.max(3, Math.min(HAND_CONSOLE.rimSpan, closest - HAND_CONSOLE.rimGap) / 2);
  for (const slot of rim) arc(slot.id, number(slot.at) - half, number(slot.at) + half);
  // What else rides the ring: the turn, which goes *round* the hand rather than
  // sitting at a place on it, and the places the hand can be held to. They
  // share the arc the rim leaves free -- one allocation, so a hand that has
  // both never draws one over the other.
  const around = [...ring_, ...hold];
  if (around.length) {
    const free = freeArc(rim, half);
    const cell = free.sweep / around.length;
    const pad = (cell * HAND_CONSOLE.holdGap) / 2;
    around.forEach((id, index) => arc(id, free.from + index * cell + pad, free.from + (index + 1) * cell - pad));
  }

  // The whole-hand turns, side by side on one line under the ring.
  const rowY = round(cy + ry + Math.min(rx, ry) * HAND_CONSOLE.rowDrop);
  const span = rx * HAND_CONSOLE.rowWidth;
  const cell = row.length ? span / row.length : 0;
  const cellPad = (cell * HAND_CONSOLE.rowGap) / 2;
  row.forEach((id, index) => {
    const left = cx - span / 2 + index * cell + cellPad;
    tracks[id] = { kind: 'line', from: { x: round(left), y: rowY }, to: { x: round(left + cell - cellPad * 2), y: rowY } };
  });

  // And the way out from behind the head: upright, beside the face, on the
  // hand's own side. Up is tucked away and down is out, which is the direction
  // the hand itself travels.
  if (show) {
    const x = round(cx + (side === 'right' ? 1 : -1) * rx * (1 + HAND_CONSOLE.showOut));
    tracks[show] = { kind: 'line',
      from: { x, y: round(cy - ry * HAND_CONSOLE.showTop) },
      to: { x, y: round(cy + ry * HAND_CONSOLE.showBottom) } };
  }
  return { ring, tracks };
}

/**
 * Where the drawings a hand can show are laid out (docs/HAND_STYLES.md).
 *
 * ```text
 *        ┌ the face ┐
 *   ▣    │          │        ▣  the poses, beside the face, on the hand's
 *   ▣    └──────────┘        ▣  own side and outside the way-out slider
 *   ▣  ▲    ╭─────╮      ▲   ▣
 *   ▣  │ ╭──┤ ✋  ├──╮   │   ▣
 *        ╰─────────────╯
 *            ▬▬▬▬▬            the turn, as it always was
 *        ▣  ▣  ▣  ▣  ▣        the views, in the order they turn
 * ```
 *
 * Both are the same kind of thing -- a cell holding a picture of the drawing
 * it selects -- so they are one function and one shape. Geometry only: what
 * goes in a cell is `hand-picker.js`, and drawing it is the canvas.
 *
 * @param {{rest: {x,y}, reach: {x,y}, side: 'left'|'right', poses: number, views: number}} source
 * @returns {{poses: {x,y,size}[], views: {x,y,size}[]}}
 */
export function handPickerLayout({ rest = {}, reach = {}, side = 'left', drawings = 0 } = {}) {
  const cx = round(rest.x), cy = round(rest.y);
  const rx = round(Math.max(4, Math.abs(number(reach.x, 40))));
  const ry = round(Math.max(4, Math.abs(number(reach.y, 40))));
  const shorter = Math.min(rx, ry);
  const out = { drawings: [] };

  // One column beside the face, on the hand's own side, **outside** the slider
  // that brings the hand out so the two never sit on top of each other, over
  // the same run of the drawing the slider covers. One column rather than a
  // wrapped grid: the room beside a face is vertical, and a second column is a
  // column off the side of the canvas.
  const columnTop = cy - ry * HAND_CONSOLE.pickTop;
  const columnSpan = ry * (HAND_CONSOLE.pickTop + HAND_CONSOLE.pickBottom);
  const column = fitCells(columnSpan, drawings, shorter * HAND_CONSOLE.pickMax);
  const dir = side === 'right' ? 1 : -1;
  const columnX = round(cx + dir * rx * (1 + HAND_CONSOLE.showOut + HAND_CONSOLE.pickOut));
  // Sitting on the bottom of the run rather than the top: the hand is at the
  // bottom, and a short column belongs beside it and not adrift above it.
  const used = column.step * drawings - (column.step - column.size);
  const top = columnTop + Math.max(0, columnSpan - used);
  for (let index = 0; index < drawings; index += 1) {
    out.drawings.push({ x: columnX, y: round(top + column.size / 2 + index * column.step), size: round(column.size) });
  }
  return out;
}

/** A point on a track, at `t` from 0 (its start) to 1 (its end). */
export function handTrackPoint(track, t = 0) {
  const at = Math.max(0, Math.min(1, number(t)));
  if (track?.kind === 'arc') {
    const angle = radians(number(track.from) + (number(track.to) - number(track.from)) * at);
    return { x: number(track.cx) + number(track.rx) * Math.cos(angle), y: number(track.cy) + number(track.ry) * Math.sin(angle) };
  }
  const from = track?.from || {}, to = track?.to || {};
  return { x: number(from.x) + (number(to.x) - number(from.x)) * at, y: number(from.y) + (number(to.y) - number(from.y)) * at };
}

/**
 * Which way the track runs where the knob is, as a unit vector.
 *
 * This is what a drag is projected onto, so a pointer that travels along the
 * slider moves it and one that travels across it does not — on an arc as much
 * as on a straight one.
 */
export function handTrackDirection(track, t = 0) {
  let dx, dy;
  if (track?.kind === 'arc') {
    const sweep = number(track.to) - number(track.from);
    const angle = radians(number(track.from) + sweep * Math.max(0, Math.min(1, number(t))));
    dx = -number(track.rx) * Math.sin(angle) * sweep;
    dy = number(track.ry) * Math.cos(angle) * sweep;
  } else {
    dx = number(track?.to?.x) - number(track?.from?.x);
    dy = number(track?.to?.y) - number(track?.from?.y);
  }
  const length = Math.hypot(dx, dy);
  return length > 1e-9 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
}

/**
 * How far the knob travels from one end of the track to the other.
 *
 * An arc is measured by sampling rather than by a closed form: the ring is an
 * ellipse, and an ellipse's arc length has no closed form worth the trouble.
 */
export function handTrackLength(track, steps = 24) {
  if (track?.kind !== 'arc') {
    return Math.hypot(number(track?.to?.x) - number(track?.from?.x), number(track?.to?.y) - number(track?.from?.y));
  }
  let total = 0, last = handTrackPoint(track, 0);
  for (let step = 1; step <= steps; step += 1) {
    const at = handTrackPoint(track, step / steps);
    total += Math.hypot(at.x - last.x, at.y - last.y);
    last = at;
  }
  return total;
}

/** The track as one SVG path, for the canvas to draw it with. */
export function handTrackPath(track) {
  const from = handTrackPoint(track, 0), to = handTrackPoint(track, 1);
  const start = `M${round(from.x)} ${round(from.y)}`;
  if (track?.kind !== 'arc') return `${start} L${round(to.x)} ${round(to.y)}`;
  const sweep = number(track.to) - number(track.from);
  return `${start} A${round(track.rx)} ${round(track.ry)} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep < 0 ? 0 : 1} ${round(to.x)} ${round(to.y)}`;
}

/**
 * Where along its track a value sits, and the value a position stands for.
 *
 * The axis carries the range, so a console slider covers exactly what the
 * movement allows — a hand that may only half-close its fingers has a shorter
 * slider, not a slider that stops early.
 */
export const handTrackAt = (axis, value) => {
  const min = number(axis?.min, -1), max = number(axis?.max, 1);
  const span = max - min;
  return span > 1e-9 ? Math.max(0, Math.min(1, (number(value, axis?.rest) - min) / span)) : 0;
};
