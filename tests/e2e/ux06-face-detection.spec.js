import { test, expect } from '@playwright/test';
import { openFreshEditor } from './editor-helpers.js';

const checkpoint = (page) => page.evaluate(() => ({
  document: window.__BOOP_E2E__.document(), token: window.__BOOP_E2E__.documentVersionToken(), revisions: window.__BOOP_E2E__.documentRevisions(),
  history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty(), mutations: window.__BOOP_E2E__.diagnostics().store.documentMutations
}));
const faceSetup = (page) => page.evaluate(() => window.__BOOP_E2E__.faceSetup());
const row = (page, id) => page.locator(`[data-face-role="${id}"]`);

async function importAndOpen(page, fixture, lastId) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles(`tests/e2e/fixtures/${fixture}`);
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect(page.locator(`#canvas svg svg #${lastId}`)).toBeVisible();
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('#face-setup-checklist[data-face-setup-ready="true"]')).toBeVisible();
}

test('@critical named artwork is suggested for every basic role and accepted as one undoable batch', async ({ page }) => {
  await importAndOpen(page, 'product-face.svg', 'journeyMouth');
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-suggested', '8');
  const detection = await faceSetup(page);
  expect(detection.acceptable).toHaveLength(8);
  expect(detection.suggestions.leftEye).toMatchObject({ elementId: 'journeyEyeL', confidence: 'high' });
  expect(detection.suggestions.rightPupil).toMatchObject({ elementId: 'journeyPupilR', confidence: 'high' });
  await expect(row(page, 'head')).toContainText('Suggested: JourneyHead');
  await expect(row(page, 'head')).toHaveAttribute('data-face-role-status', 'missing');
  const before = await checkpoint(page);
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-assigned', '8');
  const after = await checkpoint(page);
  expect(after.mutations - before.mutations).toBe(1);
  expect(after.history.canUndo).toBe(true);
  expect(Object.keys(after.document.semanticParts)).toEqual(['head', 'eyes', 'gaze', 'eyebrows', 'mouth']);
  expect(after.document.semanticParts.eyebrows.roles).toEqual({ leftBrow: 'journeyBrowL', rightBrow: 'journeyBrowR' });
  expect(await page.evaluate(() => window.__BOOP_E2E__.session())).toMatchObject({ activeSemanticPartId: 'head', selectedId: 'journeyHead' });
  await expect(page.locator('#face-setup-checklist [role="status"]')).toContainText('8 face parts assigned from suggestions');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().semanticParts)).toEqual({});
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-assigned', '0');
  await expect(page.getByRole('button', { name: 'Accept 8 suggestions' })).toBeVisible();
  expect(await checkpoint(page)).toMatchObject({ document: before.document });
});

test('@critical a single suggestion can be accepted or reviewed on the canvas without authoring', async ({ page }) => {
  await importAndOpen(page, 'product-face.svg', 'journeyMouth');
  await row(page, 'leftEye').hover();
  await expect(page.locator('#journeyEyeL[data-face-suggested]')).toHaveCount(1);
  await page.locator('#face-setup-checklist .face-progress').hover();
  await expect(page.locator('#journeyEyeL[data-face-suggested]')).toHaveCount(0);
  const before = await checkpoint(page);
  await page.getByRole('button', { name: 'Accept JourneyEyeL as Left eye' }).click();
  await expect(row(page, 'leftEye')).toHaveAttribute('data-face-role-status', 'assigned');
  const after = await checkpoint(page);
  expect(after.mutations - before.mutations).toBe(1);
  expect(after.document.semanticParts.eyes.roles).toEqual({ leftEye: 'journeyEyeL' });
  await expect(page.getByRole('button', { name: 'Accept 7 suggestions' })).toBeVisible();
  await page.getByRole('button', { name: 'Assign Right eye', exact: true }).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-role-picking/);
  await expect(page.locator('#journeyEyeR[data-face-suggested]')).toHaveCount(1);
  await expect(row(page, 'rightEye')).toContainText('highlighted: JourneyEyeR');
  await page.keyboard.press('Escape');
  await expect(page.locator('#canvas')).not.toHaveClass(/rig-role-picking/);
  // The pointer still rests on the suggested row, which keeps its hover preview; leaving it clears the Canvas.
  await page.locator('#face-setup-checklist .face-progress').hover();
  await expect(page.locator('[data-face-suggested]')).toHaveCount(0);
  expect(await checkpoint(page)).toEqual(after);
});

test('unnamed artwork only suggests the containing head and leaves the rest to canvas picking', async ({ page }) => {
  await importAndOpen(page, 'product-face-plain.svg', 's8');
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-suggested', '1');
  const detection = await faceSetup(page);
  expect(Object.keys(detection.suggestions)).toEqual(['head']);
  expect(detection.suggestions.head).toMatchObject({ elementId: 's1', confidence: 'medium' });
  await expect(row(page, 'leftEye').getByRole('button', { name: /Accept/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Accept 1 suggestion' }).click();
  await expect(row(page, 'head')).toHaveAttribute('data-face-role-status', 'assigned');
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().semanticParts.head.roles)).toEqual({ head: 's1' });
  await expect(page.getByRole('button', { name: 'Assign next: Left eye' })).toBeVisible();
});
