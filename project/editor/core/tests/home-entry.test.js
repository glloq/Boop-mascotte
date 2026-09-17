import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { homeExamples, homeSurfaceMarkup, renderHomeRecovery } from '../../ui/home-surface.js';
import { FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';
import { buildAddPartSection, buildPluginSection, buildStartArtworkSection } from '../../ui/sidebar-sections.js';
import { gateMarkup } from '../../ui/mobile-capabilities.js';
import { SETUP_SECTIONS } from '../validation/setup-sections.js';

/**
 * Home is presets, or the mascot as it comes (V3-08, docs/V3_ROADMAP.md), and
 * the shell still boots.
 *
 * The markup is asserted as the strings the shell renders, because there is no
 * DOM in `node --test` and the two things worth proving are both textual: what
 * Home offers, and that nothing the shell `mustQuery`s was deleted out from
 * under it. The second one is not pedantry -- `mustQuery` throws at shell
 * construction, so a removed element is an editor that never boots, and the
 * browser suite would be the first thing to notice.
 */

/**
 * The shell is a layout and six regions since UIR-02, so "what the shell puts
 * on the page" is the whole of `editor/shell/` rather than one file. Reading
 * the directory rather than a list of files is deliberate: a region added
 * without a line here would otherwise be a region this test silently stops
 * checking.
 */
const SHELL_DIR = new URL('../../shell/', import.meta.url);
const SHELL_SOURCE = readdirSync(SHELL_DIR).filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(new URL(name, SHELL_DIR), 'utf8')).join('\n');

/**
 * Everything the shell puts on the page. `app-shell.js` builds most of it in
 * one template literal in `createAppShell`, which is not exported, so its
 * source stands in for it -- with every `q('…')` and `qAll('…')` call removed
 * first, or a binding would happily satisfy itself.
 */
