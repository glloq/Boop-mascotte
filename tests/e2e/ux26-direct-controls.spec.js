import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, openTimeline, startBasicFace, startEmptyBasicFace } from './editor-helpers.js';

/**
 * Direct controls (docs/DIRECT_CONTROLS.md): posing by dragging the mascot
 * itself instead of hunting for the right slider in the right panel.
 */
/**
 * Every handle the template's rig offers: gaze, eyes, eyebrows, the mouth and
 * its width, the jaw, the nose, the hair, the ears, the head and its tilt.
 * Named once, because "how many handles" is the same question in four places
 * and the answer grows every time the face gains a movement.
 */
// The face's own, plus the one slider each of the pair of hands puts beside
// the face: the pair rests behind the head, and everything else a hand can do
// is drawn only once it is out (`docs/DIRECT_CONTROLS.md`).
const HANDLES = 13;

const params = (page) => page.evaluate(() => window.__BOOP_E2E__.effectiveParams());
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const handle = (page, id) => page.locator(`[data-puppet-handle="${id}"]`);
/** The slider tracks a hand's console is drawing, whatever shape each one is. */
const consoleTracks = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas [data-hand-console-layer] .hand-console-track')]
  .filter((node) => node.style.display !== 'none').length);
/**
 * How far each finger's knob is from the finger it drives, in degrees around
 * the ring they share.
 *
 * A slider on a ring is only legible if the one nearest a finger is that
 * finger's; laid out on a share of some sweep instead, the thumb's slider sat
 * over the middle finger. Measured against the drawn artwork, so this checks
 * the picture rather than the arithmetic behind it -- loosely, because a
 * finger's *box* is not quite the direction it points in.
 */
const fingersOffTheirSliders = (page) => page.evaluate(() => {
  const middle = (node) => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  const rings = [...document.querySelectorAll('#canvas .hand-console-ring')].filter((node) => node.style.display !== 'none').map(middle);
  const apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const off = [];
  for (const side of ['left', 'right']) {
    const group = side === 'left' ? 'Left' : 'Right';
    const first = document.querySelector(`[data-puppet-handle="hand-${side}-index"]`);
    if (!first || first.hidden || !rings.length) continue;
    const near = middle(first);
    const centre = rings.slice().sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y))[0];
    const angle = (at) => Math.atan2(at.y - centre.y, at.x - centre.x) * 180 / Math.PI;
    for (const part of ['Thumb', 'Index', 'Middle', 'Ring']) {
      const knob = document.querySelector(`[data-puppet-handle="hand-${side}-${part.toLowerCase()}"]`);
      const drawn = document.querySelector(`#canvas #hand${group}${part}`);
      if (!knob || !drawn) continue;
      const gap = apart(angle(middle(knob)), angle(middle(drawn)));
      if (gap > 30) off.push(`${side} ${part} is ${Math.round(gap)}° from its slider`);
    }
  }
  return off;
});

/** Where a knob sits around its ring, in degrees. */
const knobAngle = (page, id) => page.evaluate((handle) => {
  const middle = (node) => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  const at = middle(document.querySelector(`[data-puppet-handle="${handle}"]`));
  const rings = [...document.querySelectorAll('#canvas .hand-console-ring')].filter((node) => node.style.display !== 'none').map(middle);
  const centre = rings.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0];
  return Math.atan2(at.y - centre.y, at.x - centre.x) * 180 / Math.PI;
}, id);

/**
 * How far every knob on a ring is from the ring it slides around, as a share
 * of the ring's own radius. Zero is on it.
 *
 * The knobs are HTML over the canvas and the tracks are SVG inside it, so the
 * two are placed through two different pieces of arithmetic -- and a knob that
 * is not on its own track is a control pointing at nothing. The ring is
 * measured from what is actually drawn, so this catches the picture rather
 * than the intention.
 */
