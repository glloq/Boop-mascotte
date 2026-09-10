/**
 * The left column of the Character Builder (docs/CHARACTER_BUILDER.md).
 *
 * ```text
 * ★ Presets      Ready-made faces to start from
 * ◯ Head         Face
 * ◉ Eyes         Left eye · Right eye        ← pressed: its pieces are selected
 *     [Left eye] [Right eye]
 * • Pupils       Left pupil · Right pupil
 * …
 * ◡ Mouth        Mouth · Teeth · Tongue
 *     [Mouth] [Teeth] [Tongue]
 *     Styles  [◡ Simple] [◡ Wide ✓]        ← the library's assets for it
 * ✋ Hands        Left hand · Right hand
 * ───────────────────────────────────────
 * ADVANCED  Layers, Face Setup, the rig…   [Artwork] [Face Setup]
 * ```
 *
 * One press on a category selects every piece of artwork that plays it, on
 * the canvas and in the inspector at once; the open category shows what it
 * holds, and the library's styles for it. Nothing here reads the DOM of the
 * mascot or writes the project: the builder does both, this draws and
 * reports presses.
 *
 * Behind the component lifecycle (docs/VNEXT_COMPONENTS.md): the model handed
 * in is flat, with the list folded into a signature, so an edit that changes
 * no name and no piece costs a comparison rather than a rebuild.
 */
import { createComponent } from '../component.js';
import { presetBrowserMarkup } from './preset-browser.js';
import { handRowsMarkup } from './hand-placement-panel.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function chips(pieces, selectedId) {
  return `<div class="part-pieces" role="group" aria-label="Pieces">${pieces.map((piece) => `<button type="button" class="chip${piece.id === selectedId ? ' chip-active' : ''}" data-part-piece="${esc(piece.id)}" aria-pressed="${piece.id === selectedId}" title="${esc(piece.roleLabel || piece.label)}">${esc(piece.label)}</button>`).join('')}</div>`;
}

/**
 * The library's assets for the open category, one card each.
 *
 * A card that cannot be pressed says why in its title, so a head that is
 * drawn around every other part explains itself rather than going grey.
 */
function styles(category, list) {
  if (!list?.length) return '';
  // A category a face wears several of always adds: a new mount joins, the same mount replaces.
  const verb = category.status === 'ready' && !category.multiple ? 'Use' : 'Add';
  const cards = list.map((style) => {
    const title = !style.available ? style.reason : style.current ? `${style.name}: ${category.multiple ? 'on the face now' : `the ${category.label.toLowerCase()} now`}. Press to put the library drawing back.` : `${verb} ${style.name}${style.description ? `: ${style.description}` : ''}${style.limited.length ? ` Limited animation: ${style.limited.join(', ')} not carried.` : ''}`;
    return `<button type="button" class="part-style${style.current ? ' part-style-current' : ''}" data-face-part="${esc(style.id)}" aria-pressed="${style.current}"${style.available ? '' : ' disabled'} title="${esc(title)}"><span class="part-style-thumb" aria-hidden="true">${style.thumbnail}</span><span class="part-style-name">${esc(style.name)}</span>${style.current ? '<small class="part-style-badge">Current</small>' : style.custom ? '<small class="part-style-badge part-style-mine">Mine</small>' : style.limited.length ? '<small class="part-style-badge part-style-limited">Limited</small>' : ''}</button>`;
  }).join('');
  // The author's own parts can be forgotten; a face wearing one keeps its drawing.
  const own = list.filter((style) => style.custom);
  const forget = own.length ? `<div class="preset-own part-own">${own.map((style) => `<button type="button" class="chip" data-face-part-forget="${esc(style.id)}" title="Forget this part of yours">${esc(style.name)} ×</button>`).join('')}</div>` : '';
  return `<div class="part-styles" role="group" aria-label="${esc(category.label)} styles" data-part-styles="${esc(category.id)}"><small class="part-styles-title">Styles</small><div class="part-style-list">${cards}</div>${forget}</div>`;
}

