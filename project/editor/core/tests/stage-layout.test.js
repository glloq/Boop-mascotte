/**
 * The mascot's size is a consequence of the task (UX-60 PR 1–2).
 *
 * The measured bug: the columns were pixels and the canvas was `1fr`, so every
 * pixel a wider monitor added went to the face — 52 % of a 1280 window and
 * 62–69 % of a 1920 one. These are the rules that end it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_STAGE_PX, STAGE_SIZES, autoScale, columnsForStage, hasStage, stageFor } from '../../ui/stage-layout.js';
import { MODES } from '../../ui/task-router.js';

const mode = (stage, layout = { left: 400, right: 320 }) => ({ id: 'test', layout, stage });

test('a stage takes its share of the window and the columns take the rest', () => {
  const controls = mode({ size: 'medium' });
  const narrow = columnsForStage(controls, 1280);
  const wide = columnsForStage(controls, 1920);
  assert.equal(narrow.stage, Math.round(1280 * STAGE_SIZES.medium));
  assert.equal(wide.stage, Math.round(1920 * STAGE_SIZES.medium));
  // The whole point: the *share* is the constant, so a wider window buys the
  // work more room rather than buying the mascot more room.
  assert.equal(narrow.stage / 1280, wide.stage / 1920);
  assert.equal(narrow.left + narrow.right + narrow.stage, 1280, 'every pixel is spoken for');
  assert.equal(wide.left + wide.right + wide.stage, 1920);
  assert.ok(wide.left > narrow.left, 'and the columns are the ones that grew');
});

test('the columns keep the proportion the screen asked for', () => {
  // A screen that wanted a wide list and a narrow detail keeps that shape on
  // every monitor, instead of donating the difference to the mascot.
  const { left, right } = columnsForStage(mode({ size: 'small' }, { left: 600, right: 200 }), 1600);
  assert.ok(left > right * 2.5, `${left} to ${right} keeps the 3:1 the screen asked for`);
  assert.equal(left + right, 1600 - Math.round(1600 * STAGE_SIZES.small));
});

test('a screen with one column gives the whole task area to it', () => {
  // `right: 0` is the control layout's shape: the detail lives inside the deck
  // rather than in a third permanent column (§22 of the brief).
  const { left, right } = columnsForStage(mode({ size: 'medium' }, { left: 400, right: 0 }), 1440);
  assert.equal(right, 0);
  assert.equal(left, 1440 - Math.round(1440 * STAGE_SIZES.medium));
});

test('a screen that has not been migrated keeps the old arithmetic', () => {
  // This is what lets the shell move a screen at a time rather than in one
  // jump: no `stage`, no new behaviour, `resolveSplit` as before.
  assert.equal(columnsForStage({ id: 'old', layout: { left: 300, right: 310 } }, 1440), null);
  assert.equal(hasStage({ id: 'old' }), false);
  assert.equal(stageFor({ id: 'old' }).size, null);
});

test('a stage never shrinks to a stamp', () => {
  // A mini stage on a narrow window would otherwise be a mascot nobody can see.
  const { stage } = columnsForStage(mode({ size: 'mini' }), 900);
  assert.equal(stage, MIN_STAGE_PX);
});

test('an automatic fit shrinks and never enlarges', () => {
  // The measured 246 % on Design ▸ Hands. `fitScale` above 1 means the drawing
  // is smaller than the stage, and filling the stage with it is something an
  // author asks for with `Fit`, not something a screen does on arrival.
  assert.equal(autoScale(2.5, 1, 'down-only'), 1, 'a small drawing is left at 1:1');
  assert.equal(autoScale(0.4, 1, 'down-only'), 0.4, 'a big one is shrunk to fit');
  assert.equal(autoScale(2.5, 1, 'fit'), 2.5, 'Fit is voluntary, and fills the stage');
  assert.equal(autoScale(2.5, 1.8, 'preserve'), 1.8, 'a drawing surface keeps the zoom its author set');
  assert.equal(autoScale(2.5, null, 'preserve'), 1, 'and starts at 1:1 rather than filled');
});

test('every navigable screen declares what its stage is for', () => {
  // A screen with no declaration silently gets the old behaviour, which is the
  // migration hatch -- but once they are all migrated, a missing one is a
  // screen that will quietly keep growing its mascot with the monitor.
  const navigable = Object.values(MODES).filter((item) => item.navigable);
  const missing = navigable.filter((item) => !hasStage(item)).map((item) => item.id);
  assert.deepEqual(missing, [], 'every screen sizes its own stage');
  for (const item of navigable) {
    const stage = stageFor(item);
    assert.ok(STAGE_SIZES[stage.size] > 0, `${item.id} names a real size`);
    assert.ok(['down-only', 'preserve', 'fit'].includes(stage.autoZoom), `${item.id} names a real zoom policy`);
  }
});

test('the screens the brief names as configuration keep their mascot small', () => {
  // §36: the stage is 25–35 % on the screens where an author is configuring
  // capabilities rather than drawing.
  for (const id of ['design.assemble', 'design.hands', 'rig.assign', 'rig.controls', 'animate.expressions', 'animate.motions']) {
    const share = STAGE_SIZES[stageFor(MODES[id]).size];
    assert.ok(share >= 0.25 && share <= 0.35, `${id} is ${Math.round(share * 100)} %, inside 25–35`);
  }
  // And the ones where the drawing *is* the work keep it big.
  for (const id of ['design.artwork', 'rig.deform', 'preview']) {
    assert.ok(STAGE_SIZES[stageFor(MODES[id]).size] >= 0.6, `${id} keeps a large stage`);
  }
});

test('nothing here is a document write', () => {
  // The stage size, the zoom policy and the columns are all where the author is
  // standing, never what their mascot is.
  const frozen = JSON.stringify(MODES['rig.controls']);
  columnsForStage(MODES['rig.controls'], 1440, { left: 900, right: 20 });
  autoScale(3, 1, 'down-only');
  assert.equal(JSON.stringify(MODES['rig.controls']), frozen, 'the route table is untouched');
});
