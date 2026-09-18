import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { goToArtwork, openFreshEditor } from './editor-helpers.js';
import { readZip } from '../../project/editor/core/export/zip.js';

/** The one asset the project holds, as the archive will name it. */
const assetId = (page) => page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().assets)[0]);

/**
 * Importing a picture, in a browser.
 *
 * The unit suite proved every piece of this and the feature was still broken
 * end to end: the asset store was handed raw bytes where `createObjectURL`
 * takes a `Blob`, and `asset:` was reaching the live document where a browser
 * tries to fetch it. Neither is visible without a browser, so this is where
 * they are caught from now on.
 */
const fixture = (name) => fileURLToPath(new URL(`../../project/editor/core/tests/fixtures/assets/${name}`, import.meta.url));
const PICTURE = fixture('alpha-24x17.webp');
const OTHER = fixture('alpha-16x16.png');

/** Anything the browser refused to fetch, and anything that threw. */
const watchForTrouble = (page) => {
  const trouble = [];
  page.on('pageerror', (error) => trouble.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => trouble.push(`requestfailed: ${request.url().slice(0, 60)} :: ${request.failure()?.errorText || ''}`));
  return trouble;
};

const openReadyMadeFace = async (page, options = {}) => {
  await openFreshEditor(page, options);
  // By what it is rather than by what it is called: the finished mascot moved
  // under "No pictures to hand?" when the first page started asking for
  // pictures (V5-04), and these tests do not care what the link says.
  await page.locator('[data-home] [data-template-id="basic"]').click();
  // The canvas has a project on it, which is the state every test below needs.
  await expect(page.locator('#app[data-project-loaded="true"], #app[data-mode]')).toHaveCount(1);
  await expect.poll(() => page.locator('#canvas svg, .canvas svg, svg').count()).toBeGreaterThan(0);
};

const paintedHrefs = (page) => page.locator('svg image').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') || ''));

test('@critical a picture is imported, painted, and never leaves a reference the browser will chase', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page);

  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);

  // Painted through an object URL, and holding the reference beside it so the
  // document is stored pointing at the asset rather than at this tab.
  const image = page.locator('svg image').first();
  await expect(image).toHaveAttribute('href', /^blob:/);
  await expect(image).toHaveAttribute('data-editor-asset', /^asset:[0-9a-f]{8,}$/);
  await expect(image).toBeVisible();

  // `asset:` must never be fetchable: a browser starts loading an href the
  // moment the markup is parsed, and reports ERR_UNKNOWN_URL_SCHEME.
  expect(trouble).toEqual([]);
});

test('@critical a picture survives a reload, and comes back painted', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page);
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);
  // Wait for the draft to actually land. `Saved` is what the pill says before
  // anything has happened, so matching it too would be waiting for nothing --
  // which is how this test first passed while reloading into an empty editor.
  await expect(page.locator('#save-state')).toContainText(/Autosaved/i);

  await page.reload();
  await page.locator('.file-menu > summary').first().click();
  await page.locator('#recover-autosave').click();

  await expect(page.locator('svg image')).toHaveCount(1);
  // The gap this covers: only the package path used to fetch assets, so a
  // recovered draft came back with its pictures blank.
  expect(await paintedHrefs(page)).toEqual([expect.stringMatching(/^blob:/)]);
  expect(trouble).toEqual([]);
});

test('@critical a picture is replaced without the piece changing', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page);
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);

  const image = page.locator('svg image').first();
  const before = await image.evaluate((node) => ({
    reference: node.getAttribute('data-editor-asset'),
    box: ['x', 'y', 'width', 'height'].map((name) => node.getAttribute(name)).join(',')
  }));

  await image.click({ force: true });
  await page.setInputFiles('[data-replace-picture]', OTHER);
  await expect(image).toHaveAttribute('data-editor-asset', /^asset:/);

  const after = await image.evaluate((node) => ({
    reference: node.getAttribute('data-editor-asset'),
    box: ['x', 'y', 'width', 'height'].map((name) => node.getAttribute(name)).join(',')
  }));
  expect(after.reference).not.toBe(before.reference);
  expect(after.box).toBe(before.box);
  await expect(image).toHaveAttribute('href', /^blob:/);
  expect(trouble).toEqual([]);
});

test('@critical a project with pictures saves as a package and opens without them', async ({ page, context }) => {
  await openReadyMadeFace(page);
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save Project' }).first().click()
  ]);
  // A JSON snapshot references pictures and carries none, so a project with
  // pictures has to come out as a package.
  expect(download.suggestedFilename()).toBe('mascot.boop');
  const saved = await download.path();

  // A different browsing context: no asset store, nothing kept from before.
  const fresh = await context.browser().newContext({ acceptDownloads: true });
  const other = await fresh.newPage();
  const trouble = watchForTrouble(other);
  await other.goto(page.url().split('#')[0]);
  await other.locator('.file-menu > summary').first().click();
  await other.setInputFiles('#project-file', saved);

  await expect(other.locator('svg image')).toHaveCount(1);
  await expect(other.locator('svg image').first()).toHaveAttribute('href', /^blob:/);
  expect(trouble).toEqual([]);
  await fresh.close();
});

