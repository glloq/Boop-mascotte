/**
 * What kind of face this is, in Design ▸ Face (MASC-05).
 *
 * ```text
 * [ Human ✓ ] [ Muzzle ] [ Beak ] [ Robot ] [ Monster ]
 *              ↑ greyed: nothing drawn for its muzzle or its whiskers yet
 * ```
 *
 * Choosing a kind **changes nothing on the face.** It decides what Design
 * offers: which parts are listed, and which presets. That is deliberate and it
 * is the difference between this and a wizard — an author who came in through a
 * preset has already made a face, and a Type press that rebuilt it would throw
 * their work away to answer a question they were only browsing.
 *
 * A kind with nothing drawn for the slots that make it that kind is shown and
 * disabled rather than hidden, and its card says what it is waiting for. A
 * missing option an author can see is a promise; one they cannot is a feature
 * that does not exist.
 */
import { esc } from '../escape-html.js';

/**
 * @param {{ types?: { id, label, description, available, missing, current }[], loaded?: boolean }} view
 */
export function typeBrowserMarkup(view = {}) {
  const types = view.types || [];
  if (!types.length) return '<p class="small">No kinds of face to choose from.</p>';
  const cards = types.map((type) => {
    const waiting = type.missing?.length ? `Nothing is drawn for its ${type.missing.join(' or its ')} yet.` : '';
    const title = !type.available ? `${type.label}: ${waiting}` : type.current ? `${type.label}: what Design is offering for. Press another to browse it.` : `${type.label}: ${type.description}`;
    return `<button type="button" class="face-type${type.current ? ' face-type-current' : ''}" data-face-type="${esc(type.id)}" aria-pressed="${Boolean(type.current)}"${type.available ? '' : ' disabled'} title="${esc(title)}">
      <span class="face-type-name">${esc(type.label)}</span>
      <small class="face-type-note">${esc(type.available ? type.description : waiting)}</small>
      ${type.current ? '<small class="part-style-badge">Current</small>' : ''}</button>`;
  }).join('');
  return `<div class="face-types" role="group" aria-label="Kinds of face">${cards}</div>
    <p class="small">The kind of face decides what Design offers you — the parts and the presets. It changes nothing on the mascot: press one to browse, and put the pieces on yourself.</p>`;
}
