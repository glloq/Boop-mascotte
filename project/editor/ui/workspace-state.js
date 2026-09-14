import { DEFAULT_MODE, modeToSurface, normalizeMode, surfaceToMode } from './task-router.js';

export const UI_PREFERENCES_KEY = 'boop-mascotte-ui-v2';

export function normalizeWorkspacePreference(value) { return modeToSurface(value); }

export function readUiPreferences(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(UI_PREFERENCES_KEY) || '{}');
    // The route an author left in, and the panels it mounts. `mode` is the new
    // truth and `workspace` the surface derived from it; a preference file
    // written before UIR-01 has only the surface, and its first mode is where
    // that author is put back.
    const mode = normalizeMode(saved.mode, surfaceToMode(saved.workspace));
    return {
      mode,
      workspace: modeToSurface(mode),
      leftCollapsed: Boolean(saved.leftCollapsed),
      rightCollapsed: Boolean(saved.rightCollapsed),
      // How wide the author dragged each column (audit §10.1). Null means "the
      // stylesheet's own default": storing a number here that happens to equal
      // it would freeze the default at the value it had the day somebody first
      // touched a separator. Re-clamped against *this* window on startup, so a
      // width saved on a wide screen cannot come back wider than the screen.
      leftWidth: Number.isFinite(saved.leftWidth) ? saved.leftWidth : null,
      rightWidth: Number.isFinite(saved.rightWidth) ? saved.rightWidth : null,
      // Closed until asked for: presets and three sliders are the simple path,
      // and the Timeline is the expert one. What the author chooses is kept.
      timelineCollapsed: saved.timelineCollapsed === undefined ? true : Boolean(saved.timelineCollapsed),
      hintsDismissed: saved.hintsDismissed || {},
      // Handles on the mascot, on unless the author turned them off.
      puppetHidden: Boolean(saved.puppetHidden),
      // Which Face Setup sections are open, so a long panel opens where it was left.
      openSections: saved.openSections && typeof saved.openSections === 'object' ? saved.openSections : {},
      // Which workspaces have their advanced screens revealed. Somebody who
      // has opened Artwork once is somebody who wants it, and asking again on
      // every visit would be a worse tax than the clutter the fold removes.
      expertNav: saved.expertNav && typeof saved.expertNav === 'object' ? saved.expertNav : {},
      // Whether the three rigging workspaces are folded away (audit §7.3).
      // Off by default: folding three questions for everybody who already has
      // a project is a product decision, not a tidy-up, so it is a choice
      // somebody makes rather than one made for them.
      simpleMode: Boolean(saved.simpleMode)
    };
  } catch { return { mode: DEFAULT_MODE, workspace: modeToSurface(DEFAULT_MODE), leftCollapsed: false, rightCollapsed: false, leftWidth: null, rightWidth: null, timelineCollapsed: true, hintsDismissed: {}, puppetHidden: false, openSections: {}, expertNav: {}, simpleMode: false }; }
}

export function writeUiPreferences(preferences, storage = globalThis.localStorage) {
  storage?.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function humanControlLabel(name) {
  return ({ lookX: 'Look left / right', lookY: 'Look up / down', eyeOpen: 'Open / close', mouthOpen: 'Open / close', smile: 'Smile', mouthWidth: 'Width', headX: 'Move left / right', headY: 'Move up / down', headTilt: 'Tilt' })[name]
    || String(name).replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}
