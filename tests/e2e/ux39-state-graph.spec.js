import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The state machine as a diagram (V4-100 … V4-106, docs/V4_ROADMAP.md Phase 10).
 *
 * The renderer this replaces computed its positions on every render, so a node
 * could not be moved — only watched being placed. Everything below is about the
 * consequence of fixing that: a position is authored data, so it is dragged,
 * undone, saved, and laid out again on request.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const viewport = (page) => page.locator('[data-graph-viewport]');
const node = (page, name) => page.locator(`[data-graph-node="${name}"]`);

/**
 * A box in viewport coordinates, which is what `page.mouse` speaks.
 *
 * The state editor sits at the bottom of a long column, so a node's own box can
 * be thousands of pixels down the page: pressing at that point presses on
 * nothing. Playwright's own actions scroll first; a raw pointer gesture has to
 * be told to.
 */
async function reach(locator) {
  await locator.scrollIntoViewIfNeeded();
  return locator.boundingBox();
}
const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** One pointer gesture: press here, move there, release. */
async function dragFrom(page, from, to, steps = 8) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

async function openGraph(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'behavior.stateMachine');
  await expect(page.locator('#state-editor [data-graph]')).toBeVisible();
}

/**
 * A machine worth drawing: four states, a pair and a lone link.
 *
 * Written over whatever the template ships rather than added to it, so the
 * counts below are the counts this test is about.
 */
async function fourStates(page) {
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => {
    const pose = Object.values(state.states)[0] || {};
    state.states = { idle: { ...pose }, talk: { ...pose }, sleep: { ...pose }, wave: { ...pose } };
    state.transitions = { idle: ['talk', 'sleep'], talk: ['idle'], sleep: ['wave'] };
    // Settings as `addTransition` writes them: a transition with none is one
    // the Inspector will not open, which is what the panel has always done.
    state.transitionSettings = Object.fromEntries(Object.entries(state.transitions)
      .flatMap(([from, targets]) => targets.map((to) => [`${from}->${to}`, { duration: 300, easing: 'easeInOut' }])));
    state.activeState = 'idle';
    state.graphLayout = { nodes: {}, groups: [], comments: [] };
  }));
  await expect(page.locator('[data-graph]')).toHaveAttribute('data-graph-nodes', '4');
  // The view is the author's, so it is not re-fitted behind their back when the
  // machine changes. Fit is the press that says "show me all of it", and every
  // test below starts from there so its measurements are of one diagram.
  await page.locator('[data-graph-fit]').click();
}

test('@critical a state is dragged where you put it, and it stays there', async ({ page }) => {
  await openGraph(page);
  await fourStates(page);
  await expect(page.locator('[data-graph]')).toHaveAttribute('data-graph-links', '4');

  // Nothing is authored yet: auto-layout answers for every state, and the
  // document records none of it.
  expect((await documentOf(page)).graphLayout).toEqual({ nodes: {}, groups: [], comments: [] });

  const target = node(page, 'sleep');
  const before = await reach(target);
  const grip = centre(before);
  await dragFrom(page, grip, { x: grip.x + 90, y: grip.y + 60 });

  // One gesture, one history step, and every node written down at the place it
  // was already being drawn — so adding a state later moves nothing.
  const layout = (await documentOf(page)).graphLayout;
  expect(Object.keys(layout.nodes).sort()).toEqual(['idle', 'sleep', 'talk', 'wave']);
  const after = await target.boundingBox();
  expect(after.x).toBeGreaterThan(before.x + 40);
  expect(after.y).toBeGreaterThan(before.y + 20);

  // Undo puts it back on screen, not just in the document: the panel redraws
  // from the layout rather than from what the drag painted.
  const apart = (await node(page, 'sleep').boundingBox()).x - (await node(page, 'idle').boundingBox()).x;
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Object.keys((await documentOf(page)).graphLayout.nodes)).toEqual([]);
  await expect.poll(async () => (await node(page, 'sleep').boundingBox()).x - (await node(page, 'idle').boundingBox()).x)
    .toBeLessThan(apart - 4);
});

