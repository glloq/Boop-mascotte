/**
 * Where the editor can be, and how anything asks to go there (UIR-01,
 * docs/UIR_REFACTOR_BASELINE.md).
 *
 * Three words, because three things are genuinely different and the old model
 * had two of them sharing a name:
 *
 * ```text
 * workspace   Design · Rig · Animate · Behavior     the four questions
 * mode        design.artwork, rig.controls, …       a route inside one
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
export const SURFACES = Object.freeze(['hands', 'create', 'rig', 'expressions', 'animate', 'reactions', 'preview']);

/**
 * Every route the editor has.
 *
 * `surface` is the composition it mounts; `sections` names the Face Setup
 * sections it is the screen for, which is how one 342-control accordion becomes
 * four screens without moving a single panel (UIR-07 … UIR-10 move them);
 * `advanced` marks a route the simple path does not need to know about;
 * `layout` is how much of the window its panels want, in pixels
 * (`ui/panel-split.js`), because the one `300px · 1fr · 310px` every screen
 * used to get was a compromise across screens that want opposite things — a
 * drawing surface wants the canvas, a list of drawings wants the list. An
 * author's own drag overrides it, per screen, for the session.
 */
export const MODES = Object.freeze({
  /* ── Design: what does the mascot look like? ─────────────────────────────── */
  /**
   * Assembling a mascot, and drawing one, are two screens (UIR-18).
   *
   * They were one, and it opened on nine vector tools, a hundred-and-thirty
   * layer tree and an Inspector of geometry, bindings and morph targets —
   * while the drawings the editor ships sat inside a
   * collapsed disclosure called *Add / Create artwork*, under three cards, at
   * the bottom of the column. The first thing everybody saw was the most
   * advanced thing in the editor, and the simplest was the hardest to find.
   *
   * So **Assemble** is where a mascot comes from: the three ways to start, the
   * three ways to bring a picture in, the library to choose parts from, and
   * the parts the library has no drawing for. No Pen, no nodes, no layer tree.
   * **Draw** is the vector editor, unchanged and marked advanced.
   *
   * One surface, two modes. The panels are the same hosts they always were and
   * the render plan is untouched; which groups of them show is gated on
   * `data-mode`, exactly as the workspaces have always been gated on
   * `data-workspace` (`index.html`).
   *
   * Assemble is first, so it is what `surfaceToMode('create')` answers, what
   * the DESIGN tab opens, and where the editor opens.
   */
  'design.assemble': { id: 'design.assemble', label: 'Assemble', workspace: 'design', surface: 'create', navigable: true, layout: { left: 420, right: 300 } },
  // Artwork, which is `Draw` now: the same screen, said in the word for what
  // it is. It stopped being where the editor opens for the reason above, and
  // is `advanced` again — a Bézier node editor is not the second thing an
  // author meets (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §1.5).
  'design.artwork': { id: 'design.artwork', label: 'Draw', workspace: 'design', surface: 'create', navigable: true, advanced: true, layout: { left: 300, right: 340 } },
  // Hands are designed away from the face (docs/HAND_STYLES.md): a library of
  // drawings an author owns, not a section inside somebody else's panel.
  'design.hands': { id: 'design.hands', label: 'Hands', workspace: 'design', surface: 'hands', navigable: true, layout: { left: 400, right: 250 } },

  /* ── Rig: how can its face move? ─────────────────────────────────────────── */
  'rig.assign': { id: 'rig.assign', label: 'Assign', workspace: 'rig', surface: 'rig', navigable: true, sections: ['face-parts'], layout: { left: 360, right: 330 } },
  // Movements, gaze and the on-canvas controls answer one question — what moves
  // and how far — so they are one screen. Hand placement and reach ride here
  // too, marked advanced: where a hand *is* is a movement; what it is *drawn
  // from* is Design (§6).
  'rig.controls': { id: 'rig.controls', label: 'Controls', workspace: 'rig', surface: 'rig', navigable: true, sections: ['movements', 'face-states', 'gaze', 'handles', 'hands'], layout: { left: 400, right: 320 } },
  'rig.head2d': { id: 'rig.head2d', label: 'Head 2.5D', workspace: 'rig', surface: 'rig', navigable: true, sections: ['head-pose'], layout: { left: 300, right: 300 } },
  'rig.deform': { id: 'rig.deform', label: 'Deform', workspace: 'rig', surface: 'rig', navigable: true, advanced: true, sections: ['holding', 'warp', 'all-parts'], layout: { left: 380, right: 340 } },

  /* ── Animate: what can its face do? ──────────────────────────────────────── */
  'animate.expressions': { id: 'animate.expressions', label: 'Expressions', workspace: 'animate', surface: 'expressions', navigable: true, layout: { left: 340, right: 320 } },
  'animate.motions': { id: 'animate.motions', label: 'Motions', workspace: 'animate', surface: 'animate', navigable: true },
  // The Timeline is the detailed editor *of a motion*, never a second way to
  // start one (§9). It is the same surface with the dock open -- `dock` names
  // the one surface under the canvas, and at most one is ever open.
  'animate.timeline': { id: 'animate.timeline', label: 'Timeline', workspace: 'animate', surface: 'animate', navigable: true, advanced: true, dock: 'timeline' },

  /* ── Behavior: when does it do it? ───────────────────────────────────────── */
  //
  // Three screens over one **board** (docs/BEHAVIOR_STUDIO.md): each one points
  // the same diagram at a different part of the workspace and fills the column
  // with the list of what that part holds. So all three want the same shape —
  // a library narrow enough to be a library, and a rail wide enough to draw an
  // easing curve and a waveform in, because on this workspace the right-hand
  // column *is* the tuning surface rather than a strip of fields.
  'behavior.reactions': { id: 'behavior.reactions', label: 'Reactions', workspace: 'behavior', surface: 'reactions', navigable: true, layout: { left: 300, right: 340 } },
  // Automatic had no route at all: it was reached by scrolling past Reactions
  // in the same column, which is why nobody found it.
  'behavior.automatic': { id: 'behavior.automatic', label: 'Automatic', workspace: 'behavior', surface: 'reactions', navigable: true, layout: { left: 300, right: 340 } },
  // And the state machine was filed under *Motions*, inside an accordion in the
  // step above the one whose subject it is (§10). `panel` is what a screen
  // reveals on arrival: the list it is the screen *for* is a disclosure in its
  // column, and a screen whose subject is folded shut answers nothing.
  //
  // It stopped being `advanced` with the Behavior studio. It was marked so
  // when the state machine was a diagram folded into a 300 px column behind a
  // summary that said *advanced*; it is the board the whole workspace is drawn
  // on now, and an author who has opened Behavior has already arrived at it.
  // Named in full for a screen reader: the column it opens has its own
  // "States" button inside it, and two controls with one accessible name is a
  // control nobody can ask for.
  'behavior.stateMachine': { id: 'behavior.stateMachine', label: 'States', aria: 'State machine', workspace: 'behavior', surface: 'reactions', navigable: true, panel: 'state-editor', layout: { left: 300, right: 340 } },

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
  // Each hint names what the workspace holds for *both* kinds of mascot
  // (V4-092): a mascot has been drawings or pictures since Phase 1, and a hint
  // that only names drawings is a workspace an author with photographs reads
  // past. `hint` is the only sentence a workspace gets, so it is the sentence
  // that has to be true of what they brought.
  design: Object.freeze({ id: 'design', label: 'Design', hint: 'What your character looks like: its face, its hands, its drawings and pictures' }),
  rig: Object.freeze({ id: 'rig', label: 'Rig', hint: 'How it can move: which parts, which movements, how it turns and bends' }),
  animate: Object.freeze({ id: 'animate', label: 'Animate', hint: 'What it can do: expressions and motions' }),
  behavior: Object.freeze({ id: 'behavior', label: 'Behavior', hint: 'When it does it: reactions, what has to be true first, automatic behaviours, states' })
});

