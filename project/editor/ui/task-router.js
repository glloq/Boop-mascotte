/**
 * Where the editor can be, and how anything asks to go there (UIR-01,
 * docs/UIR_REFACTOR_BASELINE.md).
 *
 * Three words, because three things are genuinely different and the old model
 * had two of them sharing a name:
 *
 * ```text
 * workspace   Design · Rig · Animate · Behavior     the four questions
 * mode        design.face, rig.controls, …          a route inside one
 * surface     character, rig, animate, …            the panels a mode mounts
 * ```
 *
 * A **workspace** is a question the author is answering — what does it look
 * like, how can its face move, what can its face do, when does it do it. A
 * **mode** is one route inside that question, and it is what everything else in
 * the editor names: a deep link, a validation fix, a command in the palette. A
 * **surface** is the shell's composition — which column of panels is mounted —
 * and several modes share one, which is exactly the point: `rig.assign` and
 * `rig.controls` are two screens over the same panels.
 *
 * `surface` is what the DOM's `data-workspace` attribute and the whole
 * stylesheet have always held. The attribute keeps its name until UIR-02
 * rebuilds the shell; renaming a hundred selectors to make a comment shorter is
 * not a refactor.
 *
 * Nothing here reaches the document. A route is session state (§5, Règle D):
 * the project does not record which screen somebody was looking at.
 */

/** The panel compositions the shell can mount. Held by `data-workspace`. */
export const SURFACES = Object.freeze(['character', 'hands', 'create', 'rig', 'expressions', 'animate', 'reactions', 'preview']);

/**
 * Every route the editor has.
 *
 * `surface` is the composition it mounts; `sections` names the Face Setup
 * sections it is the screen for, which is how one 342-control accordion becomes
 * four screens without moving a single panel (UIR-07 … UIR-10 move them);
 * `advanced` marks a route the simple path does not need to know about.
 */
export const MODES = Object.freeze({
  /* ── Design: what does the mascot look like? ─────────────────────────────── */
  'design.face': { id: 'design.face', label: 'Face', workspace: 'design', surface: 'character', navigable: true },
  // Hands are designed away from the face (docs/HAND_STYLES.md): a library of
  // drawings an author owns, not a section inside somebody else's panel.
  'design.hands': { id: 'design.hands', label: 'Hands', workspace: 'design', surface: 'hands', navigable: true },
  'design.artwork': { id: 'design.artwork', label: 'Artwork', workspace: 'design', surface: 'create', navigable: true, advanced: true },

  /* ── Rig: how can its face move? ─────────────────────────────────────────── */
  'rig.assign': { id: 'rig.assign', label: 'Assign', workspace: 'rig', surface: 'rig', navigable: true, sections: ['face-parts'] },
  // Movements, gaze and the on-canvas controls answer one question — what moves
  // and how far — so they are one screen. Hand placement and reach ride here
  // too, marked advanced: where a hand *is* is a movement; what it is *drawn
  // from* is Design (§6).
  'rig.controls': { id: 'rig.controls', label: 'Controls', workspace: 'rig', surface: 'rig', navigable: true, sections: ['movements', 'gaze', 'handles', 'hands'] },
  'rig.head2d': { id: 'rig.head2d', label: 'Head 2.5D', workspace: 'rig', surface: 'rig', navigable: true, sections: ['head-pose'] },
  'rig.deform': { id: 'rig.deform', label: 'Deform', workspace: 'rig', surface: 'rig', navigable: true, advanced: true, sections: ['holding', 'warp', 'all-parts'] },

  /* ── Animate: what can its face do? ──────────────────────────────────────── */
  'animate.expressions': { id: 'animate.expressions', label: 'Expressions', workspace: 'animate', surface: 'expressions', navigable: true },
  'animate.motions': { id: 'animate.motions', label: 'Motions', workspace: 'animate', surface: 'animate', navigable: true },
  // The Timeline is the detailed editor *of a motion*, never a second way to
  // start one (§9). It is the same surface with the dock open -- `dock` names
  // the one surface under the canvas, and at most one is ever open.
  'animate.timeline': { id: 'animate.timeline', label: 'Timeline', workspace: 'animate', surface: 'animate', navigable: true, advanced: true, dock: 'timeline' },

  /* ── Behavior: when does it do it? ───────────────────────────────────────── */
  'behavior.reactions': { id: 'behavior.reactions', label: 'Reactions', workspace: 'behavior', surface: 'reactions', navigable: true },
  // Automatic had no route at all: it was reached by scrolling past Reactions
  // in the same column, which is why nobody found it.
  'behavior.automatic': { id: 'behavior.automatic', label: 'Automatic', workspace: 'behavior', surface: 'reactions', navigable: true },
  // And the state machine was filed under *Motions*, inside an accordion in the
  // step above the one whose subject it is (§10). `panel` is what a screen
  // reveals on arrival: the editor it is the screen *for* is a disclosure in
  // its column, and a screen whose subject is folded shut answers nothing.
  // Named in full for a screen reader: the editor it opens has its own
  // "States" button inside it, and two controls with one accessible name is a
  // control nobody can ask for.
  'behavior.stateMachine': { id: 'behavior.stateMachine', label: 'States', aria: 'State machine', workspace: 'behavior', surface: 'reactions', navigable: true, advanced: true, panel: 'state-editor' },

  /* ── Global: reachable from every workspace ──────────────────────────────── */
  // Preview is not a step of the project (§11). It keeps a route because the
  // shell still mounts it as a surface; UIR-13 turns it into a mode of the
  // canvas rather than a place.
  preview: { id: 'preview', label: 'Preview', workspace: null, surface: 'preview', navigable: true, global: true },

  export: { id: 'export', label: 'Export', workspace: null, surface: null, navigable: false },
  advanced: { id: 'advanced', label: 'Advanced', workspace: null, surface: null, navigable: false }
});

