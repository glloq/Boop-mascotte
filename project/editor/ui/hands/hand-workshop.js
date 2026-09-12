/**
 * **Design ▸ Hands**: the states each hand can show, one library per hand
 * (UIR-05, docs/UIR_REFACTOR_BASELINE.md; docs/HAND_STYLES.md).
 *
 * ```text
 *  Design ▸  Face   Hands   Artwork
 *                   ▲
 *          LEFT   [Relaxed*] [Open] [Point] … + Add a state
 *          RIGHT  [Relaxed*] [Fist] …
 *
 *          Left hand / Point
 *          Use · Edit SVG · Duplicate · Rename · Mirror copy · Delete
 * ```
 *
 * A hand used to be designed in three places at once: the *set* had a screen of
 * its own here, the drawings a hand actually holds were cards in the Character
 * Builder, and editing one was a row in the builder's inspector. Three doors to
 * one subject, and none of them the one an author would look for. They are one
 * screen now, and it is about the hands rather than about the library they were
 * drawn from -- the set is still here, under Advanced, because importing and
 * saving one is a real thing to do and a rare one.
 *
 * The separation the whole model rests on (§16) is what the layout says out
 * loud: **two hands, two libraries.** A state belongs to one hand, editing it
 * never reaches the other, and Mirror copy is a copy with no link afterwards.
 *
 * The host is still called `#hand-workshop` and the render target `handWorkshop`;
 * UIR-17 renames both with the rest of the legacy ids, where a rename is the
 * point rather than a side effect.
 */
import { createComponent } from '../component.js';
import { setPanelHtml } from '../panel-render.js';
import { esc } from '../escape-html.js';
import { walkRing } from '../character-builder/ring-keys.js';
import {
  HAND_STYLE_PIVOT as handStylePivot, handSetInfo, handStyle, handStyleIds, handStyleLabel,
  handStyleThumbnail, handStyleViewBox
} from '../../core/hands/hand-style-art.js';
import { HAND_SET_LIBRARY } from '../../core/hands/hand-set.js';
import { installedHandLook } from '../../core/sample/hand-feature.js';
import { handStates, OTHER_SIDE } from '../../core/hands/hand-state-model.js';
import { handDrawingIsCustom } from '../../core/hands/hand-drawing.js';
import { HAND_LABELS } from '../character-builder/hand-placement-panel.js';

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One state as a picture: the set's drawing of it, or its initial when it is an author's own. */
function thumbnail(side, id, look) {
  if (!handStyle(id)) return `<span class="hand-thumb hand-thumb-own" aria-hidden="true">${esc((id[0] || '?').toUpperCase())}</span>`;
  return `<svg viewBox="${handStyleViewBox()}" class="hand-thumb" aria-hidden="true" focusable="false">`
    + handStyleThumbnail(side, id, { at: { x: handStylePivot()[0], y: handStylePivot()[1] }, size: 2 * handStylePivot()[0] * 0.86, look })
    + '</svg>';
}

/**
 * Both hands and what each can show, plus the set they were drawn from.
 *
 * `offers` is what the set has that this hand does not: adding one is drawing
 * it, and it is the shortest way to a state an author has not taken yet.
 */
export function describeHandStates(document = {}) {
  const info = handSetInfo();
  const look = installedHandLook(document);
  return {
    set: info ? { id: info.set, name: info.name, radius: info.radius } : null,
    hands: ['left', 'right'].map((side) => {
      const hand = document.hands?.[side];
      const present = Boolean(hand?.element && document.elements?.[hand.element] && hand.styles);
      const states = present ? handStates(document, side) : [];
      const held = new Set(states.map((state) => state.id));
      return {
        side,
        label: HAND_LABELS[side],
        other: HAND_LABELS[OTHER_SIDE[side]],
        present,
        states: states.map((state) => ({
          ...state,
          own: !handStyle(state.id),
          reshaped: handDrawingIsCustom(document, side, state.id) === true,
          thumb: thumbnail(side, state.id, look)
        })),
        offers: present ? handStyleIds().filter((id) => !held.has(id)).map((id) => ({ id, name: handStyleLabel(id) || id })) : []
      };
    }),
    gestures: handStyleIds().map((id) => ({ id, label: handStyleLabel(id) || id, mine: HAND_SET_LIBRARY.get(id)?.origin === 'custom', thumb: thumbnail('left', id, look) }))
  };
}

