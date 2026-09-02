import { taskToWorkspace } from './task-router.js';

export const WORKSPACES = ['create', 'rig', 'animate', 'preview'];
export const UI_PREFERENCES_KEY = 'boop-mascotte-ui-v2';

export function normalizeWorkspacePreference(value) { return taskToWorkspace(value); }

export function readUiPreferences(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(UI_PREFERENCES_KEY) || '{}');
    return {
      workspace: normalizeWorkspacePreference(saved.workspace),
      leftCollapsed: Boolean(saved.leftCollapsed),
      rightCollapsed: Boolean(saved.rightCollapsed),
      timelineCollapsed: Boolean(saved.timelineCollapsed),
      hintsDismissed: saved.hintsDismissed || {}
    };
  } catch { return { workspace: 'create', leftCollapsed: false, rightCollapsed: false, timelineCollapsed: false, hintsDismissed: {} }; }
}

export function writeUiPreferences(preferences, storage = globalThis.localStorage) {
  storage?.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function humanControlLabel(name) {
  return ({ lookX: 'Look left / right', lookY: 'Look up / down', eyeOpen: 'Open / close', mouthOpen: 'Open / close', smile: 'Smile', mouthWidth: 'Width', headX: 'Move left / right', headY: 'Move up / down', headTilt: 'Tilt' })[name]
    || String(name).replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}
