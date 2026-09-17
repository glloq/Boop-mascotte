import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { goToArtwork, openFreshEditor } from './editor-helpers.js';

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

const openReadyMadeFace = async (page) => {
  await openFreshEditor(page);
  await page.getByRole('button', { name: 'Start from the ready-made face' }).click();
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
  await openReadyMadeFace(page);
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
  expect(trouble).toEqual([]);
});

test('@critical a picture dropped on the mascot is added where it was dropped on', async ({ page }) => {
  const trouble = watchForTrouble(page);
  await openReadyMadeFace(page);

  // The gesture people reach for first. Built in the page, because a real
  // `DataTransfer` is the only thing the handler is written against.
  const bytes = [...readFileSync(PICTURE)];
  const hinted = await page.evaluate(({ bytes }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.webp', { type: 'image/webp' }));
    const canvas = document.querySelector('#canvas');
    canvas.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true }));
    canvas.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true }));
    const showed = canvas.classList.contains('picture-drop-over');
    canvas.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true }));
    return showed;
  }, { bytes });

  expect(hinted, 'the canvas says it will take the drop').toBe(true);
  await expect(page.locator('svg image')).toHaveCount(1);
  await expect(page.locator('svg image').first()).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('#canvas.picture-drop-over')).toHaveCount(0);
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
