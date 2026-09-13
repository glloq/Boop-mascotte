/**
 * The curves the animal parts are drawn from (MASC-10B).
 *
 * The human library draws its skulls from an ellipse and a width rule
 * (`builtin/heads.js`). An animal face needs one thing those cannot say: a
 * **fur edge**. A cat's silhouette is not a smooth oval, it is an oval with the
 * coat breaking it — and on a mascot the head outline is the one line nothing
 * else hides, so the break has to be regular enough to read as fur rather than
 * as a dent.
 *
 * So the same idea as `shapedPath`, sampled round the whole ring instead of
 * down the height, with the radius modulated by a small alternating wobble:
 * one crest and one valley per tuft, joined by the same Catmull-Rom that keeps
 * the human skulls from rippling.
 */
const round = (value) => Math.round(value * 100) / 100;

/**
 * One closed curve through every sample, tangents scaled by the chords either
 * side of each point. Lifted from `builtin/heads.js` so the two agree: a
 * ripple in an animal's outline would read exactly as a ripple in a person's.
 */
export function closedCurve(ring) {
  const count = ring.length, at = (index) => ring[((index % count) + count) % count];
  const chord = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
  const out = [`M${round(ring[0][0])} ${round(ring[0][1])}`];
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

/**
 * Where the ring of a furred skull sits, before it is turned into a curve.
 *
 * ```text
 * tufts   how many times the coat breaks the outline
 * depth   how far it breaks it, as a fraction of the radius
 * lean    + is heavy below, - heavy above, as the human width rule's
 * crown   how square the top is; jaw, how square the bottom
 * drop    the chin stretched down, for the jaw pose
 * ```
 *
 * The wobble alternates crest and valley sample by sample, so `tufts` crests
 * need `tufts * 2` samples and no more: one more would put two crests where the
 * coat has one.
 */
export function furRing(cx, cy, rx, ry, { tufts = 20, depth = 0.03, lean = 0, crown = 2, jaw = 2 } = {}, drop = 0) {
  const stretch = (value) => (value > cy ? cy + (value - cy) * (1 + drop / ry) : value);
  const steps = tufts * 2, ring = [];
  for (let step = 0; step < steps; step += 1) {
    // From the top, clockwise. The ring is symmetric about x = cx by
    // construction, because the wobble is a function of the step and the
    // steps are even: a coat that was heavier on one side would read as a
    // head drawn crooked.
    const angle = (step / steps) * Math.PI * 2 - Math.PI / 2;
    const across = Math.cos(angle), down = Math.sin(angle);
    const power = crown + (jaw - crown) * ((down + 1) / 2);
    const radius = 1 / ((Math.abs(across) ** power + Math.abs(down) ** power) ** (1 / power));
    const wobble = 1 + depth * (step % 2 ? -1 : 1);
    ring.push([cx + rx * across * radius * wobble * (1 + lean * down), stretch(cy + ry * down * radius * wobble)]);
  }
  return ring;
}

/** A furred skull as one path. */
export const furPath = (cx, cy, rx, ry, shape, drop = 0) => closedCurve(furRing(cx, cy, rx, ry, shape, drop));

/**
 * The box a furred skull fills, measured off the ring it is drawn from rather
 * than guessed: the tufts stick out, and a box that ignored them would place
 * every other part a little too high (docs/FACE_ASSET_AUTHORING.md).
 */
export function furBox(cx, cy, rx, ry, shape) {
  const ring = furRing(cx, cy, rx, ry, shape);
  const xs = ring.map(([x]) => x), ys = ring.map(([, y]) => y);
  const left = Math.min(...xs), top = Math.min(...ys);
  return { x: round(left), y: round(top), width: round(Math.max(...xs) - left), height: round(Math.max(...ys) - top) };
}

/** A triangle with rounded corners, as an ear or a nose wants one. */
export function roundedTriangle(points, radius) {
  const parts = [];
  for (let index = 0; index < 3; index += 1) {
    const previous = points[(index + 2) % 3], point = points[index], next = points[(index + 1) % 3];
    const toward = (from, to) => {
      const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
      const length = Math.hypot(dx, dy) || 1e-6, step = Math.min(radius, length / 2) / length;
      return [round(from[0] + dx * step), round(from[1] + dy * step)];
    };
    const entry = toward(point, previous), exit = toward(point, next);
    parts.push(index === 0 ? `M${entry[0]} ${entry[1]}` : `L${entry[0]} ${entry[1]}`);
    parts.push(`Q${round(point[0])} ${round(point[1])} ${exit[0]} ${exit[1]}`);
  }
  return `${parts.join(' ')} Z`;
}

/** An ellipse as four cubics: the same K the human heads use. */
const K = 0.5523;
export function ovalPath(cx, cy, rx, ry) {
  const p = (px, py) => `${round(px)} ${round(py)}`;
  return `M${p(cx, cy - ry)} C${p(cx + rx * K, cy - ry)} ${p(cx + rx, cy - ry * K)} ${p(cx + rx, cy)}`
    + ` C${p(cx + rx, cy + ry * K)} ${p(cx + rx * K, cy + ry)} ${p(cx, cy + ry)}`
    + ` C${p(cx - rx * K, cy + ry)} ${p(cx - rx, cy + ry * K)} ${p(cx - rx, cy)}`
    + ` C${p(cx - rx, cy - ry * K)} ${p(cx - rx * K, cy - ry)} ${p(cx, cy - ry)} Z`;
}

/** The box a list of boxes covers. */
export function unionBox(...boxes) {
  const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
  return {
    x: round(left), y: round(top),
    width: round(Math.max(...boxes.map((box) => box.x + box.width)) - left),
    height: round(Math.max(...boxes.map((box) => box.y + box.height)) - top)
  };
}

export { round };
