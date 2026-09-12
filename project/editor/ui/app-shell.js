import { describeFix } from '../core/validation/issue-guidance.js';
import { gateMarkup } from './mobile-capabilities.js';
import { buildAddPartSection, buildPluginSection, buildStartArtworkSection } from './sidebar-sections.js';
import { mustQuery } from './must-query.js';
import { readUiPreferences, writeUiPreferences } from './workspace-state.js';
import { SETUP_SECTIONS } from '../core/validation/setup-sections.js';
import { homeSurfaceMarkup, renderHomeRecovery } from './home-surface.js';
import { MODES, PANEL_MODES, WORKSPACES, WORKSPACE_ORDER, modeToSurface, modeToWorkspace, normalizeMode, sectionMode, surfaceToMode, workspaceEntryMode, workspaceModes } from './task-router.js';
import { worstStatus } from '../core/validation/task-readiness.js';
import { esc } from './escape-html.js';

const HINTS = {
  'design.face': 'Pick a part on the left, or click it on the mascot, then move it, resize it or recolour it here. Advanced opens every control.',
  'design.hands': 'The drawings a hand can show. Drop an SVG in to add one, import a whole set, or save yours out to share. Each hand keeps its own.',
  'design.artwork': 'Start simple, then add one expressive feature at a time.',
  'rig.assign': 'Tell the editor what each part of the face is: click its artwork on the canvas, or accept what it has already worked out.',
  'rig.controls': 'Turn on what the face can move, then calibrate each movement by posing it on the canvas.',
  'rig.head2d': 'Capture the head looking left, right, up and down. The editor fills in everything between.',
  'rig.deform': 'Pins, holds and warps: the expert tools for artwork that has to bend rather than move.',
  'animate.expressions': 'Name a face (Happy, Sad…), shape it with your movements, then test its intensity.',
  'animate.motions': 'Add a motion preset, test it, then adjust it in the Inspector. The Timeline edits any motion key by key.',
  'animate.timeline': 'The detailed editor of the motion you have open: every control, key by key.',
  'behavior.reactions': 'When something happens (a click), show an expression and a motion, then come back. Test it here, then in Preview.',
  'behavior.automatic': 'What the mascot does when nobody is asking: blinking, glancing around, breathing.',
  'behavior.stateMachine': 'The states the mascot moves between, and what makes it move between them.',
  preview: 'Test states and animations without modifying your project.'
};


/**
 * The readiness section each screen is graded by (UIR-01).
 *
 * Face Setup used to carry one merged badge for face parts *and* movements,
 * because it was one tab. Two screens grade separately, which is the badge
 * saying something: Assign is ✓ when the parts are named, and Controls is ⚠
 * until the movements it turned on are calibrated.
 *
 * A screen with no entry carries no badge. That is not an oversight: Head 2.5D,
 * Deform, the Timeline, Automatic and States are all optional, and a permanent
 * "○ not started" on an optional screen reads as a chore.
 */
const MODE_READINESS = Object.freeze({
  'design.artwork': 'artwork', 'rig.assign': 'faceSetup', 'rig.controls': 'movements',
  'animate.expressions': 'expressions', 'animate.motions': 'animate', 'behavior.reactions': 'reactions'
});

