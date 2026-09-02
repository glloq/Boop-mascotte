import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

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
      await page.locator(`[data-task="${task}"]`).click();
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
    await page.locator('[data-task="preview"]').click();
    expect((await overflow(page)).wide).toEqual([]);
    expect(await page.locator('#toast').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  }
});
