import { test, expect } from '@playwright/test';
import { importArtworkFixture, openArtwork, openFreshEditor } from './editor-helpers.js';

/**
 * An import, the layer tree and the Inspector, over Design's two screens.
 *
 * This test was called "Artwork consolidates import, Layers and contextual
 * editing", and that consolidation is the thing UIR-18 undid: one screen held
 * *bring me your pictures* and *here is a Bézier node editor*, and the first
 * of those lost. Import is on **Assemble**, where a project lands; the layer
 * tree is on **Draw**. The Inspector is on both, because it is about the piece
 * in hand rather than about a screen (docs/DESIGN_SCREENS.md).
 */
test('@critical an import lands on Assemble, and the layer tree and Inspector are Draw’s', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await importArtworkFixture(page, 'product-head.svg');
  // Where the import landed: Assemble, with the way in that made it.
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'design.assemble');
  await expect(page.getByText('Import / Replace SVG', { exact: true })).toBeVisible();
  await expect(page.getByRole('tree', { name: 'Layers' }), 'the tree is not on this screen').toBeHidden();

  // And one tab on, the vector editor, with the tree.
  await openArtwork(page);
  await expect(page.locator('.workspace-tab[data-mode="design.artwork"]')).toContainText('Draw');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'create');
  await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible();
  await expect(page.getByText('Import / Replace SVG', { exact: true }), 'and not the way in, which is Assemble’s').toBeHidden();
  const before=await page.evaluate(()=>({document:window.__BOOP_E2E__.document(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  // Layer display names are humanized ("JourneyHead"); the ID casing is not a visible contract.
  const item=page.getByRole('treeitem', { name: /journeyHead/i });
  await item.focus(); await item.press('Enter');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-id','journeyHead');
  // Section headings carry stable ids; the Appearance tab also renders its own sub-heading.
  await expect(page.locator('#context-inspector #transform-heading')).toBeVisible();
  await expect(page.locator('#context-inspector #appearance-heading')).toBeVisible();
  const after=await page.evaluate(()=>({document:window.__BOOP_E2E__.document(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  expect(after).toEqual(before);
});
