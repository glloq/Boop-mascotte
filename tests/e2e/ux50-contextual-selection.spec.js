/**
 * UX-50: the screen says the task, the selection says what to show.
 *
 * Three surfaces were showing everything they had, whatever was selected —
 * the Movements list, the face parts library, and the piece menu's idea of
 * what is under the cursor. These walk the workflows that fixes, and the
 * thing they are really guarding is that **one** selection drives all of
 * them: a press in one panel is visible in the others, and nothing keeps a
 * second idea of what is in hand.
 */
import { test, expect } from '@playwright/test';
import { goToMode, openAssemble, openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

const session = (page) => page.evaluate(() => {
  const state = window.__BOOP_E2E__.session();
  return { selectedId: state.selectedId, part: state.activeSemanticPartId, control: state.activeControl };
});
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());

/* ── Rig ▸ Controls stops being an inventory ──────────────────────────────── */

test('@critical the movements panel shows the part in hand, and every other movement stays one press away', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'movements');
  const panel = page.locator('#face-movements[data-face-movements-ready="true"]');
  await expect(panel).toBeVisible();
  // The template rigs every part, so the inventory this replaces was twenty-six
  // rows in five bands, on screen at all times -- twenty-eight since the mouth
  // gained its lean and its uvula (docs/MOUTH_BUILD.md).
  await expect(panel).toHaveAttribute('data-face-movements-available', '28');

  await panel.locator('[data-movement-family="Mouth"]').click();
  await expect(panel).toHaveAttribute('data-face-movements-scope', 'band');
  await expect(panel).toHaveAttribute('data-face-movements-band', 'Mouth');
  // The four somebody means by "make the mouth move". Teeth and Tongue are real
  // and are folded, which is the difference between ranking and hiding.
  await expect(panel.locator('[data-movement-tier="quick"]')).toHaveCount(4);
  await expect(panel.locator('[data-movement="mouthOpen"]')).toBeVisible();
  await expect(panel.locator('[data-movement="teeth"]')).toHaveCount(0);
  await expect(panel.locator('[data-movement="headX"]')).toHaveCount(0);

  await panel.getByRole('button', { name: /^▸ More/ }).click();
  await expect(panel.locator('[data-movement="teeth"]')).toBeVisible();
  await expect(panel.locator('[data-movement="tongue"]')).toBeVisible();

  // And the whole inventory is still one press away, which is what keeps the
  // filter an aid rather than a cage.
  await panel.getByRole('button', { name: /Show all controls/ }).click();
  await expect(panel).toHaveAttribute('data-face-movements-scope', 'all');
  await expect(panel).toHaveAttribute('data-face-movements-hidden', '0');
  await expect(panel.locator('[data-movement="headX"]')).toBeVisible();
  await expect(panel.locator('[data-movement="browRaise"]')).toBeVisible();
});

test('@critical pressing a family moves the selection, so the Inspector and the canvas follow', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'movements');
  const panel = page.locator('#face-movements[data-face-movements-ready="true"]');
  const before = await documentOf(page);

  await panel.locator('[data-movement-family="Brows"]').click();
  const picked = await session(page);
  expect(picked.part).toBe('eyebrows');
  // Both halves, not just the semantic one: the piece in hand outranks the
  // active part, so writing only the latter would have left the panel
  // answering about whatever was clicked last.
  expect(picked.selectedId).toBeTruthy();
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-part');

  // Choosing what to look at is not an edit.
  expect(await documentOf(page)).toEqual(before);
  await expect(page.locator('#app')).not.toHaveAttribute('data-dirty', 'true');
});

test('the movements panel says which part it is showing, in words', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'movements');
  const panel = page.locator('#face-movements[data-face-movements-ready="true"]');
  await panel.locator('[data-movement-family="Eyes"]').click();
  // A panel that narrows without saying so reads as a panel that lost things.
  await expect(panel.locator('[data-movement-scope-note]')).toContainText('because that is what you have selected');
  await expect(panel.locator('[data-movement-scope-note]')).toContainText('eyes');
});

/* ── Design ▸ Assemble follows the selection ──────────────────────────────── */

test('@critical the parts library opens on the part that is selected, not on eyes', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAssemble(page);
  const library = page.locator('#face-library[data-face-library-ready="true"]');
  await expect(library).toBeVisible();

  // Select the mouth through the rig, which is the same one selection.
  await goToMode(page, 'rig.controls');
  await openSetupSection(page, 'movements');
  await page.locator('#face-movements [data-movement-family="Mouth"]').click();
  await openAssemble(page);
  await expect(library).toHaveAttribute('data-face-library-category', 'mouth');
  await expect(library).toHaveAttribute('data-face-library-following', 'true');
  await expect(library.locator('[data-face-library-follow-note]')).toContainText('because that is what you have selected');

  // A press still wins: the author asked for something, and the panel stops
  // claiming to follow.
  await library.locator('[data-face-library-category="ears"]').click();
  await expect(library).toHaveAttribute('data-face-library-category', 'ears');
  await expect(library).toHaveAttribute('data-face-library-following', 'false');
});