const knobsOffTheRing = (page) => page.evaluate(() => {
  const middle = (node) => { const box = node.getBoundingClientRect(); return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, rx: box.width / 2, ry: box.height / 2 }; };
  const rings = [...document.querySelectorAll('#canvas .hand-console-ring')].filter((node) => node.style.display !== 'none').map(middle);
  if (!rings.length) return null;
  return [...document.querySelectorAll('[data-puppet-handle][data-handle-slot="rim"],[data-puppet-handle][data-handle-slot="hold"]')]
    .filter((node) => !node.hidden)
    .map((node) => {
      const at = middle(node);
      const off = Math.min(...rings.map((ring) => Math.abs(((at.cx - ring.cx) / ring.rx) ** 2 + ((at.cy - ring.cy) / ring.ry) ** 2 - 1)));
      return { id: node.dataset.puppetHandle, off: Math.round(off * 1000) / 1000 };
    })
    .filter((item) => item.off > 0.08);
});
const centreOf = async (page, id) => { const box = await handle(page, id).boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };

async function dragHandle(page, id, dx, dy) {
  const from = await centreOf(page, id);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function openFace(page, task = 'face-setup', { empty = false } = {}) {
  await openFreshEditor(page, { e2e: true });
  // `empty` for the journeys that author a face: the template ships them all.
  await (empty ? startEmptyBasicFace(page) : startBasicFace(page));
  await page.locator(`[data-task="${task}"]`).click();
  await expect(page.locator('[data-puppet-handle]').first()).toBeVisible();
}

test('@critical the mascot can be posed by dragging it', async ({ page }) => {
  await openFace(page);
  // One handle per movement the project has, on the artwork that moves: gaze,
  // eyes, eyebrows, the mouth and its width, the jaw, the nose, the hair, the
  // ears, the head, and the head's tilt.
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(HANDLES);
  await expect(handle(page, 'gaze')).toHaveAttribute('aria-valuetext', 'at rest');

  await dragHandle(page, 'gaze', 30, -18);
  const looking = await params(page);
  expect(looking.lookX).toBeGreaterThan(0);
  expect(looking.lookY).toBeLessThan(0);
  await expect(handle(page, 'gaze')).toHaveAttribute('aria-valuetext', /look left \/ right \+/);
  // The pupils actually moved, both of them and the same way.
  // Each pupil is scaled around its own centre now, so the pivots differ; what
  // has to match is the movement.
  const pupils = await page.evaluate(() => ['pupilLeft', 'pupilRight'].map((id) => /translate\(([-\d.]+) ([-\d.]+)\)/.exec(document.querySelector(`#canvas #${id}`).getAttribute('transform'))[0]));
  expect(pupils[0]).toBe(pupils[1]);
  expect(pupils[0]).toMatch(/translate\((?!0 0)/);

  // The handle rides the artwork it moves, and a handle that moves a pair
  // sits between the two rather than on one side of the face.
  const after = await centreOf(page, 'gaze');
  const middle = await page.evaluate(() => {
    const rects = ['pupilLeft', 'pupilRight'].map((id) => document.querySelector(`#canvas #${id}`).getBoundingClientRect());
    return { x: (Math.min(...rects.map((r) => r.x)) + Math.max(...rects.map((r) => r.x + r.width))) / 2,
      y: (Math.min(...rects.map((r) => r.y)) + Math.max(...rects.map((r) => r.y + r.height))) / 2 };
  });
  expect(Math.abs(after.x - middle.x)).toBeLessThan(2);
  expect(Math.abs(after.y - middle.y)).toBeLessThan(2);

  await dragHandle(page, 'mouth', 40, 20);
  const smiling = await params(page);
  expect(smiling.smile).toBeGreaterThan(0);
  expect(smiling.mouthOpen).toBeGreaterThan(0);

  // The jaw is a shape key on the head's own outline, so dragging its handle
  // has to redraw the head rather than move anything.
  const outline = () => page.locator('#canvas #head').getAttribute('d');
  const closed = await outline();
  await dragHandle(page, 'jaw', 0, 30);
  expect((await params(page)).jawOpen).toBeGreaterThan(0);
  expect(await outline()).not.toBe(closed);

  // Posing is a preview, not an edit: the project is untouched.
  expect(await page.evaluate(() => window.__BOOP_E2E__.dirty())).toBe(false);
});

test('no handle is hidden under another one', async ({ page }) => {
  await openFace(page);
  // Two handles on the same spot is one handle: the eye's used to sit on the
  // forehead — its group is clipped to the socket but its lids are drawn far
  // wider — right on top of the head's, over the **Make it 3D** offer.
  const boxes = await page.evaluate(() => [...document.querySelectorAll('[data-puppet-handle]')]
    .filter((node) => !node.hidden)
    .map((node) => ({ id: node.dataset.puppetHandle, ...node.getBoundingClientRect().toJSON() })));
  expect(boxes).toHaveLength(HANDLES);
  const overlapping = [];
  for (const [index, one] of boxes.entries()) for (const other of boxes.slice(index + 1)) {
    const across = Math.min(one.right, other.right) - Math.max(one.left, other.left);
    const down = Math.min(one.bottom, other.bottom) - Math.max(one.top, other.top);
    if (across > 0 && down > 0) overlapping.push(`${one.id} over ${other.id}`);
  }
  expect(overlapping).toEqual([]);
  // And each one is on the mascot rather than off in the margin.
  const canvas = await page.locator('#canvas svg').first().boundingBox();
  for (const box of boxes) {
    expect(box.left, `${box.id} is off the canvas`).toBeGreaterThan(canvas.x - 20);
    expect(box.right, `${box.id} is off the canvas`).toBeLessThan(canvas.x + canvas.width + 20);
  }
});

test('a handle answers to the keyboard and puts itself back', async ({ page }) => {
  await openFace(page);
  await handle(page, 'gaze').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await params(page)).lookX).toBeGreaterThan(0);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await params(page)).lookY).toBeLessThan(0);

  const nudged = (await params(page)).lookX;
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await params(page)).lookX).toBeGreaterThan(nudged);

  await page.keyboard.press('Home');
  await expect.poll(async () => (await params(page)).lookX).toBe(0);
  await expect(handle(page, 'gaze')).toHaveAttribute('aria-valuetext', 'at rest');
});