test('@critical a mascot of pictures exports as one archive that carries them', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page, { e2e: true });
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);

  await page.getByRole('button', { name: 'Export' }).first().click();
  // A dozen files that each have to land in `assets/` or nothing draws is a
  // way of handing someone a broken mascot, so the archive is offered first.
  await expect(page.locator('[data-download-artifact]').first()).toHaveText(/mascot-export\.zip/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-download-artifact="mascot-export.zip"]').click()
  ]);
  expect(download.suggestedFilename()).toBe('mascot-export.zip');

  // Opened, not just named. Reading the pictures out of the store is the one
  // asynchronous step in a download, and it lives in a loop that no test
  // reached: the unit suite feeds `createExportArtifacts` a map it built
  // itself, and this asserted a filename. A zip called `mascot-export.zip`
  // with nothing in it passes both.
  const entries = await readZip(new Uint8Array(readFileSync(await download.path())));
  expect([...entries.keys()].sort()).toEqual(['assets/' + (await assetId(page)) + '.webp', 'mascot.svg', 'rig.json', 'runtime.js']);
  // Byte for byte the file that was imported, so the page draws the picture
  // the author chose rather than something re-encoded on the way out.
  expect(Buffer.from(entries.get('assets/' + (await assetId(page)) + '.webp'))).toEqual(readFileSync(PICTURE));
  // And the artwork points at the file rather than at a scheme no browser has.
  const svg = new TextDecoder().decode(entries.get('mascot.svg'));
  expect(svg).not.toMatch(/asset:/);
  expect(svg).toContain('assets/' + (await assetId(page)) + '.webp');
  expect(trouble).toEqual([]);
});

test('@critical a picture dropped on the mascot is added where it was dropped on', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page, { e2e: true });

  // The gesture people reach for first. Built in the page, because a real
  // `DataTransfer` is the only thing the handler is written against.
  const bytes = [...readFileSync(PICTURE)];
  // Aimed well away from the middle, because the middle is where a picture
  // lands when nobody says otherwise — and for a while that is what a drop did
  // too, while this test's name said it did not.
  const box = await page.locator('#canvas').boundingBox();
  const aim = { clientX: Math.round(box.x + box.width * 0.3), clientY: Math.round(box.y + box.height * 0.72) };
  const hinted = await page.evaluate(({ bytes, aim }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.webp', { type: 'image/webp' }));
    const canvas = document.querySelector('#canvas');
    canvas.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true, ...aim }));
    canvas.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, ...aim }));
    const showed = canvas.classList.contains('picture-drop-over');
    canvas.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, ...aim }));
    return showed;
  }, { bytes, aim });

  expect(hinted, 'the canvas says it will take the drop').toBe(true);
  await expect(page.locator('svg image')).toHaveCount(1);
  await expect(page.locator('svg image').first()).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('#canvas.picture-drop-over')).toHaveCount(0);

  // Where it was dropped, which is what this test is named after: the picture's
  // centre lands under the pointer, in artwork units, rather than in the middle
  // of the artboard.
  const node = page.locator('svg image').first();
  const placed = await node.evaluate((image) => ({
    cx: Number(image.getAttribute('x')) + Number(image.getAttribute('width')) / 2,
    cy: Number(image.getAttribute('y')) + Number(image.getAttribute('height')) / 2
  }));
  const dropped = await page.evaluate(({ aim }) => window.__BOOP_E2E__.artworkPointAt(aim.clientX, aim.clientY), { aim });
  expect(Math.abs(placed.cx - dropped.x)).toBeLessThan(1);
  expect(Math.abs(placed.cy - dropped.y)).toBeLessThan(1);
  expect(trouble).toEqual([]);
});

