import { test, expect } from '@playwright/test';
import { goToMode, importArtworkFixture, openFreshEditor, openTask, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const statusOf = (page, id) => page.evaluate((presetId) => window.__BOOP_E2E__.automatic().presets.find((item) => item.id === presetId).status, id);

// Automatic behaviours answer "when does the mascot do this on its own?", so
// they are in Behavior (VNX-09) -- and on a screen of their own since UIR-01,
// rather than found by scrolling past the reactions.
async function openAnimate(page) {
  await goToMode(page, 'behavior.automatic');
  await expect(page.locator('#automatic-panel[data-automatic-ready="true"]')).toBeVisible();
}

test('@critical Blink, Natural gaze and Idle head movement turn ordinary behaviors off and on, testable and exported', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);
  // The template ships its life running: a mascot that arrives frozen reads as
  // broken.
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  await expect(page.locator('[data-automatic-card="natural-gaze"]')).toHaveAttribute('data-automatic-status', 'on');
  await expect(page.locator('[data-automatic-card="idle-head"]')).toHaveAttribute('data-automatic-status', 'on');
  await expect(page.locator('[data-automatic-card="hand-drift"]')).toHaveAttribute('data-automatic-status', 'off');
  // Breathing and Tiny body bounce used to sit here reading *unavailable* to
  // every project alive: both were an oscillator on `bodyBounce`, a movement no
  // part of the editor defines. V3-10 took them out — a card that can never be
  // switched on is the one thing this surface must not contain — and every card
  // that is left can be.
  await expect(page.locator('[data-automatic-card="breathing"]')).toHaveCount(0);
  await expect(page.locator('[data-automatic-card="body-bounce"]')).toHaveCount(0);
  await expect(page.locator('#automatic-panel [data-automatic-status="unavailable"]')).toHaveCount(0);
  await expect(page.locator('#automatic-panel')).toHaveAttribute('data-automatic-on', '3');
  expect((await documentOf(page)).behaviors.map((item) => item.id)).toEqual(['auto-blink', 'auto-gaze-x', 'auto-gaze-y', 'auto-idle-head']);
  const before = await mutations(page);

  // Turning one off keeps it, so an author's tweaks survive switching it back on.
  await page.locator('[data-automatic-toggle="blink"]').uncheck();
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'disabled');
  await expect(page.locator('[data-automatic-card="blink"]')).toContainText('kept');
  expect(await mutations(page)).toBe(before + 1);
  expect((await documentOf(page)).behaviors.find((item) => item.id === 'auto-blink').enabled).toBe(false);

  await page.locator('[data-automatic-toggle="blink"]').check();
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  expect(await mutations(page)).toBe(before + 2);
  expect((await documentOf(page)).behaviors).toHaveLength(4, 'switched back on, not added again');
  await page.locator('[data-automatic-test="blink"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewSession().testBehavior?.id)).toBe('auto-blink');
  expect(await mutations(page)).toBe(before + 2);

  await goToMode(page, 'preview');
  await expect(page.locator('[data-preview-section="automatic"] [data-preview-behavior="auto-blink"]')).toBeChecked();
  expect(await page.evaluate(() => window.__BOOP_E2E__.taskReadiness().animate.summary)).toContain('automatic behavior');

  const rig = await page.evaluate(() => JSON.parse(window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(rig.behaviors.map((item) => item.id)).toEqual(['auto-blink', 'auto-gaze-x', 'auto-gaze-y', 'auto-idle-head']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await documentOf(page)).behaviors.find((item) => item.id === 'auto-blink').enabled).toBe(false);
});

test('every behavior the template ships is a recognized preset, so none is listed as advanced', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  // Detection is by type and parameter, so the four shipped behaviors map onto
  // three presets and nothing falls through to the advanced list.
  await expect(page.locator('[data-automatic-other]')).toHaveCount(0);
  expect(await statusOf(page, 'idle-head')).toBe('on');

  // A behavior that matches no preset is the one that shows up there.
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => {
    state.behaviors = [...state.behaviors, { id: 'hand-made', type: 'oscillator', name: 'Hand made', enabled: true, parameter: 'headTilt', amplitude: .1, frequency: .5, offset: 0, waveform: 'sine' }];
  }));
  await expect(page.locator('[data-automatic-other]')).toContainText('1 advanced behavior');
  await expect(page.locator('[data-automatic-other]')).toContainText('Hand made');
  await page.locator('[data-automatic-advanced]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().authorMode)).toBe('behaviors');
});

