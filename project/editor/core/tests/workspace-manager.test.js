import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTEXT_RENDER_PLAN, createWorkspaceManager, inspectorKey, shouldRevealInspector } from '../../app/workspace-manager.js';
import { RENDER_TARGETS } from '../state/render-plan.js';

/**
 * What happens when the editor's context changes (VNX-02). Three jobs that
 * used to be one dense closure: tell the panels whose workspace it is, redraw
 * the ones that follow the context, and decide whether a phone should slide
 * the inspector into view.
 */

const harness = (overrides = {}) => {
  const drawn = [], told = [];
  // The workspace modules of UIR-16, as the manager sees them: an id, the
  // surfaces their screens mount, and a lifecycle they answer for themselves.
  const workspace = (id, surfaces) => ({
    id, surfaces,
    enter: (surface) => told.push(`${id}.enter:${surface}`),
    leave: (surface) => told.push(`${id}.leave:${surface}`)
  });
  const manager = createWorkspaceManager({
    workspaces: [workspace('rig', ['rig']), workspace('animate', ['expressions', 'animate']), workspace('behavior', ['reactions'])],
    targets: Object.fromEntries(CONTEXT_RENDER_PLAN.map((name) => [name, () => drawn.push(name)])),
    renderInspector: () => ({ kind: 'none' }),
    inspectorHeading: () => 'Mouth',
    ...overrides
  });
  return { manager, drawn, told };
};

test('the context plan only names targets the render plan already knows', () => {
  // One registry of panels serves both plans. A name that exists in only one
  // of them is a panel wired twice under two spellings.
  for (const name of CONTEXT_RENDER_PLAN) assert.ok(RENDER_TARGETS.includes(name), `${name} is not a render target`);
});

test('a context change redraws the panels that follow it, and says when one is missing', () => {
  const { manager, drawn } = harness();
  manager.apply({ workspace: 'rig' });
  assert.deepEqual(drawn, [...CONTEXT_RENDER_PLAN]);
  assert.throws(() => createWorkspaceManager({ targets: {} }), /missing render targets/);
});

test('a panel is told when its own workspace arrives and when it goes', () => {
  const { manager, told } = harness();
  manager.apply({ workspace: 'expressions' });
  assert.deepEqual(told, ['rig.leave:expressions', 'animate.enter:expressions', 'behavior.leave:expressions']);
  told.length = 0;
  manager.apply({ workspace: 'rig' });
  // Rig is showing now, so nothing of its cancels; the other two are told they
  // are the ones being left.
  assert.deepEqual(told, ['rig.enter:rig', 'animate.leave:rig', 'behavior.leave:rig']);
});

/**
 * A workspace is told the *surface*, not whether it is the one showing.
 *
 * Animate mounts two of them, and they want different things: Expressions holds
 * a face while it is being shaped and has to let go on the way to Motions, which
 * is the same workspace. A lifecycle that only said "you are open" could not
 * express that, and the table it replaced could not either (UIR-16).
 */
test('a workspace with two surfaces is told which of its own screens it arrived on', () => {
  const { manager, told } = harness();
  manager.apply({ workspace: 'animate' });
  assert.deepEqual(told.filter((entry) => entry.startsWith('animate')), ['animate.enter:animate']);
  told.length = 0;
  manager.apply({ workspace: 'expressions' });
  assert.deepEqual(told.filter((entry) => entry.startsWith('animate')), ['animate.enter:expressions']);
  told.length = 0;
  manager.apply({ workspace: 'preview' });
  assert.deepEqual(told.filter((entry) => entry.startsWith('animate')), ['animate.leave:preview']);
});

test('the sheet borrows the inspector heading, except in Preview', () => {
  const subjects = [];
  const { manager } = harness({ setSheetSubject: (text) => subjects.push(text) });
  manager.apply({ workspace: 'rig' });
  manager.apply({ workspace: 'preview' });
  assert.deepEqual(subjects, ['Mouth', 'Preview']);
});

test('the inspector is revealed for a new selection, and never for a workspace switch', () => {
  // All four clauses, one at a time. Getting this wrong means the sheet either
  // never appears or fights every click the author makes.
  const base = { switchedWorkspace: false, compact: true, kind: 'artwork-element', key: 'a', lastKey: 'b' };
  assert.equal(shouldRevealInspector(base), true);
  assert.equal(shouldRevealInspector({ ...base, switchedWorkspace: true }), false, 'a workspace switch already shows its own panel');
  assert.equal(shouldRevealInspector({ ...base, compact: false }), false, 'on a desktop the inspector is already on screen');
  assert.equal(shouldRevealInspector({ ...base, kind: 'none' }), false, 'nothing is selected');
  assert.equal(shouldRevealInspector({ ...base, key: 'b' }), false, 'the same selection as last time');
});

test('picking a second part on a phone reveals the sheet, picking the same one again does not', () => {
  let reveals = 0, showing = { kind: 'none' };
  const { manager } = harness({ isCompact: () => true, revealInspector: () => { reveals += 1; }, renderInspector: () => showing });
  manager.apply({ workspace: 'rig' });
  assert.equal(reveals, 0, 'arriving in a workspace is not a selection');
  showing = { kind: 'semantic-part', part: 'mouth' };
  manager.apply({ workspace: 'rig' });
  assert.equal(reveals, 1);
  manager.apply({ workspace: 'rig' });
  assert.equal(reveals, 1, 'the same part again is not a new selection');
  showing = { kind: 'semantic-part', part: 'eyes' };
  manager.apply({ workspace: 'rig' });
  assert.equal(reveals, 2);
});

test('what the inspector is showing has one identity, whatever names the thing', () => {
  assert.equal(inspectorKey({ kind: 'artwork-element', id: 'head' }), 'artwork-element:head');
  assert.equal(inspectorKey({ kind: 'semantic-part', part: 'mouth' }), 'semantic-part:mouth');
  assert.equal(inspectorKey({ kind: 'semantic-control', parameter: 'mouthOpen' }), 'semantic-control:mouthOpen');
  assert.equal(inspectorKey({}), 'none:');
});
