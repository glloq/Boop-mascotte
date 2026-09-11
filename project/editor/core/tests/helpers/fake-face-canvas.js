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

/**
 * The template's own shapes as the canvas measures them, by the ids the
 * template gives them: the layout roles from the layout's own table, and
 * the pupils and the lids, measured in the browser alongside them.
 */
export function templateBoxes() {
  const ids = { head: 'head', leftEye: 'eyeLeft', rightEye: 'eyeRight', leftBrow: 'browLeft', rightBrow: 'browRight', nose: 'nose', mouth: 'mouth', leftEar: 'earLeft', rightEar: 'earRight', hair: 'hair', hairTop: 'hairTop', hairBack: 'hairBack' };
  return {
    ...Object.fromEntries(Object.entries(TEMPLATE_ROLE_BOXES).map(([role, box]) => [ids[role], { ...box }])),
    pupilLeft: { x: 72.5, y: 102.5, width: 21, height: 21 }, pupilRight: { x: 146.5, y: 102.5, width: 21, height: 21 },
    lidUpperLeft: { x: 37, y: 36.5, width: 92, height: 38 }, lidUpperRight: { x: 111, y: 36.5, width: 92, height: 38 },
    lidLowerLeft: { x: 37, y: 149.5, width: 92, height: 36 }, lidLowerRight: { x: 111, y: 149.5, width: 92, height: 36 }
  };
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
  // The drawing follows the document, as the real canvas reconciles with the
  // store: an undo puts the markup back, and the canvas shows it.
  store.subscribeDocument?.('artwork', (document) => { if (typeof document.svgMarkup === 'string' && document.svgMarkup !== markup) markup = document.svgMarkup; });
  const added = new Set();
  return {
    calls,
    markup: () => markup,
    measureElement: (id) => { const box = (added.has(id) && installed(id)) || boxes[id]; return box ? { ...box } : null; },
    elementKind: (id) => store.getDocument().elements[id]?.meta?.nodeType || null,
    loadSvgFromText(svg) { calls.load.push(svg); markup = svg; },
    replaceArtwork(removeIds, fragment, { mountPoint = null, before = null, behind = null, rehome = [] } = {}) {
      calls.replace.push({ removeIds: [...removeIds], fragment, mountPoint, before, behind: behind ? structuredClone(behind) : null, rehome: structuredClone(rehome || []) });
      if (fail(removeIds, fragment)) throw new Error('The canvas refused the swap.');
      const clean = sanitizeSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      for (const match of clean.matchAll(/\sid="([^"]+)"/g)) added.add(match[1]);
      // Somebody else's drawing, out of what is about to go, before it goes:
      // the real canvas detaches the node and puts it back inside the new
      // piece it belongs to.
      const kept = [];
      for (const entry of rehome || []) {
        const span = spanOf(markup, entry.id);
        if (!span) continue;
        kept.push({ into: entry.into, text: markup.slice(span.start, span.end) });
        markup = markup.slice(0, span.start) + markup.slice(span.end);
      }
      // The outermost spans only: a piece inside another goes with it, as in the DOM.
      const found = removeIds.map((id) => spanOf(markup, id)).filter(Boolean);
      const spans = found.filter((span) => !found.some((other) => other !== span && other.start <= span.start && other.end >= span.end)).sort((a, b) => a.start - b.start);
      // Every id inside what goes, so a new piece that reuses one gets a fresh record.
      const gone = new Set(spans.flatMap((span) => [...markup.slice(span.start, span.end).matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
      let next = markup;
      for (const span of [...spans].sort((a, b) => b.start - a.start)) next = next.slice(0, span.start) + next.slice(span.end);
      // Where the fragment goes, as on the real canvas: in front of `before`;
      // else where the last removed piece was; else at the end of the mount.
      let at;
      const anchor = before ? spanOf(next, before) : null, mount = mountPoint ? spanOf(next, mountPoint) : null;
      const vacated = spans.length ? spans[spans.length - 1].start - spans.slice(0, -1).reduce((sum, span) => sum + (span.end - span.start), 0) : null;
      if (anchor) at = anchor.start;
      // The place the old pieces left, unless the fragment is bound for a group
      // they were not in: an asset given a host joins the host, not the group
      // its last instance sat in.
      else if (vacated !== null && (!mount || (vacated > mount.start && vacated < mount.end))) at = vacated;
      else at = mount ? mount.end - '</g>'.length : next.lastIndexOf('</svg>');
      markup = next.slice(0, at) + clean + next.slice(at);
      // A piece painted behind the face: cut out of the fragment, put in front
      // of `behind.before`, or first in the group the fragment went into.
      for (const id of behind?.ids || []) {
        const piece = spanOf(markup, id);
        if (!piece) continue;
        const text = markup.slice(piece.start, piece.end);
        let rest = markup.slice(0, piece.start) + markup.slice(piece.end);
        const anchor = behind.before ? spanOf(rest, behind.before) : null;
        const mount = mountPoint ? spanOf(rest, mountPoint) : null;
        const openEnd = mount ? rest.indexOf('>', mount.start) + 1 : rest.indexOf('>', rest.indexOf('<svg')) + 1;
        const to = anchor ? anchor.start : openEnd;
        rest = rest.slice(0, to) + text + rest.slice(to);
        markup = rest;
      }
      // And back in, at the end of the piece it now belongs to, or beside it
      // when that piece is a shape and has no inside.
      for (const entry of kept) {
        const into = spanOf(markup, entry.into);
        const at = into && markup.slice(into.start, into.end).endsWith('</g>') ? into.end - '</g>'.length : (into ? into.end : markup.lastIndexOf('</svg>'));
        markup = markup.slice(0, at) + entry.text + markup.slice(at);
      }
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
