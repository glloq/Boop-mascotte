import { test, expect } from '@playwright/test';

function monitorErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test('@smoke editor loads from the Pages base and reloads cleanly', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Create your mascot' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start from Sample' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('@smoke sample, preview and project download work', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Start from Sample' }).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await expect(page.getByText(/Layers \(\d+\)/)).toBeVisible();
  await page.getByRole('button', { name: /Preview/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Project' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('mascot-project.json');
  expect(JSON.parse(await (await download.createReadStream()).toArray().then((parts) => Buffer.concat(parts).toString()))).toMatchObject({ schemaVersion: expect.any(Number), document: { svgMarkup: expect.stringContaining('<svg') } });
  expect(errors).toEqual([]);
});

test('SVG import sanitizes executable content and remains editable', async ({ page }) => {
  await page.goto('./');
  await page.locator('#empty-svg').setInputFiles('tests/e2e/fixtures/unsafe.svg');
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await expect(page.locator('#canvas script, #canvas foreignObject')).toHaveCount(0);
  await expect(page.locator('#canvas [onload], #canvas [onclick], #canvas [href^="javascript:"]')).toHaveCount(0);
  await page.getByRole('button', { name: /unsafe/ }).click();
  await expect(page.getByRole('heading', { name: 'Inspector' })).toBeVisible();
});

test('@smoke runtime demo uses the real engine', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./demo/');
  await expect(page.getByRole('heading', { name: 'Runtime demo' })).toBeVisible();
  await page.getByLabel('lookX').fill('0.8');
  await expect(page.locator('#demo-eye')).toHaveAttribute('transform', /translate/);
  expect(errors).toEqual([]);
});
