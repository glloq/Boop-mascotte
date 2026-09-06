import { taskToWorkspace } from './task-router.js';

export const WORKSPACES = ['create', 'rig', 'expressions', 'animate', 'reactions', 'preview'];
export const UI_PREFERENCES_KEY = 'boop-mascotte-ui-v2';

export function normalizeWorkspacePreference(value) { return taskToWorkspace(value); }

export function readUiPreferences(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(UI_PREFERENCES_KEY) || '{}');
    return {
      workspace: normalizeWorkspacePreference(saved.workspace),
      leftCollapsed: Boolean(saved.leftCollapsed),
      rightCollapsed: Boolean(saved.rightCollapsed),
      // Closed until asked for: presets and three sliders are the simple path,
      // and the Timeline is the expert one. What the author chooses is kept.
      timelineCollapsed: saved.timelineCollapsed === undefined ? true : Boolean(saved.timelineCollapsed),
      hintsDismissed: saved.hintsDismissed || {},
      // Handles on the mascot, on unless the author turned them off.
      puppetHidden: Boolean(saved.puppetHidden),
      // Which Face Setup sections are open, so a long panel opens where it was left.
      openSections: saved.openSections && typeof saved.openSections === 'object' ? saved.openSections : {}
    };
  } catch { return { workspace: 'create', leftCollapsed: false, rightCollapsed: false, timelineCollapsed: true, hintsDismissed: {}, puppetHidden: false, openSections: {} }; }
}

export function writeUiPreferences(preferences, storage = globalThis.localStorage) {
  storage?.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function humanControlLabel(name) {
  return ({ lookX: 'Look left / right', lookY: 'Look up / down', eyeOpen: 'Open / close', mouthOpen: 'Open / close', smile: 'Smile', mouthWidth: 'Width', headX: 'Move left / right', headY: 'Move up / down', headTilt: 'Tilt' })[name]
    || String(name).replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}
