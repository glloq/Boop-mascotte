import { parseAssetRef } from '../../runtime/asset-reference.js';

/**
 * Making `asset:` references paintable in the live DOM, without ever letting
 * what paints them reach the document.
 *
 * A browser will not draw `<image href="asset:7f3c…">` -- there is no handler
 * for the scheme -- so the node on screen has to carry an object URL instead.
 * But an object URL is valid for exactly as long as this tab lives, and the
 * document is what gets saved, autosaved and undone. One leaking into
 * `svgMarkup` is a project that opens tomorrow pointing at nothing.
 *
 * So the reference moves aside rather than away. The paint pass writes the URL
 * into `href` and keeps the reference in `data-editor-asset`, which is an
 * editor attribute like the four that already exist, and
 * `SvgDocument.serialize` puts it back. The document is therefore never the
 * thing that has to remember: the DOM carries its own answer, so any path that
 * serializes gets it right without knowing this file exists.
 *
 * Written against nodes rather than a root so the whole of it can be tested
 * without a DOM: what it needs of an element is four attribute methods.
 */

export const ASSET_ATTRIBUTE = 'data-editor-asset';
const HREF_ATTRIBUTES = ['href', 'xlink:href'];

/** The reference a node points at, whether it has been painted yet or not. */
export function assetReferenceOf(node) {
  const held = node.getAttribute?.(ASSET_ATTRIBUTE);
  if (held && parseAssetRef(held)) return held;
  for (const name of HREF_ATTRIBUTES) {
    const value = node.getAttribute?.(name);
    if (value && parseAssetRef(value)) return value;
  }
  return null;
}

/** Every reference a set of nodes points at, for priming a resolver before drawing. */
export function collectAssetReferences(nodes = []) {
  const found = new Set();
  for (const node of nodes) { const reference = assetReferenceOf(node); if (reference) found.add(reference); }
  return [...found];
}

/** Which href attribute currently holds what this node is painted from. */
const paintedAttribute = (node) => HREF_ATTRIBUTES.find((name) => String(node.getAttribute?.(name) ?? '').startsWith('blob:'))
  ?? HREF_ATTRIBUTES.find((name) => parseAssetRef(node.getAttribute?.(name)))
  ?? 'href';

/**
 * Point every asset node at something a browser can draw.
 *
 * A reference the resolver cannot answer is marked rather than left showing a
 * stale picture: `data-editor-asset-missing` is what a canvas can style into a
 * visible gap. Guessing is the one thing not to do here -- an author whose
 * asset is gone needs to see that, not to see whatever was there before.
 *
 * @returns {{painted: string[], missing: string[]}}
 */
export function paintAssetReferences(nodes = [], resolver) {
  const painted = [], missing = [];
  for (const node of nodes) {
    const reference = assetReferenceOf(node);
    if (!reference) continue;
    const attribute = paintedAttribute(node);
    const url = resolver?.urlFor?.(reference) ?? null;
    // The reference lives here from now on, so serialization has its answer
    // whatever happens to the href next.
    node.setAttribute(ASSET_ATTRIBUTE, reference);
    if (url) {
      node.setAttribute(attribute, url);
      node.removeAttribute('data-editor-asset-missing');
      painted.push(reference);
    } else {
      // Nothing to draw: the href is emptied rather than left pointing at a
      // revoked URL, which a browser reports as a broken image.
      node.removeAttribute(attribute);
      node.setAttribute('data-editor-asset-missing', 'true');
      missing.push(reference);
    }
  }
  return { painted, missing };
}

/**
 * Put the references back, as serialization does.
 *
 * Exported for the same reason the paint pass is: it is the half of the round
 * trip that keeps object URLs out of saved projects, and it should be provable
 * on its own rather than only through a document model.
 */
export function restoreAssetReferences(nodes = []) {
  const restored = [];
  for (const node of nodes) {
    const held = node.getAttribute?.(ASSET_ATTRIBUTE);
    if (!held || !parseAssetRef(held)) continue;
    node.setAttribute(paintedAttribute(node), held);
    node.removeAttribute(ASSET_ATTRIBUTE);
    node.removeAttribute('data-editor-asset-missing');
    restored.push(held);
  }
  return restored;
}
