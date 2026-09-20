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
 *
 * ## It opens on what you have selected (UX-50 PR 7)
 *
 * It used to open on Eyes and stay there. So an author who had just clicked the
 * mouth -- on the canvas, in the layer tree, from anywhere -- was shown
 * twenty-one pairs of eyes and had to find the *Mouth* tab by eye to tell the
 * editor something it already knew (§6 of the brief).
 *
 * Now the selection chooses the category, through the one derivation every
 * contextual panel reads (`core/selectors/selection-subject.js`). Pressing a
 * tab still wins -- a press is a choice, and it outlives the selection that
 * preceded it -- until the selection moves to a different part, at which point
 * the panel follows again rather than stranding the author on a tab they picked
 * three parts ago.
 *
 * And the cards say what a drawing would **cost** before it is pressed:
 * *Limited animation* names the movements this face is using that the drawing
 * cannot carry. The install already reported that afterwards, which is the
 * wrong end of the decision.
 */
import { faceLibraryModel, resolveLibraryCategory } from '../../core/face-library/face-library-model.js';
import { facePartCategory } from '../../core/face-library/face-part-model.js';
import { rememberOpen, setPanelHtml } from '../../ui/panel-render.js';
import { esc } from '../../ui/escape-html.js';
import { movementEntry } from './face-movements.js';

/**
 * A movement in the words the Movements panel uses for it.
 *
 * A badge reading "mouthRound, teeth, tongue would switch off" names three
 * implementation ids at an author who has never seen one (§5: internal ids are
 * not exposed by default).
 */
const movementWord = (control) => movementEntry(control)?.label?.toLowerCase() || control;

/**
 * @param {HTMLElement} host
 * @param {object} store
 * @param {object} deps
 * @param {object} deps.commands              `createFacePartCommands` (core/face-library)
 * @param {(text: string, tone?: string) => void} [deps.onStatus]
 * @param {(id: string) => void} [deps.onSelect]  select the root the install made
 * @param {(id: string|null) => void} [deps.onPreview]  frame where a card would land, or none
 * @param {() => string|null} [deps.subject]  the library category the selection
 *   names, from `core/selectors/selection-subject.js`; `null` when the author
 *   has nothing in hand, and the panel then opens where it always opened
 * @param {() => boolean} [deps.shown]  whether this column is on screen at all
 */
