import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Where a library part lands (docs/FACE_PART_LIBRARY.md, "Layout and
 * auto-fit"; PR 4). An asset is drawn against the template face; on a face
 * somebody drew it has to land on *that* face, at that face's size, with no
 * hand from the author. Measured in the browser, because the fit is a
 * function of what the canvas measures.
 */
const rect = (page, selector) => page.locator(selector).evaluate((node) => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height, width: b.width, height: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; });
const base = (page, id) => page.evaluate((i) => { const t = window.__BOOP_E2E__.document().elements[i]?.baseTransform; return t ? { x: t.x, y: t.y, rotation: t.rotation, scaleX: t.scaleX, scaleY: t.scaleY, pivotX: t.pivotX, pivotY: t.pivotY } : null; }, id);

async function drawnFace(page) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="blank"]').click();
  await expect(page.locator('#canvas svg svg')).toHaveCount(1);
  const box = await page.locator('#canvas').boundingBox();
  const at = (fx, fy) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
  const drag = async (tool, from, to) => {
    await page.locator(`[data-design-tool="${tool}"]`).click();
    const a = at(...from), b = at(...to);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
  };
  // A head and two eyes, drawn rather than templated, off to one side of the artboard.
  await drag('ellipse', [0.35, 0.15], [0.65, 0.70]);
  await drag('ellipse', [0.42, 0.30], [0.48, 0.38]);
  await drag('ellipse', [0.52, 0.30], [0.58, 0.38]);
  await page.locator('[data-design-tool="select"]').click();
  await page.locator('[data-task="face-setup"]').click();
  for (const [role, element] of [['head', 'ellipse-1'], ['leftEye', 'ellipse-2'], ['rightEye', 'ellipse-3']]) {
    const row = page.locator(`[data-face-role="${role}"]`);
    if ((await row.getAttribute('data-face-role-status')) === 'missing') {
      await row.locator('[data-face-role-assign]').click();
      await page.locator(`[data-face-role-manual="${role}"]`).selectOption(element);
      await expect(row).toHaveAttribute('data-face-role-status', 'assigned');
    }
  }
}

async function openCharacter(page) {
  await page.locator('[data-task="character"]').click();
  await expect(page.locator('#part-browser[data-part-ready="true"]')).toBeVisible();
}

