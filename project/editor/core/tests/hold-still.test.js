import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCleanProjectState, createStore } from '../state/store.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';
import { createPreviewService } from '../../app/services/preview-service.js';
import { matchShortcut } from '../../ui/shortcuts.js';

/**
 * The mascot holds still while it is being designed, and one control puts it
 * back (docs/STILL_WHILE_DESIGNING.md).
 *
 * Both are session-only, so both are tested against a document sentinel: a
 * mascot that stops blinking because something was written down would be a
 * project the author did not ask for.
 */

/** A face with a life of its own: it blinks, and its gaze wanders. */
const livelyFace = () => {
  const state = createCleanProjectState();
  state.params = {
    eyeOpen: { type: 'number', min: 0, max: 1, default: 1, value: 1 },
    lookX: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
  };
  state.states = { idle: { eyeOpen: 1, lookX: 0, headX: 0 } };
  state.activeState = 'idle';
  state.behaviors = [
    { id: 'auto-blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', closedValue: 0, duration: .12, intervalMin: .2, intervalMax: .2, doubleChance: 0 },
    { id: 'auto-wander', type: 'drift', name: 'Eye wander', enabled: true, parameter: 'lookX', amplitude: .25, travelMin: .5, travelMax: .5, intervalMin: 0, intervalMax: 0 }
  ];
  return state;
};

/** What the document is worth, so "nothing was written down" can be asserted rather than hoped. */
const sentinel = (store) => ({ revision: store.getPersistentRevision(), domains: store.getDomainRevisions(), document: structuredClone(store.getDocument()) });

/**
 * The real controller and the real service, with the canvas and the frame clock
 * replaced: the wiring under test is "a workspace reaches the preview loop",
 * and a fake controller would prove only that the service can call a method.
 */
const createHarness = ({ state = livelyFace(), workspace = 'preview' } = {}) => {
  const store = createStore();
  store.replaceState(state);
  let clock = 0, current = workspace;
  const queue = [], status = [];
  const preview = createPreviewController({ store, canvas: { applyFrame() {} }, requestFrame: (fn) => { queue.push(fn); return queue.length; }, cancelFrame: () => {}, now: () => clock });
  const service = createPreviewService({ preview, store, getWorkspace: () => current, setPreviewClass: () => {}, setStatus: (message) => status.push(message) });
  return {
    store, preview, service, status,
    // One frame at a time, as the canvas would: a loop that stopped scheduling
    // empties the queue, and every advance after that does nothing at all.
    advance: (frames = 40) => { for (let frame = 0; frame < frames; frame += 1) { clock += 50; queue.shift()?.(clock); } },
    awake: () => queue.length > 0,
    goTo: (next) => { current = next; return service.holdStill(next); }
  };
};

/** Every distinct value a parameter took over the next second of frames. */
const sampled = (harness, name, frames = 20) => {
  const seen = new Set([harness.preview.getEffectiveParams()[name]]);
  for (let frame = 0; frame < frames; frame += 1) { harness.advance(1); seen.add(harness.preview.getEffectiveParams()[name]); }
  return seen;
};

test('the mascot holds still in the Character Builder and in Artwork, and moves again on the way out', () => {
  const harness = createHarness({ workspace: 'preview' });
  harness.goTo('preview');
  harness.preview.start();
  assert.ok(sampled(harness, 'lookX').size > 1, 'the gaze wanders where the mascot is watched');
  assert.ok(harness.awake(), 'and the loop is running');

  for (const designing of ['character', 'create']) {
    assert.equal(harness.goTo(designing), true, `${designing} holds the mascot still`);
    assert.equal(harness.preview.isHeldStill(), true);
    const rest = harness.preview.getEffectiveParams();
    assert.equal(rest.lookX, 0, 'the gaze is back where the pose puts it');
    assert.equal(rest.eyeOpen, 1, 'and the eyes are open');
    assert.equal(sampled(harness, 'lookX').size, 1, `${designing}: nothing moves the gaze`);
    assert.equal(sampled(harness, 'eyeOpen').size, 1, `${designing}: and nothing blinks`);
    assert.equal(harness.awake(), false, 'a mascot with nothing to do stops asking for frames');
  }

  assert.equal(harness.goTo('rig'), false, 'Face Setup is where movement is the work');
  assert.equal(harness.preview.isHeldStill(), false);
  assert.ok(harness.awake(), 'the loop is woken on the way out');
  assert.ok(sampled(harness, 'lookX').size > 1, 'and the gaze wanders again');
});

test('every task either designs the mascot or does not, and only the two that do hold it still', () => {
  const harness = createHarness();
  for (const [workspace, held] of [['character', true], ['create', true], ['rig', false], ['expressions', false], ['animate', false], ['reactions', false], ['preview', false]]) {
    assert.equal(harness.goTo(workspace), held, workspace);
    assert.equal(harness.preview.isHeldStill(), held, workspace);
  }
});

test('the hold writes nothing into the preview switches, so leaving gives back exactly what was running', () => {
  const harness = createHarness({ workspace: 'preview' });
  harness.goTo('preview');
  harness.preview.start();
  harness.preview.setBehaviorOverride('auto-wander', false);
  assert.deepEqual(harness.preview.getBehaviorOverrides(), { 'auto-wander': false });

  harness.goTo('character');
  assert.deepEqual(harness.preview.getBehaviorOverrides(), { 'auto-wander': false }, 'the hold mutes over them, never through them');
  assert.equal(sampled(harness, 'eyeOpen').size, 1, 'and the blink the author left on is held too');

  harness.goTo('preview');
  assert.deepEqual(harness.preview.getBehaviorOverrides(), { 'auto-wander': false });
  assert.ok(sampled(harness, 'eyeOpen').size > 1, 'the blink runs again');
  assert.equal(sampled(harness, 'lookX').size, 1, 'and the wander the author switched off stays off');
});

