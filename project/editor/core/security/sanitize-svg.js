/** Removes executable SVG features before markup is inserted into the editor DOM. */
export function sanitizeSvgMarkup(markup) {
  if (typeof markup !== 'string' || !/<svg\b/i.test(markup)) throw new Error('The imported document is not an SVG.');
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
    if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') throw new Error('The imported document is not valid SVG.');
    document.querySelectorAll('script, foreignObject').forEach((node) => node.remove());
    document.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase(), value = attribute.value.trim();
      if (name === 'xml:base' || name === 'base' || name.startsWith('on') || (['href', 'xlink:href', 'src'].includes(name) && !isInternalReference(value)) ||
          (name === 'style' && cssReachesOut(value)) || (PAINT_ATTRIBUTES.includes(name) && reachesOutByUrl(value))) node.removeAttribute(attribute.name);
    }));
    document.querySelectorAll('style').forEach((node) => { if (cssReachesOut(node.textContent)) node.remove(); });
    return new XMLSerializer().serializeToString(document.documentElement);
  }
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/(?<=\s|["'])on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:xml:base|base)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*(?:(["'])\s*javascript:[\s\S]*?\1|javascript:[^\s>]*)/gi, '')
    .replace(/\s+(?:href|xlink:href|src)\s*=\s*(["'])(?!\s*#)[\s\S]*?\1/gi, '')
    .replace(/\s+style\s*=\s*(["'])([\s\S]*?)\1/gi, (attribute, quote, css) => hasExternalCss(css) ? '' : attribute)
    .replace(paintAttributePattern(), (attribute, name, quote, value) => hasExternalUrl(value) ? '' : attribute)
    // The body, not the markup around it: a `@import` spelled `&#64;import` is
    // an import, and the scan below already reads it as one.
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (element, css) => hasExternalCss(css) ? '' : element)
    .replace(/url\s*\(\s*(["']?)\s*javascript:[^)]+\1\s*\)/gi, 'none');
}

/**
 * What the sanitizer would take out of this markup, listed rather than removed.
 *
 * The face part library validates an asset before it is registered
 * (docs/FACE_PART_LIBRARY.md), and "does it carry anything executable?" has to
 * be answered by the same rules that clean an import -- a second list of rules
 * is a list that drifts. So this scan names every removal the cleaner above
 * makes, sharing its two predicates, and never cleans anything itself:
 * installing the artwork still goes through `sanitizeSvgMarkup`.
 *
 * @param {string} markup an SVG document or a fragment of one
 * @returns {{ kind: string, detail: string }[]} empty when nothing would be removed
 */
export function findUnsafeSvg(markup) {
  const text = String(markup ?? '');
  const found = [];
  for (const match of text.matchAll(/<(script|foreignObject)\b/gi)) found.push({ kind: match[1].toLowerCase() === 'script' ? 'script' : 'foreign-object', detail: `<${match[1]}>` });
  // A handler glued onto the value before it (`src=""onerror=`) is a handler still.
  for (const match of text.matchAll(/(?:\s|["'])(on[a-z][\w:-]*)\s*=/gi)) found.push({ kind: 'event-handler', detail: match[1] });
  for (const match of text.matchAll(/\s(xml:base|base)\s*=/gi)) found.push({ kind: 'base', detail: match[1] });
  for (const match of text.matchAll(/\s(href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (!isInternalReference(value)) found.push({ kind: 'external-reference', detail: `${match[1]}="${value}"` });
  }
  for (const match of text.matchAll(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) if (hasExternalCss(match[2])) found.push({ kind: 'external-css', detail: match[2].trim() });
  // A paint that reaches for a `url(` outside the document: a fill or a filter that fetches, or a colour with a declaration smuggled after it.
  for (const match of text.matchAll(paintAttributePattern())) if (hasExternalUrl(match[3])) found.push({ kind: 'external-reference', detail: `${match[1]}="${match[3].trim()}"` });
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) if (hasExternalCss(match[1])) found.push({ kind: 'external-css', detail: '<style>' });
  for (const match of text.matchAll(/url\s*\(\s*["']?\s*javascript:/gi)) found.push({ kind: 'javascript-url', detail: match[0] });
  return found;
}

function isInternalReference(value) { return !value || value.startsWith('#'); }
/**
 * The presentation attributes that may name a `url(…)`: a paint server, a
 * filter, a mask, a clip, a marker -- inside the document only. `marker` is
 * the SVG 2 shorthand for the three `marker-*`, and fetches exactly as they
 * do; `cursor` is the other one that takes a url.
 *
 * One list, and both regexes built from it: an attribute the cleaner strips
 * and the scan never names is the drift this module exists to avoid.
 */
const PAINT_ATTRIBUTES = ['fill', 'stroke', 'filter', 'mask', 'marker', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'cursor'];
const paintAttributePattern = () => new RegExp(`\\s(${PAINT_ATTRIBUTES.join('|')})\\s*=\\s*(["'])([\\s\\S]*?)\\2`, 'gi');
function hasExternalUrl(value) { return reachesOutByUrl(decodeReferences(value)); }
function hasExternalCss(value) { return cssReachesOut(decodeReferences(value)); }
/**
 * The same two questions asked of text the XML parser has already decoded, so
 * the DOMParser branch does not decode a second time: `&amp;#117;rl(` is a
 * document that *spells out* `&#117;rl(`, which a browser draws as text and
 * never fetches. Decoding it twice would read a fetch into markup the scan
 * and the fallback cleaner both call clean.
 */
function reachesOutByUrl(text) { return /url\(\s*["']?\s*(?![#"'\s])/i.test(String(text ?? '')); }
function cssReachesOut(text) {
  const css = String(text ?? '');
  if (/@import|javascript\s*:/i.test(css)) return true;
  const urls = css.matchAll(/url\s*\(\s*(["']?)(.*?)\1\s*\)/gi);
  for (const match of urls) if (!match[2].trim().startsWith('#')) return true;
  return false;
}
/** An attribute value as the XML parser would hand it over: character references decoded, so `&#117;rl(` is `url(` to the scan as it is to the browser. */
function decodeReferences(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code) => {
    const lower = code.toLowerCase();
    // A reference outside Unicode is not a character: the browser draws it as
    // the replacement glyph, so it spells nothing. Left as written rather than
    // thrown over -- this scan answers "is it safe?" for every input it is given.
    if (lower.startsWith('#x')) return codePoint(parseInt(lower.slice(2), 16), whole);
    if (lower.startsWith('#')) return codePoint(parseInt(lower.slice(1), 10), whole);
    return named[lower] ?? whole;
  });
}
const codePoint = (value, whole) => (Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : whole);
