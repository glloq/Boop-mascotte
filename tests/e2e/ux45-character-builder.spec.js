import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
  await expect(page.locator('[data-part-category]')).toHaveCount(14);
  for (const id of ['presets', 'palette', 'head', 'eyes', 'pupils', 'eyelids', 'eyebrows', 'nose', 'mouth', 'ears', 'hair', 'facialHair', 'accessory', 'hands']) {
    await expect(page.locator(`[data-part-category="${id}"]`), `${id} is listed`).toBeVisible();
  }
  await expect(page.locator('[data-part-category="hands"]')).toContainText('Left hand');
  await expect(page.locator('[data-part-category="facialHair"]')).toContainText('No facial hair on this mascot yet');
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

  // A field is the artwork command, one undo step, shown on the canvas -- and
  // the eyes are a pair: the other eye mirrors it (docs/CHARACTER_BUILDER.md,
  // "Linked editing").
  await expect(inspector(page).locator('[data-part-linked]')).toBeChecked();
  await expect(inspector(page).locator('[data-part-spacing]')).toHaveValue('74');
  const x = inspector(page).locator('[data-part-transform="x"]');
  await x.fill('6');
  await x.press('Enter');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).x).toBe(6);
  await expect.poll(async () => (await baseOf(page, 'eyeLeft')).x, 'out on the right is out on the left').toBe(-6);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.history().canUndo)).toBe(true);
  const scale = inspector(page).locator('[data-part-scale]');
  await scale.fill('1.25');
  await scale.press('Enter');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).scaleX).toBe(1.25);
  expect((await baseOf(page, 'eyeRight')).scaleY).toBe(1.25);
  await expect.poll(async () => (await baseOf(page, 'eyeLeft')).scaleX).toBe(1.25);
  await scale.blur();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).scaleX).toBe(1);
  expect((await baseOf(page, 'eyeLeft')).scaleX, 'one undo took the size back on both').toBe(1);
  expect((await baseOf(page, 'eyeRight')).x, 'and only the size').toBe(6);
  await expect(scale, 'the panel redraws once the field lets go').toHaveValue('1');
  // Spacing moves the pair apart, half each, measured through the moves; Unlink edits one eye alone.
  await expect(inspector(page).locator('[data-part-spacing]')).toHaveValue('86');
  const spacing = inspector(page).locator('[data-part-spacing]');
  await spacing.fill('90');
  await spacing.press('Enter');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).x).toBe(8);
  expect((await baseOf(page, 'eyeLeft')).x).toBe(-8);
  await spacing.blur();
  await expect(spacing).toHaveValue('90');
  await inspector(page).locator('[data-part-linked]').uncheck();
  await expect(inspector(page).locator('[data-part-spacing]')).toHaveCount(0);
  await x.fill('20');
  await x.press('Enter');
  await expect.poll(async () => (await baseOf(page, 'eyeRight')).x).toBe(20);
  expect((await baseOf(page, 'eyeLeft')).x, 'the left eye stays').toBe(-8);
  await inspector(page).locator('[data-part-linked]').check();
  await expect(inspector(page).locator('[data-part-spacing]')).toHaveCount(1);
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
  // The visible edit is limited to the piece: the rest is dimmed and inert,
  // the chip offers the way back, and none of it is in the document.
  await expect(page.locator('#canvas')).toHaveAttribute('data-edit-scope', 'mouth');
  await expect(page.locator('#canvas svg svg #mouth')).toHaveAttribute('data-editor-scope', 'in');
  await expect(page.locator('#canvas svg svg #head')).toHaveAttribute('data-editor-scope', 'out');
  await expect(page.locator('#canvas svg svg #hairFront')).toHaveAttribute('data-editor-scope', 'out');
  await expect(page.locator('#canvas svg svg #hair'), 'a piece inside an outside group is out with it, unmarked').not.toHaveAttribute('data-editor-scope', /.+/);
  expect(await page.locator('#canvas svg svg #hair').evaluate((node) => getComputedStyle(node).pointerEvents)).toBe('none');
  await expect(page.locator('#return-character')).toBeVisible();
  // Inert: a click on the hair is a click on nothing, so the helper that finds a painted point cannot be used.
  const hairBox = await page.locator('#canvas svg svg #hairTop').boundingBox();
  await page.mouse.click(hairBox.x + hairBox.width / 2, hairBox.y + hairBox.height / 2);
  await page.waitForTimeout(100);
  expect((await session(page)).id).not.toBe('hairTop');
  await expect(page.locator('#canvas')).toHaveAttribute('data-edit-scope', 'mouth');
  expect((await page.evaluate(() => window.__BOOP_E2E__.document().svgMarkup)).includes('data-editor-scope')).toBe(false);
  // Back to Character brings the author back with the piece in hand, the scope lifted.
  await page.locator('#return-character').click();
  await expect.poll(() => task(page)).toBe('character');
  await expect(page.locator('#return-character')).toBeHidden();
  await expect(page.locator('#canvas')).not.toHaveAttribute('data-edit-scope', /.+/);
  await expect(page.locator('#canvas [data-editor-scope]')).toHaveCount(0);
  expect((await character(page)).piece).toBe('mouth');
  expect((await character(page)).scope).toBe(null);

  // And the tab brings the author back to the same part, tools put away.
  await inspector(page).locator('[data-part-edit-shape]').click();
  await expect.poll(() => task(page)).toBe('artwork');
  await expect(page.locator('#canvas')).toHaveAttribute('data-edit-scope', 'mouth');
  await openCharacter(page);
  await expect(page.locator('#app')).toHaveAttribute('data-canvas-tool', 'select');
  await expect(page.locator('#canvas')).not.toHaveAttribute('data-edit-scope', /.+/);
  await expect(page.locator('#return-character')).toBeHidden();
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