/**
 * The four questions, in the order they are asked.
 *
 * ```text
 * DESIGN     What does my character look like?
 * RIG        How can its face move?
 * ANIMATE    What can its face do?
 * BEHAVIOR   When does it do it?
 * ```
 *
 * Preview is deliberately not among them: testing the mascot is something an
 * author does *from* wherever they are, not a fifth step after the fourth.
 */
export const WORKSPACES = Object.freeze({
  design: Object.freeze({ id: 'design', label: 'Design', hint: 'What your character looks like: its face, its hands, its artwork' }),
  rig: Object.freeze({ id: 'rig', label: 'Rig', hint: 'How its face can move: which parts, which movements, how it turns' }),
  animate: Object.freeze({ id: 'animate', label: 'Animate', hint: 'What its face can do: expressions and motions' }),
  behavior: Object.freeze({ id: 'behavior', label: 'Behavior', hint: 'When it does it: reactions, automatic behaviours, states' })
});

export const WORKSPACE_ORDER = Object.freeze(Object.keys(WORKSPACES));

/** The modes of a workspace, in the order they are worked through. Derived, never authored. */
const MODES_BY_WORKSPACE = Object.freeze(Object.fromEntries(WORKSPACE_ORDER.map((workspace) =>
  [workspace, Object.freeze(Object.values(MODES).filter((mode) => mode.navigable && mode.workspace === workspace).map((mode) => mode.id))])));

/** Modes reachable from anywhere, which therefore belong to no workspace. */
export const GLOBAL_MODES = Object.freeze(Object.values(MODES).filter((mode) => mode.navigable && mode.global).map((mode) => mode.id));

/**
 * Every name a route has ever had, pointing at the route it is now (UIR-01).
 *
 * Deep links, saved preferences, validation fixes, the command palette and
 * fourteen browser specs all name a task by its old id. None of them is wrong;
 * they are simply older than the navigation. A route that used to exist and
 * resolves to nothing is the one failure a renaming pass can produce silently,
 * so every id that was ever navigable is in this table, including the surface
 * ids the session stores.
 */
