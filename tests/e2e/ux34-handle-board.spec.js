import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * The control board (docs/DIRECT_CONTROLS.md).
 *
 * The handles were a hard-coded list: good defaults and nothing an author
 * could change. They are records now — named, limited, locked, coloured,
 * hidden, or made from scratch on any artwork and any movement — and the board
 * is where the whole rig is visible at once.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const params = (page) => page.evaluate(() => window.__BOOP_E2E__.effectiveParams());
const handle = (page, id) => page.locator(`[data-puppet-handle="${id}"]`);

async function openBoard(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="face-setup"]').click();
  await openSetupSection(page, 'handles');
  await expect(page.locator('[data-handle-board]')).toBeVisible();
}

async function dragHandle(page, id, dx, dy) {
  const box = await handle(page, id).boundingBox();
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test('@critical the board lists every control, and a limit is a limit', async ({ page }) => {
  await openBoard(page);
  // Every handle the mascot carries, members under the pair they belong to.
  await expect(page.locator('[data-handle-card="mouth"]')).toBeVisible();
  await expect(page.locator('[data-handle-card="eyeLeft"]')).toHaveCount(1);
  expect(Number(await page.locator('[data-handle-board]').getAttribute('data-handle-count'))).toBeGreaterThan(10);
  // Nothing is stored until something is changed: the defaults stay defaults,
  // so a project saved today still gets tomorrow's better ones.
  expect((await documentOf(page)).rigHandles).toEqual([]);

  const card = page.locator('[data-handle-card="mouth"]');
  await card.locator('summary').click();
  const max = card.locator('[data-handle-field="max"][data-handle-axis="y"]');
  await max.fill('0.4');
  await max.press('Enter');
  await expect.poll(async () => (await documentOf(page)).rigHandles).toEqual([{ id: 'mouth', axes: { y: { max: 0.4 } } }]);

  // And the drag stops where the author said, however far the pointer goes.
  await dragHandle(page, 'mouth', 0, 400);
  expect((await params(page)).mouthOpen).toBe(0.4);

  // A locked axis is not reached at all.
  await card.locator('[data-handle-action="lock"][data-handle-axis="x"]').click();
  const before = (await params(page)).smile;
  await dragHandle(page, 'mouth', 120, 0);
  expect((await params(page)).smile).toBe(before);
});

test('a control can be renamed, hidden, brought back, and reset', async ({ page }) => {
  await openBoard(page);
  const card = page.locator('[data-handle-card="nose"]');
  await card.locator('summary').click();
  await card.locator('[data-handle-field="name"]').fill('Snout');
  await card.locator('[data-handle-field="name"]').press('Enter');
  await expect(handle(page, 'nose')).toHaveAttribute('aria-label', /^Snout\./);

  await page.locator('[data-handle-card="nose"] [data-handle-action="hide"]').click();
  await expect(handle(page, 'nose')).toHaveCount(0);
  // Hidden is not lost: it stays on the board with a way back.
  await expect(page.locator('[data-handle-hidden="nose"]')).toBeVisible();
  await page.locator('[data-handle-hidden="nose"] [data-handle-action="show"]').click();
  await expect(handle(page, 'nose')).toHaveCount(1);

  await page.locator('[data-handle-card="nose"] [data-handle-action="reset"]').click();
  await expect.poll(async () => (await documentOf(page)).rigHandles).toEqual([]);
  await expect(handle(page, 'nose')).toHaveAttribute('aria-label', /^Nose\./);
});

test('@critical a control of your own, on any artwork and any movement', async ({ page }) => {
  await openBoard(page);
  await page.locator('[data-handle-action="new"]').click();
  const form = page.locator('[data-handle-new]');
  await form.locator('[data-handle-draft="name"]').fill('Fringe swing');
  await form.locator('[data-handle-draft="element"]').selectOption('hairTop');
  await form.locator('[data-handle-draft="x"]').selectOption('hairSway');
  await page.locator('[data-handle-action="create"]').click();

  await expect(handle(page, 'fringe-swing')).toBeVisible();
  await expect(page.locator('[data-handle-card="fringe-swing"]')).toBeVisible();
  await dragHandle(page, 'fringe-swing', 40, 0);
  expect((await params(page)).hairSway).toBeGreaterThan(0);

  // It is part of the project, so it survives being saved and opened again.
  const stored = (await documentOf(page)).rigHandles;
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ id: 'fringe-swing', authored: true, elements: ['hairTop'] });
});
