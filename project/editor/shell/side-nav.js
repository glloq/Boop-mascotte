/**
 * The contextual column: the panels of the screen that is open.
 *
 * Every panel the editor draws into on the left is declared here and nowhere
 * else, which is the whole reason this is a module: `app-shell.js` composes a
 * layout and no longer knows that a thing called `#face-movements` exists.
 *
 * Which sections show is not decided here either -- each rig section carries
 * the screen that owns it (`data-setup-mode`, from the route model) and the
 * stylesheet reads it.
 */
import { gateMarkup } from '../ui/mobile-capabilities.js';
import { buildAddPartSection, buildStartArtworkSection } from '../ui/sidebar-sections.js';
import { SETUP_SECTIONS } from '../core/validation/setup-sections.js';
import { sectionMode } from '../ui/task-router.js';

/**
 * The rig panels, as collapsible sections filed under the screen that shows
 * them (UIR-01).
 *
 * Nine sections in one column measured 342 visible controls, and 521 with every
 * one of them open. They are the same nine panels; what changed is that each
 * one now belongs to one of Rig's four screens, so an author assigning face
 * parts is not also looking at warp grids.
 */
function setupSectionsMarkup(openSections = {}) {
  const extra = {
    'all-parts': '<p class="small" aria-label="Part status legend">✓ Ready &nbsp; ● Needs setup &nbsp; ○ Optional &nbsp; ⚠ Invalid</p>'
  };
  return SETUP_SECTIONS.map((section) => {
    const open = openSections[section.id] ?? section.open;
    return `<details class="setup-section" data-setup-section="${section.id}" data-setup-mode="${sectionMode(section.id) || ''}"${open ? ' open' : ''}>
      <summary><span class="setup-mark" data-setup-mark aria-hidden="true">○</span><span class="setup-title">${section.label}${section.advanced ? ' <small class="setup-advanced">advanced</small>' : ''}</span><span class="setup-summary" data-setup-summary></span></summary>
      ${extra[section.id] || ''}<div id="${section.panel}"></div>
    </details>`;
  }).join('');
}

export const sideNavMarkup = (openSections) => `      <aside class="panel" id="left" aria-label="Tasks and tools"><button class="collapse-panel" id="collapse-left" aria-label="Collapse left panel">‹</button><div class="workspace-hint" data-hint hidden></div>
        <section class="character-tools"><h2>Face</h2><div id="part-browser"></div></section>
        <section class="hand-tools"><h2>Hands</h2><div id="hand-workshop"></div></section>
        <section class="structure-tools"><h2>Structure</h2><p class="small">Every piece of the mascot. Pick one here to work on it, anywhere in Design or Rig.</p><div id="layers-panel"></div></section>
        <section class="create-tools"><h2>Artwork</h2><label class="button secondary artwork-import">Import / Replace SVG<input hidden type="file" id="artwork-svg-file" accept=".svg"></label>${gateMarkup('artwork', 'mobile')}<div id="artboard-panel"></div><details class="artwork-create"><summary>Add / Create artwork</summary>${buildStartArtworkSection()}<div class="core-list"><h3>Ready</h3><div id="core-status"></div><button id="continue-rigging">Continue to Rig</button></div>${buildAddPartSection()}</details></section>
        <section class="rig-tools"><h2 data-column-heading="rig">Assign</h2>${gateMarkup('face-setup', 'mobile')}${setupSectionsMarkup(openSections)}</section>
        <section class="expressions-tools"><h2>Expressions</h2><div id="expressions-panel"></div></section>
        <section class="animate-tools"><h2 data-column-heading="animate">Motions</h2><div id="motion-panel"></div>${gateMarkup('timeline', 'mobile')}</section>
        <section class="reactions-tools"><h2 data-column-heading="reactions">Reactions</h2><div id="reactions-panel"></div><div id="automatic-panel"></div><details class="author-advanced" data-author-editor><summary><span class="setup-title">States &amp; behaviors</span><span class="setup-summary">advanced</span></summary>${gateMarkup('state-machine', 'mobile')}<div id="state-editor"></div></details></section>
      </aside>`;

/** The hosts the editor draws its left-hand panels into. */
export const sideNavHosts = (q) => ({
  leftSidebarEl: q('#left'),
  partBrowserEl: q('#part-browser'),
  handWorkshopEl: q('#hand-workshop'),
  faceSetupEl: q('#face-setup-checklist'),
  faceMovementsEl: q('#face-movements'),
  gazePanelEl: q('#gaze-panel'),
  headPoseEl: q('#head-pose'),
  handSetupEl: q('#hand-setup'),
  holdingPanelEl: q('#holding-panel'),
  warpPanelEl: q('#warp-panel'),
  rigPartsEl: q('#rig-parts'),
  expressionsEl: q('#expressions-panel'),
  motionsEl: q('#motion-panel'),
  reactionsEl: q('#reactions-panel'),
  automaticEl: q('#automatic-panel')
});

/** Section headings say what is inside without opening it. */
export function setSetupSections(root, sections) {
  const mark = { ready: '✓', partial: '●', empty: '○' };
  for (const section of sections) {
    const host = root.querySelector(`[data-setup-section="${section.id}"]`);
    if (!host) continue;
    host.dataset.setupState = section.state;
    host.querySelector('[data-setup-mark]').textContent = mark[section.state] || '○';
    host.querySelector('[data-setup-summary]').textContent = section.summary;
    host.querySelector('summary').title = `${section.label}: ${section.summary}`;
  }
}
