/**
 * Sharing a space between controls, so that no two of them meet
 * (docs/DIRECT_CONTROLS.md, docs/FACE_CONTROL_RIG.md).
 *
 * Every control on the mascot used to be placed by hand: a fraction of the
 * part's own box per definition, de-conflicted one definition at a time by
 * whoever added the next one. That holds for exactly the drawing it was
 * written against. A control is a button of a **fixed size in pixels** while
 * its position scales with the zoom, so "beside the mouth" and "the middle of
 * the mouth" are the same place on a mascot small enough — and the one painted
 * on top then takes every drag, while the other simply cannot be reached.
 *
 * So overlap stops being something a careful author avoids and becomes
 * something the layout cannot produce. `packControls` takes every control with
 * the room it needs and hands back positions where no two of their boxes
 * touch:
 *
 * ```text
 *   wanted            packed
 *     ●●●               ● ● ●      a control that clashes with nothing
 *                                  never moves; one that does steps aside
 * ```
 *
 * The other two are the layouts that were already here, lifted out of the hand
 * console so that the app has one answer to "how do several controls share a
 * space" rather than one per surface: `shareCells` cuts a run into equal cells
 * with a gap between them (the console's ring, and the row under it) and
 * `fitCells` makes the cells as big as they can be up to a limit (the column
 * of drawings beside the face).
 *
 * Pure geometry. Nothing here knows what a control drives, what it is called
 * or how it is drawn; the canvas measures, this places, the canvas writes.
 */
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 1000) / 1000;

/**
 * Where on its artwork a control sits, as a fraction of the measured box.
 *
 * `at` keeps two controls off the same spot before the packing has to: the
 * gaze takes the middle of the pupils, so the eyelid's control goes on top of
 * the eye and the head's above the face, where a puppeteer would hold it.
 * These are the spots `RIG_HANDLE_SPOTS` names (`handle-record.js`), and an
 * author picks between them per control.
 */
export const CONTROL_SPOTS = Object.freeze({
  centre: Object.freeze({ x: 0.5, y: 0.5 }),
  top: Object.freeze({ x: 0.5, y: 0.08 }),
  bottom: Object.freeze({ x: 0.5, y: 0.92 }),
  left: Object.freeze({ x: 0.06, y: 0.5 }),
  right: Object.freeze({ x: 0.94, y: 0.5 }),
  bottomLeft: Object.freeze({ x: 0.1, y: 0.88 })
});

/**
 * Where one control wants to be: its spot on the box, plus the author's own
 * nudge.
 *
 * The nudge is in **screen pixels** rather than in fractions of the box,
 * because what a nudge is for is clearing another control and a control's own
 * size is in pixels. It is the `offset` on the handle record, which has been
 * stored, normalized and merged since handles became records and which nothing
 * has ever read.
 *
 * @param {{x,y,width,height}} rect the artwork's measured box
 * @param {string} at one of `CONTROL_SPOTS`
 * @param {{x,y}} [offset] the author's nudge, in screen pixels
 */
export function controlSpot(rect, at = 'centre', offset = null) {
  const spot = CONTROL_SPOTS[at] || CONTROL_SPOTS.centre;
  return {
    x: number(rect?.x) + number(rect?.width) * spot.x + number(offset?.x),
    y: number(rect?.y) + number(rect?.height) * spot.y + number(offset?.y)
  };
}

/** How much clear air two controls keep between them, in pixels. */
export const CONTROL_GAP = 5;

/**
 * Two controls are clear of each other when their **boxes** miss — in x, or in
 * y, either will do.
 *
 * A control is a box and not a dot: a bar is 34 across and 16 down, a diamond
 * is a square stood on its corner, and the browser reports a box for every one
 * of them. Testing the boxes is both what a reader means by "one is on top of
 * the other" and the tightest honest answer — two round buttons side by side
 * need the room they take across, and nothing more.
 */
const apart = (one, other, gap) =>
  Math.abs(one.x - other.x) + 1e-6 >= (one.width + other.width) / 2 + gap
  || Math.abs(one.y - other.y) + 1e-6 >= (one.height + other.height) / 2 + gap;

/**
 * Where the controls go, given where each of them would like to be.
 *
 * Each control is taken as the box its hit area really is — a size in pixels
 * whatever the zoom — and placed at the spot it asked for when that spot is
 * free. When it is not, the control steps out onto a ring of places around it
 * and takes the first free one, the near side first, so it moves as little as
 * it can and moves *away* from whatever it clashed with.
 *
 * **The search always ends, and it always ends in a free place.** Ring `k` is
 * `k` pitches out and offers `6k` places; a pitch is wider than the widest
 * control, so one already-placed control covers at most four of those places,
 * and any ring with `6k > 4n` has a free one for the `n` controls in hand.
 * `k > 2n / 3` is enough, and that is where the search stops looking — it
 * never gets near it on a real face.
 *
 * A **fixed** control is one whose position is the thing it says: the knob on
 * a hand's console sits where the value is, a control on a named point sits on
 * the fingertip it names, and the one under the pointer is being dragged. They
 * are placed first, exactly where they asked, and everything else is packed
 * clear of them.
 *
 * @param {{id, x, y, width, height, fixed?}[]} items in priority order
 * @param {{gap?: number}} [options]
 * @returns {{id, x, y, moved: boolean}[]} in the order they were given
 */
