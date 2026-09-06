#!/usr/bin/env node
/**
 * The three files the runtime demo serves: the face template's artwork, its
 * rig, and the standalone runtime — the same `mascot.svg`, `rig.json` and
 * `runtime.js` the editor's Export writes for an untouched Mascot Face.
 *
 * Nothing here is checked in as a generated file. Vite calls `createDemoAssets`
 * while building (and serves the same in `npm run dev`), so the demo cannot
 * drift from the template or the runtime; `demo-assets.test.js` checks the
 * output. Run directly, it writes the files to a directory:
 *
 *     node scripts/demo-assets.mjs out/
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_MODULES, bundleRuntimeSource } from '../project/editor/core/export/runtime-bundle.js';
import { createTemplateExport } from '../project/editor/core/sample/templates/template-export.js';

export const DEMO_ASSET_NAMES = Object.freeze(['mascot.svg', 'rig.json', 'runtime.js']);

/** The runtime as Export bundles it: one standalone ES module. */
export async function createRuntimeSource() {
  const modules = await Promise.all(RUNTIME_MODULES.map(async (name) => ({
    name, source: await readFile(new URL(`../project/runtime/${name}`, import.meta.url), 'utf8')
  })));
  return bundleRuntimeSource(modules);
}

/**
 * @returns {Promise<{ name: string, type: string, source: string }[]>}
 */
export async function createDemoAssets() {
  const { svg, rig } = createTemplateExport();
  return [
    { name: 'mascot.svg', type: 'image/svg+xml', source: svg },
    // Indented like the editor's download, so the two files read the same.
    { name: 'rig.json', type: 'application/json', source: JSON.stringify(rig, null, 2) },
    { name: 'runtime.js', type: 'text/javascript', source: await createRuntimeSource() }
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(process.argv[2] || 'dist/demo');
  await mkdir(out, { recursive: true });
  for (const asset of await createDemoAssets()) await writeFile(resolve(out, asset.name), asset.source);
  console.log(`Wrote ${DEMO_ASSET_NAMES.join(', ')} to ${out}`);
}
