import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The Behavior studio (docs/BEHAVIOR_STUDIO.md).
 *
 * What it replaces: three screens with three interaction models, a diagram
 * folded into a 300 px column behind a summary that said *advanced*, a
 * transition that could only be picked one at a time by hitting an 8 px curve,
 * and every animation in the workspace set by typing numbers into fields with
 * no picture of what they do.
 *
 * Each test below is one of those four.
 */

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const settings = (page) => page.evaluate(() => window.__BOOP_E2E__.document().transitionSettings);
const rail = (page) => page.locator('#behavior-inspector');

/** A machine worth drawing, written over whatever the template ships. */
async function machine(page) {
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => {
    const pose = Object.values(state.states || {})[0] || {};
    state.states = { idle: { ...pose }, talk: { ...pose }, sleep: { ...pose } };
    state.transitions = { idle: ['talk', 'sleep'], talk: ['idle'] };
    state.transitionSettings = {
      'idle->talk': { duration: 300, easing: 'easeInOut' },
      'idle->sleep': { duration: 900, easing: 'linear' },
      'talk->idle': { duration: 200, easing: 'easeOut' }
    };
    state.activeState = 'idle';
    state.graphLayout = { nodes: {}, groups: [], comments: [] };
  }));
  await expect(page.locator('[data-graph]')).toHaveAttribute('data-graph-links', '3');
  await page.locator('[data-graph-fit]').click();
}

async function openStudio(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'behavior.stateMachine');
  await expect(page.locator('[data-behavior-board] [data-graph]')).toBeVisible();
}

test('@critical the board gets the column, and the mascot gets a stage', async ({ page }) => {
  await openStudio(page);
  await machine(page);

  // The finding this redesign starts from: 58 % of the window showed a drawing
  // of the thing the screen is not about, and the diagram was in the narrowest
  // column there is.
  const board = await page.locator('[data-graph-viewport]').boundingBox();
  const stage = await page.locator('#canvas').boundingBox();
  expect(board.width).toBeGreaterThan(stage.width * 2);

  // The stage is still the live mascot, not a picture of one.
  await expect(page.locator('#canvas svg svg #head')).toBeVisible();

  // Off gives the board the rest, and the choice outlives a trip elsewhere.
  await page.locator('[data-board-stage="off"]').click();
  await expect(page.locator('#canvas')).toBeHidden();
  await goToMode(page, 'behavior.reactions');
  await goToMode(page, 'behavior.stateMachine');
  await expect(page.locator('#canvas')).toBeHidden();
  await page.locator('[data-board-stage="small"]').click();
  await expect(page.locator('#canvas')).toBeVisible();
});

