import { test, expect } from '@playwright/test';
import { goToMode, hitTestablePoint, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Editing one piece of the mascot where it is drawn (docs/VECTOR_EDITING.md).
 *
 * "Il va falloir qu'on ajoute la possibilité d'éditer plus proprement chaque
 * sous-partie de la mascotte (clic droit → éditer ?)".
 */
const menu = (page) => page.locator('[data-canvas-menu]');
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const selected = (page) => page.evaluate(() => window.__BOOP_E2E__.state().selectedId);
const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());

/** The template's idle behaviors keep the head moving, and a thin stroke is a small target. */
const settle = (page) => page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { for (const behavior of state.behaviors) behavior.enabled = false; }));

/** On the artwork itself: the middle of a stroked curve's box is the face behind it. */
async function rightClick(page, selector) {
  const point = await hitTestablePoint(page.locator(selector));
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
}

test('@critical right-clicking a piece of the mascot selects it and edits it in place', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await settle(page);
  await rightClick(page, '#canvas #mouth');
  await expect(menu(page)).toHaveAttribute('data-canvas-menu-for', 'mouth');
  expect(await selected(page)).toBe('mouth');
  // It says what the piece is and which face part owns it.
  await expect(menu(page)).toContainText('Part of Mouth');

  // Rename: the name lands in the document and in the Layers tree.
  await page.locator('[data-canvas-menu-name]').fill('Lip line');
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeHidden();
  await expect.poll(async () => (await documentOf(page)).layerMetadata?.mouth?.name).toBe('Lip line');
  await expect(page.locator('#left')).toContainText('Lip line');

  // Duplicate: one new element, and it is the one now selected.
  const before = Object.keys((await documentOf(page)).elements).length;
  await rightClick(page, '#canvas #mouth');
  await page.locator('[data-canvas-menu-action="duplicate"]').click();
  await expect(menu(page)).toBeHidden();
  await expect.poll(async () => Object.keys((await documentOf(page)).elements).length).toBe(before + 1);
  const copy = await selected(page);
  expect(copy).not.toBe('mouth');

  // Delete: gone, and the toast offers the way back. The message used to say
  // "Undo brings it back" and offer nothing to press; the button is the
  // whole point of not asking first (ui/piece-actions.js).
  await rightClick(page, `#canvas #${copy}`);
  await page.locator('[data-canvas-menu-action="delete"]').click();
  await expect.poll(async () => Object.keys((await documentOf(page)).elements).length).toBe(before);
  const toast = page.locator('#toast[data-actionable]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('deleted');
  await toast.locator('[data-toast-action]').click();
  await expect.poll(async () => Object.keys((await documentOf(page)).elements).length).toBe(before + 1);
  // And it clears itself: a button offering to undo something already undone
  // is worse than no button.
  await expect(toast).toBeHidden();
});

test('the menu routes to the tools that edit a piece properly', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await settle(page);

  // A path offers its points; the Node tool opens on it. The entries that name
  // a rigging concept sit under Advanced now, so the first thing read in the
  // menu is Duplicate rather than "Convert to a path".
  await rightClick(page, '#canvas #mouth');
  await expect(page.locator('[data-canvas-menu-advanced]')).toBeVisible();
  await expect(page.locator('[data-canvas-menu-action="points"]')).toBeHidden();
  await page.locator('[data-canvas-menu-advanced] summary').click();
  await page.locator('[data-canvas-menu-action="points"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-canvas-tool', 'node');
  await expect.poll(() => page.locator('.rig-node-handle').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');

  // Artwork with a face part goes to that part; artwork without one goes to
  // the checklist that assigns it.
  await rightClick(page, '#canvas #mouth');
  await page.locator('[data-canvas-menu-advanced] summary').click();
  await expect(page.locator('[data-canvas-menu-action="part"]')).toContainText('Open its face part');
  await page.locator('[data-canvas-menu-action="part"]').click();
  await expect.poll(() => task(page)).toBe('rig.assign');
  await goToMode(page, 'design.artwork');
  await settle(page);
  // The head outline is the jaw now — it is the shape that lengthens when the
  // mouth opens — so the piece with no part of its own is the cheek shading.
  await rightClick(page, '#canvas #head');
  await expect(menu(page)).toContainText('Part of Jaw');
  await page.keyboard.press('Escape');
  await rightClick(page, '#canvas #shadeLeft');
  await expect(menu(page)).toContainText('Not assigned to a face part');
  // One entry, whose label says which way it goes: two ids for one door was
  // two things to keep in step for no gain.
  await page.locator('[data-canvas-menu-advanced] summary').click();
  await expect(page.locator('[data-canvas-menu-action="part"]')).toContainText('Assign to a face part');
  await page.locator('[data-canvas-menu-action="part"]').click();
  await expect.poll(() => task(page)).toBe('rig.assign');
});