test('@critical dragging the face shapes the expression being edited', async ({ page }) => {
  await openFace(page, 'expressions', { empty: true });
  await page.getByRole('button', { name: 'Add Happy preset' }).click();
  await expect.poll(async () => (await documentOf(page)).expressions.length).toBe(1);
  const before = (await documentOf(page)).expressions[0].controls;
  expect(before.mouthOpen).toBe(undefined);

  await dragHandle(page, 'mouth', 0, 30);
  const after = (await documentOf(page)).expressions[0].controls;
  expect(after.mouthOpen).toBeGreaterThan(0);
  // Only what the handle drives, on top of what the preset already wrote: a
  // drag adds `mouthOpen` and does not touch anything else. (Happy brings the
  // pair of hands out with it — every face in the catalogue does something with
  // them now that the template ships a pair. It asks for the *relaxed hand*
  // rather than raising a `handLRelax` weight: a hand made of drawings is
  // chosen, and `handLPose` is the movement that chooses — docs/HANDS_2D.md.)
  expect(Object.keys(after).sort()).toEqual([
    'browRaise', 'eyeOpen',
    'handLPose', 'handLShow', 'handLX', 'handLY',
    'handRPose', 'handRShow', 'handRX', 'handRY',
    'mouthOpen', 'smile'
  ]);

  // One gesture, one undo.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await documentOf(page)).expressions[0].controls.mouthOpen).toBe(undefined);
});