export function packControls(items = [], { gap = CONTROL_GAP } = {}) {
  const list = items.filter((item) => item && item.id != null);
  const clearance = Math.max(0, number(gap, CONTROL_GAP));
  const widest = list.reduce((most, item) => Math.max(most, number(item.width), number(item.height)), 0);
  const pitch = widest + clearance || 1;
  const rings = Math.ceil((2 * list.length) / 3) + 1;
  const placed = [];
  const found = new Map();
  // Fixed first, in the order they were given: they cannot move, so nothing
  // may be allowed to take their place before they are asked for it.
  for (const item of [...list.filter((item) => item.fixed), ...list.filter((item) => !item.fixed)]) {
    const box = { x: number(item.x), y: number(item.y), width: Math.max(0, number(item.width)), height: Math.max(0, number(item.height)) };
    const clash = item.fixed ? [] : placed.filter((other) => !apart(box, other, clearance));
    const at = clash.length ? stepAside(box, placed, clash, { pitch, rings, clearance }) : box;
    placed.push({ ...box, x: at.x, y: at.y });
    found.set(item.id, { id: item.id, x: round(at.x), y: round(at.y), moved: at !== box });
  }
  return list.map((item) => found.get(item.id));
}

/**
 * The nearest free place on a ring around where the control wanted to be.
 *
 * The rings are tried from the inside out and each one is walked outwards from
 * the direction *away* from whatever the control clashed with, so a control
 * that has to move ends up on the far side of its neighbour rather than on a
 * side chosen by the order of the loop.
 */
function stepAside(box, placed, clash, { pitch, rings, clearance }) {
  const away = clash.reduce((sum, other) => {
    const length = Math.hypot(box.x - other.x, box.y - other.y) || 1;
    return { x: sum.x + (box.x - other.x) / length, y: sum.y + (box.y - other.y) / length };
  }, { x: 0, y: 0 });
  // Every clash exactly on top of this control leaves no direction at all, so
  // the first try is upwards: a control lifted off another still reads as
  // belonging to the artwork under it.
  const bearing = away.x || away.y ? Math.atan2(away.y, away.x) : -Math.PI / 2;
  for (let ring = 1; ring <= rings; ring += 1) {
    const places = 6 * ring;
    for (let step = 0; step < places; step += 1) {
      // Out from the bearing, alternating sides, so the nearest place to
      // "away from the clash" is tried first.
      const turn = (Math.ceil(step / 2) * (step % 2 ? 1 : -1) * 2 * Math.PI) / places;
      const at = { ...box, x: box.x + Math.cos(bearing + turn) * ring * pitch, y: box.y + Math.sin(bearing + turn) * ring * pitch };
      if (placed.every((other) => apart(at, other, clearance))) return at;
    }
  }
  // Unreachable for any finite set of controls; a caller that hands in more
  // than it said it would gets its control back where it asked for it rather
  // than nowhere at all.
  return box;
}

/**
 * A point pushed out to at least `minimum` from another one, along the
 * direction it already had.
 *
 * A control whose distance from another *is* a value it reports — the square
 * that sets how far a pin holds — cannot be moved sideways without lying about
 * what it says. It can only be kept far enough out to be grabbed: a pin with a
 * reach of three units drew both of its reach squares inside its own dot.
 */
export function pushClear(from, to, minimum) {
  const dx = number(to?.x) - number(from?.x), dy = number(to?.y) - number(from?.y);
  const length = Math.hypot(dx, dy);
  const wanted = Math.max(0, number(minimum));
  if (!length || length >= wanted) return { x: number(to?.x), y: number(to?.y) };
  return { x: number(from?.x) + (dx / length) * wanted, y: number(from?.y) + (dy / length) * wanted };
}

/**
 * A run cut into `count` equal cells, each shrunk by a share of its own cell so
 * that two never meet.
 *
 * What the ring of a hand's console and the row under it are laid out with:
 * everything riding the ring gets an equal cell of it, and the gap is what
 * keeps the turn from touching the hold beside it.
 *
 * @param {number} span the whole run
 * @param {number} count how many share it
 * @param {{gap?: number}} [options] the gap, as a fraction of one cell
 * @returns {{cell: number, size: number, pad: number}}
 */
export function shareCells(span, count, { gap = 0 } = {}) {
  if (!(count >= 1)) return { cell: 0, size: 0, pad: 0 };
  const cell = number(span) / count;
  const pad = (cell * Math.max(0, Math.min(1, number(gap)))) / 2;
  return { cell, size: cell - pad * 2, pad };
}

/**
 * Cells of a given count laid along a span, as big as they can be.
 *
 * Fewer drawings means bigger pictures rather than a gappy line, and more of
 * them means smaller ones rather than a line that runs off the canvas -- which
 * is what lets one layout serve a set of one pose and a set of eight.
 *
 * @param {number} span the whole run
 * @param {number} count how many cells to fit in it
 * @param {{biggest?: number, gap?: number}} [options] the cap on one cell, and
 *   the space between two of them as a fraction of a cell
 * @returns {{size: number, step: number}}
 */
export function fitCells(span, count, { biggest = Infinity, gap = 0 } = {}) {
  if (!(count >= 1)) return { size: 0, step: 0 };
  const spacing = Math.max(0, number(gap));
  const size = Math.min(number(biggest, Infinity), number(span) / (count + (count - 1) * spacing));
  return { size, step: size * (1 + spacing) };
}
