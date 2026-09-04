import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The four stages of the journey (VNX-06, docs/VNEXT_ROADMAP.md).
 *
 * Six sibling tabs asked the author to know the editor's vocabulary before
 * they knew what they wanted to do. The stages name the journey instead --
 * make the mascot, make it move, decide when it moves, ship it -- and the tabs
 * become the steps inside one of them.
 *
 * The rule the whole design turns on: a stage is a shortcut into a group, never
 * a gate in front of one. Every task stays one click away from anywhere.
 */

const stage = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);

test('@critical the four stages are the navigation, and each lands on its own work', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await expect(page.locator('.stage-tab')).toHaveCount(4);
  for (const [id, label] of [['create', 'Create'], ['animate', 'Animate'], ['behaviors', 'Behaviors'], ['publish', 'Publish']]) {
    await expect(stage(page, id)).toHaveText(label);
  }

  // A stage is derived from the task, never stored beside it: opening a task
  // by any other route lights its stage up too.
  await expect(page.locator('#app')).toHaveAttribute('data-stage', 'create');
  await expect(stage(page, 'create')).toHaveAttribute('aria-pressed', 'true');

  await stage(page, 'animate').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
  await expect(page.locator('#app')).toHaveAttribute('data-stage', 'animate');
  await expect(stage(page, 'create')).toHaveAttribute('aria-pressed', 'false');

  await stage(page, 'behaviors').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'reactions');
  await stage(page, 'publish').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'preview');

  // And a task tab reached directly still moves the stage with it.
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-stage', 'create');
});

test('@critical a stage never hides a task, and re-entering it keeps the step already open', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  // The whole risk of a two-level navigation is that the second level starts
  // hiding things. Every task stays visible and clickable from every stage.
  await stage(page, 'publish').click();
  for (const task of ['artwork', 'face-setup', 'expressions', 'animate', 'reactions', 'preview']) {
    await expect(page.locator(`[data-task="${task}"]`), `${task} is unreachable from Publish`).toBeVisible();
  }

  // Create holds two steps. Opening the second one and coming back must not
  // throw the author back to the first.
  await page.locator('[data-task="face-setup"]').click();
  await stage(page, 'publish').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'preview');
  await stage(page, 'create').click();
  await expect(page.locator('#app'), 'Create returned to Artwork instead of the step that was open').toHaveAttribute('data-workspace', 'rig');
});

test('a stage says how ready its steps are, and navigating it writes nothing', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const before = await page.evaluate(() => ({
    revision: window.__BOOP_E2E__.documentRevisions().persistent,
    history: window.__BOOP_E2E__.history(),
    diagnostics: window.__BOOP_E2E__.diagnostics()
  }));

  // A stage is as ready as its least ready step, and says so in its own
  // accessible name rather than inside a task tab -- a tab's whole textContent
  // is rewritten on every validation pass.
  await expect(stage(page, 'create')).toHaveAttribute('data-readiness', /error|todo|warning|ready/);
  await expect(stage(page, 'create')).toHaveAttribute('aria-label', /^Create stage/);

  for (const id of ['animate', 'behaviors', 'publish', 'create']) await stage(page, id).click();

  const after = await page.evaluate(() => ({
    revision: window.__BOOP_E2E__.documentRevisions().persistent,
    history: window.__BOOP_E2E__.history(),
    diagnostics: window.__BOOP_E2E__.diagnostics()
  }));
  expect(after.revision, 'moving between stages changed the project').toBe(before.revision);
  expect(after.history, 'moving between stages pushed undo history').toEqual(before.history);
  expect(after.diagnostics.autosave?.writes ?? 0).toBe(before.diagnostics.autosave?.writes ?? 0);
});
