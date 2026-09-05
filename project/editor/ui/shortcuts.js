// Keyboard shortcut registry (UX-21): one list that the global key handler
// matches against and the shortcut help renders, so what is documented is
// what works. Surface-scoped keys handled by their own panels are listed as
// documentation only (match: null).
const meta = (event) => Boolean(event.ctrlKey || event.metaKey);
const key = (event) => String(event.key || '').toLowerCase();

export const SHORTCUTS = Object.freeze([
  Object.freeze({ id: 'palette', keys: 'Ctrl/Cmd + K', label: 'Search actions and items', scope: 'Global', match: (event) => meta(event) && key(event) === 'k' }),
  Object.freeze({ id: 'help', keys: '?', label: 'Keyboard shortcuts', scope: 'Global', match: (event) => event.key === '?' && !meta(event) }),
  Object.freeze({ id: 'undo', keys: 'Ctrl/Cmd + Z', label: 'Undo', scope: 'Global', match: (event) => meta(event) && !event.shiftKey && key(event) === 'z' }),
  Object.freeze({ id: 'redo', keys: 'Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z', label: 'Redo', scope: 'Global', match: (event) => meta(event) && (key(event) === 'y' || (event.shiftKey && key(event) === 'z')) }),
  Object.freeze({ id: 'save', keys: 'Ctrl/Cmd + S', label: 'Save Project', scope: 'Global', match: (event) => meta(event) && !event.shiftKey && key(event) === 's' }),
  Object.freeze({ id: 'escape', keys: 'Esc', label: 'Close the topmost surface (menu, palette, popover, drawer or sheet), then cancel a canvas mode', scope: 'Global', match: (event) => event.key === 'Escape' }),
  Object.freeze({ id: 'play', keys: 'Space', label: 'Play or pause the active animation', scope: 'Animate', match: (event) => event.code === 'Space' }),
  Object.freeze({ id: 'timeline-seek', keys: 'Home / End', label: 'Seek to the start or the end (Timeline focused)', scope: 'Timeline', match: null }),
  Object.freeze({ id: 'timeline-keys', keys: 'Delete, Ctrl/Cmd + C / V / D', label: 'Delete, copy, paste or duplicate selected keys (Timeline focused)', scope: 'Timeline', match: null }),
  Object.freeze({ id: 'design-tools', keys: 'V · N · P · L · R · O · T · H', label: 'Select, Node, Pen, Line, Rectangle, Ellipse, Text, Hand tools (Artwork)', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'draw-modifiers', keys: 'Shift · Alt', label: 'While drawing: Shift keeps a line to 45°, squares a rectangle or a polygon\'s rotation; Alt draws a shape from its centre; Backspace removes the last pen point, Enter finishes', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'gizmo-modes', keys: 'G · E · K · A', label: 'Move, Rotate, Scale, Pivot (anchor) on the selected artwork (Artwork, Select tool)', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'gizmo-cancel', keys: 'Esc', label: 'Cancel a transform in progress and restore the previous position', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'artwork-nudge', keys: 'Arrow keys, Shift + arrows', label: 'Move the selected artwork by 1 unit, or 10 (Artwork, Select tool)', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'artwork-clipboard', keys: 'Ctrl/Cmd + C / V / D, Delete', label: 'Copy, paste, duplicate or delete the selected artwork (Artwork)', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'artwork-menu', keys: 'Shift + F10 or the Menu key', label: 'Open the edit menu of the selected artwork (Artwork, Face Setup)', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'pen-finish', keys: 'Enter · double-click', label: 'Close the shape being drawn with the Pen', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'canvas-wheel', keys: 'Wheel · Ctrl/Cmd + wheel', label: 'Pan the canvas, or zoom it about the pointer', scope: 'Artwork', match: null }),
  Object.freeze({ id: 'pad-arrows', keys: 'Arrow keys', label: 'Nudge a test pad or a slider (Preview / Face Setup)', scope: 'Preview', match: null })
]);

export const SHORTCUT_SCOPES = Object.freeze(['Global', 'Artwork', 'Animate', 'Timeline', 'Preview']);

/** Is the event typing into a text field? Global character shortcuts stay out of the way there. */
export const isTextTarget = (target) => Boolean(target && typeof target.matches === 'function' && (target.matches('input:not([type=checkbox]):not([type=range]):not([type=file]), textarea, select') || target.isContentEditable));

/** Shortcuts that never type a character, so they also fire from a text field (and keep the browser's own dialog away). */
const TYPING_SAFE = new Set(['escape', 'save']);

/** The id of the global shortcut an event triggers, or null. Escape and Save work everywhere; other keys never fire while typing. */
export function matchShortcut(event, { typing = isTextTarget(event.target) } = {}) {
  for (const shortcut of SHORTCUTS) {
    if (!shortcut.match || !shortcut.match(event)) continue;
    if (typing && !TYPING_SAFE.has(shortcut.id)) return null;
    return shortcut.id;
  }
  return null;
}

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Markup for the shortcut help dialog, grouped by scope in a stable order. */
export function shortcutHelpMarkup() {
  return SHORTCUT_SCOPES.map((scope) => {
    const items = SHORTCUTS.filter((shortcut) => shortcut.scope === scope);
    return items.length ? `<section class="shortcut-group"><h4>${esc(scope)}</h4><dl>${items.map((shortcut) => `<div data-shortcut="${shortcut.id}"><dt><kbd>${esc(shortcut.keys)}</kbd></dt><dd>${esc(shortcut.label)}</dd></div>`).join('')}</dl></section>` : '';
  }).join('');
}
