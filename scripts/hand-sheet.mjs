#!/usr/bin/env node
/**
 * A **contact sheet** of whatever hand drawings are on disk, for looking at.
 *
 * ```sh
 * npm run hands:sheet                            # project/assets/hands/<set>/sheets/hands.svg
 * node scripts/hand-sheet.mjs --set defaultCartoon --look skin
 * ```
 *
 * ```text
 * project/assets/hands/defaultCartoon/
 *   relaxed.svg  open.svg  fist.svg  …            the drawings, authored
 *   sheets/hands.svg                              all of them, both hands, side by side
 * ```
 *
 * This **generates nothing an author owns**. The drawings are the files; the
 * sheet is a view of them, and deleting it loses nothing. Every cell draws one
 * gesture at the set's own scale, centred on the set's own pivot, with the pivot
 * and the set's radius marked — so a drawing that is bigger than the others,
 * shifted off the pivot, or facing the wrong way shows up here and nowhere
 * else. This is the art review.
 *
 * The drawings come through `core/hands/hand-set.js` rather than being read
 * raw, so a set that would be refused by the editor is refused here too, with
 * the same message.
 *
 * Node >= 22.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HAND_SIDES } from '../project/runtime/hand-vocabulary.js';
import { createHandSetRegistry, normalizeHandSet } from '../project/editor/core/hands/hand-set.js';
import { handLook, handStyleMarkup } from '../project/editor/core/hands/hand-style-art.js';
import { readHandSets } from './hand-sets.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };

const ROOT = fileURLToPath(new URL('../project/assets/hands/', import.meta.url));
const WANTED = option('--set', null);
const LOOK = option('--look', null);

const sets = readHandSets(ROOT).filter((item) => !WANTED || item.manifest.set === WANTED);
if (!sets.length) throw new Error(`no hand set to draw in ${ROOT}${WANTED ? ` called "${WANTED}"` : ''}`);

/**
 * One sheet for one set.
 *
 * `handStyleMarkup` draws from the module-level library, so the set being drawn
 * is installed into it first: the sheet is of *these* files, not of whatever
 * the editor happens to ship.
 */
function sheet(source) {
  const set = normalizeHandSet(source.manifest, source.files);
  // Validated by the same registry the editor uses, so a refusal here is the
  // refusal an author would get.
  createHandSetRegistry().install(set);

  const [px, py] = set.pivot;
  const cell = Math.round(px * 2);
  const look = handLook(LOOK || set.look);
  const ids = set.gestures.map((gesture) => gesture.id);
  const body = HAND_SIDES.flatMap((side, row) => ids.map((id, column) => {
    const label = set.gestures.find((gesture) => gesture.id === id)?.label || id;
    return `<g transform="translate(${column * cell} ${row * cell})">`
      + `<rect width="${cell}" height="${cell}" fill="none" stroke="#e3e3e3"/>`
      + `<circle cx="${px}" cy="${py}" r="${set.radius * set.scale}" fill="none" stroke="#cfe4ff"/>`
      + `<circle cx="${px}" cy="${py}" r="3" fill="#d33"/>`
      + handStyleMarkup(side, id, { at: { x: px, y: py }, scale: set.scale, look }).replace(/ id="[^"]*"/g, '')
      + `<text x="6" y="16" font-family="ui-monospace, monospace" font-size="11" fill="#666">${side} · ${label}</text>`
      + '</g>';
  })).join('');
  const width = ids.length * cell, height = HAND_SIDES.length * cell;
  const out = `${ROOT}${set.set}/sheets/`;
  if (!existsSync(out)) mkdirSync(out, { recursive: true });
  writeFileSync(`${out}hands.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"`
    + ` width="${width}" height="${height}">${body}</svg>\n`);
  return { set, out: `${out}hands.svg`, count: ids.length };
}

for (const source of sets) {
  const { set, out, count } = sheet(source);
  console.log(`drew ${count} gesture(s) × ${HAND_SIDES.length} hand(s) from ${ROOT}${set.set}/`);
  console.log(`  ${out}`);
  console.log(`  pivot ${set.pivot.join(',')}, scale ${set.scale}, radius ${set.radius} — look "${LOOK || set.look}"`);
}
