/**
 * The shell: a layout, and the regions that fill it (UIR-02,
 * docs/UIR_REFACTOR_BASELINE.md).
 *
 * ```text
 * topbar          the project bar, and the navigation across it
 * side-nav        the contextual column of the screen that is open
 * canvas-column   the one surface every screen shares
 * inspector-host  one inspector, an adapter per kind of selection
 * bottom-dock     the surface a screen opens under the canvas
 * overlays        Home, the status line, Problems, the dialogs
 * ```
 *
 * What this file used to be is the reason for the split: one function that
 * built every panel in the editor and then wired all of them, so the module
 * that decides where a column goes also knew that a thing called
 * `#face-movements` exists and what its heading says. It composes now. The ids
 * live with the markup that declares them, and each region hands back the part
 * of the shell's API it owns.
 *
 * The API itself is unchanged, deliberately: `editor-app.js` and the e2e seam
 * both read it, and a decomposition that also changes its shape is two changes
 * nobody can review apart.
 */
import { mustQuery } from '../ui/must-query.js';
import { readUiPreferences, writeUiPreferences } from '../ui/workspace-state.js';
import { PANEL_MODES, surfaceToMode } from '../ui/task-router.js';
import { readinessVerdict } from '../core/validation/task-readiness.js';
import { topbarMarkup, wireTopbar } from './topbar.js';
import { createWorkspaceNav } from './workspace-nav.js';
import { sideNavHosts, sideNavMarkup, setSetupSections } from './side-nav.js';
import { canvasColumnMarkup, wireCanvasColumn } from './canvas-column.js';
import { inspectorHostMarkup, inspectorHosts } from './inspector-host.js';
import { bottomDockMarkup, wireBottomDock } from './bottom-dock.js';
import { exportPanelMarkup, overlaysMarkup, wireOverlays } from './overlays.js';

