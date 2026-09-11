import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createPreviewPanel } = await import('../../ui/preview-panel.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createTemplateProjectState } = await import('../sample/templates/template-export.js');

/**
 * The hands on the test bench (V3-11).
 *
 * Hand Setup's last step was "Ready. Test it from Preview" — and Preview had
 * nothing for a hand at all. Not "only raw sliders": the movement checklist is
 * the *face* parts, and `leftHand` / `rightHand` declare no controls
 * (`part-registry.js`), so no hand parameter ever reached the panel. A hand's
 * controls come from the `hands` block instead, which is the thing that
 * actually animates one.
 */
function harness() {
  const store = createEditorStore(createTemplateProjectState());
  const live = {};
  const preview = {
    getLiveParams: () => ({ ...live }), setLiveParam: (name, value) => { live[name] = Number(value); },
    getExpressionWeights: () => ({}), getExpressionTargets: () => ({}), getActiveReaction: () => null,
    getEventLog: () => [], isPlaying: () => false, getActiveClipId: () => null,
    getBehaviorOverrides: () => ({}), getSession: () => ({ previewState: null })
  };
  const host = document.createElementNS('', 'div');
  // The panel ignores a click on a button outside itself; a synthesized target
  // is nobody's child, so say it is inside.
  host.contains = () => true;
  const committed = [];
  const panel = createPreviewPanel(host, store, preview, { onCommit: (values) => committed.push(values) });
  panel.render();
  return { host, live, committed, panel, click: (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) }) };
}

test('Preview offers each hand a pad, the places it goes, and its drawings', () => {
  const it = harness();
  assert.match(it.host.innerHTML, /data-preview-section="hands"/);
  for (const [side, x, y] of [['left', 'handLX', 'handLY'], ['right', 'handRX', 'handRY']]) {
    assert.match(it.host.innerHTML, new RegExp(`data-preview-hand="${side}"`), side);
    // A pad, on the hand's own parameters — the first XY pad a hand has ever had.
    assert.match(it.host.innerHTML, new RegExp(`data-preview-xy="${x}:${y}" data-preview-hand-side="${side}"`), `${side} pad`);
    // The named places, and the drawings the hand holds.
    assert.match(it.host.innerHTML, new RegExp(`data-hand-pose="${side}:up"`), `${side} places`);
    assert.match(it.host.innerHTML, new RegExp(`data-hand-style="${side}:fist"`), `${side} drawings`);
    // And the two sliders that are not a position: the turn, and the way out.
    assert.match(it.host.innerHTML, new RegExp(`data-preview-control="hand${side === 'right' ? 'R' : 'L'}Rotation"`), `${side} turn`);
    assert.match(it.host.innerHTML, new RegExp(`data-preview-control="hand${side === 'right' ? 'R' : 'L'}Show"`), `${side} way out`);
  }
});

test('a press puts the hand there, brings it out, and keys what it wrote', () => {
  const it = harness();
  it.click({ handPose: 'left:up' });
  // Out from behind the head with the pose: a hand posed behind its own head
  // is a pose nobody can see (docs/HAND_RIGGING.md, "Behind the head").
  assert.deepEqual(it.live, { handLShow: 1, handLY: -1 });
  assert.deepEqual(it.committed, [{ handLShow: 1, handLY: -1 }], 'one key per parameter, through the ordinary channel');
  assert.match(it.host.innerHTML, /data-hand-pose="left:up"[^>]*aria-pressed="true"/);

  // A drawing is one number, and it also brings the hand out to be looked at.
  it.click({ handStyle: 'left:fist' });
  assert.equal(it.live.handLStyle, 2);
  assert.equal(it.live.handLShow, 1);
});

test('a hold is a place like any other, and there is a way back out of it', () => {
  const it = harness();
  // The template holds each palm to five places on the face
  // (docs/HAND_RIGGING.md, "Held to the face"); the bench offers them beside
  // the places the hand reaches on its own.
  assert.match(it.host.innerHTML, /data-hand-pose="left:hand-left-on-chin"/);
  it.click({ handPose: 'left:hand-left-on-chin' });
  assert.equal(it.live.handLOnChin, 1);
  it.click({ handPose: 'left:let-go' });
  assert.equal(it.live.handLOnChin, 0);
  assert.equal(it.live.handLOnForehead, 0, 'every hold this hand has, released');
});

test('a project with no hands has no hands section, and no empty chips', () => {
  const store = createEditorStore({ ...createTemplateProjectState(), hands: null });
  const host = document.createElementNS('', 'div');
  createPreviewPanel(host, store, {
    getLiveParams: () => ({}), setLiveParam: () => {}, getExpressionWeights: () => ({}), getActiveReaction: () => null,
    getEventLog: () => [], isPlaying: () => false, getActiveClipId: () => null,
    getBehaviorOverrides: () => ({}), getSession: () => ({ previewState: null })
  }).render();
  assert.doesNotMatch(host.innerHTML, /data-preview-section="hands"/);
});
