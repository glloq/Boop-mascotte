import { test, expect } from '@playwright/test';
import { hitTestablePoint, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The Character Builder shell (docs/CHARACTER_BUILDER.md, PR 1).
 *
 * The simple surface: the parts a person names on the left, the same canvas
 * in the middle, the part in hand on the right. A press on a part is a
 * selection and never a write; a field is the artwork command the Artwork
 * inspector runs, one undo step; Edit Shape and Advanced are the existing
 * interface, on the same piece. Everything here is measured in the browser,
 * on the template face, so the canvas is proved to frame and move a part in
 * this workspace the way it does in Artwork.
 */
const session = (page) => page.evaluate(() => { const s = window.__BOOP_E2E__.session(); return { id: s.selectedId, ids: s.selectedIds }; });
const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());
const character = (page) => page.evaluate(() => window.__BOOP_E2E__.character());
const baseOf = (page, id) => page.evaluate((i) => { const t = window.__BOOP_E2E__.document().elements[i]?.baseTransform; return t ? { x: t.x, y: t.y, rotation: t.rotation, scaleX: t.scaleX, scaleY: t.scaleY } : null; }, id);
const checkpoint = (page) => page.evaluate(() => ({ revision: window.__BOOP_E2E__.documentRevisions().persistent, history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
const inspector = (page) => page.locator('#part-inspector');

async function openCharacter(page) {
  await page.locator('[data-task="character"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'character');
  await expect(page.locator('#app')).toHaveAttribute('data-stage', 'create');
  await expect(page.locator('#part-browser[data-part-ready="true"]')).toBeVisible();
}

async function dragBy(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test('@critical the Character Builder is a step of Create: parts, the canvas, and the part in hand', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // The template still lands on Artwork; the builder is one tab away.
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'create');
  await openCharacter(page);
  // The top bar took the new step without wrapping or overlapping: everything
  // below it is measured at absolute coordinates by other suites, and a tab
  // under the search button is a tab nobody can press.
  expect((await page.locator('header.topbar').boundingBox()).height).toBeLessThanOrEqual(64);
  const bar = await page.evaluate(() => {
    const edges = [...document.querySelectorAll('.stage-nav .workspace-tab, .stage-nav .stage-tab')].map((tab) => tab.getBoundingClientRect());
    return { left: Math.min(...edges.map((box) => box.left)), right: Math.max(...edges.map((box) => box.right)), brand: document.querySelector('#home-button').getBoundingClientRect().right, actions: document.querySelector('#search-button').getBoundingClientRect().left };
  });
  expect(bar.left).toBeGreaterThanOrEqual(bar.brand);
  expect(bar.right).toBeLessThanOrEqual(bar.actions);

  // The simple surface: no layer tree, no drawing tools, the part browser.
  await expect(page.locator('.character-tools')).toBeVisible();
  await expect(page.locator('.structure-tools')).toBeHidden();
  await expect(page.locator('.design-toolbar')).toBeHidden();
  await expect(page.locator('#tool-options')).toBeHidden();
  await expect(page.locator('[data-part-category]')).toHaveCount(13);
  for (const id of ['presets', 'head', 'eyes', 'pupils', 'eyelids', 'eyebrows', 'nose', 'mouth', 'ears', 'hair', 'facialHair', 'accessory', 'hands']) {
    await expect(page.locator(`[data-part-category="${id}"]`), `${id} is listed`).toBeVisible();
  }
  await expect(page.locator('[data-part-category="hands"]')).toContainText('Left hand');
  await expect(page.locator('[data-part-category="facialHair"]')).toContainText('Coming with the part library');
  await expect(inspector(page)).toContainText('Pick a part on the left, or click the mascot');

  // A press on a part selects every piece that plays it, on the canvas and in
  // the inspector at once -- and writes nothing.
  const before = await checkpoint(page);
  await page.locator('[data-part-category="eyes"]').click();
  await expect.poll(() => session(page)).toEqual({ id: 'eyeRight', ids: ['eyeLeft', 'eyeRight'] });
  await expect(page.locator('[data-part-category="eyes"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#canvas [data-editor-selected]')).toHaveCount(2);
  await expect(page.locator('[data-multi-select] .multi-select-box'), 'the canvas frames the pair in this workspace').toHaveCount(1);
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'artwork');
  await expect(page.locator('#context-inspector-heading')).toHaveText('Part Inspector');
  await expect(page.locator('[data-inspector-adapter="character"]')).toBeVisible();
  await expect(page.locator('#inspector'), 'the Artwork inspector stays out of the simple surface').toBeHidden();
  await expect(inspector(page).locator('[data-part-subject="eyes"]')).toContainText('Eyes');
  await expect(inspector(page).locator('[data-part-piece="eyeRight"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await checkpoint(page)).toEqual(before);

  // A field is the artwork command, one undo step, shown on the canvas.
  const x = inspector(page).locator('[data-part-transform="x"]');
  await x.fill('6');
  await x.press('Enter');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).x).toBe(6);
  expect((await baseOf(page, 'eyeLeft')).x, 'the other eye stays: linked editing is a later step').toBe(0);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.history().canUndo)).toBe(true);
  const scale = inspector(page).locator('[data-part-scale]');
  await scale.fill('1.25');
  await scale.press('Enter');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).scaleX).toBe(1.25);
  expect((await baseOf(page, 'eyeRight')).scaleY).toBe(1.25);
  await scale.blur();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).scaleX).toBe(1);
  expect((await baseOf(page, 'eyeRight')).x, 'one undo took only the size back').toBe(6);
  await expect(scale, 'the panel redraws once the field lets go').toHaveValue('1');
  await expect(inspector(page).locator('[data-part-colour]').first()).toBeVisible();

  // A click on the mascot lands the browser and the inspector on that part.
  const mouth = await hitTestablePoint(page.locator('#canvas svg svg #mouth'));
  await page.mouse.click(mouth.x, mouth.y);
  await expect.poll(() => session(page)).toEqual({ id: 'mouth', ids: ['mouth'] });
  await expect(page.locator('[data-part-category="mouth"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-part-category="eyes"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(inspector(page).locator('[data-part-subject="mouth"]')).toContainText('Mouth');
  expect((await character(page)).active).toBe('mouth');
  expect((await character(page)).piece).toBe('mouth');

  // Edit Shape is Artwork, on this piece, with the Node tool on its points.
  await inspector(page).locator('[data-part-edit-shape]').click();
  await expect.poll(() => task(page)).toBe('artwork');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'create');
  await expect(page.locator('#app')).toHaveAttribute('data-canvas-tool', 'node');
  expect((await session(page)).id).toBe('mouth');
  await expect(page.locator('#context-inspector-heading')).toHaveText('Artwork Inspector');
  await expect(page.locator('#context-inspector #transform-heading')).toBeVisible();
  await expect(page.locator('.design-toolbar')).toBeVisible();

  // And the tab brings the author back to the same part, tools put away.
  await openCharacter(page);
  await expect(page.locator('#app')).toHaveAttribute('data-canvas-tool', 'select');
  await expect(inspector(page).locator('[data-part-subject="mouth"]')).toContainText('Mouth');

  // Advanced is the existing interface, on the same part.
  await page.locator('[data-character-advanced="artwork"]').click();
  await expect.poll(() => task(page)).toBe('artwork');
  expect((await session(page)).id).toBe('mouth');
  await openCharacter(page);
  await page.locator('[data-character-advanced="face-setup"]').click();
  await expect.poll(() => task(page)).toBe('face-setup');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-part');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-id', 'mouth');
});

