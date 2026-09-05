import { test, expect } from '@playwright/test';
import { openAdvanced, openFreshEditor, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const effective = (page, name) => page.evaluate((key) => window.__BOOP_E2E__.effectiveParams()[key], name);

async function openTask(page, task) {
  await page.locator(`[data-task="${task}"]`).click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', task === 'face-setup' ? 'rig' : task);
}

test('@critical the expression cross-fade can be set, and switching no longer snaps', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openTask(page, 'expressions');

  // The control only means something once there is an expression to switch to.
  await expect(page.locator('[data-expression-blend]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Happy preset' }).click();
  const blend = page.locator('[data-expression-blend]');
  await expect(blend).toHaveAttribute('data-blend-duration', '0');
  await expect(blend).toContainText('instant');

  await blend.locator('summary').click();
  await blend.locator('[data-expression-blend-duration]').fill('200');
  await blend.locator('[data-expression-blend-duration]').dispatchEvent('change');
  await expect(blend).toHaveAttribute('data-blend-duration', '200');
  expect((await documentOf(page)).expressionBlend).toEqual({ duration: 200, easing: 'easeInOut' });

  await blend.locator('[data-expression-blend-easing]').selectOption('easeOut');
  expect((await documentOf(page)).expressionBlend).toEqual({ duration: 200, easing: 'easeOut' });

  await page.keyboard.press('Control+z');
  expect((await documentOf(page)).expressionBlend).toEqual({ duration: 200, easing: 'easeInOut' });
});

test('a live control can be typed, not only dragged', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openTask(page, 'preview');

  const field = page.locator('[data-preview-output="lookX"]');
  await expect(field).toHaveAttribute('type', 'number');
  await field.fill('0.35');
  await expect.poll(() => effective(page, 'lookX')).toBeCloseTo(.35);
  // The slider is the other end of the same control and follows along.
  await expect(page.locator('[data-preview-control="lookX"]')).toHaveValue('0.35');

  // Out-of-range typing is clamped to the parameter, never written past it.
  await field.fill('9');
  await expect.poll(() => effective(page, 'lookX')).toBe(1);
});

test('the deformation systems a project carries are listed instead of invisible', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAdvanced(page);
  await page.locator('[data-open-advanced]').click();
  const panel = page.locator('#advanced-panel');
  await panel.locator('[data-advanced-tool="deformation"]').click();

  const detail = panel.locator('[data-advanced-detail="deformation"]');
  await expect(detail).toBeVisible();
  await expect(detail.locator('[data-deformation-row]')).toHaveCount(6);
  await expect(detail.locator('[data-deformation-row="shapeKeys"]')).toContainText('No editor yet');
  await expect(detail.locator('[data-deformation-row="keyforms"]')).toContainText('Head pose');
});

test('@critical the motion cross-fade is authored, and playing one motion hands over from the other', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openTask(page, 'animate');

  await page.getByRole('button', { name: 'Add Nod motion' }).click();
  await page.locator('[data-motion-stop]').click();
  const blend = page.locator('[data-motion-blend]');
  await expect(blend).toHaveAttribute('data-blend-duration', '0');
  await expect(blend).toContainText('instant');

  await blend.locator('summary').click();
  await blend.locator('[data-motion-blend-duration]').fill('300');
  await blend.locator('[data-motion-blend-duration]').dispatchEvent('change');
  await expect(blend).toHaveAttribute('data-blend-duration', '300');
  expect((await documentOf(page)).motionBlend).toEqual({ duration: 300, easing: 'easeInOut' });

  // Two motions, played back to back from Preview: both are on screen at once
  // partway through the hand-over, which is the whole point.
  await page.getByRole('button', { name: 'Add Shake motion' }).click();
  await page.locator('[data-motion-stop]').click();
  await openTask(page, 'preview');
  await page.locator('[data-preview-clip="nod"]').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.motionWeights()).length)).toBe(1);
  await page.locator('[data-preview-clip="shake"]').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.motionWeights()).sort().join(','))).toBe('nod,shake');
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.motionWeights()))).toEqual(['shake']);
});
