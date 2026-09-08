#!/usr/bin/env node
/**
 * The shipped hand set, written to disk (docs/HANDS_2D.md, PHASES 6, 25, 43).
 *
 * ```sh
 * npm run hands:sprites                     # writes project/assets/hands/defaultCartoon/
 * node scripts/hand-sprites.mjs --poses relaxed,open,fist --out /tmp/hands
 * node scripts/hand-sprites.mjs --sheet     # ...and a contact sheet per pose
 * ```
 *
 * ```text
 * project/assets/hands/
 *   defaultCartoon/
 *     manifest.json
 *     left/relaxed/{sideLeft,threeQuarterLeft,front,threeQuarterRight,sideRight}.svg
 *     right/relaxed/…
 *     sheets/relaxed.svg                    every view of a pose, side by side
 * ```
 *
 * Every file shares one box, one pivot and one scale, so a hand that swaps
 * drawing does not change size or move (PHASES 22–23). Nothing in a file is
 * specific to a mascot — no document ids, no rig transforms, no offsets baked
 * in to correct for one — which is what makes the directory the shape a
 * **custom** hand set takes too (PHASE 38).
 *
 * The set the editor installs is drawn from the same functions, into the
 * mascot's own SVG. These files are the library, the reference and the visual
 * snapshot; they are not fetched at runtime.
 *
 * Pure geometry and strings; no DOM. Node >= 22.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HAND_SIDES } from '../project/runtime/hand-vocabulary.js';
import {
  GENERATED_SPRITE_POSES, HAND_SPRITE_VIEWS, SPRITE_PIVOT, SPRITE_SCALE, SPRITE_VIEW_BOX, SPRITE_VIEW_BOX_ATTRIBUTE,
  handSpriteDocument, handSpriteManifest, handSpriteMarkup, handSpritePath
} from '../project/editor/core/hands/hand-sprite-set.js';
import { createHandAssetLibrary, resolveHandAsset } from '../project/runtime/hand-assets.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const list = (name, fallback) => { const value = option(name, null); return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback; };

const SET = option('--set', 'defaultCartoon');
const OUT = option('--out', fileURLToPath(new URL('../project/assets/hands/', import.meta.url)));
const POSES = list('--poses', [...GENERATED_SPRITE_POSES]);
const VIEWS = list('--views', [...HAND_SPRITE_VIEWS]);
const STYLE = option('--style', 'glove');
const SHEET = args.includes('--sheet');

/* ── The files ─────────────────────────────────────────────────────────────── */

rmSync(`${OUT}${SET}`, { recursive: true, force: true });
let written = 0;
for (const side of HAND_SIDES) {
  for (const pose of POSES) {
    mkdirSync(`${OUT}${SET}/${side}/${pose}`, { recursive: true });
    for (const view of VIEWS) {
      writeFileSync(`${OUT}${handSpritePath(SET, side, pose, view)}`, handSpriteDocument(side, pose, view, { style: STYLE }));
      written += 1;
    }
  }
}

const manifest = handSpriteManifest({ set: SET, poses: POSES, views: VIEWS, sides: [...HAND_SIDES], style: STYLE });
writeFileSync(`${OUT}${SET}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

/* ── The contact sheet (PHASE 36, 43) ──────────────────────────────────────── */

/**
 * Every view of a pose, side by side, in the order they turn. The sheet an
 * author checks a set against: a drawing that is bigger, shifted or facing the
 * wrong way shows up here and nowhere else.
 */
if (SHEET) {
  const cell = SPRITE_VIEW_BOX.width;
  mkdirSync(`${OUT}${SET}/sheets`, { recursive: true });
  for (const pose of POSES) {
    const body = HAND_SIDES.flatMap((side, row) => VIEWS.map((view, column) =>
      `<g transform="translate(${column * cell} ${row * cell})">`
      + `<rect width="${cell}" height="${cell}" fill="none" stroke="#e3e3e3"/>`
      + `<circle cx="${SPRITE_PIVOT[0]}" cy="${SPRITE_PIVOT[1]}" r="3" fill="#d33"/>`
      + handSpriteMarkup(side, pose, view, { at: { x: SPRITE_PIVOT[0], y: SPRITE_PIVOT[1] }, scale: SPRITE_SCALE, style: STYLE })
      + `<text x="6" y="16" font-family="ui-monospace, monospace" font-size="11" fill="#666">${side} · ${view}</text></g>`)).join('');
    writeFileSync(`${OUT}${SET}/sheets/${pose}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWS.length * cell} ${HAND_SIDES.length * cell}" width="${VIEWS.length * cell}" height="${HAND_SIDES.length * cell}">${body}</svg>\n`);
  }
}

/* ── Checks ────────────────────────────────────────────────────────────────── */

// The manifest has to be a library, or shipping it is shipping nothing.
const library = createHandAssetLibrary(manifest.assets, manifest);
for (const side of HAND_SIDES) {
  for (const pose of POSES) {
    for (const view of VIEWS) {
      const found = resolveHandAsset(library, { side, pose, view });
      if (!found.exact) throw new Error(`${side}/${pose}/${view} does not resolve to itself: ${found.fallback}`);
    }
  }
}

console.log(`wrote ${written} drawings and a manifest to ${OUT}${SET}`);
console.log(`  ${POSES.length} pose(s) × ${VIEWS.length} views × ${HAND_SIDES.length} sides, viewBox "${SPRITE_VIEW_BOX_ATTRIBUTE}", pivot ${SPRITE_PIVOT.join(',')}, scale ${SPRITE_SCALE}`);
console.log(`  every drawing resolves to itself through the library`);
