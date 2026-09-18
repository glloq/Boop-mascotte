import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * How much of the window each screen gives its panels (UIR-15).
 *
 * The arithmetic is held to in `core/tests/panel-split.test.js`. What needs a
 * browser is that the stylesheet reads the numbers, that the boundaries can be
 * dragged, and that a drag stays on the screen it was made on.
 */

const columns = (page) => page.evaluate(() => {
  const w = (sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().width || 0);
  const app = document.querySelector('#app');
  return { mode: app.dataset.mode, left: w('.panel'), canvas: w('.canvas-column'), right: w('.panel-right'),
    declaredLeft: Number(app.dataset.splitLeft), declaredRight: Number(app.dataset.splitRight) };
});

test('@critical each screen opens at the width its work needs', async ({ page }) => {
  // Wide enough that every screen gets what it asked for, so the numbers below
  // are the declared ones. What happens when they do not all fit is the next
  // test, and `core/tests/panel-split.test.js` holds the arithmetic.
  await page.setViewportSize({ width: 1600, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await goToMode(page, 'design.artwork');
  const artwork = await columns(page);
  expect(artwork.left, 'drawing keeps the canvas').toBe(300);
  expect(artwork.right, 'and the Inspector is the widest column in the editor').toBe(340);

  // Hands is the opposite: the work is a list of drawings, and the Inspector
  // has nothing to say until one of a hand's shapes is selected.
  await goToMode(page, 'design.hands');
  const hands = await columns(page);
  expect(hands.left, 'a hundred more pixels of list').toBe(400);
  expect(hands.right).toBe(250);
  expect(hands.left).toBeGreaterThan(artwork.left);
  expect(hands.right).toBeLessThan(artwork.right);

  await goToMode(page, 'rig.controls');
  expect((await columns(page)).left).toBe(400);
});

test('@critical on a laptop the canvas keeps its share, and both columns give way', async ({ page }) => {
  // The pair of widths that suits a 1600px window starves a 1280px one, and
  // the rig draws handles *on* the canvas: a hand's own slider sits beside the
  // face, outside the artwork, and ended up behind the panel where nobody
  // could reach it. So the columns scale rather than hold their pixels.
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  for (const mode of ['design.artwork', 'design.hands', 'rig.assign', 'rig.controls']) {
    await goToMode(page, mode);
    const c = await columns(page);
    expect(c.canvas, `${mode} keeps a canvas`).toBeGreaterThanOrEqual(660);
    expect(c.left, `${mode} keeps a readable panel`).toBeGreaterThanOrEqual(200);
    expect(c.right, `${mode} keeps a readable inspector`).toBeGreaterThanOrEqual(200);
  }
  // And the screen's own proportions survive the squeeze: Hands still has the
  // wider list and the narrower inspector.
  await goToMode(page, 'design.hands');
  const hands = await columns(page);
  expect(hands.left).toBeGreaterThan(hands.right);
});

test('@critical a boundary can be dragged, and the drag belongs to that screen', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.hands');

  const handle = page.locator('[data-splitter="left"]');
  await expect(handle).toBeVisible();
  await expect(handle).toHaveAttribute('role', 'separator');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + 300, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await columns(page)).left).toBe(500);

  // Another screen is untouched: one number for every screen is the thing this
  // replaces, so a drag that leaked would be the old behaviour back.
  await goToMode(page, 'design.artwork');
  expect((await columns(page)).left).toBe(300);
  await goToMode(page, 'design.hands');
  expect((await columns(page)).left, 'and coming back remembers it').toBe(500);

  // The keyboard moves it too: a separator only a pointer can reach is a
  // layout somebody cannot change.
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await columns(page)).left).toBe(484);
  // And Home puts the screen's own width back.
  await page.keyboard.press('Home');
  await expect.poll(async () => (await columns(page)).left).toBe(400);
});

test('@critical the Hands canvas shows the hand, not the face it hides behind', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.hands');

  // The hands rest behind the head, so the screen for designing one showed a
  // face and no hand at all (docs/HAND_RIGGING.md).
  await expect.poll(async () => page.evaluate(() => window.__BOOP_E2E__.effectiveParams().handLShow), { message: 'the hands come out' }).toBeCloseTo(1, 1);
  /**
   * Polled, not read: a hand does not appear at its rest place, it travels
   * there over `HAND_REVEAL_SECONDS`, and the view is taken again once it has
   * arrived. Framing the first frame of that reveal framed a hand still
   * behind the head, which is what the second framing exists to correct — so
   * a test that measured once raced it.
   */
  const measure = () => page.evaluate(() => {
    const rect = (sel) => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const hand = rect('#canvas svg svg #handLeft'), canvas = rect('#canvas');
    if (!hand || !canvas) return null;
    return { share: hand.w / canvas.w, inside: hand.x > canvas.x - 10 && hand.x + hand.w < canvas.x + canvas.w + 10 && hand.y > canvas.y - 10 };
  });
  // Big *and* inside, polled as one condition. Separately, the first would
  // pass mid-reveal — a hand still crossing the canvas is large and half off
  // the edge — and the second would then be read before the view settled.
  await expect.poll(async () => {
    const seen = await measure();
    return seen ? { big: seen.share > 0.4, inside: seen.inside } : null;
  }, { message: 'the hand fills the view and is inside it' }).toEqual({ big: true, inside: true });

  // Dragging a boundary keeps the hand framed rather than sliding it half out
  // of a narrower canvas: a view that *is* a framing is re-framed when the
  // canvas changes size, which is what a column boundary does to it.
  const handle = page.locator('[data-splitter="left"]');
  const grip = await handle.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 300);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 90, grip.y + 300, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => {
    const seen = await measure();
    return seen ? { big: seen.share > 0.4, inside: seen.inside } : null;
  }, { message: 'still framed after the drag' }).toEqual({ big: true, inside: true });

  // But *Fit* is the author saying where to look, and nothing pulls them back.
  await page.locator('.canvas-toolbar [data-zoom="fit"]').click();
  await page.waitForTimeout(900);
  expect((await measure()).share, 'Fit shows the whole mascot and stays there').toBeLessThan(0.4);

  // Leaving gives the parameters back to the project: the reveal was a pose
  // for this screen, never an edit (docs/STILL_WHILE_DESIGNING.md).
  const before = await page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
  await goToMode(page, 'design.artwork');
  await expect.poll(async () => page.evaluate(() => window.__BOOP_E2E__.effectiveParams().handLShow)).toBe(0);
  expect(await page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations), 'and nothing was authored').toBe(before);
});
