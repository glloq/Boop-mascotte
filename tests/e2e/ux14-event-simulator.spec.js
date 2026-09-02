import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const activeReaction = (page) => page.evaluate(() => window.__BOOP_E2E__.activeReaction());
const eventLog = (page) => page.evaluate(() => window.__BOOP_E2E__.eventLog());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const latest = async (page) => (await eventLog(page))[0];

async function openTask(page, task) { await page.locator(`[data-task="${task}"]`).click(); await expect(page.locator('#app')).toHaveAttribute('data-workspace', task); }
async function prepare(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openTask(page, 'expressions');
  await page.getByRole('button', { name: 'Add Surprised preset' }).click();
  await openTask(page, 'reactions');
  await expect(page.locator('#reactions-panel[data-reactions-ready="true"]')).toBeVisible();
  await page.getByLabel('New reaction name').fill('Surprise');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#reaction-inspector')).toHaveAttribute('data-reaction-id', 'surprise');
  await page.locator('[data-reaction-timing]').selectOption('fast');
  await expect.poll(async () => (await documentOf(page)).reactions[0].timing.hold).toBe(.6);
}

test('@critical the event simulator fires, blocks and logs events without writing to the project', async ({ page }) => {
  await prepare(page);
  await page.locator('.reaction-advanced summary').click();
  await page.locator('[data-reaction-interrupt]').selectOption('ignore');
  await expect.poll(async () => (await documentOf(page)).reactions[0].interrupt).toBe('ignore');
  const authored = await documentOf(page), before = await mutations(page);

  await openTask(page, 'preview');
  const section = page.locator('[data-preview-section="reactions"]');
  await expect(section.locator('[data-log-empty]')).toBeVisible();
  await section.locator('[data-preview-event="hover"]').click();
  expect(await latest(page)).toMatchObject({ type: 'hover', outcome: 'no-listener', reactionId: null });
  await expect(section.locator('[data-preview-event-log] li').first()).toContainText('hover → no reaction listens');
  expect(await activeReaction(page)).toBe(null);

  await section.locator('[data-preview-event="click"]').click();
  expect(await latest(page)).toMatchObject({ type: 'click', outcome: 'fired', reactionId: 'surprise', reactionName: 'Surprise' });
  await expect.poll(() => activeReaction(page).then((item) => item?.id)).toBe('surprise');
  await section.locator('[data-preview-event="click"]').click();
  expect(await latest(page)).toMatchObject({ type: 'click', outcome: 'blocked', blockedBy: 'surprise' });
  await expect(section.locator('[data-preview-event-log] li').first()).toContainText('click → blocked by surprise');
  await expect.poll(() => activeReaction(page), { timeout: 4000 }).toBe(null);

  await section.locator('[data-preview-event-name]').fill('wave');
  await section.locator('[data-preview-event-form] button[type="submit"]').click();
  expect(await latest(page)).toMatchObject({ type: 'custom', name: 'wave', outcome: 'no-listener' });
  await expect(section.locator('[data-preview-event-log] li').first()).toContainText('"wave" → no reaction listens');
  expect((await eventLog(page)).length).toBe(4);
  expect(await documentOf(page)).toEqual(authored);
  expect(await mutations(page)).toBe(before);

  await section.locator('[data-preview-log-clear]').click();
  expect(await eventLog(page)).toEqual([]);
  await expect(section.locator('[data-log-empty]')).toBeVisible();
  await section.locator('[data-preview-reaction="surprise"]').click();
  expect(await latest(page)).toMatchObject({ type: 'test', outcome: 'fired', reactionId: 'surprise' });
  await page.getByRole('button', { name: 'Reset mascot' }).click();
  expect(await eventLog(page)).toEqual([]);
  expect(await activeReaction(page)).toBe(null);
});

test('hover from the canvas, timer reactions and the enable switch', async ({ page }) => {
  await prepare(page);
  await page.locator('[data-reaction-trigger]').selectOption('hover');
  await expect.poll(async () => (await documentOf(page)).reactions[0].trigger).toEqual({ type: 'hover' });
  await openTask(page, 'preview');
  await page.mouse.move(5, 5);
  await page.locator('#canvas').hover();
  await expect.poll(() => activeReaction(page).then((item) => item?.id)).toBe('surprise');
  expect(await latest(page)).toMatchObject({ type: 'hover', outcome: 'fired' });
  await expect.poll(() => activeReaction(page), { timeout: 4000 }).toBe(null);

  await openTask(page, 'reactions');
  await page.locator('[data-reaction-trigger]').selectOption('timer');
  await page.locator('[data-reaction-interval]').fill('0.5');
  await page.locator('[data-reaction-interval]').dispatchEvent('change');
  await expect.poll(async () => (await documentOf(page)).reactions[0].trigger).toEqual({ type: 'timer', interval: .5 });
  await expect(page.locator('[data-reaction-select="surprise"]')).toContainText('Every 0.5 s');
  await openTask(page, 'preview');
  await expect.poll(() => activeReaction(page).then((item) => item?.id), { timeout: 4000 }).toBe('surprise');
  await expect.poll(() => eventLog(page).then((log) => log.some((entry) => entry.type === 'timer' && entry.outcome === 'fired'))).toBe(true);
  await page.getByRole('button', { name: 'Reset mascot' }).click();

  await openTask(page, 'reactions');
  const before = await mutations(page);
  await page.locator('[data-reaction-toggle="surprise"]').uncheck();
  await expect.poll(async () => (await documentOf(page)).reactions[0].enabled).toBe(false);
  expect(await mutations(page)).toBe(before + 1);
  await expect(page.locator('[data-reaction-select="surprise"]')).toContainText('off');
  await openTask(page, 'preview');
  await expect(page.locator('[data-preview-reaction="surprise"]')).toBeDisabled();
  await page.locator('[data-preview-section="reactions"] [data-preview-event="click"]').click();
  expect(await latest(page)).toMatchObject({ type: 'click', outcome: 'no-listener' });
  await page.waitForTimeout(1200);
  expect(await activeReaction(page)).toBe(null);
  expect((await eventLog(page)).some((entry) => entry.type === 'timer')).toBe(false);
});
