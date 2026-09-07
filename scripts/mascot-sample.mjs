#!/usr/bin/env node
/**
 * `project/assets/mascot-sample.svg`, written from the template that draws it.
 *
 * The file used to be a hand-written stand-in — a yellow circle with two black
 * ovals and a smile — from before there was a template at all. Nothing loaded
 * it, so nothing noticed that the "sample mascot" shipped in the repository had
 * not looked like the mascot for a long time.
 *
 * It is the same artwork now, and `face-artwork.test.js` fails if the two ever
 * part company again. Regenerate with:
 *
 *     node scripts/mascot-sample.mjs
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { MASCOT_FACE_SVG } from '../project/editor/core/sample/templates/face-artwork.js';

export const SAMPLE_PATH = fileURLToPath(new URL('../project/assets/mascot-sample.svg', import.meta.url));

export async function writeMascotSample() {
  await writeFile(SAMPLE_PATH, `${MASCOT_FACE_SVG}\n`);
  return SAMPLE_PATH;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Wrote ${await writeMascotSample()}`);
}