export const MODE_ALIASES = Object.freeze({
  // The tasks of the four-stage navigation this replaces. Nothing in the editor
  // names one any more (UIR-17): every panel, command, guide and readiness route
  // names a mode, and `core/tests/task-router.test.js` keeps it that way. They
  // stay because two things outside the product code still speak them -- a UI
  // preference saved before UIR-01, whose `workspace` was a task id, and
  // `fix.workspace` in `core/validation/validate-project.js`, which names a
  // domain in validation's own words rather than a screen in the router's.
  character: 'design.face',
  hands: 'design.hands',
  artwork: 'design.artwork',
  'face-setup': 'rig.assign',
  expressions: 'animate.expressions',
  animate: 'animate.motions',
  reactions: 'behavior.reactions',
  automatic: 'behavior.automatic',
  states: 'behavior.stateMachine',
  // The surface ids, which a saved preference holds. `create` is Artwork's
  // surface and `rig` is Face Setup's, from before either had a name of its own.
  create: 'design.artwork',
  rig: 'rig.assign'
});

const TARGET_KINDS = new Set(['artwork-element', 'semantic-part', 'semantic-control', 'expression', 'reaction', 'animation-clip', 'timeline-track', 'timeline-key', 'state', 'diagnostic']);

export const DEFAULT_MODE = 'design.artwork';

/** A mode id, whatever it was called when the caller learned it. */
export function normalizeMode(value, fallback = DEFAULT_MODE) {
  const id = typeof value === 'string' ? (MODES[value]?.navigable ? value : MODE_ALIASES[value]) : '';
  return MODES[id]?.navigable ? id : fallback;
}

export function normalizeWorkspace(value, fallback = WORKSPACE_ORDER[0]) {
  return typeof value === 'string' && WORKSPACES[value] ? value : fallback;
}

/** The workspace a mode belongs to, or `null` for one reachable from all of them. */
export function modeToWorkspace(mode) { return MODES[normalizeMode(mode)].workspace; }

/** The panel composition a mode mounts. */
export function modeToSurface(mode) { return MODES[normalizeMode(mode)].surface; }

/** A surface id, from a surface, a mode or any older name for either. */
export function normalizeSurface(value, fallback = 'create') {
  if (typeof value === 'string' && SURFACES.includes(value) && !MODE_ALIASES[value]) return value;
  const mode = typeof value === 'string' ? normalizeMode(value, null) : null;
  return mode ? MODES[mode].surface : (SURFACES.includes(value) ? value : fallback);
}

/**
 * The mode a surface stands for.
 *
 * Several modes share a surface, so this is the *first* of them: what the shell
 * lands on when all it has been told is which panels to mount — a restored
 * preference, a session replayed, an older deep link.
 */
export function surfaceToMode(surface) {
  const id = normalizeSurface(surface, null);
  return Object.values(MODES).find((mode) => mode.navigable && mode.surface === id)?.id || DEFAULT_MODE;
}

export const workspaceModes = (workspace) => MODES_BY_WORKSPACE[normalizeWorkspace(workspace)];

/** Entering a workspace keeps the mode already open in it, and otherwise takes its first. */
export function workspaceEntryMode(workspace, currentMode) {
  const modes = workspaceModes(workspace);
  const current = normalizeMode(currentMode, null);
  return current && modes.includes(current) ? current : modes[0];
}

/** The Face Setup sections a mode is the screen for. */
export const modeSections = (mode) => MODES[normalizeMode(mode)].sections || [];

/** Which mode owns a Face Setup section, so a deep link into one opens its screen. */
export function sectionMode(section) {
  return Object.values(MODES).find((mode) => mode.sections?.includes(section))?.id || null;
}

export function normalizeTarget(target) {
  if (!target || typeof target !== 'object' || !TARGET_KINDS.has(target.kind)) return null;
  const normalized = { kind: target.kind };
  for (const key of ['id', 'part', 'control', 'parameter', 'diagnosticId']) {
    if (typeof target[key] === 'string' && target[key]) normalized[key] = target[key];
  }
  if (Number.isFinite(Number(target.time))) normalized.time = Number(target.time);
  return normalized;
}

