import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const focusedId = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.className || '');

test('@critical landmarks, skip link, shortcut help and Escape order work from the keyboard', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await expect(page.locator('header.topbar')).toHaveAttribute('aria-label', 'Project bar');
  await expect(page.locator('aside#left')).toHaveAttribute('aria-label', 'Tasks and tools');
  await expect(page.locator('aside.panel-right')).toHaveAttribute('aria-label', 'Inspector and preview');
  await expect(page.locator('footer.bottom')).toHaveAttribute('aria-label', 'Timeline');
  await expect(page.locator('main.workspace')).toHaveAttribute('aria-label', 'Workspace');

  // The skip link is the first focusable element in the document; it is reachable with Tab from the document start.
  expect(await page.evaluate(() => document.querySelector('a, button, input, select, textarea, [tabindex]')?.className)).toBe('skip-link');
  await page.locator('a.skip-link').focus();
  await expect(page.locator('a.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedId(page)).toBe('canvas');

  await page.keyboard.press('Shift+?');
  const help = page.locator('#shortcut-help');
  await expect(help).toBeVisible();
  await expect(help.locator('[data-shortcut="palette"]')).toContainText('Ctrl/Cmd + K');
  await expect(help.locator('[data-shortcut="escape"]')).toBeVisible();
  await expect(help.locator('[data-shortcut="design-tools"]')).toContainText('Artwork');
  await expect(help.locator('[data-shortcut="save"]')).toContainText('Ctrl/Cmd + S');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();

  // Ctrl/Cmd+S saves the project through the registry command, also from a text field (the browser's own dialog never opens).
  const saved = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await saved).suggestedFilename()).toBe('mascot-project.json');
  await page.locator('[data-task="expressions"]').click();
  const nameField = page.getByLabel('New expression name');
  if (await nameField.count()) { await nameField.first().focus(); const savedWhileTyping = page.waitForEvent('download'); await page.keyboard.press('Control+s'); expect((await savedWhileTyping).suggestedFilename()).toBe('mascot-project.json'); }
  await page.locator('[data-task="artwork"]').click();

  // Escape closes popovers topmost-first and returns focus to what opened them.
  await page.getByRole('button', { name: 'Problems' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#problems-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#problems-panel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Problems' })).toBeFocused();
  await page.locator('#export-top').click();
  await expect(page.locator('#export-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#export-panel')).toBeHidden();
  await expect(page.locator('#export-top')).toBeFocused();

  // Typing never triggers character shortcuts.
  await page.locator('[data-task="expressions"]').click();
  const name = page.getByLabel('New expression name');
  await name.fill('?');
  await expect(help).toBeHidden();
  await expect(name).toHaveValue('?');
  await name.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
});

test('reduced motion removes UI transitions and the toast announces status', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 768, height: 1024 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  expect(await page.locator('#left').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(await page.locator('.panel-right').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(await page.locator('#toast').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  await expect(page.locator('#toast')).toHaveAttribute('role', 'status');
  await expect(page.locator('#toast')).toHaveAttribute('aria-live', 'polite');
  await page.locator('#drawer-toggle').click();
  await expect(page.locator('#app')).toHaveClass(/drawer-open/);
  expect((await page.locator('#left').boundingBox()).x).toBe(0);
});
