import { test, expect } from '@playwright/test';

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
  await expect(page.getByRole('heading', { name: 'Create your mascot' })).toBeVisible();
  await page.getByRole('button', { name: 'Start from Sample' }).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();

  expect(failedResponses).toEqual([]);
  expect(errors).toEqual([]);
});

test('@pages deployed editor previews and exports the user project', async ({ page }) => {
  const errors = monitorErrors(page);
  const downloads = [];
  page.on('download', (download) => downloads.push(download));

  await page.goto('./');
  await page.getByRole('button', { name: 'Start from Sample' }).click();
  await page.getByRole('button', { name: /Preview/ }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect.poll(() => downloads.map((download) => download.suggestedFilename()).sort()).toEqual([
    'mascot.svg',
    'rig.json',
    'runtime.js'
  ]);

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
