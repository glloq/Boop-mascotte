import { test, expect } from '@playwright/test';
import { openFreshEditor, openTask, startEmptyBasicFace } from './editor-helpers.js';
import { openEditableProject, saveEditableProject, startNewProject } from './product-journey-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);
const activeReaction = (page) => page.evaluate(() => window.__BOOP_E2E__.activeReaction());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const fastTiming = { attack: .1, hold: .6, release: .3 };
const surprise = (extra = {}) => ({ id: 'surprise', name: 'Surprise', enabled: true, trigger: { type: 'click' }, expression: { id: 'surprised', weight: 1 }, motion: null, gestures: [], timing: { attack: .2, hold: 1.2, release: .5 }, after: 'return', priority: 0, interrupt: 'replace', ...extra });

async function prepare(page) {
  await openFreshEditor(page, { e2e: true });
  await startEmptyBasicFace(page);
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
  await expect(page.locator('.workspace-tab[data-mode="behavior.reactions"]')).toContainText('Reactions');
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
  // The list is bucketed by when (V3-10), and the new reaction is in the one it
  // fires on rather than at the bottom of a flat list.
  await expect(page.locator('[data-runs-when-group="click"]')).toHaveAttribute('data-runs-when-count', '1');
  await expect(page.locator('[data-runs-when-group="click"] [data-reaction-select="surprise"]')).toHaveCount(1);
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
  expect(rig.schemaVersion).toBe(5);
  // Schema 5 carries a `requires` marker, and this mascot needs nothing beyond
  // what every runtime has: only `idle` and `gaze-follow` fill it in (V3-09).
  expect(rig.requires).toEqual([]);

  const saved = await saveEditableProject(page);
  expect(saved.snapshot.document.editor.reactions).toEqual(authored.reactions);
  // A different project, so opening the saved one has something to replace.
  // (The template ships the reaction catalogue, so "different" is not "empty".)
  await startNewProject(page);
  expect((await documentOf(page)).reactions).not.toEqual(authored.reactions);
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

test('the two whens V3-09 added: following the pointer, and acting when left alone', async ({ page }) => {
  await prepare(page);

  // "A mascot that follows the pointer with its eyes is three clicks and no
  // page code": open the group, press Add. It needs nothing of its own —
  // following *is* what it does — so it is usable in any project.
  await page.locator('[data-preset-group="Following the pointer"] > summary').click();
  const follow = page.locator('[data-reaction-preset-card="follow-eyes"]');
  await expect(follow).toHaveAttribute('data-preset-usable', 'true');
  await follow.getByRole('button', { name: 'Add Follow the pointer reaction' }).click();
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '1');
  expect((await documentOf(page)).reactions[0].trigger).toEqual({ type: 'gaze-follow' });
  await expect(page.locator('[data-runs-when-group="gaze"]')).toHaveAttribute('data-runs-when-count', '1');

  // And a reaction moves between whens from the list itself — the catalogue
  // could bucket a *new* reaction by when and never an existing one (V3-10).
  // "By itself" is an idle wait now, not a clock: it runs once the page has
  // been left alone that long, and starts over after anything at all.
  await page.getByLabel('New reaction name').fill('Yawn');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const yawn = (await documentOf(page)).reactions.find((item) => item.name === 'Yawn');
  await page.locator(`[data-reaction-when="${yawn.id}"]`).selectOption('idle');
  await expect.poll(async () => (await documentOf(page)).reactions.find((item) => item.id === yawn.id).trigger).toEqual({ type: 'idle', after: 8 });
  await expect(page.locator(`[data-reaction-select="${yawn.id}"]`)).toContainText('After 8 s alone');
  await expect(page.locator('[data-runs-when-group="idle"]')).toHaveAttribute('data-runs-when-count', '1');
  await expect(page.locator('[data-runs-when-group="click"]')).toHaveAttribute('data-runs-when-count', '0');

  // Both new whens are the one change in V3 an older runtime cannot safely
  // ignore, so the export names them instead of leaving a version number to be
  // guessed at.
  const rig = await page.evaluate(() => JSON.parse(window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(rig.requires).toEqual(['trigger:gaze-follow', 'trigger:idle']);
  expect(rig.schemaVersion).toBe(5);
});

test('a motion nothing runs can be selected to run, in a when', async ({ page }) => {
  await prepare(page);
  // Head Pop is authored and nothing plays it: an arrangement is editor-only,
  // so until V3-10 the only way out of Animate was to know a reaction could
  // wrap a clip, and to write one by hand.
  await expect(page.locator('[data-runs-when-motions]')).toHaveAttribute('data-runs-when-motions', '1');
  await page.locator('[data-motion-when="head-pop"]').selectOption('click');
  await page.locator('[data-motion-run="head-pop"]').click();
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '1');
  const reaction = (await documentOf(page)).reactions[0];
  expect(reaction.motion).toEqual({ clipId: 'head-pop' });
  expect(reaction.trigger).toEqual({ type: 'click' });
  await expect(page.locator('[data-runs-when-motions]')).toHaveCount(0);
});

test('reaction presets build a reaction out of what the project has, and route to what it lacks', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  // Cleared: a preset that routes an author to what it lacks needs a project
  // that lacks it, and the template ships every face this one wants.
  await startEmptyBasicFace(page);
  await openTask(page, 'reactions');
  const surpriseCard = page.locator('[data-reaction-preset-card="surprise"]');
  await expect(surpriseCard).toHaveAttribute('data-preset-usable', 'false');
  await expect(surpriseCard).toContainText('Needs a surprised expression');

  // "Make it" goes to where that thing is made; nothing is authored on the way.
  const before = await mutations(page);
  await surpriseCard.getByRole('button', { name: /Make what Surprise needs/ }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
  expect(await mutations(page)).toBe(before);

  await page.getByRole('button', { name: 'Add Surprised preset' }).click();
  await openTask(page, 'animate');
  await page.getByRole('button', { name: 'Add Head Pop motion' }).click();
  await page.locator('[data-motion-stop]').click();
  await openTask(page, 'reactions');

  await expect(surpriseCard).toHaveAttribute('data-preset-usable', 'true');
  await expect(surpriseCard).toHaveAttribute('data-preset-missing', '0');
  await surpriseCard.getByRole('button', { name: 'Add Surprise reaction' }).click();
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '1');
  const reaction = (await documentOf(page)).reactions[0];
  expect(reaction.name).toBe('Surprise');
  expect(reaction.trigger).toEqual({ type: 'click' });
  expect(reaction.expression.id).toBe('surprised');
  expect(reaction.motion).toEqual({ clipId: 'head-pop' });
  expect(reaction.timing).toEqual(fastTiming);
  // It is an ordinary reaction: selected, editable and testable like any other.
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'reaction');
  await page.locator('[data-reaction-test]').click();
  await expect.poll(() => activeReaction(page)).not.toBe(null);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '0');
});