const stateCard = (hand, state, selected) => `<button type="button" class="part-style hand-style${state.active ? ' part-style-current' : ''}${selected ? ' hand-state-selected' : ''}"`
  + ` data-hand-state="${esc(hand.side)}:${esc(state.id)}" aria-pressed="${selected}"`
  + ` title="${esc(`${state.name}${state.active ? `: what ${hand.label.toLowerCase()} rests on` : ''}${state.reshaped ? ' · reshaped' : ''}`)}">`
  + `<span class="part-style-thumb hand-style-thumb">${state.thumb}</span><span class="part-style-name">${esc(state.name)}</span>`
  + (state.active ? '<span class="part-style-badge">Resting</span>' : '')
  + (state.own ? '<span class="part-style-badge part-style-mine">Mine</span>' : '')
  + (state.reshaped ? '<span class="part-style-badge part-style-mine">Reshaped</span>' : '')
  + '</button>';

/** What can be done to the state in hand. Six verbs, and every one of them one undo step. */
function actionsMarkup(hand, state) {
  if (!state) return '<p class="small" data-hand-state-empty>Pick a state above to use it, edit its drawing, copy it or take it away.</p>';
  return `<div class="hand-state-actions" data-hand-state-actions="${esc(hand.side)}:${esc(state.id)}">
      <b>${esc(hand.label)} / ${esc(state.name)}</b>
      <div class="action-row">
        <button type="button" ${state.active ? 'disabled title="This is what the hand rests on"' : ''} data-hand-state-use>Use</button>
        <button type="button" class="secondary" data-hand-state-edit>✎ Edit SVG</button>
        <button type="button" class="secondary" data-hand-state-duplicate>Duplicate</button>
        <button type="button" class="secondary" data-hand-state-rename>Rename…</button>
        <button type="button" class="secondary" data-hand-state-mirror>Mirror copy to ${esc(hand.other.toLowerCase())}</button>
        <button type="button" class="secondary danger" data-hand-state-delete>Delete</button>
      </div>
      <p class="small">Edit SVG opens this drawing on its own, with the rest of the mascot out of the way. Duplicate and Mirror copy make a drawing of its own: nothing links them afterwards, so reshaping one never reshapes the other.</p>
    </div>`;
}

function handMarkup(hand, selected) {
  if (!hand.present) {
    return `<section class="hand-states" data-hand-states="${esc(hand.side)}"><h3>${esc(hand.label)}</h3>`
      + '<p class="small">Not drawn yet. A pair arrives in one press, rigged, with a state for every drawing in the set.</p>'
      + '<button type="button" class="secondary" data-hand-states-route="hand-setup">Draw a pair of hands…</button></section>';
  }
  const chosen = hand.states.find((state) => `${hand.side}:${state.id}` === selected) || null;
  const offers = hand.offers.length
    ? `<details class="hand-state-add"><summary>+ Add a state</summary>`
      + `<div class="part-styles hand-styles" role="group" aria-label="States the set has that ${esc(hand.label.toLowerCase())} does not">`
      + hand.offers.map((offer) => `<button type="button" class="part-style hand-style hand-style-offer" data-hand-state-add="${esc(hand.side)}:${esc(offer.id)}">${esc(offer.name)}</button>`).join('')
      + '</div><p class="small">A state the set draws that this hand does not hold yet. Drawings of your own arrive in the set, under Advanced.</p></details>'
    : '<p class="small">This hand holds every state the set draws. Duplicate one, or bring a drawing of your own into the set under Advanced.</p>';
  return `<section class="hand-states" data-hand-states="${esc(hand.side)}" data-hand-state-count="${hand.states.length}">
      <h3>${esc(hand.label)} <span class="small">${count(hand.states.length, 'state')}</span></h3>
      <div class="part-styles hand-styles" role="group" aria-label="States of the ${esc(hand.label.toLowerCase())}">${hand.states.map((state) => stateCard(hand, state, `${hand.side}:${state.id}` === selected)).join('')}</div>
      ${offers}
      ${actionsMarkup(hand, chosen)}
    </section>`;
}

