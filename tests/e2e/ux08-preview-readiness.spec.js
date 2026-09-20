import { test, expect } from '@playwright/test';
import { goToMode, goToPreview, importArtworkFixture, openFreshEditor, openPreviewSection, openProblems, openTask, problemsButton, readSvgTranslation, revealPreviewItem, startBasicFace } from './editor-helpers.js';

const checkpoint = (page) => page.evaluate(() => ({
  document: window.__BOOP_E2E__.document(), token: window.__BOOP_E2E__.documentVersionToken(), revisions: window.__BOOP_E2E__.documentRevisions(),
  history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty(), mutations: window.__BOOP_E2E__.diagnostics().store.documentMutations
}));
const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);
const readiness = (page) => page.evaluate(() => window.__BOOP_E2E__.taskReadiness());
const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());

async function openPreview(page) {
  await goToMode(page, 'preview');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'preview');
  await expect(page.locator('#preview-panel[data-preview-panel-ready="true"]')).toBeVisible();
}

/**
 * Open the rig bench: the live sliders, the hands and the automatic behaviours.
 *
 * They were the *first* sections of Preview and they are testing the rig, not
 * the mascot — a person building a character wants them last and folded
 * (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §11). Everything that reaches for one
 * of them opens the disclosure first.
 *
 * *Poses* is not one of them: a named state is pressed and looked at, exactly
 * like an expression, so it reads with them and needs no disclosure.
 */
async function openRigBench(page) {
  await openPreviewSection(page, 'advanced');
  await expect(page.locator('[data-preview-section="advanced"] [data-preview-section="live"]')).toBeVisible();
}

test('@critical Preview offers live controls and a readiness list without writing to the project', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openPreview(page);
  await openRigBench(page);
  await expect(page.getByRole('heading', { name: 'Preview', exact: true })).toBeVisible();
  const before = await checkpoint(page);
  await expect(page.locator('[data-preview-section="live"]')).toBeVisible();
  const pad = page.locator('[data-preview-xy="lookX:lookY"]');
  await expect(pad).toBeVisible();
  const pupil = page.locator('#pupilLeft'), base = await readSvgTranslation(pupil);
  const slider = page.locator('[data-preview-control="lookX"]');
  await slider.fill('0.8');
  await expect.poll(() => effective(page, 'lookX')).toBeCloseTo(.8);
  expect((await readSvgTranslation(pupil)).x).not.toBe(base.x);
  await pad.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => effective(page, 'lookY')).toBeCloseTo(-.1);
  expect(await checkpoint(page)).toEqual(before);

  // The readiness rows live once in this column, in the Publish panel: the
  // Preview panel used to repeat the same seven rows right above it.
  await expect(page.locator('[data-preview-section="readiness"]')).toHaveCount(0);
  const list = page.locator('[data-publish-checklist]');
  await expect(list.locator('[data-publish-step="artwork"]')).toHaveAttribute('data-publish-status', 'ready');
  await expect(list.locator('[data-publish-step="faceSetup"]')).toHaveAttribute('data-publish-status', 'ready');
  await expect(list.locator('[data-publish-step="faceSetup"]')).toContainText('8 / 8 assigned');
  // The mouth is shaped by shape keys, which are their own calibration, so the
  // template no longer arrives with nothing captured at all.
  await expect(list.locator('[data-publish-step="movements"]')).toHaveAttribute('data-publish-status', 'ready');
  await expect(list.locator('[data-publish-step="movements"]')).toContainText('26 on · 8 set up');
  await expect(list.locator('[data-publish-step="export"]')).toHaveAttribute('data-publish-status', 'ready');
  const model = await readiness(page);
  expect(model.faceSetup.status).toBe('ready');
  expect(model.movements.code).toBe(null);
  // A template that arrives finished has nothing left to fix.
  expect(model.next).toBe(null);

  await page.getByRole('button', { name: 'Reset mascot' }).click();
  await expect.poll(() => effective(page, 'lookX')).toBe(0);
  await expect.poll(() => effective(page, 'lookY')).toBe(0);
  expect(await checkpoint(page)).toEqual(before);

  await list.getByRole('button', { name: 'Go to Movements' }).click();
  await expect.poll(() => task(page)).toBe('rig.controls');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-control');
  await expect(page.getByRole('heading', { name: 'Movement Inspector', exact: true })).toBeVisible();
  expect(await checkpoint(page)).toEqual(before);
});

