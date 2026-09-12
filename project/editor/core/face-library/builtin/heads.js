/**
 * Heads: a skull each, drawn where the template's is (the face's middle at
 * 120, 116; the template skull 188 wide). On a face whose head is a lone
 * shape the skull *is* the head that turns; on the template, whose head is
 * the whole face, the skull goes inside that face and the jaw takes it
 * (docs/FACE_PART_LIBRARY.md, "The skull rule").
 *
 * Every skull is a path drawn twice from the same points -- at rest, and
 * with its lower half stretched down by `JAW_DROP` -- so it ships the jaw
 * pose the template draws for its own outline: the jaw part takes the
 * skull, and `jawOpen` (with `mouthOpen`, as the template's) drops it.
 */
const SKIN = '#f9d9b0', LINE = '#a4674a';
/** How far the chin drops at `jawOpen 1`: the registry's own jaw travel. */
export const JAW_DROP = 16;
const K = 0.5523;
const round = (value) => Math.round(value * 100) / 100;

/** An ellipse as four cubics, the lower half stretched down by `drop` at the bottom. */
function ovalPath(cx, cy, rx, ry, drop = 0) {
  const y = (value) => round(value > cy ? cy + (value - cy) * (1 + drop / ry) : value);
  const p = (px, py) => `${round(px)} ${y(py)}`;
  return `M${p(cx, cy - ry)} C${p(cx + rx * K, cy - ry)} ${p(cx + rx, cy - ry * K)} ${p(cx + rx, cy)} C${p(cx + rx, cy + ry * K)} ${p(cx + rx * K, cy + ry)} ${p(cx, cy + ry)} C${p(cx - rx * K, cy + ry)} ${p(cx - rx, cy + ry * K)} ${p(cx - rx, cy)} C${p(cx - rx, cy - ry * K)} ${p(cx - rx * K, cy - ry)} ${p(cx, cy - ry)} Z`;
}

/**
 * A face drawn from a **width rule** instead of a radius: how wide it is at
 * every height down its own length.
 *
 * An ellipse and a rounded square say everything a round, oval, wide, narrow
 * or square skull needs. A pear, a marked chin and a heart are none of those,
 * because what makes them is not how big the face is but *where* it is widest
 * and how it closes at each end. Three numbers say that:
 *
 * ```text
 * lean    where the width sits: + is heavy below (a pear), - heavy above
 * crown   how square the top is: 2 is a circle's shoulder, 3 is a brow
 * jaw     how square the bottom is: 2 is a round chin, 3.5 is a jaw with
 *         a corner in it and a chin with an edge
 * ```
 *
 * The rule is a superellipse whose exponent slides from `crown` at the top to
 * `jaw` at the bottom, tilted by `lean`. It is smooth by construction, which
 * matters: a face outline is the one line on a mascot nothing else hides, and
 * a ripple in it reads as a dent in the skull.
 */
function shapedPath(cx, cy, rx, ry, { lean = 0, crown = 2, jaw = 2 }, drop = 0) {
  const y = (value) => round(value > cy ? cy + (value - cy) * (1 + drop / ry) : value);
  // Sampled by angle rather than by height, so the samples crowd where the
  // outline turns -- the crown and the chin -- and spread down the cheeks.
  const half = (u) => {
    const power = crown + (jaw - crown) * ((u + 1) / 2);
    return rx * (1 - Math.abs(u) ** power) ** (1 / power) * (1 + lean * u);
  };
  const steps = 8, right = [], left = [];
  for (let step = 1; step < steps; step += 1) {
    const u = -Math.cos((Math.PI * step) / steps), at = y(cy + u * ry), width = round(half(u));
    right.push([round(cx + width), at]);
    left.unshift([round(cx - width), at]);
  }
  const ring = [[cx, y(cy - ry)], ...right, [cx, y(cy + ry)], ...left];

  // One closed curve through every sample: Catmull-Rom written as cubics, with
  // each tangent scaled by the chords either side of its point, so the close
  // samples at the crown and the chin do not overshoot into the cheeks.
  const count = ring.length, at = (index) => ring[((index % count) + count) % count];
  const chord = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
  const out = [`M${ring[0][0]} ${ring[0][1]}`];
  for (let index = 0; index < count; index += 1) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    const [before, span, after] = [chord(p0, p1), chord(p1, p2), chord(p2, p3)];
    const lead = span / (before + span) / 3, trail = span / (span + after) / 3;
    out.push(`C${round(p1[0] + (p2[0] - p0[0]) * lead)} ${round(p1[1] + (p2[1] - p0[1]) * lead)}`
      + ` ${round(p2[0] - (p3[0] - p1[0]) * trail)} ${round(p2[1] - (p3[1] - p1[1]) * trail)}`
      + ` ${round(p2[0])} ${round(p2[1])}`);
  }
  return `${out.join(' ')} Z`;
}

/** The box a shaped face fills: as wide as it ever gets, from crown to chin. */
function shapedBox(cx, cy, rx, ry, shape) {
  let widest = 0;
  for (let step = 0; step <= 200; step += 1) {
    const u = -1 + (2 * step) / 200;
    const power = shape.crown + (shape.jaw - shape.crown) * ((u + 1) / 2);
    widest = Math.max(widest, rx * (1 - Math.abs(u) ** power) ** (1 / power) * (1 + (shape.lean || 0) * u));
  }
  const half = Math.round(widest);
  return { x: cx - half, y: cy - ry, width: half * 2, height: ry * 2 };
}

