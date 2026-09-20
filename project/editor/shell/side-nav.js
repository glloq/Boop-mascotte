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
 *
 * The order is the rule: **the screen's own panel first, Structure last**. The
 * SVG tree used to be declared third, above every working panel, and a mascot
 * has a hundred and thirty layers -- so the left column of Rig ▸ Assign
 * measured 4226 px in an 836 px viewport and *Face parts*, the one section that
 * screen exists for, began at 3661 px. Arriving at the screen meant scrolling
 * past three and a half screens of the left hand's fingers to reach it. The
 * same was true of Artwork. Structure is kept, and kept on both screens: it is
 * the way to pick a piece the canvas will not give you. It is simply no longer
 * in front of the work (docs/AUDIT_UI_2026-09/07_IMPLEMENTATION.md, PR UI-07).
 */
import { gateMarkup } from '../ui/mobile-capabilities.js';
import { buildAddPartSection, buildStartArtworkSection } from '../ui/sidebar-sections.js';
import { SETUP_SECTIONS } from '../core/validation/setup-sections.js';
import { activeCapability, capabilityBarMarkup } from '../ui/capability-bar.js';
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
  // The `<details>` stay (UX-60 PR 3). They are what every deep link, every
  // `focusPanel` and thirty specs address, and the capability bar above them is
  // what decides which one is *shown* -- so the accordion stops being
  // navigation without the panels inside it being rewritten.
  //
  // They start **shut**, and `setCapability` opens the one the screen is on.
  // Opening all thirteen here was the first shape of this, and it cost four
  // seconds on every project open: the panels re-render about forty-five times
  // while a project loads, each write followed by a `scrollTop` read that forces
  // layout (`ui/panel-render.js`), and an open disclosure is content that layout
  // has to do. 1.6 s became 6.5 s, which is more than `rig-timeline`'s Save/Open
  // poll allows. Twelve panels nobody is looking at do not need to be laid out
  // for the thirteenth to be one press away.
  //
  // `openSections` is not read here any more: which capability is showing is
  // the bar's answer, per screen, and a remembered disclosure would be a second
  // one that disagrees.
  return `<div class="capability-host" data-capability-host>${SETUP_SECTIONS.map((section) => {
    void openSections;
    return `<details class="setup-section" data-setup-section="${section.id}" data-setup-mode="${sectionMode(section.id) || ''}">
      <summary><span class="setup-mark" data-setup-mark aria-hidden="true">○</span><span class="setup-title">${section.label}${section.advanced ? ' <small class="setup-advanced">advanced</small>' : ''}</span><span class="setup-summary" data-setup-summary></span></summary>
      ${extra[section.id] || ''}<div id="${section.panel}"></div>
    </details>`;
  }).join('')}</div>`;
}

/**
 * Show one capability of the screen, and mark the rest as reachable.
 *
 * Called on every render of the Rig column. The sections of the current screen
 * become the tab strip; the one that is open is displayed and the others are
 * `hidden`, which is what takes 3 206 px of stacked structure down to the
 * height of one panel.
 *
 * A section the current screen does not own is left entirely alone: the
 * stylesheet already hides it by `data-setup-mode`, and hiding it twice would
 * make `focusPanel` on another screen a puzzle.
 *
 * ## Why it compares before it writes
 *
 * This runs inside `setSetupSections`, which runs on **every** render of the
 * editor -- opening one project re-rendered every panel about forty-five times,
 * measured. Rewriting the bar each of those times was not the cost itself; the
 * cost was where it sat. `setPanelHtml` reads `scrollTop` immediately after
 * each panel's write, and a DOM write between two of those turns a batched
 * layout into a forced one, per panel, per render. Opening a project went from
 * 1.7 s to 6.5 s, which is the whole of `rig-timeline`'s five-second Save/Open
 * poll and then some.
 *
 * So the bar is rebuilt when it *says* something different, and the sections
 * are re-flagged when their flags differ. Everything here is idempotent, so
 * comparing first changes nothing an author can see.
 */
