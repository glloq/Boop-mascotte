/**
 * The rule the design system lives or dies by (UI-REDESIGN-01).
 *
 * A design system that is only written down is a style guide, and style guides
 * drift: the editor already had eleven `--ux-*` tokens and 620 literal colours
 * beside them. So the rule is a test — **a component never chooses a value, it
 * chooses a token** — and contrast is checked rather than asserted in prose.
 *
 * `surfaces.css` is deliberately exempt: it is the old stylesheet, moved
 * verbatim out of `index.html`, and rules leave it for the files below as each
 * area goes through the redesign. The day it is empty, this exemption goes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../../styles/${name}`, import.meta.url), 'utf8');
const TOKENS = read('tokens.css');
const BASE = read('base.css');
const COMPONENTS = read('components.css');

/** Declarations only: a comment explaining a colour is not a colour. */
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const hexes = (css) => withoutComments(css).match(/#[0-9a-fA-F]{3,8}\b/g) || [];

test('components.css and base.css hold no literal colour', () => {
  // `#fff` on an accent fill is the one exception, and it is there because the
  // contrast test below says --bp-text is not readable on --bp-accent.
  const allowed = new Set(['#fff']);
  for (const [name, css] of [['components.css', COMPONENTS], ['base.css', BASE]]) {
    const literals = hexes(css).filter((value) => !allowed.has(value.toLowerCase()));
    assert.deepEqual(literals, [], `${name} should use tokens, found: ${literals.join(', ')}`);
  }
});

test('components.css holds no off-scale radius or duration', () => {
  const css = withoutComments(COMPONENTS);
  const radii = (css.match(/border-radius:\s*([^;}]+)/g) || [])
    .map((rule) => rule.split(':')[1].trim())
    // A shape that is a circle or a square is geometry, not a scale step.
    .filter((value) => !value.startsWith('var(') && value !== '0' && value !== '50%');
  assert.deepEqual(radii, [], `off-scale radii: ${radii.join(', ')}`);
  const durations = (css.match(/\b\d+ms\b/g) || []);
  assert.deepEqual(durations, [], `durations belong in tokens.css: ${durations.join(', ')}`);
});

/* ── Contrast ────────────────────────────────────────────────────────────── */

const token = (name) => {
  const found = TOKENS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  assert.ok(found, `token --${name} is not declared`);
  return found[1];
};

const channels = (hex) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
};
const linear = (channel) => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => { const [r, g, b] = channels(hex).map(linear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** Text that carries meaning: WCAG AA, 4.5:1. */
const TEXT_PAIRS = [
  ['bp-text', 'bp-bg'], ['bp-text', 'bp-surface'], ['bp-text', 'bp-raised'],
  ['bp-text', 'bp-raised-hover'], ['bp-text', 'bp-accent-tint'],
  ['bp-text-muted', 'bp-bg'], ['bp-text-muted', 'bp-surface'],
  ['bp-text-muted', 'bp-raised'], ['bp-text-muted', 'bp-raised-hover'],
  ['bp-accent-text', 'bp-surface'], ['bp-accent-text', 'bp-accent-tint'],
  ['bp-danger', 'bp-surface'], ['bp-danger', 'bp-danger-tint'],
  ['bp-warn', 'bp-surface'], ['bp-warn', 'bp-warn-tint'],
  ['bp-success', 'bp-surface'], ['bp-success', 'bp-success-tint']
];

test('every text token is readable on every ground it is used on', () => {
  for (const [fg, bg] of TEXT_PAIRS) {
    const ratio = contrast(token(fg), token(bg));
    assert.ok(ratio >= 4.5, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1, under AA (4.5)`);
  }
});

test('white is the readable text on an accent fill, and --bp-text is not', () => {
  assert.ok(contrast('#ffffff', token('bp-accent')) >= 4.5, 'white on --bp-accent must reach AA');
  // The reason `.btn-primary` says `color:#fff` rather than the text token.
  assert.ok(contrast(token('bp-text'), token('bp-accent')) < 4.5,
    '--bp-text now reaches AA on --bp-accent: use it in .btn-primary and drop the exception');
});

/** A control's own edge: WCAG non-text contrast, 3:1. */
test('a control boundary is visible against every surface', () => {
  for (const ground of ['bp-bg', 'bp-surface', 'bp-raised']) {
    const ratio = contrast(token('bp-border-strong'), token(ground));
    assert.ok(ratio >= 3, `--bp-border-strong on --${ground} is ${ratio.toFixed(2)}:1, under 3`);
  }
});

test('the faint text token is only ever decoration', () => {
  // Kept honest on purpose: it does not reach AA, so nothing that carries
  // meaning may use it. The assertion is what stops it quietly becoming a body
  // colour.
  assert.ok(contrast(token('bp-text-faint'), token('bp-surface')) < 4.5,
    '--bp-text-faint reaches AA: rename it, it is a reading colour now');
  assert.ok(contrast(token('bp-text-faint'), token('bp-surface')) >= 3,
    '--bp-text-faint must still reach 3:1 for large text');
});

test('the focus ring is reserved for focus', () => {
  // It used to double as the accent and as the "recommended" border, so a
  // focused thing and a recommended thing looked alike.
  const uses = (withoutComments(COMPONENTS).match(/var\(--bp-accent-ring\)/g) || []).length;
  assert.equal(uses, 0, 'components.css paints with the focus ring; base.css owns :focus-visible');
  assert.match(BASE, /:focus-visible\{[^}]*var\(--bp-accent-ring\)/);
});

test('every --ux-* bridge token resolves to a --bp-* one', () => {
  const bridges = TOKENS.match(/--ux-[a-z-]+:\s*[^;]+;/g) || [];
  assert.ok(bridges.length >= 11, 'the bridge should still cover what surfaces.css reads');
  for (const bridge of bridges) {
    assert.match(bridge, /var\(--bp-[a-z0-9-]+\)/, `${bridge.trim()} is not mapped onto a token`);
  }
});

test('index.html declares no CSS of its own', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('<style'), 'stylesheets belong in project/editor/styles/');
  for (const file of ['tokens.css', 'base.css', 'components.css', 'surfaces.css']) {
    assert.ok(html.includes(`styles/${file}`), `index.html should link ${file}`);
  }
});