export const WORKSPACE_ORDER = Object.freeze(Object.keys(WORKSPACES));

/**
 * The workspaces somebody who just wants a mascot needs (audit §7.3).
 *
 * Three of the four are about rigging, animating and reacting: real work, and
 * off-topic for an author who came to dress a character. There was no setting
 * that folded them, so the answer to "which of these four do I need?" was
 * "read all four and find out".
 *
 * Folded, never removed — the palette, *Advanced tools* and every deep link
 * still go there, and arriving turns the full set back on (UIR-00).
 */
export const SIMPLE_WORKSPACES = Object.freeze(['design']);

/** Whether a mode is one the simple set leads to. */
export const isSimpleMode = (mode) => {
  const entry = MODES[normalizeMode(mode)];
  if (!entry) return false;
  if (entry.global) return true;
  if (entry.advanced) return false;
  return SIMPLE_WORKSPACES.includes(entry.workspace);
};

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
  // Design ▸ Face and its surface, gone with the Character Builder (V5-07).
  // Kept pointing somewhere real, which is what this table is for -- and it
  // points at Assemble now (UIR-18), which is the screen that dresses a face
  // out of the library, which is what the Character Builder was for.
  character: 'design.assemble',
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

/**
 * Where the editor opens.
 *
 * `design.artwork`, and it has been both this and `design.face` before, which
 * is worth writing down because the reason changed and the value went back.
 *
 * It was Artwork, and that was wrong: a template loaded from Home, a project
 * opened or a face generated all landed somebody who wanted *a mascot* in
 * front of a Pen and a Bézier node tool, while the one screen that dressed a
 * character had to be asked for by name (docs/AUDIT_UI_2026-09/02_PROBLEMES.md
 * §1.5). So it became `design.face`, the Character Builder's screen.
 *
 * It is Artwork again, and not because that argument was wrong. The argument
 * assumed the editor's answer to "how do I start?" was "pick one of ours", and
 * V5 replaces that answer with "bring your pieces"
 * (docs/V5_MASCOTTE_IMAGES_ETUDE.md). Artwork is where pieces arrive, where
 * they are named, ordered and told how they move. Landing anywhere else means
 * landing away from the mascot you brought.
 *
 * It is **Assemble** now, and both of those arguments hold: Assemble is where
 * pieces arrive *and* where the library is (UIR-18). The screen that was
 * Artwork kept the nine vector tools, the layer tree and the geometry fields,
 * and those were never the first thing to meet — "bring your pieces" and "here
 * is a Bézier node editor" were two answers sharing one screen, and the first
 * one lost. Assemble is the first, Draw is the second, and the pieces an author
 * brings still land where they are brought.
 *
 * Importing an SVG lands here too, and always did.
 */
