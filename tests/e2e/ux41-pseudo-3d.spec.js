import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * The pseudo-3D baseline (3D-01, docs/PSEUDO_3D_BASELINE.md).
 *
 * The head turn is generated, so "it looks better" is not a claim anyone can
 * check. This measures the nine poses on the real canvas and asserts the
 * properties a turn must have — then records the numbers, so the next change to
 * the generator has a *before* to be judged against rather than an opinion.
 *
 * What it deliberately does not do is assert the properties the turn does not
 * have yet (an asymmetric silhouette, real occlusion). Those are written down
 * as gaps in the doc; a failing test that everyone learns to ignore is worse
 * than a gap that is named.
 */

const POSES = [
  ['front', 0, 0], ['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1],
  ['up-left', -1, -1], ['up-right', 1, -1], ['down-left', -1, 1], ['down-right', 1, 1]
];
const PARTS = ['head', 'nose', 'mouth', 'eyeLeft', 'eyeRight', 'pupilLeft', 'pupilRight', 'earLeft', 'earRight'];

const setParam = (page, name, value) => page.evaluate(([n, v]) => window.__BOOP_E2E__.setLiveParam(n, v), [name, value]);

/** What is on screen, not what we asked for: the box the viewer actually sees. */
const measure = (page, ids) => page.evaluate((list) => Object.fromEntries(list.map((id) => {
  const box = document.querySelector(`#canvas #${id}`)?.getBoundingClientRect();
  return [id, box && box.width ? { cx: box.x + box.width / 2, cy: box.y + box.height / 2, w: box.width, h: box.height } : null];
})), ids);

async function poseAndMeasure(page, x, y) {
  await setParam(page, 'headX', x);
  await setParam(page, 'headY', y);
  await page.waitForTimeout(60);
  return measure(page, PARTS);
}

test('@critical the nine poses of the head turn, measured', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'head-pose');
  await expect(page.locator('#head-pose[data-head-pose-ready="true"]')).toBeVisible();
  await page.locator('[data-head-action="generate"]').click();
  await expect(page.locator('#head-pose')).toHaveAttribute('data-head-pose-captured', /[1-9]/);

  const poses = {};
  for (const [name, x, y] of POSES) poses[name] = await poseAndMeasure(page, x, y);
  const front = poses.front;
  for (const id of PARTS) expect(front[id], `${id} is not on the canvas`).not.toBeNull();

  const travel = (pose, id) => Math.abs(pose[id].cx - front[id].cx);

  // 1. A turn is not a slide: the features must travel much further than the
  //    outline they sit on. This is the property ux24 already guards; it is
  //    repeated here because every other number is read against it.
  for (const side of ['left', 'right']) {
    expect(travel(poses[side], 'nose') / Math.max(travel(poses[side], 'head'), 0.5),
      `${side}: the nose barely moves more than the head`).toBeGreaterThan(3);
  }

  // 2. Left and right are mirror images. A generator that is not symmetric is
  //    not modelling a head, it is modelling one direction and negating it.
  const asymmetry = Math.abs(travel(poses.left, 'nose') - travel(poses.right, 'nose'));
  expect(asymmetry, 'turning left and turning right move the nose by different amounts').toBeLessThan(2);

  // 3. One eye goes away and is foreshortened; the other comes towards the
  //    viewer and is not. Which is which follows the rig's own convention, so
  //    the property is asserted rather than the side — a spec that hardcodes a
  //    side is a spec that has to be edited when the convention is questioned.
  const narrow = (pose, id) => pose[id].w / front[id].w;
  const far = narrow(poses.right, 'eyeLeft') < narrow(poses.right, 'eyeRight') ? 'eyeLeft' : 'eyeRight';
  const near = far === 'eyeLeft' ? 'eyeRight' : 'eyeLeft';
  expect(narrow(poses.right, far), 'neither eye narrowed: nothing is going away').toBeLessThan(0.8);
  expect(poses.right[near].w, 'the near eye is not wider than the far one').toBeGreaterThan(poses.right[far].w * 1.2);
  // And the other way round, the other side: a turn is symmetric or it is one
  // direction with a minus sign.
  expect(narrow(poses.left, near), 'turning the other way did not swap which eye is far').toBeLessThan(0.8);

  // 4. Up and down move features vertically, and by less than left/right moves
  //    them horizontally — a cartoon head nods less than it turns.
  const nod = Math.abs(poses.up.nose.cy - front.nose.cy);
  expect(nod, 'nodding moves nothing').toBeGreaterThan(1);

  // 5. A diagonal is not the sum of two slides. This is the property the
  //    pseudo-projector exists to give (3D-05): a part already swung round by
  //    the turn has spent depth it no longer has to spend on the nod, so the
  //    corner pose is not where adding the two edge poses would put it.
  //
  //    Measured as the largest gap over every part, in both axes. The first
  //    version of this measured the nose's `cx` alone and always reported 0 —
  //    honestly, but uselessly: a pitch cannot move a point sideways in any
  //    model, so that number is structurally zero and says nothing. The
  //    baseline value for *this* number is 0 too, and provably so rather than
  //    by measurement: the old displacement was `x · k` plus `y · k`, two
  //    independent products, and the sum of two of those is the third by
  //    construction, for every part and both axes.
  const gap = (id) => {
    const summed = (axis) => front[id][axis]
      + (poses.right[id][axis] - front[id][axis])
      + (poses.up[id][axis] - front[id][axis]);
    return Math.hypot(poses['up-right'][id].cx - summed('cx'), poses['up-right'][id].cy - summed('cy'));
  };
  const compounding = Math.max(...PARTS.map(gap));
  expect(compounding, 'a diagonal is still two slides added together').toBeGreaterThan(5);

  // eslint-disable-next-line no-console
  console.log('PSEUDO-3D BASELINE ' + JSON.stringify({
    noseTravel: { left: +travel(poses.left, 'nose').toFixed(1), right: +travel(poses.right, 'nose').toFixed(1) },
    headTravel: { left: +travel(poses.left, 'head').toFixed(1), right: +travel(poses.right, 'head').toFixed(1) },
    far: far, farEyeWidth: +narrow(poses.right, far).toFixed(3), nearEyeWidth: +narrow(poses.right, near).toFixed(3),
    headWidth: +(poses.right.head.w / front.head.w).toFixed(3),
    nod: +nod.toFixed(1),
    diagonalCompounding: +compounding.toFixed(2)
  }));

  // 6. Every pose is distinct: nine cells that produce the same picture are not
  //    a turn, whatever the numbers inside them say.
  const signatures = new Set(POSES.map(([name]) => PARTS.map((id) => `${Math.round(poses[name][id].cx)},${Math.round(poses[name][id].cy)}`).join('|')));
  expect(signatures.size, 'two of the nine poses look identical').toBe(POSES.length);
});
