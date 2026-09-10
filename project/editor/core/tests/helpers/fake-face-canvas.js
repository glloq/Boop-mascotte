/**
 * What the canvas does when a part is replaced, done over the template's
 * markup in Node, so installing an asset can be proved without a browser.
 *
 * `svg-canvas.js`'s `replaceArtwork` takes the old pieces out of the DOM,
 * puts the sanitized fragment where they were, and reads the document back:
 * a layer tree, an element record for every new node, the metadata without
 * the removed ids, and the markup. This does the same over the template's
 * own well-formed markup (one element per tag, attributes in double quotes),
 * with `parseTemplateArtwork` as the reader, and measures every shape from
 * a table the test hands it. It is a stand-in, and it says so: it parses
 * nothing a person drew.
 */
import { parseTemplateArtwork } from '../../sample/templates/template-export.js';
import { sanitizeSvgMarkup } from '../../security/sanitize-svg.js';
import { TEMPLATE_ROLE_BOXES } from '../../face-library/face-layout.js';

/** The template's own shapes as the canvas measures them, by the ids the template gives them. */
export function templateBoxes() {
  const ids = { head: 'head', leftEye: 'eyeLeft', rightEye: 'eyeRight', leftBrow: 'browLeft', rightBrow: 'browRight', nose: 'nose', mouth: 'mouth', leftEar: 'earLeft', rightEar: 'earRight', hair: 'hair', hairTop: 'hairTop', hairBack: 'hairBack' };
  return Object.fromEntries(Object.entries(TEMPLATE_ROLE_BOXES).map(([role, box]) => [ids[role], { ...box }]));
}

const TAG = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;

/** The span of the element with this id in the markup, its whole subtree included. */
function spanOf(markup, id) {
  const open = new RegExp(`<([A-Za-z][\\w:-]*)((?:\\s+[\\w:-]+="[^"]*")*?\\s+id="${id}"(?:\\s+[\\w:-]+="[^"]*")*)\\s*(/?)>`);
  const match = open.exec(markup);
  if (!match) return null;
  const start = match.index;
  if (match[3]) return { start, end: start + match[0].length };
  TAG.lastIndex = start + match[0].length;
  let depth = 1;
  for (let found = TAG.exec(markup); found; found = TAG.exec(markup)) {
    if (found[4]) continue;
    depth += found[1] ? -1 : 1;
    if (!depth) { TAG.lastIndex = 0; return { start, end: found.index + found[0].length }; }
  }
  TAG.lastIndex = 0;
  return null;
}

/**
 * @param {object} store the editor store, read for the elements the canvas already knows
 * @param {{ boxes?: Record<string, {x:number,y:number,width:number,height:number}>, installed?: (id: string) => object|null, fail?: (removeIds: string[], markup: string) => boolean }} [options]
 *   `boxes` measures a shape by id; `installed` measures a shape a replacement drew, which may
 *   be called what a shape of the face was called; `fail` makes the swap refuse, for the rollback path
 */
export function createFakeFaceCanvas(store, { boxes = {}, installed = () => null, fail = () => false } = {}) {
  let markup = store.getDocument().svgMarkup;
  const calls = { replace: [], load: [] };
  const added = new Set();
  return {
    calls,
    markup: () => markup,
    measureElement: (id) => { const box = (added.has(id) && installed(id)) || boxes[id]; return box ? { ...box } : null; },
    elementKind: (id) => store.getDocument().elements[id]?.meta?.nodeType || null,
    loadSvgFromText(svg) { calls.load.push(svg); markup = svg; },
    replaceArtwork(removeIds, fragment, { mountPoint = null, before = null } = {}) {
      calls.replace.push({ removeIds: [...removeIds], fragment, mountPoint, before });
      if (fail(removeIds, fragment)) throw new Error('The canvas refused the swap.');
      const clean = sanitizeSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      for (const match of clean.matchAll(/\sid="([^"]+)"/g)) added.add(match[1]);
      // Where the first removed piece was, or in front of `before`, or at the end of the mount.
      let at = null;
      // The outermost spans only: a piece inside another goes with it, as in the DOM.
      const found = removeIds.map((id) => spanOf(markup, id)).filter(Boolean);
      const spans = found.filter((span) => !found.some((other) => other !== span && other.start <= span.start && other.end >= span.end)).sort((a, b) => a.start - b.start);
      if (spans.length) at = spans[0].start;
      // Every id inside what goes, so a new piece that reuses one gets a fresh record.
      const gone = new Set(spans.flatMap((span) => [...markup.slice(span.start, span.end).matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
      let next = markup;
      for (const span of [...spans].sort((a, b) => b.start - a.start)) next = next.slice(0, span.start) + next.slice(span.end);
      if (at === null) {
        const anchor = before ? spanOf(next, before) : null, mount = mountPoint ? spanOf(next, mountPoint) : null;
        // The mount is a group on the template, so its last child goes before its close tag.
        at = anchor ? anchor.start : mount ? mount.end - '</g>'.length : next.lastIndexOf('</svg>');
      }
      markup = next.slice(0, at) + clean + next.slice(at);
      const parsed = parseTemplateArtwork(markup);
      const known = store.getDocument().elements;
      const elements = {};
      for (const id of Object.keys(known)) if (!parsed.elements[id]) gone.add(id);
      for (const [id, record] of Object.entries(parsed.elements)) elements[id] = known[id] && !gone.has(id) ? structuredClone(known[id]) : record;
      const layerMetadata = structuredClone(store.getDocument().layerMetadata || {});
      for (const id of gone) delete layerMetadata[id];
      return { layers: parsed.layers, layerMetadata, elements, svgMarkup: markup, removed: [...gone] };
    }
  };
}

/** A measure for every id an asset draws, from its reference box: the fragment fills the box, its root included. */
export function boxesFromReferenceBox(asset, ids, renamed = {}) {
  const out = {};
  for (const id of ids) out[renamed[id] ?? id] = { ...asset.referenceBox };
  return out;
}