test('@critical a library part lands on a face somebody drew, at that face\'s size, where the face keeps it', async ({ page }) => {
  await drawnFace(page);
  await openCharacter(page);

  // The nose: a category the drawn face has no part for yet, so the card says Add.
  await page.locator('[data-part-category="nose"]').click();
  const nose = page.locator('[data-face-part="nose.dot"]');
  await expect(nose).toBeEnabled();
  await expect(nose).toHaveAttribute('title', /^Add Dot/);
  await nose.click();
  await expect(page.locator('#canvas svg svg #nose-dot')).toBeVisible();
  const [head, eye, drawnNose] = [await rect(page, '#canvas svg svg #ellipse-1'), await rect(page, '#canvas svg svg #ellipse-2'), await rect(page, '#canvas svg svg #nose-dot')];
  // Inside the head, on its centre line, below the eyes and above its chin.
  expect(drawnNose.x).toBeGreaterThan(head.x);
  expect(drawnNose.right).toBeLessThan(head.right);
  expect(Math.abs(drawnNose.cx - head.cx)).toBeLessThan(head.width * 0.03);
  expect(drawnNose.y).toBeGreaterThan(eye.bottom);
  expect(drawnNose.bottom).toBeLessThan(head.bottom);
  expect(drawnNose.cy / head.bottom).toBeLessThan(1);
  // At this head's size: the dot is about a seventeenth of the template head wide.
  expect(drawnNose.width / head.width).toBeGreaterThan(0.04);
  expect(drawnNose.width / head.width).toBeLessThan(0.08);
  const fit = await base(page, 'nose-dot');
  expect(fit.scaleX).toBeCloseTo(fit.scaleY, 5);
  expect(fit.scaleX).toBeLessThan(1);
  expect(fit.pivotX).toBe(120);
  expect(fit.pivotY).toBe(148);

  // The mouth: fitted the same way, below the nose, and the same width as
  // the template's mouth is to the template's head.
  await page.locator('[data-part-category="mouth"]').click();
  await page.locator('[data-face-part="mouth.wide"]').click();
  await expect(page.locator('#canvas svg svg #mouth-wide')).toBeVisible();
  const mouth = await rect(page, '#canvas svg svg #mouth-wide');
  expect(mouth.y).toBeGreaterThan(drawnNose.bottom);
  expect(mouth.bottom).toBeLessThan(head.bottom);
  expect(Math.abs(mouth.cx - head.cx)).toBeLessThan(head.width * 0.03);
  expect(mouth.width / head.width).toBeGreaterThan(0.35);
  expect(mouth.width / head.width).toBeLessThan(0.5);

  // The author moves the nose; the next nose goes where the author put it, at the size the author gave it.
  await page.locator('[data-part-category="nose"]').click();
  const x = page.locator('#part-inspector [data-part-transform="x"]');
  await x.fill(String(fit.x + 8));
  await x.press('Enter');
  await expect.poll(async () => (await base(page, 'nose-dot')).x).toBeCloseTo(fit.x + 8, 3);
  const scale = page.locator('#part-inspector [data-part-scale]');
  await scale.fill(String(Math.round(fit.scaleX * 2 * 1000) / 1000));
  await scale.press('Enter');
  await scale.blur();
  await expect.poll(async () => (await base(page, 'nose-dot')).scaleX).toBeCloseTo(Math.round(fit.scaleX * 2 * 1000) / 1000, 3);
  const moved = await rect(page, '#canvas svg svg #nose-dot');
  await page.locator('[data-face-part="nose.dot"]').click();
  await expect.poll(async () => (await base(page, 'nose-dot')).x).toBeCloseTo(fit.x + 8, 2);
  const again = await base(page, 'nose-dot');
  expect(again.scaleX).toBeCloseTo(Math.round(fit.scaleX * 2 * 1000) / 1000, 3);
  const replaced = await rect(page, '#canvas svg svg #nose-dot');
  expect(Math.abs(replaced.cx - moved.cx)).toBeLessThan(1);
  expect(Math.abs(replaced.cy - moved.cy)).toBeLessThan(1);
  expect(Math.abs(replaced.width - moved.width)).toBeLessThan(1);
});

test('@critical on the template, fitting moves nothing: an asset drawn for the template lands as drawn', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // The layout the template *is*, read live, is the layout written down for it.
  const boxes = await page.evaluate(() => Object.fromEntries(['head', 'eyeLeft', 'eyeRight', 'browLeft', 'browRight', 'nose', 'mouth', 'earLeft', 'earRight', 'hair', 'hairTop', 'hairBack'].map((id) => { const b = document.querySelector(`#canvas svg svg #${id}`).getBBox(); return [id, { x: b.x, y: b.y, width: b.width, height: b.height }]; })));
  const reference = { head: [25.89, 22, 188.21, 188], eyeLeft: [37, 36.5, 92, 149], eyeRight: [111, 36.5, 92, 149], browLeft: [60, 74.97, 50.5, 12.63], browRight: [129.5, 74.97, 50.5, 12.63], nose: [114.23, 143.4, 12.77, 9.2], mouth: [87, 172.5, 66, 5.5], earLeft: [12.9, 97, 28, 42.05], earRight: [199.1, 97, 28, 42.05], hair: [0.65, 0, 238.8, 134.13], hairTop: [15.63, 0.64, 202.6, 106.63], hairBack: [8.36, 0.65, 217.65, 129.56] };
  for (const [id, [x, y, width, height]] of Object.entries(reference)) {
    for (const [key, value] of Object.entries({ x, y, width, height })) expect(Math.abs(boxes[id][key] - value), `${id}.${key}`).toBeLessThan(1);
  }
  await openCharacter(page);
  await page.locator('[data-part-category="mouth"]').click();
  await page.locator('[data-face-part="mouth.simple"]').click();
  await expect(page.locator('#canvas svg svg #mouth-simple')).toBeVisible();
  expect(await base(page, 'mouth-simple')).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 120, pivotY: 176.5 });
  const mouthBox = await page.locator('#canvas svg svg #mouth-simple > #mouth').evaluate((node) => { const b = node.getBBox(); return { x: b.x, y: b.y, width: b.width }; });
  expect(mouthBox.x).toBeCloseTo(87, 0);
  expect(mouthBox.width).toBeCloseTo(66, 0);
});
