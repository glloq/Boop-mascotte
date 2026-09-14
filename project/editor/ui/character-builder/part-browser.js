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
import { setPanelHtml } from '../panel-render.js';
import { presetBrowserMarkup } from './preset-browser.js';
import { typeSelectMarkup } from './type-browser.js';
import { styleSelectMarkup } from './style-browser.js';
import { handRowsMarkup } from './hand-placement-panel.js';
import { partDragPayload, writePartDrag } from './part-drag.js';
import { walkRing } from './ring-keys.js';
import { isColour } from '../../core/face-library/palette-model.js';
import { esc } from '../escape-html.js';

function chips(pieces, selectedId) {
  return `<div class="part-pieces" role="group" aria-label="Pieces">${pieces.map((piece) => `<button type="button" class="chip${piece.id === selectedId ? ' chip-active' : ''}" data-part-piece="${esc(piece.id)}" aria-pressed="${piece.id === selectedId}" title="${esc(piece.roleLabel || piece.label)}">${esc(piece.label)}</button>`).join('')}</div>`;
}

/**
 * The library's assets for the open category, one card each.
 *
 * A card that cannot be pressed says why in its title, so a head that is
 * drawn around every other part explains itself rather than going grey.
 *
 * Under the grid, **Show every drawing** lifts the kind filter (MASC-07, and
 * docs/AUDIT_UI_2026-09/02_PROBLEMES.md §9.2). The filter is right and stays
 * the default — a person making a human face has no use for four kinds of
 * antenna — but it was *total*: six muzzles, six beaks and six crests were
 * simply absent from every list, with no way to see them, and putting a beak on
 * a human face is a reasonable thing to want. Lifted, a card for another kind
 * carries a badge saying which; offered, never hidden, and never pretending.
 *
 * A category a face wears several of -- accessories, facial hair -- has cards
 * that go both ways (docs/FACE_PART_LIBRARY.md, "Several at once"), and each
 * one says which before it is pressed: a card the face is wearing is marked
 * *On ×*, its title reads "Press to take it off" and its name for a screen
 * reader is "Take Glasses off"; any other card adds. So taking off is where
 * putting on is, and neither press is a guess.
 */
function styles(category, list, showAll = false) {
  // The escape hatch survives an empty list, because an empty list is exactly
  // when it is wanted: a row the kind filter has emptied is a row whose only
  // useful control is the one that lifts the filter.
  const everything = category.part ? `<label class="part-show-all"><input type="checkbox" data-part-show-all${showAll ? ' checked' : ''}> Show every drawing<small>Past this kind of face</small></label>` : '';
  if (!list?.length) return everything;
  // Which word a card uses is whether this row **accumulates** (MASC-08C).
  // Only the catch-all rows do: Accessories really holds glasses and a hat and
  // a scarf at once, so its cards *add*. A row that is a visual slot of its own
  // -- Muzzle, Whiskers, Beak, Horns -- holds one thing however *multiple* its
  // semantic category is, so its cards *use*, exactly as Mouth's do. The word
  // is all that changes: where a card lands is the row's own rule, decided in
  // `visual-rows.js` and not here.
  const joins = Boolean(category.multiple && !category.dedicated);
  const verb = joins || (!category.dedicated && category.status !== 'ready') ? 'Add' : 'Use';
  const cards = list.map((style) => {
    // What a card says about movement is the *warning*, never the inventory
    // (UIR-04): every card used to read out every movement of its category with
    // a ✓ or a – against it, which is nine facts on a card whose job is to say
    // what the part looks like. A drawing that carries everything says nothing;
    // one that does not says how many, and Rig is where which ones lives.
    const animation = style.limited.length
      ? ` ${style.limited.length} movement${style.limited.length === 1 ? '' : 's'} ${style.limited.length === 1 ? 'is' : 'are'} not carried by this drawing — Rig ▸ Controls says which.`
      : '';
    const title = !style.available ? style.reason
      : style.removes ? `${style.name}: on the face now. Press to take it off.${animation}`
        : style.current ? `${style.name}: ${joins ? 'on the face now' : `the ${category.label.toLowerCase()} now`}. Press to put the library drawing back.${animation}`
          : `${verb} ${style.name}${style.description ? `: ${style.description}` : ''}${animation}`;
    // The badge is the card's state and its verb at once: worn and coming off,
    // or worn and staying. A drag puts a drawing *on* the mascot, so a card
    // whose press takes its part off has nothing to drop there and is not
    // draggable -- the press is the whole toggle, as it is for a keyboard.
    const badge = style.removes ? '<small class="part-style-badge part-style-worn">On ×</small>'
      : style.current ? '<small class="part-style-badge">Current</small>'
        : style.pack ? `<small class="part-style-badge part-style-pack" title="From the pack ${esc(style.pack)}">Pack</small>`
          : style.custom ? '<small class="part-style-badge part-style-mine">Mine</small>'
            // With the kind filter lifted, a drawing meant for another kind of
            // face says which. Offered, never hidden, and never pretending.
            : style.otherKind ? `<small class="part-style-badge part-style-other" title="Drawn for a ${esc(style.otherKind.toLowerCase())} face">${esc(style.otherKind)}</small>`
              : style.limited.length ? '<small class="part-style-badge part-style-limited">Limited</small>' : '';
    const drag = style.available && !style.removes ? ` draggable="true" data-drag="${esc(partDragPayload('face-part', style.id))}"` : '';
    // The × is a picture, not a word: a card that comes off is named for what
    // the press does, so nothing reads it out as "On times".
    const label = style.removes ? ` aria-label="${esc(`Take ${style.name} off`)}"` : '';
    return `<button type="button" class="part-style${style.current ? ' part-style-current' : ''}" data-face-part="${esc(style.id)}" aria-pressed="${style.current}"${style.available ? '' : ' disabled'}${label} title="${esc(title)}"${drag}><span class="part-style-thumb" aria-hidden="true">${style.thumbnail}</span><span class="part-style-name">${esc(style.name)}</span>${badge}</button>`;
  }).join('');
  // The author's own parts can be forgotten; a face wearing one keeps its drawing.
  const own = list.filter((style) => style.custom);
  const forget = own.length ? `<div class="preset-own part-own">${own.map((style) => `<button type="button" class="chip" data-face-part-forget="${esc(style.id)}" title="Forget this part of yours">${esc(style.name)} ×</button>`).join('')}</div>` : '';
  const hint = category.multiple ? '· press one to put it on, press it again to take it off' : '· press one, or drag it onto the mascot';
  return `<div class="part-styles" role="group" aria-label="${esc(category.label)} styles" data-part-styles="${esc(category.id)}"><small class="part-styles-title">Styles <span class="part-styles-hint">${hint}</span></small><div class="part-style-list">${cards}</div>${forget}${everything}</div>`;
}