test('@critical presets, facial hair and the hands say what they are; a hand is placed, given a depth, mirrored, rested on a drawing, and leads to its setup', async ({ page }) => {
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
  await expect(inspector(page)).toContainText('No facial hair on this mascot yet');
  await expect(page.locator('[data-face-part="facialhair.moustache"]')).toBeVisible();

  await page.locator('[data-part-category="hands"]').click();
  await expect.poll(() => session(page)).toEqual({ id: 'handRight', ids: ['handLeft', 'handRight'] });
  await expect(inspector(page).locator('[data-hand-placement="right"]')).toBeVisible();
  // A hand is placed like any piece, with the gizmo on the canvas; its depth
  // is its own, and Mirror placement makes the other its mirror image.
  await expect(inspector(page).locator('[data-part-transform]')).toHaveCount(3);
  await expect(inspector(page).locator('[data-part-scale]')).toHaveCount(1);
  await expect(page.locator('[data-gizmo-part="outline"]'), 'the gizmo frames the hand').toHaveCount(1);
  await inspector(page).locator('[data-part-transform="x"]').fill('12');
  await inspector(page).locator('[data-part-transform="x"]').press('Enter');
  await expect.poll(async () => (await baseOf(page, 'handRight')).x).toBe(12);
  await inspector(page).locator('[data-hand-depth]').fill('0.5');
  await inspector(page).locator('[data-hand-depth]').press('Enter');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().hands.right.depth)).toBe(0.5);
  await inspector(page).locator('[data-hand-mirror]').click();
  await expect.poll(async () => (await baseOf(page, 'handLeft')).x).toBe(-12);
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().hands.left.depth)).toBe(0.5);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, 'handLeft')).x).toBe(0);
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().hands.left.depth)).toBe(0);
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().hands.right.depth)).toBe(0.5);
  // The drawings of each hand are cards; a press rests the hand on one, and the canvas shows it.
  await expect(page.locator('#part-browser [data-hand-style]')).toHaveCount(12);
  await expect(page.locator('#part-browser [data-hand-style="left:relaxed"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#part-browser [data-hand-style="left:fist"] .hand-thumb path')).not.toHaveCount(0);
  await page.locator('#part-browser [data-hand-style="left:fist"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().hands.left.styles.showing)).toBe('fist');
  await expect(page.locator('#part-browser [data-hand-style="left:fist"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => session(page)).toEqual({ id: 'handLeft', ids: ['handLeft'] });
  expect((await character(page)).hands[0]).toEqual({ side: 'left', element: 'handLeft', resting: 'fist', drawn: ['relaxed', 'open', 'fist', 'point', 'thumbsUp', 'peace'] });
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().hands.left.styles.showing)).toBe('relaxed');
  await page.locator('#part-browser [data-character-route="hand-setup"]').click();
  await expect.poll(() => task(page)).toBe('face-setup');
  await expect(page.locator('[data-setup-section="hands"]')).toHaveAttribute('open', '');
  await expect(page.locator('#hand-setup')).toBeVisible();

  // The Character tab is one press away from every other step, and comes back
  // to the part that was in hand: the left hand, since its drawing was pressed.
  await openCharacter(page);
  await expect(inspector(page).locator('[data-hand-placement="left"]')).toBeVisible();
});

