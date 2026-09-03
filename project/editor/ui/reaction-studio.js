import { createReactionCommands } from '../core/reactions/reaction-commands.js';
import { TIMING_PRESETS, TRIGGER_TYPES, findReaction, reactionIssues, timingPresetOf, triggerLabel } from '../core/reactions/reaction-model.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const TRIGGER_LABELS = { click: 'Clicked', hover: 'Hovered', timer: 'Every few seconds', custom: 'Custom event' };
const TIMING_LABELS = { fast: 'Fast', normal: 'Normal', slow: 'Slow', custom: 'Custom' };

/**
 * Reactions task: When → Do → Timing → After. Authored reactions live in
 * ProjectDocument.reactions (`reactions` domain, commands); the active
 * reaction is EditorSession state; Test fires the reaction in the preview
 * through the same sequencer the exported runtime uses.
 */
export function createReactionStudio({ listHost, inspectorHost, store, history, preview, editorContext, onStatus = () => {}, navigate = () => {} }) {
  const commands = createReactionCommands(store, history);
  let notice = null, draftName = '';
  const doc = () => store.getDocument();
  const activeId = () => editorContext.get().activeReactionId;
  const active = () => findReaction(doc(), activeId());
  const select = (id) => { editorContext.update({ activeReactionId: id || null }); render(); };
  const issuesFor = (id) => reactionIssues(doc()).find((item) => item.id === id) || null;
  const fail = (error) => { notice = { tone: 'warn', text: error.message }; render(); };

  function create(name) {
    const state = doc();
    try {
      const id = commands.create({ name, expressionId: state.expressions?.[0]?.id || null, timing: 'normal' });
      draftName = '';
      notice = { tone: 'success', text: `✓ ${name} created. It reacts to a click${state.expressions?.[0] ? ` with ${state.expressions[0].name}` : ''}; adjust it in the Inspector and press Test.` };
      select(id);
      onStatus(`Reaction "${name}" created.`);
    } catch (error) { fail(error); }
  }

  listHost.addEventListener('submit', (event) => { if (event.target.dataset.reactionForm === undefined) return; event.preventDefault(); create(listHost.querySelector('[data-reaction-name]')?.value.trim() || ''); });
  listHost.addEventListener('input', (event) => { if (event.target.dataset.reactionName !== undefined) draftName = event.target.value; });
  listHost.addEventListener('change', (event) => { const id = event.target.dataset.reactionToggle; if (!id) return; try { commands.update(id, { enabled: event.target.checked }); onStatus(`Reaction "${findReaction(doc(), id)?.name}" ${event.target.checked ? 'enabled' : 'disabled'}.`); } catch (error) { fail(error); } });
  listHost.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !listHost.contains(button)) return;
    if (button.dataset.reactionSelect) { select(button.dataset.reactionSelect === activeId() ? null : button.dataset.reactionSelect); return; }
    if (button.dataset.reactionGo) navigate({ task: button.dataset.reactionGo });
  });

  inspectorHost.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !inspectorHost.contains(button)) return;
    const reaction = active(); if (!reaction) return;
    const data = button.dataset;
    if (data.reactionTest !== undefined) { if (preview.fireReaction(reaction.id)) onStatus(`Testing "${reaction.name}"…`); else onStatus('This reaction is disabled.', 'warn'); return; }
    if (data.reactionGo) { navigate({ task: data.reactionGo }); return; }
    try {
      if (data.reactionDuplicate !== undefined) { const id = commands.duplicate(reaction.id); notice = null; select(id); onStatus(`Reaction "${findReaction(doc(), id)?.name}" duplicated.`); }
      if (data.reactionDelete !== undefined) { commands.remove(reaction.id); notice = { tone: 'success', text: `✓ ${reaction.name} deleted.` }; select(null); onStatus(`Reaction "${reaction.name}" deleted.`); }
    } catch (error) { fail(error); }
  });

  inspectorHost.addEventListener('input', (event) => {
    if (event.target.dataset.reactionWeight === undefined) return;
    const output = inspectorHost.querySelector('[data-reaction-weight-output]');
    if (output) output.value = `${Math.round(Number(event.target.value) * 100)}%`;
  });

  inspectorHost.addEventListener('change', (event) => {
    const reaction = active(); if (!reaction) return;
    const data = event.target.dataset, value = event.target.value;
    try {
      if (data.reactionRename !== undefined) { const name = value.trim(); if (name && name !== reaction.name) { commands.rename(reaction.id, name); onStatus(`Reaction renamed to "${name}".`); } else render(); return; }
      if (data.reactionEnabled !== undefined) { commands.update(reaction.id, { enabled: event.target.checked }); return; }
      if (data.reactionTrigger !== undefined) { const type = value; commands.update(reaction.id, { trigger: type === 'custom' ? { type, name: reaction.trigger.name || 'custom' } : type === 'timer' ? { type, interval: reaction.trigger.interval || 5 } : { type } }); return; }
      if (data.reactionEvent !== undefined) { commands.update(reaction.id, { trigger: { type: 'custom', name: value.trim() || 'custom' } }); return; }
      if (data.reactionInterval !== undefined) { commands.update(reaction.id, { trigger: { type: 'timer', interval: Number(value) } }); return; }
      if (data.reactionExpression !== undefined) { commands.update(reaction.id, { expressionId: value || null }); return; }
      if (data.reactionWeight !== undefined) { if (reaction.expression && reaction.expression.weight !== Number(value)) commands.update(reaction.id, { weight: Number(value) }); return; }
      if (data.reactionMotion !== undefined) { commands.update(reaction.id, { clipId: value || null }); return; }
      // Hand gestures (docs/HAND_GESTURES.md): one checkbox per available pose.
      if (data.reactionGesture !== undefined) {
        const [side, pose] = data.reactionGesture.split(':');
        const kept = (reaction.gestures || []).filter((item) => !(item.side === side && item.pose === pose));
        commands.update(reaction.id, { gestures: event.target.checked ? [...kept, { side, pose, weight: 1 }] : kept });
        return;
      }
      if (data.reactionTiming !== undefined) { if (value === 'custom') commands.update(reaction.id, { timing: { ...reaction.timing, attack: reaction.timing.attack + 0.05 } }); else if (value !== timingPresetOf(reaction.timing)) commands.update(reaction.id, { timing: value }); return; }
      if (data.reactionTimingField) { const timing = { ...reaction.timing, [data.reactionTimingField]: Number(value) }; if (timing[data.reactionTimingField] !== reaction.timing[data.reactionTimingField]) commands.update(reaction.id, { timing }); return; }
      if (data.reactionAfter !== undefined) { commands.update(reaction.id, { after: value }); return; }
      if (data.reactionPriority !== undefined) { commands.update(reaction.id, { priority: Number(value) }); return; }
      if (data.reactionInterrupt !== undefined) { commands.update(reaction.id, { interrupt: value }); }
    } catch (error) { fail(error); }
  });

  function renderList() {
    const state = doc(), list = state.reactions || [], current = activeId();
    listHost.dataset.reactionsReady = 'true';
    listHost.dataset.reactionsCount = String(list.length);
    if (!state.svgMarkup) { listHost.innerHTML = '<p class="small">Add artwork first: import an SVG or start from a template.</p>'; return; }
    const hasTargets = (state.expressions || []).length || (state.animationClips || []).length;
    const gate = hasTargets ? '' : '<p class="face-pick-notice" data-tone="warn"><span>A reaction shows an expression or a motion. Create one first.</span><button type="button" class="secondary" data-reaction-go="expressions">Expressions</button><button type="button" class="secondary" data-reaction-go="animate">Animate</button></p>';
    const issues = new Map(reactionIssues(state).map((item) => [item.id, item]));
    const describe = (item) => { const parts = [triggerLabel(item.trigger)]; const expression = item.expression ? (state.expressions || []).find((entry) => entry.id === item.expression.id) : null; const clip = item.motion ? (state.animationClips || []).find((entry) => entry.id === item.motion.clipId) : null; if (item.expression) parts.push(expression ? expression.name : `missing ${item.expression.id}`); if (item.motion) parts.push(clip ? clip.name : `missing ${item.motion.clipId}`); if (!item.expression && !item.motion) parts.push('does nothing yet'); if (!item.enabled) parts.push('off'); return parts.join(' → '); };
    listHost.innerHTML = `<div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}"><span>${esc(notice.text)}</span></p>` : ''}</div>${gate}<form class="expression-form" data-reaction-form><label>New reaction<input data-reaction-name aria-label="New reaction name" placeholder="Surprise, Wave hello…" value="${esc(draftName)}" ${hasTargets ? '' : 'disabled'}></label><button type="submit" ${hasTargets ? '' : 'disabled'}>Create</button></form>${list.length ? `<ol class="expression-list" aria-label="Reactions">${list.map((item) => `<li class="reaction-row"><button type="button" class="expression-item reaction-item" data-reaction-select="${esc(item.id)}" data-reaction-issue="${issues.has(item.id)}" aria-pressed="${item.id === current}"><span>${esc(item.name)}</span><small>${esc(describe(item))}</small></button><label class="check reaction-switch" title="Enabled"><input type="checkbox" data-reaction-toggle="${esc(item.id)}" aria-label="Enable ${esc(item.name)}" ${item.enabled ? 'checked' : ''}></label></li>`).join('')}</ol>` : '<p class="expression-empty">No reactions yet. A reaction is what the mascot does when something happens: when clicked, show Surprised with a Head Pop, then come back.</p>'}`;
  }

  /**
 * Hand gestures a reaction can raise. Only poses that exist are offered, so a
 * reaction can never name one the hand does not have.
 */
function gestureMarkup(state, reaction) {
  const rows = ['left', 'right'].flatMap((side) => (state.hands?.[side]?.poses || []).map((pose) => ({ side, pose })));
  if (!rows.length) return '<p class="small" data-reaction-gestures="none">Assign a hand with a pose in Face Setup to add a gesture here.</p>';
  const has = (side, id) => (reaction.gestures || []).some((item) => item.side === side && item.pose === id);
  return `<fieldset data-reaction-gestures="available"><legend>Hand gesture</legend>${rows.map(({ side, pose }) =>
    `<label class="small"><input type="checkbox" data-reaction-gesture="${esc(side)}:${esc(pose.id)}"${has(side, pose.id) ? ' checked' : ''}> ${side === 'left' ? 'Left' : 'Right'} · ${esc(pose.name || pose.id)}</label>`).join('')}</fieldset>`;
}

function renderInspector() {
    const reaction = active();
    if (!reaction) { inspectorHost.innerHTML = ''; delete inspectorHost.dataset.reactionId; return; }
    const state = doc(), issue = issuesFor(reaction.id), preset = timingPresetOf(reaction.timing);
    inspectorHost.dataset.reactionId = reaction.id;
    const expressionOptions = ['<option value="">None</option>', ...(state.expressions || []).map((item) => `<option value="${esc(item.id)}" ${reaction.expression?.id === item.id ? 'selected' : ''}>${esc(item.name)}</option>`), ...(issue?.missingExpression ? [`<option value="${esc(issue.missingExpression)}" selected>Missing: ${esc(issue.missingExpression)}</option>`] : [])].join('');
    const clipOptions = ['<option value="">None</option>', ...(state.animationClips || []).map((item) => `<option value="${esc(item.id)}" ${reaction.motion?.clipId === item.id ? 'selected' : ''}>${esc(item.name)}</option>`), ...(issue?.missingClip ? [`<option value="${esc(issue.missingClip)}" selected>Missing: ${esc(issue.missingClip)}</option>`] : [])].join('');
    const guidance = issue ? `<p class="face-pick-notice" data-tone="warn" data-reaction-guidance><span>${issue.missingExpression ? `The expression “${esc(issue.missingExpression)}” no longer exists. ` : ''}${issue.missingClip ? `The motion “${esc(issue.missingClip)}” no longer exists. ` : ''}${issue.empty ? 'This reaction does nothing yet: choose an expression or a motion.' : 'Choose another one below.'}</span>${issue.missingExpression || (issue.empty && !(state.expressions || []).length) ? '<button type="button" class="secondary" data-reaction-go="expressions">Expressions</button>' : ''}${issue.missingClip ? '<button type="button" class="secondary" data-reaction-go="animate">Animate</button>' : ''}</p>` : '';
    inspectorHost.innerHTML = `<label>Reaction name<input data-reaction-rename aria-label="Reaction name" value="${esc(reaction.name)}"></label>${guidance}
      <div class="reaction-fields">
        <fieldset><legend>When</legend><label>Trigger<select data-reaction-trigger aria-label="Trigger">${TRIGGER_TYPES.map((type) => `<option value="${type}" ${reaction.trigger.type === type ? 'selected' : ''}>${TRIGGER_LABELS[type]}</option>`).join('')}</select></label>${reaction.trigger.type === 'custom' ? `<label>Event name<input type="text" data-reaction-event aria-label="Custom event name" value="${esc(reaction.trigger.name)}"></label><p class="small">Fired by your page with <code>mascot.trigger('custom', { name: '${esc(reaction.trigger.name)}' })</code>.</p>` : ''}${reaction.trigger.type === 'timer' ? `<label>Every (seconds)<input type="number" data-reaction-interval aria-label="Timer interval in seconds" min=".1" step=".1" value="${reaction.trigger.interval}"></label>` : ''}${reaction.trigger.type === 'click' ? '<p class="small">In Preview, click the mascot. On your page, <code>mascot.bindEvents()</code> listens for clicks and hovers.</p>' : ''}</fieldset>
        <fieldset><legend>Do</legend><label>Expression<select data-reaction-expression aria-label="Reaction expression">${expressionOptions}</select></label>${reaction.expression ? `<label>Intensity <output data-reaction-weight-output>${Math.round(reaction.expression.weight * 100)}%</output><input type="range" data-reaction-weight aria-label="Reaction intensity" min="0" max="1" step=".05" value="${reaction.expression.weight}"></label>` : ''}<label>Motion<select data-reaction-motion aria-label="Reaction motion">${clipOptions}</select></label>${gestureMarkup(state, reaction)}</fieldset>
        <fieldset><legend>Timing</legend><label>Speed<select data-reaction-timing aria-label="Reaction timing">${Object.keys(TIMING_LABELS).map((name) => `<option value="${name}" ${preset === name ? 'selected' : ''}>${TIMING_LABELS[name]}${TIMING_PRESETS[name] ? ` · ${TIMING_PRESETS[name].attack + TIMING_PRESETS[name].hold + TIMING_PRESETS[name].release} s` : ''}</option>`).join('')}</select></label>${preset === 'custom' ? `<div class="reaction-timing-custom">${['attack', 'hold', 'release'].map((key) => `<label>${key[0].toUpperCase()}${key.slice(1)}<input type="number" data-reaction-timing-field="${key}" aria-label="${key} seconds" min="0" step=".05" value="${reaction.timing[key]}"></label>`).join('')}</div>` : `<p class="small">In ${reaction.timing.attack} s, hold ${reaction.timing.hold} s${reaction.motion ? ' (or as long as the motion)' : ''}, out ${reaction.timing.release} s.</p>`}</fieldset>
        <fieldset><legend>After</legend><label>Then<select data-reaction-after aria-label="After the reaction"><option value="return" ${reaction.after === 'return' ? 'selected' : ''}>Return to how it was</option><option value="stay" ${reaction.after === 'stay' ? 'selected' : ''}>Stay like this</option></select></label></fieldset>
        <details class="reaction-advanced"><summary>Advanced</summary><div class="reaction-fields"><label class="check"><input type="checkbox" data-reaction-enabled ${reaction.enabled ? 'checked' : ''}>Enabled</label><label>Priority<input type="number" data-reaction-priority aria-label="Priority" step="1" value="${reaction.priority}"></label><label>When another reaction is playing<select data-reaction-interrupt aria-label="Interrupt policy"><option value="replace" ${reaction.interrupt === 'replace' ? 'selected' : ''}>Replace it (if not higher priority)</option><option value="ignore" ${reaction.interrupt === 'ignore' ? 'selected' : ''}>Wait (do not fire)</option></select></label><p class="small">id <code>${esc(reaction.id)}</code> · <code>mascot.fire('${esc(reaction.id)}')</code></p></div></details>
      </div>
      <div class="expression-actions"><button type="button" data-reaction-test aria-label="Test ${esc(reaction.name)}">⚡ Test</button><button type="button" class="secondary" data-reaction-duplicate aria-label="Duplicate reaction">Duplicate</button><button type="button" class="danger secondary" data-reaction-delete aria-label="Delete reaction">Delete</button></div>`;
  }

  function render() { renderList(); renderInspector(); }
  return {
    render,
    leave() { if (preview.getActiveReaction() || Object.keys(preview.getStayedExpressions?.() || {}).length) preview.clearReactions(); },
    snapshot() { const state = doc(); return { activeId: activeId(), reactions: (state.reactions || []).map((item) => ({ id: item.id, name: item.name, trigger: { ...item.trigger }, expression: item.expression ? { ...item.expression } : null, motion: item.motion ? { ...item.motion } : null, timing: timingPresetOf(item.timing), issue: issuesFor(item.id) })) }; }
  };
}
