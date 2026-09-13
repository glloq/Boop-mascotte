/**
 * The path helpers the bird pack is built from.
 *
 * A bird is between the other two packs: softer than a machine, harder than an
 * animal. Its silhouette is a smooth closed curve like a coat outline but
 * without the fur wobble, and everything on it — a beak, a feather, a tuft — is
 * a shape with a point somewhere in it.
 *
 * Every helper returns a path string in the template frame
 * (docs/FACE_ASSET_AUTHORING.md): the face's middle at 120, 116, the eyes at
 * y 113, the brow line at 81, the mouth at 176, the crown at 22.
 */
const K = 0.5523;
const round = (value) => Math.round(value * 100) / 100;

/** Mirror an offset across the face's middle. */
export const at = (sign, offset) => round(120 + sign * offset);

/** An ellipse as four cubics. The construction every skull in this library uses. */
export function ovalPath(cx, cy, rx, ry) {
  const p = (px, py) => `${round(px)} ${round(py)}`;
  return `M${p(cx, cy - ry)} C${p(cx + rx * K, cy - ry)} ${p(cx + rx, cy - ry * K)} ${p(cx + rx, cy)}`
    + ` C${p(cx + rx, cy + ry * K)} ${p(cx + rx * K, cy + ry)} ${p(cx, cy + ry)}`
    + ` C${p(cx - rx * K, cy + ry)} ${p(cx - rx, cy + ry * K)} ${p(cx - rx, cy)}`
    + ` C${p(cx - rx, cy - ry * K)} ${p(cx - rx * K, cy - ry)} ${p(cx, cy - ry)} Z`;
}

/** One closed curve through every sample: Catmull-Rom written as cubics. */
export function closedCurve(ring) {
  const count = ring.length, pick = (index) => ring[((index % count) + count) % count];
  const chord = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
  const out = [`M${round(ring[0][0])} ${round(ring[0][1])}`];
  for (let index = 0; index < count; index += 1) {
    const [p0, p1, p2, p3] = [pick(index - 1), pick(index), pick(index + 1), pick(index + 2)];
    const [before, span, after] = [chord(p0, p1), chord(p1, p2), chord(p2, p3)];
    const lead = span / (before + span) / 3, trail = span / (span + after) / 3;
    out.push(`C${round(p1[0] + (p2[0] - p0[0]) * lead)} ${round(p1[1] + (p2[1] - p0[1]) * lead)}`
      + ` ${round(p2[0] - (p3[0] - p1[0]) * trail)} ${round(p2[1] - (p3[1] - p1[1]) * trail)}`
      + ` ${round(p2[0])} ${round(p2[1])}`);
  }
  return `${out.join(' ')} Z`;
}

/**
 * A head silhouette from a **width rule**, sampled by angle: the same
 * superellipse the human skulls use, so `lean`, `crown` and `jaw` mean here
 * exactly what they mean there.
 *
 * ```text
 * lean    where the width sits: + is heavy below, - heavy above
 * crown   how square the top is: 2 is a circle's shoulder, 3 a flat brow
 * jaw     how square the bottom is: 2 is a round chin, 3.5 turns a corner
 * ```
 */
export function birdRing(cx, cy, rx, ry, { lean = 0, crown = 2, jaw = 2 } = {}, steps = 24) {
  const half = (u) => {
    const power = crown + (jaw - crown) * ((u + 1) / 2);
    return rx * (1 - Math.abs(u) ** power) ** (1 / power) * (1 + lean * u);
  };
  const right = [], left = [];
  for (let step = 1; step < steps; step += 1) {
    const u = -Math.cos((Math.PI * step) / steps), width = half(u), y = cy + u * ry;
    right.push([cx + width, y]);
    left.unshift([cx - width, y]);
  }
  return [[cx, cy - ry], ...right, [cx, cy + ry], ...left];
}

/** The box a width-ruled head fills: as wide as it ever gets, crown to chin. */
export function birdBox(cx, cy, rx, ry, shape) {
  let widest = 0;
  for (let step = 0; step <= 200; step += 1) {
    const u = -1 + (2 * step) / 200;
    const power = shape.crown + (shape.jaw - shape.crown) * ((u + 1) / 2);
    widest = Math.max(widest, rx * (1 - Math.abs(u) ** power) ** (1 / power) * (1 + (shape.lean || 0) * u));
  }
  const half = Math.round(widest);
  return { x: cx - half, y: cy - ry, width: half * 2, height: ry * 2 };
}

/** A triangle with its corners rounded off by `radius`: the shape most of a beak is. */
export function roundedTriangle(points, radius) {
  const out = [];
  for (let index = 0; index < points.length; index += 1) {
    const [x, y] = points[index];
    const [px, py] = points[(index + points.length - 1) % points.length];
    const [nx, ny] = points[(index + 1) % points.length];
    const back = Math.hypot(x - px, y - py) || 1, forward = Math.hypot(nx - x, ny - y) || 1;
    const cut = Math.min(radius, back / 2, forward / 2);
    const enter = [x + ((px - x) / back) * cut, y + ((py - y) / back) * cut];
    const leave = [x + ((nx - x) / forward) * cut, y + ((ny - y) / forward) * cut];
    out.push(index === 0 ? `M${round(enter[0])} ${round(enter[1])}` : `L${round(enter[0])} ${round(enter[1])}`);
    out.push(`Q${round(x)} ${round(y)} ${round(leave[0])} ${round(leave[1])}`);
  }
  return `${out.join(' ')} Z`;
}

/**
 * A feather: a leaf standing on `(x, base)`, `height` tall and `width` across
 * at its widest, leaning by `lean` at the tip.
 *
 * The pack's second workhorse after the head rule — a crest is feathers, a tuft
 * is short ragged feathers, and the owl's aigrettes are two sharp ones.
 */
export function featherPath(x, base, height, width, { lean = 0, sharp = 0.5 } = {}) {
  const tip = [x + lean, base - height];
  const belly = base - height * sharp;
  const p = (px, py) => `${round(px)} ${round(py)}`;
  return `M${p(x, base)} C${p(x - width, belly)} ${p(tip[0] - width * 0.35, base - height * 0.82)} ${p(tip[0], tip[1])}`
    + ` C${p(tip[0] + width * 0.35, base - height * 0.82)} ${p(x + width, belly)} ${p(x, base)} Z`;
}

/** The smallest box holding every box given. */
export function unionBox(...boxes) {
  const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y));
  return {
    x, y,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - y
  };
}

export { round };
