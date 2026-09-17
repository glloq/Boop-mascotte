import { chromium } from '@playwright/test';
const F = '/home/user/Boop-mascotte/project/editor/core/tests/fixtures/assets/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const bad = [];
page.on('pageerror', (e) => bad.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => bad.push('requestfailed: ' + r.url().slice(0, 50)));
const status = () => page.locator('#status, .status, [role="status"]').first().textContent().catch(() => '');
await page.goto('http://localhost:5173/Boop-mascotte/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'Start from the ready-made face' }).click();
await page.waitForTimeout(1200);
await page.setInputFiles('#artwork-image-file', F + 'alpha-24x17.webp');
await page.waitForTimeout(1500);

// Select the picture on the canvas.
await page.locator('svg image').first().click({ force: true });
await page.waitForTimeout(700);
console.log('inspector has Replace:', await page.locator('[data-replace-picture]').count());
const before = await page.locator('svg image').first().evaluate((n) => n.getAttribute('data-editor-asset'));
const box = await page.locator('svg image').first().evaluate((n) => [n.getAttribute('x'), n.getAttribute('y'), n.getAttribute('width')].join(','));

await page.setInputFiles('[data-replace-picture]', F + 'alpha-16x16.png');
await page.waitForTimeout(2000);
const after = await page.locator('svg image').first().evaluate((n) => n.getAttribute('data-editor-asset'));
console.log('STATUS  :', (await status()).slice(0, 80));
console.log('ref before/after:', before?.slice(0, 20), '->', after?.slice(0, 20), '| changed:', before !== after);
console.log('box kept:', box === await page.locator('svg image').first().evaluate((n) => [n.getAttribute('x'), n.getAttribute('y'), n.getAttribute('width')].join(',')));
console.log('painted :', (await page.locator('svg image').first().evaluate((n) => n.getAttribute('href') || '')).slice(0, 10));
console.log('PROBLEMS:', bad.length ? bad.slice(0, 4) : 'none');
await browser.close();
