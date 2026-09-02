import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);
const weights = (page) => page.evaluate(() => window.__BOOP_E2E__.expressionWeights());
const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());

async function openExpressions(page) {
  await page.locator('[data-task="expressions"]').click();
  await expect(page.locator('#expressions-panel[data-expressions-ready="true"]')).toBeVisible();
}

test('@critical presets are offered with the movements the project has and guide to Face Setup for the rest', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openExpressions(page);
  const cards = page.locator('[data-expression-preset-card]');
  await expect(cards).toHaveCount(7);
  const surprised = page.locator('[data-expression-preset-card="surprised"]');
  await expect(surprised).toHaveAttribute('data-preset-usable', 'true');
  await expect(surprised).toHaveAttribute('data-preset-missing', '1');
  await expect(surprised).toContainText('2 movements · 1 missing');
  const mutations = await page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
  await page.getByRole('button', { name: 'Add Surprised preset' }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '1');
  expect(await page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations)).toBe(mutations + 1);
  const document = await documentOf(page);
  expect(document.expressions[0]).toEqual({ id: 'surprised', name: 'Surprised', controls: { mouthOpen: 1, eyeOpen: 1 }, source: 'preset' });
  await expect.poll(() => effective(page, 'mouthOpen')).toBeCloseTo(1);
  await expect(page.locator('#expressions-panel [role="status"]')).toContainText('Eyebrows · Raise');
  const guidance = page.locator('[data-expression-guidance]');
  await expect(guidance).toContainText('Eyebrows · Raise');
  await expect(surprised.getByRole('button', { name: 'Select Surprised' })).toBeVisible();
  await guidance.getByRole('button', { name: 'Turn on in Face Setup' }).click();
  await expect.poll(() => task(page)).toBe('face-setup');
  await expect(page.locator('#face-movements[data-face-movements-ready="true"]')).toBeVisible();
  expect(await weights(page)).toEqual({});

  await openExpressions(page);
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'expression');
  await expect.poll(() => effective(page, 'mouthOpen')).toBeCloseTo(1);
  await page.locator('[data-task="preview"]').click();
  const section = page.locator('[data-preview-section="expressions"]');
  await expect(section.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
  await section.locator('[data-preview-expression="surprised"]').click();
  await expect.poll(() => effective(page, 'mouthOpen')).toBeCloseTo(1);
  await expect(section.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'false');
  await section.getByRole('button', { name: 'None' }).click();
  await expect.poll(() => weights(page)).toEqual({});
  await expect.poll(() => effective(page, 'mouthOpen')).toBe(0);
});

test('presets that match no movement stay disabled and explain why', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await openExpressions(page);
  await expect(page.locator('#expressions-panel')).toContainText('Turn on at least one movement');
  await expect(page.getByRole('button', { name: 'Add Happy preset' })).toBeDisabled();
  await expect(page.locator('[data-expression-preset-card="happy"]')).toHaveAttribute('data-preset-usable', 'false');
  await page.locator('[data-task="face-setup"]').click();
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await page.getByRole('button', { name: /Turn on all 10 available movements/ }).click();
  await openExpressions(page);
  await expect(page.getByRole('button', { name: 'Add Angry preset' })).toBeEnabled();
  await expect(page.locator('[data-expression-preset-card="angry"]')).toHaveAttribute('data-preset-missing', '0');
  await page.getByRole('button', { name: 'Add Angry preset' }).click();
  expect((await documentOf(page)).expressions[0].controls).toEqual({ smile: -.6, eyeOpen: .65, browRaise: -.8, browTilt: -.6 });
  await expect(page.locator('[data-expression-guidance]')).toHaveCount(0);
});
