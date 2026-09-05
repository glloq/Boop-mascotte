import { describeFix } from '../core/validation/issue-guidance.js';
import { gateMarkup } from './mobile-capabilities.js';
import { buildFaceBuilderSection, buildPluginSection, buildPresetSection } from './sidebar-sections.js';
import { mustQuery } from './must-query.js';
import { readUiPreferences, writeUiPreferences, WORKSPACES } from './workspace-state.js';
import { SETUP_SECTIONS } from '../core/validation/setup-sections.js';
import { homeSurfaceMarkup, renderHomeRecovery } from './home-surface.js';
import { STAGES, STAGE_ORDER, TASKS, stageEntryTask, taskToStage, workspaceToTask } from './task-router.js';
import { worstStatus } from '../core/validation/task-readiness.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const HINTS = {
  create: 'Start simple, then add one expressive feature at a time.', rig: 'Assign each face part by clicking its artwork on the canvas, then configure movements.',
  expressions: 'Name a face (Happy, Sad…), shape it with your movements, then test its intensity.',
  reactions: 'When something happens (a click), show an expression and a motion, then come back. Test it here, then in Preview.',
  animate: 'Add a motion preset, test it, then adjust it in the Inspector. The Timeline below edits any animation key by key.', preview: 'Test states and animations without modifying your project.'
};

/**
 * Face Setup as collapsible sections. Stacked flat the panel was three screens
 * tall and Head pose and Hands sat below the fold, so nobody found them.
 */
function setupSectionsMarkup(openSections = {}) {
  const extra = {
    'all-parts': '<p class="small" aria-label="Part status legend">✓ Ready &nbsp; ● Needs setup &nbsp; ○ Optional &nbsp; ⚠ Invalid</p>'
  };
  return SETUP_SECTIONS.map((section) => {
    const open = openSections[section.id] ?? section.open;
    return `<details class="setup-section" data-setup-section="${section.id}"${open ? ' open' : ''}>
      <summary><span class="setup-mark" data-setup-mark aria-hidden="true">○</span><span class="setup-title">${section.label}</span><span class="setup-summary" data-setup-summary></span></summary>
      ${extra[section.id] || ''}<div id="${section.panel}"></div>
    </details>`;
  }).join('');
}