test('a held mascot is still posable: the hold stops what it does by itself, not what the author does', () => {
  const harness = createHarness({ workspace: 'character' });
  harness.goTo('character');
  harness.preview.start();
  harness.preview.setLiveParam('headX', .4);
  assert.equal(harness.preview.getEffectiveParams().headX, .4, 'a live parameter poses a held mascot');
  harness.advance(20);
  assert.equal(harness.preview.getEffectiveParams().headX, .4, 'and nothing takes the pose back');
  harness.preview.setLiveParam('headX', -.2);
  assert.equal(harness.preview.getEffectiveParams().headX, -.2);
});

test('a reaction nobody asked for is not due while the mascot is held', () => {
  const state = createCleanProjectState();
  state.params = { smile: { type: 'number', min: 0, max: 1, default: 0, value: 0 } };
  state.states = { idle: { smile: 0 } };
  state.activeState = 'idle';
  // No behaviours at all: the timer is the only thing that would ever move it.
  state.reactions = [{ id: 'tick', name: 'Tick', enabled: true, trigger: { type: 'timer', interval: 1 }, expression: { id: 'happy', weight: 1 } }];
  const harness = createHarness({ state, workspace: 'preview' });
  harness.goTo('preview');
  harness.preview.start();
  harness.advance(40);
  assert.equal(harness.preview.getActiveReaction()?.id, 'tick', 'a timer fires where the mascot is watched');

  harness.goTo('character');
  harness.preview.clearReactions();
  harness.advance(80);
  assert.equal(harness.preview.getActiveReaction(), null, 'and never fires while the face is being designed');
  assert.equal(harness.awake(), false, 'nothing keeps the clock running for it either');

  harness.goTo('preview');
  harness.advance(40);
  assert.equal(harness.preview.getActiveReaction()?.id, 'tick', 'it is due again on the way out');
});

test('holding still says where the author is, and never reaches the document', () => {
  const harness = createHarness({ workspace: 'preview' });
  harness.preview.start();
  const before = sentinel(harness.store);
  for (const workspace of ['character', 'create', 'rig', 'character', 'preview']) { harness.goTo(workspace); harness.advance(10); }
  assert.deepEqual(sentinel(harness.store), before, 'no revision moved, and no field changed');
});

test('the reset clears the whole session layer, leaves the document alone and does not let the face go', () => {
  const harness = createHarness({ workspace: 'character' });
  harness.goTo('character');
  harness.preview.start();
  harness.preview.setLiveParam('headX', .4);
  harness.preview.setBehaviorOverride('auto-blink', false);
  const before = sentinel(harness.store);

  harness.service.reset();

  assert.deepEqual(harness.preview.getLiveParams(), {}, 'the live pose is gone');
  assert.deepEqual(harness.preview.getBehaviorOverrides(), {}, 'and so are the preview-only switches');
  assert.equal(harness.preview.getEffectiveParams().headX, 0, 'the mascot is back to what the document says');
  assert.deepEqual(sentinel(harness.store), before, 'the artwork, the rig and every other authored thing are untouched');
  assert.equal(harness.preview.isHeldStill(), true, 'a reset in the Character Builder is not what starts the face blinking');
  assert.equal(sampled(harness, 'eyeOpen').size, 1);
  assert.deepEqual(harness.status, ['Mascot reset: the live pose, the playback and every preview-only change. Nothing in your project changed.']);
});

test('the reset has a keyboard route that collides with nothing', () => {
  const event = (overrides = {}) => ({ key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null, ...overrides });
  assert.equal(matchShortcut(event({ key: 'r', ctrlKey: true, altKey: true })), 'reset-mascot');
  // Option+R types '®' on a Mac, so the physical key answers as well.
  assert.equal(matchShortcut(event({ key: '®', code: 'KeyR', metaKey: true, altKey: true })), 'reset-mascot');
  assert.equal(matchShortcut(event({ key: 'r', ctrlKey: true })), null, 'plain Ctrl+R stays the browser reload');
  assert.equal(matchShortcut(event({ key: 'r' })), null, 'and R alone is still the Rectangle tool');
  assert.equal(matchShortcut(event({ key: 'r', ctrlKey: true, altKey: true }), { typing: true }), null, 'a text field keeps its own keys');
});

test('one reset, in the project bar, on every tab', () => {
  const shell = readFileSync(new URL('../../shell/topbar.js', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const actions = shell.slice(shell.indexOf('class="project-actions"'), shell.indexOf('id="save-state"'));
  assert.match(actions, /id="reset-mascot-top"/, 'it is in the project bar, beside Save Project and Export');
  assert.match(actions, /aria-label="Reset mascot"/, 'and it says what it is');
  assert.equal(shell.includes('id="preview-reset"'), false, 'and it is the only one: Preview no longer carries a second copy');
  // The panels are hidden per workspace by `#app[data-workspace=…]` rules; a
  // topbar control that appeared in one of them would not be on every tab.
  assert.equal(/\[data-workspace[^{]*reset-mascot-top/.test(index), false, 'nothing gates it on a workspace');
  assert.equal(/reset-mascot-top[^{]*\{[^}]*display:none/.test(index), false, 'and nothing hides it at any width');
});
