import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openFreshEditor, startBasicFace, goToPreview } from './editor-helpers.js';

// UX-23: the pre-UX-03 Canvas empty state and the "Try your mascot" demo bar are gone.
// Their capabilities live on Home (UX-03), Artwork and the Preview animations chips (UX-08).
const LEGACY_SELECTORS = ['#empty-state', '#empty-svg', '#empty-project', '#empty-face', '[data-use-template]', '.empty-actions', '.primary-start', '.try-animations', '#example-buttons', '[data-demo-clip]'];
const fixture = (name) => readFileSync(new URL(`./fixtures/basic-face.${name}`, import.meta.url), 'utf8');
const expectNoLegacy = async (page, stage) => { for (const selector of LEGACY_SELECTORS) await expect(page.locator(selector), `${selector} must not exist ${stage}`).toHaveCount(0); };

test('@critical legacy empty state and demo bar are removed; Home, Artwork and Preview carry their capabilities', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await expectNoLegacy(page, 'on Home');
  // First-run capabilities of the old empty state, after V3-08 narrowed Home to
  // a preset and the mascot as it comes: the two starters are on Home, and open
  // project and import SVG are in the ••• menu, which sits above Home.
  await expect(page.locator('[data-home] [data-home-action="character"]')).toBeVisible();
  await expect(page.locator('[data-home] [data-template-id="basic"]')).toBeVisible();
  await expect(page.locator('[data-home] [data-template-id]')).toHaveCount(1, 'the mascot as it comes; the preset is the other card');
  await expect(page.locator('.file-menu #project-file')).toHaveCount(1);
  await expect(page.locator('.file-menu #svg-file')).toHaveCount(1);

  await startBasicFace(page);
  await expectNoLegacy(page, 'after starting Basic Face');
  // Artwork keeps what belongs to artwork: the three ways to replace the mascot
  // on the canvas, and importing a drawing over it.
  await expect(page.locator('.create-tools #empty-basic')).toHaveCount(1);
  await expect(page.locator('.create-tools [data-template-id="blank"]')).toHaveCount(1);
  await expect(page.locator('.create-tools [data-face-builder]')).toHaveCount(1);
  await expect(page.locator('.create-tools #generate-face')).toHaveCount(1);
  await expect(page.locator('.create-tools #artwork-svg-file')).toHaveCount(1);
  // The canvas no longer carries an overlay besides its own toolbars.
  expect(await page.locator('#canvas > div').evaluateAll((nodes) => nodes.map((node) => node.className || node.id))).not.toContain('try-animations');

  // Demo bar replacement: Preview animations chips play and stop clips without touching the document.
  await goToPreview(page);
  const before = await page.evaluate(() => window.__BOOP_E2E__.documentRevisions());
  const clip = page.locator('[data-preview-section="animations"] [data-preview-clip="look-around"]');
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(true);
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(false);
  expect(await page.evaluate(() => window.__BOOP_E2E__.documentRevisions())).toEqual(before);
  await expectNoLegacy(page, 'in Preview');
});

// The fixture has been re-signed four times, every time deliberately and
// every time after checking that *only* the intended keys moved -- which is
// what makes re-signing a guard against drift rather than a way of hiding it.
//
// The lower lids belong to the eyelids: their two bindings gained the
// `generatedBy` stamp that says which semantic movement wrote them. Nothing
// about how they move changed -- same expression, same amplitude, same offset,
// and `mascot.svg` is byte-for-byte what it was. What changed is that
// switching Eyes · Open / close off now reaches them, instead of taking the
// upper lids down and leaving these two still rising.
//
// Hands, one outline each: a drawing is a single path rather than a group of
// six shapes (docs/HAND_STYLES.md, "One outline"), and the library grew the OK
// sign and the closed side. So `elements` lost the 72 shapes inside the twelve
// old drawings and gained the four new ones, `hands.*.styles.library` lists
// eight drawings a side, and `handLStyle`/`handRStyle` run 0-7 instead of 0-5.
// Nothing outside the pair of hands moved: no face element, no other
// parameter, no expression, clip or reaction.
//
// V3-12: the template ships the gaze solver on, so the rig gained `gazeX`,
// `gazeY`, their rest values in each state and the solver's settings block. No
// parameter was removed and no other top-level key changed.
//
// V3-09: schema 4 became 5 and the rig gained `requires`, which names the two
// new triggers it uses so an older runtime declines by name instead of guessing
// at them. The four "by itself" reactions moved from `timer` to `idle` -- they
// wait for you to stop, they do not run on a clock -- and three `gaze-follow`
// reactions joined them.
test('@critical Basic Face export artifacts are identical to the pre-removal fixtures', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const artifacts = await page.evaluate(() => Object.fromEntries(window.__BOOP_E2E__.exportArtifacts().map((item) => [item.name, item.content])));
  expect(Object.keys(artifacts).sort()).toEqual(['mascot.svg', 'rig.json', 'runtime.js']);
  expect(artifacts['rig.json']).toBe(fixture('rig.json'));
  expect(artifacts['mascot.svg']).toBe(fixture('mascot.svg'));
});
