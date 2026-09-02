import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';
import { openEditableProject, saveEditableProject, startNewProject } from './product-journey-helpers.js';

const checkpoint = (page) => page.evaluate(() => ({
  document: window.__BOOP_E2E__.document(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty(),
  mutations: window.__BOOP_E2E__.diagnostics().store.documentMutations
}));
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);
const weights = (page) => page.evaluate(() => window.__BOOP_E2E__.expressionWeights());

async function openExpressions(page) {
  await page.locator('[data-task="expressions"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
  await expect(page.locator('#expressions-panel[data-expressions-ready="true"]')).toBeVisible();
}

test('@critical user creates Happy from movements, previews its intensity and exports it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openExpressions(page);
  await expect(page.locator('[data-task="expressions"]')).toContainText('Expressions');
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '0');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'none');
  const before = await checkpoint(page);

  await page.getByLabel('New expression name').fill('Happy');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '1');
  const created = await checkpoint(page);
  expect(created.mutations - before.mutations).toBe(1);
  expect(created.document.expressions).toEqual([{ id: 'happy', name: 'Happy', controls: {}, source: 'manual' }]);
  expect(created.document.states).toEqual(before.document.states);
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'expression');
  await expect(page.getByRole('heading', { name: 'Expression Inspector', exact: true })).toBeVisible();
  await expect(page.locator('#expression-inspector')).toHaveAttribute('data-expression-id', 'happy');

  const smile = page.locator('[data-expression-control="smile"]');
  await smile.fill('1');
  await expect.poll(() => documentOf(page).then((d) => d.expressions[0].controls)).toEqual({ smile: 1 });
  await expect.poll(() => effective(page, 'smile')).toBeCloseTo(1);
  const shaped = await checkpoint(page);
  expect(shaped.mutations - created.mutations).toBe(1);
  await expect(page.locator('[data-expression-row="smile"]')).toHaveAttribute('data-set', 'true');

  await page.getByLabel('Test intensity', { exact: true }).fill('0.5');
  await expect.poll(() => effective(page, 'smile')).toBeCloseTo(.5);
  expect(await weights(page)).toEqual({ happy: .5 });
  expect((await checkpoint(page)).document).toEqual(shaped.document);

  await page.locator('[data-task="preview"]').click();
  await expect.poll(() => effective(page, 'smile')).toBe(0);
  expect(await weights(page)).toEqual({});
  const chip = page.locator('[data-preview-section="expressions"] [data-preview-expression="happy"]');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => effective(page, 'smile')).toBeCloseTo(1);
  await page.getByLabel('Expression intensity', { exact: true }).fill('0.25');
  await expect.poll(() => effective(page, 'smile')).toBeCloseTo(.25);
  expect((await checkpoint(page)).document).toEqual(shaped.document);
  await page.getByRole('button', { name: 'Reset mascot' }).click();
  await expect.poll(() => weights(page)).toEqual({});

  const rig = await page.evaluate(() => JSON.parse(window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(rig.expressions).toEqual([{ id: 'happy', name: 'Happy', controls: { smile: 1 }, source: 'manual' }]);
  expect(rig.schemaVersion).toBe(3);
  expect(Object.keys(rig.states)).toEqual(Object.keys(shaped.document.states));
});

test('@critical capture, rename, duplicate, delete, undo and save/open keep expressions consistent', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="preview"]').click();
  await page.locator('[data-preview-control="mouthOpen"]').fill('1');
  await expect.poll(() => effective(page, 'mouthOpen')).toBeCloseTo(1);
  await openExpressions(page);
  await page.getByLabel('New expression name').fill('Surprised');
  await page.getByRole('button', { name: 'Capture current face as expression' }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '1');
  let document = await documentOf(page);
  expect(document.expressions[0]).toEqual({ id: 'surprised', name: 'Surprised', controls: { mouthOpen: 1 }, source: 'capture' });
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().activeExpressionId)).toBe('surprised');
  await expect.poll(() => effective(page, 'mouthOpen')).toBeCloseTo(1);

  await page.getByLabel('Expression name', { exact: true }).fill('Wow');
  await page.getByLabel('Expression name', { exact: true }).dispatchEvent('change');
  await expect.poll(() => documentOf(page).then((d) => d.expressions[0].name)).toBe('Wow');
  expect((await documentOf(page)).expressions[0].id).toBe('surprised');
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '2');
  await expect(page.locator('#expression-inspector')).toHaveAttribute('data-expression-id', 'wow-copy');
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '1');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'none');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '2');
  document = await documentOf(page);
  expect(document.expressions.map((item) => item.id)).toEqual(['surprised', 'wow-copy']);

  const saved = await saveEditableProject(page);
  expect(saved.snapshot.document.editor.expressions).toEqual(document.expressions);
  await startNewProject(page);
  expect((await documentOf(page)).expressions).toEqual([]);
  await openEditableProject(page, saved.path);
  expect((await documentOf(page)).expressions).toEqual(document.expressions);
  await openExpressions(page);
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '2');
  await page.locator('[data-expression-select="surprised"]').click();
  await expect.poll(() => effective(page, 'mouthOpen')).toBeCloseTo(1);
});
