/**
 * The parts the editor can add whole: the artwork, its rigging and an example
 * motion in one press. Everything else is drawn with the vector tools and given
 * a role in Face Setup.
 *
 * The copy lives here rather than in the one long markup line so that a card
 * can carry the reason it is unavailable -- "this mascot already has eyelids"
 * -- instead of offering "+ Add" and failing on the press.
 */
export const ADDABLE_PARTS = Object.freeze([
  Object.freeze({ id: 'eyebrows', name: 'Eyebrows', detail: 'Curious and angry expressions' }),
  Object.freeze({ id: 'eyelids', name: 'Eyelids', detail: 'Blinking, and eyes that can half close' }),
  Object.freeze({ id: 'hands', name: 'Hands', detail: 'Two floating hands with four digits, rigged with Fist, Point and Peace' })
]);

export function buildAddPartSection() {
  return `<div class="feature-list"><h3>Add a part</h3>${ADDABLE_PARTS.map((part) => `
    <article class="feature-card" data-feature-card="${part.id}">
      <div><b>${part.name}</b><small>${part.detail}</small><small class="feature-reason" data-feature-reason="${part.id}" hidden></small></div>
      <button data-add-feature="${part.id}">+ Add</button>
    </article>`).join('')}</div>`;
}

export function buildPluginSection() {
  return `
    <details open>
      <summary>Plugin manager</summary>
      <label><input id="plugin-path" type="checkbox" checked /> Enable path plugin</label>
      <div id="plugin-status" class="small"></div>
    </details>
  `;
}
