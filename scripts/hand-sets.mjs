#!/usr/bin/env node
/**
 * The shipped hand sets, read off disk into one module the editor can import.
 *
 * ```sh
 * npm run hands:sets        # writes project/editor/core/hands/sets/index.js
 * ```
 *
 * The **files are the source of truth** (`project/assets/hands/<set>/`): a
 * gesture is an SVG somebody can open, edit and replace, and a ninth gesture is
 * a ninth file. This turns them into a module, because `core` has to read them
 * from Node (the unit suite) and from a browser bundle (the editor) without an
 * asynchronous startup in either — an empty hand library for the first frames
 * is a mascot with no hands.
 *
 * Nothing is authored here. `hand-sets.test.js` re-reads the directory and
 * fails if the module and the files have parted company, so the generated copy
 * can never quietly become the truth.
 *
 * Node >= 22.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SETS = fileURLToPath(new URL('../project/assets/hands/', import.meta.url));
const OUT = fileURLToPath(new URL('../project/editor/core/hands/sets/', import.meta.url));

/** Every set on disk: its manifest, and the text of every gesture it names. */
export function readHandSets(root = SETS) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = `${root}${entry.name}/`;
      const manifest = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));
      const files = {};
      for (const gesture of manifest.gestures || []) {
        const src = gesture.src || `${gesture.id}.svg`;
        files[src] = readFileSync(`${dir}${src}`, 'utf8').trim();
      }
      return { manifest, files };
    })
    .sort((a, b) => String(a.manifest.set).localeCompare(String(b.manifest.set)));
}

/** The module, as text. One export, so importing it costs one binding. */
export function handSetsModule(sets) {
  return `/**\n`
    + ` * The shipped hand sets, generated from \`project/assets/hands/\`.\n`
    + ` *\n`
    + ` * Do not edit. The **files** are the source of truth: edit a gesture's SVG,\n`
    + ` * or drop a new one in beside it, then run \`npm run hands:sets\`.\n`
    + ` * \`hand-sets.test.js\` re-reads the directory and fails if this and the files\n`
    + ` * have parted company.\n`
    + ` */\n`
    + `export const HAND_SETS = Object.freeze(${JSON.stringify(sets, null, 2)});\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sets = readHandSets();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}index.js`, handSetsModule(sets));
  const gestures = sets.reduce((total, set) => total + (set.manifest.gestures?.length || 0), 0);
  console.log(`read ${sets.length} set(s), ${gestures} gesture(s) from ${SETS}`);
  console.log(`  wrote ${OUT}index.js`);
}
