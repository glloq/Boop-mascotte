import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const checkpoint = (page) => page.evaluate(() => ({
  document: window.__BOOP_E2E__.document(), token: window.__BOOP_E2E__.documentVersionToken(), revisions: window.__BOOP_E2E__.documentRevisions(),
  history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty(), mutations: window.__BOOP_E2E__.diagnostics().store.documentMutations
}));
const role = (page, part, name) => page.evaluate(([p, r]) => window.__BOOP_E2E__.document().semanticParts[p]?.roles?.[r] ?? null, [part, name]);

async function importFace(page) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-face.svg');
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
}
async function openFaceSetup(page) {
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('[data-task="face-setup"]')).toContainText('Face Setup');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'rig');
  await expect(page.locator('#face-setup-checklist[data-face-setup-ready="true"]')).toBeVisible();
}
const row = (page, id) => page.locator(`[data-face-role="${id}"]`);

test('@critical user assigns the eight basic face parts by clicking the canvas', async ({ page }) => {
  await importFace(page);
  await openFaceSetup(page);
  const list = page.getByRole('list', { name: 'Face parts checklist' });
  await expect(list.getByRole('listitem')).toHaveCount(8);
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-assigned', '0');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'none');
  const before = await checkpoint(page);
  await page.getByRole('button', { name: 'Assign next: Head' }).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-role-picking/);
  await expect(page.locator('.canvas-mode-banner')).toBeVisible();
  await expect(page.locator('.canvas-mode-banner')).toContainText('Click the head');
  expect(await checkpoint(page)).toEqual(before);

  const order = [
    ['journeyHead', 'head', 'head'], ['journeyEyeL', 'eyes', 'leftEye'], ['journeyEyeR', 'eyes', 'rightEye'],
    ['journeyPupilL', 'gaze', 'leftPupil'], ['journeyPupilR', 'gaze', 'rightPupil'],
    ['journeyBrowL', 'eyebrows', 'leftBrow'], ['journeyBrowR', 'eyebrows', 'rightBrow'], ['journeyMouth', 'mouth', 'mouth']
  ];
  for (const [elementId, part, name] of order) {
    await expect(row(page, name)).toHaveAttribute('data-face-role-status', 'picking');
    const { mutations } = await checkpoint(page);
    await page.locator(`#${elementId}`).click();
    await expect.poll(() => role(page, part, name)).toBe(elementId);
    await expect(row(page, name)).toHaveAttribute('data-face-role-status', 'assigned');
    expect((await checkpoint(page)).mutations - mutations).toBe(1);
  }
  await expect(page.locator('#canvas')).not.toHaveClass(/rig-role-picking/);
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-assigned', '8');
  await expect(page.getByRole('button', { name: 'Configure movements' })).toBeVisible();
  const document = await page.evaluate(() => window.__BOOP_E2E__.document());
  expect(Object.keys(document.semanticParts)).toEqual(['head', 'eyes', 'gaze', 'eyebrows', 'mouth']);
  expect(document.semanticParts.eyes.roles).toEqual({ leftEye: 'journeyEyeL', rightEye: 'journeyEyeR' });
  expect(document.semanticParts.gaze.roles).toEqual({ leftPupil: 'journeyPupilL', rightPupil: 'journeyPupilR' });
  const session = await page.evaluate(() => window.__BOOP_E2E__.session());
  expect(session).toMatchObject({ workspace: 'rig', activeSemanticPartId: 'mouth', selectedId: 'journeyMouth' });
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-part');
  await expect(page.getByRole('heading', { name: 'Face Part Inspector', exact: true })).toBeVisible();
  expect((await checkpoint(page)).history.canUndo).toBe(true);
});

test('@critical duplicate artwork is refused, Escape cancels without authoring, and one Undo removes the created part', async ({ page }) => {
  await importFace(page);
  await openFaceSetup(page);
  await page.getByRole('button', { name: 'Assign Head' }).click();
  await page.locator('#journeyHead').click();
  await expect.poll(() => role(page, 'head', 'head')).toBe('journeyHead');
  const assigned = await checkpoint(page);
  await expect(row(page, 'leftEye')).toHaveAttribute('data-face-role-status', 'picking');
  await page.locator('#journeyHead').click();
  await expect(page.locator('#face-setup-checklist [role="status"]')).toContainText('already the Head');
  await expect(page.locator('#canvas')).toHaveClass(/rig-role-picking/);
  expect(await checkpoint(page)).toEqual(assigned);
  await page.keyboard.press('Escape');
  await expect(page.locator('#canvas')).not.toHaveClass(/rig-role-picking/);
  await expect(page.locator('.canvas-mode-banner')).toBeHidden();
  await expect(row(page, 'leftEye')).toHaveAttribute('data-face-role-status', 'missing');
  expect(await checkpoint(page)).toEqual(assigned);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().semanticParts)).toEqual({});
  await expect(row(page, 'head')).toHaveAttribute('data-face-role-status', 'missing');
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-assigned', '0');
});

test('template projects show their checklist and artwork can be chosen from layers as a fallback', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openFaceSetup(page);
  // The one template ships every basic part assigned, so there is no next one
  // to assign: the checklist opens complete.
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-assigned', '8');
  await expect(page.getByRole('button', { name: /^Assign next/ })).toHaveCount(0);
  await expect(row(page, 'head')).toContainText('Face');
  await page.getByRole('button', { name: 'Replace Head' }).click();
  await expect(row(page, 'head')).toHaveAttribute('data-face-role-status', 'picking');
  await page.getByLabel('Or choose from layers').selectOption('head');
  await expect.poll(() => role(page, 'head', 'head')).toBe('head');
  await expect(row(page, 'head')).toContainText('Head shape');
  // Every role is assigned in this template, so the fallback is exercised by
  // replacing one rather than by finding an empty next role.
  await page.getByRole('button', { name: 'Replace Left eyebrow' }).click();
  await expect(row(page, 'leftBrow')).toHaveAttribute('data-face-role-status', 'picking');
  await page.getByRole('button', { name: 'Cancel (Esc)' }).first().click();
  await expect(page.locator('#canvas')).not.toHaveClass(/rig-role-picking/);
  await row(page, 'leftPupil').locator('[data-face-role-select]').click();
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-id', 'gaze');
  expect(await page.evaluate(() => window.__BOOP_E2E__.session().selectedId)).toBe('pupilLeft');
});
