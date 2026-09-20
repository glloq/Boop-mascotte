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

  // Every screen of the open workspace is reachable; the ones belonging to the
  // other three are not competing for the same row. The screens a workspace
  // marks advanced sit behind a chevron rather than in the row, so a Bézier
  // node editor no longer stands beside *Face* at the same level
  // (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §7.2) -- folded, never removed.
  await workspace(page, 'rig').click();
  for (const mode of ['rig.assign', 'rig.controls', 'rig.head2d']) {
    await expect(screenTab(page, mode), `${mode} is unreachable from its own workspace`).toBeVisible();
  }
  await expect(screenTab(page, 'rig.deform'), 'Deform is an expert screen and starts folded').toBeHidden();
  await page.locator('[data-stage-more="rig"]').click();
  await expect(screenTab(page, 'rig.deform'), 'the chevron is the door Deform keeps').toBeVisible();
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
  for (const mode of ['design.hands', 'design.artwork']) await goToMode(page, mode);

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
  // own, and none of the others. Face states joined Controls, beside the
  // movements it is made of (docs/FACE_SVG_STATES.md).
  const sections = {
    'rig.assign': ['face-parts'],
    'rig.controls': ['movements', 'face-states', 'gaze', 'handles', 'hands'],
    'rig.head2d': ['head-pose'],
    'rig.deform': ['holding', 'warp', 'all-parts']
  };
  const all = Object.values(sections).flat();
  for (const [mode, own] of Object.entries(sections)) {
    await goToMode(page, mode);
    for (const id of all) {
      const section = page.locator(`[data-setup-section="${id}"]`);
      const tab = page.locator(`[data-capability="${id}"]`);
      if (!own.includes(id)) {
        await expect(section, `${id} is still on ${mode}`).toBeHidden();
        await expect(tab, `${id} is still offered on ${mode}`).toHaveCount(0);
        continue;
      }
      // A screen's own capabilities are a tab strip now, and one panel shows
      // (UX-60 PR 3). "On this screen" is therefore *named on the bar and one
      // press away*, not "all five stacked open at once" -- which is what this
      // asserted, and what the strip replaced.
      if (own.length > 1) {
        await expect(tab, `${id} is missing from ${mode}`).toBeVisible();
        await tab.click();
      }
      await expect(section, `${id} is missing from ${mode}`).toBeVisible();
    }
  }

  // And the same question asked of the other three workspaces: one subject per
  // screen, so the column is about the thing the tab names.
  const panels = {
    'design.hands': '#hand-states', 'design.artwork': '#artboard-panel',
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

/**
 * The simple editor (audit §7.3).
 *
 * For somebody who came to dress a character, three of the four questions are
 * about rigging, animating and reacting — real work, and off-topic. There was
 * no setting that folded them, so the answer to "which of these do I need?" was
 * "read all four and find out".
 *
 * Folded, never removed. That is the half this spec spends most of its lines
 * on: the search still routes there, and arriving brings the full set back —
 * because a screen nobody can see is not a screen a deep link can reach.
 */
test('@critical the simple editor folds three workspaces away, and any route there brings them back', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const shown = () => page.locator('.stage-tab').evaluateAll((nodes) => nodes.filter((node) => node.offsetParent !== null).map((node) => node.dataset.stage));
  expect(await shown()).toEqual(['design', 'rig', 'animate', 'behavior']);

  // Off by default: folding three questions for everybody who already has a
  // project is a product decision, not a tidy-up.
  await page.locator('details.file-menu > summary').click();
  const toggle = page.locator('#simple-mode-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toContainText('Simple editor');
  await toggle.click();

  await expect.poll(shown).toEqual(['design']);
  // Preview is not a workspace and never folds: it is how you look at the thing.
  await expect(page.locator('.global-tab')).toBeVisible();
  // And the toast says where the other three went, rather than leaving it a
  // mystery that three buttons vanished.
  await expect(page.locator('#toast')).toContainText('still reachable');

  // A route outside the simple set brings the full set back and lands.
  await page.evaluate(() => window.__BOOP_E2E__.navigate({ mode: 'rig.controls' }));
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'rig.controls');
  await expect.poll(shown).toEqual(['design', 'rig', 'animate', 'behavior']);

  // The label now offers the way back in, and says which way that is.
  await page.locator('details.file-menu > summary').click();
  await expect(page.locator('#simple-mode-toggle')).toContainText('Simple editor');
  await expect(page.locator('#simple-mode-toggle')).toHaveAttribute('aria-pressed', 'false');
});

/**
 * The top bar fits, with a project on it.
 *
 * Four workspace buttons, the open workspace's screens and Preview, without
 * wrapping or overlapping: everything below the bar is measured at absolute
 * coordinates by other suites, and a tab under the search button is a tab
 * nobody can press.
 *
 * It was measured in the Character Builder's spec, which opened its own screen
 * first; it is the navigation's own measurement and it moved here with the
 * builder's removal (V5-07).
 */
test('@critical the top bar takes four workspaces, a row of screens and Preview without overlapping', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  expect((await page.locator('header.topbar').boundingBox()).height).toBeLessThanOrEqual(64);
  const bar = await page.evaluate(() => {
    // Only the row on screen: the screens of the three closed workspaces are
    // display:none and report a zero box at the origin (UIR-01).
    const edges = [...document.querySelectorAll('.stage-nav .workspace-tab, .stage-nav .stage-tab')].map((tab) => tab.getBoundingClientRect()).filter((box) => box.width > 0);
    return { left: Math.min(...edges.map((box) => box.left)), right: Math.max(...edges.map((box) => box.right)), brand: document.querySelector('#home-button').getBoundingClientRect().right, actions: document.querySelector('#search-button').getBoundingClientRect().left };
  });
  expect(bar.left).toBeGreaterThanOrEqual(bar.brand);
  expect(bar.right).toBeLessThanOrEqual(bar.actions);
});
