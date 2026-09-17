import { normalizeAssets } from '../assets/asset-model.js';
import { assetReferencesIn } from '../assets/asset-manager.js';
import { parseAssetRef } from '../../../runtime/asset-reference.js';
import { hasValidProjectDocument } from '../state/project-snapshot.js';

export const EXPORT_ARTIFACTS = Object.freeze([
  { name: 'mascot.svg', description: 'sanitized artwork' },
  { name: 'rig.json', description: 'runtime rig configuration' },
  { name: 'runtime.js', description: 'standalone browser runtime' }
]);

/**
 * The one download offered when the mascot is made of pictures.
 *
 * Three buttons is fine for three files. A mascot with a dozen pictures in it
 * is a dozen more, each of which has to land in a folder called `assets/`
 * beside the others or nothing draws -- which is a way of handing someone a
 * broken mascot and calling it their fault.
 */
export const EXPORT_BUNDLE = Object.freeze({ name: 'mascot-export.zip', description: 'everything, in the folders the mascot expects' });

/** Build presentation state without serializing artwork or creating an export. */
export function createExportUiModel(state) {
  const available = hasValidProjectDocument(state);
  const pictures = Object.keys(normalizeAssets(state?.assets)).length;
  const artifacts = pictures ? [EXPORT_BUNDLE, ...EXPORT_ARTIFACTS] : EXPORT_ARTIFACTS;
  return {
    available,
    message: available
      ? (pictures ? `Use these outside the editor. The pictures have to stay in ${ASSET_FOLDER}, so take the zip unless you are placing the files yourself:` : 'Use these files outside the editor:')
      : 'Create or open a project before exporting.',
    artifacts: artifacts.map((artifact) => ({ ...artifact, enabled: available }))
  };
}

/** Create export data only after the caller explicitly requests an artifact. */
/**
 * What Export writes, including the pictures a raster mascot is made of.
 *
 * **An exported mascot resolves its pictures as files, not through a
 * resolver.** Inside the editor `asset:<id>` is a reference into a store,
 * because the store is where undo and autosave need the bytes to be. On a web
 * page there is no store: there is a folder, and a relative URL is what a
 * browser already knows how to fetch. So the export rewrites every reference
 * to the file it ships beside it, and the page needs nothing of ours to draw
 * the mascot -- `<image href="assets/7f3c….webp">` is just an image.
 *
 * Without this an exported raster mascot is an SVG full of a scheme no browser
 * has a handler for: it draws nothing, reports `ERR_UNKNOWN_URL_SCHEME`, and
 * nothing in the file says why.
 *
 * `assetBytes` is asked for each picture and may answer null -- the caller has
 * an asset store and this does not. A picture it cannot supply is reported
 * rather than shipped as a dead link.
 *
 * **Only the pictures the artwork points at are shipped.** A project keeps
 * every picture that was ever imported into it -- replacing one leaves the
 * previous one in the table, deliberately, because undo has to be able to
 * bring it back (docs/V4_ROADMAP.md, V4-032). None of that is any business of
 * a web page: an export that carries four pictures to draw one is weight on
 * somebody's site for a history they cannot see. The artwork that is being
 * shipped is the list, read from the markup that is about to be written rather
 * than from the table, so a node deleted on the canvas takes its picture out
 * of the archive with it.
 *
 * @param {(id: string) => Uint8Array|null} [options.assetBytes]
 * @returns {{name: string, type: string, content: string|Uint8Array}[]}
 */
export function createExportArtifacts({ state, serializeSvg, createRig, runtimeSource, assetBytes = () => null }) {
  const svg = serializeSvg();
  if (!hasValidProjectDocument({ svgMarkup: svg })) {
    throw new Error('Cannot export a project without a valid SVG document');
  }
  const assets = normalizeAssets(state?.assets);
  const drawn = assetReferencesIn({ svgMarkup: svg, elements: state?.elements });
  const files = [], shipped = new Map();
  for (const asset of Object.values(assets)) {
    if (!drawn.has(asset.id)) continue;
    const bytes = assetBytes(asset.id);
    if (!bytes) continue;
    const name = exportedAssetName(asset);
    shipped.set(asset.id, name);
    files.push({ name, type: asset.format, content: bytes });
  }
  return [
    { name: 'mascot.svg', type: 'image/svg+xml', content: rewriteAssetReferences(svg, shipped) },
    { name: 'rig.json', type: 'application/json', content: JSON.stringify(createRig(state), null, 2) },
    { name: 'runtime.js', type: 'text/javascript', content: runtimeSource },
    ...files
  ];
}

export const ASSET_FOLDER = 'assets/';
const ASSET_EXTENSIONS = Object.freeze({ 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' });
export const exportedAssetName = (asset) => `${ASSET_FOLDER}${asset.id}.${ASSET_EXTENSIONS[asset.format] || 'bin'}`;

/**
 * Every `asset:<id>` in the markup becomes the file shipped for it.
 *
 * A reference with no file left as it is, not silently deleted: an author
 * opening the SVG sees which picture did not come, and an empty `href` would
 * have told them nothing.
 */
export function rewriteAssetReferences(markup, shipped = new Map()) {
  return String(markup ?? '').replace(/(\s(?:xlink:)?href\s*=\s*["'])(asset:[0-9a-f]{8,64})(["'])/gi,
    (whole, before, reference, after) => {
      const name = shipped.get(parseAssetRef(reference));
      return name ? `${before}${name}${after}` : whole;
    });
}
