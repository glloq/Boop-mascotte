#!/usr/bin/env node
/**
 * The shipped hand set, written to disk (docs/HANDS_2D.md).
 *
 * ```sh
 * npm run hands:sprites                     # writes project/assets/hands/defaultCartoon/
 * node scripts/hand-sprites.mjs --drawings palmOpen,frontFist --out /tmp/hands
 * node scripts/hand-sprites.mjs --sheet     # ...and a contact sheet
 * ```
 *
 * ```text
 * project/assets/hands/
 *   defaultCartoon/
 *     manifest.json
 *     left/{sideOpen,palmOpen,frontFist}.svg          the pictures
 *     left/{sideOpen,palmOpen,frontFist}-anim.svg     what each of them does
 *     right/…
 *     sheets/hands.svg                                all of it, side by side
 * ```
 *
 * Every file shares one box, one pivot and one scale, so a hand that swaps
 * drawing does not change size or move. Nothing in a file is specific to a
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
import { HAND_SIDES, handDrawingName } from '../project/runtime/hand-vocabulary.js';
import {
  GENERATED_HAND_DRAWINGS, SPRITE_PIVOT, SPRITE_SCALE, SPRITE_VIEW_BOX, SPRITE_VIEW_BOX_ATTRIBUTE,
  handSpriteDocument, handSpriteManifest, handSpriteMarkup, handSpritePath
} from '../project/editor/core/hands/hand-sprite-set.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const list = (name, fallback) => { const value = option(name, null); return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback; };

const SET = option('--set', 'defaultCartoon');
const OUT = option('--out', fileURLToPath(new URL('../project/assets/hands/', import.meta.url)));
const DRAWINGS = list('--drawings', [...GENERATED_HAND_DRAWINGS]);
const STYLE = option('--style', 'glove');
const SHEET = args.includes('--sheet');

/* ── The files ─────────────────────────────────────────────────────────────── */

rmSync(`${OUT}${SET}`, { recursive: true, force: true });
let written = 0;
for (const side of HAND_SIDES) {
  mkdirSync(`${OUT}${SET}/${side}`, { recursive: true });
  for (const drawing of DRAWINGS) {
    for (const posed of [false, true]) {
      const file = handSpriteDocument(side, drawing, { style: STYLE, posed });
      if (!file) throw new Error(`${side}/${drawing} is not a drawing this generator knows`);
      writeFileSync(`${OUT}${handSpritePath(SET, side, drawing, { posed })}`, file);
      written += 1;
    }
  }
}

const manifest = handSpriteManifest({ set: SET, drawings: DRAWINGS, sides: [...HAND_SIDES], style: STYLE });
writeFileSync(`${OUT}${SET}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

/* ── The contact sheet ─────────────────────────────────────────────────────── */

/**
 * Every picture beside what it does, both hands. The sheet an author checks a
 * set against: a drawing that is bigger, shifted or facing the wrong way shows
 * up here and nowhere else.
 */
if (SHEET) {
  const cell = SPRITE_VIEW_BOX.width;
  const columns = DRAWINGS.length * 2;
  mkdirSync(`${OUT}${SET}/sheets`, { recursive: true });
  const body = HAND_SIDES.flatMap((side, row) => DRAWINGS.flatMap((drawing, index) => [false, true].map((posed) => {
    const column = index * 2 + (posed ? 1 : 0);
    return `<g transform="translate(${column * cell} ${row * cell})">`
      + `<rect width="${cell}" height="${cell}" fill="none" stroke="#e3e3e3"/>`
      + `<circle cx="${SPRITE_PIVOT[0]}" cy="${SPRITE_PIVOT[1]}" r="3" fill="#d33"/>`
      + handSpriteMarkup(side, drawing, { at: { x: SPRITE_PIVOT[0], y: SPRITE_PIVOT[1] }, scale: SPRITE_SCALE, style: STYLE, posed })
        .replace(/ id="[^"]*"/g, '')
      + `<text x="6" y="16" font-family="ui-monospace, monospace" font-size="11" fill="#666">${side} · ${handDrawingName(drawing)}${posed ? ' (anim)' : ''}</text></g>`;
  }))).join('');
  writeFileSync(`${OUT}${SET}/sheets/hands.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${columns * cell} ${HAND_SIDES.length * cell}" width="${columns * cell}" height="${HAND_SIDES.length * cell}">${body}</svg>\n`);
}

/* ── Checks ────────────────────────────────────────────────────────────────── */

// A manifest that does not name a file it wrote is a manifest of nothing.
const files = new Set();
for (const side of HAND_SIDES) for (const drawing of DRAWINGS) {
  files.add(handSpritePath(SET, side, drawing));
  files.add(handSpritePath(SET, side, drawing, { posed: true }));
}
for (const asset of manifest.assets) {
  if (!files.has(asset.src)) throw new Error(`${asset.id} names ${asset.src}, which was not written`);
  if (asset.animSrc && !files.has(asset.animSrc)) throw new Error(`${asset.id} names ${asset.animSrc}, which was not written`);
}

console.log(`wrote ${written} drawings and a manifest to ${OUT}${SET}`);
console.log(`  ${DRAWINGS.length} drawing(s) and their animations × ${HAND_SIDES.length} sides, viewBox "${SPRITE_VIEW_BOX_ATTRIBUTE}", pivot ${SPRITE_PIVOT.join(',')}, scale ${SPRITE_SCALE}`);
console.log(`  every file the manifest names was written`);