export function createAppShell(root) {
  const preferences = readUiPreferences();
  /** The step last open in each stage, for the session (VNX-06). */
  const lastTaskInStage = new Map();
  root.innerHTML=`<a class="skip-link" href="#canvas">Skip to canvas</a><header class="topbar" aria-label="Project bar"><button id="drawer-toggle" class="drawer-toggle" aria-label="Tasks and tools" aria-expanded="false" aria-controls="left">☰</button><button id="home-button" class="brand-home" aria-label="Home">BOOP <span>Mascot Studio</span></button>
    <nav class="stage-tabs" aria-label="Editor stage">${STAGE_ORDER.map(id=>`<button class="stage-tab" data-stage="${id}" aria-label="${STAGES[id].label} stage" title="${STAGES[id].hint}">${STAGES[id].label}</button>`).join('')}</nav>
    <nav class="workspace-tabs" aria-label="Editor workspace">${WORKSPACES.map(name=>`<button class="workspace-tab" data-workspace="${name}" data-task="${workspaceToTask(name)}" data-stage="${taskToStage(workspaceToTask(name))}">${TASKS[workspaceToTask(name)].label}</button>`).join('')}</nav>
    <nav class="project-actions"><button id="capability-toggle" class="capability-toggle" aria-label="What works on this device" title="What works on this device">📱</button><button id="search-button" aria-label="Search actions and items (Ctrl+K)" title="Search (Ctrl+K)">🔍</button><button id="undo" aria-label="Undo">↶</button><button id="redo" aria-label="Redo">↷</button><button id="validate" title="Check project readiness">Problems</button><button id="save-project-top" aria-label="Save Project" title="Keeps your editable Boop project">Save Project</button><button id="export-top" data-action="open-export" title="Creates files for using the mascot outside the editor">Export</button><details class="file-menu"><summary aria-label="More project actions">•••</summary><div class="menu-popover"><button id="new-project">New Project</button><button id="recover-autosave" hidden>Recover local draft</button><label class="button secondary">Open Project <small>Complete editable project</small><input hidden type="file" id="project-file" accept=".json"></label><label class="button secondary">Import SVG <small>Artwork only</small><input hidden type="file" id="svg-file" accept=".svg"></label><details><summary>Advanced</summary><button type="button" class="secondary" data-open-advanced>Advanced tools…</button>${buildPluginSection()}</details></div></details></nav><span id="save-state" class="status-pill">✓ Saved</span></header>
    <div id="guide-bar" class="guide-bar" aria-label="Guided steps" hidden></div>
    ${homeSurfaceMarkup()}<div id="toast" class="toast" role="status" aria-live="polite"></div><button id="exit-focus" class="exit-focus">Exit Preview</button><button id="return-export" class="return-export" hidden>↩ Back to Export</button><section id="problems-panel" class="problems-popover" hidden></section><section id="advanced-panel" class="problems-popover advanced-popover" role="dialog" hidden></section><dialog id="command-palette" class="command-palette" aria-label="Command palette"></dialog><dialog id="shortcut-help" class="shortcut-help"></dialog><section id="capability-panel" class="problems-popover capability-popover" role="dialog" hidden></section><dialog id="unsaved-dialog" aria-labelledby="unsaved-heading"><form method="dialog"><h2 id="unsaved-heading">Unsaved changes</h2><p>Your current project has changes that have not been saved.</p><div class="dialog-actions"><button value="cancel">Cancel</button><button value="discard">Discard</button><button value="save" class="primary">Save Project</button></div></form></dialog>
    <div id="drawer-scrim" class="drawer-scrim" hidden></div>
    <main class="workspace" aria-label="Workspace">
      <aside class="panel" id="left" aria-label="Tasks and tools"><button class="collapse-panel" id="collapse-left" aria-label="Collapse left panel">‹</button>
        <section class="structure-tools"><h2>Structure</h2><p class="small">Every piece of the mascot. Pick one here to work on it, in any step of Create.</p><div id="layers-panel"></div></section>
        <section class="create-tools"><h2>Artwork</h2><div class="workspace-hint" data-hint="create"></div><label class="button secondary artwork-import">Import / Replace SVG<input hidden type="file" id="artwork-svg-file" accept=".svg"></label>${gateMarkup('artwork', 'mobile')}<div id="artboard-panel"></div><details class="artwork-create"><summary>Add / Create artwork</summary><div class="template-cards"><button id="empty-basic"><b>◯ Start with the Mascot Face</b><small>A complete cartoon face, rigged and turning in 2.5D. Strip out what you do not need.</small></button></div><div class="core-list"><h3>Ready</h3><div id="core-status"></div><button id="continue-rigging">Continue to Face Setup</button></div><div class="feature-list"><h3>Add expression</h3><article class="feature-card"><div><b>Eyebrows</b><small>Curious and angry expressions</small></div><button data-add-feature="eyebrows">+ Add</button></article><article class="feature-card"><div><b>Eyelids</b><small>More natural blinking and eye expressions</small></div><button data-add-feature="eyelids">+ Add</button></article><article class="feature-card"><div><b>Hands</b><small>Two floating hands with four digits, rigged with Fist, Point and Peace</small></div><button data-add-feature="hands">+ Add</button></article><p class="feature-incompatible small" hidden>Preset artwork is only added to compatible starter faces. Use Face Setup to configure artwork in an imported SVG.</p></div><details class="more-examples"><summary>More templates and tools</summary>${buildFaceBuilderSection()}${buildPresetSection()}</details></details></section>
        <section class="rig-tools"><h2>Face Setup</h2><div class="workspace-hint" data-hint="rig"></div>${gateMarkup('face-setup', 'mobile')}${setupSectionsMarkup(preferences.openSections)}</section>
        <section class="expressions-tools"><h2>Expressions</h2><div class="workspace-hint" data-hint="expressions"></div><div id="expressions-panel"></div></section>
        <section class="animate-tools"><h2>Animate</h2><div class="workspace-hint" data-hint="animate"></div><div id="motion-panel"></div>${gateMarkup('timeline', 'mobile')}${gateMarkup('state-machine', 'mobile')}</section>
        <section class="reactions-tools"><h2>Reactions</h2><div class="workspace-hint" data-hint="reactions"></div><div id="reactions-panel"></div><div id="automatic-panel"></div></section>
        <div id="state-editor"></div>
      </aside>
      <section id="canvas" tabindex="-1"><div class="design-toolbar" role="toolbar" aria-label="Vector tools"><button data-design-tool="select" class="active" title="Select (V)">↖ <span>Select</span></button><button data-design-tool="node" title="Edit path nodes (N)">◇ <span>Node</span></button><button data-design-tool="pen" title="Pen (P)">✒ <span>Pen</span></button><button data-design-tool="rect" title="Rectangle (R)">□ <span>Rectangle</span></button><button data-design-tool="ellipse" title="Ellipse (O)">○ <span>Ellipse</span></button><button data-design-tool="hand" title="Pan (H)">✋ <span>Hand</span></button></div><div class="canvas-toolbar" aria-label="Canvas view"><button data-puppet-toggle aria-pressed="true" title="Handles on the mascot: drag the face to pose it">✋ Handles</button><button data-zoom="fit">Fit</button><button data-zoom="reset" id="zoom-value">100%</button><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="in" aria-label="Zoom in">+</button></div></section>
      <aside class="panel-right" aria-label="Inspector and preview"><button class="collapse-panel" id="collapse-right" aria-label="Collapse right panel">›</button><div class="sheet-header" id="sheet-header"><span class="sheet-subject" data-sheet-subject>Inspector</span><div class="sheet-detents"><button type="button" data-sheet-detent="half" aria-label="Sheet half height">▴</button><button type="button" data-sheet-detent="full" aria-label="Sheet full height">▲</button><button type="button" data-sheet-detent="collapsed" aria-label="Collapse sheet">▾</button></div></div><section id="context-inspector" aria-labelledby="context-inspector-heading"><h2 id="context-inspector-heading" data-context-inspector-heading tabindex="-1">Inspector</h2><p class="small" data-context-inspector-empty></p><div id="rig-panel" data-inspector-adapter="semantic"></div><div data-inspector-adapter="artwork">${gateMarkup('bindings', 'mobile')}<div id="inspector"></div></div><div data-inspector-adapter="expression" hidden><div id="expression-inspector"></div></div><div data-inspector-adapter="motion" hidden><div id="motion-inspector"></div></div><div data-inspector-adapter="reaction" hidden><div id="reaction-inspector"></div></div></section><section class="preview-actions"><div class="workspace-hint" data-hint="preview"></div><div class="card-title"><h2>Preview</h2><div class="action-row"><button id="preview-reset" class="secondary" title="Clear live controls, playback and preview-only changes">Reset mascot</button><button id="focus-preview">Focus</button></div></div><p class="small">Test the mascot here. Nothing you do in Preview changes the project.</p><div id="preview-panel"></div></section><section class="publish-tools"><div id="publish-panel"></div></section></aside>
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
  const showHome=({focus='heading'}={})=>{homeOpen=true;q('[data-home]').hidden=false;q('.home-back').hidden=!projectLoaded;requestAnimationFrame(()=>q(focus==='new'?'[data-template-id=basic]':'#home-heading').focus());};
  const closeHome=()=>{if(!projectLoaded)return false;homeOpen=false;q('[data-home]').hidden=true;q('.workspace-tab.active')?.focus();return true;};
  q('#home-button').onclick=()=>showHome();q('[data-home-action=back]').onclick=closeHome;
  const savePreferences=()=>writeUiPreferences(preferences);
  function applyWorkspace(name, emit=true) { if(!WORKSPACES.includes(name))return; preferences.workspace=name; root.dataset.workspace=name; qAll('.workspace-tab').forEach(button=>{button.classList.toggle('active',button.dataset.workspace===name);button.setAttribute('aria-pressed',button.dataset.workspace===name);});
    // The stage is *derived* from the workspace and never stored (VNX-06,
    // docs/VNEXT_ROADMAP.md). Two places holding the same truth is how they
    // come apart, and it also keeps the saved preferences shape untouched.
    const stage=taskToStage(workspaceToTask(name)); root.dataset.stage=stage; lastTaskInStage.set(stage,workspaceToTask(name));
    qAll('.stage-tab').forEach(button=>{const on=button.dataset.stage===stage;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));});
    savePreferences(); if(emit)root.dispatchEvent(new CustomEvent('workspacechange',{detail:{workspace:name}})); }
  const qAll=s=>[...root.querySelectorAll(s)];
  let taskNavigationHandler=name=>applyWorkspace(name);
  qAll('.workspace-tab').forEach(button=>button.onclick=()=>taskNavigationHandler(button.dataset.workspace));q('#continue-rigging').onclick=()=>taskNavigationHandler('rig');
  // Every task stays reachable from its own tab: a stage is a shortcut into a
  // group, never a gate in front of one.
  // Each stage remembers the step last open in it, so leaving Face Setup for
  // Preview and coming back lands on Face Setup rather than on Artwork. The
  // memory is session-only and lives here: persisting it would widen the saved
  // preferences shape for something nobody misses after a reload.
  qAll('.stage-tab').forEach(button=>button.onclick=()=>{const stage=button.dataset.stage;taskNavigationHandler({stage,task:lastTaskInStage.get(stage)||stageEntryTask(stage,workspaceToTask(preferences.workspace))});});
  /** "Timeline" told nobody what the button does; it names the two states now. */
  let puppetToggleHandler=null;
  const syncPuppetToggle=()=>{const button=q('[data-puppet-toggle]'),on=!preferences.puppetHidden;
    button.setAttribute('aria-pressed',String(on));button.classList.toggle('active',on);
    button.title=on?'Hide the handles on the mascot':'Show handles on the mascot: drag the face to pose it';};
  const syncTimelineToggle=()=>{const button=q('#collapse-timeline');const closed=preferences.timelineCollapsed;
    button.textContent=closed?'⌃ Edit key by key':'⌄ Hide timeline';
    button.setAttribute('aria-expanded',String(!closed));
    button.title=closed?'Open the Timeline to edit this animation key by key':'Hide the Timeline';};
  const collapse=(side)=>{const key=side==='left'?'leftCollapsed':side==='right'?'rightCollapsed':'timelineCollapsed';preferences[key]=!preferences[key];root.classList.toggle(`${side}-collapsed`,preferences[key]);if(side==='timeline')syncTimelineToggle();savePreferences();};
  q('[data-puppet-toggle]').onclick=()=>{preferences.puppetHidden=!preferences.puppetHidden;syncPuppetToggle();savePreferences();puppetToggleHandler?.(!preferences.puppetHidden);};
  q('#collapse-left').onclick=()=>collapse('left');q('#collapse-right').onclick=()=>collapse('right');q('#collapse-timeline').onclick=()=>collapse('timeline');
  const resize=q('#timeline-resize');let resizing=null;const setTimelineHeight=value=>root.style.setProperty('--timeline-height',`${Math.max(120,Math.min(innerHeight*.68,value))}px`);resize.addEventListener('pointerdown',event=>{resizing={y:event.clientY,height:q('.bottom').getBoundingClientRect().height};resize.setPointerCapture(event.pointerId);});resize.addEventListener('pointermove',event=>{if(resizing)setTimelineHeight(resizing.height+resizing.y-event.clientY);});resize.addEventListener('pointerup',()=>{resizing=null;});resize.addEventListener('dblclick',()=>setTimelineHeight(210));
  syncTimelineToggle();
  syncPuppetToggle();
  root.classList.toggle('left-collapsed',preferences.leftCollapsed);root.classList.toggle('right-collapsed',preferences.rightCollapsed);root.classList.toggle('timeline-collapsed',preferences.timelineCollapsed);
  qAll('[data-hint]').forEach(el=>{const name=el.dataset.hint;if(preferences.hintsDismissed[name])return;el.innerHTML=`<span>${HINTS[name]}</span><button aria-label="Dismiss ${name} hint">×</button>`;el.querySelector('button').onclick=()=>{preferences.hintsDismissed[name]=true;savePreferences();el.remove();};});
  let canvasViewHandler=()=>1;
  q('.canvas-toolbar').onclick=(event)=>{const action=event.target.dataset.zoom;if(!action)return;zoom=canvasViewHandler(action);q('#zoom-value').textContent=`${Math.round(zoom*100)}%`;};
  let designToolHandler=()=>{};q('.design-toolbar').onclick=(event)=>{const button=event.target.closest('[data-design-tool]');if(!button)return;qAll('[data-design-tool]').forEach(item=>item.classList.toggle('active',item===button));designToolHandler(button.dataset.designTool);};
  q('#focus-preview').onclick=()=>root.classList.add('focus-preview');q('#exit-focus').onclick=()=>root.classList.remove('focus-preview');
  let previewResetHandler=()=>{};
  q('#preview-reset').onclick=()=>previewResetHandler();
  applyWorkspace(preferences.workspace,false);
  const bindFile=(selector,handler)=>q(selector).addEventListener('change',e=>e.target.files?.[0]&&handler(e.target.files[0]));
  return {leftSidebarEl,canvasEl:q('#canvas'),inspectorEl:q('#inspector'),rigEl:q('#rig-panel'),rigPartsEl:q('#rig-parts'),guideBarEl:q('#guide-bar'),faceSetupEl:q('#face-setup-checklist'),faceMovementsEl:q('#face-movements'),headPoseEl:q('#head-pose'),handSetupEl:q('#hand-setup'),warpPanelEl:q('#warp-panel'),previewPanelEl:q('#preview-panel'),expressionsEl:q('#expressions-panel'),expressionInspectorEl:q('#expression-inspector'),motionsEl:q('#motion-panel'),automaticEl:q('#automatic-panel'),motionInspectorEl:q('#motion-inspector'),reactionsEl:q('#reactions-panel'),reactionInspectorEl:q('#reaction-inspector'),showTimeline(){if(preferences.timelineCollapsed){preferences.timelineCollapsed=false;root.classList.remove('timeline-collapsed');syncTimelineToggle();savePreferences();}},previewEl:q('#timeline-panel'),exportEl:q('#export-panel'),
    getWorkspace:()=>preferences.workspace,homeEl:q('[data-home]'),contextInspectorEl:q('#context-inspector'),bindTaskNavigation(handler){taskNavigationHandler=handler;},bindDesignTools(handler){designToolHandler=handler;},setDesignTool(tool){designTool=tool;root.dataset.canvasTool=tool;qAll('[data-design-tool]').forEach(item=>{const active=item.dataset.designTool===tool;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});},/** Which vector tool is chosen, so Escape can leave it. */getDesignTool(){return designTool;},onWorkspaceChange(handler){root.addEventListener('workspacechange',event=>handler(event.detail.workspace));},setWorkspace:applyWorkspace,bindCanvasView(handler){canvasViewHandler=handler;},bindAddFeature(handler){q('.feature-list').addEventListener('click',event=>event.target.dataset.addFeature&&handler(event.target.dataset.addFeature,event.target));},
    setProjectActionsEnabled(enabled){q('#save-project-top').disabled=!enabled;q('#export-top').disabled=!enabled;},/**
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
    isGuideDismissed(){return Boolean(preferences.guideDismissed);},
    setGuideDismissed(value){preferences.guideDismissed=Boolean(value);savePreferences();},
    /** Scroll a panel into view and mark it, so a deep link lands on the control. */
    focusPanel(id){
      const panel=root.querySelector(`#${id}`);
      if(!panel)return false;
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
    setReadiness(readiness,issues){const symbol={ready:'✓',warning:'⚠',error:'●',todo:'○',optional:''};qAll('.workspace-tab').forEach(button=>{const status=button.dataset.workspace==='create'?readiness.artwork.status:button.dataset.workspace==='rig'?readiness.faceSetupBadge:button.dataset.workspace==='expressions'?readiness.expressions.status:button.dataset.workspace==='animate'?readiness.animate.status:button.dataset.workspace==='reactions'?readiness.reactions.status:null;if(status===null)return;const task=workspaceToTask(button.dataset.workspace),base=TASKS[task].label,mark=symbol[status]??'';
      const section=button.dataset.workspace==='rig'?readiness.faceSetup:readiness[task==='artwork'?'artwork':task];
      button.textContent=mark?`${base} ${mark}`:base;button.dataset.readiness=status;
      // A glyph on its own says nothing: give the badge a name and a reason.
      const meaning={ready:'ready',warning:'needs attention',error:'has a problem',todo:'not started',optional:'optional'}[status]||'';
      const detail=section?.summary?` — ${section.summary}`:'';
      button.title=meaning?`${base}: ${meaning}${detail}`:base;
      button.setAttribute('aria-label',meaning?`${base}, ${meaning}${detail}`:base);});
      // A stage is as ready as its least ready step. The badge lives on the
      // stage button and never inside a workspace tab: the loop above rewrites
      // a tab's whole textContent on every validation pass, so any child put
      // there would be destroyed on the next keystroke.
      qAll('.stage-tab').forEach(button=>{const stage=STAGES[button.dataset.stage];
        const statuses=stage.tasks.map(task=>task==='artwork'?readiness.artwork?.status:task==='face-setup'?readiness.faceSetupBadge:readiness[task]?.status).filter(Boolean);
        const status=statuses.length?statuses.reduce((worst,item)=>worstStatus(worst,item)):null;
        if(status)button.dataset.readiness=status;else delete button.dataset.readiness;
        const meaning={ready:'ready',warning:'needs attention',error:'has a problem',todo:'not started',optional:'optional'}[status]||'';
        // The accessible name stays "<Stage> stage" so it can never collide
        // with a task tab, a rig part or an action button of the same word.
        button.setAttribute('aria-label',meaning?`${stage.label} stage, ${meaning}`:`${stage.label} stage`);
        button.title=meaning?`${stage.label}: ${meaning} — ${stage.hint}`:stage.hint;});
      const errors=issues.filter(issue=>issue.severity==='error').length,warnings=issues.filter(issue=>issue.severity==='warning').length;q('#export-top').textContent=errors?`Export blocked · ${errors}`:warnings?`Export · ${warnings} warning${warnings===1?'':'s'}`:'Export';},
    renderProjectUi({loaded,features,core=[],featureCompatible=false}){q('.core-list').hidden=!loaded;q('#core-status').innerHTML=core.map(item=>`<p>${item.ready?'✓':'●'} ${item.label}</p>`).join('');q('.feature-list').classList.toggle('incompatible',!featureCompatible);q('.feature-incompatible').hidden=featureCompatible;for(const [id,installed] of Object.entries(features)){const button=q(`[data-add-feature="${id}"]`);if(button){button.textContent=installed?'✓ Added':'+ Add';
      // Hands are drawn from nothing rather than fitted onto a starter face,
      // so they are offered for imported artwork too.
      button.disabled=installed||(!featureCompatible&&id!=='hands');}}},bindPreviewReset(h){previewResetHandler=h;},setReturnToExport(visible){q('#return-export').hidden=!visible;},advancedEl:q('#advanced-panel'),openShortcutHelp,closeShortcutHelp,isShortcutHelpOpen:()=>helpDialog.open,closeProjectMenu(){const menu=q('details.file-menu');if(!menu.open)return false;menu.open=false;return true;},isProblemsOpen:()=>!q('#problems-panel').hidden,closeProblems(){const panel=q('#problems-panel');if(panel.hidden)return false;panel.hidden=true;(problemsOpener||q('#validate'))?.focus?.();problemsOpener=null;return true;},bindDrawer(toggle,close){q('#drawer-toggle').onclick=toggle;q('#drawer-scrim').onclick=close;},setDrawerState(open){q('#drawer-toggle').setAttribute('aria-expanded',String(Boolean(open)));q('#drawer-scrim').hidden=!open;},bindSheet(h){qAll('[data-sheet-detent]').forEach(button=>{button.onclick=()=>h(button.dataset.sheetDetent);});},setSheetSubject(text){q('[data-sheet-subject]').textContent=text;},publishPanelEl:q('#publish-panel'),paletteEl:q('#command-palette'),capabilityEl:q('#capability-panel'),bindCapabilities(h){q('#capability-toggle').onclick=h;},bindSearch(h){q('#search-button').onclick=h;},bindOpenAdvanced(h){q('[data-open-advanced]').onclick=()=>{q('details.file-menu').open=false;h();};},openProjectMenuAdvanced(){const menu=q('details.file-menu');menu.open=true;const inner=menu.querySelector('.menu-popover > details');if(inner)inner.open=true;q('#plugin-path')?.focus();},bindReturnToExport(h){q('#return-export').onclick=h;},setPluginStatus(m){q('#plugin-status').textContent=m;},setDirty(dirty,autosaved=false){q('#save-state').textContent=dirty?(autosaved?'Autosaved locally':'Unsaved changes'):'✓ Saved project';q('#save-state').classList.toggle('dirty',dirty);},setRecoveryState(recovery){renderHomeRecovery(q('.home-recovery'),recovery);q('#recover-autosave').hidden=recovery.status!=='available';},bindRecoverAutosave(h){q('#recover-autosave').onclick=h;q('[data-home]').addEventListener('click',event=>event.target.dataset.homeAction==='recover'&&h(event.target));},bindDiscardRecovery(h){q('[data-home]').addEventListener('click',event=>event.target.dataset.homeAction==='discard-recovery'&&h(event.target));},showHome,closeHome,isHomeOpen:()=>homeOpen,setProjectLoaded(loaded){projectLoaded=Boolean(loaded);root.classList.toggle('has-project',loaded);q('.home-back').hidden=!projectLoaded;},setUndoRedoState({canUndo,canRedo}){q('#undo').disabled=!canUndo;q('#redo').disabled=!canRedo;},bindPluginToggles(h){q('#plugin-path').addEventListener('change',e=>h('path',e.target.checked));},bindLoadSvg(h){bindFile('#svg-file',h);bindFile('#home-svg-file',h);bindFile('#artwork-svg-file',h);},bindLoadSample(h){qAll('[data-template-id]').forEach(b=>b.onclick=()=>h(b.dataset.templateId,b));q('#empty-basic').onclick=()=>h('basic');},bindGenerateFace(h){const go=()=>h({head:q('#face-head').value,eyes:q('#face-eyes').value,mouth:q('#face-mouth').value});q('#generate-face').onclick=go;},bindApplyPreset(h){q('#apply-preset').onclick=()=>h(q('#preset-select').value);},bindSaveProject(h){q('#save-project-top').onclick=h;},bindLoadProject(h){bindFile('#project-file',h);bindFile('#home-project-file',h);},bindUndoRedo(u,r){q('#undo').onclick=u;q('#redo').onclick=r;},bindNew(h){q('#new-project').onclick=h;},bindValidate(h){q('#validate').onclick=h;},bindPreview(h){root.addEventListener('workspacechange',e=>{if(e.detail.workspace==='preview')h(true);else h(false);});},bindExport(h){q('#export-top').onclick=h;}};
}