export function setCapability(root, { mode, sections = [], active = null, summaries = {} } = {}) {
  const host = root?.querySelector('[data-capability-host]');
  if (!host) return null;
  const mine = sections.filter(Boolean);
  const open = activeCapability(mine, active);
  if (host.dataset.capabilityActive !== (open || '')) host.dataset.capabilityActive = open || '';
  if (host.dataset.capabilityCount !== String(mine.length)) host.dataset.capabilityCount = String(mine.length);
  const owned = new Set(mine);
  // A capability of another screen is shut as well as hidden: a shut
  // disclosure is content the browser does not lay out, and the panels of the
  // twelve screens an author is not on were costing a layout each on every one
  // of the forty-five renders a project load makes.
  for (const section of host.querySelectorAll('[data-setup-section]')) {
    if (owned.has(section.dataset.setupSection) || !section.open) continue;
    section.open = false;
  }
  for (const id of mine) {
    const section = host.querySelector(`[data-setup-section="${id}"]`);
    if (!section) continue;
    const shown = id === open;
    if (section.hidden === shown) section.hidden = !shown;
    if (section.open !== shown) section.open = shown;
    if (section.dataset.capabilityOpen !== String(shown)) section.dataset.capabilityOpen = String(shown);
    // Set once: the ids and the roles are a property of the section, not of
    // this call, and writing an attribute its own value is still a write.
    if (section.id !== `cap-panel-${id}`) {
      section.setAttribute('id', `cap-panel-${id}`);
      section.setAttribute('role', 'tabpanel');
      section.setAttribute('aria-labelledby', `cap-tab-${id}`);
    }
  }
  // The bar itself, rebuilt from what the screen holds and how ready each is.
  const bar = host.querySelector('[data-capability-bar]');
  const items = mine.map((id) => {
    const section = SETUP_SECTIONS.find((item) => item.id === id);
    return { id, label: section?.label || id, state: summaries[id]?.state || null, summary: summaries[id]?.summary || '' };
  });
  const markup = capabilityBarMarkup(items, open, { label: `${mode || 'Screen'} capabilities` });
  // A screen with a single capability gets no bar -- there is nothing to
  // choose between -- so its own heading is the only name it has and must
  // stay. Hiding it left `rig.assign` with no heading at all.
  if (host.dataset.capabilityBar !== String(Boolean(markup))) host.dataset.capabilityBar = String(Boolean(markup));
  if (host.dataset.capabilityMarkup === markup) return open;
  host.dataset.capabilityMarkup = markup;
  if (!bar && markup) { host.insertAdjacentHTML('afterbegin', markup); }
  else if (bar && markup) { bar.outerHTML = markup; }
  else if (bar && !markup) { bar.remove(); }
  return open;
}

/**
 * What a phone cannot do on each of Rig's four screens (UIR-15).
 *
 * Beside the sections rather than inside one: a gate folded into a closed
 * `<details>` says nothing until somebody opens it, which is precisely the
 * screen they were about to find out the hard way. Each carries the mode it
 * belongs to, and the stylesheet shows the one whose screen is open — the same
 * rule `data-setup-mode` follows for the sections themselves.
 */
const rigGatesMarkup = () => [['face-setup', 'rig.assign'], ['calibration', 'rig.controls'], ['head-pose', 'rig.head2d'], ['deform', 'rig.deform']]
  .map(([area, mode]) => gateMarkup(area, 'mobile', { mode })).join('');