test('@critical a part is dragged and nudged on the canvas in the builder, one undo step a gesture', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  // A pair: the press lands on one pupil, a little off its centre so it is the
  // pupil's own art under the pointer and not the pivot handle over it.
  await page.locator('[data-part-category="pupils"]').click();
  await expect.poll(() => session(page)).toEqual({ id: 'pupilRight', ids: ['pupilLeft', 'pupilRight'] });
  await expect(page.locator('[data-multi-select] .multi-select-box')).toHaveCount(1);
  const box = await page.locator('#canvas svg svg #pupilLeft').boundingBox();
  const press = { x: box.x + box.width * 0.7, y: box.y + box.height / 2 };
  await dragBy(page, press, 30, 12);
  const [left, right] = [await baseOf(page, 'pupilLeft'), await baseOf(page, 'pupilRight')];
  expect(left.x).toBeGreaterThan(0);
  expect(left.y).toBeGreaterThan(0);
  expect(Math.abs(left.x - right.x)).toBeLessThan(0.01);
  expect(Math.abs(left.y - right.y)).toBeLessThan(0.01);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, 'pupilLeft')).x).toBe(0);
  expect(await baseOf(page, 'pupilRight')).toMatchObject({ x: 0, y: 0 });

  // A click picks one of them; the gizmo frames it, and a drag moves it alone.
  await page.mouse.click(press.x, press.y);
  await expect.poll(() => session(page)).toEqual({ id: 'pupilLeft', ids: ['pupilLeft'] });
  await expect(page.locator('[data-gizmo-part="outline"]'), 'the gizmo frames the part').toHaveCount(1);
  await expect(inspector(page).locator('[data-part-piece="pupilLeft"]')).toHaveAttribute('aria-pressed', 'true');
  await dragBy(page, press, 30, 12);
  const moved = await baseOf(page, 'pupilLeft');
  expect(moved.x).toBeGreaterThan(0);
  expect(moved.y).toBeGreaterThan(0);
  expect((await baseOf(page, 'pupilRight')).x).toBe(0);
  await expect(inspector(page).locator('[data-part-transform="x"]')).not.toHaveValue('0');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, 'pupilLeft')).x).toBe(0);
  expect((await baseOf(page, 'pupilLeft')).y).toBe(0);

  // The arrow keys nudge the part, as they do in Artwork; Delete deletes nothing here.
  await page.locator('#canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await baseOf(page, 'pupilLeft')).x).toBe(1);
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => (await baseOf(page, 'pupilLeft')).y).toBe(10);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => Boolean(window.__BOOP_E2E__.document().elements.pupilLeft))).toBe(true);
  await expect(inspector(page).locator('[data-part-transform="y"]')).toHaveValue('10');
});

