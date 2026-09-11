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

/**
 * Building a face from a head, a pair of eyes and a mouth (V3-08,
 * docs/V3_ROADMAP.md).
 *
 * It was on Home, beside the ways to start with nothing of your own. Home is
 * the preset and the mascot as it comes now, so the Face Builder sits with the
 * other two things that replace the artwork you have -- Start over with the
 * Mascot Face, and Blank canvas -- one disclosure into Artwork, which is the
 * task that makes artwork. That is where the work happens; it is not the three
 * disclosures it used to be buried under.
 */
const FACE_BUILDER_FIELDS = [
  { id: 'face-head', label: 'Head', options: [['circle', 'Circle'], ['square', 'Rounded square']] },
  { id: 'face-eyes', label: 'Eyes', options: [['oval', 'Oval'], ['dot', 'Dot']] },
  { id: 'face-mouth', label: 'Mouth', options: [['smile', 'Smile'], ['flat', 'Flat'], ['sad', 'Sad']] }
];

/**
 * The three ways to put a different mascot on the canvas. Each one replaces the
 * project, so they are one group and they say so; `bindLoadSample` binds the
 * first two and `bindGenerateFace` the third.
 */
export function buildStartArtworkSection() {
  return `<div class="template-cards">
    <button id="empty-basic"><b>◯ Start over with the Mascot Face</b><small>Replace the current artwork with the complete cartoon face template, rigged and turning in 2.5D.</small></button>
    <button data-template-id="blank"><b>▢ Start over with a blank canvas</b><small>An empty working area to draw your own, with the Pen, shape and Text tools.</small></button>
    <button data-face-builder aria-expanded="false" aria-controls="face-builder"><b>☺ Build a face</b><small>Pick a head, eyes and a mouth; they arrive rigged, with gaze and eyebrows.</small></button>
    </div><div class="face-builder" id="face-builder" hidden role="group" aria-label="Build a face">${FACE_BUILDER_FIELDS.map((field) => `<label for="${field.id}">${field.label}</label><select id="${field.id}">${field.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>`).join('')}<button id="generate-face">Create mascot</button></div>`;
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