/**
 * The left column, one section per surface.
 *
 * Design's one section holds **two screens** (UIR-18, docs/DESIGN_SCREENS.md):
 * `.assemble-tools` is where a mascot comes from -- the three ways to start, a
 * picture brought in, the library to take parts from -- and `.draw-tools` is
 * the vector editor's own. Which shows is gated on `data-mode` in the
 * stylesheet, the way the workspaces have always been gated on
 * `data-workspace`; both are the same panel hosts they always were, so nothing
 * in the render plan or the wiring knows this happened.
 *
 * Within Assemble the order is what an author reaches for, most often first:
 * the **library** (a hundred and fifty drawings, and the only one of these
 * that shows pictures rather than words), then a picture of their own, then
 * the parts the library has no drawing for. *Start over* is last and folded,
 * because every card in it replaces the artwork the author has — a destructive
 * act does not belong at the top of a column, and Home already offers the same
 * three to somebody who has nothing yet.
 *
 * The three ways in keep their V5-07 order among themselves -- *Add picture*
 * first because a mascot is pictures, *Import / Replace SVG* last because it
 * is the way in for somebody who already has a drawing, which is no longer the
 * common case.
 */
export const sideNavMarkup = (openSections) => `      <aside class="panel" id="left" aria-label="Tasks and tools"><button class="collapse-panel" id="collapse-left" aria-label="Collapse left panel">‹</button><div class="workspace-hint" data-hint hidden></div>
        <section class="hand-tools"><h2>Hands</h2>${gateMarkup('hands', 'mobile')}<div id="hand-states"></div></section>
        <section class="create-tools"><h2 data-column-heading="create">Assemble</h2><div class="assemble-tools"><div id="face-library"></div><h3>Bring a picture</h3><p class="small">A piece of your own. It arrives selected, and the Inspector asks which part of the face it is.</p><div class="artwork-imports"><label class="button secondary artwork-import">Add picture<input hidden type="file" id="artwork-image-file" accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"></label><label class="button secondary artwork-import">Import head / base<input hidden type="file" id="artwork-base-file" accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"></label><label class="button secondary artwork-import">Import / Replace SVG<input hidden type="file" id="artwork-svg-file" accept=".svg"></label></div>${buildAddPartSection()}<div class="core-list"><h3>Ready</h3><div id="core-status"></div><button id="continue-rigging">Continue to Rig</button></div><details class="artwork-create" data-keep-open="start-over"><summary>Start over</summary><p class="small">Each of these replaces the artwork you have.</p>${buildStartArtworkSection()}</details></div><div class="draw-tools">${gateMarkup('artwork', 'mobile')}<div id="artboard-panel"></div></div></section>
        <section class="rig-tools"><h2 data-column-heading="rig">Assign</h2><div id="deform-bench" class="deform-bench-host" hidden></div>${rigGatesMarkup()}${setupSectionsMarkup(openSections)}</section>
        <section class="expressions-tools"><h2>Expressions</h2><div id="expressions-panel"></div></section>
        <section class="animate-tools"><h2 data-column-heading="animate">Motions</h2><div id="motion-panel"></div>${gateMarkup('timeline', 'mobile')}</section>
        <section class="reactions-tools"><h2 data-column-heading="reactions">Reactions</h2><div id="reactions-panel"></div><div id="automatic-panel"></div><details class="author-advanced" data-author-editor><summary><span class="setup-title">States &amp; behaviors</span><span class="setup-summary">what the board draws</span></summary>${gateMarkup('state-machine', 'mobile')}<div id="state-editor"></div></details></section>
        <section class="structure-tools"><h2>Structure</h2><p class="small">Every piece of the mascot. Pick one here to work on it, anywhere in Design or Rig.</p><div id="layers-panel"></div></section>
      </aside>`;

/** The hosts the editor draws its left-hand panels into. */
export const sideNavHosts = (q) => ({
  leftSidebarEl: q('#left'),
  handStatesEl: q('#hand-states'),
  faceLibraryEl: q('#face-library'),
  faceSetupEl: q('#face-setup-checklist'),
  faceMovementsEl: q('#face-movements'),
  faceStatesEl: q('#face-states'),
  gazePanelEl: q('#gaze-panel'),
  headPoseEl: q('#head-pose'),
  handSetupEl: q('#hand-setup'),
  holdingPanelEl: q('#holding-panel'),
  warpPanelEl: q('#warp-panel'),
  rigPartsEl: q('#rig-parts'),
  deformBenchEl: q('#deform-bench'),
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
