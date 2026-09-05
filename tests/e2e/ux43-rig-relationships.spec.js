import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace, openSetupSection } from './editor-helpers.js';

/**
 * The rig's relationships panel (docs/FACE_CONTROL_RIG.md, §9 … §11).
 *
 * The solver could keep six relationships true and a pin could be given a
 * reach, and neither could be *authored*: nothing in the editor wrote a
 * constraint, and a pin had no field saying what moves it. A rig that runs and
 * cannot be built is the failure this suite exists to catch, so it drives the
 * panel the way an author does and reads the document back.
 */
const openHolding = async (page) => {
  await openSetupSection(page, 'holding');
  await expect(page.locator('[data-holding-panel]')).toBeVisible();
};
const rig = (page) => page.evaluate(() => window.__BOOP_E2E__.document());

test('a pin says what moves it, and says so when nothing does', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);

  // The template's own mouth corner: it rises with the corner's own movement,
  // and the panel shows the two directions separately because they follow
  // different movements.
  const corner = page.locator('[data-rig-pin-row="mouth-corner-left"]');
  await expect(corner).toHaveCount(1);
  await expect(corner.locator('[data-pin-motion-axis="y"][data-pin-motion-field="expression"]')).toHaveValue('smileLeft');
  await expect(corner.locator('[data-pin-motion-axis="x"][data-pin-motion-field="expression"]')).toHaveValue('mouthWidthLeft');

  // A reach is an ellipse, and both halves of it are editable. Writing one is
  // not allowed to flatten the other.
  const across = corner.locator('[data-pin-field="radiusX"]');
  const down = corner.locator('[data-pin-field="radiusY"]');
  const before = await down.inputValue();
  await across.fill('30');
  await across.dispatchEvent('change');
  await expect(page.locator('[data-rig-pin-row="mouth-corner-left"] [data-pin-field="radiusY"]')).toHaveValue(before);

  // And a movement the mascot has not got is said out loud rather than left to
  // be discovered on the canvas.
  const expression = page.locator('[data-rig-pin-row="mouth-corner-left"] [data-pin-motion-axis="y"][data-pin-motion-field="expression"]');
  await expression.fill('smle');
  await expression.dispatchEvent('change');
  await expect(page.locator('[data-rig-pin-row="mouth-corner-left"]')).toContainText('is not a movement this mascot has');
});

test('a relationship can be added, set, reordered and removed', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);
  await expect(page.locator('[data-holding-panel]')).toContainText('None yet');

  const form = page.locator('[data-constraint-form]');
  await form.locator('[data-constraint-target]').selectOption('nose');
  await form.locator('[data-constraint-type]').selectOption('parent');
  await form.locator('[data-constraint-source]').selectOption('head');
  await page.locator('[data-holding-action="add-constraint"]').click();

  const row = page.locator('[data-rig-constraint-row="nose-parent"]');
  await expect(row).toHaveCount(1);
  expect((await rig(page)).rigConstraints.map((item) => [item.target, item.type, item.source])).toEqual([['nose', 'parent', 'head']]);

  // A kind is set by its own fields: a `parent` copies place, turn or size; a
  // `limit` has bounds and no source at all.
  await expect(row.locator('[data-constraint-copy="rotate"]')).toHaveCount(1);
  await expect(row.locator('[data-constraint-field="limit"]')).toHaveCount(0);
  await row.locator('[data-constraint-field="type"]').selectOption('limit');
  await expect(page.locator('[data-rig-constraint-row="nose-parent"] [data-constraint-field="limit"]')).toHaveCount(8);
  await expect(page.locator('[data-rig-constraint-row="nose-parent"] [data-constraint-field="source"]')).toHaveCount(0);

  // Faded by a movement, which is what makes it something an animator keys.
  const weight = page.locator('[data-rig-constraint-row="nose-parent"] [data-constraint-field="weight"]');
  await weight.fill('nosePinned');
  await weight.dispatchEvent('change');
  expect((await rig(page)).params.nosePinned.default).toBe(1);

  // The order is the rule, so the list can be walked through.
  await page.locator('[data-constraint-form] [data-constraint-target]').selectOption('mouth');
  await page.locator('[data-constraint-form] [data-constraint-type]').selectOption('axis');
  await page.locator('[data-holding-action="add-constraint"]').click();
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['nose-parent', 'mouth-axis']);
  await page.locator('[data-holding-action="constraint-up"][data-holding-id="mouth-axis"]').click();
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['mouth-axis', 'nose-parent']);

  // One command, one undo step.
  await page.keyboard.press('Control+z');
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['nose-parent', 'mouth-axis']);

  await page.locator('[data-holding-action="remove-constraint"][data-holding-id="nose-parent"]').click();
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['mouth-axis']);
  await expect(page.locator('[data-setup-section="holding"] [data-setup-summary]')).toContainText('rule');
});

