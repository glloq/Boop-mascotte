/**
 * "What do you want to make?", asked before anything is shown (UI-REDESIGN-03).
 *
 * The library holds 150 drawings and 22 ready-made characters across four kinds
 * of mascot, and the default path used to show 48 and 6 — because the kind was
 * a collapsed accordion row called *Type*, second in a list of sixteen, whose
 * options were `Muzzle`, `Beak` and `Monster`, and because nothing asked. When
 * nobody pressed it, `activeMorphology()` answered `human` in silence.
 *
 * So this asks, and it asks first:
 *
 * ```text
 * ┌──────────────────────────────────────────────────────────┐
 * │ ← Cancel            New mascot                    ● ○    │
 * ├──────────────────────────────────────────────────────────┤
 * │          What kind of mascot do you want to make?        │
 * │   [ Human ]   [ Animal ]   [ Bird ]   [ Robot ]          │
 * │      Otherwise: a blank drawing · import an SVG          │
 * └──────────────────────────────────────────────────────────┘
 *                            ↓
 * ┌────────────────────────┬─────────────────────────────────┐
 * │ BIRD                   │                                 │
 * │ Which one?             │            the mascot           │
 * │ [Owl] [Duck] [Parrot]  │            being chosen         │
 * │ [Crow] [Cute] [Slim]   │                                 │
 * │ ⤺ Surprise me          │        [ Create Owl → ]         │
 * └────────────────────────┴─────────────────────────────────┘
 * ```
 *
 * Every picture is the real drawing, rendered by `presetThumbnail` from the
 * same assets a press would install — never an illustration that could promise
 * something the library does not hold.
 *
 * Markup and presses only. Loading a template, setting the kind and applying a
 * character are the caller's, through the commands that already do each.
 */
import { esc } from '../escape-html.js';
import { walkRing } from '../character-builder/ring-keys.js';
import { mascotCharacters, mascotTypeLabel, mascotTypes } from './wizard-model.js';

/**
 * The shell: a header that never moves, and a body the steps swap.
 *
 * Named by `aria-label` rather than by its heading: the heading lives in the
 * body, which is empty until a step renders, so an `aria-labelledby` would
 * point at nothing for as long as the wizard is shut.
 */
export const wizardMarkup = () => `<section class="wizard" data-wizard hidden aria-label="New mascot">
  <header class="wizard-bar">
    <button type="button" class="link" data-wizard-back>← <span data-wizard-back-label>Cancel</span></button>
    <p class="wizard-name">New mascot</p>
    <ol class="wizard-dots" data-wizard-dots aria-hidden="true"></ol>
  </header>
  <div class="wizard-body" data-wizard-body></div>
</section>`;

/** Step one: the kinds the library can actually make, and nothing else. */
export function typeStepMarkup(types = []) {
  if (!types.length) {
    return `<div class="wizard-step"><h1 id="wizard-heading" tabindex="-1">Nothing is drawn yet</h1>
      <p class="screen-empty">A face pack brings the drawings a kind of mascot is made of.</p>
      <p class="wizard-otherwise"><button type="button" class="secondary" data-wizard-other="blank">Start from a blank drawing</button>
        <button type="button" class="secondary" data-wizard-other="import">Import an SVG</button></p></div>`;
  }
  const cards = types.map((type) => `<button type="button" class="screen-card wizard-type" data-wizard-type="${esc(type.id)}" title="${esc(type.description)}">
      <span class="wizard-type-art" aria-hidden="true">${type.thumbnail}</span>
      <span class="screen-card-title wizard-type-name">${esc(type.label)}</span>
      <small class="screen-card-note">${type.count} character${type.count === 1 ? '' : 's'}</small>
    </button>`).join('');
  return `<div class="wizard-step wizard-step-type">
    <h1 id="wizard-heading" tabindex="-1">What kind of mascot do you want to make?</h1>
    <div class="wizard-types" role="group" aria-label="Kinds of mascot">${cards}</div>
    <p class="wizard-otherwise">Otherwise:
      <button type="button" class="link" data-wizard-other="blank">Start from a blank drawing</button> ·
      <button type="button" class="link" data-wizard-other="import">Import an SVG</button></p>
  </div>`;
}

/**
 * Step two: the characters of that kind, and the one in hand, large.
 *
 * The preview takes the greater half of the screen on purpose — the result is
 * what the author is choosing, and a row of 96px thumbnails is not enough to
 * choose a face by.
 *
 * The action is named after the character rather than after the step ("Create
 * Cat", not "Create this mascot"): hovering a card peeks at it in the preview,
 * so a button that said *this* one would be pointing at whichever face the
 * pointer happened to be over.
 */
