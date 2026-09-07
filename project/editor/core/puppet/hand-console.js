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
 *          ╭──┤ ✋  ├──╮       the ring: where the hand may reach
 *        ◆─┤  ╰─────╯  ├─◆     the rim: one slider per finger
 *          ╰─◆──◆──◆───╯
 *             ▬▬▬▬▬            under it: the turn
 *             ▬▬▬▬▬            and which way the hand faces
 * ```
 *
 * So the hand's controls become a **console**: a dial drawn around the hand
 * itself, laid out from the reach the hand already has. The ring is the reach
 * -- drag the hand anywhere inside it -- the fingers are sliders on the ring's
 * own rim, and the two whole-hand turns are a pair of sliders under it. One
 * more, beside the face, brings the hand out from behind the head; while the
 * hand is hidden it is the only one drawn, because a console around a hand
 * nobody can see is clutter around nothing.
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
  /** Degrees of rim the finger sliders share, and where that sweep starts. */
  rimSweep: 176,
  rimStart: 62,
  /** How much of each rim slot is left empty, so two sliders never touch. */
  rimGap: 0.3,
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
  showBottom: 0.1
});

/** Mirrored about the mascot: the left hand's outward side is the right one's. */
const mirrored = (degrees, side) => (side === 'right' ? 180 - number(degrees) : number(degrees));

/**
 * Where a hand's console goes, given the reach it already has.
 *
 * `rim` and `row` are the slots to lay out, in order, and `show` names the one
 * slider that is not on the console at all. Slots come back keyed by the ids
 * they were asked for, so a hand missing a finger simply has one fewer.
 *
 * @param {{rest: {x,y}, reach: {x,y}, side: 'left'|'right', rim: string[], row: string[], show: ?string}} source
 * @returns {{ring: {cx,cy,rx,ry}, tracks: Record<string, object>}}
 */
export function handConsoleLayout({ rest = {}, reach = {}, side = 'left', rim = [], row = [], show = null } = {}) {
  const cx = round(rest.x), cy = round(rest.y);
  const rx = round(Math.max(4, Math.abs(number(reach.x, 40))));
  const ry = round(Math.max(4, Math.abs(number(reach.y, 40))));
  const ring = { cx, cy, rx, ry };
  const tracks = {};

  // The fingers, on the rim that faces away from the mascot: the ring's inner
  // side is where the body is, and a slider drawn over the body is a slider
  // over the face on a mascot whose hands hang by its chin.
  const slot = rim.length ? HAND_CONSOLE.rimSweep / rim.length : 0;
  const pad = (slot * HAND_CONSOLE.rimGap) / 2;
  rim.forEach((id, index) => {
    const from = HAND_CONSOLE.rimStart + index * slot + pad;
    tracks[id] = { kind: 'arc', cx, cy, rx, ry, from: mirrored(from, side), to: mirrored(from + slot - pad * 2, side) };
  });

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
