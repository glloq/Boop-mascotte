#!/usr/bin/env node
/**
 * The seed that **wrote** the shipped hand set. It is not a build step.
 *
 * ```sh
 * node scripts/hand-set-seed.mjs            # overwrites project/assets/hands/defaultCartoon/
 * ```
 *
 * A gesture is a drawing on disk now (docs/HAND_STYLES.md, "A gesture is a
 * file"): `project/assets/hands/<set>/<gesture>.svg`, one `<g>` of named
 * layers, and a `manifest.json` beside them that says what the set is. **Those
 * files are the source of truth** — the editor reads them, an author edits
 * them, and a ninth gesture is a ninth file. Running this again throws that
 * away and puts the original eight back, which is occasionally what you want
 * and never what you want by accident. It is deliberately wired to no npm
 * script.
 *
 * What is here is therefore not "how a hand is drawn" — it is how these eight
 * were drawn, once. The geometry below is the authoring pass and nothing in
 * the editor imports it.
 *
 * Pure geometry and strings; no DOM. Node >= 22.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* ── A very small path kit ─────────────────────────────────────────────────── */

const K = 0.5522847498;
const r1 = (value) => Math.round(value * 10) / 10;
const p = ([x, y]) => `${r1(x)} ${r1(y)}`;
const c = (a, b, to) => `C ${p(a)} ${p(b)} ${p(to)}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = ([x, y], k) => [x * k, y * k];
const length = ([x, y]) => Math.hypot(x, y) || 1;
const unit = (v) => mul(v, 1 / length(v));

/** A half-circle of radius `r` around `centre`, from `+n` through `along` to `-n`. */
function cap(centre, n, along, r) {
  const k = K * r;
  const start = add(centre, mul(n, r)), mid = add(centre, mul(along, r)), end = sub(centre, mul(n, r));
  return `${c(add(start, mul(along, k)), add(mid, mul(n, k)), mid)} ${c(sub(mid, mul(n, k)), add(end, mul(along, k)), end)}`;
}

/** A finger: a capsule from base to tip, rounded at both ends. */
function capsule(base, tip, r) {
  const along = unit(sub(tip, base)), n = [along[1], -along[0]];
  return `M ${p(add(base, mul(n, r)))} L ${p(add(tip, mul(n, r)))} ${cap(tip, n, along, r)}`
    + ` L ${p(sub(base, mul(n, r)))} ${cap(base, mul(n, -1), mul(along, -1), r)} Z`;
}

/**
 * The palm: a rounded rectangle, not an ellipse.
 *
 * A palm drawn as an ellipse reads as a ball with fingers stuck in it. What
 * makes it read as a palm is that its sides are straight and its corners are
 * round.
 */
function roundedRect(x0, y0, x1, y1, r) {
  const k = K * r;
  return `M ${p([x0 + r, y0])} L ${p([x1 - r, y0])}`
    + ` ${c([x1 - r + k, y0], [x1, y0 + r - k], [x1, y0 + r])} L ${p([x1, y1 - r])}`
    + ` ${c([x1, y1 - r + k], [x1 - r + k, y1], [x1 - r, y1])} L ${p([x0 + r, y1])}`
    + ` ${c([x0 + r - k, y1], [x0, y1 - r + k], [x0, y1 - r])} L ${p([x0, y0 + r])}`
    + ` ${c([x0, y0 + r - k], [x0 + r - k, y0], [x0 + r, y0])} Z`;
}

/**
 * The ring the OK sign makes: two circles wound opposite ways, so the inside
 * is a hole under `fill-rule="evenodd"` and the stroke draws both edges.
 */
function ring([cx, cy], outer, inner) {
  const circle = (r, clockwise) => {
    const k = K * r, s = clockwise ? 1 : -1;
    return `M ${p([cx, cy - r])} ${c([cx + s * k, cy - r], [cx + s * r, cy - k], [cx + s * r, cy])}`
      + ` ${c([cx + s * r, cy + k], [cx + s * k, cy + r], [cx, cy + r])}`
      + ` ${c([cx - s * k, cy + r], [cx - s * r, cy + k], [cx - s * r, cy])}`
      + ` ${c([cx - s * r, cy - k], [cx - s * k, cy - r], [cx, cy - r])} Z`;
  };
  return `${circle(outer, true)} ${circle(inner, false)}`;
}

/* ── The hand, in its own units: the pivot is the middle of the palm ───────── */

const PALM = Object.freeze({ left: -24, top: -12, right: 24, bottom: 28, round: 17 });
const FINGER = 7.5, THUMB = 9;
const ROOT = Object.freeze({ index: [-15.5, 6], middle: [0, 6], ring: [15.5, 6] });

const layer = (part, d) => ({ part, d });
const palm = () => layer('palm', roundedRect(PALM.left, PALM.top, PALM.right, PALM.bottom, PALM.round));
const finger = (part, tip, r = FINGER) => ({ ...layer(part, capsule(ROOT[part], tip, r)), tip, r });
const fold = (part, height) => ({ ...layer(part, capsule(ROOT[part], [ROOT[part][0], height], FINGER)), tip: [ROOT[part][0], height], r: FINGER });
const thumb = (base, tip, r = THUMB) => ({ ...layer('thumb', capsule(base, tip, r)), tip, r });

/**
 * The eight gestures, each as layers **back to front**.
 *
 * The order is the whole trick, and it is what one path could never do: a
 * finger before the palm grows out of it, a thumb after it lies **on** it. A
 * folded thumb in front of a fist is a shape on top, not a bite out of the
 * side.
 */
const GESTURES = {
  relaxed: { label: 'Relaxed', layers: [
    finger('index', [-17, -18]), finger('middle', [-1, -22]), finger('ring', [15, -19]),
    thumb([-17, 13], [-33, 4], 8.5), palm()
  ] },
  open: { label: 'Open', layers: [
    finger('index', [-22, -24]), finger('middle', [-1, -30]), finger('ring', [20, -22]),
    thumb([-15, 10], [-34, -1]), palm()
  ] },
  fist: { label: 'Fist', layers: [
    palm(), fold('index', -12), fold('middle', -14), fold('ring', -12),
    thumb([-25, 14], [-6, 7], THUMB - 1)
  ] },
  point: { label: 'Point', layers: [
    finger('index', [-15, -32]), palm(), fold('middle', -10), fold('ring', -9),
    thumb([-25, 14], [-6, 7], THUMB - 1)
  ] },
  thumbsUp: { label: 'Thumbs up', layers: [
    thumb([-13, 8], [-15, -30], 7.5), palm(),
    { ...layer('fingers', capsule([-12, -3], [12, 0], 8.5)), tip: [12, 0], r: 8.5 }
  ] },
  peace: { label: 'Peace', layers: [
    finger('index', [-23, -27]), finger('middle', [3, -30]), palm(), fold('ring', -10),
    thumb([-25, 14], [-6, 7], THUMB - 1)
  ] },
  ok: { label: 'OK', layers: [
    finger('middle', [3, -29]), finger('ring', [19, -22]), palm(),
    layer('loop', ring([-20, -16], 13.5, 7))
  ] },
  sideFist: { label: 'Closed side', layers: [
    palm(), { ...layer('fingers', capsule([-14, -9], [13, -5], 8)), tip: [13, -5], r: 8 },
    thumb([-20, 13], [-2, 7], THUMB - 1.5)
  ] }
};

/** What each layer is called in the layer tree. */
const LABELS = { palm: 'Palm', thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', fingers: 'Fingers', loop: 'Ring' };
/** Which token each layer takes when a mascot paints its hands in its own colours. */
const PAINT = Object.freeze({ fill: 'skin', stroke: 'outline' });

/* ── The files ─────────────────────────────────────────────────────────────── */

const VIEW_BOX = { width: 200, height: 200 };
const PIVOT = [100, 100];
const SCALE = 2;
const LOOK = { fill: '#ffffff', line: '#1b1b1b', width: 1.9 };
const SET = 'defaultCartoon';
const OUT = fileURLToPath(new URL(`../project/assets/hands/${SET}/`, import.meta.url));

/** A path in the drawing's own units, placed into the file's 200-box. */
const place = (d) => d.replace(/-?\d+(?:\.\d+)?/g, (() => {
  let index = 0;
  return (token) => {
    const even = index % 2 === 0;
    index += 1;
    return String(r1(Number(token) * SCALE + PIVOT[even ? 0 : 1]));
  };
})());

const gestureMarkup = (id) => `<g id="hand-${id}" data-name="${GESTURES[id].label}">`
  + GESTURES[id].layers.map((item) => `<path id="${item.part}" data-name="${LABELS[item.part] || item.part}"`
    + ` d="${place(item.d)}" fill="${LOOK.fill}"${item.part === 'loop' ? ' fill-rule="evenodd"' : ''}`
    + ` stroke="${LOOK.line}" stroke-width="${r1(LOOK.width * SCALE)}" stroke-linejoin="round" stroke-linecap="round" />`).join('')
  + '</g>';

const gestureFile = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}"`
  + ` width="${VIEW_BOX.width}" height="${VIEW_BOX.height}" data-hand-pivot="${PIVOT.join(' ')}"`
  + ` data-hand-scale="${SCALE}">${gestureMarkup(id)}</svg>\n`;