test('bring forward really is forward, and a name survives a press elsewhere', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await settle(page);

  // The cheek shades live in the face's shading folder, so "forward" moves one
  // among the shapes it is drawn beside — which is the whole rule the buttons
  // follow (`docs/VECTOR_EDITING.md`: reorder among siblings, never across
  // parents).
  // By id: the pair of hands is painted before the face, so the face is no
  // longer the first layer.
  const order = async () => (await documentOf(page)).layers
    .find((item) => item.id === 'faceRoot').children
    .find((item) => item.id === 'faceShading').children.map((item) => item.id);
  const before = await order();
  const index = before.indexOf('shadeLeft');

  // Painted last is painted in front. Both buttons used to be wired to the
  // Layers panel's up/down, which is list order — so each did the opposite of
  // what it says.
  await rightClick(page, '#canvas #shadeLeft');
  await page.locator('[data-canvas-menu-action="forward"]').click();
  await expect.poll(async () => (await order()).indexOf('shadeLeft')).toBe(index + 1);
  await rightClick(page, '#canvas #shadeLeft');
  await page.locator('[data-canvas-menu-action="backward"]').click();
  await expect.poll(async () => (await order()).indexOf('shadeLeft')).toBe(index);

  // Typing a name and pressing anywhere else keeps the name: the dialog closed
  // before the field's `change` fired, and threw it away.
  await rightClick(page, '#canvas #shadeLeft');
  await page.locator('[data-canvas-menu-name]').fill('Cheek');
  await page.mouse.click(12, 300);
  await expect(menu(page)).toBeHidden();
  await expect.poll(async () => (await documentOf(page)).layerMetadata?.shadeLeft?.name).toBe('Cheek');
});

test('@critical the menu is chrome, not the mascot behind it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await settle(page);
  const before = await page.evaluate(() => window.__BOOP_E2E__.document().elements.mouth.baseTransform);

  // A right-click used to start a gizmo drag and capture the pointer on the
  // canvas, which swallowed the next click anywhere on it -- including on the
  // menu it had just opened. And a press on the menu, which floats over the
  // artwork it edits, was taken as a press on that artwork.
  const point = await hitTestablePoint(page.locator('#canvas #mouth'));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(point.x + 40, point.y + 20, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().elements.mouth.baseTransform)).toEqual(before);

  await page.locator('[data-canvas-menu-action="forward"]').click();
  await expect(menu(page)).toBeHidden();
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().elements.mouth.baseTransform)).toEqual(before);
});

test('hide, lock and Escape behave the way the Layers panel does', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await settle(page);
  await rightClick(page, '#canvas #nose');
  await page.locator('[data-canvas-menu-action="visibility"]').click();
  await expect(page.locator('#canvas #nose')).toBeHidden();
  await rightClick(page, '#canvas #shadeLeft');
  await page.locator('[data-canvas-menu-action="lock"]').click();
  await expect.poll(async () => (await documentOf(page)).layerMetadata?.shadeLeft?.locked).toBe(true);

  // Escape closes it without doing anything.
  await rightClick(page, '#canvas #head');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  // And the keyboard opens it for the selection, so it is not a mouse-only gesture.
  await page.keyboard.press('Shift+F10');
  await expect(menu(page)).toBeVisible();
  await expect(menu(page)).toHaveAttribute('data-canvas-menu-for', 'head');
});

/**
 * All of it, on a laptop.
 *
 * ```text
 * « il faut aussi reprendre le clic droit car une grande partie n'est pas
 *   visible ! »
 * ```
 *
 * A dozen actions, a name field and a disclosure came to **788 px** on a 900 px
 * window. `place()` clamped the top and nothing else: `canvas.height -
 * menu.height` went negative, so the menu was pinned to the top of the canvas
 * and everything from *Advanced* down was off the bottom of the window. Not
 * scrolled away — gone, with no way to reach it.
 *
 * Two fixes, and the test checks both: the menu is capped to the room it has
 * and scrolls inside it, and each action is one row rather than three stacked
 * lines, which is what made it that tall to begin with.
 */
test('@critical the menu on the artwork fits the window, open or closed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await settle(page);
  await rightClick(page, '#canvas #head');

  const fits = async (when) => {
    const box = await menu(page).evaluate((node) => {
      const r = node.getBoundingClientRect(), host = node.offsetParent.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height, scrollHeight: node.scrollHeight,
        hostTop: host.top, hostBottom: host.bottom, scrolls: getComputedStyle(node).overflowY };
    });
    expect(box.top, `${when}: the menu starts above the canvas`).toBeGreaterThanOrEqual(box.hostTop - 1);
    expect(box.bottom, `${when}: the menu runs ${(box.bottom - box.hostBottom).toFixed(0)}px past the bottom of the canvas`)
      .toBeLessThanOrEqual(box.hostBottom + 1);
    // And where it had to be capped to get there, it scrolls — so the actions
    // past the fold are reachable rather than merely off-screen.
    if (box.scrollHeight > box.height + 1) expect(box.scrolls, `${when}: taller than its box and not scrollable`).toBe('auto');
    return box;
  };
  const closed = await fits('closed');

  // Every action is one row: a mark, the words, and the shortcut beside them.
  // Stacked, twelve of those are twice as tall, which is the whole bug.
  const rows = await menu(page).locator('.canvas-menu-actions button').evaluateAll((nodes) => nodes.map((node) => {
    const label = node.querySelector('[data-canvas-menu-label]'), keys = node.querySelector('kbd');
    return { label: label.getBoundingClientRect(), keys: keys ? keys.getBoundingClientRect() : null };
  }));
  expect(rows.length).toBeGreaterThan(6);
  for (const row of rows) {
    if (!row.keys) continue;
    expect(row.keys.top, 'the shortcut sits beside its action, not under it').toBeLessThan(row.label.bottom);
  }

  // Opening Advanced is the one press that can make the menu taller than it was
  // when it was placed, so it is placed again.
  await menu(page).locator('[data-canvas-menu-advanced] summary').click();
  await expect(menu(page).locator('[data-canvas-menu-advanced][open]')).toHaveCount(1);
  const open = await fits('with Advanced open');
  expect(open.scrollHeight, 'opening Advanced showed nothing new').toBeGreaterThan(closed.scrollHeight);
  await expect(menu(page).locator('[data-canvas-menu-action]').last()).toBeVisible();
});
