// The timeline's transport (V3-13): play, pause, a frame at a time, and the
// pose a drag on the canvas leaves behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createTimelinePanel } = await import('../../animation-editor/timeline/timeline-panel.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createPreviewController } = await import('../preview-runtime/preview-controller.js');
const { createCleanProjectState } = await import('../state/store.js');

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

/** Two motions, so one can play through the motion layer while another is open. */
function project() {
  const state = createCleanProjectState();
  state.params = { lookX: number(-1, 1), lookY: number(-1, 1) };
  state.states = { idle: { lookX: 0, lookY: 0 } }; state.activeState = 'idle';
  state.animationClips = [
    { id: 'look', name: 'Look', duration: 2, loop: false, tracks: { lookX: [{ time: 0, value: 0, easing: 'linear' }, { time: 1, value: 1, easing: 'linear' }] } },
    { id: 'wave', name: 'Wave', duration: 1, loop: false, tracks: { lookY: [{ time: 0, value: 0, easing: 'linear' }] } }
  ];
  state.animationEditor = { activeClipId: 'look', playhead: 0, panel: 'preview' };
  return state;
}

function harness({ autoKey = false, clip = 'look' } = {}) {
  const store = createEditorStore(project());
  store.mutateSession('animationEditor', (session) => { session.animationEditor.activeClipId = clip; session.animationEditor.autoKey = autoKey; });
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const frames = [];
  const preview = createPreviewController({ store, canvas: { applyFrame() {} }, requestFrame: (fn) => frames.push(fn), cancelFrame: () => {}, now: () => 0 });
  const notices = [];
  const panel = createTimelinePanel(host, store, history, preview, null, (message, tone) => notices.push({ message, tone }));
  panel.render();
  const click = (target) => host.dispatch('click', { target: clickTarget(target) });
  return {
    store, history, host, preview, panel, notices, click,
    playhead: () => store.getSession().animationEditor.playhead,
    keysOf: (parameter) => (store.getDocument().animationClips.find((item) => item.id === clip)?.tracks[parameter] || [])
  };
}

/* The confirmed bug: `isPlaying` is "anything is playing", `pauseClip` only
 * ever pauses the clip transport, so Space did nothing at all while a motion
 * was running through the motion layer. */
test('play/pause acts on the transport that is actually playing', () => {
  const it = harness();

  // A motion on the shared layer: what the Motion Inspector and a reaction play.
  assert.equal(it.preview.playMotion('wave'), true);
  assert.equal(it.preview.isPlaying(), true);
  it.panel.togglePlayback();
  assert.equal(it.preview.isPlaying(), false, 'Space stops the motion that was playing instead of pausing a clip that never started');

  // An arrangement: a schedule, so it stops rather than freezing mid-pass.
  assert.equal(it.preview.playArrangement([{ id: 'p1', clipId: 'wave', start: 0 }]), true);
  assert.equal(it.preview.isArrangementPlaying(), true);
  it.panel.togglePlayback();
  assert.equal(it.preview.isArrangementPlaying(), false, 'the pass ends');
  assert.equal(it.preview.isPlaying(), false);

  // And the clip transport itself still plays and pauses.
  it.panel.togglePlayback();
  assert.equal(it.preview.isClipPlaying(), true);
  it.panel.togglePlayback();
  assert.equal(it.preview.isClipPlaying(), false);
});

test('the Pause button speaks to the same transport as Space', () => {
  const it = harness();
  it.preview.playMotion('wave');
  it.click({ id: 'clip-pause' });
  assert.equal(it.preview.isPlaying(), false);

  it.click({ id: 'clip-play' });
  assert.equal(it.preview.isClipPlaying(), true, 'Play starts the clip the timeline has open');
  it.click({ id: 'clip-pause' });
  assert.equal(it.preview.isClipPlaying(), false);
});

/* Stop is gone, so its one unique job — clearing the motion layer and the
 * arrangement — moves to leaving the workspace the transport lives in. */
