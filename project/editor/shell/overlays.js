/**
 * Everything that sits *over* the editor rather than inside it: Home, the
 * status line, the Problems popover, the dialogs, the drawer and the sheet.
 *
 * They share one property that makes them a module rather than a workspace's
 * business: none of them belongs to a screen. Every one is reachable from all
 * of them, and Escape closes the topmost first.
 */
import { describeFix } from '../core/validation/issue-guidance.js';
import { homeSurfaceMarkup, renderHomeRecovery } from '../ui/home-surface.js';
import { esc } from '../ui/escape-html.js';

export const overlaysMarkup = () => `${homeSurfaceMarkup()}<div id="toast" class="toast" role="status" aria-live="polite"></div><button id="exit-focus" class="exit-focus">Exit Preview</button><button id="return-export" class="return-export" hidden>↩ Back to Export</button><section id="problems-panel" class="problems-popover" hidden></section><section id="advanced-panel" class="problems-popover advanced-popover" role="dialog" hidden></section><dialog id="command-palette" class="command-palette" aria-label="Command palette"></dialog><dialog id="shortcut-help" class="shortcut-help"></dialog><dialog id="colour-picker" class="colour-picker" aria-label="Choose a colour"></dialog><section id="capability-panel" class="problems-popover capability-popover" role="dialog" hidden></section><dialog id="unsaved-dialog" aria-labelledby="unsaved-heading"><form method="dialog"><h2 id="unsaved-heading">Unsaved changes</h2><p>Your current project has changes that have not been saved.</p><div class="dialog-actions"><button value="cancel">Cancel</button><button value="discard">Discard</button><button value="save" class="primary">Save Project</button></div></form></dialog>
<div id="drawer-scrim" class="drawer-scrim" hidden></div>`;

/** The export sheet, which opens over the canvas rather than beside it. */
export const exportPanelMarkup = () => `<section class="export export-popover" id="export-panel" role="dialog" aria-labelledby="export-heading" hidden></section>`;