/**
 * The face's colours, one swatch a token (docs/FACE_PART_LIBRARY.md,
 * "Palette tokens"): the skin, the outline, the hair… wherever they are
 * painted. A token nothing on this face is painted as has no swatch.
 */
export function paletteRowsMarkup(palette) {
  const tokens = palette?.tokens || [];
  if (!tokens.length) return '<p class="small">No colours to read yet: start from a face, or assign its parts in Face Setup.</p>';
  const rows = tokens.map((entry) => `<button type="button" class="palette-row" data-face-token="${esc(entry.token)}" title="${esc(entry.colour)} · ${entry.uses.length} use${entry.uses.length === 1 ? '' : 's'} · click to change"><span class="paint-swatch part-swatch" style="--swatch:${esc(entry.colour)}" aria-hidden="true"></span><span class="palette-label">${esc(entry.label)}</span><small class="palette-uses">${entry.uses.length}</small></button>`).join('');
  return `<div class="palette-rows" role="list" aria-label="Colours of the face">${rows}</div><p class="small">A colour changes everywhere the face uses it, as one step.</p>`;
}

function body(category, view) {
  if (category.kind === 'presets') return presetBrowserMarkup(view.presets, view.facePresets || {});
  if (category.kind === 'palette') return paletteRowsMarkup(view.palette);
  if (category.kind === 'hands') return handRowsMarkup(view.hands, { selectedId: view.selectedId });
  if (category.status === 'unavailable') return `<p class="small">${esc(category.summary)}. Until then, draw one with the vector tools in Artwork.</p>`;
  if (category.status === 'missing') return `<p class="small">${esc(category.summary)}. ${view.styles?.length ? 'Pick a style below, g' : 'G'}ive the part its artwork in Face Setup, or draw it in Artwork.</p>${styles(category, view.styles)}<button type="button" class="secondary" data-character-route="face-setup">Assign it in Face Setup…</button>`;
  return `${chips(category.pieces, view.selectedId)}${styles(category, view.styles)}`;
}

