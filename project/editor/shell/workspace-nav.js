/**
 * The two-level navigation: the four questions, and the screens of the one
 * being answered (UIR-01, docs/UIR_REFACTOR_BASELINE.md).
 *
 * This owns the whole of *where the editor is*: the route, the panels it
 * mounts, the workspace it belongs to, the one line of guidance for the screen,
 * the readiness badges, and the memory of the screen each workspace was left
 * on. Everything else in the shell asks it rather than holding a copy -- which
 * is the point of it being a module: `data-workspace`, `data-mode` and
 * `data-stage` are written in exactly one place.
 */
import { DEFAULT_MODE, MODES, WORKSPACES, WORKSPACE_ORDER, modeToSurface, modeToWorkspace, normalizeMode, workspaceEntryMode, workspaceModes } from '../ui/task-router.js';
import { worstStatus } from '../core/validation/task-readiness.js';

const HINTS = {
  'design.face': 'Pick a part on the left, or click it on the mascot, then move it, resize it or recolour it here. Advanced opens every control.',
  'design.hands': 'The drawings a hand can show. Drop an SVG in to add one, import a whole set, or save yours out to share. Each hand keeps its own.',
  'design.artwork': 'Start simple, then add one expressive feature at a time.',
  'rig.assign': 'Tell the editor what each part of the face is: click its artwork on the canvas, or accept what it has already worked out.',
  'rig.controls': 'Turn on what the face can move, then calibrate each movement by posing it on the canvas.',
  'rig.head2d': 'Capture the head looking left, right, up and down. The editor fills in everything between.',
  'rig.deform': 'Pins, holds and warps: the expert tools for artwork that has to bend rather than move.',
  'animate.expressions': 'Name a face (Happy, Sad…), shape it with your movements, then test its intensity.',
  'animate.motions': 'Add a motion preset, test it, then adjust it in the Inspector. The Timeline edits any motion key by key.',
  'animate.timeline': 'The detailed editor of the motion you have open: every control, key by key.',
  'behavior.reactions': 'When something happens (a click), show an expression and a motion, then come back. Test it here, then in Preview.',
  'behavior.automatic': 'What the mascot does when nobody is asking: blinking, glancing around, breathing.',
  'behavior.stateMachine': 'The states the mascot moves between, and what makes it move between them.',
  preview: 'Test states and animations without modifying your project.'
};

/**
 * The readiness section each screen is graded by (UIR-01).
 *
 * Face Setup used to carry one merged badge for face parts *and* movements,
 * because it was one tab. Two screens grade separately, which is the badge
 * saying something: Assign is ✓ when the parts are named, and Controls is ⚠
 * until the movements it turned on are calibrated.
 *
 * A screen with no entry carries no badge. That is not an oversight: Head 2.5D,
 * Deform, the Timeline, Automatic and States are all optional, and a permanent
 * "○ not started" on an optional screen reads as a chore.
 */
const MODE_READINESS = Object.freeze({
  'design.artwork': 'artwork', 'rig.assign': 'faceSetup', 'rig.controls': 'movements',
  'animate.expressions': 'expressions', 'animate.motions': 'animate', 'behavior.reactions': 'reactions'
});

const SYMBOL = { ready: '✓', warning: '⚠', error: '●', todo: '○', optional: '' };
const MEANING = { ready: 'ready', warning: 'needs attention', error: 'has a problem', todo: 'not started', optional: 'optional' };

