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
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:xml:base|base)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*(?:(["'])\s*javascript:[\s\S]*?\1|javascript:[^\s>]*)/gi, '')
    .replace(/\s+(?:href|xlink:href|src)\s*=\s*(["'])(?!\s*#)[\s\S]*?\1/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?(?:@import|url\s*\(\s*(?!["']?#))[\s\S]*?<\/style\s*>/gi, '')
    .replace(/url\s*\(\s*(["']?)\s*javascript:[^)]+\1\s*\)/gi, 'none');
}

function isInternalReference(value) { return !value || value.startsWith('#'); }
function hasExternalCss(value) {
  return /@import/i.test(value) || /url\s*\(\s*(["']?)(?!#)[^)]+\1\s*\)/i.test(value) || /javascript\s*:/i.test(value);
}
