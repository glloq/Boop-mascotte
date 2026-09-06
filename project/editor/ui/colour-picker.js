/**
 * Choosing a colour, as its own surface (docs/VECTOR_EDITING.md).
 *
 * A colour used to be an `<input type="color">` sitting in a row: the operating
 * system's picker, which knows nothing about the mascot being drawn. Matching
 * the skin, the hair or the line colour meant reading a hex out of one field
 * and typing it into another, and every shape drawn from the toolbar arrived
 * in the same blue because changing it was that much work.
 *
 * So the dialog leads with **the colours this mascot already uses**, read from
 * the artwork itself. That is the palette an author actually reaches for; a
 * standard set, a hex field and the system picker are there for everything
 * else, and "None" is a first-class answer because a shape with no fill or no
 * stroke is an ordinary thing to want.
 *
 * The reading is a pure function over the markup so it can be tested without a
 * browser, and the dialog is a thin shell around it.
 */

/** A small, neutral set for artwork that has no palette of its own yet. */
export const BASE_SWATCHES = Object.freeze([
  '#ffffff', '#e5e7eb', '#9ca3af', '#4b5563', '#1f2937', '#111827',
  '#fca5a5', '#ef4444', '#b91c1c', '#fdba74', '#f97316', '#b45309',
  '#fde68a', '#facc15', '#a3e635', '#22c55e', '#15803d', '#5eead4',
  '#60a5fa', '#2563eb', '#1e3a8a', '#c4b5fd', '#8b5cf6', '#db2777'
]);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc` and `#AABBCC` are the same colour; one spelling so the swatches do not repeat. */
export function normalizeColour(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!HEX.test(text)) return null;
  return text.length === 4 ? `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}` : text;
}

/**
 * Every colour the artwork paints with, in the order it first uses them.
 *
 * Attributes and inline styles both, because an imported SVG uses whichever it
 * likes. Anything that is not a plain hex -- `none`, a gradient reference, a
 * colour name -- is left out: a swatch has to be a colour the picker can show.
 *
 * @param {string} markup the artwork SVG
 * @param {number} limit how many to keep; the rest are the long tail of an
 *   imported drawing and would push the standard set off the screen
 */
export function paletteFromSvg(markup, limit = 24) {
  const palette = [];
  const seen = new Set();
  for (const match of String(markup || '').matchAll(/(?:fill|stroke|stop-color|flood-color)\s*[:=]\s*"?'?\s*(#[0-9a-fA-F]{3,8})/g)) {
    const colour = normalizeColour(match[1]);
    if (!colour || seen.has(colour)) continue;
    seen.add(colour);
    palette.push(colour);
    if (palette.length >= limit) break;
  }
  return palette;
}

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * @param {HTMLDialogElement} dialog
 * @param {{ palette?: () => string[] }} [deps] the artwork's own colours
 */
export function createColourPicker(dialog, { palette = () => [] } = {}) {
  let request = null;

  const close = () => { if (dialog.open) dialog.close(); };
  const pick = (value) => { const handler = request?.onPick; request = null; close(); handler?.(value); };

  dialog.addEventListener('click', (event) => {
    const swatch = event.target.closest('[data-colour-swatch]');
    if (swatch) { pick(swatch.dataset.colourSwatch); return; }
    if (event.target.closest('[data-colour-none]')) { pick('none'); return; }
    if (event.target.closest('[data-colour-cancel]')) { request = null; close(); return; }
    if (event.target.closest('[data-colour-apply]')) {
      const typed = normalizeColour(dialog.querySelector('[data-colour-hex]')?.value);
      pick(typed || dialog.querySelector('[data-colour-native]')?.value || '#000000');
    }
  });
  // The system picker stays available for a colour nothing on screen has yet:
  // it writes into the hex field rather than applying, so one press applies.
  dialog.addEventListener('input', (event) => {
    if (event.target.matches('[data-colour-native]')) {
      const hex = dialog.querySelector('[data-colour-hex]');
      if (hex) hex.value = event.target.value;
    }
  });
  dialog.addEventListener('submit', (event) => event.preventDefault());
  // Escape and the backdrop are a cancel, not a colour.
  dialog.addEventListener('close', () => { request = null; });

  const grid = (label, colours, current) => (colours.length
    ? `<h4>${esc(label)}</h4><div class="colour-grid" role="group" aria-label="${esc(label)}">${colours.map((colour) => `<button type="button" class="colour-swatch${colour === current ? ' current' : ''}" data-colour-swatch="${esc(colour)}" style="--swatch:${esc(colour)}" aria-label="${esc(colour)}" title="${esc(colour)}"></button>`).join('')}</div>`
    : '');

  /**
   * @param {{ value?: string, allowNone?: boolean, title?: string, onPick: (value: string) => void }} options
   */
  function open({ value = '', allowNone = true, title = 'Colour', onPick } = {}) {
    request = { onPick };
    const current = normalizeColour(value);
    const own = palette().filter((colour) => colour !== current);
    dialog.innerHTML = `<form method="dialog" class="colour-picker-body">
      <div class="card-title"><h3>${esc(title)}</h3><button type="button" class="icon" data-colour-cancel aria-label="Close">×</button></div>
      ${current ? grid('Now', [current], current) : '<p class="small">No colour: this piece is not painted.</p>'}
      ${grid('In this mascot', own, current)}
      ${grid('Standard', BASE_SWATCHES.filter((colour) => colour !== current && !own.includes(colour)), current)}
      <div class="colour-custom">
        <label for="colour-hex">Hex</label>
        <input id="colour-hex" data-colour-hex type="text" spellcheck="false" value="${esc(current || '')}" placeholder="#000000" aria-label="Colour as hex">
        <input data-colour-native type="color" value="${esc(current || '#000000')}" aria-label="Pick any colour">
      </div>
      <div class="dialog-actions">
        ${allowNone ? '<button type="button" class="secondary" data-colour-none>None</button>' : ''}
        <button type="button" class="secondary" data-colour-cancel>Cancel</button>
        <button type="button" class="primary" data-colour-apply>Use this colour</button>
      </div>
    </form>`;
    dialog.showModal();
    dialog.querySelector('[data-colour-hex]')?.focus();
  }

  return { open, close, isOpen: () => dialog.open };
}