/** The screen, as markup. */
export function handsScreenMarkup(model, { selected = null, notice = null } = {}) {
  const set = model.set;
  const advanced = `<details class="hand-set-advanced"><summary><span class="setup-title">The set these are drawn from</span><span class="setup-summary">advanced</span></summary>
      ${set ? `<p class="small"><b>${esc(set.name)}</b> · ${count(model.gestures.length, 'drawing')}, one pivot, everything inside ${set.radius}. Every drawing in a set shares one pivot and one size, so a hand that changes state never changes size or moves.</p>` : '<p class="small">No hand set is loaded, so there is nothing to draw a hand from. Import one below.</p>'}
      <div class="hand-set-actions">
        <label class="button secondary">Add a drawing<small>One SVG: a &lt;g&gt; of named layers</small><input hidden type="file" id="hand-gesture-file" accept=".svg,image/svg+xml" multiple></label>
        <label class="button secondary">Import a hand set<small>A whole set, kept in this browser</small><input hidden type="file" id="hand-set-file" accept=".json,application/json"></label>
        <button type="button" class="secondary" data-hand-set-export>Save the set out<small>Every drawing, as one file to share</small></button>
      </div>
      <div class="part-styles hand-styles" role="group" aria-label="Drawings in the set" data-hand-gestures>${model.gestures.map((gesture) => `<div class="part-style hand-style${gesture.mine ? ' part-style-mine' : ''}" data-hand-gesture="${esc(gesture.id)}"><span class="part-style-thumb hand-style-thumb">${gesture.thumb}</span><span class="part-style-name">${esc(gesture.label)}</span>${gesture.mine ? `<span class="part-style-badge part-style-mine">Mine</span><button type="button" class="secondary hand-gesture-forget" data-hand-gesture-forget="${esc(gesture.id)}" aria-label="Forget ${esc(gesture.label)}" title="Forget ${esc(gesture.label)}. A hand holding it keeps its state.">Forget</button>` : ''}</div>`).join('')}</div>
      <p class="small">A drawing you add is kept in this browser and can be added to either hand at once. Importing a set replaces the one in use — a hand already holding states keeps them.</p>
    </details>`;
  return `${notice ? `<p class="workspace-hint" data-hand-set-notice data-tone="${esc(notice.tone)}">${esc(notice.text)}</p>` : ''}
    ${model.hands.map((hand) => handMarkup(hand, selected)).join('')}
    ${advanced}
    <div class="action-row"><button type="button" class="secondary" data-hand-states-route="hand-setup">Where the hands are, and how far they reach…</button></div>`;
}

/**
 * @param {Element} host  `#hand-workshop`
 * @param {object} options
 * @param {() => object} options.document  the project document
 * @param {(side: string, id: string) => void} [options.onUse]        rest the hand on this state
 * @param {(side: string, id: string) => void} [options.onEdit]       open its drawing in the vector tools
 * @param {(side: string, id: string) => void} [options.onDuplicate]
 * @param {(side: string, id: string, name: string) => void} [options.onRename]
 * @param {(side: string, id: string) => void} [options.onMirror]
 * @param {(side: string, id: string) => void} [options.onDelete]
 * @param {(side: string, id: string) => void} [options.onAdd]        a state the set has and this hand does not
 * @param {(files: File[]) => void} [options.onAddGestures]
 * @param {(file: File) => void} [options.onImportSet]
 * @param {() => void} [options.onExportSet]
 * @param {(id: string) => void} [options.onForget]
 * @param {(route: string) => void} [options.onRoute]
 * @param {(message: string, value: string) => string|null} [options.ask]  a name, however the host asks for one
 */
