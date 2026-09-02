import { deriveFaceRoleChecklist, faceRoleEntry, findFaceRoleUsage, listAssignableElements, nextMissingFaceRole } from './face-roles.js';
import { confidenceLabel, suggestFaceRoles } from './face-role-detection.js';
import { createSemanticRigCommands } from './semantic-rig-commands.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const ICONS = { assigned: '✓', missing: '○', invalid: '⚠', picking: '●' };
const FOCUS_KEYS = ['faceRoleAssign', 'faceRoleAccept', 'faceRoleClear', 'faceRoleSelect', 'faceRoleNext', 'faceAcceptAll', 'faceCancelPick', 'faceConfigure', 'faceRoleManual'];

/**
 * Face Setup checklist (left collection). It owns only transient pick state;
 * every assignment is one atomic semantic command, and selection changes go
 * through EditorSession. Canvas picking is shared with the Face Part inspector
 * through `canvas.beginRolePick`, which cancels any previous pick tool.
 * Detection suggestions are recomputed on render and never author anything
 * until the user accepts them.
 */
export function createFaceSetupPanel(host, store, history, canvas, editorContext, { openPart = () => {}, geometry = () => null, highlight = () => {} } = {}) {
  const commands = createSemanticRigCommands(store, history);
  let picking = null, notice = null, highlighted = null;
  const doc = () => store.getDocument();
  const pickLabel = (entry) => `${entry.label.toLowerCase()}${entry.side ? ` (${entry.side} side of the canvas)` : ''}`;
  const detect = () => suggestFaceRoles(doc(), { geometry });
  const setHighlight = (id) => { if (highlighted === (id || null)) return; highlighted = id || null; highlight(highlighted); };

  function startPicking(id, keepNotice = false) {
    const entry = faceRoleEntry(id);
    if (!entry) return;
    canvas.beginRolePick({
      label: pickLabel(entry),
      cancel: () => { picking = null; setHighlight(null); render(); },
      pick: (elementId) => assign(entry, elementId, { advance: true })
    });
    picking = entry.id;
    if (!keepNotice) notice = null;
    setHighlight(detect().suggestions[entry.id]?.elementId || null);
    render();
  }

  function assign(entry, elementId, { advance = false, viaSuggestion = false } = {}) {
    const state = doc();
    if (!state.elements?.[elementId]) { notice = { tone: 'warn', text: 'That is not editable artwork. Choose another element.' }; render(); return false; }
    const usage = findFaceRoleUsage(state, elementId, entry.id);
    if (usage) { notice = { tone: 'warn', text: `This artwork is already the ${usage.label}. Choose another element, or clear ${usage.label} first.` }; render(); return false; }
    let partId;
    try { partId = commands.assignFaceRole(entry.part, entry.role, elementId); }
    catch (error) { notice = { tone: 'warn', text: error.message }; render(); return false; }
    editorContext.update({ selectedId: elementId, activeSemanticPartId: partId, activeControl: null });
    picking = null;
    setHighlight(null);
    canvas.cancelRigTool(false);
    const next = advance ? nextMissingFaceRole(doc(), entry.id) : null;
    if (next) {
      notice = { tone: 'success', text: `✓ ${entry.label} assigned. Now click the ${pickLabel(next)}.` };
      startPicking(next.id, true);
    } else {
      const complete = deriveFaceRoleChecklist(doc()).complete;
      notice = { tone: 'success', text: complete ? '✓ All face parts assigned. Configure movements next.' : `✓ ${entry.label} assigned${viaSuggestion ? ' from the suggestion' : ''}.` };
      render();
    }
    return true;
  }

  function acceptAll() {
    const { suggestions, acceptable } = detect();
    const entries = acceptable.map((role) => { const entry = faceRoleEntry(role); return { type: entry.part, role: entry.role, elementId: suggestions[role].elementId }; });
    if (!entries.length) return;
    let parts;
    try { parts = commands.assignFaceRoles(entries); }
    catch (error) { notice = { tone: 'warn', text: error.message }; render(); return; }
    editorContext.update({ selectedId: entries[0].elementId, activeSemanticPartId: parts[0], activeControl: null });
    const complete = deriveFaceRoleChecklist(doc()).complete;
    notice = { tone: 'success', text: `✓ ${entries.length} face part${entries.length === 1 ? '' : 's'} assigned from suggestions. Check them on the canvas${complete ? ', then configure movements' : ''}.` };
    render();
  }

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    const { faceRoleAssign, faceRoleAccept, faceRoleClear, faceRoleSelect, faceRoleNext, faceAcceptAll, faceCancelPick, faceConfigure } = button.dataset;
    if (faceRoleAssign) { startPicking(faceRoleAssign); return; }
    if (faceRoleAccept) {
      const suggestion = detect().suggestions[faceRoleAccept];
      if (suggestion) { if (picking) { picking = null; canvas.cancelRigTool(false); } assign(faceRoleEntry(faceRoleAccept), suggestion.elementId, { viaSuggestion: true }); }
      return;
    }
    if (faceAcceptAll !== undefined) { if (picking) { picking = null; canvas.cancelRigTool(false); } acceptAll(); return; }
    if (faceRoleNext !== undefined) { const next = nextMissingFaceRole(doc()); if (next) startPicking(next.id); return; }
    if (faceCancelPick !== undefined) { canvas.cancelRigTool(); return; }
    if (faceRoleClear) {
      const item = itemFor(faceRoleClear);
      if (item?.partId) { commands.assignRole(item.partId, item.role, null); notice = { tone: 'info', text: `${item.label} cleared.` }; render(); }
      return;
    }
    if (faceRoleSelect) {
      const item = itemFor(faceRoleSelect);
      if (item?.partId) { openPart(item.partId, 'setup'); if (item.elementId && doc().elements?.[item.elementId]) editorContext.update({ selectedId: item.elementId }); }
      else startPicking(faceRoleSelect);
      return;
    }
    if (faceConfigure !== undefined) {
      const items = deriveFaceRoleChecklist(doc()).items;
      const target = items.find((item) => item.part === 'gaze' && item.partId) || items.find((item) => item.partId);
      if (target) { openPart(target.partId, 'controls'); host.ownerDocument.getElementById('face-movements')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    }
  });
  host.addEventListener('change', (event) => {
    const id = event.target.dataset.faceRoleManual;
    if (!id || !event.target.value || picking !== id) return;
    assign(faceRoleEntry(id), event.target.value, { advance: true });
  });
  // Hovering a suggested row previews its candidate on the Canvas (transient only).
  host.addEventListener('mouseover', (event) => {
    const row = event.target.closest('[data-face-role]');
    const candidate = row?.dataset.faceSuggestion;
    if (candidate && !picking) setHighlight(candidate);
  });
  host.addEventListener('mouseout', (event) => {
    const row = event.target.closest('[data-face-role]');
    if (row && !picking && !row.contains(event.relatedTarget)) setHighlight(null);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picking) { event.preventDefault(); canvas.cancelRigTool(); }
  });

  const itemFor = (id) => deriveFaceRoleChecklist(doc()).items.find((item) => item.id === id) || null;

  function focusKey(node) {
    for (const key of FOCUS_KEYS) if (node?.dataset?.[key] !== undefined) return [key, node.dataset[key]];
    return null;
  }
  const attributeName = (key) => `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

  function render() {
    const state = doc(), checklist = deriveFaceRoleChecklist(state), active = editorContext.get().activeSemanticPartId;
    const focused = host.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    host.dataset.faceSetupReady = 'true';
    host.dataset.faceSetupAssigned = String(checklist.assigned);
    host.dataset.faceSetupPicking = picking || '';
    if (!state.svgMarkup) { host.innerHTML = '<p class="small">Add artwork first: import an SVG or start from a template.</p>'; host.dataset.faceSetupSuggested = '0'; return; }
    const { suggestions, acceptable } = detect();
    host.dataset.faceSetupSuggested = String(acceptable.length);
    const rows = checklist.items.map((item) => {
      const status = picking === item.id ? 'picking' : item.status;
      const suggestion = item.status === 'assigned' ? null : suggestions[item.id];
      const accepting = suggestion && acceptable.includes(item.id);
      const detail = status === 'picking' ? (suggestion ? `Click it on the canvas… (highlighted: ${suggestion.elementName})` : 'Click it on the canvas…')
        : item.status === 'assigned' ? item.elementName
        : item.status === 'invalid' ? 'Artwork missing — assign it again'
        : suggestion ? (accepting ? `Suggested: ${suggestion.elementName} · ${confidenceLabel(suggestion.confidence)}` : `Maybe ${suggestion.elementName}? Click it on the canvas to confirm.`)
        : item.hint;
      const verb = item.status === 'missing' ? 'Assign' : 'Replace';
      return `<li class="face-role-row${item.partId && item.partId === active ? ' active' : ''}" data-face-role="${item.id}" data-face-role-status="${status}"${suggestion ? ` data-face-suggestion="${esc(suggestion.elementId)}" data-face-suggestion-confidence="${suggestion.confidence}"` : ''}><span class="face-role-status" aria-hidden="true">${ICONS[status]}</span><button type="button" class="face-role-label" data-face-role-select="${item.id}"><b>${esc(item.label)}</b><small>${esc(detail)}</small></button><span class="face-role-actions">${accepting ? `<button type="button" data-face-role-accept="${item.id}" aria-label="Accept ${esc(suggestion.elementName)} as ${esc(item.label)}" title="${esc(suggestion.reasons.join(' · '))}">Accept</button>` : ''}<button type="button" class="${verb === 'Assign' && !accepting ? '' : 'secondary'}" data-face-role-assign="${item.id}" aria-label="${verb} ${esc(item.label)}" title="${verb} by clicking the canvas">${accepting ? 'Pick' : verb}</button>${item.status !== 'missing' ? `<button type="button" class="secondary icon" data-face-role-clear="${item.id}" aria-label="Clear ${esc(item.label)}">×</button>` : ''}</span></li>`;
    }).join('');
    const pickingEntry = picking ? faceRoleEntry(picking) : null;
    const instruction = pickingEntry ? `<div class="face-pick-notice" data-tone="info"><span>Click the <b>${esc(pickLabel(pickingEntry))}</b> on the canvas.</span><button type="button" class="secondary" data-face-cancel-pick>Cancel (Esc)</button></div><label class="face-manual">Or choose from layers<select data-face-role-manual="${picking}"><option value="">Select artwork…</option>${listAssignableElements(state).map((element) => `<option value="${esc(element.id)}">${esc(element.name)}</option>`).join('')}</select></label>` : '';
    const next = checklist.items.find((item) => item.id === checklist.next);
    const actions = picking ? '' : [
      acceptable.length ? `<button type="button" class="face-next" data-face-accept-all>Accept ${acceptable.length} suggestion${acceptable.length === 1 ? '' : 's'}</button>` : '',
      checklist.complete ? '<button type="button" class="face-next" data-face-configure>Configure movements</button>' : `<button type="button" class="face-next${acceptable.length ? ' secondary' : ''}" data-face-role-next>Assign next: ${esc(next.label)}</button>`
    ].join('');
    host.innerHTML = `<div class="face-progress"><h3 id="face-checklist-heading">Face parts</h3><span class="status-pill" data-face-progress>${checklist.assigned} / ${checklist.total} assigned</span></div><div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}">${esc(notice.text)}</p>` : ''}</div>${instruction}<ol class="face-checklist" aria-label="Face parts checklist">${rows}</ol>${actions}`;
    if (focused) host.querySelector(`[${attributeName(focused[0])}="${CSS.escape(focused[1])}"]`)?.focus();
  }

  return {
    render,
    cancelTransient() { setHighlight(null); if (!picking) return; picking = null; notice = null; canvas.cancelRigTool(false); render(); },
    snapshot() { return { ...structuredClone(deriveFaceRoleChecklist(doc())), picking, ...structuredClone(detect()) }; }
  };
}