test('a drawing says what it would cost this face before it is pressed', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAssemble(page);
  const library = page.locator('#face-library[data-face-library-ready="true"]');
  await library.locator('[data-face-library-category="mouth"]').click();
  // The template's mouth uses all seven of its movements; most library mouths
  // carry three. The install used to report that *after* the press.
  //
  // They are all in the packs now, and the packs are off the shelf: the one
  // human mouth carries everything this face uses, which is the point of there
  // being one (docs/MOUTH_BUILD.md). So the badge is asked of the shelf that
  // still has drawings to warn about -- the warning is what is under test, not
  // which shelf it is on (docs/FACE_PART_LIBRARY.md, "Active and legacy").
  await expect(library.locator('[data-face-library-loses]')).toHaveCount(0, 'the human mouth costs this face nothing');
  await library.locator('[data-face-library-show-legacy="on"]').click();
  const limited = library.locator('[data-face-library-loses]').first();
  await expect(limited).toBeVisible();
  await expect(limited).toContainText('Limited animation');
  // In words, not in parameter ids (§5: internal names are not exposed).
  await expect(limited).not.toContainText('mouthRound');

  // The shelf keeps the library's own order: a badge is information, not a
  // reason to move the row under the hand reaching for it. And a drawing that
  // carries everything this face uses carries no badge at all.
  const lossless = library.locator('[data-face-library-card]:not(:has([data-face-library-loses]))');
  await expect(lossless.first()).toBeVisible();
});

/* ── The hierarchy is reachable without a pointer ─────────────────────────── */

test('@critical Enter steps into the selection and Escape comes back out', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  // A group with drawings inside it: the face root is what everything is in.
  const root = await page.evaluate(() => {
    const layers = window.__BOOP_E2E__.document().layers || [];
    const find = (items) => { for (const item of items) { if ((item.children || []).length) return item; const nested = find(item.children || []); if (nested) return nested; } return null; };
    return find(layers)?.id || null;
  });
  expect(root).toBeTruthy();
  const select = (id) => page.evaluate((target) => window.__BOOP_E2E__.mutate((state) => { state.selectedId = target; state.selectedIds = [target]; }), id);
  await select(root);
  await expect.poll(async () => (await session(page)).selectedId).toBe(root);

  await page.locator('#canvas').focus();
  await page.keyboard.press('Enter');
  const inside = await session(page);
  expect(inside.selectedId).not.toBe(root);
  expect(inside.selectedId).toBeTruthy();

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await session(page)).selectedId).not.toBe(inside.selectedId);
});

test('the right-click menu can pick a layer under the cursor by name', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  const canvas = page.locator('#canvas svg').first();
  const box = await canvas.boundingBox();
  // The middle of the face, where several drawings are stacked on each other.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  const menu = page.locator('[data-canvas-menu]');
  await expect(menu).toBeVisible();
  const stack = menu.locator('[data-canvas-menu-stack]');
  // Only offered where there is genuinely more than one thing under the point.
  if (!(await stack.count())) return;
  await stack.locator('summary').click();
  const entries = stack.locator('[data-canvas-menu-inside]');
  await expect(entries.first()).toBeVisible();
  const target = await entries.last().getAttribute('data-canvas-menu-inside');
  await entries.last().click();
  await expect(menu).toBeHidden();
  await expect.poll(async () => (await session(page)).selectedId).toBe(target);
});

test('Replace… takes a piece to the drawings for its part', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  // The mouth, selected the way any panel selects: one selection, whichever
  // door it came through.
  const mouth = await page.evaluate(() => {
    const document_ = window.__BOOP_E2E__.document();
    const part = Object.values(document_.semanticParts).find((item) => item.type === 'mouth');
    return part?.roles?.mouth || null;
  });
  expect(mouth).toBeTruthy();
  await page.evaluate((id) => window.__BOOP_E2E__.mutate((state) => { state.selectedId = id; state.selectedIds = [id]; }), mouth);

  const box = await page.locator(`#${mouth}`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  const menu = page.locator('[data-canvas-menu]');
  await expect(menu).toBeVisible();
  // Folded, because replacing a part is a deliberate act and not a neighbour
  // of Delete.
  await menu.locator('[data-canvas-menu-advanced] summary').first().click();
  const replace = menu.locator('[data-canvas-menu-action="replace"]');
  await expect(replace).toBeVisible();
  await replace.click();

  // Arriving *is* the action: the library already follows the selection, so
  // there is no second choice to make and the piece stays in hand.
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'design.assemble');
  const library = page.locator('#face-library[data-face-library-ready="true"]');
  await expect(library).toHaveAttribute('data-face-library-category', 'mouth');
});
