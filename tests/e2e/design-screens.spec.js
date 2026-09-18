import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Design is two screens (UIR-18, docs/DESIGN_SCREENS.md).
 *
 * They were one, and it opened on nine vector tools, a hundred-and-thirty
 * layer tree and an Inspector of geometry and bindings — while the hundred and
 * fifty drawings the editor ships sat in a collapsed disclosure at the bottom
 * of the column. The first thing everybody saw was the most advanced thing in
 * the editor, and the simplest was the hardest to find.
 *
 * `core/tests/task-router.test.js` holds the routing. What needs a browser is
 * which controls are on which screen, because the split is the stylesheet
 * gating groups on `data-mode` and a unit test cannot see a `display: none`.
 */

const shown = (page) => page.evaluate(() => {
  const visible = (sel) => { const n = document.querySelector(sel); return Boolean(n) && n.getClientRects().length > 0; };
  return {
    mode: document.querySelector('#app').dataset.mode,
    heading: document.querySelector('.create-tools [data-column-heading]')?.textContent?.trim(),
    library: visible('#face-library'), imports: visible('.artwork-imports'), addPart: visible('.feature-list'),
    startOver: visible('details[data-keep-open="start-over"]'),
    vectorTools: visible('.design-toolbar'), workingArea: visible('#artboard-panel'), layers: visible('#layers-panel')
  };
});

test('@critical the editor opens on Assemble, and Assemble is the library', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  const assemble = await shown(page);
  expect(assemble.mode, 'a template lands where the editor opens').toBe('design.assemble');
  expect(assemble.heading).toBe('Assemble');

  // What Assemble has: the drawings first, a picture of your own, and the
  // parts the library ships none of.
  expect(assemble.library, 'the drawings the editor ships').toBe(true);
  expect(assemble.imports, 'and a picture of your own').toBe(true);
  expect(assemble.addPart).toBe(true);
  // Cards, with the drawing on them, above the fold rather than inside a
  // disclosure at the bottom of the column.
  // The panel opens on the eyes, which is three builds and the packs' own
  // pairs rather than the twenty-one near-identical ones it used to be
  // (docs/EYE_BUILDS.md). The number is not the point -- that the cards are
  // rendered on the shelf is -- so what is asserted is that the shelf has
  // cards on it and that they are drawings.
  const cards = page.locator('#face-library [data-face-library-card]');
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  await expect(cards.first().locator('svg.face-library-preview')).toBeVisible();
  const first = await cards.first().boundingBox();
  expect(first.y, 'and they are near the top of the column').toBeLessThan(500);

  // What it has not: no Pen, no node editor, no working area, no layer tree.
  expect(assemble.vectorTools, 'no drawing tools').toBe(false);
  expect(assemble.workingArea).toBe(false);
  expect(assemble.layers, 'a hundred and thirty layers is the opposite of the point').toBe(false);

  // Replacing the artwork you have is folded, and says so: a destructive act
  // does not belong at the top of a column.
  const startOver = page.locator('details[data-keep-open="start-over"]');
  await expect(startOver).toBeVisible();
  await expect(startOver).not.toHaveAttribute('open', '');
  await expect(startOver.locator('> summary')).toContainText('Start over');
  await startOver.locator('> summary').click();
  await expect(startOver.getByRole('button', { name: /Mascot Face/ })).toBeVisible();
});

test('@critical Draw is the vector editor, one chevron away', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  // Folded, never removed: it keeps its tab, its route and its deep link
  // (UIR-00). `goToMode` opens the chevron the way a person would.
  const tab = page.locator('.workspace-tab[data-mode="design.artwork"]');
  await expect(tab).toContainText('Draw');
  await expect(tab, 'behind the chevron until it is asked for').toBeHidden();
  await goToMode(page, 'design.artwork');

  const draw = await shown(page);
  expect(draw.heading).toBe('Draw');
  expect(draw.vectorTools, 'the nine tools').toBe(true);
  expect(draw.workingArea).toBe(true);
  expect(draw.layers).toBe(true);
  expect(draw.library, 'and not the library, which is Assemble’s').toBe(false);
  expect(draw.imports).toBe(false);
  // The tools themselves, all nine of them.
  await expect(page.locator('.design-toolbar [data-design-tool]')).toHaveCount(9);
});

test('@critical a deep link into the library opens the screen it is on', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  expect((await shown(page)).library).toBe(false);
  // A route naming a panel is what Advanced tools, Problems, the palette and a
  // validation *Fix* all send; `PANEL_MODES` turns it into the screen that
  // panel lives on, so a deep link never lands on a panel out of sight.
  await page.evaluate(() => window.__BOOP_E2E__.navigate({ focus: 'face-library' }));
  await expect.poll(async () => (await shown(page)).mode).toBe('design.assemble');
  expect((await shown(page)).library).toBe(true);
});
