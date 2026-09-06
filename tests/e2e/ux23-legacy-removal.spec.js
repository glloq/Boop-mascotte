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
  // First-run capabilities of the old empty state: templates, open project, import SVG.
  await expect(page.locator('[data-home] [data-template-id="basic"]')).toBeVisible();
  await expect(page.locator('[data-home] [data-template-id]')).toHaveCount(2, 'one face template and a blank canvas, not three faces');
  await expect(page.locator('[data-home] [data-template-id="blank"]')).toBeVisible();
  await expect(page.locator('[data-home] #home-project-file')).toHaveCount(1);
  await expect(page.locator('[data-home] #home-svg-file')).toHaveCount(1);

  // Building a face starts a mascot, so it starts one here rather than three
  // disclosures inside the panel for adding to the artwork you already have.
  await expect(page.locator('[data-home] [data-home-action="builder"]')).toBeVisible();
  await expect(page.locator('[data-home] #generate-face')).toHaveCount(1);

  await startBasicFace(page);
  await expectNoLegacy(page, 'after starting Basic Face');
  // Artwork keeps what belongs to artwork: start over, and import a drawing.
  await expect(page.locator('.create-tools #empty-basic')).toHaveCount(1);
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

test('@critical Basic Face export artifacts are identical to the pre-removal fixtures', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const artifacts = await page.evaluate(() => Object.fromEntries(window.__BOOP_E2E__.exportArtifacts().map((item) => [item.name, item.content])));
  expect(Object.keys(artifacts).sort()).toEqual(['mascot.svg', 'rig.json', 'runtime.js']);
  expect(artifacts['rig.json']).toBe(fixture('rig.json'));
  expect(artifacts['mascot.svg']).toBe(fixture('mascot.svg'));
});
