export const TASKS = Object.freeze({
  artwork: { id: 'artwork', workspace: 'create', label: 'Artwork', navigable: true },
  'face-setup': { id: 'face-setup', workspace: 'rig', label: 'Face Setup', navigable: true },
  expressions: { id: 'expressions', workspace: 'expressions', label: 'Expressions', navigable: true },
  // "Motions", not "Animate": the stage above it is already called Animate,
  // and the same word on a stage and on one of its steps read as two buttons
  // for one place.
  animate: { id: 'animate', workspace: 'animate', label: 'Motions', navigable: true },
  reactions: { id: 'reactions', workspace: 'reactions', label: 'Reactions', navigable: true },
  preview: { id: 'preview', workspace: 'preview', label: 'Preview', navigable: true },
  export: { id: 'export', workspace: null, label: 'Export', navigable: false },
  advanced: { id: 'advanced', workspace: null, label: 'Advanced', navigable: false }
});

/**
 * The four stages of the journey (VNX-06, docs/VNEXT_ROADMAP.md).
 *
 * Six sibling tabs asked the user to know the editor's vocabulary before they
 * knew what they wanted to do. The journey is four steps -- make the mascot,
 * make it move, decide when it moves, ship it -- and the tabs are the *steps
 * inside* one of them.
 *
 * The tasks themselves do not change, which is the whole point of doing this
 * as a layer: every existing route, deep link, command and diagnostic fix
 * still names a task, and the stage it belongs to is derived. A stage is
 * therefore something the user navigates and nothing the rest of the editor
 * has to learn.
 *
 * `behaviors` and `publish` hold one task each today. That is honest rather
 * than aspirational: the automatic and state-machine panels move into
 * `behaviors` in VNX-09, and preview/simulator/problems/export gather into
 * `publish` in VNX-10.
 */
export const STAGES = Object.freeze({
  create: Object.freeze({ id: 'create', label: 'Create', hint: 'Draw the mascot and tell the editor what its parts are', tasks: Object.freeze(['artwork', 'face-setup']) }),
  animate: Object.freeze({ id: 'animate', label: 'Animate', hint: 'Expressions, motions and the timeline', tasks: Object.freeze(['expressions', 'animate']) }),
  behaviors: Object.freeze({ id: 'behaviors', label: 'Behaviors', hint: 'When the mascot does what it does', tasks: Object.freeze(['reactions']) }),
  publish: Object.freeze({ id: 'publish', label: 'Publish', hint: 'Test it, then put it on a page', tasks: Object.freeze(['preview']) })
});

export const STAGE_ORDER = Object.freeze(Object.keys(STAGES));

/**
 * Which stage a task belongs to. A task in no stage would be unreachable from
 * the navigation, so this falls back to the first stage rather than to
 * `undefined` -- an unreachable tab is worse than a misfiled one.
 */
export function taskToStage(task) {
  const id = normalizeTask(task);
  return STAGE_ORDER.find((stage) => STAGES[stage].tasks.includes(id)) || STAGE_ORDER[0];
}

export function normalizeStage(value, fallback = STAGE_ORDER[0]) {
  return typeof value === 'string' && STAGES[value] ? value : fallback;
}

/** The tasks of a stage, in the order they are worked through. */
export function stageTasks(stage) { return STAGES[normalizeStage(stage)].tasks; }

/** Entering a stage lands on its first task, unless one of its tasks is current. */
export function stageEntryTask(stage, currentTask) {
  const tasks = stageTasks(stage);
  return tasks.includes(normalizeTask(currentTask)) ? normalizeTask(currentTask) : tasks[0];
}

export const LEGACY_TASK_ALIASES = Object.freeze({ create: 'artwork', rig: 'face-setup', expressions: 'expressions', animate: 'animate', reactions: 'reactions', preview: 'preview' });
const TARGET_KINDS = new Set(['artwork-element', 'semantic-part', 'semantic-control', 'expression', 'reaction', 'animation-clip', 'timeline-track', 'timeline-key', 'state', 'diagnostic']);

export function normalizeTask(value, fallback = 'artwork') {
  const id = typeof value === 'string' ? (LEGACY_TASK_ALIASES[value] || value) : '';
  return TASKS[id]?.navigable ? id : fallback;
}

export function taskToWorkspace(task) { return TASKS[normalizeTask(task)].workspace; }
export function workspaceToTask(workspace) { return normalizeTask(workspace); }

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
 * The Face Setup section a validation issue's `rigTask` lands in. Validation
 * used to name the task and nothing opened it, so "Fix" on a head-pose problem
 * arrived on Face Setup with the Head pose section folded shut.
 */
export const RIG_TASK_PANELS = Object.freeze({ hands: 'hand-setup', headPose: 'head-pose', calibrate: 'face-movements', setup: 'face-setup-checklist', hierarchy: 'rig-parts' });

export function normalizeRoute(route, fallback = 'artwork') {
  const input = typeof route === 'string' ? { task: route } : (route || {});
  // A route may name a stage instead of a task, which is what the four
  // top-level buttons send. Naming both is allowed and the task wins: it is
  // the more specific of the two.
  const named = input.task ?? input.workspace;
  const task = named !== undefined ? normalizeTask(named, fallback)
    : input.stage !== undefined ? stageEntryTask(normalizeStage(input.stage), fallback)
      : normalizeTask(undefined, fallback);
  return {
    task,
    stage: taskToStage(task),
    target: normalizeTarget(input.target),
    focus: FOCUSABLE_PANELS.includes(input.focus) ? input.focus : null
  };
}

export function createTaskRouter({ getWorkspace, setWorkspace, applyTarget = () => {}, focusPanel = () => {} }) {
  let lastTarget = null;
  return {
    get currentTask() { return workspaceToTask(getWorkspace()); },
    get lastTarget() { return lastTarget; },
    navigate(input) {
      const route = normalizeRoute(input, this.currentTask);
      const workspace = taskToWorkspace(route.task);
      const changed = workspace !== getWorkspace();
      if (changed) setWorkspace(workspace);
      if (route.target) { lastTarget = route.target; applyTarget(route.target, route); }
      if (route.focus) focusPanel(route.focus);
      return { ...route, changed };
    }
  };
}
