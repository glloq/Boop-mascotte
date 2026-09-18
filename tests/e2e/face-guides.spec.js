import { test, expect } from '@playwright/test';
import { enterProject, goToMode, openAssemble, openFreshEditor, startBasicFace, startBlankCanvas } from './editor-helpers.js';
import { TEMPLATE_ROLE_BOXES } from '../../project/editor/core/face-library/face-layout.js';

/**
 * The guides, on the canvas (docs/FACE_GUIDES.md).
 *
 * ```text
 * « on doit pouvoir créer n'importe quel mascotte facilement => il faut
 *   chercher a ajouter des aides graphique pour guider un nouvel utilisateur »
 * ```
 *
 * An author who imports a head they drew gets a blank oval and a panel of
 * categories, and nothing on the canvas says a face *has* places. What needs a
 * browser is that the boxes are really drawn, on the screens where a mascot is
 * made and nowhere else, and that the frame a card promises is where the press
 * actually puts the drawing.
 */
const BARE_HEAD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <ellipse id="myHead" cx="120" cy="120" rx="95" ry="105" fill="#ffd8a8"/>
</svg>`;

const guides = (page) => page.locator('[data-face-guides]');
const slotLabels = (page) => page.locator('[data-face-guides] .canvas-guide-label').allTextContents();

/** The painted box of a guide, on screen. */
const guideBox = (page, index) => page.locator('[data-face-guides] .canvas-guide-slot').nth(index)
  .evaluate((node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });

async function headOnly(page) {
  await openFreshEditor(page, { e2e: true });
  await enterProject(page, 'svg', 'bare.svg', BARE_HEAD);
  await goToMode(page, 'rig.assign');
  const row = page.locator('[data-face-role="head"]');
  await row.locator('[data-face-role-assign]').click();
  await page.locator('[data-face-role-manual="head"]').selectOption('myHead');
  await expect(row).toHaveAttribute('data-face-role-status', 'assigned');
  await openAssemble(page);
}

test('@critical a head with no face on it says where the face goes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await headOnly(page);
  await expect(guides(page)).toHaveAttribute('data-face-guides', '4');
  expect(await slotLabels(page)).toEqual(['Left eye', 'Right eye', 'Nose', 'Mouth']);

  // Drawn on the head, not beside it: every slot is inside the outline, which
  // is the whole claim a guide makes.
  const head = await page.locator('#canvas #myHead').evaluate((node) => {
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  for (let i = 0; i < 4; i += 1) {
    const box = await guideBox(page, i);
    expect(box.x, `slot ${i} starts inside the head`).toBeGreaterThanOrEqual(head.x - 1);
    expect(box.x + box.width, `slot ${i} ends inside the head`).toBeLessThanOrEqual(head.x + head.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(head.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(head.y + head.height + 1);
  }

  // A finished face has nothing to say: the template wears all four.
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAssemble(page);
  await expect(guides(page)).toHaveAttribute('data-face-guides', '0');
});

test('@critical pointing at a card frames where that drawing lands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await headOnly(page);
  const panel = page.locator('#face-library[data-face-library-ready="true"]');
  await panel.locator('[data-face-library-category="mouth"]').click();

  await panel.locator('[data-face-library-card="mouth.full"]').hover();
  await expect(guides(page)).toHaveAttribute('data-face-guide-landing', 'mouth.full');
  const promised = await page.locator('[data-face-guides] .canvas-guide-slot.canvas-guide-landing')
    .evaluate((node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });

  // The promise, kept: press it, and the drawing is where the frame was. This
  // is the property the guide exists for -- both come out of `fitFacePart`, so
  // a frame that disagreed with the press would mean the canvas had grown a
  // second opinion about the fit.
  await panel.locator('[data-face-library-card="mouth.full"] [data-face-library-wear]').click();
  await expect(panel.locator('[data-face-library-card="mouth.full"]')).toHaveClass(/face-library-worn/);
  const landed = await page.locator('#canvas #mouth').evaluate((node) => {
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  // *Inside* the frame, not identical to it. A reference box is the room the
  // drawing needs -- this mouth's is fourteen units tall because that is the
  // cavity when it is fully open, where the resting lip line is five -- so the
  // promise a frame makes is "the drawing goes in here", and that is what is
  // checked. Four pixels of slack for the stroke, which a painted box carries
  // and a reference box does not.
  const slack = 4;
  expect(landed.x, `x: promised ${promised.x.toFixed(1)}, landed ${landed.x.toFixed(1)}`).toBeGreaterThanOrEqual(promised.x - slack);
  expect(landed.x + landed.width).toBeLessThanOrEqual(promised.x + promised.width + slack);
  expect(landed.y, `y: promised ${promised.y.toFixed(1)}, landed ${landed.y.toFixed(1)}`).toBeGreaterThanOrEqual(promised.y - slack);
  expect(landed.y + landed.height).toBeLessThanOrEqual(promised.y + promised.height + slack);
  // And on the same middle line, which is the part an author is reading the
  // frame for: a mouth promised in the centre that arrives off to one side is
  // a frame that lied, however well it fitted.
  const middle = (box) => box.x + box.width / 2;
  expect(Math.abs(middle(landed) - middle(promised)), 'the drawing and the frame share a middle').toBeLessThan(2);
  // And the mouth is no longer missing, so its slot has gone.
  await expect(guides(page)).toHaveAttribute('data-face-guides', '3');
});

test('@critical an empty canvas says to draw a head, and Preview says nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFreshEditor(page, { e2e: true });
  await startBlankCanvas(page);
  await expect(guides(page)).toHaveAttribute('data-face-guides', 'ghost');
  expect(await slotLabels(page)).toEqual(['Draw a head, or press a head in the library']);
  // The ghost is a shape, not a box: "draw something about this big, about
  // here" is the message, and a rectangle says the head should be one.
  await expect(page.locator('[data-face-guides] ellipse.canvas-guide-ghost')).toHaveCount(1);

  // Off where the mascot is being tried on rather than made: a dashed box over
  // a finished mascot is clutter, and over the Preview it is a bug.
  await headOnly(page);
  await expect(guides(page)).toHaveAttribute('data-face-guides', '4');
  await goToMode(page, 'preview');
  await expect(page.locator('[data-face-guides] .canvas-guide-slot')).toHaveCount(0);
});

/**
 * The template's role boxes, held to the face the template really draws.
 *
 * `TEMPLATE_ROLE_BOXES` is measured once in a browser and written down so the
 * layout can be derived without one -- which makes it a fixture, and a fixture
 * nothing checks is a fixture that drifts. It had: the eyes were still the
 * 92x135 of a group with its lids parked outside a socket, three times the
 * 48x45 the eye actually is, and every part fitted beside an eye was fitted
 * beside a box three times its size.
 */
test('@critical the template role boxes are the boxes the template draws', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const ids = { head: 'head', leftEye: 'eyeLeft', rightEye: 'eyeRight', leftBrow: 'browLeft', rightBrow: 'browRight',
    nose: 'nose', mouth: 'mouth', leftEar: 'earLeft', rightEar: 'earRight', hair: 'hair', hairTop: 'hairTop', hairBack: 'hairBack' };
  const measured = await page.evaluate((map) => Object.fromEntries(Object.entries(map).map(([role, id]) => {
    const node = document.querySelector(`#canvas svg svg #${id}`);
    const box = node?.getBBox?.();
    return [role, box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null];
  })), ids);
  for (const [role, box] of Object.entries(measured)) {
    expect(box, `${role} is not on the template's face`).not.toBeNull();
    for (const key of ['x', 'y', 'width', 'height']) {
      expect(Math.abs(box[key] - TEMPLATE_ROLE_BOXES[role][key]),
        `${role}.${key}: written ${TEMPLATE_ROLE_BOXES[role][key]}, drawn ${box[key].toFixed(2)}`).toBeLessThan(1);
    }
  }
});
