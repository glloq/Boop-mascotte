/**
 * The one HTML escaper of the editor's panels: a value going into markup as
 * text or as an attribute value, with the five characters that would end or
 * open something replaced.
 */
export const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
