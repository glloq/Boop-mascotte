#!/usr/bin/env node
/**
 * The shipped hand set, written to disk (docs/HAND_STYLES.md).
 *
 * ```sh
 * npm run hands:styles                      # writes project/assets/hands/defaultCartoon/
 * node scripts/hand-styles.mjs --styles open,fist --out /tmp/hands
 * node scripts/hand-styles.mjs --sheet      # ...and a contact sheet
 * ```
 *
 * ```text
 * project/assets/hands/
 *   defaultCartoon/
 *     manifest.json
 *     relaxed.svg  open.svg  fist.svg  point.svg  thumbs-up.svg  peace.svg
 *     sheets/hands.svg                             all of it, side by side
 * ```
 *
 * **One file per style, not one per side.** Every style in the shipped set is
 * mirrorable, so the right hand is the same drawing with a negative x scale
 * about the same pivot (docs/HAND_STYLES.md, "Mirroring") — six files where
 * there used to be twenty.
 *
 * Every file shares one box, one pivot and one scale, so a hand that changes
 * style does not change size or move. Nothing in a file is specific to a
 * mascot — no document ids, no rig transforms, no offsets baked in to correct
 * for one — which is what makes the directory the shape a **custom** hand set
 * takes too.
 *
 * The set the editor installs is drawn from the same functions, into the
 * mascot's own SVG. These files are the library, the reference and the visual
 * snapshot; they are not fetched at runtime.
 *
 * Pure geometry and strings; no DOM. Node >= 22.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HAND_SIDES, HAND_STYLE_IDS, handStyleLabel } from '../project/runtime/hand-vocabulary.js';
import {
  HAND_STYLE_PIVOT, HAND_STYLE_RADIUS, HAND_STYLE_SPRITE_SCALE, HAND_STYLE_VIEW_BOX, HAND_STYLE_VIEW_BOX_ATTRIBUTE,
  handStyleDocument, handStyleManifest, handStyleMarkup, handStylePath
} from '../project/editor/core/hands/hand-style-art.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const list = (name, fallback) => { const value = option(name, null); return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback; };

const SET = option('--set', 'defaultCartoon');
const OUT = option('--out', fileURLToPath(new URL('../project/assets/hands/', import.meta.url)));
const STYLES = list('--styles', [...HAND_STYLE_IDS]);
const LOOK = option('--look', 'glove');
const SHEET = args.includes('--sheet');

/* ── The files ─────────────────────────────────────────────────────────────── */

rmSync(`${OUT}${SET}`, { recursive: true, force: true });
mkdirSync(`${OUT}${SET}`, { recursive: true });
let written = 0;
for (const style of STYLES) {
  const file = handStyleDocument(style, { look: LOOK });
  if (!file) throw new Error(`${style} is not a style this library draws`);
  writeFileSync(`${OUT}${handStylePath(SET, style)}`, file);
  written += 1;
}

const manifest = handStyleManifest({ set: SET, styles: STYLES, look: LOOK });
writeFileSync(`${OUT}${SET}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

/* ── The contact sheet ─────────────────────────────────────────────────────── */

/**
 * Every style, both hands, at the same size around the same pivot. The sheet an
 * author checks a set against: a drawing that is bigger, shifted or facing the
 * wrong way shows up here and nowhere else.
 */
if (SHEET) {
  const cell = HAND_STYLE_VIEW_BOX.width;
  mkdirSync(`${OUT}${SET}/sheets`, { recursive: true });
  const body = HAND_SIDES.flatMap((side, row) => STYLES.map((style, column) =>
    `<g transform="translate(${column * cell} ${row * cell})">`
    + `<rect width="${cell}" height="${cell}" fill="none" stroke="#e3e3e3"/>`
    + `<circle cx="${HAND_STYLE_PIVOT[0]}" cy="${HAND_STYLE_PIVOT[1]}" r="3" fill="#d33"/>`
    + `<circle cx="${HAND_STYLE_PIVOT[0]}" cy="${HAND_STYLE_PIVOT[1]}" r="${HAND_STYLE_RADIUS * HAND_STYLE_SPRITE_SCALE}" fill="none" stroke="#cfe4ff"/>`
    + handStyleMarkup(side, style, { at: { x: HAND_STYLE_PIVOT[0], y: HAND_STYLE_PIVOT[1] }, scale: HAND_STYLE_SPRITE_SCALE, look: LOOK })
      .replace(/ id="[^"]*"/g, '')
    + `<text x="6" y="16" font-family="ui-monospace, monospace" font-size="11" fill="#666">${side} · ${handStyleLabel(style)}</text></g>`)).join('');
  writeFileSync(`${OUT}${SET}/sheets/hands.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STYLES.length * cell} ${HAND_SIDES.length * cell}" width="${STYLES.length * cell}" height="${HAND_SIDES.length * cell}">${body}</svg>\n`);
}

/* ── Checks ────────────────────────────────────────────────────────────────── */

// A manifest that does not name a file it wrote is a manifest of nothing.
const files = new Set(STYLES.map((style) => handStylePath(SET, style)));
for (const style of manifest.styles) {
  if (!files.has(style.src)) throw new Error(`${style.id} names ${style.src}, which was not written`);
}

console.log(`wrote ${written} drawings and a manifest to ${OUT}${SET}`);
console.log(`  ${STYLES.length} style(s), one file each for both hands, viewBox "${HAND_STYLE_VIEW_BOX_ATTRIBUTE}", pivot ${HAND_STYLE_PIVOT.join(',')}, scale ${HAND_STYLE_SPRITE_SCALE}`);
console.log(`  every file the manifest names was written`);
