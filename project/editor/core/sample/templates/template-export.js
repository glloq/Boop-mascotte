/**
 * The face template as an export, without a browser.
 *
 * The editor builds a project from the template by parsing the artwork on the
 * canvas and rigging what it finds (`template-loader.js`); Export then writes
 * `rig.json` from that project. The runtime demo ships the same three files a
 * page needs, and they have to be produced where there is no canvas — at build
 * time, in Node — so this module walks the template's own markup instead.
 *
 * The parser is for the template and nothing else: markup this repository
 * writes, well formed, one element per tag, attributes in double quotes. User
 * SVG goes through the sanitized DOM import as it always has. Given that, the
 * records it produces are the ones the canvas would (identity transform, the
 * `opacity` attribute as `baseOpacity`, the tag as `meta.nodeType`), so the rig
 * `applyTemplateProject` writes over them is the rig the editor exports for the
 * same template — `demo-assets.test.js` holds that to the checked reference.
 */
import { createCleanProjectState } from '../../state/store.js';
import { createExportRig } from '../../export/export-rig.js';
import { LAYER_TAGS } from '../../svg-document/svg-document.js';
import { MASCOT_FACE_SVG } from './face-artwork.js';
import { applyTemplateProject } from './template-project.js';

const TAG = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;

const attribute = (attributes, name) => attributes.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const elementRecord = (tag, attributes) => ({
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
  baseOpacity: attribute(attributes, 'opacity') === undefined ? 1 : Number(attribute(attributes, 'opacity')),
  constraints: { translate: true, rotate: true, scale: true },
  bindings: {},
  symmetryPeer: null,
  meta: { nodeType: tag }
});

/**
 * The element records and the layer tree the canvas would build for this
 * markup. Anything under `<defs>` (clip paths) is not a layer, as on the canvas.
 *
 * @param {string} svg
 * @returns {{ elements: Record<string, object>, layers: object[] }}
 */
export function parseTemplateArtwork(svg = MASCOT_FACE_SVG) {
  const elements = {}, layers = [], open = [];
  let defs = 0;
  for (const [, closing, tag, attributes, selfClosing] of String(svg).matchAll(TAG)) {
    if (tag === 'defs') { defs += closing ? -1 : selfClosing ? 0 : 1; continue; }
    if (defs > 0 || !LAYER_TAGS.has(tag)) continue;
    if (closing) { open.pop(); continue; }
    const id = attribute(attributes, 'id');
    if (!id) throw new Error(`Template element <${tag}> has no id; the template names every layer it draws.`);
    if (elements[id]) throw new Error(`Template id "${id}" is drawn twice.`);
    elements[id] = elementRecord(tag, attributes);
    const layer = { id, type: tag, name: attribute(attributes, 'data-name') || id, visible: true, locked: false, expanded: tag === 'g', children: [] };
    (open.length ? open[open.length - 1].children : layers).push(layer);
    if (!selfClosing) open.push(layer);
  }
  return { elements, layers };
}

/** The project the editor opens from the face template, built without a canvas. */
export function createTemplateProjectState(svg = MASCOT_FACE_SVG) {
  const state = Object.assign(createCleanProjectState(), { svgMarkup: svg }, parseTemplateArtwork(svg));
  return applyTemplateProject(state);
}

/**
 * What Export writes for the untouched template: the artwork and its rig.
 *
 * @returns {{ svg: string, rig: object }}
 */
export function createTemplateExport() {
  return { svg: MASCOT_FACE_SVG, rig: createExportRig(createTemplateProjectState()) };
}
