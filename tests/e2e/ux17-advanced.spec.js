import { test, expect } from '@playwright/test';
import { openAdvanced, openFreshEditor, startBasicFace } from './editor-helpers.js';

const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());
const session = (page) => page.evaluate(() => window.__BOOP_E2E__.session());
const tools = (page) => page.evaluate(() => window.__BOOP_E2E__.advancedTools());

async function openHub(page) {
  await openAdvanced(page);
  await page.locator('[data-open-advanced]').click();
  await expect(page.locator('#advanced-panel')).toBeVisible();
}

test('@critical Advanced stays collapsed, then routes to every expert surface without losing any of them', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await expect(page.locator('#advanced-panel')).toBeHidden();
  await expect(page.locator('details.file-menu')).not.toHaveAttribute('open', '');
  await openHub(page);
  const panel = page.locator('#advanced-panel');
  await expect(panel.locator('[data-advanced-tool-card]')).toHaveCount(7);
  expect((await tools(page)).filter((tool) => tool.available).map((tool) => tool.id)).toEqual(['diagnostics', 'plugins']);
  await expect(panel.locator('[data-advanced-tool="timeline"]')).toBeDisabled();
  await expect(panel.locator('[data-advanced-tool-card="timeline"]')).toContainText('Add artwork first');
  await panel.locator('[data-advanced-tool="diagnostics"]').click();
  await expect(panel.locator('[data-advanced-detail="diagnostics"]')).toBeVisible();
  await expect(panel.locator('[data-diagnostics-count="errors"]')).not.toHaveText('0');
  await expect(panel.locator('[data-diagnostics-counter="store.documentMutations"]')).toBeVisible();
  await panel.locator('[data-close-advanced]').click();
  await expect(panel).toBeHidden();

  await startBasicFace(page);
  await openHub(page);
  expect((await tools(page)).every((tool) => tool.available)).toBe(true);
  await panel.locator('[data-advanced-tool="parameters"]').click();
  await expect(panel.locator('[data-advanced-detail="parameters"]')).toBeVisible();
  await expect(panel.locator('[data-advanced-parameter="lookX"]')).toContainText('-1 → 1');
  await panel.locator('[data-advanced-tool="timeline"]').click();
  await expect(panel).toBeHidden();
  await expect.poll(() => task(page)).toBe('animate');
  await expect(page.locator('#app')).not.toHaveClass(/timeline-collapsed/);
  await expect(page.locator('#timeline-panel .timeline-shell')).toBeVisible();

  await openHub(page);
  await panel.locator('[data-advanced-tool="state-machine"]').click();
  await expect.poll(() => session(page).then((item) => item.authorMode)).toBe('states');
  await expect(page.locator('#state-editor')).toContainText('STATE is a persistent pose');
  await openHub(page);
  await panel.locator('[data-advanced-tool="behaviors"]').click();
  await expect.poll(() => session(page).then((item) => item.authorMode)).toBe('behaviors');
  await expect(page.locator('#state-editor')).toContainText('BEHAVIOR is automatic');

  await openHub(page);
  await panel.locator('[data-advanced-tool="bindings"]').click();
  await expect.poll(() => task(page)).toBe('artwork');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'artwork');
  await expect(page.getByRole('heading', { name: 'Transform' })).toBeVisible();

  await openHub(page);
  await panel.locator('[data-advanced-tool="plugins"]').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('details.file-menu')).toHaveAttribute('open', '');
  await expect(page.locator('#plugin-path')).toBeVisible();
  await expect(page.locator('#plugin-path')).toBeChecked();
});
