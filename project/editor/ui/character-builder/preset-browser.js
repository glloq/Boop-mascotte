/**
 * The presets, as the builder offers them today (docs/CHARACTER_BUILDER.md).
 *
 * The face-style presets of the roadmap -- Classic, Professor, Robot -- arrive
 * with the part library. Until then a preset is a whole template face, and
 * choosing one is the same replacement the Home card makes, confirmation and
 * all: nothing is lost quietly. Markup only; the builder owns the press.
 */
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export const CHARACTER_PRESETS = Object.freeze([
  Object.freeze({ id: 'basic', title: 'Mascot Face', description: 'The complete cartoon face: rigged, turning in 2.5D, with a pair of hands.', template: 'basic' })
]);

export const characterPreset = (id) => CHARACTER_PRESETS.find((preset) => preset.id === id) || null;

/** The preset cards, one press each. */
export function presetBrowserMarkup(presets = CHARACTER_PRESETS) {
  return `<div class="preset-browser" role="list" aria-label="Face presets">${presets.map((preset) => `<article class="feature-card preset-face" role="listitem" data-character-preset-card="${esc(preset.id)}"><div><b>${esc(preset.title)}</b><small>${esc(preset.description)}</small></div><button type="button" data-character-preset="${esc(preset.id)}" aria-label="Use ${esc(preset.title)}">Use</button></article>`).join('')}<p class="small">More faces arrive with the part library. Every preset stays editable here, part by part.</p></div>`;
}
