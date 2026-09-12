import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The four workspaces and their screens (UIR-01, docs/UIR_REFACTOR_BASELINE.md).
 *
 * The navigation names the four questions an author is answering — what does it
 * look like, how can its face move, what can its face do, when does it do it —
 * and the screens are the routes inside one of them. Preview sits beside the
 * four rather than after them: testing the mascot is something done from
 * wherever you are, not a fifth step.
 *
 * The rule the whole design turns on: a workspace is a shortcut into a group,
 * never a gate in front of one. Every screen of the open workspace is one click
 * away, and every workspace is one click away from every screen.
 */

const workspace = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);
const screenTab = (page, id) => page.locator(`.workspace-tab[data-mode="${id}"]`);

test('@critical the four workspaces are the navigation, and each lands on its own work', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await expect(page.locator('.stage-tab')).toHaveCount(4);
  for (const [id, label] of [['design', 'Design'], ['rig', 'Rig'], ['animate', 'Animate'], ['behavior', 'Behavior']]) {
    await expect(workspace(page, id)).toHaveText(label);
  }

  // The workspace is derived from the screen, never stored beside it: opening a
  // screen by any other route lights its workspace up too.
  await expect(page.locator('#app')).toHaveAttribute('data-stage', 'design');
  await expect(workspace(page, 'design')).toHaveAttribute('aria-pressed', 'true');

  await workspace(page, 'animate').click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'animate.expressions');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
  await expect(workspace(page, 'design')).toHaveAttribute('aria-pressed', 'false');

  await workspace(page, 'behavior').click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'behavior.reactions');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'reactions');

  // Preview belongs to no workspace, so entering it leaves all four unpressed.
  await screenTab(page, 'preview').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'preview');
  await expect(page.locator('#app')).toHaveAttribute('data-stage', 'global');
  for (const id of ['design', 'rig', 'animate', 'behavior']) {
    await expect(workspace(page, id)).toHaveAttribute('aria-pressed', 'false');
  }

  // And a screen tab reached directly still moves the workspace with it.
  await workspace(page, 'rig').click();
  await screenTab(page, 'rig.head2d').click();
  await expect(page.locator('#app')).toHaveAttribute('data-stage', 'rig');
});

test('@critical a workspace shows its own screens, keeps the one already open, and hides none of them', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  // Every screen of the open workspace is visible; the ones belonging to the
  // other three are not competing for the same row.
  await workspace(page, 'rig').click();
  for (const mode of ['rig.assign', 'rig.controls', 'rig.head2d', 'rig.deform']) {
    await expect(screenTab(page, mode), `${mode} is unreachable from its own workspace`).toBeVisible();
  }
  await expect(screenTab(page, 'design.hands')).toBeHidden();
  // And all four questions stay on offer from anywhere, which is what stops the
  // second level becoming a gate.
  for (const id of ['design', 'rig', 'animate', 'behavior']) await expect(workspace(page, id)).toBeVisible();
  await expect(screenTab(page, 'preview')).toBeVisible();

  // Rig holds four screens. Opening the third and coming back must not throw
  // the author back to the first.
  await screenTab(page, 'rig.head2d').click();
  await screenTab(page, 'preview').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'preview');
  await workspace(page, 'rig').click();
  await expect(page.locator('#app'), 'Rig returned to Assign instead of the screen that was open').toHaveAttribute('data-mode', 'rig.head2d');
});

test('a workspace says how ready its screens are, and navigating it writes nothing', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const before = await page.evaluate(() => ({
    revision: window.__BOOP_E2E__.documentRevisions().persistent,
    history: window.__BOOP_E2E__.history(),
    diagnostics: window.__BOOP_E2E__.diagnostics()
  }));

  // A workspace is as ready as its least ready screen, and says so in its own
  // accessible name rather than inside a screen tab -- a tab's whole
  // textContent is rewritten on every validation pass.
  await expect(workspace(page, 'rig')).toHaveAttribute('data-readiness', /error|todo|warning|ready/);
  await expect(workspace(page, 'rig')).toHaveAttribute('aria-label', /^Rig workspace/);

  for (const id of ['animate', 'behavior', 'rig', 'design']) await workspace(page, id).click();
  for (const mode of ['design.face', 'design.hands', 'design.artwork']) await screenTab(page, mode).click();

  const after = await page.evaluate(() => ({
    revision: window.__BOOP_E2E__.documentRevisions().persistent,
    history: window.__BOOP_E2E__.history(),
    diagnostics: window.__BOOP_E2E__.diagnostics()
  }));
  expect(after.revision, 'moving between workspaces changed the project').toBe(before.revision);
  expect(after.history, 'moving between workspaces pushed undo history').toEqual(before.history);
  expect(after.diagnostics.autosave?.writes ?? 0).toBe(before.diagnostics.autosave?.writes ?? 0);
});

test('@critical every screen shows its own subject and nobody else\'s', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  // The measurement the refactor exists for: Face Setup was nine sections in
  // one column. Each of Rig's four screens shows the sections that are its
  // own, and none of the others.
  const sections = {
    'rig.assign': ['face-parts'],
    'rig.controls': ['movements', 'gaze', 'handles', 'hands'],
    'rig.head2d': ['head-pose'],
    'rig.deform': ['holding', 'warp', 'all-parts']
  };
  const all = Object.values(sections).flat();
  for (const [mode, own] of Object.entries(sections)) {
    await goToMode(page, mode);
    for (const id of all) {
      const section = page.locator(`[data-setup-section="${id}"]`);
      if (own.includes(id)) await expect(section, `${id} is missing from ${mode}`).toBeVisible();
      else await expect(section, `${id} is still on ${mode}`).toBeHidden();
    }
  }

  // And the same question asked of the other three workspaces: one subject per
  // screen, so the column is about the thing the tab names.
  const panels = {
    'design.face': '#part-browser', 'design.hands': '#hand-states', 'design.artwork': '#artboard-panel',
    'animate.expressions': '#expressions-panel', 'animate.motions': '#motion-panel',
    'behavior.reactions': '#reactions-panel', 'behavior.automatic': '#automatic-panel', 'behavior.stateMachine': '#state-editor'
  };
  for (const [mode, panel] of Object.entries(panels)) {
    await goToMode(page, mode);
    await expect(page.locator(panel), `${panel} is missing from ${mode}`).toBeVisible();
    for (const [other, otherPanel] of Object.entries(panels)) {
      if (other === mode || otherPanel === panel) continue;
      await expect(page.locator(otherPanel), `${otherPanel} followed the author onto ${mode}`).toBeHidden();
    }
  }
});
