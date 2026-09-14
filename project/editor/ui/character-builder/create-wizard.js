/**
 * Three screens, three choices, and a way past all of them
 * (docs/AUDIT_UI_2026-09/04_RECOMMANDATIONS.md §5).
 *
 * ```text
 * 1/3  What kind of character?   Human · Muzzle · Beak · Robot · Monster
 * 2/3  Pick one — you can change every part afterwards
 * 3/3  Colours
 *        ↓
 *      Design ▸ Face, everything still editable
 * ```
 *
 * The audit's third screen had a second row — *☑ Add a pair of hands*. The one
 * template a new mascot starts from **already ships a rigged pair with all
 * eight gestures drawn**, and `drawHandPair` refuses outright on a document
 * that has hands (`app/hand-artwork.js`), so the checkbox could only ever have
 * done nothing. Screen 3 says so in a line instead: a person does wonder
 * whether it will have hands, and the honest answer is "it already does".
 *
 * **It chooses; it does not rebuild.** The argument against a wizard is already
 * written in `type-browser.js`: "an author who came in through a preset has
 * already made a face, and a Type press that rebuilt it would throw their work
 * away". So this runs *before* there is any work to lose — from Home, in place
 * of *New Character* — and every screen asks something the editor can change
 * afterwards. Nothing here is a commitment.
 *
 * Pure: the model below decides what each screen offers and what *Make it*
 * means. The host does the pressing and the writing, so a wizard that offered
 * an impossible choice would be a failing unit test rather than a bad mascot.
 */
import { availableMorphologies, presetsFor } from '../../core/face-library/compatibility.js';
import { FACE_PALETTES, FACE_PRESET_LIBRARY, presetThumbnail } from '../../core/face-library/face-presets.js';
import { FACE_PART_LIBRARY } from '../../core/face-library/face-part-registry.js';
import { faceMorphology } from '../../core/face-library/face-morphologies.js';

/** The three screens, in order, and what each one is for. */
export const WIZARD_STEPS = Object.freeze([
  Object.freeze({ id: 'kind', title: 'What kind of character?', hint: 'You can change this afterwards, and every part with it.' }),
  Object.freeze({ id: 'preset', title: 'Pick one to start from', hint: 'Every part stays swappable: this is a starting point, not a decision.' }),
  Object.freeze({ id: 'finish', title: 'Pick its colours', hint: 'One press to change later — all of them at once, or one at a time in the inspector.' })
]);

/** The palettes offered as a choice, in the order a person would read them. */
export const WIZARD_PALETTES = Object.freeze(['warm', 'pale', 'cool', 'robot']);

/**
 * What kinds of face the library can actually draw.
 *
 * `availableMorphologies` already answers the hard half — which slots a kind
 * needs and whether anything is drawn for them — so a kind nobody has drawn a
 * horn for is offered *and* says why, rather than silently missing.
 */
export function wizardKinds({ library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY } = {}) {
  return availableMorphologies({ library }).map((kind) => {
    // A picture per kind, and the library draws it: the first face it can dress
    // this kind with. The heads are no use as an emblem -- all five kinds wear
    // `head.round` -- and an emoji would be one more glyph for the icon pass to
    // undo, so the emblem of "animal" is a cat's whole face, from the same
    // `presetsFor` gate screen 2 uses.
    const [first] = presetsFor({ presets, library, morphology: kind.id });
    return {
      id: kind.id,
      label: kind.label,
      available: kind.available,
      thumbnail: first ? presetThumbnail(first, library, { size: 64 }) : '',
      waitingFor: kind.available ? '' : `Nothing is drawn for its ${kind.missing.join(' or its ')} yet`
    };
  });
}

/**
 * The presets that can dress this kind of face, with a real picture each.
 *
 * `presetsFor` is the same gate the builder's own preset row uses, so a wizard
 * cannot offer a recipe the library would then refuse.
 */
export function wizardPresets(kind, { presets = FACE_PRESET_LIBRARY, library = FACE_PART_LIBRARY } = {}) {
  return presetsFor({ presets, library, morphology: kind || null }).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description || '',
    thumbnail: presetThumbnail(preset, library, { size: 72 })
  }));
}

/** A palette as a name and three swatches, so the choice is a look and not a word. */
export function wizardPalettes() {
  return WIZARD_PALETTES.filter((id) => FACE_PALETTES[id]).map((id) => ({
    id,
    label: id === 'robot' ? 'Metal' : id.replace(/^./, (char) => char.toUpperCase()),
    swatches: ['skin', 'hair', 'pupil'].map((token) => FACE_PALETTES[id][token]).filter(Boolean)
  }));
}

