import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeSurfaceMarkup, renderHomeRecovery } from '../../ui/home-surface.js';
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

const SHELL_SOURCE = readFileSync(new URL('../../ui/app-shell.js', import.meta.url), 'utf8');

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

test('Home offers a preset and the mascot as it comes, and nothing else to start with', () => {
  const markup = homeSurfaceMarkup();
  assert.match(markup, /data-home-action="character"/);
  assert.match(markup, /data-template-id="basic"/);
  assert.equal(countOf(markup, /data-template-id="/g), 1, 'one template card on Home, beside the preset');
  for (const gone of ['home-svg-file', 'home-project-file', 'data-template-id="blank"', 'data-home-action="builder"', 'id="face-builder"']) {
    assert.equal(markup.includes(gone), false, `${gone} is not a way to start a mascot from nothing`);
  }
  // And it says where they went, because on a first run Home is the screen.
  assert.match(markup, /home-elsewhere/);
  assert.match(markup, /Open Project/);
  assert.match(markup, /Import SVG/);
});

test('Home keeps the local draft, and offers Discard rather than deleting an unreadable one', () => {
  const markup = homeSurfaceMarkup();
  assert.match(markup, /class="home-recovery"/, 'setRecoveryState mustQuery-s this container at construction');
  assert.match(markup, /data-recovery-content/);
  // Continuing is the only thing left on Home that is not a new mascot: the two
  // file pickers went to the ••• menu with the actions that used them.
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

  const none = container();
  renderHomeRecovery(none, { status: 'none', savedAt: null });
  assert.equal(none.dataset.recoveryStatus, 'none');
  assert.match(none.content.innerHTML, /No local draft/);
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
  assert.match(SHELL_SOURCE, /bindLoadSvg\(h\)\{bindFile\('#svg-file',h\);bindFile\('#artwork-svg-file',h\);\}/);
  assert.match(SHELL_SOURCE, /bindLoadProject\(h\)\{bindFile\('#project-file',h\);\}/);
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
