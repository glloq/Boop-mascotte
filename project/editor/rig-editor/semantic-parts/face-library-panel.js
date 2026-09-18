/**
 * The face part library, as a panel (docs/FACE_PART_LIBRARY.md).
 *
 * ```text
 *  Head  Eyes  Brows  Nose  Mouth  Ears  Hair  Facial hair  Accessories
 *  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
 *  │  ◉  ◉  │ │  ◡  ◡  │ │  ▬  ▬  │ │  ●  ●  │      ← the drawing itself
 *  │ Round  │ │ Sleepy │ │Cartoon │ │Minimal │
 *  └────────┘ └────────┘ └────────┘ └────────┘
 * ```
 *
 * The drawings ship with the editor and, until this panel, not one of them
 * could be put on a face: `facePartCommands.replace()` had no caller anywhere. The Character Builder that used to call it was removed and
 * nothing took its place, so *Add a part* offered three things (eyebrows,
 * eyelids, hands) and the twenty-one pairs of eyes, twenty mouths, fifteen sets
 * of ears and six heads of hair were unreachable.
 *
 * What a press does is **one command and one undo step**: the old part's
 * artwork leaves, the new drawing arrives fitted to this face's proportions,
 * its roles are taken by the new shapes, and the movements the old part had are
 * kept on drivers the new one can carry (`face-part-install.js`). That is all
 * pre-existing; this is the surface it was missing.
 *
 * It shows the drawing rather than its name, because *Sleepy* and *Cartoon* are
 * not words anybody can choose eyes by.
 */
import { faceLibraryModel } from '../../core/face-library/face-library-model.js';
import { facePartCategory } from '../../core/face-library/face-part-model.js';
import { rememberOpen, setPanelHtml } from '../../ui/panel-render.js';
import { esc } from '../../ui/escape-html.js';

/**
 * @param {HTMLElement} host
 * @param {object} store
 * @param {object} deps
 * @param {object} deps.commands              `createFacePartCommands` (core/face-library)
 * @param {(text: string, tone?: string) => void} [deps.onStatus]
 * @param {(id: string) => void} [deps.onSelect]  select the root the install made
 * @param {(id: string|null) => void} [deps.onPreview]  frame where a card would land, or none
 */
export function createFaceLibraryPanel(host, store, { commands, onStatus = () => {}, onSelect = () => {}, onPreview = () => {} } = {}) {
  const sections = rememberOpen(host);
  const doc = () => store.getDocument();
  // Which category is open, and nothing else. No project stores it, for the
  // same reason no project stores which cages were open.
  let category = 'eyes';
  let notice = null;

  const model = () => faceLibraryModel(doc(), { category });

  /**
   * Put one drawing on the face.
   *
   * `fresh: false`, which is the whole point of replacing rather than
   * installing: a part an author has moved keeps where they moved it to, and
   * only the drawing changes (`face-part-commands.js`).
   */
  function wear(assetId) {
    const result = commands.replace(category, assetId);
    if (!result?.ok) {
      notice = { tone: 'warn', text: result?.reason || 'That drawing could not go on this face.' };
      onStatus(notice.text, 'error');
      render();
      return;
    }
    const kept = result.enabled?.length ? ` Movements kept: ${result.enabled.join(', ')}.` : '';
    const lost = result.disabled?.length ? ` Off, because this drawing cannot carry them: ${result.disabled.join(', ')}.` : '';
    notice = { tone: 'success', text: `✓ ${facePartCategory(category)?.label || category} replaced.${kept}${lost}` };
    onStatus(notice.text);
    if (result.rootId) onSelect(result.rootId);
    render();
  }

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.faceLibraryCategory) { category = button.dataset.faceLibraryCategory; notice = null; onPreview(null); render(); return; }
    if (button.dataset.faceLibraryWear) { onPreview(null); wear(button.dataset.faceLibraryWear); }
  });

  /**
   * Point at a card, see where that drawing lands.
   *
   * The preview on a card is the drawing on the *template's* head. Which is
   * the one thing it cannot tell an author: how big it will be on *this* head,
   * and where. So pointing at one frames the landing on the canvas, and the
   * answer arrives before the press rather than after it.
   *
   * On focus too, and not only on hover: the cards are reachable by keyboard,
   * and a guide only a mouse can ask for is a guide half the authors never see.
   */
  const preview = (event) => {
    const card = event.target.closest?.('[data-face-library-card]');
    onPreview(card?.dataset.faceLibraryCard || null);
  };
  host.addEventListener('pointerover', preview);
  host.addEventListener('focusin', preview);
  host.addEventListener('pointerleave', () => onPreview(null));
  host.addEventListener('focusout', (event) => { if (!host.contains(event.relatedTarget)) onPreview(null); });

  function render() {
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; return; }
    const view = model();
    host.hidden = false;
    host.dataset.faceLibraryReady = 'true';
    host.dataset.faceLibraryCategory = view.active || '';
    host.dataset.faceLibraryCards = String(view.cards.length);
    host.dataset.faceLibraryTotal = String(view.total);

    // Only the categories the library has a drawing for. One with none is not
    // a category an author can do anything in, and a tab that opens on "no
    // drawings yet" is a tab that wasted a press.
    const tabs = view.categories.filter((item) => item.count).map((item) => `<button type="button" class="chip${item.id === view.active ? ' chip-active' : ''}" data-face-library-category="${esc(item.id)}" aria-pressed="${item.id === view.active}">${esc(item.label)} <small>${item.count}</small></button>`).join('');

    const cards = view.cards.map((card) => `<article class="face-library-card${card.worn ? ' face-library-worn' : ''}" data-face-library-card="${esc(card.id)}"${card.compatible ? '' : ' data-face-library-mismatch="true"'}>
      <svg class="face-library-preview" viewBox="${esc(card.preview.viewBox)}" aria-hidden="true" focusable="false">${card.preview.markup}</svg>
      <b>${esc(card.name)}</b>
      ${card.description ? `<small>${esc(card.description)}</small>` : ''}
      ${card.compatible ? '' : '<small class="face-library-note">Drawn for another kind of face.</small>'}
      <button type="button" class="${card.worn ? 'secondary' : ''}" data-face-library-wear="${esc(card.id)}" aria-label="${card.worn ? `${esc(card.name)} is on the face` : `Put ${esc(card.name)} on the face`}">${card.worn ? '✓ On the face' : 'Use it'}</button>
    </article>`).join('');

    const worn = view.categories.find((item) => item.id === view.active)?.worn;
    setPanelHtml(host, `<h3 id="face-library-heading">Face parts library</h3>
      <div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}">${esc(notice.text)}</p>` : ''}</div>
      <p class="small">${view.total} drawings. Choosing one replaces that part of the face: where you had moved it and the movements it had are kept, and the new drawing arrives fitted to this head.</p>
      <div class="pose-chips" role="group" aria-label="Which part">${tabs}</div>
      ${worn ? `<p class="small">Wearing <b>${esc(worn.name)}</b>.</p>` : '<p class="small">This part was drawn or imported rather than taken from the library.</p>'}
      <div class="face-library-cards" aria-labelledby="face-library-heading">${cards}</div>`);
    void sections;
  }

  return { render, snapshot: () => ({ category, ...structuredClone({ ...model(), cards: model().cards.map(({ preview, ...rest }) => rest) }) }) };
}