export function wireOverlays({ root, q, qAll }) {
  let toastTimer, statusHeldUntil = 0, problemsOpener = null, helpOpener = null;
  let projectLoaded = false, homeOpen = false;
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

  const helpDialog = q('#shortcut-help');
  const closeShortcutHelp = () => { if (helpDialog.open) helpDialog.close(); helpDialog.removeAttribute('aria-labelledby'); helpOpener?.focus?.(); helpOpener = null; };
  const openShortcutHelp = (markup) => {
    helpOpener = document.activeElement;
    helpDialog.innerHTML = `<div class="card-title"><h3 id="shortcut-heading">Keyboard shortcuts</h3><button class="icon" data-close-help aria-label="Close shortcuts">×</button></div><p class="small">Character shortcuts stay quiet while you type. Esc always closes the topmost surface first.</p>${markup}`;
    helpDialog.setAttribute('aria-labelledby', 'shortcut-heading');
    if (!helpDialog.open) helpDialog.showModal();
    helpDialog.querySelector('[data-close-help]')?.focus();
  };
  helpDialog.addEventListener('click', (event) => { if (event.target.closest('[data-close-help]') || event.target === helpDialog) closeShortcutHelp(); });
  helpDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeShortcutHelp(); });

  const showHome = ({ focus = 'heading' } = {}) => {
    homeOpen = true;
    q('[data-home]').hidden = false;
    q('.home-back').hidden = !projectLoaded;
    requestAnimationFrame(() => q(focus === 'new' ? '[data-home-action=character]' : '#home-heading').focus());
  };
  const closeHome = () => {
    if (!projectLoaded) return false;
    homeOpen = false; q('[data-home]').hidden = true;
    q('.workspace-tab.active')?.focus();
    return true;
  };
  q('#home-button').onclick = () => showHome();
  q('[data-home-action=back]').onclick = closeHome;
  q('#focus-preview').onclick = () => root.classList.add('focus-preview');
  q('#exit-focus').onclick = () => root.classList.remove('focus-preview');

  return {
    homeEl: q('[data-home]'),
    advancedEl: q('#advanced-panel'),
    colourPickerEl: q('#colour-picker'),
    paletteEl: q('#command-palette'),
    capabilityEl: q('#capability-panel'),
    exportEl: q('#export-panel'),
    showHome, closeHome, isHomeOpen: () => homeOpen,
    setProjectLoaded(loaded) { projectLoaded = Boolean(loaded); root.classList.toggle('has-project', loaded); q('.home-back').hidden = !projectLoaded; },
    openShortcutHelp, closeShortcutHelp, isShortcutHelpOpen: () => helpDialog.open,
    exitFocus() { root.classList.remove('focus-preview'); },
    isFocus() { return root.classList.contains('focus-preview'); },
    setStatus(message,tone='info',{routine=false}={}){const el=q('#toast');const now=Date.now();if(routine&&tone==='info'&&now<statusHeldUntil)return;el.textContent=message;el.dataset.tone=tone;el.classList.add('visible');clearTimeout(toastTimer);statusHeldUntil=routine?0:now+STATUS_HOLD;if(tone==='info')toastTimer=setTimeout(()=>el.classList.remove('visible'),STATUS_HOLD);},exitFocus(){root.classList.remove('focus-preview');},isFocus(){return root.classList.contains('focus-preview');},
    showProblems(readiness,issues,onFix,onGo){problemsOpener=document.activeElement&&document.activeElement!==document.body?document.activeElement:q('#validate');const panel=q('#problems-panel'),symbol={ready:'✓',warning:'⚠',error:'●',todo:'○',optional:'·'},actionable=issues.filter(issue=>issue.severity!=='info');panel.dataset.projectCheckStatus=actionable.some(x=>x.severity==='error')?'error':actionable.length?'warning':'ready';panel.hidden=false;panel.innerHTML=`<div class="card-title"><h3>Project check</h3><button class="icon" data-close-problems aria-label="Close Problems">×</button></div><ol class="readiness-rows readiness-list" aria-label="Project readiness">${readiness.order.map(id=>{const item=readiness[id];return `<li data-readiness-section="${id}" data-readiness-status="${item.status}"><span class="readiness-symbol" aria-hidden="true">${symbol[item.status]||'○'}</span><span class="readiness-copy"><b>${esc(item.label)}</b><small>${esc(item.summary)}</small></span>${item.route?`<button type="button" class="secondary" data-readiness-go="${id}" aria-label="Go to ${esc(item.label)}">${item.action?'Fix':'Go'}</button>`:''}</li>`;}).join('')}</ol>${actionable.length?`<p>${actionable.length} thing${actionable.length===1?'':'s'} need attention</p>${actionable.map((issue,index)=>`<article class="manager-card" data-diagnostic-id="${esc(issue.id)}"><b>${issue.severity==='error'?'● Error':'⚠ Warning'}</b><p>${esc(issue.message)}</p><small>${esc(describeFix(issue).explanation)}</small>${issue.fix?`<button data-fix-problem="${index}">Fix</button>`:''}</article>`).join('')}`:'<p class="ready-message">✓ No problems found</p>'}`;panel.onclick=event=>{if(event.target.dataset.closeProblems!==undefined)panel.hidden=true;if(event.target.dataset.fixProblem!==undefined){panel.hidden=true;onFix?.(actionable[Number(event.target.dataset.fixProblem)]);}if(event.target.dataset.readinessGo){panel.hidden=true;onGo?.(readiness[event.target.dataset.readinessGo]);}};panel.querySelector('[data-close-problems]')?.focus();},
    isProblemsOpen: () => !q('#problems-panel').hidden,
    closeProblems(){const panel=q('#problems-panel');if(panel.hidden)return false;panel.hidden=true;(problemsOpener||q('#validate'))?.focus?.();problemsOpener=null;return true;},
    confirmProjectReplacement(){const dialog=q('#unsaved-dialog'),returnFocus=document.activeElement;return new Promise(resolve=>{dialog.addEventListener('close',()=>{returnFocus?.focus?.();resolve(dialog.returnValue||'cancel');},{once:true});dialog.showModal();dialog.querySelector('[value=cancel]').focus();});},
    setReturnToExport(visible) { q('#return-export').hidden = !visible; },
    bindReturnToExport(handler) { q('#return-export').onclick = handler; },
    bindDrawer(toggle, close) { q('#drawer-toggle').onclick = toggle; q('#drawer-scrim').onclick = close; },
    setDrawerState(open) { q('#drawer-toggle').setAttribute('aria-expanded', String(Boolean(open))); q('#drawer-scrim').hidden = !open; },
    bindSheet(handler) { qAll('[data-sheet-detent]').forEach((button) => { button.onclick = () => handler(button.dataset.sheetDetent); }); },
    setSheetSubject(text) { q('[data-sheet-subject]').textContent = text; },
    setRecoveryState(recovery) { renderHomeRecovery(q('.home-recovery'), recovery); q('#recover-autosave').hidden = recovery.status !== 'available'; },
    bindRecoverAutosave(handler) { q('#recover-autosave').onclick = handler; q('[data-home]').addEventListener('click', (event) => event.target.dataset.homeAction === 'recover' && handler(event.target)); },
    bindDiscardRecovery(handler) { q('[data-home]').addEventListener('click', (event) => event.target.dataset.homeAction === 'discard-recovery' && handler(event.target)); },
    bindLoadSample(handler) { qAll('[data-template-id]').forEach((button) => { button.onclick = () => handler(button.dataset.templateId, button); }); q('#empty-basic').onclick = () => handler('basic'); },
    bindNewCharacter(handler) { q('[data-home-action=character]').onclick = () => handler(); },
    /** Preview is a place the canvas goes to, so this follows the composition rather than a button. */
    bindPreview(handler) { root.addEventListener('workspacechange', (event) => handler(event.detail.workspace === 'preview')); }
  };
}