export const DEFAULT_MODE = 'design.assemble';

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
export const FOCUSABLE_PANELS = Object.freeze(['head-pose', 'hand-setup', 'warp-panel', 'automatic-panel', 'motion-panel', 'face-setup-checklist', 'face-movements', 'face-states', 'handle-board', 'layers-panel', 'rig-parts', 'holding-panel', 'gaze-panel', 'state-editor', 'face-builder', 'face-library']);

/**
 * The mode a focused panel lives in.
 *
 * A deep link that reveals a panel now has to arrive on the screen that shows
 * it: with Face Setup cut into four, "Fix" on a head-pose problem used to land
 * on the right task with the section folded shut, and would now land on a
 * screen the section is not on at all.
 */
export const PANEL_MODES = Object.freeze({
  // Both on Assemble: the library is the screen, and *Build a face* is one of
  // the three ways to start, folded under *Start over* (UIR-18). `focusPanel`
  // opens the disclosures a panel sits behind, so the fold costs it nothing.
  'face-library': 'design.assemble',
  'face-builder': 'design.assemble',
  // The layer tree is Draw's: naming a piece out of a hundred and thirty is
  // the vector editor's job, and Assemble does not show the tree at all.
  'layers-panel': 'design.artwork',
  'face-setup-checklist': 'rig.assign',
  'face-movements': 'rig.controls',
  'face-states': 'rig.controls',
  'gaze-panel': 'rig.controls',
  'handle-board': 'rig.controls',
  'hand-setup': 'rig.controls',
  'head-pose': 'rig.head2d',
  'holding-panel': 'rig.deform',
  'warp-panel': 'rig.deform',
  'rig-parts': 'rig.deform',
  'automatic-panel': 'behavior.automatic',
  'state-editor': 'behavior.stateMachine',
  'motion-panel': 'animate.motions'
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
