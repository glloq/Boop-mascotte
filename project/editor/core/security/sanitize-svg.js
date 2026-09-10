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
          (name === 'style' && hasExternalCss(value))) node.removeAttribute(attribute.name);
    }));
    document.querySelectorAll('style').forEach((node) => { if (hasExternalCss(node.textContent)) node.remove(); });
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
    .replace(/<style\b[^>]*>[\s\S]*?(?:@import|url\s*\(\s*(?!["']?#))[\s\S]*?<\/style\s*>/gi, '')
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
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) if (hasExternalCss(match[1])) found.push({ kind: 'external-css', detail: '<style>' });
  for (const match of text.matchAll(/url\s*\(\s*["']?\s*javascript:/gi)) found.push({ kind: 'javascript-url', detail: match[0] });
  return found;
}

function isInternalReference(value) { return !value || value.startsWith('#'); }
function hasExternalCss(value) {
  if (/@import|javascript\s*:/i.test(value)) return true;
  const urls = String(value).matchAll(/url\s*\(\s*(["']?)(.*?)\1\s*\)/gi);
  for (const match of urls) if (!match[2].trim().startsWith('#')) return true;
  return false;
}
