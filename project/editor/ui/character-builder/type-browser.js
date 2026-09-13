/**
 * What kind of mascot this is, in Design ▸ Face (MASC-05, UI-REDESIGN-03).
 *
 * ```text
 * [ Human ✓ ] [ Animal ] [ Bird ] [ Robot ]
 * ```
 *
 * Choosing a kind **changes nothing on the face.** It decides what Design
 * offers: which parts are listed, and which presets. That is deliberate and it
 * is the difference between this and a wizard — an author who came in through a
 * preset has already made a face, and a Type press that rebuilt it would throw
 * their work away to answer a question they were only browsing. The question
 * that *does* rebuild is asked before any of this, by the new-mascot wizard.
 *
 * **A kind the library cannot draw is not offered at all** (UI-REDESIGN-03).
 * It used to be shown and disabled, on the reasoning that a missing option an
 * author can see is a promise. Two years of `Monster` greyed out under
 * "Nothing is drawn for its horns yet" is not a promise, it is a dead card in
 * second position of the panel that matters most — and the author cannot draw
 * the horns from here anyway. A kind comes back the moment somebody draws for
 * it, because `availableMorphologies()` derives that from the library rather
 * than from a list anybody has to remember to edit.
 */
import { esc } from '../escape-html.js';

/** The kinds worth offering: the ones the library can actually fill. */
export const offeredTypes = (types = []) => types.filter((type) => type.available);

/**
 * @param {{ types?: { id, label, description, available, missing, current }[], loaded?: boolean }} view
 */
export function typeBrowserMarkup(view = {}) {
  const types = offeredTypes(view.types || []);
  // Every kind waiting on a drawing is the one case worth a word: the panel
  // would otherwise be empty with no way to tell that from a bug.
  if (!types.length) return '<p class="small">No kinds of mascot to choose from yet. A face pack brings the drawings a kind is made of.</p>';
  const cards = types.map((type) => {
    const title = type.current
      ? `${type.label}: what Design is offering for. Press another to browse it.`
      : `${type.label}: ${type.description}`;
    return `<button type="button" class="face-type${type.current ? ' face-type-current' : ''}" data-face-type="${esc(type.id)}" aria-pressed="${Boolean(type.current)}" title="${esc(title)}">
      <span class="face-type-name">${esc(type.label)}</span>
      <small class="face-type-note">${esc(type.description)}</small>
      ${type.current ? '<small class="part-style-badge">Current</small>' : ''}</button>`;
  }).join('');
  return `<div class="face-types" role="group" aria-label="Kinds of mascot">${cards}</div>
    <p class="small">The kind of mascot decides what Design offers you — the parts and the ready-made characters. It changes nothing on the mascot: press one to browse, and put the pieces on yourself.</p>`;
}