test('@critical Preview poses, animations and automatic behaviors are preview-only and reset together', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openPreview(page);
  await openRigBench(page);
  const before = await checkpoint(page);
  const automatic = page.locator('[data-preview-section="automatic"]');
  await expect(automatic).toBeVisible();
  const blink = automatic.locator('[data-preview-behavior="auto-blink"]');
  await expect(blink).toBeChecked();
  await blink.uncheck();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewOverrides())).toEqual({ 'auto-blink': false });
  expect((await checkpoint(page)).document.behaviors.find((behavior) => behavior.id === 'auto-blink').enabled).toBe(true);
  await expect(automatic).toContainText('preview only');

  await openPreviewSection(page, 'poses');
  await page.locator('[data-preview-section="poses"] [data-preview-state="happy"]').click();
  await expect.poll(() => effective(page, 'smile'), { timeout: 3000 }).toBeCloseTo(1, 1);
  await expect(page.locator('[data-preview-state="happy"]')).toHaveAttribute('aria-pressed', 'true');

  const clip = page.locator('[data-preview-section="animations"] [data-preview-clip="look-around"]');
  await revealPreviewItem(page, 'animations', '[data-preview-section="animations"] [data-preview-clip="look-around"]');
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(true);
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'false');
  expect(await checkpoint(page)).toEqual(before);

  await page.getByRole('button', { name: 'Reset mascot' }).click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewOverrides())).toEqual({});
  await expect(automatic.locator('[data-preview-behavior="auto-blink"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(false);
  expect(await checkpoint(page)).toEqual(before);
});

/**
 * One reset, in the project bar (docs/STILL_WHILE_DESIGNING.md).
 *
 * It used to be a button inside the Preview panel, which meant the only way
 * back to rest was a tab away from every place the mascot is actually posed --
 * the puppet handles in Character, the pads in Face Setup. The control moved to
 * the project bar and the Preview copy went with it, so the name below resolves
 * to exactly one button on every tab.
 */
test('@critical the reset is in the project bar, works on any tab, and touches nothing authored', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'create');
  const before = await checkpoint(page);
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('lookX', .8); window.__BOOP_E2E__.setLiveParam('headX', .5); });
  await expect.poll(() => effective(page, 'lookX')).toBeCloseTo(.8);

  const reset = page.getByRole('button', { name: 'Reset mascot' });
  await expect(reset).toBeVisible();
  await reset.click();
  await expect.poll(() => effective(page, 'lookX')).toBe(0);
  await expect.poll(() => effective(page, 'headX')).toBe(0);
  expect(await checkpoint(page), 'the reset writes no command, no history step and no revision').toEqual(before);

  // One control, not one per tab, and never two on the same tab.
  for (const task of ['artwork', 'face-setup', 'expressions', 'animate', 'reactions', 'preview']) {
    await openTask(page, task);
    await expect(page.getByRole('button', { name: 'Reset mascot' }), `${task} carries the one reset`).toHaveCount(1);
  }
  await expect(page.locator('#preview-reset'), 'the Preview panel no longer carries a second copy').toHaveCount(0);
});

