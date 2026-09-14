import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, openTask, startBasicFace } from './editor-helpers.js';

const VIEWPORTS = [[320, 568], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1440, 900]];
const TASKS = ['artwork', 'face-setup', 'expressions', 'animate', 'reactions', 'preview'];
const overflow = (page) => page.evaluate(() => {
  const width = innerWidth, doc = document.documentElement;
  const scrolls = (el) => { for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) { const overflowX = getComputedStyle(node).overflowX; if (overflowX === 'auto' || overflowX === 'scroll') return true; } return false; };
  const wide = [...document.querySelectorAll('.topbar, .topbar *, #app > *, .panel, .panel-right')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > width + 1 || r.left < -1) && !el.closest('#left') && !el.matches('.skip-link') && getComputedStyle(el).position !== 'fixed' && !scrolls(el); }).map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${[...el.classList].join('.')}`);
  return { scrollWidth: doc.scrollWidth, width, wide: wide.slice(0, 5) };
});

for (const [width, height] of VIEWPORTS) {
  test(`@critical no horizontal overflow at ${width}×${height} on Home and in every task`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openFreshEditor(page, { e2e: true });
    expect(await overflow(page), 'Home').toMatchObject({ scrollWidth: expect.any(Number), wide: [] });
    expect((await overflow(page)).scrollWidth).toBeLessThanOrEqual(width);
    await startBasicFace(page);
    for (const task of TASKS) {
      await openTask(page, task);
      const result = await overflow(page);
      expect(result.wide, `${task} overflows`).toEqual([]);
      expect(result.scrollWidth, `${task} scrollWidth`).toBeLessThanOrEqual(width);
    }
    await expect(page.getByRole('button', { name: 'Save Project' })).toBeVisible();
  });
}

test('reduced motion keeps every viewport stable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await openFreshEditor(page, { e2e: true });
    await startBasicFace(page);
    await goToMode(page, 'preview');
    expect((await overflow(page)).wide).toEqual([]);
    expect(await page.locator('#toast').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  }
});

/**
 * The screen's own panel leads the column; Structure is last (PR UI-07).
 *
 * The SVG tree was declared third in `side-nav.js`, above every working panel,
 * and a mascot has a hundred and thirty layers with every group open. The left
 * column of Rig ▸ Assign measured 4226 px in an 836 px viewport and *Face
 * parts* — the one section that screen exists for — began at 3661 px: arriving
 * at the screen meant scrolling past three and a half screens of the left
 * hand's fingers to reach its subject.
 *
 * Two assertions, because the fix has two halves and only one of them is
 * visible: the subject comes first, and Structure is still there. It is how a
 * piece the canvas will not give you is picked, and it stays on both screens
 * that had it (UIR-00).
 */
test('@critical the screen’s own panel opens the column, and Structure keeps its place under it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  for (const [mode, own] of [['rig.assign', '.rig-tools'], ['rig.controls', '.rig-tools'], ['design.artwork', '.create-tools']]) {
    await goToMode(page, mode);
    const measured = await page.evaluate((selector) => {
      const subject = document.querySelector(selector), structure = document.querySelector('.structure-tools');
      const shown = (el) => el && getComputedStyle(el).display !== 'none';
      return { subject: shown(subject) ? subject.offsetTop : null, structure: shown(structure) ? structure.offsetTop : null, column: document.querySelector('#left').scrollHeight };
    }, own);
    expect(measured.subject, `${mode} does not show its own panel`).not.toBeNull();
    expect(measured.structure, `${mode} lost the Structure panel`).not.toBeNull();
    expect(measured.subject, `${mode} puts Structure above its own panel`).toBeLessThan(measured.structure);
    // A working panel at the top of the column is only worth anything if what
    // follows it is reachable: Rig used to need five screens of scrolling.
    if (mode.startsWith('rig.')) expect(measured.column, `${mode} column is still taller than the old one`).toBeLessThan(2000);
  }

  // The tree is bounded where it is not the subject, and whole where it is.
  await goToMode(page, 'rig.assign');
  expect(await page.locator('.structure-tools #layers-panel > [role=tree]').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await goToMode(page, 'design.artwork');
  expect(await page.locator('.structure-tools #layers-panel > [role=tree]').evaluate((el) => getComputedStyle(el).overflowY)).toBe('visible');
});

/**
 * `Controls` named two different things a centimetre apart: Rig's second screen
 * in the navigation, and a part's movements in the panel below it. Only the
 * words changed — `data-rig-tab` keeps its four ids, so every route, command
 * and spec that names one still names it.
 */
test('the tabs of a part are not named after the screens above them', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'rig.assign');
  const tabs = page.locator('.rig-tabs [data-rig-tab]');
  await expect(tabs).toHaveCount(4);
  await expect(tabs).toHaveText(['Drawing', 'Movement', 'Range', 'Details']);
  await expect(page.locator('.rig-tabs [data-rig-tab=setup]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-rig-tab="controls"]').click();
  await expect(page.locator('[data-rig-tab="controls"]')).toHaveAttribute('aria-selected', 'true');
});

/**
 * Behavior ▸ Reactions was the tallest column in the editor: 5725 px in an
 * 836 px viewport, of which 2624 px — very nearly half — was *Motions that
 * never run*, one card for each of the template's thirty motions, none of them
 * yet given a when. A true thing said thirty times, at the bottom of a column
 * nobody reaches.
 */
test('Behavior opens on what runs, not on a list of what does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'behavior.reactions');

  const measured = await page.evaluate(() => {
    const block = document.querySelector('.runs-when-motions');
    return { column: document.querySelector('#left').scrollHeight, block: block?.offsetHeight ?? null, open: block?.open ?? null, rows: block?.querySelectorAll('[data-motion-card]').length ?? 0 };
  });
  expect(measured.open, 'the list starts folded').toBe(false);
  expect(measured.block, 'folded, it is a line and a count').toBeLessThan(120);
  expect(measured.rows, 'and every motion is still in it').toBeGreaterThan(20);
  expect(measured.column, 'the column was 5725 px').toBeLessThan(4000);
});

/**
 * A ready-made preset card carried three texts: a name, what it does, and what
 * it is made of. Two of the three were `<small>`s clamped to two lines each, so
 * one card could spend four lines of a 300 px column and still finish both
 * sentences in an ellipsis. The recipe moved to the title: it is not a decision
 * anybody is making at the moment they press Add, and a card that cannot be
 * pressed still says what it needs, out loud, because that is its whole message.
 */
test('a preset card is a name and what it does; what it is made of is on its title', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'animate.motions');

  const nod = page.locator('[data-motion-preset-card="nod"]');
  await expect(nod).toContainText('The head dips and comes back.');
  await expect(nod, 'the recipe is off the card').not.toContainText('Uses Head');
  await expect(nod, 'and still reachable').toHaveAttribute('title', /Uses Head/);

  const measured = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-preset-catalogue="motions"] .preset-card')].filter((card) => card.offsetHeight);
    return { median: cards.map((card) => card.offsetHeight).sort((a, b) => a - b)[Math.floor(cards.length / 2)], catalogue: document.querySelector('[data-preset-catalogue="motions"]').offsetHeight };
  });
  expect(measured.median, 'a card was 104 px').toBeLessThan(90);
  expect(measured.catalogue, 'the open group was 1545 px').toBeLessThan(1300);
});
