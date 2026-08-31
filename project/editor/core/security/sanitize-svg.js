/** Removes executable SVG features before markup is inserted into the editor DOM. */
export function sanitizeSvgMarkup(markup) {
  if (typeof markup !== 'string' || !/<svg\b/i.test(markup)) throw new Error('The imported document is not an SVG.');
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*(?:(["'])\s*javascript:[\s\S]*?\1|javascript:[^\s>]*)/gi, '')
    .replace(/url\s*\(\s*(["']?)\s*javascript:[^)]+\1\s*\)/gi, 'none');
}