test('readiness deep links from Problems reach the task that fixes them', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await importArtworkFixture(page, 'product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await openProblems(page);
  const panel = page.locator('#problems-panel');
  await expect(panel.locator('[data-readiness-section="faceSetup"]')).toHaveAttribute('data-readiness-status', 'todo');
  await expect(panel.locator('[data-readiness-section="faceSetup"]')).toContainText('No face parts assigned yet');
  await panel.getByRole('button', { name: 'Go to Face parts' }).click();
  await expect(panel).toBeHidden();
  await expect.poll(() => task(page)).toBe('rig.assign');
  await expect(page.locator('#face-setup-checklist[data-face-setup-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await expect(page.locator('.workspace-tab[data-mode="rig.assign"]')).toHaveText(/Assign ○/);
  await openProblems(page);
  await expect(panel.locator('[data-readiness-section="faceSetup"]')).toHaveAttribute('data-readiness-status', 'ready');
  await expect(panel.locator('[data-readiness-section="movements"]')).toContainText('No movement turned on');
});

/**
 * UIR-14 — the app bar answers the question instead of asking it.
 *
 * "Problems" was a word that was true whether or not there were any, so it was
 * never worth pressing. The verdict is the reading of the whole project, and
 * what it opens is grouped by the workspace the work is in, which is what makes
 * a count somewhere to go rather than a number to worry about.
 */
test('@critical the app bar reads the project, and Problems groups what is left by workspace', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const verdict = problemsButton(page);
  // Before there is a project there is nothing to read, and the button says so
  // rather than claiming a verdict it has not taken.
  await expect(verdict).toHaveText('Project check');
  await expect(verdict).not.toHaveAttribute('data-readiness', /.*/);

  await startBasicFace(page);
  await expect(verdict).toHaveAttribute('data-readiness', 'ready');
  await expect(verdict).toHaveText('✓ Ready');
  await expect(verdict).toHaveAttribute('aria-label', 'Project check: Ready');

  await openProblems(page);
  const panel = page.locator('#problems-panel');
  // Five headers, in navigation order, Export last and belonging to no workspace.
  await expect(panel.locator('[data-readiness-group] b')).toHaveText(['Design', 'Rig', 'Animate', 'Behavior', 'Export']);
  // Every row is under its own header, and a header is as bad as its worst row:
  // a section that floated free of the four would be a capability the
  // navigation cannot account for.
  const filed = () => panel.evaluate((root) => {
    const out = {}; let group = null;
    for (const row of root.querySelectorAll('[data-readiness-group],[data-readiness-section]')) {
      if (row.dataset.readinessGroup) out[group = row.dataset.readinessGroup] = { status: row.dataset.readinessStatus, sections: {} };
      else out[group].sections[row.dataset.readinessSection] = row.dataset.readinessStatus;
    }
    return out;
  });
  expect(await filed()).toEqual({
    design: { status: 'ready', sections: { artwork: 'ready' } },
    rig: { status: 'ready', sections: { faceSetup: 'ready', movements: 'ready' } },
    animate: { status: 'ready', sections: { expressions: 'ready', animate: 'ready' } },
    behavior: { status: 'ready', sections: { reactions: 'ready' } },
    export: { status: 'ready', sections: { export: 'ready' } }
  });
  await panel.getByRole('button', { name: 'Close Problems' }).click();
  await expect(panel).toBeHidden();

  // A project that cannot export says so in the bar, without being opened, and
  // the group that opens carries the blocker while the others stay honest.
  await openFreshEditor(page, { e2e: true });
  await importArtworkFixture(page, 'product-face.svg');
  await expect(verdict).toHaveAttribute('data-readiness', 'error');
  await expect(verdict).toHaveText('● 1 issue', 'singular, and artwork that is fine is not counted against it');
  await expect(verdict).toHaveAttribute('aria-label', 'Project check: 1 issue');
  await openProblems(page);
  const groups = await filed();
  expect(groups.export.status).toBe('error');
  expect(groups.design.status).toBe('ready');
  expect(groups.rig).toEqual({ status: 'todo', sections: { faceSetup: 'todo', movements: 'todo' } });
});

/**
 * UIR-13 — Preview is a state of the canvas, not a fifth place.
 *
 * The tab names the way out as well as the way in, and pressing it again puts
 * the author back on the screen they were authoring on. The memory is
 * session-only on purpose: where somebody was standing is not a project fact,
 * so it never reaches ProjectDocument (Règle D).
 */
test('@critical Preview is a toggle that gives the author back the screen they left', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const tab = page.locator('.workspace-tab[data-mode="preview"]');
  await expect(tab).toHaveText('▶ Preview');

  await goToMode(page, 'rig.head2d');
  await tab.click();
  await expect.poll(() => task(page)).toBe('preview');
  await expect(tab).toHaveText('◼ Stop preview');
  await expect(tab).toHaveAttribute('aria-label', 'Stop preview and go back to editing');
  await tab.click();
  await expect.poll(() => task(page)).toBe('rig.head2d', 'back to the screen, not to the default');
  await expect(tab).toHaveText('▶ Preview');

  // It follows the author rather than remembering one screen forever.
  await goToMode(page, 'behavior.reactions');
  await tab.click();
  await expect.poll(() => task(page)).toBe('preview');
  await tab.click();
  await expect.poll(() => task(page)).toBe('behavior.reactions');

  // Nothing about any of it is the project's business.
  const stored = await page.evaluate(() => JSON.stringify(window.__BOOP_E2E__.document()));
  expect(stored).not.toContain('beforePreview');
  expect(stored).not.toContain('behavior.reactions');
});

/**
 * UIR-13 — and what Preview offers is the whole test surface (§11).
 *
 * Expressions, motions, hand states, events, reactions, automatic on/off, and
 * the reset. The reset is the one in the project bar: it is on every screen
 * already, and a second copy inside the panel was what UX-33 removed.
 */
test('@critical Preview offers every way to try the mascot, hand states included', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToPreview(page);
  await expect(page.locator('#preview-panel[data-preview-panel-ready="true"]')).toBeVisible();
  // Every surface is still here; what changed is which of them is read first
  // (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §11). Nothing lost its door.
  await openRigBench(page);
  for (const id of ['live', 'hands', 'expressions', 'reactions', 'animations', 'automatic']) {
    await expect(page.locator(`[data-preview-section="${id}"]`), `Preview offers ${id}`).toHaveCount(1);
  }
  // The simulator reads with the reactions it fires, one chip along.
  await openPreviewSection(page, 'reactions');
  await expect(page.locator('[data-preview-events]'), 'the event simulator is the Events surface').toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset mascot' })).toHaveCount(1);

  // The hands are offered as states, in the words Design and Behavior use.
  await openRigBench(page);
  const hands = page.locator('[data-preview-hand="left"]');
  await expect(hands.locator('.pose-chips-label')).toHaveText(['Place', 'Hand state']);
  const fist = hands.locator('[data-preview-hand-style="left:fist"]');
  await expect(fist).toBeVisible();
  await fist.click();
  await expect(fist).toHaveAttribute('aria-pressed', 'true');
});