export function createHandWorkshop(host, {
  document: getDocument = () => ({}), onUse = () => {}, onEdit = () => {}, onDuplicate = () => {},
  onRename = () => {}, onMirror = () => {}, onDelete = () => {}, onAdd = () => {},
  onAddGestures = () => {}, onImportSet = () => {}, onExportSet = () => {}, onForget = () => {}, onRoute = () => {},
  ask = (message, value) => globalThis.prompt?.(message, value) ?? null
} = {}) {
  if (!host) throw new Error('Missing required UI element: #hand-workshop');
  let notice = null, selected = null;

  /** The state in hand, as the side and id the commands take. */
  const chosen = () => (selected ? { side: selected.split(':')[0], id: selected.slice(selected.indexOf(':') + 1) } : null);

  const component = createComponent({
    host,
    equal: (a, b) => a?.signature === b?.signature,
    onMount: ({ listen }) => {
      listen(host, 'keydown', walkRing);
      listen(host, 'click', (event) => {
        const button = event.target?.closest?.('button');
        if (!button) return;
        const data = button.dataset || {};
        // A press selects, and a second press on the same card selects it
        // again: a card that deselects itself takes the six verbs off screen
        // exactly when somebody is reaching for them.
        if (data.handState) { selected = data.handState; draw(); return; }
        if (data.handStateAdd) { const [side, id] = data.handStateAdd.split(':'); onAdd(side, id); return; }
        if (data.handGestureForget) { onForget(data.handGestureForget); return; }
        if (data.handSetExport !== undefined) { onExportSet(); return; }
        if (data.handStatesRoute) { onRoute(data.handStatesRoute); return; }
        const state = chosen();
        if (!state) return;
        if (data.handStateUse !== undefined) onUse(state.side, state.id);
        else if (data.handStateEdit !== undefined) onEdit(state.side, state.id);
        else if (data.handStateDuplicate !== undefined) onDuplicate(state.side, state.id);
        else if (data.handStateMirror !== undefined) onMirror(state.side, state.id);
        else if (data.handStateDelete !== undefined) { onDelete(state.side, state.id); selected = null; }
        else if (data.handStateRename !== undefined) {
          const current = host.querySelector(`[data-hand-state="${state.side}:${state.id}"] .part-style-name`)?.textContent || state.id;
          const name = ask(`What should ${current} be called on this hand?`, current);
          if (name !== null) onRename(state.side, state.id, name);
        }
      });
      listen(host, 'change', (event) => {
        const input = event.target;
        if (!input?.files?.length) return;
        if (input.id === 'hand-gesture-file') onAddGestures([...input.files]);
        else if (input.id === 'hand-set-file') onImportSet(input.files[0]);
        input.value = '';
      });
    },
    render: (model) => {
      setPanelHtml(host, handsScreenMarkup(model.rich, { selected: model.selected, notice: model.rich.notice }));
      host.dataset.handSet = model.rich.set?.id || '';
      host.dataset.handStates = model.rich.hands.map((hand) => hand.states.length).join('/');
    }
  });

  const view = () => {
    const rich = { ...describeHandStates(getDocument()), notice };
    // A state that has gone takes the selection with it.
    if (selected && !rich.hands.some((hand) => hand.states.some((state) => `${hand.side}:${state.id}` === selected))) selected = null;
    return { signature: `${JSON.stringify(rich)}|${selected}`, rich, selected };
  };

  /** @returns {boolean} whether anything was drawn */
  function draw() {
    const model = view();
    return component.isMounted() ? component.update(model) : component.mount(model);
  }

  return {
    render: draw,
    /** What the app says after a press: kept until the next one, then shown. */
    say: (tone, text) => { notice = text ? { tone, text } : null; return draw(); },
    /** The state in hand, for the panels that follow the selection. */
    selected: chosen,
    select: (side, id) => { selected = side && id ? `${side}:${id}` : null; return draw(); },
    snapshot: () => describeHandStates(getDocument()),
    counters: () => component.counters(),
    destroy: () => component.destroy()
  };
}