/** A rounded rectangle: straight sides, cubic corners, the lower half stretched down by `drop`. */
function softSquarePath(x, y0, w, h, r, drop = 0) {
  const cy = y0 + h / 2;
  const y = (value) => round(value > cy ? cy + (value - cy) * (1 + drop / (h / 2)) : value);
  const p = (px, py) => `${round(px)} ${y(py)}`;
  const x1 = x + w, y1 = y0 + h;
  return `M${p(x + r, y0)} L${p(x1 - r, y0)} C${p(x1 - r + r * K, y0)} ${p(x1, y0 + r - r * K)} ${p(x1, y0 + r)} L${p(x1, y1 - r)} C${p(x1, y1 - r + r * K)} ${p(x1 - r + r * K, y1)} ${p(x1 - r, y1)} L${p(x + r, y1)} C${p(x + r - r * K, y1)} ${p(x, y1 - r + r * K)} ${p(x, y1 - r)} L${p(x, y0 + r)} C${p(x, y0 + r - r * K)} ${p(x + r - r * K, y0)} ${p(x + r, y0)} Z`;
}

const head = (slug, name, description, draw, box) => Object.freeze({
  id: `head.${slug}`, category: 'head', name, description, origin: 'builtin',
  artwork: `<g id="head-${slug}" data-name="Head"><path id="skull" data-name="Skull" d="${draw(0)}" fill="${SKIN}" stroke="${LINE}" stroke-width="4" /></g>`,
  roles: Object.freeze({ head: 'skull' }),
  capabilities: Object.freeze(['headX', 'headY', 'headTilt']),
  // The jaw takes the skull; the pose is the skull with its chin dropped.
  parts: Object.freeze({ jaw: Object.freeze({ roles: Object.freeze({}), capabilities: Object.freeze(['jawOpen']), drivers: Object.freeze({ jawOpen: Object.freeze({ property: 'shapeKey', posePath: draw(JAW_DROP) }) }) }) }),
  paletteRoles: Object.freeze({ skull: Object.freeze({ fill: 'skin', stroke: 'outline' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'head.center',
  palette: Object.freeze(['skin', 'outline'])
});

/**
 * The three shapes a width rule says better than a radius does.
 *
 * ```text
 * pear    a narrow brow over a heavy jaw, flattened underneath
 * chin    wide cheeks, a jaw that turns a corner, a chin with an edge to it
 * heart   a broad brow falling away to a small, round chin
 * ```
 */
const PEAR = Object.freeze({ lean: 0.3, crown: 2, jaw: 2.7 });
const CHIN = Object.freeze({ lean: 0, crown: 1.9, jaw: 4.2 });
const HEART = Object.freeze({ lean: -0.28, crown: 2.6, jaw: 2.2 });
const shaped = (shape, rx, ry) => ({ shape, rx, ry });

export const HEAD_ROUND = head('round', 'Round', 'A round skull.', (drop) => ovalPath(120, 116, 94, 94, drop), { x: 26, y: 22, width: 188, height: 188 });
export const HEAD_OVAL = head('oval', 'Oval', 'A tall oval skull.', (drop) => ovalPath(120, 116, 84, 96, drop), { x: 36, y: 20, width: 168, height: 192 });
export const HEAD_WIDE = head('wide', 'Wide', 'A broad skull, wider than it is tall.', (drop) => ovalPath(120, 116, 98, 82, drop), { x: 22, y: 34, width: 196, height: 164 });
export const HEAD_NARROW = head('narrow', 'Narrow', 'A narrow, long skull.', (drop) => ovalPath(120, 116, 72, 98, drop), { x: 48, y: 18, width: 144, height: 196 });
export const HEAD_SQUARE_SOFT = head('square-soft', 'Square', 'A square skull with soft corners.', (drop) => softSquarePath(30, 24, 180, 184, 46, drop), { x: 30, y: 24, width: 180, height: 184 });
export const HEAD_PEAR = head('pear', 'Pear', 'A narrow brow over a heavy jaw.', (drop) => shapedPath(120, 116, 74, 94, PEAR, drop), shapedBox(120, 116, 74, 94, PEAR));
export const HEAD_CHIN = head('chin', 'Strong chin', 'Wide cheeks, a jaw that turns a corner, a flat chin.', (drop) => shapedPath(120, 116, 84, 93, CHIN, drop), shapedBox(120, 116, 84, 93, CHIN));
export const HEAD_HEART = head('heart', 'Heart', 'A broad brow tapering to a small chin.', (drop) => shapedPath(120, 116, 76, 94, HEART, drop), shapedBox(120, 116, 76, 94, HEART));

/**
 * The eight shapes, in the order the picker lays them out: the four round
 * ones first -- round, oval, wide, narrow, which differ only in how tall and
 * how wide -- and then the four with a shape of their own.
 */
export const HEADS = Object.freeze([
  HEAD_ROUND, HEAD_OVAL, HEAD_WIDE, HEAD_NARROW, HEAD_SQUARE_SOFT, HEAD_PEAR, HEAD_CHIN, HEAD_HEART
]);
