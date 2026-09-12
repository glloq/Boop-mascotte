/**
 * The hand workshop: **where hands are designed**, away from the face
 * (docs/HAND_STYLES.md, "A gesture is a file").
 *
 * ```text
 *  Create ▸  Character   Hands   Artwork   Face Setup
 *                        ▲
 *            the set in use, its gestures as cards, and the three doors:
 *            add a gesture from a file, import a set, save the set out
 * ```
 *
 * A face is built from parts in the Character Builder; a hand used to be built
 * nowhere, because there was nothing to build -- one of eight drawings chosen
 * by name, with no inside and no way to add a ninth. This is the other half of
 * that separation: the drawings a mascot's hands are made of are a **library**
 * now, an author owns it, and adding to it is dropping in a file.
 *
 * It is deliberately not a hand rig panel. Where a hand *is*, how far it
 * reaches and what it is anchored to stay in Hand setup; what a hand is *drawn
 * from* is here. The line between them is the line between placement and
 * appearance that the whole hand model is built on.
 */
import { createComponent } from '../component.js';
import { setPanelHtml } from '../panel-render.js';
import { esc } from '../escape-html.js';
import { walkRing } from '../character-builder/ring-keys.js';
import {
  HAND_STYLE_PIVOT as handStylePivot, handSetInfo, handStyleIds, handStyleLabel,
  handStyleThumbnail, handStyleViewBox
} from '../../core/hands/hand-style-art.js';
import { HAND_SET_LIBRARY } from '../../core/hands/hand-set.js';
import { installedHandLook } from '../../core/sample/hand-feature.js';
import { describeHands } from '../character-builder/hand-placement-panel.js';

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One gesture as a picture, at the size the picker draws one. */
const thumbnail = (style, look) =>
  `<svg viewBox="${handStyleViewBox()}" class="hand-thumb" aria-hidden="true" focusable="false">`
  + handStyleThumbnail('left', style, { at: { x: handStylePivot()[0], y: handStylePivot()[1] }, size: 2 * handStylePivot()[0] * 0.86, look })
  + '</svg>';

/**
 * What the workshop is about, as plain data.
 *
 * The **library** is the subject, not the mascot: a set is what hands will be
 * drawn from next, and it is worth looking at whether or not this project has
 * a pair yet. The pair is reported alongside, because a gesture an author adds
 * is a gesture they will want to put on a hand.
 */
export function describeHandSet(document = {}) {
  // The one library the editor draws hands from, not one handed in: the
  // thumbnails, the labels and the ids all come off it, so a second one would
  // be a panel describing one set with another's pictures.
  const info = handSetInfo();
  const look = installedHandLook(document);
  const hands = describeHands(document, { pictures: false, drawings: false }).filter((hand) => hand.element);
  const drawn = new Set(hands.flatMap((hand) => hand.styles.filter((style) => style.drawn).map((style) => style.id)));
  return {
    set: info ? { id: info.set, name: info.name, pivot: [...info.pivot], radius: info.radius, fallback: info.fallback } : null,
    gestures: handStyleIds().map((id) => {
      const gesture = HAND_SET_LIBRARY.get(id);
      return {
        id,
        label: handStyleLabel(id) || id,
        mine: gesture?.origin === 'custom',
        onAHand: drawn.has(id),
        thumb: thumbnail(id, look)
      };
    }),
    hands: hands.map((hand) => ({ side: hand.side, label: hand.label, resting: hand.resting }))
  };
}