test('@critical a style from the library replaces the mouth in one undo step, and smile still moves it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  await page.locator('[data-part-category="mouth"]').click();
  await expect.poll(() => session(page)).toEqual({ id: 'tongue', ids: ['mouth', 'teeth', 'tongue'] });

  // The library's mouths, as cards with a picture each, none of them current:
  // the template's mouth came from no asset.
  const styles = page.locator('[data-part-styles="mouth"]');
  await expect(styles).toBeVisible();
  await expect(styles.locator('[data-face-part]')).toHaveCount(5);
  await expect(styles.locator('.face-part-thumb')).toHaveCount(5);
  await expect(styles.locator('[data-face-part="mouth.wide"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(styles.locator('[data-face-part="mouth.wide"]')).toBeEnabled();
  await expect(styles.locator('.part-style-badge')).toHaveCount(4);
  await expect(styles.locator('.part-style-limited'), 'four of the five leave a movement out').toHaveCount(4);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas [id="mouth"]').length), 'a thumbnail shares no id with the mascot').toBe(1);

  const before = await checkpoint(page);
  const mouthPart = () => page.evaluate(() => { const part = Object.values(window.__BOOP_E2E__.document().semanticParts).find((item) => item.type === 'mouth'); return { roles: part.roles, controls: part.controls, assetId: part.assetId || null }; });
  await styles.locator('[data-face-part="mouth.wide"]').click();

  // The new mouth is on the canvas where the old one was; the old three are gone.
  await expect(page.locator('#canvas svg svg #mouth-wide')).toBeVisible();
  await expect(page.locator('#canvas svg svg #mouth-wide > #mouth')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #mouth-wide > #teeth')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #tongue')).toHaveCount(0);
  await expect.poll(() => session(page), 'the new part is in hand, as one piece: its root').toEqual({ id: 'mouth-wide', ids: ['mouth-wide'] });
  await expect(page.locator('#canvas [data-editor-selected]')).toHaveCount(1);
  await expect(page.locator('[data-gizmo-part="outline"]'), 'the gizmo frames the whole part').toHaveCount(1);
  const after = await checkpoint(page);
  expect(after.revision, 'one write').toBe(before.revision + 1);
  expect(after.history.canUndo).toBe(true);

  // The part is the same part, its roles on the new shapes, its movements kept.
  expect(await mouthPart()).toEqual({ roles: { mouth: 'mouth', teeth: 'teeth' }, controls: ['mouthOpen', 'smile', 'mouthWidth', 'teeth'], assetId: 'mouth.wide' });
  const params = await page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().params));
  for (const name of ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue', 'smileLeft']) expect(params, `${name} is still a parameter`).toContain(name);
  expect((await character(page)).categories.find((category) => category.id === 'mouth')).toEqual({ id: 'mouth', status: 'ready', partId: 'mouth', assetId: 'mouth.wide', pieces: ['mouth-wide'] });
  await expect(styles.locator('[data-face-part="mouth.wide"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(styles.locator('[data-face-part="mouth.wide"] .part-style-badge')).toHaveText('Current');
  await expect(inspector(page).locator('[data-part-style="mouth.wide"]')).toHaveText('Style: Wide');
  await expect(page.locator('#toast')).toContainText('Wide is the mouth now');

  // And `smile` moves the new mouth: the driver was made for the new drawing.
  const mouth = page.locator('#canvas svg svg #mouth-wide > #mouth');
  const rest = await mouth.getAttribute('transform');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('smile', 1));
  await expect.poll(() => mouth.getAttribute('transform')).not.toBe(rest);
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('teeth', 1));
  await expect.poll(() => page.locator('#canvas svg svg #mouth-wide > #teeth').evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
  await page.evaluate(() => { window.__BOOP_E2E__.clearLiveParam('smile'); window.__BOOP_E2E__.clearLiveParam('teeth'); });

  // One undo, and the old mouth is back, tongue and all.
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #tongue')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #mouth-wide')).toHaveCount(0);
  expect(await mouthPart()).toEqual({ roles: { mouth: 'mouth', teeth: 'teeth', tongue: 'tongue' }, controls: ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue'], assetId: null });
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.history().canUndo)).toBe(false);
  await expect(styles.locator('[data-face-part="mouth.wide"]')).toHaveAttribute('aria-pressed', 'false');
  expect((await character(page)).categories.find((category) => category.id === 'mouth').assetId).toBe(null);

  // Back on, and a point dragged (as Edit Shape's Node tool writes it): the
  // instance is the author's -- custom, still the mouth, its roles and
  // movements kept, no card current -- and the card puts the library drawing back.
  await styles.locator('[data-face-part="mouth.wide"]').click();
  await expect(page.locator('#canvas svg svg #mouth-wide > #mouth')).toHaveCount(1);
  await expect.poll(async () => (await character(page)).categories.find((category) => category.id === 'mouth').custom).toBeUndefined();
  const drawn = await page.locator('#canvas svg svg #mouth-wide > #mouth').getAttribute('d');
  await page.evaluate(([path]) => window.__BOOP_E2E__.setAuthoredPath('mouth', path), [drawn.replace(/\d/, (digit) => String((Number(digit) + 1) % 10))]);
  await expect.poll(async () => (await character(page)).categories.find((category) => category.id === 'mouth').custom).toBe(true);
  await expect(styles.locator('[data-face-part="mouth.wide"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(inspector(page).locator('[data-part-custom]')).toContainText('Reshaped by hand');
  expect(await mouthPart()).toEqual({ roles: { mouth: 'mouth', teeth: 'teeth' }, controls: ['mouthOpen', 'smile', 'mouthWidth', 'teeth'], assetId: 'mouth.wide' });
  await styles.locator('[data-face-part="mouth.wide"]').click();
  await expect(styles.locator('[data-face-part="mouth.wide"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector(page).locator('[data-part-custom]')).toHaveCount(0);

  // Saved as a part of the author's own: a card marked Mine, forgotten again.
  await inspector(page).locator('[data-disclosure="save-part"] summary').click();
  await inspector(page).locator('[data-part-save-name]').fill('My mouth');
  await expect(inspector(page).locator('[data-part-save-category]')).toHaveValue('mouth');
  await inspector(page).locator('[data-part-save]').click();
  await expect(styles.locator('[data-face-part="mouth.my-mouth"]')).toBeVisible();
  await expect(styles.locator('[data-face-part="mouth.my-mouth"] .part-style-mine')).toHaveText('Mine');
  await expect(page.locator('#toast')).toContainText('My mouth is in the library now');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('boop.faceParts') || '[]').map((item) => item.id))).toEqual(['mouth.my-mouth']);
  await page.locator('[data-face-part-forget="mouth.my-mouth"]').click();
  await expect(styles.locator('[data-face-part="mouth.my-mouth"]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('boop.faceParts') || '[]'))).toEqual([]);
});

test('@critical a pair of eyes from the library brings its pupils and its lids; a head goes on the skull; the face still turns, looks and blinks', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  const partOf = (type) => page.evaluate((t) => { const part = Object.values(window.__BOOP_E2E__.document().semanticParts).find((item) => item.type === t); return part ? { roles: part.roles, controls: part.controls, assetId: part.assetId || null } : null; }, type);
  const transformOf = (id) => page.locator(`#canvas svg svg #${id}`).getAttribute('transform');

  // Eyes: the eye groups go, pupils and lids inside them, and the new
  // drawing carries all three parts.
  await page.locator('[data-part-category="eyes"]').click();
  const card = page.locator('[data-face-part="eyes.round-small"]');
  await expect(card).toBeEnabled();
  await card.click();
  await expect(page.locator('#canvas svg svg #eyes-round-small')).toBeVisible();
  await expect(page.locator('#canvas svg svg #eyes-round-small #pupilLeft')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #eyes-round-small #lidUpperRight')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg clipPath#socketLeft')).toHaveCount(1);
  expect(await partOf('eyes')).toEqual({ roles: { leftEye: 'eyeLeft', rightEye: 'eyeRight' }, controls: ['eyeOpen'], assetId: 'eyes.round-small' });
  expect(await partOf('gaze')).toEqual({ roles: { leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }, controls: ['lookX', 'lookY', 'pupilScale'], assetId: null });
  expect((await partOf('eyelids')).roles).toEqual({ leftUpper: 'lidUpperLeft', leftLower: 'lidLowerLeft', rightUpper: 'lidUpperRight', rightLower: 'lidLowerRight' });
  await expect.poll(() => session(page)).toEqual({ id: 'eyes-round-small', ids: ['eyes-round-small'] });
  expect((await character(page)).categories.find((category) => category.id === 'pupils').pieces).toEqual(['pupilLeft', 'pupilRight']);
  // The new pupils look, the new lids blink, the new eyes turn with the head.
  const pupilRest = await transformOf('pupilLeft'), lidRest = await transformOf('lidUpperLeft'), eyeRest = await transformOf('eyeRight');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('lookX', 1));
  await expect.poll(() => transformOf('pupilLeft')).not.toBe(pupilRest);
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('eyeOpen', 0));
  await expect.poll(() => transformOf('lidUpperLeft')).not.toBe(lidRest);
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', 1));
  await expect.poll(() => transformOf('eyeRight')).not.toBe(eyeRest);
  await page.evaluate(() => { for (const name of ['lookX', 'eyeOpen', 'headX']) window.__BOOP_E2E__.clearLiveParam(name); });
  // A wink still means a wink: the side parameters survived the swap.
  const params = await page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().params));
  for (const name of ['eyeOpenLeft', 'eyeOpenRight', 'lookXLeft', 'pupilScaleRight']) expect(params).toContain(name);

  // The head: the template's head is the whole face, so the skull is what
  // goes, and the face keeps turning.
  await page.locator('[data-part-category="head"]').click();
  await page.locator('[data-face-part="head.square-soft"]').click();
  await expect(page.locator('#canvas svg svg #faceRoot > #head-square-soft > #skull')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #head')).toHaveCount(0);
  expect(await partOf('head')).toEqual({ roles: { head: 'faceRoot' }, controls: ['headX', 'headY', 'headTilt'], assetId: 'head.square-soft' });
  expect((await partOf('jaw')).roles).toEqual({ jaw: 'skull' });
  const faceRest = await transformOf('faceRoot');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headY', 1));
  await expect.poll(() => transformOf('faceRoot')).not.toBe(faceRest);
  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('headY'));
  await expect(page.locator('#canvas svg svg #eyes-round-small'), 'the eyes stayed where they were').toBeVisible();

  // Two undos, and the template's face is back, skull and eyes.
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #head')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #eyes-round-small')).toHaveCount(0);
  await expect(page.locator('#canvas svg svg #eyeLeft > #lidUpperLeft')).toHaveCount(1);
  expect((await partOf('eyes')).assetId).toBe(null);
  expect((await partOf('gaze')).roles).toEqual({ leftPupil: 'pupilLeft', rightPupil: 'pupilRight' });
});

test('@critical a head of hair from the library paints its back behind the face and moves as one', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  await page.locator('[data-part-category="hair"]').click();
  await page.locator('[data-face-part="hair.long"]').click();
  await expect(page.locator('#canvas svg svg #hair-long')).toBeVisible();
  // The back is the first thing in the face group -- behind the ears and the
  // skull -- and the fringe is on top; the template's clipped fringe group is gone.
  const order = await page.evaluate(() => [...document.querySelector('#canvas svg svg #faceRoot').children].map((node) => node.id));
  expect(order[0]).toBe('hairBack');
  expect(order.at(-1)).toBe('hair-long');
  expect(order.includes('hairFront')).toBe(false);
  expect(order.includes('hairTop')).toBe(false);
  await expect(page.locator('#canvas svg svg #hair-long > #hair')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #hair-long > #hairTop')).toHaveCount(1);
  await expect.poll(() => session(page)).toEqual({ id: 'hair-long', ids: ['hair-long'] });
  expect((await character(page)).categories.find((category) => category.id === 'hair')).toEqual({ id: 'hair', status: 'ready', partId: 'hair', assetId: 'hair.long', pieces: ['hair-long'] });
  // It sways as one, and a move in the inspector moves the back with the root.
  const rootRest = await page.locator('#canvas svg svg #hair-long > #hair').getAttribute('transform'), backRest = await page.locator('#canvas svg svg #hairBack').getAttribute('transform');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('hairSway', 1));
  await expect.poll(() => page.locator('#canvas svg svg #hair-long > #hair').getAttribute('transform')).not.toBe(rootRest);
  await expect.poll(() => page.locator('#canvas svg svg #hairBack').getAttribute('transform')).not.toBe(backRest);
  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('hairSway'));
  const x = inspector(page).locator('[data-part-transform="x"]');
  await x.fill('7');
  await x.press('Enter');
  await expect.poll(async () => (await baseOf(page, 'hair-long')).x).toBe(7);
  await expect.poll(async () => (await baseOf(page, 'hairBack')).x).toBe(7);
  await x.blur();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, 'hairBack')).x).toBe(0);
  expect((await baseOf(page, 'hair-long')).x, 'one undo step for both').toBe(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #hairFront > #hair')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #hair-long')).toHaveCount(0);
});

