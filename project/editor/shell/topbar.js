/**
 * The project bar: what is true of the project wherever the author is.
 *
 * Undo, Problems, Save, Export and the ••• menu are here rather than in a
 * workspace because none of them belongs to one. The navigation between them
 * is `workspace-nav.js`; this owns the bar around it.
 */
import { buildPluginSection } from '../ui/sidebar-sections.js';
import { workspaceNavMarkup } from './workspace-nav.js';

export const topbarMarkup = () => `<a class="skip-link" href="#canvas">Skip to canvas</a><header class="topbar" aria-label="Project bar"><button id="drawer-toggle" class="drawer-toggle" aria-label="Tasks and tools" aria-expanded="false" aria-controls="left">☰</button><button id="home-button" class="brand-home" aria-label="Home">BOOP <span>Mascot Studio</span></button>
    ${workspaceNavMarkup()}
    <nav class="project-actions"><button id="capability-toggle" class="capability-toggle" aria-label="What works on this device" title="What works on this device">📱</button><button id="search-button" aria-label="Search actions and items (Ctrl+K)" title="Search (Ctrl+K)">🔍</button><button id="undo" aria-label="Undo">↶</button><button id="redo" aria-label="Redo">↷</button><button id="validate" title="Check project readiness">Problems</button><button id="reset-mascot-top" aria-label="Reset mascot" title="Reset mascot: the face back to rest, and every preview-only change cleared. Nothing in your project changes. (Ctrl/Cmd+Alt+R)">⟲</button><button id="save-project-top" aria-label="Save Project" title="Keeps your editable Boop project">Save Project</button><button id="export-top" data-action="open-export" title="Creates files for using the mascot outside the editor">Export</button><details class="file-menu"><summary aria-label="More project actions">•••</summary><div class="menu-popover"><button id="new-project">New Project</button><button id="recover-autosave" hidden>Recover local draft</button><label class="button secondary">Open Project <small>Complete editable project</small><input hidden type="file" id="project-file" accept=".json"></label><label class="button secondary">Import SVG <small>Artwork only</small><input hidden type="file" id="svg-file" accept=".svg"></label><label class="button secondary">Import rig.json <small>Rig data onto the current artwork</small><input hidden type="file" id="rig-file" accept=".json,application/json"></label><label class="button secondary">Import face pack <small>Library parts and presets, kept in this browser</small><input hidden type="file" id="face-pack-file" accept=".json,application/json"></label><div class="compact-only menu-group" role="group" aria-label="Actions"><button type="button" id="menu-undo" class="secondary">↶ Undo</button><button type="button" id="menu-redo" class="secondary">↷ Redo</button><button type="button" id="menu-problems" class="secondary">Problems</button><button type="button" id="menu-search" class="secondary">🔍 Search</button></div><details><summary>Advanced</summary><button type="button" class="secondary" data-open-advanced>Advanced tools…</button>${buildPluginSection()}</details></div></details></nav><span id="save-state" class="status-pill">✓ Saved</span></header>`;

/** @returns the project-bar half of the shell's API. */
export function wireTopbar({ root, q }) {
  let resetMascotHandler = () => {};
  // One reset, in the project bar, on every screen: the mascot is posed from
  // the canvas in Design and Rig as much as it is from Preview, so the way back
  // to rest cannot live inside one screen's panel (it used to be
  // `#preview-reset`, which only Preview ever showed).
  q('#reset-mascot-top').onclick = () => resetMascotHandler();
  const bindFile = (selector, handler) => q(selector).addEventListener('change', (event) => event.target.files?.[0] && handler(event.target.files[0]));
  const closeMenu = () => { q('details.file-menu').open = false; };

  return {
    bindResetMascot(handler) { resetMascotHandler = handler; },
    setProjectActionsEnabled(enabled) { q('#save-project-top').disabled = !enabled; q('#export-top').disabled = !enabled; q('#reset-mascot-top').disabled = !enabled; },
    setDirty(dirty, autosaved = false) { q('#save-state').textContent = dirty ? (autosaved ? 'Autosaved locally' : 'Unsaved changes') : '✓ Saved project'; q('#save-state').classList.toggle('dirty', dirty); },
    setUndoRedoState({ canUndo, canRedo }) { q('#undo').disabled = !canUndo; q('#redo').disabled = !canRedo; q('#menu-undo').disabled = !canUndo; q('#menu-redo').disabled = !canRedo; },
    setExportLabel(text) { q('#export-top').textContent = text; },
    closeProjectMenu() { const menu = q('details.file-menu'); if (!menu.open) return false; menu.open = false; return true; },
    openProjectMenuAdvanced() { const menu = q('details.file-menu'); menu.open = true; const inner = menu.querySelector('.menu-popover > details'); if (inner) inner.open = true; q('#plugin-path')?.focus(); },
    setPluginStatus(message) { q('#plugin-status').textContent = message; },
    bindPluginToggles(handler) { q('#plugin-path').addEventListener('change', (event) => handler('path', event.target.checked)); },
    bindUndoRedo(undo, redo) { q('#undo').onclick = undo; q('#redo').onclick = redo; q('#menu-undo').onclick = () => { closeMenu(); undo(); }; q('#menu-redo').onclick = () => { closeMenu(); redo(); }; },
    bindNew(handler) { q('#new-project').onclick = () => { closeMenu(); handler(); }; },
    bindValidate(handler) { q('#validate').onclick = handler; q('#menu-problems').onclick = () => { closeMenu(); handler(); }; },
    bindSearch(handler) { q('#search-button').onclick = handler; q('#menu-search').onclick = () => { closeMenu(); handler(); }; },
    bindCapabilities(handler) { q('#capability-toggle').onclick = handler; },
    bindOpenAdvanced(handler) { q('[data-open-advanced]').onclick = () => { closeMenu(); handler(); }; },
    bindExport(handler) { q('#export-top').onclick = handler; },
    bindSaveProject(handler) { q('#save-project-top').onclick = handler; },
    bindLoadProject(handler) { bindFile('#project-file', handler); },
    bindLoadSvg(handler) { bindFile('#svg-file', handler); bindFile('#artwork-svg-file', handler); },
    bindLoadRig(handler) { bindFile('#rig-file', handler); },
    bindLoadFacePack(handler) { bindFile('#face-pack-file', handler); }
  };
}
