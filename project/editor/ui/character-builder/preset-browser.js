/**
 * The presets, as the builder offers them (docs/CHARACTER_BUILDER.md;
 * docs/FACE_PART_LIBRARY.md, "Presets").
 *
 * ```text
 * [ Mascot Face ]  the template, to start over
 * [ Classic ] [ Professor ] [ Young ]      ← one press each, a picture each
 * [ Old     ] [ Robot     ] [ Minimal ]      the one the face wears is marked
 * Reset preset · Save the face as a preset [ name ] [Save]
 * ```
 *
 * A face-style preset is a recipe over the library, applied to the face that
 * is there as one undo step; the template card is a whole face, loaded
 * through the project service with its confirmation. Markup only; the
 * builder owns the press.
 */
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export const CHARACTER_PRESETS = Object.freeze([
  Object.freeze({ id: 'basic', title: 'Mascot Face', description: 'The complete cartoon face: rigged, turning in 2.5D, with a pair of hands. Start over from it.', template: 'basic' })
]);

export const characterPreset = (id) => CHARACTER_PRESETS.find((preset) => preset.id === id) || null;

/**
 * The preset cards, one press each.
 *
 * @param {object[]} presets the template presets
 * @param {{ styles?: { id, name, description, thumbnail, current, custom }[], current?: string|null, loaded?: boolean }} [view] the face-style presets
 */
export function presetBrowserMarkup(presets = CHARACTER_PRESETS, view = {}) {
  const templates = presets.map((preset) => `<article class="feature-card preset-face" role="listitem" data-character-preset-card="${esc(preset.id)}"><div><b>${esc(preset.title)}</b><small>${esc(preset.description)}</small></div><button type="button" data-character-preset="${esc(preset.id)}" aria-label="Use ${esc(preset.title)}">Use</button></article>`).join('');
  const styles = view.styles || [];
  const cards = styles.map((style) => `<button type="button" class="face-preset${style.current ? ' face-preset-current' : ''}" data-face-preset="${esc(style.id)}" aria-pressed="${style.current}"${view.loaded ? '' : ' disabled'} title="${esc(view.loaded ? (style.current ? `${style.name}: what the face wears. Press to put every part back where the preset puts it.` : `${style.name}: ${style.description}`) : 'Start from a face first.')}"><span class="face-preset-thumb">${style.thumbnail}</span><span class="face-preset-name">${esc(style.name)}</span>${style.current ? '<small class="part-style-badge">Current</small>' : style.custom ? '<small class="part-style-badge part-style-custom">Mine</small>' : ''}</button>`).join('');
  const own = styles.filter((style) => style.custom);
  const tools = view.loaded ? `<div class="preset-tools"><button type="button" class="secondary" data-preset-reset${view.current ? '' : ' disabled'} title="${esc(view.current ? 'Every part back where the preset puts it, as one step.' : 'The face wears no preset.')}">Reset preset</button>
    <form class="preset-save" data-preset-save-form><label>Save the face as a preset<input type="text" data-preset-name placeholder="A name" maxlength="40" required></label><button type="submit" class="secondary" data-preset-save>Save</button></form>${own.length ? `<div class="preset-own">${own.map((style) => `<button type="button" class="chip" data-preset-forget="${esc(style.id)}" title="Forget this preset">${esc(style.name)} ×</button>`).join('')}</div>` : ''}</div>` : '';
  return `<div class="preset-browser" role="list" aria-label="Face presets">${templates}<div class="face-presets" role="group" aria-label="Face styles">${cards}</div>${tools}<p class="small">A preset is the library's parts and a palette, on the face that is there: one undo step, every part still editable.</p></div>`;
}
