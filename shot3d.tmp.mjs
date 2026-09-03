import { chromium } from 'playwright';
const SHOT = process.env.SHOT;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
await page.goto('http://127.0.0.1:4173/Boop-mascotte/?e2e=1');
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Expressive Face/i }).first().click();
await page.waitForTimeout(1400);
await page.locator('[data-task="face-setup"]').click(); await page.waitForTimeout(400);
const section = page.locator('[data-setup-section="head-pose"]');
if (!(await section.evaluate((el) => el.hasAttribute('open')))) await section.locator(':scope > summary').click();
await page.locator('[data-head-action="generate"]').click();
await page.waitForTimeout(700);
await page.locator('#collapse-left').click(); await page.waitForTimeout(400);
const set = (n, v) => page.evaluate(([a, b]) => window.__BOOP_E2E__.setLiveParam(a, b), [n, v]);
const canvas = page.locator('#canvas');
for (const [name, x, y] of [['left', -1, 0], ['centre', 0, 0], ['right', 1, 0], ['upright', 1, -1]]) {
  await set('headX', x); await set('headY', y); await page.waitForTimeout(350);
  await canvas.screenshot({ path: `${SHOT}/I-${name}.png` });
}
await browser.close();
