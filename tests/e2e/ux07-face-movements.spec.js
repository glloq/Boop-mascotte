import { test, expect } from '@playwright/test';
import { dragWithin, openFreshEditor, openSetupSection, readSvgTranslation, startBasicFace } from './editor-helpers.js';

const checkpoint = (page) => page.evaluate(() => ({
  document: window.__BOOP_E2E__.document(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty(),
  mutations: window.__BOOP_E2E__.diagnostics().store.documentMutations
}));
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);

async function importAndAssign(page) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await page.locator('[data-task="face-setup"]').click();
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await expect(page.locator('#face-setup-checklist')).toHaveAttribute('data-face-setup-assigned', '8');
}

test('@critical user turns on gaze, tests it, and calibrates it by posing the pupils on the canvas', async ({ page }) => {
  await importAndAssign(page);
  await openSetupSection(page, 'movements');
  const panel = page.locator('#face-movements[data-face-movements-ready="true"]');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-face-movements-available', '13');
  await expect(panel).toHaveAttribute('data-face-movements-enabled', '0');
  await expect(panel.locator('[data-movement]')).toHaveCount(18);
  const before = await checkpoint(page);

  await page.getByLabel('Enable Look left / right (Gaze)').check();
  await expect(page.locator('[data-movement="lookX"]')).toHaveAttribute('data-movement-status', 'on');
  const enabled = await checkpoint(page);
  expect(enabled.mutations - before.mutations).toBe(1);
  expect(enabled.document.params.lookX).toBeDefined();
  expect(enabled.document.elements.journeyPupilL.bindings.translateX.generatedBy).toEqual({ semanticPart: 'gaze', control: 'lookX' });

  await page.locator('[data-movement-open="lookX"]').click();
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-control');
  await expect(page.getByRole('heading', { name: 'Movement Inspector', exact: true })).toBeVisible();
  const slider = page.locator('[data-rig-control="gaze:lookX"]');
  await expect(slider).toBeVisible();
  const pupil = page.locator('#journeyPupilL');
  const base = await readSvgTranslation(pupil);
  await slider.fill('0.8');
  await expect.poll(() => effective(page, 'lookX')).toBeCloseTo(.8);
  expect((await readSvgTranslation(pupil)).x).not.toBe(base.x);
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  await expect.poll(() => effective(page, 'lookX')).toBe(0);
  expect((await checkpoint(page)).document).toEqual(enabled.document);

  await page.getByRole('button', { name: 'Pose and capture LEFT' }).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-transform-pose/);
  await expect(page.locator('.canvas-mode-banner')).toContainText('pupils to the left');
  await dragWithin(page, pupil, { to: { x: -1.5, y: .5 } });
  await dragWithin(page, page.locator('#journeyPupilR'), { to: { x: -1.5, y: .5 } });
  await page.locator('[data-canvas-mode-capture]').click();
  await expect(page.locator('#canvas')).not.toHaveClass(/rig-transform-pose/);
  await expect(page.locator('.pose-card[data-pose="left"]')).toHaveAttribute('data-pose-captured', 'true');
  await expect(page.locator('small[data-movement-status]')).toHaveAttribute('data-movement-status', 'partial');
  expect(await readSvgTranslation(pupil)).toEqual(base);
  // Dragging a circle moves cx/cy; capture must restore the exact base geometry.
  await expect(pupil).toHaveAttribute('cx', '92');
  await expect(page.locator('#journeyPupilR')).toHaveAttribute('cx', '172');
  const afterLeft = await documentOf(page);
  expect(afterLeft.elements.journeyPupilL.bindings.translateX.amplitude).toBe(enabled.document.elements.journeyPupilL.bindings.translateX.amplitude);

  await page.getByRole('button', { name: 'Pose and capture RIGHT' }).click();
  await dragWithin(page, pupil, { to: { x: 2.5, y: .5 } });
  await dragWithin(page, page.locator('#journeyPupilR'), { to: { x: 2.5, y: .5 } });
  await page.locator('[data-canvas-mode-capture]').click();
  await expect(page.locator('small[data-movement-status]')).toHaveAttribute('data-movement-status', 'calibrated');
  await expect(page.locator('[data-movement="lookX"]')).toHaveAttribute('data-movement-status', 'calibrated');
  const calibrated = await documentOf(page);
  const binding = calibrated.elements.journeyPupilL.bindings.translateX;
  expect(binding.generatedBy).toEqual({ semanticPart: 'gaze', control: 'lookX' });
  expect(binding.amplitude).toBeGreaterThan(0);
  const samples = calibrated.semanticParts.gaze.calibration.lookX.samples;
  expect(samples.map((sample) => sample.key)).toEqual(['left', 'right']);
  expect(samples[0].pose.leftPupil.x).toBeLessThan(samples[1].pose.leftPupil.x);
  expect(calibrated.elements.journeyPupilL.baseTransform).toEqual(enabled.document.elements.journeyPupilL.baseTransform);
  expect(await readSvgTranslation(pupil)).toEqual(base);

  await slider.fill('1');
  await expect.poll(async () => (await readSvgTranslation(pupil)).x).toBeCloseTo(samples[1].pose.leftPupil.x, 0);
  await slider.fill('-1');
  await expect.poll(async () => (await readSvgTranslation(pupil)).x).toBeCloseTo(samples[0].pose.leftPupil.x, 0);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('small[data-movement-status]')).toHaveAttribute('data-movement-status', 'partial');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('small[data-movement-status]')).toHaveAttribute('data-movement-status', 'default');
  expect(await documentOf(page)).toEqual(enabled.document);
});