test('@critical Colours changes a token everywhere the face uses it, as one undo step, and a new part comes in those colours', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  const fillOf = (id) => page.locator(`#canvas svg svg #${id}`).getAttribute('fill');
  const skin = await fillOf('head');
  expect(await fillOf('lidUpperLeft')).toBe(skin);
  await page.locator('[data-part-category="palette"]').click();
  await expect.poll(() => session(page)).toEqual({ id: null, ids: [] });
  const swatch = page.locator('#part-browser [data-face-token="skin"]');
  await expect(swatch).toBeVisible();
  await expect(swatch).toContainText('Skin');
  await expect(page.locator('#part-inspector [data-face-token="outline"]')).toBeVisible();
  expect((await character(page)).palette.skin).toBe(skin);
  await swatch.click();
  const dialog = page.locator('#colour-picker');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Skin colour');
  await dialog.locator('[data-colour-hex]').fill('#88cc88');
  await dialog.locator('[data-colour-apply]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => fillOf('head')).toBe('#88cc88');
  await expect.poll(() => fillOf('lidUpperLeft')).toBe('#88cc88');
  await expect.poll(() => fillOf('earLeftShape')).toBe('#88cc88');
  expect(await fillOf('eyeWhiteLeft'), 'the whites are another token').toBe('#ffffff');
  await expect(page.locator('#toast')).toContainText('Skin is #88cc88 now');
  expect((await character(page)).palette.skin).toBe('#88cc88');
  await expect(swatch, 'read again').toHaveAttribute('title', /^#88cc88 · \d+ uses/);
  // A library head comes green: its skull plays the skin token.
  await page.locator('[data-part-category="head"]').click();
  await page.locator('[data-face-part="head.oval"]').click();
  await expect(page.locator('#canvas svg svg #skull')).toBeVisible();
  expect(await fillOf('skull')).toBe('#88cc88');
  expect(await page.locator('#canvas svg svg #skull').getAttribute('stroke'), 'and the face\'s outline').toBe(await page.locator('#canvas svg svg #earLeftEdge').getAttribute('stroke'));
  // Two undos: the skull, then the colour, everywhere.
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #head')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect.poll(() => fillOf('head')).toBe(skin);
  expect(await fillOf('earLeftShape')).toBe(skin);
  expect(await fillOf('lidUpperLeft')).toBe(skin);
});

test('@critical a face wears glasses and a hat at once, takes the hat off, and grows a moustache', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  await page.locator('[data-part-category="accessory"]').click();
  await page.locator('[data-face-part="accessory.glasses"]').click();
  await expect(page.locator('#canvas svg svg #accessory-glasses')).toBeVisible();
  await page.locator('[data-face-part="accessory.hat"]').click();
  await expect(page.locator('#canvas svg svg #accessory-hat')).toBeVisible();
  await expect(page.locator('#canvas svg svg #accessory-glasses'), 'the glasses stay on').toBeVisible();
  await expect.poll(() => session(page)).toEqual({ id: 'accessory-hat', ids: ['accessory-hat'] });
  expect((await character(page)).categories.find((category) => category.id === 'accessory')).toEqual({ id: 'accessory', status: 'ready', partId: 'accessory', assetId: 'accessory.glasses', assetIds: ['accessory.glasses', 'accessory.hat'], pieces: ['accessory-glasses', 'accessory-hat'] });
  // The hat sits above the head, on top of the hair; the glasses on the eyes.
  const rect = (selector) => page.locator(selector).evaluate((node) => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, cx: b.x + b.width / 2, cy: b.y + b.height / 2, bottom: b.y + b.height }; });
  const [hat, head, glasses, eye] = [await rect('#canvas svg svg #accessory-hat'), await rect('#canvas svg svg #head'), await rect('#canvas svg svg #accessory-glasses'), await rect('#canvas svg svg #eyeWhiteLeft')];
  expect(hat.y).toBeLessThan(head.y);
  expect(Math.abs(hat.cx - head.cx)).toBeLessThan(6);
  expect(Math.abs(glasses.cy - eye.cy)).toBeLessThan(8);
  const order = await page.evaluate(() => [...document.querySelector('#canvas svg svg #faceRoot').children].map((node) => node.id));
  expect(order.indexOf('accessory-hat')).toBeGreaterThan(order.indexOf('hairFront'));
  // Remove takes the hat off, as one undo step.
  await inspector(page).locator('[data-part-remove]').click();
  await expect(page.locator('#canvas svg svg #accessory-hat')).toHaveCount(0);
  await expect(page.locator('#canvas svg svg #accessory-glasses')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('Hat is off');
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #accessory-hat')).toBeVisible();
  // Facial hair is a part now: a moustache under the nose.
  await page.locator('[data-part-category="facialHair"]').click();
  await page.locator('[data-face-part="facialhair.moustache"]').click();
  await expect(page.locator('#canvas svg svg #facial-hair-moustache')).toBeVisible();
  const [moustache, nose, mouth] = [await rect('#canvas svg svg #facial-hair-moustache'), await rect('#canvas svg svg #nose'), await rect('#canvas svg svg #mouth')];
  expect(moustache.cy).toBeGreaterThan(nose.cy);
  expect(moustache.cy).toBeLessThan(mouth.cy);
  expect(await page.evaluate(() => Object.values(window.__BOOP_E2E__.document().semanticParts).find((part) => part.type === 'facialHair')?.roles)).toEqual({ facialHair: 'facialHair' });
});