/**
 * The rig panels, as collapsible sections filed under the screen that shows
 * them (UIR-01).
 *
 * Nine sections in one column measured 342 visible controls, and 521 with every
 * one of them open. They are the same nine panels; what changed is that each
 * one now belongs to one of Rig's four screens, so an author assigning face
 * parts is not also looking at warp grids. `data-setup-mode` is what the
 * stylesheet reads to decide.
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

export function createAppShell(root) {
  const preferences = readUiPreferences();
  /** The screen last open in each workspace, for the session (UIR-01). */
  const lastModeInWorkspace = new Map();
  root.innerHTML=`<a class="skip-link" href="#canvas">Skip to canvas</a><header class="topbar" aria-label="Project bar"><button id="drawer-toggle" class="drawer-toggle" aria-label="Tasks and tools" aria-expanded="false" aria-controls="left">☰</button><button id="home-button" class="brand-home" aria-label="Home">BOOP <span>Mascot Studio</span></button>
    <nav class="stage-nav" aria-label="Editor navigation">${WORKSPACE_ORDER.map(id=>`<div class="stage-group" data-stage-group="${id}"><button class="stage-tab" data-stage="${id}" aria-label="${WORKSPACES[id].label} workspace" title="${WORKSPACES[id].hint}">${WORKSPACES[id].label}</button><div class="stage-steps" role="group" aria-label="${WORKSPACES[id].label} steps">${workspaceModes(id).map(mode=>`<button class="workspace-tab${MODES[mode].advanced?' advanced-mode':''}" data-mode="${mode}" data-workspace="${MODES[mode].surface}" data-stage="${id}"${MODES[mode].aria?` aria-label="${MODES[mode].aria}"`:''}>${MODES[mode].label}</button>`).join('')}</div></div>`).join('')}<div class="stage-group global-group"><button class="workspace-tab global-tab" data-mode="preview" data-workspace="preview" aria-label="Preview" title="Test the mascot from wherever you are. Nothing you do here changes the project.">▶ Preview</button></div></nav>
    <nav class="project-actions"><button id="capability-toggle" class="capability-toggle" aria-label="What works on this device" title="What works on this device">📱</button><button id="search-button" aria-label="Search actions and items (Ctrl+K)" title="Search (Ctrl+K)">🔍</button><button id="undo" aria-label="Undo">↶</button><button id="redo" aria-label="Redo">↷</button><button id="validate" title="Check project readiness">Problems</button><button id="reset-mascot-top" aria-label="Reset mascot" title="Reset mascot: the face back to rest, and every preview-only change cleared. Nothing in your project changes. (Ctrl/Cmd+Alt+R)">⟲</button><button id="save-project-top" aria-label="Save Project" title="Keeps your editable Boop project">Save Project</button><button id="export-top" data-action="open-export" title="Creates files for using the mascot outside the editor">Export</button><details class="file-menu"><summary aria-label="More project actions">•••</summary><div class="menu-popover"><button id="new-project">New Project</button><button id="recover-autosave" hidden>Recover local draft</button><label class="button secondary">Open Project <small>Complete editable project</small><input hidden type="file" id="project-file" accept=".json"></label><label class="button secondary">Import SVG <small>Artwork only</small><input hidden type="file" id="svg-file" accept=".svg"></label><label class="button secondary">Import rig.json <small>Rig data onto the current artwork</small><input hidden type="file" id="rig-file" accept=".json,application/json"></label><label class="button secondary">Import face pack <small>Library parts and presets, kept in this browser</small><input hidden type="file" id="face-pack-file" accept=".json,application/json"></label><div class="compact-only menu-group" role="group" aria-label="Actions"><button type="button" id="menu-undo" class="secondary">↶ Undo</button><button type="button" id="menu-redo" class="secondary">↷ Redo</button><button type="button" id="menu-problems" class="secondary">Problems</button><button type="button" id="menu-search" class="secondary">🔍 Search</button></div><details><summary>Advanced</summary><button type="button" class="secondary" data-open-advanced>Advanced tools…</button>${buildPluginSection()}</details></div></details></nav><span id="save-state" class="status-pill">✓ Saved</span></header>
    ${homeSurfaceMarkup()}<div id="toast" class="toast" role="status" aria-live="polite"></div><button id="exit-focus" class="exit-focus">Exit Preview</button><button id="return-export" class="return-export" hidden>↩ Back to Export</button><button id="return-character" class="return-export" hidden>↩ Back to Character</button><section id="problems-panel" class="problems-popover" hidden></section><section id="advanced-panel" class="problems-popover advanced-popover" role="dialog" hidden></section><dialog id="command-palette" class="command-palette" aria-label="Command palette"></dialog><dialog id="shortcut-help" class="shortcut-help"></dialog><dialog id="colour-picker" class="colour-picker" aria-label="Choose a colour"></dialog><section id="capability-panel" class="problems-popover capability-popover" role="dialog" hidden></section><dialog id="unsaved-dialog" aria-labelledby="unsaved-heading"><form method="dialog"><h2 id="unsaved-heading">Unsaved changes</h2><p>Your current project has changes that have not been saved.</p><div class="dialog-actions"><button value="cancel">Cancel</button><button value="discard">Discard</button><button value="save" class="primary">Save Project</button></div></form></dialog>
    <div id="drawer-scrim" class="drawer-scrim" hidden></div>
    <main class="workspace" aria-label="Workspace">
      <aside class="panel" id="left" aria-label="Tasks and tools"><button class="collapse-panel" id="collapse-left" aria-label="Collapse left panel">‹</button><div class="workspace-hint" data-hint hidden></div>
        <section class="character-tools"><h2>Face</h2><div id="part-browser"></div></section>
        <section class="hand-tools"><h2>Hands</h2><div id="hand-workshop"></div></section>
        <section class="structure-tools"><h2>Structure</h2><p class="small">Every piece of the mascot. Pick one here to work on it, anywhere in Design or Rig.</p><div id="layers-panel"></div></section>
        <section class="create-tools"><h2>Artwork</h2><label class="button secondary artwork-import">Import / Replace SVG<input hidden type="file" id="artwork-svg-file" accept=".svg"></label>${gateMarkup('artwork', 'mobile')}<div id="artboard-panel"></div><details class="artwork-create"><summary>Add / Create artwork</summary>${buildStartArtworkSection()}<div class="core-list"><h3>Ready</h3><div id="core-status"></div><button id="continue-rigging">Continue to Rig</button></div>${buildAddPartSection()}</details></section>
        <section class="rig-tools"><h2 data-column-heading="rig">Assign</h2>${gateMarkup('face-setup', 'mobile')}${setupSectionsMarkup(preferences.openSections)}</section>
        <section class="expressions-tools"><h2>Expressions</h2><div id="expressions-panel"></div></section>
        <section class="animate-tools"><h2 data-column-heading="animate">Motions</h2><div id="motion-panel"></div>${gateMarkup('timeline', 'mobile')}</section>
        <section class="reactions-tools"><h2 data-column-heading="reactions">Reactions</h2><div id="reactions-panel"></div><div id="automatic-panel"></div><details class="author-advanced" data-author-editor><summary><span class="setup-title">States &amp; behaviors</span><span class="setup-summary">advanced</span></summary>${gateMarkup('state-machine', 'mobile')}<div id="state-editor"></div></details></section>
      </aside>
      <div class="canvas-column"><div class="canvas-tools"><div class="design-toolbar" role="toolbar" aria-label="Vector tools"><button data-design-tool="select" aria-label="Select" class="active" title="Select (V)">↖ <span>Select</span></button><button data-design-tool="node" aria-label="Node" title="Edit points and curve handles (N)">◇ <span>Node</span></button><button data-design-tool="pen" aria-label="Pen" title="Pen: click for corners, drag for curves (P)">✒ <span>Pen</span></button><button data-design-tool="line" aria-label="Line" title="Line (L)">╱ <span>Line</span></button><button data-design-tool="rect" aria-label="Rectangle" title="Rectangle (R)">□ <span>Rectangle</span></button><button data-design-tool="ellipse" aria-label="Ellipse" title="Ellipse (O)">○ <span>Ellipse</span></button><button data-design-tool="polygon" aria-label="Polygon" title="Polygon or star (S)">⬠ <span>Polygon</span></button><button data-design-tool="text" aria-label="Text" title="Text (T)">T <span>Text</span></button><button data-design-tool="hand" aria-label="Hand" title="Pan (H)">✋ <span>Hand</span></button></div><div id="tool-options" class="tool-options" aria-label="Tool options" hidden></div><div class="canvas-toolbar" aria-label="Canvas view"><button data-puppet-toggle aria-pressed="true" title="Handles on the mascot: drag the face to pose it">✋ Handles</button><button data-zoom="fit">Fit</button><button data-zoom="reset" id="zoom-value">100%</button><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="in" aria-label="Zoom in">+</button></div></div><section id="canvas" tabindex="-1"></section></div>
      <aside class="panel-right" aria-label="Inspector and preview"><button class="collapse-panel" id="collapse-right" aria-label="Collapse right panel">›</button><div class="sheet-header" id="sheet-header"><span class="sheet-subject" data-sheet-subject>Inspector</span><div class="sheet-detents"><button type="button" data-sheet-detent="half" aria-label="Sheet half height">▴</button><button type="button" data-sheet-detent="full" aria-label="Sheet full height">▲</button><button type="button" data-sheet-detent="collapsed" aria-label="Collapse sheet">▾</button></div></div><section id="context-inspector" aria-labelledby="context-inspector-heading"><h2 id="context-inspector-heading" data-context-inspector-heading tabindex="-1">Inspector</h2><p class="small" data-context-inspector-empty></p><div id="rig-panel" data-inspector-adapter="semantic"></div><div data-inspector-adapter="artwork">${gateMarkup('bindings', 'mobile')}<div id="inspector"></div></div><div data-inspector-adapter="character" hidden><div id="part-inspector"></div></div><div data-inspector-adapter="expression" hidden><div id="expression-inspector"></div></div><div data-inspector-adapter="motion" hidden><div id="motion-inspector"></div></div><div data-inspector-adapter="reaction" hidden><div id="reaction-inspector"></div></div></section><section class="preview-actions"><div class="card-title"><h2>Preview</h2><div class="action-row"><button id="focus-preview">Focus</button></div></div><p class="small">Test the mascot here. Nothing you do in Preview changes the project.</p><div id="preview-panel"></div></section><section class="publish-tools"><div id="publish-panel"></div></section></aside>
    </main>
    <footer class="bottom" aria-label="Timeline"><div id="timeline-resize" class="timeline-resize" role="separator" aria-label="Resize Timeline" aria-orientation="horizontal" tabindex="0"></div><button id="collapse-timeline" class="collapse-timeline">⌄ Timeline</button><div id="timeline-panel"></div></footer><section class="export export-popover" id="export-panel" role="dialog" aria-labelledby="export-heading" hidden></section>`;
  const q=s=>mustQuery(root,s), leftSidebarEl=q('#left'); let toastTimer, zoom=1, projectLoaded=false, homeOpen=false, problemsOpener=null, designTool='select';
  /**
   * How long a message an author was told deliberately holds the status line.
   *
   * The validation pass runs 150 ms after every edit and ends by writing
   * `Project ready • N layers` — so every warning a panel had just posted
   * ("this motion is now edited by hand", "the clip is off", "copy added in
   * front") was wiped a sixth of a second later, before anyone could read it.
   * The same span the toast is visible for, because that is how long the
   * message was meant to last.
   */
  const STATUS_HOLD = 2600;
  let statusHeldUntil = 0;
  q('.skip-link').addEventListener('click',event=>{event.preventDefault();q('#canvas').focus();});
  root.addEventListener('toggle',(event)=>{
    const id=event.target?.dataset?.setupSection;
    if(!id)return;
    preferences.openSections={...preferences.openSections,[id]:event.target.open};
    savePreferences();
  },true);
  const helpDialog=q('#shortcut-help');helpDialog.addEventListener('click',event=>{if(event.target.closest('[data-close-help]')||event.target===helpDialog)closeShortcutHelp();});helpDialog.addEventListener('cancel',event=>{event.preventDefault();closeShortcutHelp();});
  let helpOpener=null;const openShortcutHelp=(markup)=>{helpOpener=document.activeElement;helpDialog.innerHTML=`<div class="card-title"><h3 id="shortcut-heading">Keyboard shortcuts</h3><button class="icon" data-close-help aria-label="Close shortcuts">×</button></div><p class="small">Character shortcuts stay quiet while you type. Esc always closes the topmost surface first.</p>${markup}`;helpDialog.setAttribute('aria-labelledby','shortcut-heading');if(!helpDialog.open)helpDialog.showModal();helpDialog.querySelector('[data-close-help]')?.focus();};
  const closeShortcutHelp=()=>{if(helpDialog.open)helpDialog.close();helpDialog.removeAttribute('aria-labelledby');helpOpener?.focus?.();helpOpener=null;};
  const showHome=({focus='heading'}={})=>{homeOpen=true;q('[data-home]').hidden=false;q('.home-back').hidden=!projectLoaded;requestAnimationFrame(()=>q(focus==='new'?'[data-home-action=character]':'#home-heading').focus());};
  const closeHome=()=>{if(!projectLoaded)return false;homeOpen=false;q('[data-home]').hidden=true;q('.workspace-tab.active')?.focus();return true;};
  q('#home-button').onclick=()=>showHome();q('[data-home-action=back]').onclick=closeHome;
  const savePreferences=()=>writeUiPreferences(preferences);
  /**
   * Go to a mode (UIR-01): the route, the panels it mounts, the question it
   * belongs to.
   *
   * The mode is the only thing stored. Its surface and its workspace are
   * *derived*, because two places holding the same truth is how they come
   * apart, and because `data-workspace` is read by a hundred selectors that
   * must keep meaning "which panels are mounted" rather than "which of the four
   * questions is open".
   */
  function applyMode(input, emit=true) {
    const mode=normalizeMode(input,null); if(!mode)return;
    const surface=modeToSurface(mode), workspace=modeToWorkspace(mode), changed=preferences.mode!==mode;
    preferences.mode=mode; preferences.workspace=surface;
    root.dataset.mode=mode; root.dataset.workspace=surface; root.dataset.stage=workspace||'global';
    qAll('.workspace-tab').forEach(button=>{const on=button.dataset.mode===mode;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));});
    qAll('.stage-tab').forEach(button=>{const on=button.dataset.stage===workspace;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));});
    // Each workspace remembers the screen last open in it, so leaving Rig for
    // Preview and coming back lands on Controls rather than on Assign. Session
    // only: persisting it would widen the saved shape for something nobody
    // misses after a reload.
    if(workspace)lastModeInWorkspace.set(workspace,mode);
    // A column keeps its scroll position across a change of screen, so the
    // panel for the new one used to open scrolled halfway down whatever the
    // last one had been reading. Each screen starts at the top of its column.
    if(changed){leftSidebarEl.scrollTop=0;const right=root.querySelector('.panel-right');if(right)right.scrollTop=0;}
    renderHint(mode);
    // Rig, Animate and Behavior each put several screens over one column, so
    // the column's heading names the screen rather than the column.
    const columnHeading=root.querySelector(`[data-column-heading="${surface}"]`);
    if(columnHeading)columnHeading.textContent=MODES[mode].aria||MODES[mode].label;
    // Two modes are a dock rather than a column: the Timeline is the detailed
    // editor of a motion, and the States editor a screen of Behavior. Arriving
    // on one opens it, because arriving on a screen whose subject is folded
    // shut is the failure the focus mechanism exists to prevent.
    if(MODES[mode].dock==='timeline'&&preferences.timelineCollapsed)collapse('timeline');
    if(MODES[mode].dock==='state-machine')root.querySelector('[data-author-editor]')?.setAttribute('open','');
    savePreferences(); if(emit)root.dispatchEvent(new CustomEvent('workspacechange',{detail:{workspace:surface,mode}})); }
  /** The one line of guidance for the screen that is open, until it is dismissed. */
  function renderHint(mode) {
    const host=q('[data-hint]'), text=HINTS[mode];
    if(!text||preferences.hintsDismissed[mode]){host.hidden=true;host.textContent='';return;}
    host.hidden=false; host.innerHTML=`<span>${text}</span><button aria-label="Dismiss this hint">×</button>`;
    host.querySelector('button').onclick=()=>{preferences.hintsDismissed[mode]=true;savePreferences();host.hidden=true;host.textContent='';};
  }
  const qAll=s=>[...root.querySelectorAll(s)];
  let taskNavigationHandler=name=>applyWorkspace(name);
  qAll('.workspace-tab').forEach(button=>button.onclick=()=>taskNavigationHandler({mode:button.dataset.mode}));q('#continue-rigging').onclick=()=>taskNavigationHandler({mode:'rig.assign'});
  // Every screen stays reachable from its own tab: a workspace is a shortcut
  // into a group, never a gate in front of one.
  qAll('.stage-tab').forEach(button=>button.onclick=()=>{const workspace=button.dataset.stage;taskNavigationHandler({mode:lastModeInWorkspace.get(workspace)||workspaceEntryMode(workspace,preferences.mode)});});
  /** "Timeline" told nobody what the button does; it names the two states now. */
  let puppetToggleHandler=null;
  const syncPuppetToggle=()=>{const button=q('[data-puppet-toggle]'),on=!preferences.puppetHidden;
    button.setAttribute('aria-pressed',String(on));button.classList.toggle('active',on);
    button.title=on?'Hide the handles on the mascot':'Show handles on the mascot: drag the face to pose it';};
  const syncTimelineToggle=()=>{const button=q('#collapse-timeline');const closed=preferences.timelineCollapsed;
    button.textContent=closed?'⌃ Edit key by key':'⌄ Hide timeline';
    button.setAttribute('aria-expanded',String(!closed));
    button.title=closed?'Open the Timeline to edit this animation key by key':'Hide the Timeline';};
  const collapse=(side)=>{const key=side==='left'?'leftCollapsed':side==='right'?'rightCollapsed':'timelineCollapsed';preferences[key]=!preferences[key];root.classList.toggle(`${side}-collapsed`,preferences[key]);if(side==='timeline'){syncTimelineToggle();root.dispatchEvent(new CustomEvent('timelinetoggle',{detail:{open:!preferences.timelineCollapsed}}));}savePreferences();};
  q('[data-puppet-toggle]').onclick=()=>{preferences.puppetHidden=!preferences.puppetHidden;syncPuppetToggle();savePreferences();puppetToggleHandler?.(!preferences.puppetHidden);};
  q('#collapse-left').onclick=()=>collapse('left');q('#collapse-right').onclick=()=>collapse('right');q('#collapse-timeline').onclick=()=>collapse('timeline');
  const resize=q('#timeline-resize');let resizing=null;const setTimelineHeight=value=>root.style.setProperty('--timeline-height',`${Math.max(120,Math.min(innerHeight*.68,value))}px`);resize.addEventListener('pointerdown',event=>{resizing={y:event.clientY,height:q('.bottom').getBoundingClientRect().height};resize.setPointerCapture(event.pointerId);});resize.addEventListener('pointermove',event=>{if(resizing)setTimelineHeight(resizing.height+resizing.y-event.clientY);});resize.addEventListener('pointerup',()=>{resizing=null;});resize.addEventListener('dblclick',()=>setTimelineHeight(210));
  // The separator is a focus stop, so it has to do something from the keyboard.
  resize.addEventListener('keydown',event=>{const height=q('.bottom').getBoundingClientRect().height;const step=event.shiftKey?60:20;if(event.key==='ArrowUp'){event.preventDefault();setTimelineHeight(height+step);}else if(event.key==='ArrowDown'){event.preventDefault();setTimelineHeight(height-step);}else if(event.key==='Home'){event.preventDefault();setTimelineHeight(210);}});
  syncTimelineToggle();
  syncPuppetToggle();
  root.classList.toggle('left-collapsed',preferences.leftCollapsed);root.classList.toggle('right-collapsed',preferences.rightCollapsed);root.classList.toggle('timeline-collapsed',preferences.timelineCollapsed);
  let canvasViewHandler=()=>1;
  q('.canvas-toolbar').onclick=(event)=>{const action=event.target.dataset.zoom;if(!action)return;zoom=canvasViewHandler(action);q('#zoom-value').textContent=`${Math.round(zoom*100)}%`;};
  const setZoomValue=(value)=>{zoom=Number(value)||1;q('#zoom-value').textContent=`${Math.round(zoom*100)}%`;};
  let designToolHandler=()=>{};q('.design-toolbar').onclick=(event)=>{const button=event.target.closest('[data-design-tool]');if(!button)return;qAll('[data-design-tool]').forEach(item=>item.classList.toggle('active',item===button));designToolHandler(button.dataset.designTool);};
  q('#focus-preview').onclick=()=>root.classList.add('focus-preview');q('#exit-focus').onclick=()=>root.classList.remove('focus-preview');
  // One reset, in the project bar, on every tab: the mascot is posed from the
  // canvas in Character, Artwork and Face Setup as much as it is from Preview,
  // so the way back to rest cannot live inside one task's panel (it used to be
  // `#preview-reset`, which only Preview ever showed).
  let resetMascotHandler=()=>{};
  q('#reset-mascot-top').onclick=()=>resetMascotHandler();
  applyMode(preferences.mode,false);
  const bindFile=(selector,handler)=>q(selector).addEventListener('change',e=>e.target.files?.[0]&&handler(e.target.files[0]));
  return {leftSidebarEl,canvasEl:q('#canvas'),inspectorEl:q('#inspector'),partBrowserEl:q('#part-browser'),partInspectorEl:q('#part-inspector'),handWorkshopEl:q('#hand-workshop'),rigEl:q('#rig-panel'),rigPartsEl:q('#rig-parts'),faceSetupEl:q('#face-setup-checklist'),faceMovementsEl:q('#face-movements'),gazePanelEl:q('#gaze-panel'),headPoseEl:q('#head-pose'),handSetupEl:q('#hand-setup'),warpPanelEl:q('#warp-panel'),holdingPanelEl:q('#holding-panel'),previewPanelEl:q('#preview-panel'),expressionsEl:q('#expressions-panel'),expressionInspectorEl:q('#expression-inspector'),motionsEl:q('#motion-panel'),automaticEl:q('#automatic-panel'),motionInspectorEl:q('#motion-inspector'),reactionsEl:q('#reactions-panel'),reactionInspectorEl:q('#reaction-inspector'),showTimeline(){if(preferences.timelineCollapsed){preferences.timelineCollapsed=false;root.classList.remove('timeline-collapsed');syncTimelineToggle();savePreferences();root.dispatchEvent(new CustomEvent('timelinetoggle',{detail:{open:true}}));}},
    /** Told when the Timeline footer opens or closes, so a panel offering to open it can follow. */
    onTimelineToggle(handler){root.addEventListener('timelinetoggle',event=>handler(event.detail.open));},previewEl:q('#timeline-panel'),exportEl:q('#export-panel'),
    /** The panels mounted right now. Every caller asking this means the composition. */
    getWorkspace:()=>preferences.workspace,
    /** The route open right now, and the way anything asks for another one. */
    getMode:()=>preferences.mode,setMode:applyMode,homeEl:q('[data-home]'),contextInspectorEl:q('#context-inspector'),bindTaskNavigation(handler){taskNavigationHandler=handler;},
    /** Whether the Timeline footer is open, so a panel can offer to open it only when it is not. */
    isTimelineOpen:()=>!preferences.timelineCollapsed,
    /** The zoom readout, for a zoom that did not come from the toolbar (wheel, fit). */
    setZoomValue,
    /**
     * Open the advanced States & behaviors editor inside the Motions column.
     *
     * It lives in a closed disclosure: every route that lands on it (Advanced
     * tools, Problems, the palette, "Behaviors (advanced)") goes through here,
     * so a deep link never ends on a panel folded out of sight.
     */
    openAuthorEditor(){return this.focusPanel('state-editor');},bindDesignTools(handler){designToolHandler=handler;},setDesignTool(tool){designTool=tool;root.dataset.canvasTool=tool;qAll('[data-design-tool]').forEach(item=>{const active=item.dataset.designTool===tool;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});},/** Which vector tool is chosen, so Escape can leave it. */getDesignTool(){return designTool;},onWorkspaceChange(handler){root.addEventListener('workspacechange',event=>handler(event.detail.workspace));},setWorkspace:(surface)=>applyMode(surfaceToMode(surface)),bindCanvasView(handler){canvasViewHandler=handler;},bindAddFeature(handler){q('.feature-list').addEventListener('click',event=>event.target.dataset.addFeature&&handler(event.target.dataset.addFeature,event.target));},
    setProjectActionsEnabled(enabled){q('#save-project-top').disabled=!enabled;q('#export-top').disabled=!enabled;q('#reset-mascot-top').disabled=!enabled;},/**
     * `routine: true` marks a status nobody asked for -- the readiness pass
     * saying the project is fine. Those wait rather than overwrite: a routine
     * *note* never replaces a message still on screen, while a routine warning
     * always lands, because a problem outranks a note about what just happened.
     */
    setStatus(message,tone='info',{routine=false}={}){const el=q('#toast');const now=Date.now();if(routine&&tone==='info'&&now<statusHeldUntil)return;el.textContent=message;el.dataset.tone=tone;el.classList.add('visible');clearTimeout(toastTimer);statusHeldUntil=routine?0:now+STATUS_HOLD;if(tone==='info')toastTimer=setTimeout(()=>el.classList.remove('visible'),STATUS_HOLD);},exitFocus(){root.classList.remove('focus-preview');},isFocus(){return root.classList.contains('focus-preview');},
    showProblems(readiness,issues,onFix,onGo){problemsOpener=document.activeElement&&document.activeElement!==document.body?document.activeElement:q('#validate');const panel=q('#problems-panel'),symbol={ready:'✓',warning:'⚠',error:'●',todo:'○',optional:'·'},actionable=issues.filter(issue=>issue.severity!=='info');panel.dataset.projectCheckStatus=actionable.some(x=>x.severity==='error')?'error':actionable.length?'warning':'ready';panel.hidden=false;panel.innerHTML=`<div class="card-title"><h3>Project check</h3><button class="icon" data-close-problems aria-label="Close Problems">×</button></div><ol class="readiness-rows readiness-list" aria-label="Project readiness">${readiness.order.map(id=>{const item=readiness[id];return `<li data-readiness-section="${id}" data-readiness-status="${item.status}"><span class="readiness-symbol" aria-hidden="true">${symbol[item.status]||'○'}</span><span class="readiness-copy"><b>${esc(item.label)}</b><small>${esc(item.summary)}</small></span>${item.route?`<button type="button" class="secondary" data-readiness-go="${id}" aria-label="Go to ${esc(item.label)}">${item.action?'Fix':'Go'}</button>`:''}</li>`;}).join('')}</ol>${actionable.length?`<p>${actionable.length} thing${actionable.length===1?'':'s'} need attention</p>${actionable.map((issue,index)=>`<article class="manager-card" data-diagnostic-id="${esc(issue.id)}"><b>${issue.severity==='error'?'● Error':'⚠ Warning'}</b><p>${esc(issue.message)}</p><small>${esc(describeFix(issue).explanation)}</small>${issue.fix?`<button data-fix-problem="${index}">Fix</button>`:''}</article>`).join('')}`:'<p class="ready-message">✓ No problems found</p>'}`;panel.onclick=event=>{if(event.target.dataset.closeProblems!==undefined)panel.hidden=true;if(event.target.dataset.fixProblem!==undefined){panel.hidden=true;onFix?.(actionable[Number(event.target.dataset.fixProblem)]);}if(event.target.dataset.readinessGo){panel.hidden=true;onGo?.(readiness[event.target.dataset.readinessGo]);}};panel.querySelector('[data-close-problems]')?.focus();},
    confirmProjectReplacement(){const dialog=q('#unsaved-dialog'),returnFocus=document.activeElement;return new Promise(resolve=>{dialog.addEventListener('close',()=>{returnFocus?.focus?.();resolve(dialog.returnValue||'cancel');},{once:true});dialog.showModal();dialog.querySelector('[value=cancel]').focus();});},
    /** Handles on the mascot: on unless the author turned them off. */
    bindPuppetToggle(handler){puppetToggleHandler=handler;},
    isPuppetVisible(){return !preferences.puppetHidden;},
    /** Section headings say what is inside without opening it. */
    setSetupSections(sections){
      const mark={ready:'✓',partial:'●',empty:'○'};
      for(const section of sections){
        const host=root.querySelector(`[data-setup-section="${section.id}"]`);
        if(!host)continue;
        host.dataset.setupState=section.state;
        host.querySelector('[data-setup-mark]').textContent=mark[section.state]||'○';
        host.querySelector('[data-setup-summary]').textContent=section.summary;
        host.querySelector('summary').title=`${section.label}: ${section.summary}`;
      }
    },
    /** Scroll a panel into view and mark it, so a deep link lands on the control. */
    focusPanel(id){
      const panel=root.querySelector(`#${id}`);
      if(!panel)return false;
      // Since Rig became four screens, a panel can be revealed on a screen that
      // does not show it. Every route into a panel goes through here -- Advanced
      // tools, Problems, the palette, a validation Fix -- so the screen it lives
      // on is opened here rather than in each of them.
      if(PANEL_MODES[id])applyMode(PANEL_MODES[id]);
      // Open first, scroll second: a panel inside a collapsed section has no
      // position to scroll to yet.
      for(let node=panel;node&&node!==root;node=node.parentElement)if(node.tagName==='DETAILS'&&!node.open)node.open=true;
      panel.scrollIntoView({block:'start',behavior:'smooth'});
      root.querySelectorAll('[data-panel-focused]').forEach(node=>node.removeAttribute('data-panel-focused'));
      panel.setAttribute('data-panel-focused','true');
      const heading=panel.querySelector('h3,h4');
      if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
      setTimeout(()=>panel.removeAttribute('data-panel-focused'),2400);
      return true;
    },
    setReadiness(readiness,issues){const symbol={ready:'✓',warning:'⚠',error:'●',todo:'○',optional:''};qAll('.workspace-tab').forEach(button=>{const key=MODE_READINESS[button.dataset.mode];if(!key)return;const section=readiness[key],status=section?.status;if(!status)return;const base=MODES[button.dataset.mode].label,mark=symbol[status]??'';
      button.textContent=mark?`${base} ${mark}`:base;button.dataset.readiness=status;
      // A glyph on its own says nothing: give the badge a name and a reason.
      const meaning={ready:'ready',warning:'needs attention',error:'has a problem',todo:'not started',optional:'optional'}[status]||'';
      const detail=section?.summary?` — ${section.summary}`:'';
      button.title=meaning?`${base}: ${meaning}${detail}`:base;
      button.setAttribute('aria-label',meaning?`${base}, ${meaning}${detail}`:base);});
      // A workspace is as ready as its least ready screen. The badge lives on
      // the workspace button and never inside a screen tab: the loop above rewrites
      // a tab's whole textContent on every validation pass, so any child put
      // there would be destroyed on the next keystroke.
      qAll('.stage-tab').forEach(button=>{const stage=WORKSPACES[button.dataset.stage];
        const statuses=workspaceModes(button.dataset.stage).map(mode=>readiness[MODE_READINESS[mode]]?.status).filter(Boolean);
        const status=statuses.length?statuses.reduce((worst,item)=>worstStatus(worst,item)):null;
        if(status)button.dataset.readiness=status;else delete button.dataset.readiness;
        const meaning={ready:'ready',warning:'needs attention',error:'has a problem',todo:'not started',optional:'optional'}[status]||'';
        // The accessible name stays "<Workspace> workspace" so it can never
        // collide with a screen tab, a rig part or an action button of the same
        // word -- and "Rig" and "Animate" are all three at once.
        button.setAttribute('aria-label',meaning?`${stage.label} workspace, ${meaning}`:`${stage.label} workspace`);
        button.title=meaning?`${stage.label}: ${meaning} — ${stage.hint}`:stage.hint;});
      const errors=issues.filter(issue=>issue.severity==='error').length,warnings=issues.filter(issue=>issue.severity==='warning').length;q('#export-top').textContent=errors?`Export blocked · ${errors}`:warnings?`Export · ${warnings} warning${warnings===1?'':'s'}`:'Export';},
    // Each card says what it is, whether the mascot already has it, and -- when
    // it cannot be added -- why (`selectProjectShell`). A card that offers
    // "+ Add" here can always be pressed.
    renderProjectUi({loaded,features,core=[],featureCompatible=false}){q('.core-list').hidden=!loaded;q('#core-status').innerHTML=core.map(item=>`<p>${item.ready?'✓':'●'} ${item.label}</p>`).join('');q('.feature-list').classList.toggle('incompatible',!featureCompatible);for(const [id,state] of Object.entries(features)){const button=root.querySelector(`[data-add-feature="${id}"]`);const note=root.querySelector(`[data-feature-reason="${id}"]`);const installed=Boolean(state?.installed),available=Boolean(state?.available),reason=state?.reason||'';if(button){button.textContent=installed?'✓ Added':'+ Add';button.disabled=installed||!available;button.title=reason;}
      if(note){note.textContent=reason;note.hidden=!reason;}}},bindResetMascot(h){resetMascotHandler=h;},setReturnToExport(visible){q('#return-export').hidden=!visible;},setReturnToCharacter(visible){q('#return-character').hidden=!visible;},bindReturnToCharacter(h){q('#return-character').onclick=h;},advancedEl:q('#advanced-panel'),colourPickerEl:q('#colour-picker'),openShortcutHelp,closeShortcutHelp,isShortcutHelpOpen:()=>helpDialog.open,closeProjectMenu(){const menu=q('details.file-menu');if(!menu.open)return false;menu.open=false;return true;},isProblemsOpen:()=>!q('#problems-panel').hidden,closeProblems(){const panel=q('#problems-panel');if(panel.hidden)return false;panel.hidden=true;(problemsOpener||q('#validate'))?.focus?.();problemsOpener=null;return true;},bindDrawer(toggle,close){q('#drawer-toggle').onclick=toggle;q('#drawer-scrim').onclick=close;},setDrawerState(open){q('#drawer-toggle').setAttribute('aria-expanded',String(Boolean(open)));q('#drawer-scrim').hidden=!open;},bindSheet(h){qAll('[data-sheet-detent]').forEach(button=>{button.onclick=()=>h(button.dataset.sheetDetent);});},setSheetSubject(text){q('[data-sheet-subject]').textContent=text;},publishPanelEl:q('#publish-panel'),paletteEl:q('#command-palette'),capabilityEl:q('#capability-panel'),bindCapabilities(h){q('#capability-toggle').onclick=h;},bindSearch(h){q('#search-button').onclick=h;q('#menu-search').onclick=()=>{q('details.file-menu').open=false;h();};},bindOpenAdvanced(h){q('[data-open-advanced]').onclick=()=>{q('details.file-menu').open=false;h();};},openProjectMenuAdvanced(){const menu=q('details.file-menu');menu.open=true;const inner=menu.querySelector('.menu-popover > details');if(inner)inner.open=true;q('#plugin-path')?.focus();},bindReturnToExport(h){q('#return-export').onclick=h;},setPluginStatus(m){q('#plugin-status').textContent=m;},setDirty(dirty,autosaved=false){q('#save-state').textContent=dirty?(autosaved?'Autosaved locally':'Unsaved changes'):'✓ Saved project';q('#save-state').classList.toggle('dirty',dirty);},setRecoveryState(recovery){renderHomeRecovery(q('.home-recovery'),recovery);q('#recover-autosave').hidden=recovery.status!=='available';},bindRecoverAutosave(h){q('#recover-autosave').onclick=h;q('[data-home]').addEventListener('click',event=>event.target.dataset.homeAction==='recover'&&h(event.target));},bindDiscardRecovery(h){q('[data-home]').addEventListener('click',event=>event.target.dataset.homeAction==='discard-recovery'&&h(event.target));},showHome,closeHome,isHomeOpen:()=>homeOpen,setProjectLoaded(loaded){projectLoaded=Boolean(loaded);root.classList.toggle('has-project',loaded);q('.home-back').hidden=!projectLoaded;},setUndoRedoState({canUndo,canRedo}){q('#undo').disabled=!canUndo;q('#redo').disabled=!canRedo;q('#menu-undo').disabled=!canUndo;q('#menu-redo').disabled=!canRedo;},bindPluginToggles(h){q('#plugin-path').addEventListener('change',e=>h('path',e.target.checked));},bindLoadSvg(h){bindFile('#svg-file',h);bindFile('#artwork-svg-file',h);},bindLoadSample(h){qAll('[data-template-id]').forEach(b=>b.onclick=()=>h(b.dataset.templateId,b));q('#empty-basic').onclick=()=>h('basic');},bindNewCharacter(h){q('[data-home-action=character]').onclick=()=>h();},bindGenerateFace(h){const card=q('[data-face-builder]'),fields=q('#face-builder');card.onclick=()=>{const open=fields.hidden;fields.hidden=!open;card.setAttribute('aria-expanded',String(open));if(open)q('#face-head').focus();};q('#generate-face').onclick=()=>h({head:q('#face-head').value,eyes:q('#face-eyes').value,mouth:q('#face-mouth').value});},bindSaveProject(h){q('#save-project-top').onclick=h;},bindLoadProject(h){bindFile('#project-file',h);},bindLoadRig(h){bindFile('#rig-file',h);},bindLoadFacePack(h){bindFile('#face-pack-file',h);},bindUndoRedo(u,r){q('#undo').onclick=u;q('#redo').onclick=r;q('#menu-undo').onclick=()=>{q('details.file-menu').open=false;u();};q('#menu-redo').onclick=()=>{q('details.file-menu').open=false;r();};},bindNew(h){q('#new-project').onclick=()=>{q('details.file-menu').open=false;h();};},bindValidate(h){q('#validate').onclick=h;q('#menu-problems').onclick=()=>{q('details.file-menu').open=false;h();};},bindPreview(h){root.addEventListener('workspacechange',e=>{if(e.detail.workspace==='preview')h(true);else h(false);});},bindExport(h){q('#export-top').onclick=h;}};
}
