import { test, expect } from '@playwright/test';
import { importArtworkFixture, openSetupSection, openFreshEditor, startEmptyBasicFace } from './editor-helpers.js';

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
  // Cleared: the template ships every face in this catalogue, and this is the
  // journey of adding one.
  await startEmptyBasicFace(page);
  await openExpressions(page);
  const cards = page.locator('[data-expression-preset-card]');
  // The catalogue is large and shown a group at a time; Everyday opens first.
  expect(await cards.count()).toBeGreaterThanOrEqual(24);
  await expect(page.locator('[data-preset-catalogue="expressions"] .preset-group')).toHaveCount(5);
  await expect(page.locator('[data-preset-group="Everyday"]')).toHaveAttribute('open', '');
  const surprised = page.locator('[data-expression-preset-card="surprised"]');
  await expect(surprised).toHaveAttribute('data-preset-usable', 'true');
  await expect(surprised).toHaveAttribute('data-preset-missing', '0');
  // Thirteen: the five on the face, and the pair of hands the template ships
  // going up with it — four movements each, because a hand made of drawings is
  // brought out, moved, and *chosen* (`docs/HAND_STYLES.md`).
  await expect(surprised).toContainText('13 movements');
  const mutations = await page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
  await page.getByRole('button', { name: 'Add Surprised preset' }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '1');
  expect(await page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations)).toBe(mutations + 1);
  const document = await documentOf(page);
  expect(document.expressions[0]).toEqual({ id: 'surprised', name: 'Surprised', source: 'preset',
    // `handLSpread` is not a weight any more: the open hand is one of the
    // drawings the pair ships with, so the preset asks for it by index
    // (`docs/HAND_STYLES.md`).
    controls: { handLShow: 1, handLX: -.35, handLY: -1, handLStyle: 1, handRShow: 1, handRX: .35, handRY: -1, handRStyle: 1, mouthOpen: 1, jawOpen: .5, eyeOpen: 1, pupilScale: 1.35, browRaise: 1 } });
  await expect.poll(() => effective(page, 'mouthOpen')).toBeCloseTo(1);
  await expect(page.locator('#expressions-panel [role="status"]')).toContainText('13 movements');
  await expect(page.locator('[data-expression-guidance]')).toHaveCount(0, 'nothing missing, nothing to fix');
  await expect(surprised.getByRole('button', { name: 'Select Surprised' })).toBeVisible();

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
  await importArtworkFixture(page, 'product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await openExpressions(page);
  await expect(page.locator('#expressions-panel')).toContainText('Turn on at least one movement');
  await expect(page.getByRole('button', { name: 'Add Happy preset' })).toBeDisabled();
  await expect(page.locator('[data-expression-preset-card="happy"]')).toHaveAttribute('data-preset-usable', 'false');
  await page.locator('[data-task="face-setup"]').click();
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await openSetupSection(page, 'movements');
  await page.getByRole('button', { name: /Turn on all \d+ available movements/ }).click();
  await openExpressions(page);
  await expect(page.getByRole('button', { name: 'Add Happy preset' })).toBeEnabled();
  await expect(page.locator('[data-expression-preset-card="happy"]')).toHaveAttribute('data-preset-missing', '0');
  await page.getByRole('button', { name: 'Add Happy preset' }).click();
  expect((await documentOf(page)).expressions[0].controls).toEqual({ smile: 1, eyeOpen: .9, browRaise: .25 });
  await expect(page.locator('[data-expression-guidance]')).toHaveCount(0);
  // And one that wants more than a drawing has: Angry draws its brows with
  // `browInner`, which is the control rig's, so it degrades and says so.
  await expect(page.locator('[data-expression-preset-card="angry"]')).toHaveAttribute('data-preset-missing', '1');
  await expect(page.locator('[data-expression-preset-card="angry"]')).toContainText('1 missing');
});