test('@critical a preset dresses the face as one undo step, the browser knows which one it wears, and the face can be saved as one', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  await page.locator('[data-part-category="presets"]').click();
  await expect(page.locator('[data-face-preset]')).toHaveCount(6);
  await expect(page.locator('[data-face-preset="professor"] .face-preset-thumb svg')).toHaveCount(1);
  await expect(page.locator('[data-preset-reset]')).toBeDisabled();
  expect((await character(page)).preset).toBe(null);
  const fillOf = (id) => page.locator(`#canvas svg svg #${id}`).getAttribute('fill');
  await page.locator('[data-face-preset="robot"]').click();
  await expect(page.locator('#canvas svg svg #skull')).toBeVisible();
  await expect(page.locator('#canvas svg svg #accessory-bow-tie')).toBeVisible();
  await expect(page.locator('#canvas svg svg #brows-flat'), 'flat brows: straight strokes, a box as tall as nothing, so attached rather than visible').toBeAttached();
  await expect.poll(() => fillOf('skull'), 'painted in the robot palette').toBe('#c9d1d9');
  await expect.poll(() => fillOf('eyeWhiteLeft')).toBe('#e6f0ff');
  await expect(page.locator('[data-face-preset="robot"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-preset-reset]')).toBeEnabled();
  await expect(page.locator('#toast')).toContainText('Robot is on');
  expect((await character(page)).preset).toBe('robot');
  expect((await character(page)).palette.skin).toBe('#c9d1d9');
  // The eyes still blink, the face still turns: the rig came with the parts.
  const lidRest = await page.locator('#canvas svg svg #lidUpperLeft').getAttribute('transform');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('eyeOpen', 0));
  await expect.poll(() => page.locator('#canvas svg svg #lidUpperLeft').getAttribute('transform')).not.toBe(lidRest);
  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('eyeOpen'));
  // Saved as the author's own, with a hat on; forgotten again.
  await page.locator('[data-part-category="accessory"]').click();
  await page.locator('[data-face-part="accessory.hat"]').click();
  await expect(page.locator('#canvas svg svg #accessory-hat')).toBeVisible();
  await page.locator('[data-part-category="presets"]').click();
  expect((await character(page)).preset).toBe(null);
  await page.locator('[data-preset-name]').fill('Robot in a hat');
  await page.locator('[data-preset-name]').press('Enter');
  await expect(page.locator('[data-face-preset="robot-in-a-hat"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-face-preset="robot-in-a-hat"] .part-style-custom')).toHaveCount(0);
  await expect(page.locator('[data-face-preset="robot-in-a-hat"] .part-style-badge')).toHaveText('Current');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('boop.facePresets') || '[]').map((item) => item.id))).toEqual(['robot-in-a-hat']);
  await page.locator('[data-preset-forget="robot-in-a-hat"]').click();
  await expect(page.locator('[data-face-preset="robot-in-a-hat"]')).toHaveCount(0);
  // One undo takes the hat off; one more takes the whole robot off.
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #accessory-hat')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#canvas svg svg #head')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg #skull')).toHaveCount(0);
  await expect.poll(() => fillOf('head')).toBe('#f9d9b0');
  expect((await character(page)).preset).toBe(null);
});

