import { test, expect } from '@playwright/test';
import { goToPreview, selectFirstSemanticPart, startBasicFace } from './editor-helpers.js';

function monitorErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('@pages deployed editor loads its assets and a starter project', async ({ page }) => {
  const errors = monitorErrors(page);
  const failedResponses = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('./');
  const home = page.locator('[data-home]');
  await expect(home).toBeVisible();
  await expect(home.getByRole('heading', { name: 'New Mascot' })).toBeVisible();
  await expect(home.locator('[data-template-id="basic"]')).toBeVisible();
  await expect(home.getByText('Open Project', { exact: true })).toBeVisible();
  await startBasicFace(page);
  await expect(page.locator('#canvas svg svg')).toBeVisible();

  expect(failedResponses).toEqual([]);
  expect(errors).toEqual([]);
});

test('@pages deployed editor previews and exports the user project', async ({ page }) => {
  const errors = monitorErrors(page);
  const exportDownloads = [];

  await page.goto('./');
  await startBasicFace(page);
  await selectFirstSemanticPart(page);
  await goToPreview(page);
  const projectDownload=page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Project' }).click();
  expect((await projectDownload).suggestedFilename()).toBe('mascot-project.json');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  for (const name of ['mascot.svg', 'rig.json', 'runtime.js']) {
    const next=page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${name}` }).click();
    exportDownloads.push(await next);
  }
  expect(exportDownloads.map((download) => download.suggestedFilename()).sort()).toEqual(['mascot.svg','rig.json','runtime.js']);

  expect(errors).toEqual([]);
});

test('@pages deployed runtime demo executes the exported engine', async ({ page }) => {
  const errors = monitorErrors(page);

  await page.goto('./demo/');
  await expect(page.getByRole('heading', { name: 'Runtime demo' })).toBeVisible();
  await page.getByLabel('lookX').fill('0.8');
  await expect(page.locator('#demo-eye')).toHaveAttribute('transform', /translate/);

  expect(errors).toEqual([]);
});
