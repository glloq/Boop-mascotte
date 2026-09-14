/**
 * The first page (UI-REDESIGN-02, docs/REDESIGN_UI_2026-09/02_HOME.md).
 *
 * ```text
 *                        ( ◕  ◕ )
 *                           ‿
 *              Create and animate your mascot
 *      A character that blinks, smiles and reacts — no code
 *
 *      [ +  New mascot ]        [ Open a project ]
 *
 *      CONTINUE
 *      [ a draft ]
 * ```
 *
 * What it stopped doing, and why each one mattered:
 *
 * ```text
 * it showed no mascot          a mascot editor whose first page has no mascot
 * it said "Create or continue" an instruction, not what the software is for
 * "Open a project" was prose   a grey sentence explaining where a button is
 * two cards, two destinations  one led to the Character Builder and one to the
 *                              vector editor, which the cards did not say
 * an empty "Continue" panel    a bordered box saying "No local draft", on the
 *                              one run where the impression matters most
 * ```
 *
 * The hero is a real preset drawn by `presetThumbnail` from the real assets:
 * the first thing an author sees is something the library can actually make.
 *
 * The rest of what used to live here — Import SVG, Open Project, the blank
 * canvas — is still reachable. Two of them are one press from this page now
 * rather than a sentence pointing at the ••• menu.
 */
import { FACE_PART_LIBRARY } from '../core/face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY, presetThumbnail } from '../core/face-library/face-presets.js';
import { esc } from './escape-html.js';

/**
 * The face on the poster.
 *
 * `classic` is the library's own reference character, so the picture is never
 * a promise the library cannot keep. A library with no presets at all — every
 * pack forgotten — falls back to nothing rather than to a placeholder drawing.
 */
function heroArt({ library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY } = {}) {
  const preset = presets.get?.('classic') || presets.list?.()[0] || null;
  return preset ? presetThumbnail(preset, library, { size: 200 }) : '';
}

/**
 * Three ready-made characters to press on a first run, in place of an empty
 * *Continue* panel. An empty state a section can simply not have is an empty
 * state that should not exist.
 */
const EXAMPLES = Object.freeze([
  { id: 'fox', label: 'Fox' },
  { id: 'robot-screen', label: 'Robot' },
  { id: 'owl', label: 'Owl' }
]);

export const homeExamples = ({ presets = FACE_PRESET_LIBRARY } = {}) =>
  EXAMPLES.filter((example) => Boolean(presets.get?.(example.id)));

export function homeSurfaceMarkup(options = {}) {
  const examples = homeExamples(options);
  return `<section class="home-surface" data-home aria-labelledby="home-heading" hidden><div class="home-panel">
    <p class="home-brand">BOOP</p>
    <div class="home-hero" aria-hidden="true">${heroArt(options)}</div>
    <h1 id="home-heading" tabindex="-1">Create and animate your mascot</h1>
    <p class="home-lede">A character that blinks, smiles and reacts — no code, nothing to install.</p>
    <div class="home-actions">
      <button type="button" class="primary btn-lg home-start" data-home-action="character">+&nbsp; New mascot</button>
      <button type="button" class="secondary btn-lg" data-home-action="open">Open a project</button>
    </div>
    <p class="home-otherwise">Otherwise:
      <button type="button" class="link" data-template-id="basic" title="The cartoon face this editor comes with, ready to change">Start from the ready-made face</button> ·
      <button type="button" class="link" data-home-action="import">Import an SVG</button></p>
    <section class="home-recovery" aria-labelledby="home-continue" data-recovery-status="none">
      <h2 id="home-continue" class="screen-eyebrow">Continue</h2><div data-recovery-content></div>
    </section>
    ${examples.length ? `<p class="home-examples" data-home-examples>Or try an example:
      ${examples.map((example) => `<button type="button" class="link" data-home-example="${esc(example.id)}">${esc(example.label)}</button>`).join(' · ')}</p>` : ''}
    <button type="button" class="secondary home-back" data-home-action="back" hidden>Back to current project</button>
  </div></section>`;
}

/**
 * The local draft, as the one card of *Continue*.
 *
 * The section carries its own state on the host, and the stylesheet hides it
 * when there is nothing: a first run does not show a bordered box whose whole
 * content is the word "no".
 */
export function renderHomeRecovery(container, recovery) {
  container.dataset.recoveryStatus = recovery.status;
  const content = container.querySelector('[data-recovery-content]');
  if (recovery.status === 'available') {
    const when = recovery.savedAt ? new Date(recovery.savedAt).toLocaleString() : '';
    content.innerHTML = `<button type="button" class="screen-card home-draft" data-home-action="recover">
      <span class="screen-card-title">Unsaved draft</span>
      <small class="screen-card-note">${when ? `Saved ${esc(when)}. ` : ''}Kept in this browser only.</small></button>`;
  } else if (recovery.status === 'invalid') {
    content.innerHTML = `<p role="alert" class="screen-card-note">This local draft could not be read. Your current project was not changed.</p>
      <button type="button" class="secondary" data-home-action="discard-recovery">Discard local draft</button>`;
  } else content.innerHTML = '';
}
