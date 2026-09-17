import { parseAssetRef } from './asset-reference.js';

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
 *
 * It lives in the runtime because an exported mascot has exactly the same
 * problem as the editor -- a `<svg>` full of `asset:` references and a browser
 * that will not draw them -- and solving it twice is two answers that drift.
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
 * Take the painted href off, leaving only the reference.
 *
 * The first half of putting a document back the way it is stored, and it runs
 * on nodes because that is what a serializer has. Removing an attribute is
 * safe on a live node; *writing* `href="asset:…"` onto one is not, and that is
 * the whole reason this is split in two -- see `restoreAssetReferences`.
 */
export function unpaintAssetNodes(nodes = []) {
  const found = [];
  for (const node of nodes) {
    const held = node.getAttribute?.(ASSET_ATTRIBUTE);
    if (!held || !parseAssetRef(held)) continue;
    for (const name of HREF_ATTRIBUTES) node.removeAttribute(name);
    node.removeAttribute('data-editor-asset-missing');
    found.push(held);
  }
  return found;
}

/**
 * And the second half: on the serialized *string*, the reference becomes the
 * href again.
 *
 * It has to be the string, and finding that out cost two failed requests per
 * save. `SvgDocument.serialize` works on `root.cloneNode(true)`, and a cloned
 * SVG node is still a node in a live document -- detached, but live. Setting
 * `href="asset:…"` on it makes the browser try to fetch a scheme it has never
 * heard of, exactly as if the node were on screen. The clone is never shown,
 * so nothing looks wrong; there is only a console error on every commit that
 * nobody can account for.
 *
 * So the attribute is renamed once the markup is text and can no longer ask
 * for anything. Narrow on purpose: only `data-editor-asset` holding a value
 * that parses as a reference is touched.
 */
export function restoreAssetReferences(markup) {
  return String(markup ?? '').replace(new RegExp(`\\s${ASSET_ATTRIBUTE}\\s*=\\s*(["'])(asset:[^"']*)\\1`, 'gi'),
    (whole, quote, value) => (parseAssetRef(value) ? ` href=${quote}${value}${quote}` : whole));
}

export function deferAssetReferences(markup) {
  return String(markup ?? '').replace(/\s(?:xlink:)?href\s*=\s*(["'])(asset:[^"']*)\1/gi,
    (whole, quote, value) => (parseAssetRef(value) ? ` ${ASSET_ATTRIBUTE}=${quote}${value}${quote}` : whole));
}