test('@critical a transition is drawn by dragging from one state to another', async ({ page }) => {
  await openGraph(page);
  await fourStates(page);
  expect((await documentOf(page)).transitions.wave).toBeUndefined();

  const from = node(page, 'wave'), to = node(page, 'idle');
  const box = await reach(from), landing = await to.boundingBox();
  // The handle on the node's right edge, which appears on hover.
  await from.hover();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(landing.x + landing.width / 2, landing.y + landing.height / 2, { steps: 10 });
  // A dashed line follows the pointer while the link is being made.
  await expect(page.locator('[data-graph-draft]')).not.toHaveAttribute('hidden', '');
  await page.mouse.up();

  await expect.poll(async () => (await documentOf(page)).transitions.wave).toEqual(['idle']);
  await expect(page.locator('[data-graph]')).toHaveAttribute('data-graph-links', '5');
  // Drawing a link is adding a transition: it selects it, exactly as the dialog does.
  await expect(page.locator('.transition-inspector')).toContainText('idle');
});

test('the diagram pans, zooms and fits, and none of it touches the project', async ({ page }) => {
  await openGraph(page);
  await fourStates(page);
  const before = await documentOf(page);
  // `<output>` is not a form control Playwright can read a value from; the
  // number a person sees is its text.
  const scale = async () => Number((await page.locator('[data-graph-scale]').textContent()).replace('%', ''));

  const fitted = await scale();
  await page.locator('[data-graph-zoom="in"]').click();
  expect(await scale()).toBeGreaterThan(fitted);
  await page.locator('[data-graph-zoom="out"]').click();
  await page.locator('[data-graph-zoom="out"]').click();
  expect(await scale()).toBeLessThan(fitted);

  const box = await reach(viewport(page));
  const start = await node(page, 'idle').boundingBox();
  await page.keyboard.down('Alt');
  await dragFrom(page, { x: box.x + box.width - 12, y: box.y + box.height - 12 }, { x: box.x + box.width - 90, y: box.y + box.height - 12 }, 6);
  await page.keyboard.up('Alt');
  expect((await node(page, 'idle').boundingBox()).x).toBeLessThan(start.x);

  await page.locator('[data-graph-fit]').click();
  // Where somebody has scrolled is not something a project records.
  expect(await documentOf(page)).toEqual(before);
});

test('states are selected in a sweep, grouped, arranged and annotated', async ({ page }) => {
  await openGraph(page);
  await fourStates(page);
  // A sweep across the background takes what it touches.
  await page.locator('[data-graph-fit]').click();
  const box = await reach(viewport(page));
  await dragFrom(page, { x: box.x + 3, y: box.y + 3 }, { x: box.x + box.width - 3, y: box.y + box.height - 3 }, 10);
  await expect(page.locator('[data-graph-node].selected')).toHaveCount(4);

  await page.locator('[data-graph-group]').click();
  await expect.poll(async () => (await documentOf(page)).graphLayout.groups[0].members.length).toBe(4);
  await expect(page.locator('[data-graph-group="group-1"]')).toBeVisible();

  // A note is typed on the diagram rather than in a dialog.
  await page.locator('[data-graph-note]').click();
  const note = page.locator('[data-graph-comment-text="note-1"]');
  await note.fill('Everything here is the awake half.');
  await note.blur();
  await expect.poll(async () => (await documentOf(page)).graphLayout.comments[0].text).toBe('Everything here is the awake half.');

  // Arrange is one step over the whole diagram, and undoes as one.
  const scattered = (await documentOf(page)).graphLayout.nodes;
  await page.locator('[data-graph-arrange]').click();
  await expect.poll(async () => (await documentOf(page)).graphLayout.nodes).not.toEqual(scattered);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await documentOf(page)).graphLayout.nodes).toEqual(scattered);
});

test('the diagram shows where the mascot is, and which transition is playing', async ({ page }) => {
  await openGraph(page);
  await fourStates(page);
  // The state the mascot is in is marked without anything being pressed.
  await expect(node(page, 'idle')).toHaveClass(/live/);

  await page.locator('[data-graph-node="talk"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewSession().previewState)).toBe('talk');
  await expect(node(page, 'talk')).toHaveClass(/live/);

  // And a transition being tested lights its own curve while it plays.
  // The label is the target a person hits: it sits on the curve and is the one
  // thing there big enough to press without aiming.
  await page.locator('.graph-link-label[data-select-transition="talk->idle"]').click();
  await page.locator('[data-action="test-transition"]').click();
  await expect(page.locator('[data-graph-link-line="talk->idle"]')).toHaveClass(/firing/);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewSession().transitionEdge), { timeout: 4000 }).toBe(null);
});