test('the handles can be turned off, and the choice is kept', async ({ page }) => {
  await openFace(page);
  // A hand's console is drawn from the placement pass, which hidden handles
  // never run -- so turning them off has to take its tracks down as well, or a
  // clean canvas would still carry a slider beside each side of the face.
  await expect.poll(() => consoleTracks(page)).toBe(2);
  await page.locator('[data-puppet-toggle]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await expect(page.locator('#canvas [data-hand-console-layer]')).toHaveCSS('display', 'none');
  await expect(page.locator('[data-puppet-toggle]')).toHaveAttribute('aria-pressed', 'false');

  // Kept across tasks and stored with the other UI preferences, so it is the
  // same the next time the editor opens. (The suite clears storage on every
  // navigation, so the reload itself cannot be part of the test.)
  await page.locator('[data-task="preview"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('boop-mascotte-ui-v2') || '{}').puppetHidden)).toBe(true);

  await page.locator('[data-puppet-toggle]').click();
  await expect(page.locator('[data-puppet-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(HANDLES);
});

test('@critical one eye can close on its own, from inside the pair\'s own handle', async ({ page }) => {
  await openFace(page);
  // `eyeOpen` closes both eyes because one parameter drives both roles. A side
  // offset moves one of them on its own, and it lives inside the pair's group
  // rather than as a twelfth dot on the face.
  await expect(handle(page, 'eyeLeft')).toBeHidden();
  await page.locator('[data-puppet-expand="eyes"]').click();
  await expect(handle(page, 'eyeLeft')).toBeVisible();
  await expect(handle(page, 'eyeRight')).toBeVisible();

  const lid = (side) => page.evaluate((name) => /translate\([-\d.]+ ([-\d.]+)\)/.exec(document.querySelector(`#canvas #lidUpper${name}`).getAttribute('transform'))?.[1], side);
  const open = await lid('Left');
  expect(await lid('Right')).toBe(open);

  await dragHandle(page, 'eyeLeft', 0, 40);
  const params_ = await params(page);
  expect(params_.eyeOpenLeft).toBeLessThan(0);
  expect(params_.eyeOpen).toBe(1, 'the shared movement is untouched: this is a wink, not a blink');
  expect(Number(await lid('Left'))).toBeGreaterThan(Number(open));
  expect(await lid('Right')).toBe(open, 'the other eye stays open');
});

test('@critical with Auto Key on, posing the mascot animates it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // Auto Key lives on the Timeline; posing lives on the canvas. Until now the
  // only thing that could key was a slider in the rig panel, so dragging the
  // mascot with Auto Key on produced nothing.
  await page.locator('[data-task="animate"]').click();
  await openTimeline(page);
  await page.locator('#auto-key').check();
  await page.locator('#playhead').fill('0.6');
  await page.locator('#playhead').press('Enter');

  // Whichever clip the Timeline has open -- the template ships a whole
  // catalogue, so naming one here would be naming the first item of a list.
  const keysAt = async (parameter) => page.evaluate((name) => {
    const { animationClips } = window.__BOOP_E2E__.document();
    const clip = animationClips.find((item) => item.id === window.__BOOP_E2E__.session().animationEditor.activeClipId);
    return (clip.tracks[name] || []).filter((frame) => Math.abs(frame.time - 0.6) < 0.001).length;
  }, parameter);
  expect(await keysAt('lookX')).toBe(0);

  await page.locator('[data-task="expressions"]').click();
  await dragHandle(page, 'gaze', 30, -14);
  expect(await keysAt('lookX')).toBe(1);
  expect(await keysAt('lookY')).toBe(1);

  // One gesture is one undo step, however many controls it moved.
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await keysAt('lookX')).toBe(0);
  expect(await keysAt('lookY')).toBe(0);
});

test('handles only appear where posing is the point', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // Artwork is for drawing and Animate for timing; neither is for posing.
  await page.locator('[data-task="artwork"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(HANDLES);
  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(0);
  await page.locator('[data-task="preview"]').click();
  await expect(page.locator('[data-puppet-handle]:visible')).toHaveCount(HANDLES);
});

/* The head handle is the 2.5D turn: it drives the pose grid, and says so. */

async function generateTurn(page) {
  await page.locator('[data-task="face-setup"]').click();
  const section = page.locator('[data-setup-section="head-pose"]');
  if (!(await section.evaluate((element) => element.hasAttribute('open')))) await section.locator(':scope > summary').click();
  await page.locator('[data-head-action="generate"]').click();
  await expect(page.locator('#head-pose')).toHaveAttribute('data-head-pose-captured', '9');
}

test('@critical the head handle drives the 2.5D grid and shows its nine positions', async ({ page }) => {
  await openFace(page);
  await openSetupSection(page, 'head-pose');
  await page.locator('#head-pose').getByRole('button', { name: 'Reset all' }).click();
  await expect(page.locator('#head-pose')).toHaveAttribute('data-head-pose-captured', '0');
  // Without a turn the handle still works; it just says there is none.
  await expect.poll(() => handle(page, 'head').getAttribute('aria-valuetext')).toMatch(/no turn generated yet/);
  // The halo is a ring of dots around the handle: it has no box of its own,
  // so what is asserted is the dots.
  await expect(page.locator('.puppet-halo [data-halo-cell]')).toHaveCount(0);

  await generateTurn(page);
  const halo = page.locator('.puppet-halo');
  await expect(halo.locator('[data-halo-cell]')).toHaveCount(9);
  await expect(halo.locator('[data-halo-cell]').first()).toBeVisible();
  await expect(halo.locator('[data-halo-state="captured"]')).toHaveCount(8);
  await expect(halo.locator('[data-halo-current="true"]')).toHaveCount(1);

  // Dragging the head turns it, and the readout names the position.
  await dragHandle(page, 'head', 70, -25);
  const turned = await params(page);
  expect(turned.headX).toBeGreaterThan(0);
  expect(turned.headY).toBeLessThan(0);
  await expect(handle(page, 'head')).toHaveAttribute('aria-valuetext', /up and right|right|between positions/);
  // The turn is real: the features travel further than the head outline.
  const shift = await page.evaluate(() => {
    const read = (id) => Number(/translate\(([-\d.]+)/.exec(document.querySelector(`#canvas #${id}`)?.getAttribute('transform') || '')?.[1] ?? 0);
    return { face: read('faceRoot'), mouth: read('mouth'), pupil: read('pupilLeft') };
  });
  expect(Math.abs(shift.mouth)).toBeGreaterThan(Math.abs(shift.face));

  // Shift lands on one of the nine positions.
  await page.keyboard.down('Shift');
  await dragHandle(page, 'head', 12, 6);
  await page.keyboard.up('Shift');
  const snapped = await params(page);
  expect([-1, 0, 1]).toContain(snapped.headX);
  expect([-1, 0, 1]).toContain(snapped.headY);
  await expect(handle(page, 'head')).not.toHaveAttribute('aria-valuetext', /between positions/);

  // And a position can be reached by clicking its dot.
  await halo.locator('[data-halo-cell="0,2"]').click();
  await expect.poll(async () => (await params(page)).headX).toBe(-1);
  await expect.poll(async () => (await params(page)).headY).toBe(1);
});

test('the head is tilted by turning its handle, not by dragging it', async ({ page }) => {
  await openFace(page);
  const head = await centreOf(page, 'head');
  const tilt = await centreOf(page, 'headTilt');
  await page.mouse.move(tilt.x, tilt.y);
  await page.mouse.down();
  // Swing a quarter turn around the head.
  for (const angle of [20, 45, 70, 90]) {
    const radians = angle * Math.PI / 180, radius = Math.hypot(tilt.x - head.x, tilt.y - head.y) || 60;
    await page.mouse.move(head.x + Math.cos(radians) * radius, head.y + Math.sin(radians) * radius, { steps: 3 });
  }
  await page.mouse.up();
  await expect.poll(async () => (await params(page)).headTilt).toBeGreaterThan(0);
  expect((await params(page)).headX).toBe(0);
  expect((await params(page)).headY).toBe(0);

  await page.locator('[data-puppet-handle="headTilt"]').focus();
  await page.keyboard.press('Home');
  await expect.poll(async () => (await params(page)).headTilt).toBe(0);
});

/* A hand comes out from behind the head, and is posed on the console around it. */

test('@critical the pair rests behind the head, and one slider brings a hand out', async ({ page }) => {
  await openFace(page);
  // Basic Face ships a rigged pair, resting behind the head
  // (`docs/HAND_RIGGING.md`). A ring of ten sliders around a hand nobody can
  // see is clutter around nothing, so the only hand control on the canvas is
  // the one that brings it out -- upright, beside the face, on its own side.
  await expect(handle(page, 'hand-left-show')).toBeVisible();
  await expect(handle(page, 'hand-right-show')).toBeVisible();
  for (const id of ['hand-left', 'hand-left-turn']) {
    await expect(handle(page, id), `${id} is drawn around a hidden hand`).toBeHidden();
  }
  await expect(page.locator('[data-hand-pick]:not([hidden])')).toHaveCount(0, 'nor is a picture of a hand nobody can see');
  // And nothing to unfold: the console is a ring, not a pile.
  await expect(page.locator('[data-puppet-expand="hand-left"]')).toHaveCount(0);
  const left = await handle(page, 'hand-left-show').boundingBox();
  const right = await handle(page, 'hand-right-show').boundingBox();
  expect(left.x).toBeLessThan(right.x);

  // Slide it down and the hand comes down from under the head.
  await dragHandle(page, 'hand-left-show', 0, 500);
  expect((await params(page)).handLShow).toBe(1);
  expect((await params(page)).handRShow).toBe(0, 'one hand at a time');
  await page.locator('.canvas-toolbar [data-zoom="fit"]').click();

  // Its console comes with it: the ring it may reach inside, the places it can
  // be held to on the rim, and the turn in a row under it. A hand made of
  // drawings has no fingers to curl and no facing to slide -- it is one of a
  // handful of pictures, picked beside the face (docs/HANDS_2D.md).
  for (const id of ['hand-left', 'hand-left-turn', 'hand-left-hold-chin', 'hand-left-hold-forehead']) {
    await expect(handle(page, id), `${id} did not come out with the hand`).toBeVisible();
  }
  for (const id of ['hand-left-grip', 'hand-left-thumb', 'hand-left-index', 'hand-left-facing']) {
    await expect(handle(page, id), `${id} deforms a hand that no longer deforms`).toHaveCount(0);
  }
  // ...and the drawings it can show are beside the face and under it instead.
  await expect(page.locator('[data-hand-pick^="hand-left-pick-"]:not([hidden])')).toHaveCount(7 + 5);
  await expect(page.locator('[data-hand-pick^="hand-right-pick-"]:not([hidden])')).toHaveCount(0, 'the hidden hand offers nothing to pick');
  // One ring, for the one hand that is out. It is drawn around the hand at all
  // times rather than only while it is held.
  await expect(page.locator('#canvas [data-hand-console-layer] .hand-console-ring:visible')).toHaveCount(1);
  // Six tracks for the hand that is out -- the four places it can be held to,
  // its turn and its own way out -- and the one the hidden hand still shows
  // beside the face. Counted rather than matched with `:visible`, because a
  // slider's track is a straight line and a line has no area for a hit test.
  await expect.poll(() => consoleTracks(page)).toBe(7);
  // The other hand's console stays away, and its way out stays.
  await expect(handle(page, 'hand-right-turn')).toBeHidden();
  await expect(handle(page, 'hand-right-show')).toBeVisible();

  // Every knob is *on* the ring it slides around -- after a zoom and after a
  // resize as much as at rest. The tracks are drawn from the canvas's own
  // computed matrix and the knobs are HTML placed over it; reading the nested
  // `<svg>`'s measured CTM for the knobs instead put the whole console in two
  // places at once, a ring around each hand and a cluster of loose dots adrift
  // beside it.
  await expect.poll(() => knobsOffTheRing(page)).toEqual([]);
  await page.locator('.canvas-toolbar [data-zoom="in"]').click();
  await page.locator('.canvas-toolbar [data-zoom="in"]').click();
  await expect.poll(() => knobsOffTheRing(page)).toEqual([]);
  await page.setViewportSize({ width: 1000, height: 620 });
  await expect.poll(() => knobsOffTheRing(page)).toEqual([]);
});

test('@critical a hand is placed, closed and turned on its own console', async ({ page }) => {
  await openFace(page);
  // Both hands out: the console is mirrored between them, and the point of the
  // clockwise rule below is that the mirror does not reach the gesture.
  await dragHandle(page, 'hand-left-show', 0, 500);
  await dragHandle(page, 'hand-right-show', 0, 500);
  await page.locator('.canvas-toolbar [data-zoom="fit"]').click();
  await expect(handle(page, 'hand-left')).toBeVisible();

  // The pair arrives with its reach around the artwork, so it can be dragged
  // without filling in four numbers first.
  const hand = await documentOf(page).then((document) => document.hands.left);
  expect(hand.anchor.x).toBeGreaterThan(0);
  expect(hand.reach.x).toBeGreaterThan(0);

  await dragHandle(page, 'hand-left', 24, 16);
  const placed = await params(page);
  expect(placed.handLX).toBeGreaterThan(0);
  expect(placed.handLY).toBeGreaterThan(0);
  expect(Math.abs(placed.handLX)).toBeLessThanOrEqual(1);
  await expect(handle(page, 'hand-left')).toHaveAttribute('aria-valuetext', /left hand across/);

  // The turn is a slider on the row under the ring, not a wrist-turn.
  await dragHandle(page, 'hand-left-turn', 45, 0);
  expect((await params(page)).handLRotation).toBeGreaterThan(0.2);
  // Crossing a row slider moves nothing: a drag is projected onto its track.
  const turned = (await params(page)).handLRotation;
  await dragHandle(page, 'hand-left-turn', 0, 40);
  expect((await params(page)).handLRotation).toBeCloseTo(turned, 3);

  // A place the hand can be held to is a slider on the rim, and the arrow keys
  // move a knob along its own track whichever way that track lies.
  await handle(page, 'hand-left-hold-chin').focus();
  for (let press = 0; press < 4; press += 1) await handle(page, 'hand-left-hold-chin').press('ArrowRight');
  expect((await params(page)).handLOnChin).toBeGreaterThan(0);

  // Which hand it is showing is picked, not slid: a press beside the face, and
  // a press under it for which way round (docs/HANDS_2D.md). Both hands are
  // out, so both offer their own.
  for (const side of ['left', 'right']) {
    await expect(page.locator(`[data-hand-pick^="hand-${side}-pick-"]:not([hidden])`)).toHaveCount(7 + 5);
    await expect(page.locator(`[data-hand-pick="hand-${side}-pick-pose-relaxed"]`)).toHaveAttribute('aria-pressed', 'true');
  }
  await page.locator('[data-hand-pick="hand-left-pick-view-sideRight"]').click();
  await expect.poll(async () => (await params(page)).handLView).toBe(4);
  expect((await params(page)).handRView, 'one hand at a time').toBe(2);
  // ...and the drawing on screen is the one that was pressed.
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#canvas #handLeft > g')]
    .filter((group) => Number(group.getAttribute('opacity') ?? 1) > 0.001).map((group) => group.id)))
    .toEqual(['handLeftDraw-relaxed-sideRight']);

  // None of this is authored: posing a hand is a preview, like every handle.
  expect(await page.evaluate(() => window.__BOOP_E2E__.document().hands.left.restOffset)).toEqual({ x: 0, y: 0 });
});

/**
 * VNX-35: the same principle everywhere the mascot can be posed. The canvas
 * handles keyed; the head-pose pad and the Preview test bench did not, which
 * is a strange thing to have to know — from the author's side all three are
 * "move the mascot", and only one of them was also "animate it".
 */
test('@critical every place the mascot can be posed keys it, not only the canvas', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="animate"]').click();
  await openTimeline(page);
  await page.locator('#auto-key').check();
  await page.locator('#playhead').fill('0.4');
  await page.locator('#playhead').press('Enter');

  const keysAt = (parameter) => page.evaluate((name) => {
    const { animationClips } = window.__BOOP_E2E__.document();
    const clip = animationClips.find((item) => item.id === window.__BOOP_E2E__.session().animationEditor.activeClipId);
    return (clip.tracks[name] || []).filter((frame) => Math.abs(frame.time - 0.4) < 0.001).length;
  }, parameter);

  // 1. The head-pose pad. Keyboard, because a pose is a pose however it arrived
  //    and the arrow keys are one complete gesture each.
  expect(await keysAt('headX')).toBe(0);
  await page.locator('[data-task="face-setup"]').click();
  await openSetupSection(page, 'head-pose');
  const pad = page.locator('#head-pose [data-head-pad]');
  await pad.focus();
  await pad.press('ArrowRight');
  expect(await keysAt('headX'), 'the head pad moved the head and said nothing about it').toBe(1);
  expect(await keysAt('headY')).toBe(1);

  // 2. The Preview test bench, which is where an author spends most of their
  //    time moving the mascot around.
  await page.locator('[data-task="preview"]').click();
  const bench = page.locator('#preview-panel [data-preview-xy="lookX:lookY"]');
  await bench.focus();
  await bench.press('ArrowLeft');
  expect(await keysAt('lookX')).toBe(1);
  expect(await keysAt('lookY')).toBe(1);

  // Each of those is one undo step, however many controls it moved.
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await keysAt('lookX')).toBe(0);
  expect(await keysAt('headX'), 'and it undid one gesture, not both').toBe(1);
});