/** The workshop, as markup. */
export function handWorkshopMarkup(model, notice = null) {
  const set = model.set;
  if (!set) return '<p class="small">No hand set is loaded, so there is nothing to draw a hand from. Import one below.</p>';
  const cards = model.gestures.map((gesture) => `<div class="part-style hand-style${gesture.mine ? ' part-style-mine' : ''}" data-hand-gesture="${esc(gesture.id)}">`
    + `<span class="part-style-thumb hand-style-thumb">${gesture.thumb}</span>`
    + `<span class="part-style-name">${esc(gesture.label)}</span>`
    + (gesture.mine ? '<span class="part-style-badge">Mine</span>' : '')
    + (gesture.onAHand ? '<span class="part-style-badge part-style-offer-badge">On a hand</span>' : '')
    + (gesture.mine ? `<button type="button" class="secondary hand-gesture-forget" data-hand-gesture-forget="${esc(gesture.id)}" aria-label="Forget ${esc(gesture.label)}" title="Forget ${esc(gesture.label)}. A hand wearing it keeps its drawing.">Forget</button>` : '')
    + '</div>').join('');
  const pair = model.hands.length
    ? `This mascot has ${count(model.hands.length, 'hand')}: ${model.hands.map((hand) => `${esc(hand.label.toLowerCase())} resting on <b>${esc(handStyleLabel(hand.resting) || hand.resting || 'nothing')}</b>`).join(', ')}. Give one a drawing from the Character Builder, and edit the drawing itself there too.`
    : 'This mascot has no hands yet. A pair is drawn and rigged in one press, in Hand setup.';
  return `<div class="hand-set-head"><b>${esc(set.name)}</b> <span class="small">${count(model.gestures.length, 'gesture')}, one pivot, everything inside ${set.radius}</span></div>
    ${notice ? `<p class="workspace-hint" data-hand-set-notice data-tone="${esc(notice.tone)}">${esc(notice.text)}</p>` : ''}
    <div class="part-styles hand-styles" role="group" aria-label="Gestures in the set" data-hand-gestures>${cards}</div>
    <p class="small">Every drawing in a set shares one pivot and one size, so a hand that changes gesture never changes size or moves. A gesture is a group of named layers — a palm, its fingers, a thumb — which is what makes one editable and a ninth one a ninth file.</p>
    <div class="hand-set-actions">
      <label class="button secondary">Add a gesture<small>One SVG: a &lt;g&gt; of named layers</small><input hidden type="file" id="hand-gesture-file" accept=".svg,image/svg+xml" multiple></label>
      <label class="button secondary">Import a hand set<small>A whole set, kept in this browser</small><input hidden type="file" id="hand-set-file" accept=".json,application/json"></label>
      <button type="button" class="secondary" data-hand-set-export>Save the set out<small>Every gesture, as one file to share</small></button>
    </div>
    <p class="small">A gesture you add is kept in this browser and is a card here and in the Character Builder at once. Importing a set replaces the one in use — a hand already wearing drawings keeps them.</p>
    <p class="small" data-hand-workshop-pair>${pair}</p>
    <div class="action-row"><button type="button" class="secondary" data-hand-workshop-route="hand-setup">Hand setup…</button><button type="button" class="secondary" data-hand-workshop-route="character">Character Builder…</button></div>`;
}

/**
 * @param {Element} host  `#hand-workshop`
 * @param {object} options
 * @param {() => object} options.document  the project document
 * @param {(files: FileList|File[]) => void} [options.onAddGestures]  files an author picked
 * @param {(file: File) => void} [options.onImportSet]
 * @param {() => void} [options.onExportSet]
 * @param {(id: string) => void} [options.onForget]
 * @param {(route: string) => void} [options.onRoute]
 */
export function createHandWorkshop(host, { document: getDocument = () => ({}), onAddGestures = () => {}, onImportSet = () => {}, onExportSet = () => {}, onForget = () => {}, onRoute = () => {} } = {}) {
  if (!host) throw new Error('Missing required UI element: #hand-workshop');
  let notice = null;

  const component = createComponent({
    host,
    equal: (a, b) => a?.signature === b?.signature,
    onMount: ({ listen }) => {
      listen(host, 'keydown', walkRing);
      listen(host, 'click', (event) => {
        const button = event.target?.closest?.('button');
        if (!button) return;
        const { handGestureForget, handSetExport, handWorkshopRoute } = button.dataset || {};
        if (handGestureForget) onForget(handGestureForget);
        else if (handSetExport !== undefined) onExportSet();
        else if (handWorkshopRoute) onRoute(handWorkshopRoute);
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
      setPanelHtml(host, handWorkshopMarkup(model.rich, model.rich.notice));
      host.dataset.handSet = model.rich.set?.id || '';
      host.dataset.handGestures = String(model.rich.gestures.length);
    }
  });

  const view = () => {
    const rich = { ...describeHandSet(getDocument()), notice };
    return { signature: JSON.stringify(rich), rich };
  };

  /** @returns {boolean} whether anything was drawn */
  const draw = () => {
    const model = view();
    return component.isMounted() ? component.update(model) : component.mount(model);
  };

  return {
    render: draw,
    /** What the app says after a press: kept until the next one, then shown. */
    say: (tone, text) => { notice = text ? { tone, text } : null; return draw(); },
    snapshot: () => describeHandSet(getDocument()),
    counters: () => component.counters(),
    destroy: () => component.destroy()
  };
}