test('a named point is a starting place, and a mascot can name its own', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);

  // The suggestions come from the parts the project already has.
  await page.locator('[data-holding-action="add-point"][data-holding-id="face.cheek.left"]').click();
  const cheek = (await rig(page)).rigAttachments.find((item) => item.id === 'face.cheek.left');
  expect(cheek.target).toBeTruthy();

  // And a suggestion is a starting place, not a decision: a cheek is a fraction
  // of the way across a head, and the fraction right for one mascot is wrong
  // for the next.
  const across = page.locator('[data-point-field="x"][data-point-id="face.cheek.left"]');
  await across.fill(String(Math.round(cheek.point.x) + 7));
  await across.dispatchEvent('change');
  const moved = (await rig(page)).rigAttachments.find((item) => item.id === 'face.cheek.left');
  expect(moved.point.x).toBe(Math.round(cheek.point.x) + 7);
  expect(moved.point.y).toBe(cheek.point.y);

  // Points are grouped by what they are part of: seventeen of them in one list
  // is a list nobody reads.
  await expect(page.locator('[data-holding-space="head"]')).toHaveCount(1);

  // A mascot with a snout has places to be held that no list could have
  // guessed, so it names its own — at the middle of its artwork, to move from.
  await page.locator('[data-point-form] [data-point-name]').fill('snout.tip');
  await page.locator('[data-point-form] [data-point-target]').selectOption('nose');
  await page.locator('[data-point-form] [data-point-space]').selectOption('custom');
  await page.locator('[data-holding-action="add-own-point"]').click();
  await expect(page.locator('[data-holding-space="custom"]')).toHaveCount(1);
  const snout = (await rig(page)).rigAttachments.find((item) => item.id === 'snout.tip');
  expect(snout.target).toBe('nose');
  expect(snout.space).toBe('custom');
  expect(Number.isFinite(snout.point.x) && Number.isFinite(snout.point.y)).toBe(true);

  // Two points, so one can hold the other; the contact is created with it.
  await page.locator('[data-holding-form] [data-holding-hand]').selectOption('snout.tip');
  await page.locator('[data-holding-form] [data-holding-anchor]').selectOption('face.cheek.left');
  await page.locator('[data-holding-action="hold"]').click();
  const document = await rig(page);
  expect(document.rigHolds).toHaveLength(1);
  expect(document.params[document.rigHolds[0].weight].default).toBe(0);
});

/**
 * Pins are made here, not only inherited from the template
 * (docs/FACE_CONTROL_RIG.md, "Authoring pins"): on any path, by a click where
 * the pin goes or at the middle of the piece; their reach is dragged on the
 * canvas; a pin is mirrored to the other side; several are moved together by
 * one movement that gets a control of its own.
 */
const pinsOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document().rigPins.map((pin) => ({ id: pin.id, target: pin.target, x: pin.position.x, y: pin.position.y, rx: pin.radius.x, ry: pin.radius.y, motion: pin.motion })));
const selectLayer = async (page, id) => { await page.locator(`[data-layer-id="${id}"] [data-action="select"]`).click(); await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().selectedId)).toBe(id); };