test('@critical a picture cuts by its transparency, and the cut survives a reload', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openFreshEditor(page, { e2e: true });
  await page.evaluate(() => window.__BOOP_E2E__.openProject.template('basic'));
  await page.setInputFiles('#artwork-image-file', fixture('opaque-48x32.webp'));
  await expect(page.locator('svg image')).toHaveCount(1);
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(2);
  await page.evaluate(() => window.__BOOP_E2E__.navigate('design.artwork'));

  const ids = await page.locator('svg image').evaluateAll((nodes) => nodes.map((node) => node.id));
  await page.evaluate((ids) => window.__BOOP_E2E__.mutate((state) => { state.selectedId = ids[0]; state.selectedIds = ids; }), ids);
  await page.locator('[data-arrange="clip:selection"]').click({ force: true });

  // A `<clipPath>` cuts to an outline, and a picture's outline is its
  // rectangle -- never what anybody means. A picture cuts by its alpha.
  await expect(page.locator('svg defs mask')).toHaveCount(1);
  const mask = page.locator('svg defs mask').first();
  await expect(mask).toHaveAttribute('mask-type', 'alpha');
  await expect(mask.locator('image')).toHaveCount(1);
  await expect(page.locator('svg [mask]')).toHaveCount(1);

  // And the mask's own picture is stored as a reference, not as this tab's
  // object URL: it is inside `<defs>`, which is exactly where a serializer is
  // easiest to forget about.
  const markup = await page.evaluate(() => window.__BOOP_E2E__.document().svgMarkup || '');
  expect(markup).not.toMatch(/blob:/);
  expect(markup).toMatch(/<mask[^>]*mask-type="alpha"/);
  expect(markup).toMatch(/<image href="asset:[0-9a-f]{8,}"/);

  await expect(page.locator('#save-state')).toContainText(/Autosaved/i);
  await page.reload();
  await page.locator('.file-menu > summary').first().click();
  await page.locator('#recover-autosave').click();
  await expect(page.locator('svg [mask]')).toHaveCount(1);
  await expect(page.locator('svg defs mask image').first()).toHaveAttribute('href', /^blob:/);
  expect(trouble).toEqual([]);
});

test('@critical a picture bends, changes grid and goes flat again', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openFreshEditor(page, { e2e: true });
  await page.evaluate(() => window.__BOOP_E2E__.openProject.template('basic'));
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);
  await page.evaluate(() => window.__BOOP_E2E__.navigate('design.artwork'));
  const id = await page.locator('svg image').first().evaluate((node) => node.id);
  await page.evaluate((id) => window.__BOOP_E2E__.mutate((state) => { state.selectedId = id; state.selectedIds = [id]; }), id);

  await page.locator('[data-mesh-size]').first().selectOption('3');
  // Two triangles a cell, four cells: the picture is drawn eight times, each
  // clipped to its own triangle and carrying its own affine.
  await expect(page.locator(`svg g#${id} > g[clip-path]`)).toHaveCount(8);
  await expect(page.locator(`svg g#${id} image`)).toHaveCount(8);
  await expect(page.locator(`svg g#${id} image`).first()).toHaveAttribute('href', /^blob:/);

  // The document stores references, not this tab's URLs -- eight of them now.
  const markup = await page.evaluate(() => window.__BOOP_E2E__.document().svgMarkup || '');
  expect(markup).not.toMatch(/blob:/);
  expect(markup).toMatch(/data-mesh="3"/);

  await page.locator('[data-mesh-size]').first().selectOption('4');
  await expect(page.locator(`svg g#${id} > g[clip-path]`)).toHaveCount(18);

  // And back. The control has to still be there once the piece is a group:
  // reading only `<image>` made bending a one-way door.
  await page.locator('[data-mesh-size]').first().selectOption('0');
  await expect(page.locator('svg image')).toHaveCount(1);
  await expect(page.locator(`svg g#${id}[data-mesh]`)).toHaveCount(0);
  await expect(page.locator('svg defs clipPath[id^="mesh-"]')).toHaveCount(0);
  expect(trouble).toEqual([]);
});

test('@critical a mesh point is dragged, bends the picture, and flattens again', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openFreshEditor(page, { e2e: true });
  await page.evaluate(() => window.__BOOP_E2E__.openProject.template('basic'));
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);
  await page.evaluate(() => window.__BOOP_E2E__.navigate('design.artwork'));
  const id = await page.locator('svg image').first().evaluate((node) => node.id);
  await page.evaluate((id) => window.__BOOP_E2E__.mutate((state) => { state.selectedId = id; state.selectedIds = [id]; }), id);
  await page.locator('[data-mesh-size]').first().selectOption('3');

  // Nine points and the grid between them, so an author sees a lattice rather
  // than a constellation of dots.
  await expect(page.locator('[data-mesh-point]:not([hidden])')).toHaveCount(9);
  expect(await page.locator('.mesh-layer line').count()).toBe(12);

  const handle = page.locator('[data-mesh-point="4"]');
  const box = await handle.boundingBox();
  const before = await page.evaluate(() => window.__BOOP_E2E__.document().meshes[0].points[4]);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10, { steps: 6 });
  await page.mouse.up();

  const after = await page.evaluate(() => window.__BOOP_E2E__.document().meshes[0].points[4]);
  expect(after).not.toEqual(before);
  // And the picture actually bent: the triangles stopped being identities.
  const bent = await page.locator(`svg g#${id} image`).evaluateAll((nodes) =>
    nodes.filter((node) => !/matrix\(1 0 0 1 0 0\)/.test(node.getAttribute('transform') || '')).length);
  expect(bent).toBeGreaterThan(0);

  // One drag is one undo step, whatever the pointer did on the way.
  expect(await page.evaluate(() => window.__BOOP_E2E__.history().canUndo)).toBe(true);

  await page.locator('[data-mesh-reset]').click();
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().meshes[0].points[4])).toEqual(before);
  expect(trouble).toEqual([]);
});