test('leaving the timeline stops what the timeline started, and keeps the playhead', () => {
  const it = harness();
  it.store.mutateSession('animationEditor', (session) => { session.animationEditor.playhead = .5; });

  it.preview.playMotion('wave');
  it.preview.playArrangement([{ id: 'p1', clipId: 'wave', start: 0 }]);
  assert.equal(it.panel.stopPlayback(), true);
  assert.equal(it.preview.isPlaying(), false);
  assert.deepEqual(it.preview.getMotionWeights(), {}, 'the motion layer is cleared, which only stopClip does');
  assert.equal(it.preview.isArrangementPlaying(), false);
  assert.equal(it.playhead(), .5, 'a view switch is not a rewind');
  assert.equal(it.preview.getCurrentTime(), .5, 'and the mascot keeps the pose the playhead is on');

  assert.equal(it.panel.stopPlayback(), false, 'nothing playing, nothing to stop');
});

test('the toolbar is play, pause and a frame at a time', () => {
  const it = harness();
  for (const control of ['id="clip-play"', 'id="clip-pause"', 'data-frame="-1"', 'data-frame="1"', 'data-key-nav="-1"', 'data-key-nav="1"', 'id="playhead"', 'id="auto-key"', 'data-zoom="fit"']) {
    assert.ok(it.host.innerHTML.includes(control), `the transport keeps ${control}`);
  }
  assert.equal(it.host.innerHTML.includes('id="clip-stop"'), false, 'Stop is gone: Space pauses, and leaving Animate stops');
  assert.equal(it.host.innerHTML.includes('data-zoom=".25"'), false, 'and so are the zoom steppers: ctrl+wheel scales, Fit frames the motion');
  assert.equal(it.host.innerHTML.includes('data-zoom="-.25"'), false);

  // A frame is 1/30 s here, and stepping commits the playhead rather than
  // leaving it transient the way a scrub does.
  it.click({ dataset: { frame: '1' } });
  it.click({ dataset: { frame: '1' } });
  assert.ok(Math.abs(it.playhead() - 2 / 30) < 1e-9, 'two frames on');
  it.click({ dataset: { frame: '-1' } });
  assert.ok(Math.abs(it.playhead() - 1 / 30) < 1e-9, 'one frame back');
});

/* Posing on the canvas reaches `autoKeyMany`, which keeps nothing when Auto Key
 * is off or no motion is open. A gesture that silently does nothing is a
 * gesture the author repeats, so it reports why. */
test('a pose that keys nothing says why, and a pose that keys says where', () => {
  const off = harness({ autoKey: false });
  assert.deepEqual(off.panel.autoKeyMany({ lookX: .4, lookY: -.2 }), { keyed: false, reason: 'auto-key-off', message: 'That pose was not keyed: Auto Key is off. Turn it on and the next one lands at the playhead.' });
  assert.equal(off.keysOf('lookY').length, 0);

  const none = harness({ autoKey: true, clip: 'gone' });
  assert.deepEqual(none.panel.autoKeyMany({ lookX: .4 }), { keyed: false, reason: 'no-clip', message: 'That pose was not keyed: no motion is open. Make one, then pose the mascot again.' });

  const nothing = harness({ autoKey: true });
  assert.deepEqual(nothing.panel.autoKeyMany({ tailWag: 1 }), { keyed: false, reason: 'nothing-moved', message: null }, 'a movement the project does not have is not a warning');

  const on = harness({ autoKey: true });
  on.store.mutateSession('animationEditor', (session) => { session.animationEditor.playhead = .5; });
  assert.deepEqual(on.panel.autoKeyMany({ lookX: .4, lookY: -.2 }), { keyed: true, reason: null, message: null });
  assert.deepEqual(on.keysOf('lookY'), [{ time: .5, value: -.2, easing: 'linear' }]);
  assert.equal(on.notices.at(-1).message, '◆ 2 keys added at 0.50 s');
  on.history.undo();
  assert.equal(on.keysOf('lookY').length, 0, 'one gesture, one undo step');
});
