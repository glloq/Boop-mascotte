import { expect } from '@playwright/test';
import {
  goToPreview,
  openFreshEditor,
  openGazeControl,
  openProjectMenu,
  readSvgTranslation,
  selectLayerById,
  setRangeControl,
  startBasicFace
} from './editor-helpers.js';

// Product-language facade over the current UI. UX-02 should replace only this
// adapter when its information architecture changes; journey specs stay stable.
export async function openBoop(page) {
  await openFreshEditor(page, { e2e: true });
}

export function monitorUnexpectedErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`${error.message}\n${error.stack || ''}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

export async function createBasicMascot(page) {
  await startBasicFace(page);
  const document = await projectDocument(page);
  expect(document.svgMarkup).toContain('<svg');
  expect(Object.keys(document.semanticParts)).toEqual(expect.arrayContaining(['head', 'eyes', 'gaze', 'mouth']));
  expect(document.semanticParts.gaze.controls).toContain('lookX');
}

export async function testHorizontalGaze(page, value) {
  const control = await openGazeControl(page);
  await setRangeControl(control, value);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.effectiveParams().lookX)).toBeCloseTo(value);
  return readSvgTranslation(page.locator('#pupilLeft'));
}

export async function testMascot(page) {
  await goToPreview(page);
  await expect(page.getByRole('heading', { name: 'Preview', exact: true })).toBeVisible();
}

export const projectDocument = page => page.evaluate(() => window.__BOOP_E2E__.document());
export const editorSession = page => page.evaluate(() => window.__BOOP_E2E__.session());
export const ownershipCheckpoint = page => page.evaluate(() => ({
  document: window.__BOOP_E2E__.document(),
  session: window.__BOOP_E2E__.session(),
  versionToken: window.__BOOP_E2E__.documentVersionToken(),
  revisions: window.__BOOP_E2E__.documentRevisions(),
  history: window.__BOOP_E2E__.history(),
  dirty: window.__BOOP_E2E__.dirty()
}));

export async function inspectExportReadiness(page) {
  await page.getByRole('button', { name: 'Problems' }).click();
  await expect(page.locator('#problems-panel')).toBeVisible();
  return page.evaluate(() => window.__BOOP_E2E__.readiness());
}

export async function exportStandaloneMascot(page) {
  const closeProblems = page.getByRole('button', { name: 'Close Problems' });
  if (await closeProblems.isVisible()) await closeProblems.click();
  await page.getByRole('button', { name: /^Export(?:\s|$)/ }).click();
  const names = ['mascot.svg', 'rig.json', 'runtime.js'];
  const downloads = [];
  for (const name of names) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${name}` }).click();
    downloads.push(await pending);
  }
  expect(downloads.map(download => download.suggestedFilename()).sort()).toEqual([...names].sort());
  return downloads;
}

export async function recoverMissingArtworkWithBasicMascot(page) {
  const diagnostic = page.locator('[data-diagnostic-id="artwork.missing"]');
  await expect(diagnostic).toHaveCount(1);
  await diagnostic.getByRole('button', { name: 'Fix', exact: true }).click();
  await startBasicFace(page);
}

export async function importArtwork(page) {
  const home=page.locator('[data-home]');
  await expect(home).toBeVisible();
  await expect(home.locator('label').filter({hasText:'Import SVG'})).toBeVisible();
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-head.svg');
  await expect(home).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('artwork');
  await expect(page.locator('#canvas svg svg #journeyHead')).toBeVisible();
}

export async function assignImportedArtworkAsHead(page) {
  // UX-05: the Face Setup checklist assigns artwork by direct Canvas picking;
  // no part catalog, IDs or bindings vocabulary are needed for the basic face.
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('#face-setup-checklist[data-face-setup-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Assign Head' }).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-role-picking/);
  await page.locator('#journeyHead').click();
  await expect.poll(() => projectDocument(page).then(document => document.semanticParts.head?.roles.head)).toBe('journeyHead');
  await expect(page.locator('[data-face-role="head"]')).toHaveAttribute('data-face-role-status', 'assigned');
}

export async function renameAuthoredHead(page, name) {
  await selectLayerById(page, 'head');
  await page.getByLabel('Layer display name').fill(name);
  await page.getByLabel('Layer display name').dispatchEvent('change');
  await expect.poll(() => projectDocument(page).then(document => document.layerMetadata.head?.name)).toBe(name);
}

export async function saveEditableProject(page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Project' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('mascot-project.json');
  const source = Buffer.concat(await (await download.createReadStream()).toArray()).toString();
  return { download, path: await download.path(), snapshot: JSON.parse(source) };
}

export async function startNewProject(page) {
  await openProjectMenu(page);
  await page.getByRole('button', { name: 'New Project' }).click();
  await expect(page.locator('[data-home]')).toBeVisible();
  await page.locator('[data-home] [data-template-id="talking"]').click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
}

export async function openEditableProject(page, path) {
  await page.locator('#project-file').setInputFiles(path);
  await expect(page.locator('#canvas svg svg')).toBeVisible();
}
