import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const diagnostics = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics());
const TASKS = ['artwork', 'face-setup', 'expressions', 'animate', 'reactions', 'preview'];

async function growProject(page) {
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => {
    const nod = { headY: [{ time: 0, value: 0, easing: 'linear' }, { time: .4, value: .5, easing: 'easeInOut' }, { time: .8, value: 0, easing: 'easeInOut' }] };
    state.expressions = Array.from({ length: 60 }, (_, index) => ({ id: `face-${index}`, name: `Face ${index}`, controls: { smile: (index % 10) / 10, mouthOpen: (index % 4) / 4 }, source: 'manual' }));
    state.animationClips = [...state.animationClips, ...Array.from({ length: 30 }, (_, index) => ({ id: `move-${index}`, name: `Move ${index}`, duration: .8, loop: false, tracks: structuredClone(nod), motion: { preset: 'nod', amplitude: .5, repeats: 1, controls: { headY: 'headY' } } }))];
    state.reactions = Array.from({ length: 40 }, (_, index) => ({ id: `react-${index}`, name: `React ${index}`, enabled: true, trigger: index % 3 === 0 ? { type: 'click' } : { type: 'custom', name: `event-${index}` }, expression: { id: `face-${index}`, weight: 1 }, motion: { clipId: `move-${index % 30}` }, timing: { attack: .1, hold: .6, release: .3 }, after: 'return', priority: index % 5, interrupt: 'replace' }));
    for (let index = 0; index < 20; index++) state.states[`pose-${index}`] = { ...state.states.idle, smile: (index % 5) / 5 };
  }));
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '60');
}

test('@stability a long project (60 expressions, 33 motions, 40 reactions, 23 states) keeps the budgets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await growProject(page);
  await page.evaluate(() => window.__BOOP_E2E__.taskReadiness());
  // Let the debounced validation pass scheduled by the mutation settle before measuring.
  await page.waitForTimeout(400);
  const before = await diagnostics(page);
  const revision = await page.evaluate(() => window.__BOOP_E2E__.documentRevisions().persistent);

  // Switching every task ten times: no document writes, no extra validation runs, no history.
  const history = await page.evaluate(() => window.__BOOP_E2E__.history());
  for (let round = 0; round < 10; round++) for (const task of TASKS) await page.locator(`[data-task="${task}"]`).click();
  const after = await diagnostics(page);
  expect(after.store.documentMutations).toBe(before.store.documentMutations);
  expect(after.validation.runs).toBe(before.validation.runs);
  expect(await page.evaluate(() => window.__BOOP_E2E__.documentRevisions().persistent)).toBe(revision);
  expect(await page.evaluate(() => window.__BOOP_E2E__.history())).toEqual(history);

  // Readiness is derived once per document revision.
  const runsBefore = (await diagnostics(page)).validation.runs;
  await page.evaluate(() => { for (let i = 0; i < 50; i++) window.__BOOP_E2E__.taskReadiness(); });
  expect((await diagnostics(page)).validation.runs).toBe(runsBefore);

  // Export of the long project stays fast and complete.
  const exportMs = await page.evaluate(() => { const started = performance.now(); const artifacts = window.__BOOP_E2E__.exportArtifacts(); const rig = JSON.parse(artifacts.find((item) => item.name === 'rig.json').content); return { ms: performance.now() - started, reactions: rig.reactions.length, animations: rig.animations.length, expressions: rig.expressions.length }; });
  expect(exportMs).toMatchObject({ reactions: 40, animations: 35, expressions: 60 });
  expect(exportMs.ms).toBeLessThan(1500);

  // Preview: one loop, reactions return, nothing keeps the loop alive afterwards.
  await page.locator('[data-task="preview"]').click();
  await page.locator('[data-preview-section="reactions"] [data-preview-event="click"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.activeReaction()?.id)).toMatch(/^react-/);
  expect((await diagnostics(page)).preview.activeRaf).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.activeReaction()), { timeout: 5000 }).toBe(null);
  await expect.poll(() => diagnostics(page).then((d) => d.preview.activeRaf)).toBe(0);

  // Palette search over the long project stays responsive.
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-palette')).toBeVisible();
  const started = Date.now();
  await page.keyboard.type('face 5');
  await expect(page.locator('[data-palette-result="expression:face-5"]')).toBeVisible();
  expect(Date.now() - started).toBeLessThan(2000);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
