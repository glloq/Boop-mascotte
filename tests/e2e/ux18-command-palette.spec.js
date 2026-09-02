import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());
const session = (page) => page.evaluate(() => window.__BOOP_E2E__.session());
const palette = (page) => page.evaluate(() => window.__BOOP_E2E__.palette());

async function openPalette(page) {
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-palette')).toBeVisible();
  await expect(page.locator('#command-palette [data-palette-input]')).toBeFocused();
}

test('@critical the command palette searches actions and items, runs them through commands and refuses unsafe ones', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="expressions"]').click();
  await page.getByRole('button', { name: 'Add Happy preset' }).click();
  await page.locator('[data-task="animate"]').click();
  await page.getByRole('button', { name: 'Add Nod motion' }).click();
  await page.locator('[data-motion-stop]').click();
  await page.locator('[data-task="artwork"]').click();

  await openPalette(page);
  await page.keyboard.type('happy');
  const happy = page.locator('[data-palette-result="expression:happy"]');
  await expect(happy).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('#command-palette')).toBeHidden();
  await expect.poll(() => task(page)).toBe('expressions');
  await expect.poll(() => session(page).then((item) => item.activeExpressionId)).toBe('happy');
  await expect(page.locator('#expression-inspector')).toHaveAttribute('data-expression-id', 'happy');

  await openPalette(page);
  expect((await palette(page)).query).toBe('', 'the query is not remembered between openings');
  await page.keyboard.type('nod');
  await page.locator('[data-palette-result="motion:nod"]').click();
  await expect.poll(() => task(page)).toBe('animate');
  await expect.poll(() => session(page).then((item) => item.animationEditor.activeClipId)).toBe('nod');
  await expect(page.locator('#motion-inspector')).toHaveAttribute('data-motion-id', 'nod');

  await openPalette(page);
  await page.keyboard.type('go to');
  const options = page.locator('#command-palette [data-palette-result]');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#command-palette')).toBeHidden();

  await openPalette(page);
  await page.keyboard.type('preview');
  await expect(page.locator('[data-palette-result="go:preview"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect.poll(() => task(page)).toBe('preview');

  await openPalette(page);
  await page.keyboard.type('export');
  await expect(page.locator('[data-palette-result="action:export"]')).toHaveAttribute('data-palette-enabled', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('#export-panel')).toBeVisible();
  await expect(page.locator('#export-panel')).toHaveAttribute('data-export-state', 'ready');
  await page.locator('[data-close-export]').click();

  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { state.transitions.idle = [...(state.transitions.idle || []), 'nope']; }));
  await openPalette(page);
  await page.keyboard.type('export');
  const blocked = page.locator('[data-palette-result="action:export"]');
  await expect(blocked).toHaveAttribute('data-palette-enabled', 'false');
  await expect(blocked).toContainText('blocked');
  await page.keyboard.press('Enter');
  await expect(page.locator('#command-palette')).toBeVisible();
  await expect(page.locator('[data-palette-hint]')).toContainText('blocked');
  await expect(page.locator('#export-panel')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#command-palette')).toBeHidden();

  await page.locator('#search-button').click();
  await expect(page.locator('#command-palette')).toBeVisible();
  await page.keyboard.type('undo');
  await expect(page.locator('[data-palette-result="action:undo"]')).toContainText('Ctrl+Z');
  await page.keyboard.press('Escape');
});