/** The four workspace buttons, each over the screens inside it, and Preview beside them. */
export const workspaceNavMarkup = () => `<nav class="stage-nav" aria-label="Editor navigation">${WORKSPACE_ORDER.map(id=>`<div class="stage-group" data-stage-group="${id}"><button class="stage-tab" data-stage="${id}" aria-label="${WORKSPACES[id].label} workspace" title="${WORKSPACES[id].hint}">${WORKSPACES[id].label}</button><div class="stage-steps" role="group" aria-label="${WORKSPACES[id].label} steps">${workspaceModes(id).map(mode=>`<button class="workspace-tab${MODES[mode].advanced?' advanced-mode':''}" data-mode="${mode}" data-workspace="${MODES[mode].surface}" data-stage="${id}"${MODES[mode].aria?` aria-label="${MODES[mode].aria}"`:''}>${MODES[mode].label}</button>`).join('')}</div></div>`).join('')}<div class="stage-group global-group"><button class="workspace-tab global-tab" data-mode="preview" data-workspace="preview" aria-label="Preview" title="Test the mascot from wherever you are. Nothing you do here changes the project.">▶ Preview</button></div></nav>`;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.root
 * @param {object} deps.preferences     the saved UI preferences, mutated in place
 * @param {() => void} deps.savePreferences
 * @param {(mode: object) => void} deps.enter       opens whatever the screen arrives with
 * @param {() => void} deps.resetScroll            puts both columns back to the top
 */
