import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, problemsButton, startBasicFace } from './editor-helpers.js';

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
  // Every topbar control has a keyboard route; the reset is the newest one.
  await expect(help.locator('[data-shortcut="reset-mascot"]')).toContainText('Ctrl/Cmd + Alt + R');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();

  // Ctrl/Cmd+S saves the project through the registry command, also from a text field (the browser's own dialog never opens).
  const saved = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await saved).suggestedFilename()).toBe('mascot-project.json');
  await goToMode(page, 'animate.expressions');
  const nameField = page.getByLabel('New expression name');
  if (await nameField.count()) { await nameField.first().focus(); const savedWhileTyping = page.waitForEvent('download'); await page.keyboard.press('Control+s'); expect((await savedWhileTyping).suggestedFilename()).toBe('mascot-project.json'); }
  // The mascot back to rest from the keyboard, with the project bar's own name
  // on the control that does it. Out of the text field first: a character
  // shortcut belongs to the field while one has the keyboard.
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect(page.getByRole('button', { name: 'Reset mascot' })).toBeVisible();
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('lookX', .7));
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.effectiveParams().lookX)).toBeCloseTo(.7);
  await page.keyboard.press('Control+Alt+r');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.effectiveParams().lookX)).toBe(0);
  await goToMode(page, 'design.artwork');

  // Escape closes popovers topmost-first and returns focus to what opened them.
  await problemsButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#problems-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#problems-panel')).toBeHidden();
  await expect(problemsButton(page)).toBeFocused();
  await page.locator('#export-top').click();
  await expect(page.locator('#export-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#export-panel')).toBeHidden();
  await expect(page.locator('#export-top')).toBeFocused();

  // Typing never triggers character shortcuts.
  await goToMode(page, 'animate.expressions');
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

/**
 * The status line is announced (`role="status"`, `aria-live="polite"`), which
 * makes what it holds a matter of whether anyone gets to read it.
 */
test('@critical a message an author was told is not wiped by the readiness pass', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const toast = page.locator('#toast');

  // The validation pass runs 150 ms after every edit and ends by writing
  // "Project ready • …". Anything a panel had just said used to disappear
  // behind it a sixth of a second later, which is not long enough to read.
  await goToMode(page, 'animate.motions');
  await page.locator('[data-motion-preset-card="nod"] [data-motion-preset]').click();
  await expect(toast).toContainText('added');
  await page.waitForTimeout(600);
  await expect(toast, 'the readiness pass overwrote it').toContainText('added');

  // It is a hold, not a lock. Once the message has had its time the line is
  // free again, and the next edit's routine status lands on it.
  await page.waitForTimeout(2700);
  await page.locator('#motion-inspector [data-motion-loop]').check();
  await expect.poll(async () => toast.textContent(), { timeout: 6000 }).toContain('Project ready');
});

/**
 * UIR-15 — the navigation is walked with the arrow keys.
 *
 * Nine buttons stand between the project title and the canvas. Tab still
 * reaches every one of them, exactly as it did; this is the faster way along a
 * row, and the way between the two rows, which the two-level navigation had no
 * answer for at all.
 */
test('@critical the arrow keys walk the workspaces and their screens, and Tab still reaches every tab', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // A screen tab carries its workspace too, so the mode is asked for first.
  const focused = () => page.evaluate(() => document.activeElement?.dataset?.mode || document.activeElement?.dataset?.stage || '');

  await page.locator('.stage-tab[data-stage="design"]').focus();
  await page.keyboard.press('ArrowRight');
  expect(await focused()).toBe('rig');
  await page.keyboard.press('End');
  expect(await focused()).toBe('behavior');
  await page.keyboard.press('ArrowRight');
  expect(await focused(), 'the row is a ring').toBe('design');
  await page.keyboard.press('Home');
  expect(await focused()).toBe('design');

  // Down goes into the screens of the workspace that is open, and up comes back.
  await page.locator('.stage-tab[data-stage="rig"]').click();
  await page.locator('.stage-tab[data-stage="rig"]').focus();
  await page.keyboard.press('ArrowDown');
  expect(await focused()).toBe('rig.assign');
  await page.keyboard.press('ArrowRight');
  expect(await focused()).toBe('rig.controls');
  await page.keyboard.press('ArrowUp');
  expect(await focused()).toBe('rig');

  // The ring is what the eye sees: the open workspace's screens and Preview,
  // never the tabs of a workspace that is folded away.
  await page.locator('.workspace-tab[data-mode="rig.deform"]').focus();
  await page.keyboard.press('ArrowRight');
  expect(await focused(), 'Preview sits at the end of the row').toBe('preview');
  await page.keyboard.press('ArrowRight');
  expect(await focused()).toBe('rig.assign');

  // Moving the focus is not going there: a screen opens when it is pressed.
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'rig.assign');
  await page.locator('.workspace-tab[data-mode="rig.head2d"]').focus();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'rig.assign');
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'rig.head2d');

  // And Tab is untouched: every tab is still its own stop, in document order.
  await page.locator('.stage-tab[data-stage="rig"]').focus();
  await page.keyboard.press('Tab');
  expect(await focused()).toBe('rig.assign');
});
