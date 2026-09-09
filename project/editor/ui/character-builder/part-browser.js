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
 * ✋ Hands        Left hand · Right hand
 * ───────────────────────────────────────
 * ADVANCED  Layers, Face Setup, the rig…   [Artwork] [Face Setup]
 * ```
 *
 * One press on a category selects every piece of artwork that plays it, on
 * the canvas and in the inspector at once; the open category shows what it
 * holds. Nothing here reads the DOM of the mascot or writes the project: the
 * builder does both, this draws and reports presses.
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

function body(category, view) {
  if (category.kind === 'presets') return presetBrowserMarkup(view.presets);
  if (category.kind === 'hands') return handRowsMarkup(view.hands, { selectedId: view.selectedId });
  if (category.status === 'unavailable') return `<p class="small">${esc(category.summary)}. Until then, draw one with the vector tools in Artwork.</p>`;
  if (category.status === 'missing') return `<p class="small">${esc(category.summary)}. Give the part its artwork in Face Setup, or draw it in Artwork.</p><button type="button" class="secondary" data-character-route="face-setup">Assign it in Face Setup…</button>`;
  return chips(category.pieces, view.selectedId);
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
 * @param {(route: string) => void} [options.onRoute]
 * @param {(where: string) => void} [options.onAdvanced]
 */
export function createPartBrowser(host, { view = () => ({ categories: [], hands: [], presets: [] }), onCategory = () => {}, onPiece = () => {}, onPreset = () => {}, onRoute = () => {}, onAdvanced = () => {} } = {}) {
  if (!host) throw new Error('Missing required UI element: #part-browser');
  const component = createComponent({
    host,
    onMount: ({ listen }) => {
      listen(host, 'click', (event) => {
        const button = event.target?.closest?.('button');
        if (!button) return;
        const { partCategory, partPiece, characterPreset, characterRoute, characterAdvanced } = button.dataset || {};
        if (partCategory) onCategory(partCategory);
        else if (partPiece) onPiece(partPiece);
        else if (characterPreset) onPreset(characterPreset);
        else if (characterRoute) onRoute(characterRoute);
        else if (characterAdvanced) onAdvanced(characterAdvanced);
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
    hands: (current.hands || []).map((hand) => `${hand.side}:${hand.element || ''}:${hand.style || ''}:${hand.styleCount}`).join('|')
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