/**
 * The face's colours, one swatch a token (docs/FACE_PART_LIBRARY.md,
 * "Palette tokens"): the skin, the outline, the hair… wherever they are
 * painted. A token nothing on this face is painted as has no swatch.
 */
export function paletteRowsMarkup(palette) {
  const tokens = palette?.tokens || [];
  if (!tokens.length) return '<p class="small">No colours to read yet: start from a face, or assign its parts in Face Setup.</p>';
  const rows = tokens.map((entry) => `<button type="button" class="palette-row" data-face-token="${esc(entry.token)}" title="${esc(entry.colour)} · ${entry.uses.length} use${entry.uses.length === 1 ? '' : 's'} · click to change"><span class="paint-swatch part-swatch" style="--swatch:${esc(isColour(entry.colour) ? entry.colour : 'transparent')}" aria-hidden="true"></span><span class="palette-label">${esc(entry.label)}</span><small class="palette-uses">${entry.uses.length}</small></button>`).join('');
  return `<div class="palette-rows" role="list" aria-label="Colours of the face">${rows}</div><p class="small">A colour changes everywhere the face uses it, as one step.</p>`;
}

function body(category, view) {
  if (category.kind === 'presets') return presetBrowserMarkup(view.presets, view.facePresets || {});
  if (category.kind === 'palette') return paletteRowsMarkup(view.palette);
  if (category.kind === 'hands') return handRowsMarkup(view.hands, { selectedId: view.selectedId });
  if (view.query?.trim() && category.part && !view.styles?.length) return `<p class="small" data-part-no-hits>Nothing in ${esc(category.label)} matches “${esc(view.query.trim())}”.</p>`;
  if (category.status === 'unavailable') return `<p class="small">${esc(category.summary)}. Until then, draw one with the vector tools in Artwork.</p>`;
  if (category.status === 'missing') return `<p class="small">${esc(category.summary)}. ${view.styles?.length ? 'Pick a style below, g' : 'G'}ive the part its artwork in Face Setup, or draw it in Artwork.</p>${styles(category, view.styles, view.showAll)}<button type="button" class="secondary" data-character-route="face-setup">Assign it in Face Setup…</button>`;
  return `${chips(category.pieces, view.selectedId)}${styles(category, view.styles, view.showAll)}`;
}