test('@critical a project saved before the library opens with its library parts recognised, and the rest as the author\'s own', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openCharacter(page);
  await page.locator('[data-part-category="mouth"]').click();
  await page.locator('[data-part-styles="mouth"] [data-face-part="mouth.wide"]').click();
  await expect(page.locator('#canvas svg svg #mouth-wide')).toBeVisible();
  // Saved, then every word about the library taken off the parts: what a project from before the library carries.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Project' }).click();
  const saved = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
  const parts = saved.document.editor.semanticParts;
  expect(parts.mouth.assetId).toBe('mouth.wide');
  for (const part of Object.values(parts)) for (const key of ['assetId', 'assetRoot', 'assetMount', 'assetShape', 'assetFit', 'assetDetached']) delete part[key];
  await page.locator('#project-file').setInputFiles({ name: 'old-face.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator('#toast')).toContainText('One part is the library\'s own drawing, and the Character Builder knows it.');
  await openCharacter(page);
  await page.locator('[data-part-category="mouth"]').click();
  expect((await character(page)).categories.find((category) => category.id === 'mouth')).toEqual({ id: 'mouth', status: 'ready', partId: 'mouth', assetId: 'mouth.wide', pieces: ['mouth-wide'] });
  await expect(page.locator('[data-part-styles="mouth"] [data-face-part="mouth.wide"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector(page).locator('[data-part-custom]')).toHaveCount(0);
  // The template's own nose is nobody's asset: a part with no card current, as before.
  expect((await character(page)).categories.find((category) => category.id === 'nose')).toEqual({ id: 'nose', status: 'ready', partId: 'nose', assetId: null, pieces: ['nose'] });
});