test('@critical a mascot can begin as a picture, from the first page', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openFreshEditor(page, { e2e: true });

  // *The* way to begin (V4-092, promoted to the primary action by V5-04).
  // Before it, an author arriving with a PNG had to make a template mascot
  // they did not want, find Artwork behind the Design chevron, and find
  // "Import head / base" inside it.
  const start = page.getByRole('button', { name: 'Start with my pictures' });
  await expect(start).toBeVisible();
  await start.click();
  // The press opens the same picker the Artwork column has; Playwright cannot
  // answer a file dialog, so the file goes to the input the press opens.
  await page.setInputFiles('#artwork-base-file', PICTURE);

  // No project was open, so the picture made its own artboard rather than
  // failing on a canvas with nothing to append to.
  await expect(page.locator('svg image')).toHaveCount(1);
  await expect(page.locator('svg image').first()).toHaveAttribute('href', /^blob:/);
  const document = await page.evaluate(() => window.__BOOP_E2E__.document());
  expect(Object.keys(document.assets)).toHaveLength(1);
  // And it landed where a base picture belongs: at the back, with a pivot, so
  // everything added next is painted in front of it.
  const [element] = Object.values(document.elements).filter((item) => item.meta?.nodeType === 'image');
  expect(element.depth).toBe(0);
  await expect(page.locator('[data-home]')).toBeHidden();
  // A picture brought in from Home lands on Assemble, where pictures arrive
  // and where the Inspector asks which part of the face this one is (UIR-18).
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('design.assemble');
  expect(trouble).toEqual([]);
});

test('@critical the same picture can be added twice, because a face has two eyes', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page);

  // `<input type="file">` fires `change` when its value changes, so picking the
  // same file again used to fire nothing: the picker opened, the file was
  // picked, and the editor did not move. It is the normal case for eyes.
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(1);
  await page.setInputFiles('#artwork-image-file', PICTURE);
  await expect(page.locator('svg image')).toHaveCount(2);

  // Two nodes, one stored picture: the same bytes are the same asset, and both
  // nodes point at it.
  const hrefs = await page.locator('svg image').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-editor-asset')));
  expect(new Set(hrefs).size).toBe(1);
  expect(trouble).toEqual([]);
});

test('@critical a picture arrives knowing how it moves, and the choice stays changeable', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page, { e2e: true });
  // The Inspector's Picture section is an Artwork-screen thing: elsewhere it is
  // in the document and in a hidden column, which is enough to read and not
  // enough to press.
  await goToArtwork(page);
  const selected = () => page.evaluate(() => window.__BOOP_E2E__.session().selectedId);
  const documentOf = () => page.evaluate(() => window.__BOOP_E2E__.document());
  const rigging = async () => (await documentOf()).elements[await selected()]?.rigging;

  // The editor has read file names since V3 and only ever did it three screens
  // later, in Rig ▸ Assign — which is why importing `eye-left.png` left every
  // role reported as missing. A name that says what a piece is now says how it
  // should move (V5-03).
  await page.setInputFiles('#artwork-image-file', { name: 'oeil-gauche.webp', mimeType: 'image/webp', buffer: readFileSync(PICTURE) });
  await expect.poll(selected).toBe('oeil-gauche');
  await expect.poll(rigging).toBe('states');
  await expect(page.locator('[data-rigging-type]')).toHaveValue('states');

  // A name that says nothing proposes nothing, and moves as one piece.
  await page.setInputFiles('#artwork-image-file', { name: 'IMG_2043.webp', mimeType: 'image/webp', buffer: readFileSync(OTHER) });
  await expect.poll(selected).toBe('img-2043');
  await expect.poll(rigging).toBe('rigid');

  // What a picture cannot be is shown with its reason rather than left out: an
  // absent option reads as a missing one.
  const outline = page.locator('[data-rigging-type] option[value="outline"]');
  await expect(outline).toContainText('not for a picture');
  // Read the property rather than Playwright's idea of "disabled": the
  // inspector rebuilds its markup on every selection, so the question worth
  // asking is what the option says now.
  await expect.poll(() => outline.evaluate((option) => option.disabled)).toBe(true);

  // And it is a proposal, not a decision: one select, one undo step.
  await page.locator('[data-rigging-type]').selectOption('bend');
  await expect.poll(rigging).toBe('bend');
  await page.keyboard.press('Control+z');
  await expect.poll(rigging).toBe('rigid');
  expect(trouble).toEqual([]);
});
