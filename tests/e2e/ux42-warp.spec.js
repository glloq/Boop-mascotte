import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, selectLayerById, startBasicFace } from './editor-helpers.js';

/**
 * Warp grids (docs/WARP_GRID.md).
 *
 * The panel has always said *"Warp added. Drag its handles on the canvas."* and
 * its own header drew the flow as `Add Warp → 3×3 / 4×4 → drag handles`. There
 * were no handles: `movePoint` existed, the runtime bent paths correctly, and
 * nothing in the editor could move a single control point — so a warp an
 * author added did nothing at all, and no spec noticed because the whole
 * feature had none. This is that flow, end to end.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const pathOf = (page, id) => page.evaluate((elementId) => document.querySelector(`#canvas #${elementId}`)?.getAttribute('d') || null, id);

async function openWarpOn(page, elementId) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await selectLayerById(page, elementId);
  await openSetupSection(page, 'warp');
  await expect(page.locator('#warp-panel')).toBeVisible();
}

test('@critical a warp is added, its lattice is on the canvas, and dragging a point bends the shape', async ({ page }) => {
  await openWarpOn(page, 'head');
  await expect(page.locator('[data-warp-point]:not([hidden])'), 'a shape with no warp has no lattice').toHaveCount(0);

  await page.locator('[data-warp-action="add"]').click();
  // Hidden rather than removed, the way every handle on this canvas is, so
  // what is counted is what an author can actually see.
  const points = page.locator('[data-warp-point]:not([hidden])');
  await expect(points, 'a 3×3 grid is nine control points').toHaveCount(9);
  // The outside of the grid is what pins a silhouette, so it is marked.
  await expect(page.locator('[data-warp-point]:not([hidden])[data-warp-edge="true"]')).toHaveCount(8);

  const rest = await pathOf(page, 'head');
  const restPoint = { ...(await documentOf(page)).warps[0].grid.points[1] };
  // The top-middle point, not the centre: a 3x3 lattice over a round head puts
  // its mid-edge points exactly on the outline's own nodes, and the centre one
  // has no bilinear weight there at all.
  const centre = points.nth(1);
  const box = await centre.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 20, { steps: 6 });
  // It bends while the pointer is down, and the document has not been written to.
  const dragged = await pathOf(page, 'head');
  expect(dragged, 'the outline did not bend during the drag').not.toBe(rest);
  expect((await documentOf(page)).warps[0].grid.points[1], 'nothing is written until the pointer comes up').toEqual(restPoint);

  await page.mouse.up();
  const warp = (await documentOf(page)).warps[0];
  expect(warp.target).toBe('head');
  expect(warp.grid.points[1].x, 'the point moved right').toBeGreaterThan(warp.grid.points[0].x + 1);
  // One drag is one undo step, and it puts the shape back where it was drawn.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => pathOf(page, 'head')).toBe(rest);
});

test('a control point answers to the keyboard, and Escape abandons a drag', async ({ page }) => {
  await openWarpOn(page, 'head');
  await page.locator('[data-warp-action="add"]').click();
  const centre = page.locator('[data-warp-point]:not([hidden])').nth(4);
  const before = (await documentOf(page)).warps[0].grid.points[4];

  await centre.focus();
  await centre.press('ArrowRight');
  const nudged = (await documentOf(page)).warps[0].grid.points[4];
  expect(nudged.x).toBe(before.x + 1);
  await centre.press('Shift+ArrowRight');
  expect((await documentOf(page)).warps[0].grid.points[4].x).toBe(before.x + 11);

  // A drag that is abandoned wrote nothing, so there is nothing to undo.
  const rest = await pathOf(page, 'head');
  const box = await centre.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 50, box.y + box.height / 2, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await documentOf(page)).warps[0].grid.points[4].x).toBe(before.x + 11);
  await expect.poll(() => pathOf(page, 'head')).toBe(rest);
});

test('the lattice belongs to the piece that is selected, in the task that sets a warp up', async ({ page }) => {
  await openWarpOn(page, 'head');
  await page.locator('[data-warp-action="add"]').click();
  await expect(page.locator('[data-warp-point]:not([hidden])')).toHaveCount(9);

  // Another piece: its own warp, or none. (Picking from the layer list opens
  // Artwork, which is already a task where no lattice belongs — so this checks
  // both halves of the rule at once, then comes back for the selection half.)
  await selectLayerById(page, 'mouth');
  await expect(page.locator('[data-warp-point]:not([hidden])'), 'a lattice over every shape in every task is clutter on every canvas').toHaveCount(0);
  await openSetupSection(page, 'warp');
  await expect(page.locator('[data-warp-point]:not([hidden])'), 'the mouth has no warp of its own').toHaveCount(0);
  await selectLayerById(page, 'head');
  await openSetupSection(page, 'warp');
  await expect(page.locator('[data-warp-point]:not([hidden])'), 'and the warped piece brings its lattice back').toHaveCount(9);
});