export function createFaceLibraryPanel(host, store, { commands, onStatus = () => {}, onSelect = () => {}, onPreview = () => {}, subject = null, shown = () => true } = {}) {
  const sections = rememberOpen(host);
  const doc = () => store.getDocument();
  // Which category the author asked for **by pressing a tab**, and nothing
  // else. `null` means "whatever is selected". No project stores either, for
  // the same reason no project stores which cages were open.
  let category = null;
  // The part the panel last followed, so a pressed tab can be released the
  // moment the author selects a different part of the face.
  let followed = null;
  let showAll = false;
  /**
   * Whether the packs the editor no longer offers are on the shelf (V6, §3).
   *
   * The animal, robot and bird drawings are ninety of the library's hundred and
   * thirty-two, and the editor is about human faces: a Mouth row that offers
   * one mouth rather than sixteen is the whole of the recentring an author sees
   * (`core/face-library/face-catalogue.js`). Session state on this host, like
   * the pressed tab and the compatibility filter beside it: no project stores
   * which shelves somebody looked at.
   */
  let showLegacy = false;
  let notice = null;
  /** The signature of what is on screen, so an identical render is skipped. */
  let drawn = null;

  /** The library category the selection names, or `null` when it names none. */
  const selected = () => (typeof subject === 'function' ? subject() : null) || null;

  /**
   * Catch up with the selection, and answer what it names.
   *
   * A press outlives the selection that preceded it, and not one that follows
   * it: moving to another part of the face releases the tab. Both the model
   * and the render guard need this rule applied before they read anything, so
   * it lives once — two copies of it and a signature computed against a tab
   * that had not been released yet would skip the very render that releases it.
   */
  const follow = () => {
    const current = selected();
    if (current && current !== followed) { followed = current; category = null; }
    return current;
  };

  const model = () => faceLibraryModel(doc(), { category, subject: follow(), showAll, showLegacy });

  /**
   * Put one drawing on the face.
   *
   * `fresh: false`, which is the whole point of replacing rather than
   * installing: a part an author has moved keeps where they moved it to, and
   * only the drawing changes (`face-part-commands.js`).
   */
  function wear(assetId) {
    // The category the cards on screen are for, which is no longer the same as
    // the one the author pressed: with nothing pressed it is the one the
    // selection chose, and passing `null` here would replace nothing at all.
    const target = model().active;
    const result = target ? commands.replace(target, assetId) : { ok: false, reason: 'Pick a part of the face first.' };
    if (!result?.ok) {
      notice = { tone: 'warn', text: result?.reason || 'That drawing could not go on this face.' };
      onStatus(notice.text, 'error');
      render();
      return;
    }
    const kept = result.enabled?.length ? ` Movements kept: ${result.enabled.join(', ')}.` : '';
    const lost = result.disabled?.length ? ` Off, because this drawing cannot carry them: ${result.disabled.join(', ')}.` : '';
    notice = { tone: 'success', text: `✓ ${facePartCategory(target)?.label || target} replaced.${kept}${lost}` };
    onStatus(notice.text);
    if (result.rootId) onSelect(result.rootId);
    render();
  }

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.faceLibraryCategory) { category = button.dataset.faceLibraryCategory; followed = selected(); notice = null; onPreview(null); render(); return; }
    if (button.dataset.faceLibraryShowAll !== undefined) { showAll = button.dataset.faceLibraryShowAll === 'on'; onPreview(null); render(); return; }
    if (button.dataset.faceLibraryShowLegacy !== undefined) { showLegacy = button.dataset.faceLibraryShowLegacy === 'on'; onPreview(null); render(); return; }
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

  /**
   * What this panel is currently showing, as one comparable string.
   *
   * The library follows the selection now, so it is redrawn on every canvas
   * click (`SESSION_RENDER_PLAN`). Building the cards is not free -- each one
   * carries the drawing itself, with its ids remapped so twenty previews do not
   * share one clipPath -- and clicking around the canvas would rebuild a
   * hundred and fifty of them for nothing.
   *
   * So a render that would produce what is already on screen does not happen.
   * It is computed through `resolveLibraryCategory`, which answers which part
   * the cards are for **without building one**, and it names the whole of what
   * the panel draws from: the category, the filter, the notice, and the
   * revision of the project the cards were read out of (§31 of the brief).
   *
   * It goes through `follow()` for the same reason `model()` does: a signature
   * computed before the tab was released would skip the very render that
   * releases it.
   */
  const signature = () => {
    const resolved = resolveLibraryCategory(doc(), { category, subject: follow() });
    return [resolved.active, resolved.following, showAll, showLegacy, notice?.text || '', store.getPersistentRevision?.() ?? ''].join('\u0000');
  };

  function render() {
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; drawn = null; return; }
    // Not on screen, so not rebuilt. The library follows the selection now, and
    // a selection changes on screens this panel is not on -- every one of those
    // was rebuilding a hundred and fifty drawings, each with its ids remapped,
    // for a column nobody could see. `drawn = null` so the next render that
    // *is* visible rebuilds rather than trusting a signature from before
    // (§31 of the brief; `CONTEXT_RENDER_PLAN` is what draws it on arrival).
    if (!shown()) { drawn = null; return; }
    const mark = signature();
    if (mark === drawn && host.dataset.faceLibraryReady === 'true') return;
    drawn = mark;
    const view = model();
    host.hidden = false;
    host.dataset.faceLibraryReady = 'true';
    host.dataset.faceLibraryCategory = view.active || '';
    host.dataset.faceLibraryCards = String(view.cards.length);
    host.dataset.faceLibraryTotal = String(view.total);
    host.dataset.faceLibraryFollowing = String(view.following);
    host.dataset.faceLibraryFiltered = String(view.filtered);
    host.dataset.faceLibraryLegacy = String(view.legacy);

    // Only the categories the library has a drawing for. One with none is not
    // a category an author can do anything in, and a tab that opens on "no
    // drawings yet" is a tab that wasted a press.
    const tabs = view.categories.filter((item) => item.count).map((item) => `<button type="button" class="chip${item.id === view.active ? ' chip-active' : ''}" data-face-library-category="${esc(item.id)}" aria-pressed="${item.id === view.active}">${esc(item.label)} <small>${item.count}</small></button>`).join('');

    const cards = view.cards.map((card) => `<article class="face-library-card${card.worn ? ' face-library-worn' : ''}" data-face-library-card="${esc(card.id)}"${card.compatible ? '' : ' data-face-library-mismatch="true"'}>
      <svg class="face-library-preview" viewBox="${esc(card.preview.viewBox)}" aria-hidden="true" focusable="false">${card.preview.markup}</svg>
      <b>${esc(card.name)}</b>
      ${card.description ? `<small>${esc(card.description)}</small>` : ''}
      ${card.compatible ? '' : '<small class="face-library-note">Drawn for another kind of face.</small>'}
      ${card.legacy ? '<small class="face-library-note" data-face-library-legacy="true">From a pack the editor keeps but no longer offers.</small>' : ''}
      ${card.loses.length ? `<small class="face-library-note" data-face-library-loses="${esc(card.loses.join(' '))}">⚠ Limited animation: ${esc(card.loses.map(movementWord).join(', '))} would switch off.</small>` : ''}
      <button type="button" class="${card.worn ? 'secondary' : ''}" data-face-library-wear="${esc(card.id)}" aria-label="${card.worn ? `${esc(card.name)} is on the face` : `Put ${esc(card.name)} on the face${card.loses.length ? `. Limited animation: ${esc(card.loses.map(movementWord).join(', '))} would switch off` : ''}`}">${card.worn ? '✓ On the face' : 'Use it'}</button>
    </article>`).join('');

    const worn = view.categories.find((item) => item.id === view.active)?.worn;
    const label = view.categories.find((item) => item.id === view.active)?.label || view.active || '';
    setPanelHtml(host, `<h3 id="face-library-heading">Face parts library</h3>
      <div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}">${esc(notice.text)}</p>` : ''}</div>
      <p class="small">${view.offered} drawings for a human face. Choosing one replaces that part of the face: where you had moved it and the movements it had are kept, and the new drawing arrives fitted to this head.</p>
      <div class="pose-chips" role="group" aria-label="Which part">${tabs}</div>
      ${view.following ? `<p class="small" data-face-library-follow-note>Showing <b>${esc(label)}</b>, because that is what you have selected. Press another tab to look elsewhere.</p>` : ''}
      ${worn ? `<p class="small">Wearing <b>${esc(worn.name)}</b>.</p>` : '<p class="small">This part was drawn or imported rather than taken from the library.</p>'}
      <div class="face-library-cards" aria-labelledby="face-library-heading">${cards}</div>
      ${view.filtered ? `<button type="button" class="secondary" data-face-library-show-all="on">Show all ${view.filtered + view.cards.length} drawings (${view.filtered} drawn for other kinds of face)</button>` : ''}
      ${view.showAll ? '<button type="button" class="secondary" data-face-library-show-all="off">Show only the ones that fit this face</button>' : ''}
      ${view.legacy ? `<button type="button" class="secondary" data-face-library-show-legacy="on">Show the older packs too (${view.legacy} animal, robot and bird drawing${view.legacy === 1 ? '' : 's'})</button>` : ''}
      ${view.showLegacy ? '<button type="button" class="secondary" data-face-library-show-legacy="off">Hide the older packs</button>' : ''}`);
    void sections;
  }

  return {
    render,
    snapshot: () => {
      const view = model();
      return { category, pressed: category, subject: selected(), ...structuredClone({ ...view, cards: view.cards.map(({ preview, ...rest }) => rest) }) };
    }
  };
}
