export const TASKS = Object.freeze({
  artwork: { id: 'artwork', workspace: 'create', label: 'Artwork', navigable: true },
  'face-setup': { id: 'face-setup', workspace: 'rig', label: 'Face Setup', navigable: true },
  expressions: { id: 'expressions', workspace: 'expressions', label: 'Expressions', navigable: true },
  animate: { id: 'animate', workspace: 'animate', label: 'Animate', navigable: true },
  reactions: { id: 'reactions', workspace: 'reactions', label: 'Reactions', navigable: true },
  preview: { id: 'preview', workspace: 'preview', label: 'Preview', navigable: true },
  export: { id: 'export', workspace: null, label: 'Export', navigable: false },
  advanced: { id: 'advanced', workspace: null, label: 'Advanced', navigable: false }
});

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
export const FOCUSABLE_PANELS = Object.freeze(['head-pose', 'hand-setup', 'warp-panel', 'automatic-panel', 'motion-panel', 'face-setup-checklist', 'face-movements', 'handle-board', 'layers-panel']);

export function normalizeRoute(route, fallback = 'artwork') {
  const input = typeof route === 'string' ? { task: route } : (route || {});
  return {
    task: normalizeTask(input.task ?? input.workspace, fallback),
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