function markup(model, view) {
  const rows = view.categories.map((category) => {
    const active = category.id === model.active;
    return `<div class="part-category" role="listitem" data-part-category-row="${esc(category.id)}" data-part-status="${esc(category.status)}" data-part-active="${active}">
      <button type="button" class="part-category-button" data-part-category="${esc(category.id)}" aria-pressed="${active}" title="${esc(category.hint || category.label)}"><span class="part-glyph" aria-hidden="true">${category.glyph || '◆'}</span><span class="part-label">${esc(category.label)}</span><small class="part-summary">${esc(category.summary)}</small></button>
      ${active ? `<div class="part-category-body" data-part-category-body="${esc(category.id)}">${body(category, view)}</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="part-browser" role="list" aria-label="Character parts">${rows}</div>
    <footer class="character-advanced" aria-label="Advanced"><b>Advanced</b><small>Layers, Face Setup, the rig and the full vector tools: the same mascot, every control.</small><div class="action-row"><button type="button" class="secondary" data-character-advanced="artwork">Artwork</button><button type="button" class="secondary" data-character-advanced="face-setup">Face Setup</button></div></footer>`;
}

/**
 * @param {HTMLElement} host
 * @param {object} options
 * @param {() => object} options.view  the rich view: `{categories, hands, presets, selectedId, active, loaded}`
 * @param {(id: string) => void} [options.onCategory]
 * @param {(id: string) => void} [options.onPiece]
 * @param {(id: string) => void} [options.onPreset]
 * @param {(assetId: string) => void} [options.onStyle]  a library asset for the open category
 * @param {(token: string) => void} [options.onToken]  a colour of the face, to change everywhere
 * @param {(id: string) => void} [options.onFacePreset]  a face-style preset on the face
 * @param {() => void} [options.onPresetReset]
 * @param {(name: string) => void} [options.onPresetSave]
 * @param {(id: string) => void} [options.onPresetForget]
 * @param {(route: string) => void} [options.onRoute]
 * @param {(where: string) => void} [options.onAdvanced]
 */
export function createPartBrowser(host, { view = () => ({ categories: [], hands: [], presets: [] }), onCategory = () => {}, onPiece = () => {}, onPreset = () => {}, onStyle = () => {}, onToken = () => {}, onFacePreset = () => {}, onPresetReset = () => {}, onPresetSave = () => {}, onPresetForget = () => {}, onRoute = () => {}, onAdvanced = () => {}, onHandStyle = () => {}, onStyleForget = () => {} } = {}) {
  if (!host) throw new Error('Missing required UI element: #part-browser');
  const component = createComponent({
    host,
    onMount: ({ listen }) => {
      // Saving a preset is a form: Enter in the name field saves it too.
      listen(host, 'submit', (event) => {
        const form = event.target?.closest?.('[data-preset-save-form]') || (event.target?.dataset?.presetSaveForm !== undefined ? event.target : null);
        if (!form) return;
        event.preventDefault?.();
        const field = form.querySelector?.('[data-preset-name]') || event.name;
        const name = String(field?.value ?? event.value ?? '').trim();
        if (name) onPresetSave(name);
      });
      listen(host, 'click', (event) => {
        const button = event.target?.closest?.('button');
        if (!button) return;
        if (button.dataset?.presetSave !== undefined) return;
        const { partCategory, partPiece, characterPreset, facePart, faceToken, facePreset, presetReset, presetForget, characterRoute, characterAdvanced, handStyle, facePartForget } = button.dataset || {};
        if (partCategory) onCategory(partCategory);
        else if (partPiece) onPiece(partPiece);
        else if (characterPreset) onPreset(characterPreset);
        else if (facePart) { if (!button.disabled) onStyle(facePart); }
        else if (faceToken) onToken(faceToken);
        else if (facePreset) { if (!button.disabled) onFacePreset(facePreset); }
        else if (presetReset !== undefined) { if (!button.disabled) onPresetReset(); }
        else if (presetForget) onPresetForget(presetForget);
        else if (characterRoute) onRoute(characterRoute);
        else if (characterAdvanced) onAdvanced(characterAdvanced);
        else if (handStyle) onHandStyle(handStyle);
        else if (facePartForget) onStyleForget(facePartForget);
      });
    },
    render: (model) => {
      const current = view();
      host.innerHTML = markup(model, current);
      host.dataset.partActive = model.active || '';
      host.dataset.partReady = String(Boolean(model.loaded));
    }
  });

  /** The flat model: everything the markup depends on, the list as one string. */
  const flatten = (current) => ({
    loaded: Boolean(current.loaded),
    active: current.active || null,
    selectedId: current.selectedId || null,
    signature: current.categories.map((category) => `${category.id}:${category.status}:${category.pieces.map((piece) => `${piece.id}=${piece.label}`).join(',')}`).join('|'),
    styles: (current.styles || []).map((style) => `${style.id}:${style.name}:${style.current ? 1 : 0}:${style.available ? 1 : 0}:${style.custom ? 1 : 0}`).join('|'),
    palette: (current.palette?.tokens || []).map((entry) => `${entry.token}=${entry.colour}:${entry.uses.length}`).join('|'),
    facePresets: current.facePresets ? `${current.facePresets.loaded ? 1 : 0}:${current.facePresets.current || ''}:${(current.facePresets.styles || []).map((style) => `${style.id}=${style.name}`).join(',')}` : '',
    hands: (current.hands || []).map((hand) => `${hand.side}:${hand.element || ''}:${hand.style || ''}:${hand.styleCount}:${(hand.styles || []).map((style) => `${style.id}${style.drawn ? '+' : '-'}${style.resting ? '*' : ''}`).join(',')}`).join('|')
  });

  return {
    /** @returns {boolean} whether anything was drawn */
    render() {
      const model = flatten(view());
      return component.isMounted() ? component.update(model) : component.mount(model);
    },
    destroy: () => component.destroy(),
    counters: () => component.counters()
  };
}