test('@critical templates expose their movements, batch enabling and turning off are single commands, and the XY pad tests two controls', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'movements');
  const panel = page.locator('#face-movements[data-face-movements-ready="true"]');
  // Every movement, because the template draws every part that carries one.
  await expect(panel).toHaveAttribute('data-face-movements-available', '18');
  await expect(panel).toHaveAttribute('data-face-movements-enabled', '18');
  await expect(page.locator('[data-movement="browRaise"]')).not.toHaveAttribute('data-movement-status', 'unassigned');
  await expect(page.getByLabel('Enable Raise (Eyebrows)')).toBeEnabled();
  const before = await checkpoint(page);
  // The template ships a Head Turn clip and a 2.5D pose grid, both of which
  // reference headX, so turning the movement off keeps the parameter they need.
  await page.getByLabel('Enable Move left / right (Head)').uncheck();
  await expect(page.locator('[data-movement="headX"]')).toHaveAttribute('data-movement-status', 'off');
  const off = await checkpoint(page);
  expect(off.mutations - before.mutations).toBe(1);
  expect(off.document.params.headX).toBeDefined();
  expect(off.document.elements.faceRoot.bindings.translateX).toBeUndefined();
  expect(off.document.semanticParts.head.controls).toEqual(['headY', 'headTilt']);
  await page.getByRole('button', { name: 'Turn on the remaining movement' }).click();
  await expect(page.locator('[data-movement="headX"]')).toHaveAttribute('data-movement-status', 'on');
  expect((await checkpoint(page)).mutations - off.mutations).toBe(1);
  expect((await documentOf(page)).params.headX).toBeDefined();
  expect((await documentOf(page)).elements.faceRoot.bindings.translateX.generatedBy).toEqual({ semanticPart: 'head', control: 'headX' });

  await page.locator('[data-movement-open="lookX"]').click();
  const pad = page.locator('.xy-pad[data-xy="lookX:lookY"]');
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .9, box.y + box.height * .2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => effective(page, 'lookX')).toBeGreaterThan(.5);
  await expect.poll(() => effective(page, 'lookY')).toBeLessThan(-.3);
  expect((await checkpoint(page)).document).toEqual((await checkpoint(page)).document);
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  await expect.poll(() => effective(page, 'lookX')).toBe(0);
  const afterTest = await checkpoint(page);
  expect(afterTest.mutations).toBe((await checkpoint(page)).mutations);
  expect(afterTest.document.params.lookX).toBeDefined();
  await page.getByRole('button', { name: 'Back to Pupils / Gaze' }).click();
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-part');
});