export function createWorkspaceNav({ root, preferences, savePreferences, enter, resetScroll }) {
  const q = (selector) => root.querySelector(selector);
  const qAll = (selector) => [...root.querySelectorAll(selector)];
  /** The screen last open in each workspace, for the session. */
  const lastModeInWorkspace = new Map();
  let navigate = (route) => applyMode(route);

  /**
   * Go to a mode: the route, the panels it mounts, the question it belongs to.
   *
   * The mode is the only thing stored. Its surface and its workspace are
   * *derived*, because two places holding the same truth is how they come
   * apart, and because `data-workspace` is read by a hundred selectors that
   * must keep meaning "which panels are mounted" rather than "which of the four
   * questions is open".
   */
  function applyMode(input, emit = true) {
    const mode = normalizeMode(input, null); if (!mode) return;
    const surface = modeToSurface(mode), workspace = modeToWorkspace(mode), changed = preferences.mode !== mode;
    preferences.mode = mode; preferences.workspace = surface;
    root.dataset.mode = mode; root.dataset.workspace = surface; root.dataset.stage = workspace || 'global';
    qAll('.workspace-tab').forEach((button) => {
      const on = button.dataset.mode === mode;
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', String(on));
      // A global screen is a toggle, so its label says which way it goes.
      if (MODES[button.dataset.mode]?.global) {
        button.textContent = on ? '◼ Stop preview' : '▶ Preview';
        button.setAttribute('aria-label', on ? 'Stop preview and go back to editing' : 'Preview');
      }
    });
    qAll('.stage-tab').forEach((button) => { const on = button.dataset.stage === workspace; button.classList.toggle('active', on); button.setAttribute('aria-pressed', String(on)); });
    // Each workspace remembers the screen last open in it, so leaving Rig for
    // Preview and coming back lands on Controls rather than on Assign. Session
    // only: persisting it would widen the saved shape for something nobody
    // misses after a reload.
    if (workspace) lastModeInWorkspace.set(workspace, mode);
    // A column keeps its scroll position across a change of screen, so the
    // panel for the new one used to open scrolled halfway down whatever the
    // last one had been reading. Each screen starts at the top of its column.
    if (changed) resetScroll();
    renderHint(mode);
    // Rig, Animate and Behavior each put several screens over one column, so
    // the column's heading names the screen rather than the column.
    const columnHeading = q(`[data-column-heading="${surface}"]`);
    if (columnHeading) columnHeading.textContent = MODES[mode].aria || MODES[mode].label;
    // Some screens are a dock or a disclosure rather than a column: the
    // Timeline is the detailed editor of a motion, and the States editor is
    // Behavior's. Arriving on one opens it.
    enter(MODES[mode]);
    savePreferences();
    if (emit) root.dispatchEvent(new CustomEvent('workspacechange', { detail: { workspace: surface, mode } }));
  }

  /** The one line of guidance for the screen that is open, until it is dismissed. */
  function renderHint(mode) {
    const host = q('[data-hint]'), text = HINTS[mode];
    if (!text || preferences.hintsDismissed[mode]) { host.hidden = true; host.textContent = ''; return; }
    host.hidden = false;
    host.innerHTML = `<span>${text}</span><button aria-label="Dismiss this hint">×</button>`;
    host.querySelector('button').onclick = () => { preferences.hintsDismissed[mode] = true; savePreferences(); host.hidden = true; host.textContent = ''; };
  }

  /**
   * Preview is a state of the canvas, not a fifth place (UIR-13, §11).
   *
   * Pressing it turns the editor into the thing it is building; pressing it
   * again puts the author back on the screen they were authoring on, rather
   * than on whichever tab they happen to hit next. The memory is session-only:
   * where somebody was when they pressed Preview is not a project fact.
   */
  let beforePreview = null;
  qAll('.workspace-tab').forEach((button) => {
    button.onclick = () => {
      const wanted = button.dataset.mode;
      if (!MODES[wanted]?.global) { navigate({ mode: wanted }); return; }
      if (preferences.mode === wanted) { navigate({ mode: beforePreview || DEFAULT_MODE }); return; }
      beforePreview = preferences.mode;
      navigate({ mode: wanted });
    };
  });
  // Every screen stays reachable from its own tab: a workspace is a shortcut
  // into a group, never a gate in front of one.
  qAll('.stage-tab').forEach((button) => {
    button.onclick = () => { const workspace = button.dataset.stage; navigate({ mode: lastModeInWorkspace.get(workspace) || workspaceEntryMode(workspace, preferences.mode) }); };
  });

  return {
    applyMode,
    /** The panels mounted right now. Every caller asking this means the composition. */
    getWorkspace: () => preferences.workspace,
    /** The route open right now, and the way anything asks for another one. */
    getMode: () => preferences.mode,
    setMode: applyMode,
    bindTaskNavigation(handler) { navigate = handler; },
    /** Everything a route can be asked for from outside, in one call. */
    go: (route) => navigate(route),
    setReadiness(readiness, issues) {
      qAll('.workspace-tab').forEach((button) => {
        const key = MODE_READINESS[button.dataset.mode]; if (!key) return;
        const section = readiness[key], status = section?.status; if (!status) return;
        const base = MODES[button.dataset.mode].label, mark = SYMBOL[status] ?? '';
        button.textContent = mark ? `${base} ${mark}` : base;
        button.dataset.readiness = status;
        // A glyph on its own says nothing: give the badge a name and a reason.
        const meaning = MEANING[status] || '';
        const detail = section?.summary ? ` — ${section.summary}` : '';
        button.title = meaning ? `${base}: ${meaning}${detail}` : base;
        button.setAttribute('aria-label', meaning ? `${base}, ${meaning}${detail}` : base);
      });
      // A workspace is as ready as its least ready screen. The badge lives on
      // the workspace button and never inside a screen tab: the loop above
      // rewrites a tab's whole textContent on every validation pass, so any
      // child put there would be destroyed on the next keystroke.
      qAll('.stage-tab').forEach((button) => {
        const workspace = WORKSPACES[button.dataset.stage];
        const statuses = workspaceModes(button.dataset.stage).map((mode) => readiness[MODE_READINESS[mode]]?.status).filter(Boolean);
        const status = statuses.length ? statuses.reduce((worst, item) => worstStatus(worst, item)) : null;
        if (status) button.dataset.readiness = status; else delete button.dataset.readiness;
        const meaning = MEANING[status] || '';
        // The accessible name stays "<Workspace> workspace" so it can never
        // collide with a screen tab, a rig part or an action button of the same
        // word -- and "Rig" and "Animate" are all three at once.
        button.setAttribute('aria-label', meaning ? `${workspace.label} workspace, ${meaning}` : `${workspace.label} workspace`);
        button.title = meaning ? `${workspace.label}: ${meaning} — ${workspace.hint}` : workspace.hint;
      });
      return issues;
    }
  };
}