/**
 * What the panel is set to, over the list rather than in it.
 *
 * ```text
 * Human ▾   Soft Cartoon ▾        ← what the library offers, and in what look
 * 🔍 [ search 150 drawings   ]
 * ```
 *
 * Both used to be rows — the second and third things in a panel whose subject
 * is the face, above the head. Neither is a part of it: *Type* says of itself
 * that it "changes nothing on the mascot", and *Style* is a count of what the
 * library could redraw. As two `<select>`s they say the same thing in a line
 * instead of two screenfuls, and the list below starts on *Head*.
 *
 * The search is the other half of the audit's §8.2: a hundred and fifty
 * drawings and no way to look for one. It matches the name, the description and
 * the tags the assets have carried since MASC-02 and nothing has ever read.
 */
function header(view) {
  if (!view.loaded) return '';
  const search = `<div class="part-search"><input type="search" data-part-search placeholder="Search ${view.libraryCount || ''} drawings" aria-label="Search the library of drawings" value="${esc(view.query || '')}" autocomplete="off" spellcheck="false">${view.query ? '<button type="button" class="icon" data-part-search-clear aria-label="Clear the search">×</button>' : ''}</div>`;
  return `<div class="part-header" data-part-header><div class="face-settings">${typeSelectMarkup({ ...(view.types || {}), compact: true })}${styleSelectMarkup(view.faceStyles || {})}</div>${search}</div>`;
}

function markup(model, view) {
  // A search narrows the rows to the ones that still have something in them,
  // and says how many. A row with no hits is dimmed rather than removed: a
  // list that changes length under a search is a list nobody can keep their
  // place in, and "Mouth — none" is an answer.
  const searching = Boolean(view.query?.trim());
  const rows = view.categories.map((category) => {
    const active = category.id === model.active;
    const hits = searching && view.hits ? view.hits[category.id] : undefined;
    const summary = hits === undefined ? category.summary : hits ? `${hits} drawing${hits === 1 ? '' : 's'}` : 'none';
    return `<div class="part-category" role="listitem" data-part-category-row="${esc(category.id)}" data-part-status="${esc(category.status)}" data-part-active="${active}"${hits === undefined ? '' : ` data-part-hits="${hits}"`}>
      <button type="button" class="part-category-button" data-part-category="${esc(category.id)}" aria-pressed="${active}" title="${esc(category.hint || category.label)}"><span class="part-glyph" aria-hidden="true">${category.glyph || '◆'}</span><span class="part-label">${esc(category.label)}</span><small class="part-summary">${esc(summary)}</small></button>
      ${active ? `<div class="part-category-body" data-part-category-body="${esc(category.id)}">${body(category, view)}</div>` : ''}
    </div>`;
  }).join('');
  return `${header(view)}<div class="part-browser" role="list" aria-label="Character parts">${rows}</div>
    <footer class="character-advanced" aria-label="Advanced"><b>Advanced</b><small>Layers, Face Setup, the rig and the full vector tools: the same mascot, every control.</small><div class="action-row"><button type="button" class="secondary" data-character-advanced="artwork">Artwork</button><button type="button" class="secondary" data-character-advanced="face-setup">Face Setup</button></div></footer>`;
}

/**
 * @param {HTMLElement} host
 * @param {object} options
 * @param {() => object} options.view  the rich view: `{categories, hands, presets, selectedId, active, loaded}`
 * @param {(id: string) => void} [options.onCategory]
 * @param {(id: string) => void} [options.onPiece]
 * @param {(id: string) => void} [options.onPreset]
 * @param {(id: string) => void} [options.onType]  the kind of face Design is offering for
 * @param {(id: string) => void} [options.onFaceStyle]  redraw the face in a style
 * @param {(assetId: string) => void} [options.onStyle]  a library asset for the open category
 * @param {(token: string) => void} [options.onToken]  a colour of the face, to change everywhere
 * @param {(id: string) => void} [options.onFacePreset]  a face-style preset on the face
 * @param {() => void} [options.onPresetReset]
 * @param {(name: string) => void} [options.onPresetSave]
 * @param {(id: string) => void} [options.onPresetForget]
 * @param {(route: string) => void} [options.onRoute]
 * @param {(query: string) => void} [options.onSearch]  what to look for in the library
 * @param {(on: boolean) => void} [options.onShowAll]  offer the library past this kind of face
 * @param {(where: string) => void} [options.onAdvanced]
 */