/**
 * The wizard as a state machine: where it is, what it offers, and what it has
 * been told so far.
 *
 * `skip` is on the first screen because the honest answer to "what kind of
 * character?" is often "show me" — and the template is a better answer to that
 * than a form is.
 */
export function createWizardModel({ library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY } = {}) {
  let at = 0;
  const choice = { kind: null, preset: null, palette: null };

  const kinds = wizardKinds({ library, presets });
  const step = () => WIZARD_STEPS[at];

  /** What the screen shows, and whether it can be left. */
  const view = () => {
    const current = step();
    const offers = current.id === 'kind' ? kinds
      : current.id === 'preset' ? wizardPresets(choice.kind, { presets, library })
        : wizardPalettes();
    return {
      index: at,
      count: WIZARD_STEPS.length,
      step: current,
      offers,
      choice: { ...choice },
      // A screen can always be left: a kind nobody picked means the template's
      // own, and a preset nobody picked means the face as it comes. Asking
      // twice for something optional is how a wizard becomes a form.
      canGoOn: true,
      canGoBack: at > 0,
      isLast: at === WIZARD_STEPS.length - 1
    };
  };

  return {
    view,
    /** @returns {boolean} whether anything moved. */
    choose(what, value) {
      if (!(what in choice)) return false;
      choice[what] = value;
      // A new kind can invalidate the preset chosen for the old one.
      if (what === 'kind' && choice.preset && !wizardPresets(value, { presets, library }).some((item) => item.id === choice.preset)) choice.preset = null;
      return true;
    },
    next() { if (at >= WIZARD_STEPS.length - 1) return false; at += 1; return true; },
    back() { if (at <= 0) return false; at -= 1; return true; },
    /** Everything the host needs to build the mascot, and nothing it does not. */
    result: () => ({
      kind: choice.kind || null,
      kindLabel: choice.kind ? faceMorphology(choice.kind)?.label || choice.kind : null,
      preset: choice.preset || null,
      palette: choice.palette || null
    })
  };
}

/* ── The three screens, as markup ──────────────────────────────────────────── */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** A card per kind of face: available ones press, the rest say what they want. */
const kindCards = (offers, chosen) => `<div class="wizard-cards" role="radiogroup" aria-label="Kind of character">${offers.map((kind) => `<button type="button" class="wizard-card${kind.id === chosen ? ' wizard-card-on' : ''}" data-wizard-kind="${esc(kind.id)}" role="radio" aria-checked="${kind.id === chosen}"${kind.available ? '' : ' disabled'} title="${esc(kind.available ? `A ${kind.label.toLowerCase()} face` : kind.waitingFor)}">${kind.thumbnail ? `<span class="wizard-thumb" aria-hidden="true">${kind.thumbnail}</span>` : ''}<b>${esc(kind.label)}</b>${kind.available ? '' : `<small>${esc(kind.waitingFor)}</small>`}</button>`).join('')}</div>`;

/** A card per preset, with the picture the library draws for it. */
const presetCards = (offers, chosen) => (offers.length
  ? `<div class="wizard-cards wizard-presets" role="radiogroup" aria-label="Starting point">${offers.map((preset) => `<button type="button" class="wizard-card${preset.id === chosen ? ' wizard-card-on' : ''}" data-wizard-preset="${esc(preset.id)}" role="radio" aria-checked="${preset.id === chosen}" title="${esc(preset.description)}"><span class="wizard-thumb" aria-hidden="true">${preset.thumbnail}</span><b>${esc(preset.name)}</b></button>`).join('')}</div>`
  : '<p class="small">Nothing in the library dresses that kind of face yet. Carry on — the face as it comes is still a face.</p>');

/** A palette as three swatches and a name, and what comes with the mascot anyway. */
const paletteCards = (offers, chosen) => `<div class="wizard-cards wizard-palettes" role="radiogroup" aria-label="Colours">${offers.map((palette) => `<button type="button" class="wizard-card${palette.id === chosen ? ' wizard-card-on' : ''}" data-wizard-palette="${esc(palette.id)}" role="radio" aria-checked="${palette.id === chosen}"><span class="wizard-swatches" aria-hidden="true">${palette.swatches.map((colour) => `<i style="background:${esc(colour)}"></i>`).join('')}</span><b>${esc(palette.label)}</b></button>`).join('')}</div>
  <p class="wizard-note" data-wizard-hands-note>It comes with a rigged pair of hands, eight gestures each. <b>Design › Hands</b> is where you change what they show.</p>`;