export function createAppShell(root) {
  const preferences = readUiPreferences();
  const savePreferences = () => writeUiPreferences(preferences);

  root.innerHTML = `${topbarMarkup()}
    ${overlaysMarkup()}
    <main class="workspace" aria-label="Workspace">
      ${sideNavMarkup(preferences.openSections)}
      ${canvasColumnMarkup()}
      ${inspectorHostMarkup()}
    </main>
    ${bottomDockMarkup()}${exportPanelMarkup()}`;

  const q = (selector) => mustQuery(root, selector);
  const qAll = (selector) => [...root.querySelectorAll(selector)];
  const hosts = { ...sideNavHosts(q), ...inspectorHosts(q) };

  q('.skip-link').addEventListener('click', (event) => { event.preventDefault(); q('#canvas').focus(); });
  // A section an author opened stays open, on whichever screen shows it.
  root.addEventListener('toggle', (event) => {
    const id = event.target?.dataset?.setupSection;
    if (!id) return;
    preferences.openSections = { ...preferences.openSections, [id]: event.target.open };
    savePreferences();
  }, true);

  const dock = wireBottomDock({ root, q, preferences, savePreferences });
  const canvas = wireCanvasColumn({ root, q, qAll, preferences, savePreferences });
  const overlays = wireOverlays({ root, q, qAll });
  const topbar = wireTopbar({ root, q });

  /**
   * Collapsing a column or the dock: three panes, one rule, one place that
   * knows the class names match the preference keys.
   */
  const collapse = (side) => {
    const key = side === 'left' ? 'leftCollapsed' : side === 'right' ? 'rightCollapsed' : 'timelineCollapsed';
    preferences[key] = !preferences[key];
    root.classList.toggle(`${side}-collapsed`, preferences[key]);
    if (side === 'timeline') {
      dock.syncToggle();
      root.dispatchEvent(new CustomEvent('timelinetoggle', { detail: { open: !preferences.timelineCollapsed } }));
    }
    savePreferences();
  };
  q('#collapse-left').onclick = () => collapse('left');
  q('#collapse-right').onclick = () => collapse('right');
  q('#collapse-timeline').onclick = () => collapse('timeline');
  root.classList.toggle('left-collapsed', preferences.leftCollapsed);
  root.classList.toggle('right-collapsed', preferences.rightCollapsed);
  root.classList.toggle('timeline-collapsed', preferences.timelineCollapsed);

  const nav = createWorkspaceNav({
    root, preferences, savePreferences,
    // A screen whose subject is a dock or a disclosure arrives with it open:
    // landing on one folded shut is the failure the focus mechanism exists to
    // prevent.
    enter: (mode) => {
      if (mode.dock) dock.openDock(mode.dock);
      if (mode.panel) root.querySelector(`#${mode.panel}`)?.closest('details')?.setAttribute('open', '');
    },
    resetScroll: () => { hosts.leftSidebarEl.scrollTop = 0; const right = root.querySelector('.panel-right'); if (right) right.scrollTop = 0; }
  });
  q('#continue-rigging').onclick = () => nav.go({ mode: 'rig.assign' });
  nav.applyMode(preferences.mode, false);

  return {
    ...hosts, ...canvas, ...dock, ...overlays, ...topbar, ...nav,
    /** Section headings say what is inside without opening it. */
    setSetupSections: (sections) => setSetupSections(root, sections),
    /**
     * Open the advanced States & behaviors editor.
     *
     * It lives in a closed disclosure: every route that lands on it (Advanced
     * tools, Problems, the palette, "Behaviors (advanced)") goes through here,
     * so a deep link never ends on a panel folded out of sight.
     */
    openAuthorEditor() { return this.focusPanel('state-editor'); },
    /** Scroll a panel into view and mark it, so a deep link lands on the control. */
    focusPanel(id) {
      const panel = root.querySelector(`#${id}`);
      if (!panel) return false;
      // Since Rig became four screens, a panel can be revealed on a screen that
      // does not show it. Every route into a panel goes through here -- Advanced
      // tools, Problems, the palette, a validation Fix -- so the screen it lives
      // on is opened here rather than in each of them.
      if (PANEL_MODES[id]) nav.applyMode(PANEL_MODES[id]);
      // Open first, scroll second: a panel inside a collapsed section has no
      // position to scroll to yet.
      for (let node = panel; node && node !== root; node = node.parentElement) if (node.tagName === 'DETAILS' && !node.open) node.open = true;
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      root.querySelectorAll('[data-panel-focused]').forEach((node) => node.removeAttribute('data-panel-focused'));
      panel.setAttribute('data-panel-focused', 'true');
      const heading = panel.querySelector('h3,h4');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      setTimeout(() => panel.removeAttribute('data-panel-focused'), 2400);
      return true;
    },
    setReadiness(readiness, issues) {
      nav.setReadiness(readiness, issues);
      topbar.setReadinessVerdict(readinessVerdict(readiness));
      const errors = issues.filter((issue) => issue.severity === 'error').length;
      const warnings = issues.filter((issue) => issue.severity === 'warning').length;
      topbar.setExportLabel(errors ? `Export blocked · ${errors}` : warnings ? `Export · ${warnings} warning${warnings === 1 ? '' : 's'}` : 'Export');
    },
    renderProjectUi({loaded,features,core=[],featureCompatible=false}){q('.core-list').hidden=!loaded;q('#core-status').innerHTML=core.map(item=>`<p>${item.ready?'✓':'●'} ${item.label}</p>`).join('');q('.feature-list').classList.toggle('incompatible',!featureCompatible);for(const [id,state] of Object.entries(features)){const button=root.querySelector(`[data-add-feature="${id}"]`);const note=root.querySelector(`[data-feature-reason="${id}"]`);const installed=Boolean(state?.installed),available=Boolean(state?.available),reason=state?.reason||'';if(button){button.textContent=installed?'✓ Added':'+ Add';button.disabled=installed||!available;button.title=reason;}
      if(note){note.textContent=reason;note.hidden=!reason;}}},
    onWorkspaceChange(handler) { root.addEventListener('workspacechange', (event) => handler(event.detail.workspace)); },
    setWorkspace(surface) { nav.applyMode(surfaceToMode(surface)); },
    bindAddFeature(handler) { q('.feature-list').addEventListener('click', (event) => event.target.dataset.addFeature && handler(event.target.dataset.addFeature, event.target)); },
    bindGenerateFace(handler) {
      const card = q('[data-face-builder]'), fields = q('#face-builder');
      card.onclick = () => { const open = fields.hidden; fields.hidden = !open; card.setAttribute('aria-expanded', String(open)); if (open) q('#face-head').focus(); };
      q('#generate-face').onclick = () => handler({ head: q('#face-head').value, eyes: q('#face-eyes').value, mouth: q('#face-mouth').value });
    }
  };
}
