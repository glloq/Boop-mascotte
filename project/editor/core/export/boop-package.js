import { readZip, writeZip } from './zip.js';
import { assetReferencesIn, hashAssetBytes } from '../assets/asset-manager.js';
import { normalizeAssets } from '../assets/asset-model.js';

/**
 * A project as one file: `.boop`.
 *
 * ```text
 * character.boop
 * ├── project.json   the project, minus the artwork and the pictures
 * ├── scene.svg      the artwork
 * ├── rig.json       what a runtime reads — a copy, never read back
 * └── assets/        the pictures, named by the hash that addresses them
 * ```
 *
 * **`project.json` is what opens; `rig.json` is what runs.** The two are not
 * the same object and cannot be (docs/PROJECT_FORMAT.md): the exported rig
 * moves expressions and reactions into itself, renames clips, and drops
 * `semanticParts`, `rigHandles`, `rigLinks`, `arrangement` and
 * `animationEditor` entirely. It is lossy on purpose -- it is what a runtime
 * needs, not what an author was working with. So the package carries both, and
 * opening one reads only the first. A `rig.json` that has drifted from the
 * project beside it cannot corrupt anything, because nothing believes it.
 *
 * **A picture is named by its own hash, so the package checks itself.** An id
 * is the hash of the bytes it addresses (`core/assets/asset-model.js`), which
 * means reading a package can re-hash every picture and find out whether it is
 * the picture that was written. The ZIP's own CRC catches damage in transit;
 * this catches a package assembled by hand or by something that did not know
 * the rule.
 */

export const BOOP_EXTENSION = '.boop';
export const PROJECT_ENTRY = 'project.json';
export const SCENE_ENTRY = 'scene.svg';
export const RIG_ENTRY = 'rig.json';
export const ASSET_FOLDER = 'assets/';

const EXTENSIONS = Object.freeze({ 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' });
export const assetEntryName = (asset) => `${ASSET_FOLDER}${asset.id}.${EXTENSIONS[asset.format] || 'bin'}`;

const utf8 = (text) => new TextEncoder().encode(text);
const fromUtf8 = (bytes) => new TextDecoder().decode(bytes);

/**
 * Write a package.
 *
 * `bytesFor` is asked for every asset the document *lists*, not every asset it
 * references: a picture kept for undo but not currently drawn still belongs in
 * the file, or reopening it and pressing undo finds a hole.
 *
 * @param {object} options
 * @param {object} options.snapshot a project snapshot (`createProjectSnapshot`)
 * @param {(id: string) => Promise<Uint8Array|null>} options.bytesFor
 * @param {object} [options.rig] what a runtime reads, if it is being shipped too
 * @returns {Promise<{bytes: Uint8Array, missing: string[]}>}
 */
export async function writeBoopPackage({ snapshot, bytesFor = async () => null, rig = null }) {
  const document = snapshot?.document || {};
  const assets = normalizeAssets(document.assets);
  const project = structuredClone({ ...snapshot, document: { ...document, svgMarkup: undefined, assets } });
  delete project.document.svgMarkup;

  const entries = [
    { name: PROJECT_ENTRY, bytes: utf8(JSON.stringify(project, null, 1)) },
    { name: SCENE_ENTRY, bytes: utf8(String(document.svgMarkup ?? '')) }
  ];
  if (rig) entries.push({ name: RIG_ENTRY, bytes: utf8(JSON.stringify(rig, null, 1)) });

  const missing = [];
  for (const asset of Object.values(assets)) {
    const bytes = await bytesFor(asset.id);
    if (!bytes) { missing.push(asset.id); continue; }
    // Pictures are compressed already; deflating them spends time to make them
    // very slightly bigger.
    entries.push({ name: assetEntryName(asset), bytes, compress: asset.format === 'image/svg+xml' });
  }
  return { bytes: await writeZip(entries), missing };
}

/**
 * Read a package back.
 *
 * Returns the snapshot exactly as `prepareProjectSnapshot` expects one, so
 * opening a package and opening a `.json` are the same path from there on --
 * the same validation, the same migration ladder, the same refusal to touch
 * the live editor until everything has passed.
 *
 * `damaged` and `missing` are disjoint and name the same consequence from two
 * causes: a picture that will not draw because it is not the picture it claims
 * to be, and one that will not draw because it is not there. A caller deciding
 * whether to open the file wants their union; a caller telling the author what
 * happened wants them apart.
 *
 * @returns {Promise<{snapshot: object, assets: Map<string, Uint8Array>, damaged: string[], missing: string[]}>}
 */
export async function readBoopPackage(input) {
  const entries = await readZip(input);
  const project = entries.get(PROJECT_ENTRY);
  if (!project) throw new Error('This is not a Boop package: it has no project in it.');
  let snapshot;
  try { snapshot = JSON.parse(fromUtf8(project)); } catch { throw new Error('This package’s project could not be read.'); }
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.document) throw new Error('This package’s project could not be read.');

  snapshot.document.svgMarkup = entries.has(SCENE_ENTRY) ? fromUtf8(entries.get(SCENE_ENTRY)) : '';
  const listed = normalizeAssets(snapshot.document.assets);
  snapshot.document.assets = listed;

  const assets = new Map(), damaged = [], missing = [];
  for (const asset of Object.values(listed)) {
    const bytes = entries.get(assetEntryName(asset));
    if (!bytes) { missing.push(asset.id); continue; }
    // The id is the hash, so the package can be asked whether it is telling
    // the truth about its own pictures.
    if (await hashAssetBytes(bytes) !== asset.id) { damaged.push(asset.id); continue; }
    assets.set(asset.id, bytes);
  }
  // Something the artwork draws that the package does not carry is worse than
  // something merely listed: it is a hole in the mascot, and is reported as
  // missing whether it was listed or not.
  for (const id of assetReferencesIn(snapshot.document)) if (!assets.has(id) && !missing.includes(id) && !damaged.includes(id)) missing.push(id);

  return { snapshot, assets, damaged, missing: [...new Set(missing)].sort() };
}