test('@critical one board, four kinds of node, and a lens that is a screen', async ({ page }) => {
  await openStudio(page);

  // States: only the poses and the moves between them.
  await expect(page.locator('[data-graph]')).toHaveAttribute('data-board-showing', 'states');
  await expect(page.locator('[data-board-kind="state"]').first()).toBeVisible();
  await expect(page.locator('[data-board-kind="reaction"]')).toHaveCount(0);

  // All: the whole workspace at once — what happens, what is done about it,
  // and the machine it is gated by. Pressing it changes the board and leaves
  // the screen alone, because it is a wider view rather than a place.
  await page.locator('button[data-board-lens="all"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'behavior.stateMachine');
  await expect(page.locator('[data-board-kind="trigger"]').first()).toBeVisible();
  await expect(page.locator('[data-board-kind="reaction"]').first()).toBeVisible();
  await expect(page.locator('[data-board-kind="automatic"]').first()).toBeVisible();

  // The other three are screens, so the chip and the tab are one control.
  await page.locator('button[data-board-lens="automatic"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'behavior.automatic');
  await expect(page.locator('#automatic-panel')).toBeVisible();
  await expect(page.locator('[data-board-kind="state"]')).toHaveCount(0);

  await goToMode(page, 'behavior.reactions');
  await expect(page.locator('[data-graph]')).toHaveAttribute('data-board-showing', 'reactions');
});

test('@critical several transitions are picked at once, and tuned in one step', async ({ page }) => {
  await openStudio(page);
  await machine(page);

  // One, picked on the board: the rail answers for it, with the curve drawn
  // rather than named in a <select>.
  await page.locator('.graph-link-label[data-select-transition="idle->sleep"]').click();
  await expect(rail(page)).toHaveAttribute('data-tune-kind', 'transition');
  await expect(page.locator('[data-tune-count]')).toHaveAttribute('data-tune-count', '1');
  await expect(page.locator('[data-tune-easing-picker]')).toHaveAttribute('data-tune-easing-picker', 'linear');
  // A duration is a word before it is a number.
  await expect(page.locator('[data-tune-duration-label]')).toHaveText('Lazy · 900 ms');

  // A second, added with shift. This is the edit the old one-string selection
  // could not express at all.
  await page.locator('.graph-link-label[data-select-transition="talk->idle"]').click({ modifiers: ['Shift'] });
  await expect(page.locator('[data-tune-count]')).toHaveAttribute('data-tune-count', '2');
  await expect(page.locator('.tune-mixed').first()).toBeVisible();

  // One press of a curve sets both, and leaves the third alone.
  await page.locator('[data-tune-easing="easeOut"]').click();
  await expect.poll(() => settings(page)).toMatchObject({
    'idle->sleep': { easing: 'easeOut', duration: 900 },
    'talk->idle': { easing: 'easeOut', duration: 200 },
    'idle->talk': { easing: 'easeInOut', duration: 300 }
  });

  // And one press of undo takes both back, whatever the count.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await settings(page))['idle->sleep'].easing).toBe('linear');
});

test('the table tunes a machine without hunting on the canvas', async ({ page }) => {
  await openStudio(page);
  await machine(page);

  const table = page.locator('[data-transition-table]');
  await expect(table).toHaveAttribute('data-transition-table', '3');

  // A row selects its edge on the board, both ways.
  await page.locator('[data-table-select="idle->talk"]').click();
  await expect(page.locator('.graph-link.link-transition.selected')).toHaveCount(1);
  await expect(rail(page)).toHaveAttribute('data-tune-kind', 'transition');

  // Filtering, and the bulk bar that appears at two.
  await page.locator('[data-table-filter]').fill('idle->');
  await expect(page.locator('[data-table-row]')).toHaveCount(2);
  await page.locator('[data-table-pick-all]').click();
  await expect(page.locator('[data-table-bulk]')).toHaveAttribute('data-table-bulk', '2');

  await page.locator('[data-table-bulk-duration]').fill('200');
  await page.locator('[data-table-bulk-duration]').dispatchEvent('change');
  await expect.poll(() => settings(page)).toMatchObject({
    'idle->talk': { duration: 200 }, 'idle->sleep': { duration: 200 }, 'talk->idle': { duration: 200 }
  });
  // Undo from the bar rather than the keyboard: the focus is still inside the
  // number field that made the edit, and Ctrl+Z there is the browser's own
  // undo of the text.
  await page.locator('#undo').click();
  await expect.poll(async () => (await settings(page))['idle->sleep'].duration).toBe(900);
});

test('@critical an automatic behaviour is drawn before it is typed at', async ({ page }) => {
  await openStudio(page);
  await goToMode(page, 'behavior.automatic');

  // Arriving picks the first one, because a selection-driven inspector over an
  // empty selection is a third of the window saying "pick something".
  await expect(rail(page)).toHaveAttribute('data-tune-kind', 'automatic');
  await expect(page.locator('[data-tune-wave]')).toBeVisible();
  const drawn = await page.locator('.wave-line').getAttribute('d');
  expect(drawn.length).toBeGreaterThan(80);

  // The numbers under the picture edit the behaviour, and the picture follows.
  const before = await documentOf(page);
  const id = await page.locator('[data-tune-behavior]').getAttribute('data-tune-behavior');
  const field = page.locator('[data-tune-behavior-field="intervalMin"]');
  if (await field.count()) {
    await field.fill('4');
    await field.dispatchEvent('change');
    await expect.poll(async () => (await documentOf(page)).behaviors.find((item) => item.id === id).intervalMin).toBe(4);
    await expect.poll(async () => page.locator('.wave-line').getAttribute('d')).not.toBe(drawn);
  }
  expect(before.behaviors.length).toBe((await documentOf(page)).behaviors.length);
});

test('a state picked anywhere opens its pose in the one inspector', async ({ page }) => {
  await openStudio(page);
  await machine(page);

  // The gap this closes: a state used to be answered with a sentence saying
  // where its editor was, because the Behavior workspace had registered no
  // inspector adapter at all.
  await page.locator('[data-graph-node="sleep"]').click();
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'state');
  await expect(page.locator('[data-tune-state]')).toHaveAttribute('data-tune-state', 'sleep');
  await expect(page.locator('[data-tune-state-param]').first()).toBeVisible();

  // And the column, the board and the rail are one selection.
  await page.locator('#state-editor [data-select-state="talk"]').click();
  await expect(page.locator('[data-tune-state]')).toHaveAttribute('data-tune-state', 'talk');
  await expect(page.locator('[data-graph-node="talk"]')).toHaveAttribute('aria-pressed', 'true');
});
