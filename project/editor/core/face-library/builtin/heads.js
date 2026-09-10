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

export const HEAD_ROUND = head('round', 'Round', 'A round skull.', (drop) => ovalPath(120, 116, 94, 94, drop), { x: 26, y: 22, width: 188, height: 188 });
export const HEAD_OVAL = head('oval', 'Oval', 'A tall oval skull.', (drop) => ovalPath(120, 116, 84, 96, drop), { x: 36, y: 20, width: 168, height: 192 });
export const HEAD_SQUARE_SOFT = head('square-soft', 'Square', 'A square skull with soft corners.', (drop) => softSquarePath(30, 24, 180, 184, 46, drop), { x: 30, y: 24, width: 180, height: 184 });
export const HEAD_NARROW = head('narrow', 'Narrow', 'A narrow, long skull.', (drop) => ovalPath(120, 116, 72, 98, drop), { x: 48, y: 18, width: 144, height: 196 });

export const HEADS = Object.freeze([HEAD_ROUND, HEAD_OVAL, HEAD_SQUARE_SOFT, HEAD_NARROW]);