export function characterStepMarkup({ type = '', characters = [], selected = null } = {}) {
  const current = characters.find((item) => item.id === selected) || characters[0] || null;
  const cards = characters.map((item) => `<button type="button" class="screen-card wizard-character" data-wizard-character="${esc(item.id)}" aria-pressed="${item.id === current?.id}" title="${esc(item.description || item.name)}">
      <span class="wizard-character-art" aria-hidden="true">${item.thumbnail}</span>
      <span class="screen-card-title wizard-character-name">${esc(item.name)}</span>
    </button>`).join('');
  return `<div class="wizard-step wizard-step-character">
    <div class="wizard-choices">
      <p class="screen-eyebrow">${esc(mascotTypeLabel(type))}</p>
      <h1 id="wizard-heading" tabindex="-1">Which one?</h1>
      <div class="wizard-characters" role="group" aria-label="Characters">${cards}</div>
      <button type="button" class="link wizard-surprise" data-wizard-surprise>⤺ Surprise me</button>
    </div>
    <div class="wizard-preview">
      <div class="wizard-preview-art" data-wizard-preview aria-hidden="true">${current?.thumbnail || ''}</div>
      <p class="wizard-preview-name" data-wizard-preview-name>${esc(current?.name || '')}</p>
      <button type="button" class="primary btn-lg wizard-create" data-wizard-create${current ? '' : ' disabled'}>Create ${esc(current?.name || 'this mascot')} →</button>
    </div>
  </div>`;
}

const dotsMarkup = (steps, index) => steps.map((_, at) => `<li class="wizard-dot${at === index ? ' wizard-dot-current' : ''}"></li>`).join('');

/**
 * @param {HTMLElement} host  the element `wizardMarkup()` was rendered into
 * @param {object} options
 * @param {(choice: { type: string, character: string }) => void} options.onCreate
 * @param {() => void} [options.onCancel]
 * @param {(what: 'blank'|'import') => void} [options.onOther]
 * @param {object} [options.library] @param {object} [options.presets]
 */
export function createNewMascotWizard(host, { onCreate = () => {}, onCancel = () => {}, onOther = () => {}, library, presets } = {}) {
  if (!host) throw new Error('Missing required UI element: [data-wizard]');
  const body = host.querySelector('[data-wizard-body]');
  const dots = host.querySelector('[data-wizard-dots]');
  const backLabel = host.querySelector('[data-wizard-back-label]');
  const shelf = { library, presets };
  let step = 'type', type = null, character = null, characters = [];

  const render = () => {
    if (step === 'type') {
      body.innerHTML = typeStepMarkup(mascotTypes(shelf));
      backLabel.textContent = 'Cancel';
    } else {
      body.innerHTML = characterStepMarkup({ type, characters, selected: character });
      backLabel.textContent = mascotTypeLabel(type);
    }
    dots.innerHTML = dotsMarkup(['type', 'character'], step === 'type' ? 0 : 1);
    // The heading is where a screen reader should land: the step changed under
    // somebody who cannot see that it did.
    requestAnimationFrame(() => host.querySelector('#wizard-heading')?.focus?.());
  };

  /** Show the character being hovered without committing to it. */
  const preview = (id) => {
    const item = characters.find((entry) => entry.id === id);
    if (!item) return;
    const art = host.querySelector('[data-wizard-preview]');
    const name = host.querySelector('[data-wizard-preview-name]');
    if (art) art.innerHTML = item.thumbnail;
    if (name) name.textContent = item.name;
  };

  const chooseType = (id) => {
    characters = mascotCharacters(id, shelf);
    if (!characters.length) return;
    type = id;
    character = characters[0].id;
    step = 'character';
    render();
  };

  const chooseCharacter = (id) => {
    if (!characters.some((item) => item.id === id)) return;
    character = id;
    render();
  };

  const back = () => {
    if (step === 'type') { onCancel(); return; }
    step = 'type';
    render();
  };

  host.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const data = button.dataset || {};
    if (data.wizardBack !== undefined) back();
    else if (data.wizardType) chooseType(data.wizardType);
    else if (data.wizardCharacter) chooseCharacter(data.wizardCharacter);
    else if (data.wizardSurprise !== undefined) chooseCharacter(characters[Math.floor(Math.random() * characters.length)]?.id);
    else if (data.wizardCreate !== undefined) { if (type && character) onCreate({ type, character }); }
    else if (data.wizardOther) onOther(data.wizardOther);
  });

  // A card hovered shows what it would make, and leaving puts the chosen one
  // back: six faces are not judged from six 128px pictures.
  host.addEventListener('pointerover', (event) => {
    const card = event.target?.closest?.('[data-wizard-character]');
    if (card) preview(card.dataset.wizardCharacter);
  });
  host.addEventListener('pointerout', (event) => {
    if (event.target?.closest?.('[data-wizard-character]')) preview(character);
  });

  host.addEventListener('keydown', walkRing);
  /**
   * Escape is listened for on the document, not on the wizard.
   *
   * The wizard is the whole screen while it is open, and the press that opened
   * it — a card that the step then replaced — is gone, so focus is on `<body>`
   * as often as not. A listener on the host would miss every one of those.
   * The guard is `isOpen`, and the event is stopped so the editor's own Escape
   * chain does not also act on a surface it cannot see.
   */
  const onEscape = (event) => {
    if (host.hidden || event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    back();
  };
  document.addEventListener('keydown', onEscape, true);

  return {
    /** Open at the first question, whatever was chosen last time. */
    open() {
      step = 'type'; type = null; character = null; characters = [];
      host.hidden = false;
      render();
    },
    close() { host.hidden = true; },
    destroy() { document.removeEventListener('keydown', onEscape, true); },
    get isOpen() { return !host.hidden; },
    /** The wizard as plain data, for the browser-test seam. */
    snapshot: () => ({ step, type, character, characters: characters.map((item) => item.id) })
  };
}