/**
 * The two checks Preview did not offer.
 *
 * It had eight sections — expressions, reactions with an event simulator and a
 * log, poses, animations, automatic behaviours, every live movement as a
 * slider, and the hands — and neither of the two things a person actually
 * checks before they ship a mascot: does it read on the page it is going on,
 * and does it read at the size it is going at
 * (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §11).
 *
 * Both are view state. The document is untouched, to the revision.
 */
test('@critical Preview tests the mascot on a ground and at a size, and writes nothing', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openPreview(page);
  await openRigBench(page);

  // The stage comes first, because it is the first question. Everything else
  // on the panel asks "what can it do?"; these ask "does it work?".
  const stage = page.locator('[data-preview-stage]');
  await expect(stage).toBeVisible();
  await expect(page.locator('#preview-panel > *').first()).toHaveAttribute('data-preview-stage', '');

  // Transparency is the default, because it is what the exported SVG has.
  await expect(page.locator('#app')).toHaveAttribute('data-preview-ground', 'checker');
  await expect(stage.locator('[data-preview-ground="checker"]')).toHaveAttribute('aria-pressed', 'true');

  const before = await checkpoint(page);
  await stage.locator('[data-preview-ground="dark"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-preview-ground', 'dark');
  await stage.locator('[data-preview-ground="light"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-preview-ground', 'light');

  // A size is a box the mascot is drawn inside, so 32 px is 32 px of screen.
  await expect(page.locator('#app')).toHaveAttribute('data-preview-sized', 'false');
  await stage.locator('[data-preview-size="32"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-preview-sized', 'true');
  const shown = await page.locator('#canvas > svg').boundingBox();
  expect(Math.round(shown.width), 'the mascot is drawn at the size asked for').toBe(32);
  expect(Math.round(shown.height)).toBe(32);

  // And at 32 px the template's own three-unit outlines fall under a pixel,
  // which is the failure this whole control exists to surface.
  await expect(page.locator('[data-preview-stage-warning]')).toBeVisible();
  await expect(page.locator('[data-preview-stage-warning]')).toContainText('will thin out or disappear');

  await stage.locator('[data-preview-size="256"]').click();
  expect(Math.round((await page.locator('#canvas > svg').boundingBox()).width)).toBe(256);
  await expect(page.locator('[data-preview-stage-warning]')).toHaveCount(0, 'and says nothing when there is nothing to say');

  await stage.locator('[data-preview-size="fit"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-preview-sized', 'false');

  // None of it is a project change.
  expect(await checkpoint(page)).toEqual(before);
});

/** The bench is testing the rig, so it is last and folded rather than first. */
test('@critical the sliders are behind the last chip on the strip, and the strip names them all', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openPreview(page);

  // What the face can do reads first: the faces, the states, the motions, and
  // then when. A named state is pressed and looked at, exactly like an
  // expression, so it sits with them rather than on the rig bench -- the bench
  // is for the eighteen sliders and the event simulator, which test the rig.
  const sections = await page.locator('#preview-panel > [data-preview-section]').evaluateAll((nodes) => nodes.map((node) => node.dataset.previewSection));
  expect(sections).toEqual(['expressions', 'poses', 'animations', 'reactions', 'advanced']);

  // Each is a chip on the strip, in that order, so what the mascot can do is
  // five words on screen rather than 2 845 px of column (UX-60 PR 6).
  const picks = await page.locator('[data-preview-pick]').evaluateAll((nodes) => nodes.map((node) => node.dataset.previewPick));
  expect(picks).toEqual(['expressions', 'poses', 'animations', 'reactions', 'advanced']);

  const advanced = page.locator('[data-preview-section="advanced"]');
  await expect(page.locator('[data-preview-pick="advanced"]')).toContainText('Test the rig');
  // The eighteen sliders are inside the bench, not in front of it.
  await openPreviewSection(page, 'advanced');
  await expect(advanced.locator('[data-preview-section="live"]')).toBeVisible();
  // The simulator reads with the reactions it fires, which is where it is.
  await openPreviewSection(page, 'reactions');
  await expect(page.locator('[data-preview-events]')).toBeVisible();
  // And the states are one press away, named on the strip the whole time.
  await openPreviewSection(page, 'poses');
  await expect(page.locator('[data-preview-section="poses"] [data-preview-state]').first()).toBeVisible();
});