/** The radius every drawing fits inside, read off the drawings rather than guessed. */
const radius = (() => {
  let out = 0;
  for (const gesture of Object.values(GESTURES)) {
    for (const item of gesture.layers) {
      for (const match of item.d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
        out = Math.max(out, Math.hypot(Number(match[1]), Number(match[2])));
      }
    }
  }
  return Math.round((out + LOOK.width / 2) * 10) / 10;
})();

const ids = Object.keys(GESTURES);
const manifest = {
  format: 'boop-hand-set',
  version: 1,
  set: SET,
  name: 'Cartoon gloves',
  look: 'glove',
  viewBox: `0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`,
  pivot: [...PIVOT],
  scale: SCALE,
  radius,
  defaultScale: 1,
  fallback: 'relaxed',
  gestures: ids.map((id) => ({
    id,
    label: GESTURES[id].label,
    src: `${id}.svg`,
    mirrorable: true,
    // Which layer plays which part, for the layer tree and for anything that
    // wants to hold a hand by its fingertip.
    roles: Object.fromEntries(GESTURES[id].layers.map((item) => [item.part, LABELS[item.part] || item.part])),
    paletteRoles: Object.fromEntries(GESTURES[id].layers.map((item) => [item.part, { ...PAINT }])),
    // The point of each drawn fingertip, in the drawing's own units.
    anchors: Object.fromEntries(GESTURES[id].layers.filter((item) => item.tip && item.part !== 'palm').map((item) => {
      const base = ROOT[item.part] || null;
      const out = base ? add(item.tip, mul(unit(sub(item.tip, base)), item.r)) : item.tip;
      return [item.part, [r1(out[0]), r1(out[1])]];
    }))
  }))
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const id of ids) writeFileSync(`${OUT}${id}.svg`, gestureFile(id));
writeFileSync(`${OUT}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`seeded ${ids.length} gestures and a manifest into ${OUT}`);
console.log(`  radius ${radius}, pivot ${PIVOT.join(',')}, scale ${SCALE}`);
console.log('  these files are the source of truth now — the editor reads them');
