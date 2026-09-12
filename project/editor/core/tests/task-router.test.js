import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOBAL_MODES, MODES, MODE_ALIASES, PANEL_MODES, SURFACES, WORKSPACES, WORKSPACE_ORDER,
  createTaskRouter, modeSections, modeToSurface, modeToWorkspace, normalizeMode, normalizeRoute,
  normalizeSurface, normalizeTarget, sectionMode, surfaceToMode, workspaceEntryMode, workspaceModes
} from '../../ui/task-router.js';
import { readUiPreferences, UI_PREFERENCES_KEY } from '../../ui/workspace-state.js';

/**
 * The route model of UIR-01 (docs/UIR_REFACTOR_BASELINE.md).
 *
 * Three words that were two: a **workspace** is one of the four questions, a
 * **mode** is a screen inside one, and a **surface** is the column of panels a
 * mode mounts. The tests that matter most here are the boring ones — that every
 * older name for a route still resolves, and that every screen is reachable —
 * because a renaming pass is the one change that can lose a capability in
 * silence.
 */

test('a mode resolves from its own id, from every older name, and from nonsense to a default', () => {
  assert.equal(normalizeMode('rig.assign'), 'rig.assign');
  assert.equal(normalizeMode('face-setup'), 'rig.assign', 'the task id Face Setup had');
  assert.equal(normalizeMode('rig'), 'rig.assign', 'and the surface id it had before that');
  assert.equal(normalizeMode('character'), 'design.face');
  assert.equal(normalizeMode('create'), 'design.artwork');
  assert.equal(normalizeMode('animate'), 'animate.motions', 'the Motions task, not the Animate workspace');
  assert.equal(normalizeMode('unknown'), 'design.artwork');
  assert.equal(normalizeMode('unknown', 'rig.deform'), 'rig.deform', 'a caller may name its own fallback');
});

test('every id that was ever navigable still resolves to a screen', () => {
  // The whole point of the alias table: a deep link, a saved preference or a
  // browser spec written against the old navigation lands somewhere real.
  for (const [old, mode] of Object.entries(MODE_ALIASES)) {
    assert.ok(MODES[mode]?.navigable, `${old} points at ${mode}, which is not a screen`);
    assert.equal(normalizeMode(old), mode);
  }
  for (const surface of SURFACES) assert.equal(modeToSurface(surfaceToMode(surface)), surface,
    `${surface} has no screen that mounts it, so its panels are unreachable`);
});

test('the four workspaces hold every screen but the global ones, each exactly once', () => {
  assert.deepEqual([...WORKSPACE_ORDER], ['design', 'rig', 'animate', 'behavior'], 'in the order the questions are asked');
  const filed = WORKSPACE_ORDER.flatMap((workspace) => [...workspaceModes(workspace)]);
  const navigable = Object.values(MODES).filter((mode) => mode.navigable).map((mode) => mode.id);
  assert.deepEqual(navigable.filter((mode) => !filed.includes(mode) && !GLOBAL_MODES.includes(mode)), [],
    'a screen in no workspace cannot be reached from the navigation at all');
  assert.deepEqual(filed.filter((mode, index) => filed.indexOf(mode) !== index), [], 'and none is filed twice');
  // Preview is reachable from everywhere rather than being the fifth step of
  // four (§11): it is not a stage of the project.
  assert.deepEqual([...GLOBAL_MODES], ['preview']);
  assert.equal(modeToWorkspace('preview'), null);
});

test('a workspace resolves to its screens, and a screen to its workspace and its panels', () => {
  assert.deepEqual([...workspaceModes('design')], ['design.face', 'design.hands', 'design.artwork']);
  assert.deepEqual([...workspaceModes('rig')], ['rig.assign', 'rig.controls', 'rig.head2d', 'rig.deform']);
  assert.deepEqual([...workspaceModes('animate')], ['animate.expressions', 'animate.motions', 'animate.timeline']);
  assert.deepEqual([...workspaceModes('behavior')], ['behavior.reactions', 'behavior.automatic', 'behavior.stateMachine']);
  assert.deepEqual([...workspaceModes('nonsense')], [...workspaceModes('design')], 'an unknown workspace is filed rather than lost');
  assert.equal(modeToWorkspace('rig.head2d'), 'rig');
  // Four screens over one column of panels: that is what makes 342 controls
  // into four screens without moving a panel.
  assert.deepEqual(workspaceModes('rig').map(modeToSurface), ['rig', 'rig', 'rig', 'rig']);
  assert.equal(modeToSurface('design.face'), 'character', 'the builder composes its own column');
  assert.equal(modeToSurface('behavior.automatic'), 'reactions');
});