export function createPartBrowser(host, { view = () => ({ categories: [], hands: [], presets: [] }), onCategory = () => {}, onPiece = () => {}, onPreset = () => {}, onType = () => {}, onFaceStyle = () => {}, onStyle = () => {}, onToken = () => {}, onFacePreset = () => {}, onPresetReset = () => {}, onPresetSave = () => {}, onPresetForget = () => {}, onRoute = () => {}, onAdvanced = () => {}, onHandStyle = () => {}, onStyleForget = () => {}, onSearch = () => {}, onShowAll = () => {} } = {}) {
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
      // The arrow keys walk a row of cards or chips, and the category rows (ring-keys.js).
      listen(host, 'keydown', walkRing);
      // A card picked up: what it is goes on the drag, for the canvas to read
      // on the drop (part-drag.js). A card that cannot be pressed is not dragged.
      listen(host, 'dragstart', (event) => {
        const card = event.target?.closest?.('[data-drag]');
        if (!card) return;
        if (card.disabled || !writePartDrag(event.dataTransfer, card.dataset?.drag)) { event.preventDefault?.(); return; }
        card.classList?.add?.('part-drag-source');
      });
      listen(host, 'dragend', (event) => { event.target?.closest?.('[data-drag]')?.classList?.remove?.('part-drag-source'); });
      /*
       * The two settings over the list, and the search under them.
       *
       * A `<select>` the model *refuses* — a kind nobody has drawn for, a look
       * that would redraw nothing — leaves the control showing a value that is
       * not true, and no redraw can fix it: nothing about the panel changed, so
       * the comparison correctly sees no work to do. The model is the
       * authority, so the control is put back from it here.
       */
      const settle = (field, chosen) => { if (chosen && field.value !== chosen) field.value = chosen; };
      listen(host, 'change', (event) => {
        const field = event.target;
        if (field?.dataset?.partShowAll !== undefined) { onShowAll(field.checked); return; }
        if (field?.dataset?.faceType !== undefined) {
          onType(field.value);
          settle(field, (view().types?.types || []).find((type) => type.current)?.id);
          return;
        }
        if (field?.dataset?.faceStyle !== undefined) {
          onFaceStyle(field.value);
          settle(field, (view().faceStyles?.styles || []).find((style) => style.total && style.already === style.total)?.id);
        }
      });
      listen(host, 'input', (event) => { if (event.target?.dataset?.partSearch !== undefined) onSearch(event.target.value); });
      listen(host, 'click', (event) => {
        const button = event.target?.closest?.('button');
        if (!button) return;
        if (button.dataset?.partSearchClear !== undefined) { onSearch(''); return; }
        if (button.dataset?.presetSave !== undefined) return;
        const { partCategory, partPiece, characterPreset, faceType, faceStyle, facePart, faceToken, facePreset, presetReset, presetForget, characterRoute, characterAdvanced, handStyle, facePartForget } = button.dataset || {};
        if (partCategory) onCategory(partCategory);
        else if (partPiece) onPiece(partPiece);
        else if (characterPreset) onPreset(characterPreset);
        else if (faceType) { if (!button.disabled) onType(faceType); }
        else if (faceStyle) { if (!button.disabled) onFaceStyle(faceStyle); }
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
      // The search field rebuilds on every keystroke it causes, so the caret
      // has to be put back where it was or a query longer than one letter is
      // impossible to type.
      const active = host.ownerDocument?.activeElement;
      const typing = active?.dataset?.partSearch !== undefined ? active.selectionStart : null;
      setPanelHtml(host, markup(model, current));
      host.dataset.partActive = model.active || '';
      host.dataset.partReady = String(Boolean(model.loaded));
      if (typing !== null) {
        const field = host.querySelector('[data-part-search]');
        if (field) { field.focus(); field.setSelectionRange?.(typing, typing); }
      }
    }
  });

  /** The flat model: everything the markup depends on, the list as one string. */
  const flatten = (current) => ({
    loaded: Boolean(current.loaded),
    active: current.active || null,
    selectedId: current.selectedId || null,
    // The header is drawn on every render now rather than only when its row is
    // open, so what it shows has to be part of what decides a redraw.
    query: current.query || '',
    showAll: Boolean(current.showAll),
    libraryCount: current.libraryCount || 0,
    hits: current.hits ? Object.entries(current.hits).map(([id, n]) => `${id}=${n}`).join(',') : '',
    signature: current.categories.map((category) => `${category.id}:${category.status}:${category.pieces.map((piece) => `${piece.id}=${piece.label}`).join(',')}`).join('|'),
    styles: (current.styles || []).map((style) => `${style.id}:${style.name}:${style.current ? 1 : 0}:${style.available ? 1 : 0}:${style.custom ? 1 : 0}:${style.pack || ''}:${style.removes || ''}:${style.otherKind || ''}`).join('|'),
    palette: (current.palette?.tokens || []).map((entry) => `${entry.token}=${entry.colour}:${entry.uses.length}`).join('|'),
    types: (current.types?.types || []).map((type) => `${type.id}:${type.current ? 1 : 0}:${type.available ? 1 : 0}`).join('|'),
    faceStyles: current.faceStyles ? `${current.faceStyles.loaded ? 1 : 0}:${current.faceStyles.notice || ''}:${(current.faceStyles.styles || []).map((style) => `${style.id}=${style.restyled}/${style.total}`).join(',')}` : '',
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
