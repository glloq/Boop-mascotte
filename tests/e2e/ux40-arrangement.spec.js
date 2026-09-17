import { test, expect } from '@playwright/test';
import { goToAnimate, goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Several clips at once (VNX-29, docs/VNEXT_ROADMAP.md).
 *
 * The runtime has layered motions since V2: `playMotion(id, {layer:true})` runs
 * a clip alongside whatever is already playing. What was missing was any way to
 * see or author that — the Timeline showed one clip's keys, so the only way to
 * put a wave over a nod was to call the runtime from a page.
 *
 * An arrangement adds no runtime concept. It is the editor finally showing what
 * the engine could always do.
 */

async function openArrangement(page) {
  await goToAnimate(page);
  await page.locator('.timeline-view button[data-view="arrangement"]').click();
  await expect(page.locator('[data-arrangement]')).toBeVisible();
}

test('@critical clips are placed in time, on one row per part of the mascot', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArrangement(page);

  // A template ships motions, so there is something to arrange straight away.
  await expect(page.locator('[data-arrangement]')).toHaveAttribute('data-arrangement-placements', '0');
  await page.locator('button[data-action="place-clip"]').click();
  await expect(page.locator('[data-arrangement]')).toHaveAttribute('data-arrangement-placements', '1');
  await expect(page.locator('.arrangement-bar')).toHaveCount(1);

  // A second clip on the same row or another one, depending on what it moves —
  // the row is derived from what the clip writes, never declared.
  const clips = page.locator('[data-arrangement-clip] option');
  if (await clips.count() > 1) {
    await page.selectOption('[data-arrangement-clip]', { index: 1 });
    await page.locator('button[data-action="place-clip"]').click();
    await expect(page.locator('.arrangement-bar')).toHaveCount(2);
    expect(Number(await page.locator('[data-arrangement]').getAttribute('data-arrangement-lanes'))).toBeGreaterThan(0);
  }
});

test('placing and clearing an arrangement is undoable, one gesture at a time', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArrangement(page);

  const placements = () => page.locator('[data-arrangement]').getAttribute('data-arrangement-placements');
  await page.locator('button[data-action="place-clip"]').click();
  expect(await placements()).toBe('1');

  // One placement is one undo step — not one per frame, and not one per render.
  await page.keyboard.press('Control+z');
  await expect.poll(placements).toBe('0');
  await page.keyboard.press('Control+y');
  await expect.poll(placements).toBe('1');

  await page.locator('button[data-action="clear-arrangement"]').click();
  await expect.poll(placements).toBe('0');
});

test('the arrangement is editor state and never reaches the exported rig', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArrangement(page);
  await page.locator('button[data-action="place-clip"]').click();
  await expect(page.locator('[data-arrangement]')).toHaveAttribute('data-arrangement-placements', '1');

  const rig = await page.evaluate(() => {
    const files = window.__BOOP_E2E__.exportArtifacts();
    return files.find((file) => file.name === 'rig.json')?.content || '';
  });
  expect(rig, 'an arrangement adds no runtime concept, so it adds no field').not.toContain('arrangement');
  expect(JSON.parse(rig).animations.length, 'and the clips themselves are still exported').toBeGreaterThan(0);
});

test('@critical an arrangement plays, and it is the engine that was always able to', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArrangement(page);
  await page.locator('button[data-action="place-clip"]').click();

  // Playing several clips at once adds no runtime concept: each one starts
  // through the motion layer that has existed since V2.
  await page.locator('button[data-action="play-arrangement"]').click();
  await expect(page.locator('button[data-action="stop-arrangement"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.motionWeights()).length)).toBeGreaterThan(0);

  await page.locator('button[data-action="stop-arrangement"]').click();
  await expect(page.locator('button[data-action="play-arrangement"]')).toBeVisible();
});

/**
 * Three things the canvas could do and would not offer (audit §5).
 *
 * *Isolate* existed and was unreachable on the surface built for people who do
 * not know what an SVG is; *Align* lived behind `workspace === 'create'`, so it
 * was missing exactly where pieces are placed by eye; and there was no way to
 * get close to the piece in hand except by wheeling towards it and hoping.
 */
test('@critical a mascot surface lines pieces up, zooms to them, and can isolate one', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // Design ▸ Hands is the mascot surface now: the one where a person handles a
  // mascot rather than restructures its drawing. It was Design ▸ Face, and
  // this test pressed a row of its part browser to take a pair in hand
  // (V5-07); the pair is taken directly instead.
  await goToMode(page, 'design.hands');
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => {
    state.selectedId = 'pupilLeft';
    state.selectedIds = ['pupilLeft', 'pupilRight'];
  }));

  // Align, where pieces are placed by eye — and only align: making two pieces
  // one SVG group, or cutting one to the shape of another, restructures a
  // drawing the rig is bound to, so both stay in the vector editor.
  await expect.poll(() => page.evaluate(() => (window.__BOOP_E2E__.session().selectedIds || []).length)).toBe(2);
  const arrange = page.locator('.tool-arrange');
  await expect(arrange).toBeVisible();
  await expect(arrange.getByRole('button', { name: 'Middle' })).toBeVisible();
  await expect(arrange.getByRole('button', { name: 'Group' })).toHaveCount(0);
  await expect(arrange.getByRole('button', { name: 'Cut to top' })).toHaveCount(0);
  // The nine drawing tools stay in Artwork.
  await expect(page.locator('.design-toolbar')).toBeHidden();

  // Zoom to what is in hand, offered only while there is something in hand.
  const zoom = page.locator('.canvas-toolbar [data-zoom="selection"]');
  await expect(zoom).toBeVisible();
  const before = await page.evaluate(() => window.__BOOP_E2E__.panView(0, 0).scale);
  await zoom.click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.panView(0, 0).scale)).toBeGreaterThan(before);

  // Isolate is a `more` action, so on this surface it is one press further
  // down rather than absent — the whole point of folding instead of dropping.
  // Back to the whole mascot before pointing at a two-pixel reflection: the
  // zoom above left the view filled with a pair of pupils.
  await page.locator('.canvas-toolbar [data-zoom="fit"]').click();
  await page.waitForTimeout(200);
  const glint = await page.locator('#canvas svg svg #glintLeft').boundingBox();
  const on = { x: glint.x + glint.width / 2, y: glint.y + glint.height / 2 };
  await page.mouse.click(on.x, on.y);
  await page.mouse.click(on.x, on.y, { button: 'right' });
  await expect(page.locator('[data-canvas-menu-advanced]')).toBeVisible();
  await page.locator('[data-canvas-menu-advanced] summary').click();
  await expect(page.locator('[data-canvas-menu-action="isolate"]')).toBeVisible();
});