test('a surface resolves from a surface, a screen, or any older name for either', () => {
  assert.equal(normalizeSurface('rig.controls'), 'rig');
  assert.equal(normalizeSurface('face-setup'), 'rig');
  assert.equal(normalizeSurface('create'), 'create');
  assert.equal(normalizeSurface('preview'), 'preview');
  assert.equal(normalizeSurface('nonsense'), 'create');
  // And a surface maps back to the first screen that mounts it: what the shell
  // lands on when all it has been told is which panels to show.
  assert.equal(surfaceToMode('rig'), 'rig.assign');
  assert.equal(surfaceToMode('animate'), 'animate.motions');
  assert.equal(surfaceToMode('reactions'), 'behavior.reactions');
});

test('entering a workspace keeps the screen already open in it', () => {
  assert.equal(workspaceEntryMode('rig', 'rig.head2d'), 'rig.head2d');
  assert.equal(workspaceEntryMode('rig', 'preview'), 'rig.assign', 'and otherwise takes its first');
  assert.equal(workspaceEntryMode('design', 'design.hands'), 'design.hands');
  assert.equal(workspaceEntryMode('behavior', 'anything'), 'behavior.reactions');
});

test('the nine rig sections are filed across the four rig screens, each exactly once', () => {
  const filed = workspaceModes('rig').flatMap((mode) => modeSections(mode));
  assert.deepEqual(filed.filter((section, index) => filed.indexOf(section) !== index), [], 'no section is on two screens');
  assert.deepEqual([...filed].sort(), ['all-parts', 'face-parts', 'gaze', 'handles', 'hands', 'head-pose', 'holding', 'movements', 'warp'].sort());
  assert.equal(sectionMode('head-pose'), 'rig.head2d');
  assert.equal(sectionMode('warp'), 'rig.deform');
  assert.equal(sectionMode('nowhere'), null);
  // Assign is only the assignment (§8): head pose, hands, pins and warp have
  // nothing to do on that page.
  assert.deepEqual([...modeSections('rig.assign')], ['face-parts']);
});

test('a route normalizes a mode, a workspace, a target and a focus', () => {
  assert.deepEqual(normalizeRoute({ task: 'rig', target: { kind: 'semantic-control', part: 'gaze', control: 'lookX', ignored: true } }),
    { mode: 'rig.assign', workspace: 'rig', surface: 'rig', target: { kind: 'semantic-control', part: 'gaze', control: 'lookX' }, focus: null });
  assert.equal(normalizeTarget({ kind: 'future-entity', id: 'x' }), null);
  // Naming a workspace lands on its entry screen; naming a screen wins over it.
  assert.equal(normalizeRoute({ workspace: 'behavior' }).mode, 'behavior.reactions');
  assert.equal(normalizeRoute({ workspace: 'behavior', task: 'artwork' }).mode, 'design.artwork');
  assert.equal(normalizeRoute({ workspace: 'behavior', task: 'artwork' }).workspace, 'design', 'and the workspace follows it');
  // A caller written before the four workspaces passes a surface under the same
  // key, and it still means what it meant.
  assert.equal(normalizeRoute({ workspace: 'expressions' }).mode, 'animate.expressions');
  assert.equal(normalizeRoute({ stage: 'publish' }).mode, 'design.artwork', 'stage is gone with UIR-17: it names nothing and falls back');
});

test('a route may focus a known panel, and only a known one', () => {
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'head-pose' }).focus, 'head-pose');
  // Anything else is dropped rather than trusted into a selector.
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'body' }).focus, null);
  assert.equal(normalizeRoute({ task: 'face-setup', focus: '#left script' }).focus, null);
  assert.equal(normalizeRoute({ task: 'face-setup' }).focus, null);
});

test('a focused panel decides the screen, because the screen it is on is the one that shows it', () => {
  // Every one of these callers was written when Face Setup was a single tab:
  // `{ task: 'face-setup', focus: 'head-pose' }` meant "the Head pose section",
  // and the screen that section is on is the honest reading of it now.
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'head-pose' }).mode, 'rig.head2d');
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'face-movements' }).mode, 'rig.controls');
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'hand-setup' }).mode, 'rig.controls');
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'warp-panel' }).mode, 'rig.deform');
  assert.equal(normalizeRoute({ task: 'animate', focus: 'state-editor' }).mode, 'behavior.stateMachine');
  // And a panel whose screen is the one named changes nothing.
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'face-setup-checklist' }).mode, 'rig.assign');
  for (const [panel, mode] of Object.entries(PANEL_MODES)) {
    assert.ok(MODES[mode]?.navigable, `${panel} is filed under ${mode}, which is not a screen`);
  }
});

