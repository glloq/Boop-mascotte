import { test, expect } from '@playwright/test';
import { openFreshEditor } from './editor-helpers.js';

test('@critical Artwork consolidates import, Layers and contextual editing', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-head.svg');
  await expect(page.locator('[data-task="artwork"]')).toContainText('Artwork');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'create');
  await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible();
  await expect(page.getByText('Import / Replace SVG', { exact: true })).toBeVisible();
  const before=await page.evaluate(()=>({document:window.__BOOP_E2E__.document(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  const item=page.getByRole('treeitem', { name: /journeyHead/ });
  await item.focus(); await item.press('Enter');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-id','journeyHead');
  await expect(page.getByRole('heading',{name:'Transform'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Appearance'})).toBeVisible();
  const after=await page.evaluate(()=>({document:window.__BOOP_E2E__.document(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  expect(after).toEqual(before);
});