test('@critical a pin is placed on any path — a sub-part included — and its reach is dragged on the canvas', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);
  const holding = page.locator('[data-holding-panel]');

  // The selected piece is the one offered, and the pin lands at its middle.
  await selectLayer(page, 'lidUpperLeft');
  await expect(holding.locator('[data-pin-target]')).toHaveValue('lidUpperLeft');
  await holding.locator('[data-holding-action="pin-middle"]').click();
  await expect.poll(async () => (await pinsOf(page)).map((pin) => pin.id)).toContain('lidupperleft-pin');
  const lid = (await pinsOf(page)).find((pin) => pin.id === 'lidupperleft-pin');
  expect(lid.target).toBe('lidUpperLeft');
  // A drawn path had no rest outline; pinning it gave it one, so the pin holds points.
  expect(await page.evaluate(() => typeof window.__BOOP_E2E__.document().elements.lidUpperLeft.restPath)).toBe('string');
  await expect(page.locator('#canvas [data-rig-pin="lidupperleft-pin"]')).toBeVisible();
  await expect(page.locator('#canvas [data-rig-pin="lidupperleft-pin"]')).toHaveAttribute('aria-label', /holding [1-9]\d* points?/);

  // The reach: two small handles on the ellipse, one drag one command.
  const across = page.locator('#canvas [data-pin-reach="lidupperleft-pin:x"]');
  await expect(across).toBeVisible();
  const box = await across.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await pinsOf(page)).find((pin) => pin.id === 'lidupperleft-pin').rx).toBeGreaterThan(lid.rx + 5);
  expect((await pinsOf(page)).find((pin) => pin.id === 'lidupperleft-pin').ry).toBe(lid.ry);
  await expect(holding.locator('[data-rig-pin-row="lidupperleft-pin"] [data-pin-field="radiusX"]')).not.toHaveValue(String(lid.rx));
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await pinsOf(page)).find((pin) => pin.id === 'lidupperleft-pin').rx).toBe(lid.rx);

  // Placed by a click: the pin goes where the click was, on the chosen piece.
  await holding.locator('[data-pin-target]').selectOption('lidLowerLeft');
  await holding.locator('[data-holding-action="pin-place"]').click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-pin-placing/);
  await expect(page.locator('.canvas-mode-banner')).toContainText('lidLowerLeft');
  const lower = await page.evaluate(() => { const r = document.querySelector('#canvas #lidLowerLeft').getBoundingClientRect(); return { x: r.x + r.width * .3, y: r.y + r.height / 2 }; });
  await page.mouse.click(lower.x, lower.y);
  await expect.poll(async () => (await pinsOf(page)).find((pin) => pin.id === 'lidlowerleft-pin')?.target).toBe('lidLowerLeft');
  await expect(page.locator('#canvas')).not.toHaveClass(/rig-pin-placing/);
  // The panel keeps the selected piece's pins first, and says they are on the canvas.
  await expect(holding.locator('.holding-group').first()).toHaveAttribute('data-holding-selected', 'true');
});

test('a pin is mirrored onto the other side, and several pins move together under one new control', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);
  const holding = page.locator('[data-holding-panel]');
  await selectLayer(page, 'lidUpperLeft');
  await holding.locator('[data-holding-action="pin-middle"]').click();
  await expect.poll(async () => (await pinsOf(page)).some((pin) => pin.id === 'lidupperleft-pin')).toBe(true);

  // Mirror: the twin sits on the right eyelid, reflected about the middle.
  await holding.locator('[data-rig-pin-row="lidupperleft-pin"] [data-holding-action="mirror-pin"]').click();
  await expect.poll(async () => (await pinsOf(page)).find((pin) => pin.id === 'lidupperright-pin')?.target).toBe('lidUpperRight');
  const [left, right] = ['lidupperleft-pin', 'lidupperright-pin'].map((id) => null).length ? [] : [];
  const pins = await pinsOf(page);
  const l = pins.find((pin) => pin.id === 'lidupperleft-pin'), r = pins.find((pin) => pin.id === 'lidupperright-pin');
  expect(Math.abs((l.x + r.x) / 2 - 120)).toBeLessThan(0.01);
  expect(r.y).toBe(l.y);
  void left; void right;

  // Together: one new movement, resting at 0, with a control of its own.
  await holding.locator('[data-pin-pick="lidupperleft-pin"]').check();
  await holding.locator('[data-pin-pick="lidupperright-pin"]').check();
  await holding.locator('[data-group-name]').fill('lidPinch');
  await holding.locator('[data-group-amount="y"]').fill('6');
  await holding.locator('[data-holding-action="group-pins"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().params.lidPinch?.default)).toBe(0);
  const grouped = await pinsOf(page);
  for (const id of ['lidupperleft-pin', 'lidupperright-pin']) expect(grouped.find((pin) => pin.id === id).motion).toEqual({ y: { expression: 'lidPinch', amplitude: 6, offset: 0 } });
  await expect.poll(() => page.evaluate(() => (window.__BOOP_E2E__.document().rigHandles || []).map((handle) => handle.id))).toContain('lidPinch-control');
  await expect(holding.locator('[data-rig-pin-row="lidupperleft-pin"] [data-pin-motion-axis="y"][data-pin-motion-field="expression"]')).toHaveValue('lidPinch');
  // One undo step for the group, movement and control included.
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => Boolean(window.__BOOP_E2E__.document().params.lidPinch))).toBe(false);
});