test('presets wait for movements and guide to the rig', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await importArtworkFixture(page, 'product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await openAnimate(page);
  // No movements yet, so every preset waits -- the three original ones and the
  // V2 cartoon idles alike.
  for (const id of ['blink', 'natural-gaze', 'idle-head', 'eye-wander', 'head-drift', 'hand-drift']) {
    await expect(page.locator(`[data-automatic-card="${id}"]`)).toHaveAttribute('data-automatic-status', 'unavailable');
  }
  await expect(page.locator('[data-automatic-card="blink"]')).toContainText('Needs Eyes');
  await page.locator('[data-automatic-card="blink"] [data-automatic-fix-movements]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('rig.controls');
  // The movements are on Controls; naming the parts they move is Assign's job,
  // and it is one tab away in the same workspace (UIR-01).
  await goToMode(page, 'rig.assign');
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await goToMode(page, 'rig.controls');
  await page.getByRole('button', { name: /Turn on all \d+ available movements/ }).click();
  await openAnimate(page);
  // The face movements now exist, so the face presets are available; the one
  // that needs hands still waits.
  for (const id of ['blink', 'natural-gaze', 'idle-head', 'eye-wander', 'head-drift']) {
    await expect(page.locator(`[data-automatic-card="${id}"]`)).toHaveAttribute('data-automatic-status', 'off');
  }
  // This mascot is an import with no hands, so the hand idle still waits.
  await expect(page.locator('[data-automatic-card="hand-drift"]')).toHaveAttribute('data-automatic-status', 'unavailable');
  await page.locator('[data-automatic-toggle="idle-head"]').check();
  expect((await documentOf(page)).behaviors[0]).toMatchObject({ id: 'auto-idle-head', type: 'oscillator', parameter: 'headY', amplitude: .05, frequency: .3, enabled: true });
});

/**
 * Where the automatic behaviours run, and where they do not
 * (docs/STILL_WHILE_DESIGNING.md).
 *
 * The Character Builder places parts on the face and Artwork draws them, both
 * by clicking the mascot: a face that blinks, glances away and drifts its head
 * under the pointer is a moving target. Nothing is switched off to achieve it —
 * the behaviours are the project's and stay exactly as the author left them —
 * so this reads the document as well as the frames.
 */
test('@critical the face holds still where it is designed, and moves again where it is watched', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // A blink often enough to catch inside a second, so "nothing moved" means it.
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => {
    const blink = state.behaviors.find((item) => item.type === 'blink');
    blink.intervalMin = .1; blink.intervalMax = .1; blink.duration = .08;
  }));
  const held = () => page.evaluate(() => window.__BOOP_E2E__.previewSession().heldStill);
  const eyes = async (samples = 16) => { const seen = new Set(); for (let i = 0; i < samples; i += 1) { seen.add(await page.evaluate(() => window.__BOOP_E2E__.effectiveParams().eyeOpen)); await page.waitForTimeout(60); } return seen.size; };

  for (const [task, still] of [['character', true], ['artwork', true], ['face-setup', false], ['expressions', false], ['animate', false], ['reactions', false], ['preview', false]]) {
    await openTask(page, task);
    await expect.poll(held, `${task} holds the mascot still: ${still}`).toBe(still);
  }

  await goToMode(page, 'preview');
  await expect.poll(eyes, { timeout: 4000 }).toBeGreaterThan(1);
  const before = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history() }));

  for (const task of ['character', 'artwork']) {
    await openTask(page, task);
    expect(await eyes(), `${task}: the eyes stay open`).toBe(1);
    await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewOverrides())).toEqual({});
  }
  expect(await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history() })),
    'holding still is where the author is, never anything the project records').toEqual(before);
  expect((await documentOf(page)).behaviors.find((item) => item.id === 'auto-blink').enabled).toBe(true);

  // And a held mascot is still posable: the hold stops what it does by itself.
  await goToMode(page, 'design.face');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', .4));
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.effectiveParams().headX)).toBeCloseTo(.4);
  await page.waitForTimeout(400);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.effectiveParams().headX)).toBeCloseTo(.4);

  await goToMode(page, 'preview');
  await expect.poll(eyes, { timeout: 4000 }).toBeGreaterThan(1);
});