test('router navigation is idempotent and deep links remain session-only', () => {
  let mode = 'design.artwork', writes = 0; const targets = [];
  const project = { title: 'unchanged' }, history = [], revision = 7, dirty = false;
  const router = createTaskRouter({ getMode: () => mode, setMode: (value) => { mode = value; writes++; }, applyTarget: (value) => targets.push(value) });
  assert.equal(router.navigate('artwork').changed, false);
  assert.equal(writes, 0);
  assert.equal(router.navigate({ task: 'face-setup', target: { kind: 'semantic-part', id: 'gaze' } }).changed, true);
  assert.equal(mode, 'rig.assign'); assert.equal(writes, 1); assert.deepEqual(targets, [{ kind: 'semantic-part', id: 'gaze' }]);
  // Moving between two screens of one workspace is a navigation like any other,
  // even though the panels underneath do not change.
  assert.equal(router.navigate({ mode: 'rig.controls' }).changed, true);
  assert.equal(mode, 'rig.controls'); assert.equal(writes, 2);
  assert.deepEqual({ project, history, revision, dirty }, { project: { title: 'unchanged' }, history: [], revision: 7, dirty: false });
});

test('navigating with a focus asks the shell to reveal that panel', () => {
  const focused = [];
  let mode = 'design.artwork';
  const router = createTaskRouter({ getMode: () => mode, setMode: (next) => { mode = next; }, focusPanel: (id) => focused.push(id) });
  router.navigate({ task: 'face-setup', focus: 'hand-setup' });
  assert.deepEqual(focused, ['hand-setup']);
  assert.equal(mode, 'rig.controls');
  router.navigate({ task: 'face-setup' });
  assert.deepEqual(focused, ['hand-setup'], 'a route without a focus reveals nothing');
});

test('every screen has a label, and every workspace a label and a hint', () => {
  for (const mode of Object.values(MODES)) assert.ok(mode.label, `${mode.id} has nothing to put on its tab`);
  for (const id of WORKSPACE_ORDER) {
    assert.ok(WORKSPACES[id].label && WORKSPACES[id].hint, `${id} has nothing to put on its button`);
  }
});

test('UI preference migration accepts every older workspace id', () => {
  const storage = (saved) => ({ getItem: (key) => key === UI_PREFERENCES_KEY ? JSON.stringify(saved) : null });
  assert.equal(readUiPreferences(storage({ workspace: 'rig' })).mode, 'rig.assign');
  assert.equal(readUiPreferences(storage({ workspace: 'face-setup' })).mode, 'rig.assign');
  assert.equal(readUiPreferences(storage({ mode: 'rig.deform' })).mode, 'rig.deform');
  assert.equal(readUiPreferences(storage({ workspace: 'nonsense' })).mode, 'design.artwork');
  assert.equal(readUiPreferences(storage({ mode: 'rig.head2d', workspace: 'create' })).workspace, 'rig', 'the surface follows the screen');
});

/**
 * UIR-17 — the old vocabulary is out of the product code, and stays out.
 *
 * The alias table is a compatibility surface, not a second way to name a
 * screen. While the editor still navigated with `{ task: … }`, every new panel
 * could pick either word and both would work, which is how a "temporary"
 * translation layer becomes permanent. Two callers outside the product code
 * still speak the old words — a UI preference saved before UIR-01, and
 * validation's own `fix.workspace` — and they are named here so adding a third
 * is a decision somebody makes on purpose.
 */
test('nothing in the editor navigates by task any more: the aliases are for stored data and for validation', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join, relative } = await import('node:path');
  const root = new URL('../../', import.meta.url).pathname;
  // `task` is still a *field name* on the selection context — what the
  // inspector is showing — which is a different word for a different thing.
  const ROUTE = /\btask:\s*(['"`])/g;
  const ALLOWED = new Set([
    // The table itself, and the one route the readiness model cannot write as a
    // mode because validation, not the router, chose its words.
    'ui/task-router.js',
    'core/validation/task-readiness.js',
    // The service that hands a diagnostic's own `fix.workspace` to the router.
    'app/services/export-service.js'
  ]);
  const offenders = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'tests') await walk(path); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const name = relative(root, path);
      if (ALLOWED.has(name)) continue;
      const source = await readFile(path, 'utf8');
      if (ROUTE.test(source)) offenders.push(name);
      ROUTE.lastIndex = 0;
    }
  };
  await walk(root);
  assert.deepEqual(offenders, [], 'a route names a mode: `{ mode: "rig.controls" }`, never `{ task: "face-setup" }`');
});
