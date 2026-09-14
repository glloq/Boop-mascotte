/**
 * What kind of face this is, in the header of Design ▸ Face (MASC-05).
 *
 * ```text
 * Kind [ Human ▾ ]     Human · Muzzle · Beak · Robot · Monster — not drawn yet
 * ```
 *
 * Choosing a kind **changes nothing on the face.** It decides what Design
 * offers: which parts are listed, and which presets. That is deliberate and it
 * is the difference between this and a wizard — an author who came in through a
 * preset has already made a face, and a Type press that rebuilt it would throw
 * their work away to answer a question they were only browsing.
 *
 * It used to be a **row**, second in a list whose subject is the face, above
 * the head — so the first two things an author read in the parts panel were two
 * settings, one of which announces that it does nothing (the audit's §1.4).
 * A setting over the list is what it always was; now it looks like one.
 *
 * A kind with nothing drawn for the slots that make it that kind is offered and
 * disabled rather than hidden, and the option says what it is waiting for. A
 * missing option an author can see is a promise; one they cannot is a feature
 * that does not exist.
 */
import { esc } from '../escape-html.js';

/** What a kind is waiting for, in words, or '' when it is ready. */
export const typeWaitingFor = (type) => (type?.missing?.length ? `Nothing is drawn for its ${type.missing.join(' or its ')} yet.` : '');

/**
 * @param {{ types?: { id, label, description, available, missing, current }[], loaded?: boolean }} view
 */
export function typeSelectMarkup(view = {}) {
  const types = view.types || [];
  if (!types.length) return '';
  const current = types.find((type) => type.current);
  const options = types.map((type) => {
    // The reason rides *in* the option: a `title` is invisible to a finger, and
    // this is the one place that says why a kind cannot be chosen.
    const note = type.available ? '' : ' — not drawn yet';
    return `<option value="${esc(type.id)}"${type.current ? ' selected' : ''}${type.available ? '' : ' disabled'} title="${esc(type.available ? type.description : typeWaitingFor(type))}">${esc(type.label)}${note}</option>`;
  }).join('');
  const waiting = types.filter((type) => !type.available);
  return `<label class="face-setting" data-face-setting="type"><span>Kind</span>
    <select data-face-type aria-label="What kind of face this is" title="What Design offers you — the parts and the presets. It changes nothing on the mascot.">${options}</select>
  </label>${waiting.length ? `<p class="small face-setting-note" data-face-type-waiting>${esc(waiting.map((type) => `${type.label}: ${typeWaitingFor(type)}`).join(' '))}</p>` : ''}${current && !view.compact ? `<p class="small face-setting-note" data-face-type-note>${esc(current.description)} Choosing a kind changes nothing on the mascot: it decides what the library offers you.</p>` : ''}`;
}
