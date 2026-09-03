import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Direct controls (docs/DIRECT_CONTROLS.md): posing by dragging the mascot
 * itself instead of hunting for the right slider in the right panel.
 */
const params = (page) => page.evaluate(() => window.__BOOP_E2E__.effectiveParams());
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const handle = (page, id) => page.locator(`[data-puppet-handle="${id}"]`);
const centreOf = async (page, id) => { const box = await handle(page, id).boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };

async function dragHandle(page, id, dx, dy) {
  const from = await centreOf(page, id);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function openFace(page, task = 'face-setup') {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator(`[data-task="${task}"]`).click();
  await expect(page.locator('[data-puppet-handle]').first()).toBeVisible();
}

test('@critical the mascot can be posed by dragging it', async ({ page }) => {
  await openFace(page);
  // One handle per movement the project has, on the artwork that moves.
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(4);
  await expect(handle(page, 'gaze')).toHaveAttribute('aria-valuetext', 'at rest');

  await dragHandle(page, 'gaze', 30, -18);
  const looking = await params(page);
  expect(looking.lookX).toBeGreaterThan(0);
  expect(looking.lookY).toBeLessThan(0);
  await expect(handle(page, 'gaze')).toHaveAttribute('aria-valuetext', /look left \/ right \+/);
  // The pupils actually moved, both of them and the same way.
  const pupils = await page.evaluate(() => ['pupilLeft', 'pupilRight'].map((id) => document.querySelector(`#canvas #${id}`).getAttribute('transform')));
  expect(pupils[0]).toBe(pupils[1]);
  expect(pupils[0]).toMatch(/translate\((?!0 0)/);

  // The handle rides the artwork it moves, and a handle that moves a pair
  // sits between the two rather than on one side of the face.
  const after = await centreOf(page, 'gaze');
  const middle = await page.evaluate(() => {
    const rects = ['pupilLeft', 'pupilRight'].map((id) => document.querySelector(`#canvas #${id}`).getBoundingClientRect());
    return { x: (Math.min(...rects.map((r) => r.x)) + Math.max(...rects.map((r) => r.x + r.width))) / 2,
      y: (Math.min(...rects.map((r) => r.y)) + Math.max(...rects.map((r) => r.y + r.height))) / 2 };
  });
  expect(Math.abs(after.x - middle.x)).toBeLessThan(2);
  expect(Math.abs(after.y - middle.y)).toBeLessThan(2);

  await dragHandle(page, 'mouth', 40, 20);
  const smiling = await params(page);
  expect(smiling.smile).toBeGreaterThan(0);
  expect(smiling.mouthOpen).toBeGreaterThan(0);

  // Posing is a preview, not an edit: the project is untouched.
  expect(await page.evaluate(() => window.__BOOP_E2E__.dirty())).toBe(false);
});

test('a handle answers to the keyboard and puts itself back', async ({ page }) => {
  await openFace(page);
  await handle(page, 'gaze').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await params(page)).lookX).toBeGreaterThan(0);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await params(page)).lookY).toBeLessThan(0);

  const nudged = (await params(page)).lookX;
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await params(page)).lookX).toBeGreaterThan(nudged);

  await page.keyboard.press('Home');
  await expect.poll(async () => (await params(page)).lookX).toBe(0);
  await expect(handle(page, 'gaze')).toHaveAttribute('aria-valuetext', 'at rest');
});

test('@critical dragging the face shapes the expression being edited', async ({ page }) => {
  await openFace(page, 'expressions');
  await page.getByRole('button', { name: 'Add Happy preset' }).click();
  await expect.poll(async () => (await documentOf(page)).expressions.length).toBe(1);
  const before = (await documentOf(page)).expressions[0].controls;
  expect(before.mouthOpen).toBe(undefined);

  await dragHandle(page, 'mouth', 0, 30);
  const after = (await documentOf(page)).expressions[0].controls;
  expect(after.mouthOpen).toBeGreaterThan(0);
  // Only what the handle drives: a drag does not write every movement.
  expect(Object.keys(after).sort()).toEqual(['eyeOpen', 'mouthOpen', 'smile']);

  // One gesture, one undo.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await documentOf(page)).expressions[0].controls.mouthOpen).toBe(undefined);
});

test('the handles can be turned off, and the choice is kept', async ({ page }) => {
  await openFace(page);
  await page.locator('[data-puppet-toggle]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await expect(page.locator('[data-puppet-toggle]')).toHaveAttribute('aria-pressed', 'false');

  // Kept across tasks and stored with the other UI preferences, so it is the
  // same the next time the editor opens. (The suite clears storage on every
  // navigation, so the reload itself cannot be part of the test.)
  await page.locator('[data-task="preview"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('boop-mascotte-ui-v2') || '{}').puppetHidden)).toBe(true);

  await page.locator('[data-puppet-toggle]').click();
  await expect(page.locator('[data-puppet-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(4);
});

test('handles only appear where posing is the point', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // Artwork is for drawing and Animate for timing; neither is for posing.
  await page.locator('[data-task="artwork"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(4);
  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await page.locator('[data-task="preview"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(4);
});