test('presets, facial hair and the hands say what they are, and the hands lead to their setup', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  await page.locator('[data-part-category="eyes"]').click();
  await expect.poll(async () => (await session(page)).ids.length).toBe(2);

  await page.locator('[data-part-category="presets"]').click();
  await expect.poll(() => session(page)).toEqual({ id: null, ids: [] });
  await expect(page.locator('[data-character-preset="basic"]')).toBeVisible();
  await expect(inspector(page)).toContainText('Choose a face on the left');
  await expect(page.locator('#context-inspector-heading')).toHaveText('Character');

  await page.locator('[data-part-category="facialHair"]').click();
  await expect(inspector(page)).toContainText('Coming with the part library');

  await page.locator('[data-part-category="hands"]').click();
  await expect.poll(() => session(page)).toEqual({ id: 'handRight', ids: ['handLeft', 'handRight'] });
  await expect(inspector(page).locator('[data-hand-placement="right"]')).toBeVisible();
  await expect(inspector(page).locator('[data-part-transform]')).toHaveCount(0);
  await page.locator('#part-browser [data-character-route="hand-setup"]').click();
  await expect.poll(() => task(page)).toBe('face-setup');
  await expect(page.locator('[data-setup-section="hands"]')).toHaveAttribute('open', '');
  await expect(page.locator('#hand-setup')).toBeVisible();

  // The Character tab is one press away from every other step, and comes back
  // to the part that was in hand.
  await openCharacter(page);
  await expect(inspector(page).locator('[data-hand-placement="right"]')).toBeVisible();
});
