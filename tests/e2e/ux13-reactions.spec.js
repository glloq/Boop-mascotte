import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';
import { openEditableProject, saveEditableProject, startNewProject } from './product-journey-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);
const activeReaction = (page) => page.evaluate(() => window.__BOOP_E2E__.activeReaction());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const fastTiming = { attack: .1, hold: .6, release: .3 };
const surprise = (extra = {}) => ({ id: 'surprise', name: 'Surprise', enabled: true, trigger: { type: 'click' }, expression: { id: 'surprised', weight: 1 }, motion: null, timing: { attack: .2, hold: 1.2, release: .5 }, after: 'return', priority: 0, interrupt: 'replace', ...extra });

async function openTask(page, task) { await page.locator(`[data-task="${task}"]`).click(); await expect(page.locator('#app')).toHaveAttribute('data-workspace', task === 'face-setup' ? 'rig' : task); }
async function prepare(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openTask(page, 'expressions');
  await page.getByRole('button', { name: 'Add Surprised preset' }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '1');
  await openTask(page, 'animate');
  await page.getByRole('button', { name: 'Add Head Pop motion' }).click();
  await page.locator('[data-motion-stop]').click();
  await openTask(page, 'reactions');
  await expect(page.locator('#reactions-panel[data-reactions-ready="true"]')).toBeVisible();
}

test('@critical Click → Surprised: author a reaction, test it, click the mascot in Preview and export it', async ({ page }) => {
  await prepare(page);
  await expect(page.locator('[data-task="reactions"]')).toContainText('Reactions');
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '0');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'none');
  const before = await mutations(page);
  await page.getByLabel('New reaction name').fill('Surprise');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '1');
  expect(await mutations(page)).toBe(before + 1);
  expect((await documentOf(page)).reactions).toEqual([surprise()]);
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'reaction');
  await expect(page.getByRole('heading', { name: 'Reaction Inspector', exact: true })).toBeVisible();
  await expect(page.locator('#reaction-inspector')).toHaveAttribute('data-reaction-id', 'surprise');

  await page.locator('[data-reaction-motion]').selectOption('head-pop');
  await expect.poll(async () => (await documentOf(page)).reactions[0].motion).toEqual({ clipId: 'head-pop' });
  await page.locator('[data-reaction-timing]').selectOption('fast');
  await expect.poll(async () => (await documentOf(page)).reactions[0].timing).toEqual(fastTiming);
  await expect(page.locator('[data-reaction-select="surprise"]')).toContainText('When clicked → Surprised → Head Pop');
  const authored = await documentOf(page);
  expect(await mutations(page)).toBe(before + 3);

  await page.locator('[data-reaction-test]').click();
  await expect.poll(() => activeReaction(page).then((item) => item?.id)).toBe('surprise');
  await expect.poll(() => effective(page, 'mouthOpen'), { timeout: 3000 }).toBeCloseTo(1, 1);
  await expect.poll(() => activeReaction(page), { timeout: 4000 }).toBe(null);
  await expect.poll(() => effective(page, 'mouthOpen')).toBe(0);
  expect(await documentOf(page)).toEqual(authored);
  expect(await mutations(page)).toBe(before + 3);

  await openTask(page, 'preview');
  const chip = page.locator('[data-preview-section="reactions"] [data-preview-reaction="surprise"]');
  await expect(chip).toContainText('Surprise');
  // The canvas keeps an interaction layer above the artwork; the click bubbles to the canvas like a user's would.
  await page.locator('#canvas svg svg').click({ force: true });
  await expect.poll(() => activeReaction(page).then((item) => item?.id)).toBe('surprise');
  await expect.poll(() => effective(page, 'mouthOpen'), { timeout: 3000 }).toBeCloseTo(1, 1);
  await expect.poll(() => activeReaction(page), { timeout: 4000 }).toBe(null);
  await chip.click();
  await expect.poll(() => activeReaction(page).then((item) => item?.id)).toBe('surprise');
  await page.getByRole('button', { name: 'Reset mascot' }).click();
  await expect.poll(() => activeReaction(page)).toBe(null);
  expect(await documentOf(page)).toEqual(authored);

  const rig = await page.evaluate(() => JSON.parse(window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(rig.reactions).toEqual([surprise({ motion: { clipId: 'head-pop' }, timing: fastTiming })]);
  expect(rig.animations.find((clip) => clip.id === 'head-pop')).toEqual({ id: 'head-pop', name: 'Head Pop', duration: .6, loop: false, tracks: authored.animationClips.find((clip) => clip.id === 'head-pop').tracks });
  expect(rig.schemaVersion).toBe(3);

  const saved = await saveEditableProject(page);
  expect(saved.snapshot.document.editor.reactions).toEqual(authored.reactions);
  await startNewProject(page);
  expect((await documentOf(page)).reactions).toEqual([]);
  await openEditableProject(page, saved.path);
  expect((await documentOf(page)).reactions).toEqual(authored.reactions);
});

test('a reaction whose expression disappears becomes a warning with guidance, and undo clears it', async ({ page }) => {
  await prepare(page);
  await page.getByLabel('New reaction name').fill('Surprise');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '1');
  await expect(page.locator('[data-reaction-guidance]')).toHaveCount(0);
  await openTask(page, 'expressions');
  await expect(page.locator('#expression-inspector')).toHaveAttribute('data-expression-id', 'surprised');
  await page.locator('[data-expression-delete]').click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '0');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.taskReadiness().reactions.status)).toBe('warning');
  await openTask(page, 'reactions');
  await expect(page.locator('#reaction-inspector')).toHaveAttribute('data-reaction-id', 'surprise');
  await expect(page.locator('[data-reaction-guidance]')).toContainText('no longer exists');
  await expect(page.locator('[data-reaction-select="surprise"]')).toHaveAttribute('data-reaction-issue', 'true');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-reaction-guidance]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.taskReadiness().reactions.status)).toBe('ready');
  await page.locator('[data-reaction-trigger]').selectOption('custom');
  await expect.poll(async () => (await documentOf(page)).reactions[0].trigger).toEqual({ type: 'custom', name: 'custom' });
  await page.locator('[data-reaction-event]').fill('wave');
  await page.locator('[data-reaction-event]').dispatchEvent('change');
  await expect.poll(async () => (await documentOf(page)).reactions[0].trigger).toEqual({ type: 'custom', name: 'wave' });
  expect(await page.evaluate(() => window.__BOOP_E2E__.triggerReaction({ type: 'click' }))).toBe(null);
  expect(await page.evaluate(() => window.__BOOP_E2E__.triggerReaction({ type: 'custom', name: 'wave' }))).toBe('surprise');
});