test('a directional pin has an angle, a shape becomes a path to be pinned, and the menu pins where the pointer is', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);
  const holding = page.locator('[data-holding-panel]');

  // The template's brow pins are directional: their axis is a field, and a line on the canvas.
  const row = holding.locator('[data-rig-pin-row="brow-left-inner"]');
  await expect(row.locator('[data-pin-field="angle"]')).toHaveCount(1);
  await row.locator('[data-pin-field="angle"]').fill('45');
  await row.locator('[data-pin-field="angle"]').dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => { const pin = window.__BOOP_E2E__.document().rigPins.find((item) => item.id === 'brow-left-inner'); return [Math.round(pin.direction.x * 100), Math.round(pin.direction.y * 100)]; })).toEqual([71, 71]);
  await selectLayer(page, 'browLeft');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#canvas .pin-axis')].filter((line) => line.style.display !== 'none').length)).toBeGreaterThan(0);

  // Right-click on the mouth: a pin where the pointer was.
  const before = (await pinsOf(page)).length;
  const mouth = await page.evaluate(() => { const r = document.querySelector('#canvas #mouth').getBoundingClientRect(); return { x: r.x + r.width * .2, y: r.y + r.height / 2 }; });
  await page.mouse.click(mouth.x, mouth.y, { button: 'right' });
  await page.locator('[data-canvas-menu] [data-canvas-menu-action="pin"]').click();
  await expect.poll(async () => (await pinsOf(page)).length).toBe(before + 1);
  const placed = (await pinsOf(page)).at(-1);
  expect(placed.target).toBe('mouth');
  expect(placed.x).toBeLessThan(120);
  await expect(page.locator('[data-setup-section="holding"]')).toHaveAttribute('open', '');

  // A shape has no points to hold: it becomes a path first, from the Inspector, and keeps its id and paint.
  await page.locator('[data-task="artwork"]').click();
  await selectLayer(page, 'earLeftShape');
  const kind = await page.evaluate(() => document.querySelector('#canvas svg svg #earLeftShape').tagName);
  if (kind !== 'path') {
    await page.locator('#inspector [data-convert-path]').click();
    await expect.poll(() => page.evaluate(() => document.querySelector('#canvas svg svg #earLeftShape').tagName)).toBe('path');
    expect(await page.evaluate(() => window.__BOOP_E2E__.document().layers.length)).toBeGreaterThan(0);
    await page.keyboard.press('Control+z');
    await expect.poll(() => page.evaluate(() => document.querySelector('#canvas svg svg #earLeftShape').tagName)).toBe(kind);
  }
});

test('a movement moves one side at a time when asked, and says it moves already', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'movements');
  // The template's movements move the face already; the rows say so.
  await expect(page.locator('[data-movement="eyeOpen"]')).toContainText('ready · default range');
  await expect(page.locator('[data-movement="headX"]')).toContainText('from the head pose');
  await page.locator('[data-movement-open="eyeOpen"]').first().click();
  const inspector = page.locator('#rig-panel');
  await inspector.locator('summary', { hasText: /Advanced/ }).first().click();
  const toggle = inspector.locator('[data-side-control="eyeOpen"]');
  await expect(toggle).toBeChecked();
  const sides = () => page.evaluate(() => Object.values(window.__BOOP_E2E__.document().semanticParts).find((part) => part.type === 'eyes').sides || null);
  const sideHandles = () => page.evaluate(() => [...document.querySelectorAll('#canvas [data-puppet-handle]')].map((h) => h.dataset.puppetHandle).filter((h) => /^eye(Left|Right)$/.test(h)).sort());
  expect(await sideHandles()).toEqual(['eyeLeft', 'eyeRight']);
  await toggle.uncheck();
  await expect.poll(sides).toBe(null);
  await expect.poll(sideHandles).toEqual([], 'one control for both eyes again');
  await inspector.locator('[data-side-control="eyeOpen"]').check();
  await expect.poll(sides).toEqual({ eyeOpen: true });
  await expect.poll(sideHandles).toEqual(['eyeLeft', 'eyeRight']);
});