const shellMarkup = () => [
  SHELL_SOURCE.replace(/\bqAll?\((['`])[^'`]+\1\)/g, ''),
  homeSurfaceMarkup(), buildStartArtworkSection(), buildAddPartSection(), buildPluginSection(),
  gateMarkup('artwork', 'mobile'),
  SETUP_SECTIONS.map((section) => `id="${section.panel}"`).join(' ')
].join('\n');

/** Every selector the shell hands to `mustQuery`, which throws when it misses. */
const boundSelectors = () => [...SHELL_SOURCE.matchAll(/\bq\((['`])([^'`]+)\1\)/g)].map((match) => match[2]);

/** What a selector looks like once it is written as markup instead. */
const markupTokens = (selector) => selector.split(/(?=[#.[])/).map((part) => {
  if (part.startsWith('#')) return `id="${part.slice(1)}"`;
  if (part.startsWith('.')) return part.slice(1);
  if (part.startsWith('[')) { const [name, value] = part.slice(1, -1).split('='); return value ? `${name}="${value.replace(/["']/g, '')}"` : name; }
  return null;
}).filter(Boolean);

const countOf = (markup, pattern) => markup.match(pattern)?.length ?? 0;

/**
 * What a person actually reads: the text between the tags, plus the two
 * attributes that are read out loud or hovered. Everything else in the markup
 * is the machine talking to itself.
 */
const visibleWords = (markup) => [
  ...markup.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, '\u0001').split('\u0001'),
  ...[...markup.matchAll(/(?:title|aria-label)="([^"]*)"/g)].map((match) => match[1])
].join(' ');

/**
 * UI-REDESIGN-02 — Home says what the software is for, and offers two presses.
 *
 * It used to be titled "Create or continue a mascot" — an instruction rather
 * than a proposition — and to carry two text cards, no picture, and a grey
 * sentence explaining that Open Project and Import SVG were "in the ••• menu,
 * top right". A sentence pointing at a button is not an offer.
 */
test('Home says what to prepare, in three lines, and never which parts to make', () => {
  const markup = homeSurfaceMarkup();
  const words = visibleWords(markup).toLowerCase();

  // The one rule nobody guesses, and the two facts that stop an import being
  // refused later.
  assert.match(words, /anything that moves on its own is its own file/);
  assert.match(words, /png or webp/);
  assert.match(words, /transparent background/);

  // And **not** a list of parts. "You need a head, two eyes and a mouth" is the
  // constraint this refit exists to remove, and a page that says it puts it
  // back: a mascot here can be a robot, an animal, an object or a photograph.
  assert.match(words, /a person, an animal, a robot, an object, a photograph/);
  assert.equal(/you (will )?need/.test(words), false, `Home tells nobody what parts to make: ${words}`);

  // The poster is a schematic, for the same reason. A finished face says the
  // editor already has a mascot; a human face makes every other kind a special
  // case. Four boxes and the gaps between them is true of all of them.
  assert.match(markup, /class="home-pieces"/);
  assert.match(markup, /aria-label="A character cut into four pieces[^"]*"/);
  assert.equal(/presetThumbnail|home-hero"[^>]*>\s*<svg viewBox="0 0 200 200"/.test(markup), false);
});

test('Home says what the editor is for, and offers one way to start and one to come back', () => {
  const markup = homeSurfaceMarkup();
  assert.match(markup, /Create and animate your mascot/);
  // One primary action, and the one the brief asks to sit beside it.
  assert.match(markup, /data-home-action="character"/);
  assert.match(markup, /data-home-action="open"/);
  assert.equal(countOf(markup, /class="primary btn-lg/g), 1, 'exactly one primary action on the page');
  // A mascot editor whose first page shows a mascot: the real drawings, from
  // the real preset, rather than an illustration that could promise anything.
  assert.match(markup, /class="home-hero"/);
  assert.match(markup, /<svg/);
  // Pictures are the way in (V5-04): they are the primary, and the three other
  // beginnings sit under "No pictures to hand?".
  assert.match(markup, /class="primary btn-lg home-start" data-home-action="picture"/);
  assert.match(markup, /data-home-action="import"/);
  assert.match(markup, /data-home-action="character"/);
  // The ready-made template stays reachable, as an alternative rather than as
  // an equal: `pages.spec.js` starts a project by pressing exactly this.
  assert.match(markup, /data-template-id="basic"/);
  assert.equal(countOf(markup, /data-template-id="/g), 1, 'one template on Home, under Otherwise');
  for (const gone of ['home-svg-file', 'home-project-file', 'data-template-id="blank"', 'data-home-action="builder"', 'id="face-builder"']) {
    assert.equal(markup.includes(gone), false, `${gone} is not a way to start a mascot from nothing`);
  }
  // And nothing a person can read on it names a part of the machine. Read from
  // the words rather than from the markup: the hero really is drawn by
  // `presetThumbnail`, so the source says "preset" where nobody can see it.
  for (const jargon of ['rigged', '2.5D', 'Artwork', 'preset', 'library']) {
    assert.equal(visibleWords(markup).toLowerCase().includes(jargon.toLowerCase()), false,
      `"${jargon}" is the software's word, not the author's`);
  }
});

/** A first run has something to press, rather than a panel saying "no". */
test('Home offers examples, and each one is a character the library really holds', () => {
  const markup = homeSurfaceMarkup();
  const examples = homeExamples();
  assert.ok(examples.length >= 3, 'three ready-made characters to try');
  for (const example of examples) {
    assert.ok(FACE_PRESET_LIBRARY.get(example.id), `${example.id} is a preset the library holds`);
    assert.match(markup, new RegExp(`data-home-example="${example.id}"`));
  }
  // An example names a character, never a preset id.
  assert.match(markup, /Fox/);
  assert.equal(markup.includes('robot-screen<'), false);
});

test('Home keeps the local draft, and offers Discard rather than deleting an unreadable one', () => {
  const markup = homeSurfaceMarkup();
  assert.match(markup, /class="home-recovery"/, 'setRecoveryState mustQuery-s this container at construction');
  assert.match(markup, /data-recovery-content/);
  // Home presses the pickers, it does not carry them: one input, one handler,
  // whichever way in was used.
  assert.equal(/type="file"/.test(markup), false);

  const container = () => { const content = { innerHTML: '' }; return { dataset: {}, querySelector: () => content, content }; };
  const available = container();
  renderHomeRecovery(available, { status: 'available', savedAt: null });
  assert.equal(available.dataset.recoveryStatus, 'available');
  assert.match(available.content.innerHTML, /data-home-action="recover"/);

  const invalid = container();
  renderHomeRecovery(invalid, { status: 'invalid', savedAt: null });
  assert.equal(invalid.dataset.recoveryStatus, 'invalid');
  assert.match(invalid.content.innerHTML, /Your current project was not changed/);
  assert.match(invalid.content.innerHTML, /data-home-action="discard-recovery"/, 'an unreadable draft is discarded on purpose, never on boot');
  assert.equal(invalid.content.innerHTML.includes('data-home-action="recover"'), false);

  // UI-REDESIGN-02: with nothing to continue, the section says nothing rather
  // than saying "no". A bordered box whose whole content is a denial was the
  // third thing a first-time visitor read.
  const none = container();
  renderHomeRecovery(none, { status: 'none', savedAt: null });
  assert.equal(none.dataset.recoveryStatus, 'none');
  assert.equal(none.content.innerHTML, '');
});

test('what left Home is in Artwork, whole: blank canvas and the Face Builder beside Start over', () => {
  const markup = buildStartArtworkSection();
  assert.match(markup, /id="empty-basic"/);
  assert.match(markup, /data-template-id="blank"/);
  assert.match(markup, /data-face-builder/);
  // The builder is no use without its three fields and its button.
  for (const id of ['face-builder', 'face-head', 'face-eyes', 'face-mouth', 'generate-face']) assert.match(markup, new RegExp(`id="${id}"`));
  assert.match(markup, /aria-controls="face-builder"/, 'the card says what it discloses');
});

test('Open Project and Import SVG live in the ••• menu now, and only there', () => {
  // The topbar sits above Home, so these stay reachable on a first run.
  for (const id of ['project-file', 'svg-file']) assert.match(SHELL_SOURCE, new RegExp(`id="${id}"`));
  // Both file inputs are bound, and both are bound where the menu puts them.
  // Matched on the call rather than on a whole formatted line: this is testing
  // where a binding lives, not how the source is laid out.
  assert.match(SHELL_SOURCE, /bindLoadSvg\([\w$]+\) \{[^}]*'#svg-file'[^}]*'#artwork-svg-file'/);
  assert.match(SHELL_SOURCE, /bindLoadProject\([\w$]+\) \{[^}]*'#project-file'/);
  assert.equal(SHELL_SOURCE.includes('#home-svg-file'), false);
  assert.equal(SHELL_SOURCE.includes('#home-project-file'), false);
});

test('every element the shell binds is in the markup the shell renders', () => {
  const markup = shellMarkup(), selectors = boundSelectors();
  assert.ok(selectors.length > 50, 'the binding block is still read from the source');
  const missing = selectors.flatMap((selector) => markupTokens(selector).filter((token) => !markup.includes(token)).map((token) => `${selector} (${token})`));
  assert.deepEqual(missing, [], 'mustQuery throws at construction, so a missing element is an editor that never boots');
  // The Face Builder moved, so the binding moved with it.
  assert.ok(selectors.includes('[data-face-builder]'));
  assert.equal(selectors.includes('[data-home-action=builder]'), false);
  // The two Home controls resolve on Home still: the focus target of
  // `showHome({focus:'new'})` and the way back out of it.
  for (const selector of ['[data-home-action=character]', '[data-home-action=back]', '.home-back', '.home-recovery']) assert.ok(selectors.includes(selector), selector);
});