/** Panels a route may focus. Anything else is ignored rather than trusted. */
export const FOCUSABLE_PANELS = Object.freeze(['head-pose', 'hand-setup', 'warp-panel', 'automatic-panel', 'motion-panel', 'face-setup-checklist', 'face-movements', 'handle-board', 'layers-panel', 'rig-parts', 'holding-panel', 'gaze-panel', 'state-editor', 'face-builder']);

/**
 * The mode a focused panel lives in.
 *
 * A deep link that reveals a panel now has to arrive on the screen that shows
 * it: with Face Setup cut into four, "Fix" on a head-pose problem used to land
 * on the right task with the section folded shut, and would now land on a
 * screen the section is not on at all.
 */
export const PANEL_MODES = Object.freeze({
  'face-setup-checklist': 'rig.assign',
  'face-movements': 'rig.controls',
  'gaze-panel': 'rig.controls',
  'handle-board': 'rig.controls',
  'hand-setup': 'rig.controls',
  'head-pose': 'rig.head2d',
  'holding-panel': 'rig.deform',
  'warp-panel': 'rig.deform',
  'rig-parts': 'rig.deform',
  'automatic-panel': 'behavior.automatic',
  'state-editor': 'behavior.stateMachine',
  'motion-panel': 'animate.motions',
  'face-builder': 'design.face'
});

/**
 * The Face Setup section a validation issue's `rigTask` lands in. Validation
 * used to name the task and nothing opened it, so "Fix" on a head-pose problem
 * arrived on Face Setup with the Head pose section folded shut.
 */
export const RIG_TASK_PANELS = Object.freeze({ hands: 'hand-setup', headPose: 'head-pose', calibrate: 'face-movements', setup: 'face-setup-checklist', hierarchy: 'rig-parts' });

/**
 * One route, from whatever a caller had to hand.
 *
 * `mode` and its older name `task` win over `workspace`, because they are the
 * more specific of the two. `workspace` accepts one of the four; anything else
 * it holds is an older id for a route, which is what every caller written
 * before this model passes.
 */
export function normalizeRoute(route, fallback = DEFAULT_MODE) {
  const input = typeof route === 'string' ? { mode: route } : (route || {});
  const named = input.mode ?? input.task;
  // `stage` is gone with UIR-17: it was the word of the navigation before the
  // one before this, and nothing named one. `task` and `workspace` stay for the
  // two callers outside the product code that still speak them.
  const mode = named !== undefined ? normalizeMode(named, fallback)
    : input.workspace !== undefined && WORKSPACES[input.workspace] ? workspaceEntryMode(input.workspace, fallback)
      : input.workspace !== undefined ? normalizeMode(input.workspace, fallback)
        : normalizeMode(undefined, fallback);
  // A focus outranks the mode that came with it. Every caller that names both
  // was written when Face Setup was one screen: `{ task: 'face-setup', focus:
  // 'head-pose' }` meant "the head pose section of Face Setup", and the screen
  // that section is on is now the honest reading of it. Focusing a panel the
  // current screen does not show would land on nothing at all.
  const focus = FOCUSABLE_PANELS.includes(input.focus) ? input.focus : null;
  const focused = focus && PANEL_MODES[focus] ? PANEL_MODES[focus] : mode;
  return {
    mode: focused,
    workspace: modeToWorkspace(focused),
    surface: modeToSurface(focused),
    target: normalizeTarget(input.target),
    focus
  };
}

export function createTaskRouter({ getMode, setMode, applyTarget = () => {}, focusPanel = () => {} }) {
  let lastTarget = null;
  return {
    get currentMode() { return normalizeMode(getMode()); },
    get lastTarget() { return lastTarget; },
    navigate(input) {
      const route = normalizeRoute(input, this.currentMode);
      const changed = route.mode !== normalizeMode(getMode(), null);
      if (changed) setMode(route.mode, route);
      if (route.target) { lastTarget = route.target; applyTarget(route.target, route); }
      if (route.focus) focusPanel(route.focus);
      return { ...route, changed };
    }
  };
}
