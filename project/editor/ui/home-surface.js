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
 *
 * V4-092 added the third way to begin, and V5-04 made it the first
 * (docs/V5_MASCOTTE_IMAGES_ETUDE.md). Pictures were a way in among four; they
 * are now *the* way in, because that is what this editor is for. The three
 * others are still here, under "No pictures to hand?", which is the honest
 * place for them: a ready-made face to take apart, shapes to draw, an SVG to
 * import.
 *
 * The page's job is now to say **what to prepare**, and it says exactly three
 * things — a transparent PNG or WebP, one piece per file, and that the
 * character can be anything. It deliberately does *not* list the parts a
 * mascot needs. "You need a head, two eyes and a mouth" is the constraint this
 * refit exists to remove, and a page that says it puts it back.
 */
import { FACE_PART_LIBRARY } from '../core/face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY, presetThumbnail } from '../core/face-library/face-presets.js';
import { esc } from './escape-html.js';

/**
 * The poster, and why it is not a mascot.
 *
 * It used to be one: `presetThumbnail` drew the library's own reference
 * character, on the argument that a mascot editor's first page should show a
 * mascot. That argument was right while the editor's answer to "how do I
 * start?" was "pick one of ours".
 *
 * It is the wrong picture for this page. The thing an author has to understand
 * before anything else is that **a mascot is pieces, and a piece is a file** —
 * and a finished face says the opposite: it says the editor already has one.
 * A human face would say something worse still, because the whole point of
 * this refit is that a mascot can be a robot, an animal, a teapot or a
 * photograph, and a face on the poster quietly makes that a special case.
 *
 * So: four boxes and a gap between them. It is the only illustration that is
 * true of every mascot this editor can make.
 */
function heroArt() {
  const box = (x, y, width, height, label) =>
    `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>`
    + `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle">${label}</text></g>`;
  return `<svg viewBox="0 0 200 92" role="img" aria-label="A character cut into four pieces: a body, two eyes and a mouth" class="home-pieces">`
    + box(6, 10, 74, 72, 'body')
    + box(96, 10, 42, 30, 'eye')
    + box(148, 10, 42, 30, 'eye')
    + box(96, 52, 94, 30, 'mouth')
    + '</svg>';
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
    <section class="home-needs" aria-label="What to prepare">
      <p class="home-needs-rule"><b>Cut your character into pieces.</b> Anything that moves on its own is its own file.</p>
      <ul class="home-needs-list">
        <li><b>PNG or WebP</b><small>A transparent background, so pieces sit on each other.</small></li>
        <li><b>One piece per file</b><small>A body, an arm, an eye — whatever you want to move.</small></li>
        <li><b>Any character at all</b><small>A person, an animal, a robot, an object, a photograph.</small></li>
      </ul>
    </section>
    <div class="home-actions">
      <button type="button" class="primary btn-lg home-start" data-home-action="picture">Start with my pictures</button>
      <button type="button" class="secondary btn-lg" data-home-action="open">Open a project</button>
    </div>
    <p class="home-otherwise">No pictures to hand?
      <button type="button" class="link" data-template-id="basic" title="A finished mascot that already moves, to take apart">See a finished mascot</button> ·
      <button type="button" class="link" data-home-action="character">Build one from shapes</button> ·
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
