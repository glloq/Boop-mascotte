import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);

async function openTask(page, task) {
  await page.locator(`[data-task="${task}"]`).click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', task === 'face-setup' ? 'rig' : task);
}

test('@critical one press fills an empty mascot with faces, motions, reactions and life', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openTask(page, 'expressions');

  // The offer is the same in all three studios, so it is met wherever an
  // author lands first.
  const card = page.locator('#expressions-panel [data-starter-kit]');
  await expect(card).toContainText('One press');
  await expect(page.locator('#motion-panel [data-starter-kit]')).toHaveCount(1);
  await expect(page.locator('#reactions-panel [data-starter-kit]')).toHaveCount(1);

  const before = await mutations(page), templateClips = (await documentOf(page)).animationClips.length;
  await card.getByRole('button', { name: 'Add the starter kit' }).click();

  // One command: one document mutation, one undo step, four domains.
  expect(await mutations(page)).toBe(before + 1);
  const built = await documentOf(page);
  expect(built.expressions.map((item) => item.id)).toEqual(['happy', 'sad', 'surprised', 'angry', 'curious', 'excited', 'sleepy', 'confused']);
  // The template ships its own clip; the kit adds its motions after it.
  expect(built.animationClips.slice(templateClips).map((item) => item.motion.preset)).toEqual(['nod', 'shake', 'bounce', 'tilt', 'blink', 'look-around']);
  expect(built.reactions.map((item) => item.id)).toEqual(['surprise', 'greet', 'notice', 'glance']);
  expect(built.behaviors.some((item) => item.type === 'blink' && item.enabled)).toBe(true);
  // Every reaction points at something this same press created.
  for (const reaction of built.reactions) expect(built.expressions.some((item) => item.id === reaction.expression?.id) || built.animationClips.some((item) => item.id === reaction.motion?.clipId)).toBe(true);

  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '8');
  // The template already runs its automatic life, so the kit only adds the rest.
  await expect(page.locator('#expressions-panel [role="status"]')).toContainText('8 faces, 6 motions and 4 reactions');
  // Nothing left to add: the offer takes itself off the panels.
  await expect(page.locator('[data-starter-kit]')).toHaveCount(0);

  await page.keyboard.press('Control+z');
  const undone = await documentOf(page);
  expect([undone.expressions.length, undone.animationClips.length, undone.reactions.length]).toEqual([0, templateClips, 0]);
  await expect(page.locator('#expressions-panel [data-starter-kit]')).toHaveCount(1);
});

test('the catalogues are grouped, and a group opens to reveal the rest', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openTask(page, 'expressions');

  const groups = page.locator('[data-preset-catalogue="expressions"] .preset-group');
  await expect(groups).toHaveCount(5);
  await expect(groups.first()).toHaveAttribute('open', '');
  // A card in a closed group is present but out of the way until it is opened.
  const laughing = page.locator('[data-expression-preset-card="laughing"]');
  await expect(laughing).toHaveCount(1);
  await expect(laughing).not.toBeVisible();
  await page.locator('[data-preset-group="Playful"] > summary').click();
  await expect(laughing).toBeVisible();
  await laughing.getByRole('button', { name: 'Add Laughing preset' }).click();
  expect((await documentOf(page)).expressions.map((item) => item.id)).toEqual(['laughing']);

  await openTask(page, 'reactions');
  const triggers = page.locator('[data-preset-catalogue="reactions"] .preset-group');
  await expect(triggers).toHaveCount(4);
  await expect(triggers.first()).toContainText('When clicked');
});
