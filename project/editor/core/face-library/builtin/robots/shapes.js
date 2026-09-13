/**
 * The path helpers the robot pack is built from.
 *
 * An animal is curves and a machine is boxes, so almost nothing here is shared
 * with `animals/shapes.js`: what a fur ring was to a coat, a rounded rectangle
 * is to a shell. Four shapes say nearly the whole planche — a rounded box, a
 * disc, a ring of bolts and a field of holes — and everything else is those
 * four at different sizes.
 *
 * Every helper returns a path string in the template frame
 * (docs/FACE_ASSET_AUTHORING.md): the face's middle at 120, 116, the eyes at
 * y 113, the brow line at 81, the mouth at 176.
 */
const K = 0.5523;
const round = (value) => Math.round(value * 100) / 100;

/** Mirror an offset across the face's middle: `at(-1, 40)` is 80, `at(1, 40)` is 160. */
export const at = (sign, offset) => round(120 + sign * offset);

/**
 * A rounded rectangle, corner radius `r`, as four lines and four cubics.
 *
 * The workhorse of the pack: a shell, a bezel, a visor plate, a speaker
 * capsule and a panel are all this at different proportions. `r` is clamped to
 * half the shorter side, so a very round box degrades to a stadium rather than
 * folding through itself.
 */
export function boxPath(x, y, w, h, r = 0) {
  const radius = Math.min(r, w / 2, h / 2);
  if (radius <= 0) return `M${round(x)} ${round(y)} L${round(x + w)} ${round(y)} L${round(x + w)} ${round(y + h)} L${round(x)} ${round(y + h)} Z`;
  const p = (px, py) => `${round(px)} ${round(py)}`;
  const [x1, y1] = [x + w, y + h], c = radius * (1 - K);
  return `M${p(x + radius, y)} L${p(x1 - radius, y)} C${p(x1 - c, y)} ${p(x1, y + c)} ${p(x1, y + radius)}`
    + ` L${p(x1, y1 - radius)} C${p(x1, y1 - c)} ${p(x1 - c, y1)} ${p(x1 - radius, y1)}`
    + ` L${p(x + radius, y1)} C${p(x + c, y1)} ${p(x, y1 - c)} ${p(x, y1 - radius)}`
    + ` L${p(x, y + radius)} C${p(x, y + c)} ${p(x + c, y)} ${p(x + radius, y)} Z`;
}

/** An ellipse as four cubics. The same construction the human skulls use. */
export function ovalPath(cx, cy, rx, ry) {
  const p = (px, py) => `${round(px)} ${round(py)}`;
  return `M${p(cx, cy - ry)} C${p(cx + rx * K, cy - ry)} ${p(cx + rx, cy - ry * K)} ${p(cx + rx, cy)}`
    + ` C${p(cx + rx, cy + ry * K)} ${p(cx + rx * K, cy + ry)} ${p(cx, cy + ry)}`
    + ` C${p(cx - rx * K, cy + ry)} ${p(cx - rx, cy + ry * K)} ${p(cx - rx, cy)}`
    + ` C${p(cx - rx, cy - ry * K)} ${p(cx - rx * K, cy - ry)} ${p(cx, cy - ry)} Z`;
}

/**
 * A ring of bolt heads around a centre, as one path of small circles.
 *
 * The industrial family's signature, and the reason it is one path rather than
 * several elements: a role names one element, and a dozen bolts that each moved
 * on their own would be a dozen things to rig for no expressive gain.
 */
export function boltRing(cx, cy, radius, count, size = 2.6) {
  const out = [];
  for (let step = 0; step < count; step += 1) {
    const angle = (Math.PI * 2 * step) / count - Math.PI / 2;
    out.push(ovalPath(round(cx + Math.cos(angle) * radius), round(cy + Math.sin(angle) * radius), size, size));
  }
  return out.join(' ');
}

/**
 * A row of `count` vertical bars filling a box: a speaker grille, a vent, a
 * louvre stack turned on its side. `gap` is the share of each cell left empty.
 */
export function barField(x, y, w, h, count, { gap = 0.42, radius = 1.2, horizontal = false } = {}) {
  const out = [];
  const span = (horizontal ? h : w) / count, thick = span * (1 - gap);
  for (let step = 0; step < count; step += 1) {
    const offset = span * step + (span - thick) / 2;
    out.push(horizontal ? boxPath(x, round(y + offset), w, round(thick), radius) : boxPath(round(x + offset), y, round(thick), h, radius));
  }
  return out.join(' ');
}

/**
 * A grid of round holes filling a box: a perforated plate, a dot-matrix mouth,
 * a pixel display. `cols` across, `rows` down, each hole `size` across.
 */
export function dotField(x, y, w, h, cols, rows, size = 2.2) {
  const out = [];
  const stepX = w / cols, stepY = h / rows;
  for (let column = 0; column < cols; column += 1) {
    for (let line = 0; line < rows; line += 1) {
      out.push(ovalPath(round(x + stepX * (column + 0.5)), round(y + stepY * (line + 0.5)), size, size));
    }
  }
  return out.join(' ');
}

/**
 * A five-pointed star, point up. The toy family's own shape, and the only
 * thing in the pack that is neither a box nor a disc.
 */
export function starPath(cx, cy, outer, inner = outer * 0.44) {
  const points = [];
  for (let step = 0; step < 10; step += 1) {
    const radius = step % 2 ? inner : outer;
    const angle = (Math.PI * step) / 5 - Math.PI / 2;
    points.push(`${round(cx + Math.cos(angle) * radius)} ${round(cy + Math.sin(angle) * radius)}`);
  }
  return `M${points.join(' L')} Z`;
}

/** A heart, point down, drawn as two arcs meeting at the tip. */
export function heartPath(cx, cy, size) {
  const p = (px, py) => `${round(px)} ${round(py)}`;
  const lobe = size * 0.52;
  return `M${p(cx, cy + size * 0.85)} C${p(cx - size * 1.05, cy)} ${p(cx - size, cy - size * 0.95)} ${p(cx - lobe, cy - size * 0.62)}`
    + ` C${p(cx - size * 0.2, cy - size * 0.95)} ${p(cx, cy - size * 0.72)} ${p(cx, cy - size * 0.42)}`
    + ` C${p(cx, cy - size * 0.72)} ${p(cx + size * 0.2, cy - size * 0.95)} ${p(cx + lobe, cy - size * 0.62)}`
    + ` C${p(cx + size, cy - size * 0.95)} ${p(cx + size * 1.05, cy)} ${p(cx, cy + size * 0.85)} Z`;
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