/**
 * The dialog, as one screen of three.
 *
 * *Skip* is on every screen and says the same thing each time, because the
 * honest answer to "what kind of character?" is often "show me" — and the
 * template is a better answer to that than a form is.
 */
export function wizardMarkup(view) {
  const body = view.step.id === 'kind' ? kindCards(view.offers, view.choice.kind)
    : view.step.id === 'preset' ? presetCards(view.offers, view.choice.preset)
      : paletteCards(view.offers, view.choice.palette);
  return `<form method="dialog" class="wizard" data-wizard-step="${esc(view.step.id)}">
    <div class="wizard-head">
      <h2>New mascot</h2>
      <span class="wizard-count" aria-label="Screen ${view.index + 1} of ${view.count}">${view.index + 1} / ${view.count}</span>
    </div>
    <h3 data-wizard-title tabindex="-1">${esc(view.step.title)}</h3>
    <p class="small">${esc(view.step.hint)}</p>
    ${body}
    <div class="wizard-actions">
      <button type="button" class="secondary" data-wizard-skip>Skip and just start</button>
      ${view.canGoBack ? '<button type="button" class="secondary" data-wizard-back>← Back</button>' : ''}
      <button type="button" data-wizard-next>${view.isLast ? 'Make it' : 'Next →'}</button>
    </div>
  </form>`;
}

/* ── The dialog ────────────────────────────────────────────────────────────── */

/**
 * The wizard on screen: one `<dialog>`, redrawn per screen.
 *
 * **Choosing on the first two screens also moves on.** Those screens ask one
 * question and a card *is* the answer, which is what makes the library's
 * presets two presses from Home rather than four — the whole of what the audit
 * says this is for. *Next* stays for the author who wants the template's own
 * kind, and *Back* undoes either, so nothing is trapped by the shortcut. The
 * last screen has nowhere to advance to, so there *Make it* is the press.
 *
 * The host presses nothing itself: `onFinish` gets the three answers as data
 * and the editor builds the mascot, so the wizard cannot know — or break — how
 * a preset goes on.
 *
 * @param {HTMLDialogElement} dialog
 * @param {object} deps
 * @param {(plan: object) => void} deps.onFinish  the three answers, as `result()` gives them
 * @param {() => void} deps.onSkip   *Skip and just start*: the template, straight into Design ▸ Face
 */
export function createWizardHost(dialog, { onFinish = () => {}, onSkip = () => {}, library, presets } = {}) {
  if (!dialog) throw new Error('Missing required UI element: #create-wizard');
  let model = null;

  const render = () => {
    dialog.innerHTML = wizardMarkup(model.view());
    // A dialog that redraws its own contents moves focus nowhere by itself, so
    // the screen's question is what focus lands on and Tab from it is the first
    // card.
    dialog.querySelector('[data-wizard-title]')?.focus();
  };

  const close = () => { model = null; if (dialog.open) dialog.close(); };

  dialog.addEventListener('close', () => { model = null; });

  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!model || !button || button.disabled) return;
    const { wizardKind, wizardPreset, wizardPalette } = button.dataset;
    if (wizardKind || wizardPreset) {
      model.choose(wizardKind ? 'kind' : 'preset', wizardKind || wizardPreset);
      model.next();
      render();
    } else if (wizardPalette) {
      model.choose('palette', wizardPalette);
      render();
    } else if ('wizardBack' in button.dataset) {
      model.back();
      render();
    } else if ('wizardSkip' in button.dataset) {
      close();
      onSkip();
    } else if ('wizardNext' in button.dataset) {
      if (!model.view().isLast) { model.next(); render(); return; }
      const plan = model.result();
      close();
      onFinish(plan);
    }
  });

  return {
    open() {
      model = createWizardModel({ library, presets });
      render();
      dialog.showModal();
      // showModal focuses the first focusable itself, which is the heading's
      // sibling; put it back on the question.
      dialog.querySelector('[data-wizard-title]')?.focus();
    },
    close,
    isOpen: () => dialog.open,
    /** The model behind the screen showing, for a test that wants the offer rather than the markup. */
    view: () => (model ? model.view() : null)
  };
}
