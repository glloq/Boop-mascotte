import { createReactionCommands } from '../core/reactions/reaction-commands.js';
import { TIMING_PRESETS, TRIGGER_TYPES, findReaction, reactionIssues, timingPresetOf, triggerLabel } from '../core/reactions/reaction-model.js';
import { instantiateReactionPreset, reactionPresetAvailabilityGroups, reactionPresetSummary } from '../core/reactions/reaction-presets.js';
import { createStarterKitCommands } from '../core/starter/starter-kit.js';
import { createPresetGroups, starterKitMarkup, starterKitNotice } from './preset-catalogue.js';
import { rememberOpen, setPanelHtml } from './panel-render.js';
import { createComponent } from './component.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const TRIGGER_LABELS = { click: 'Clicked', hover: 'Hovered', timer: 'Every few seconds', custom: 'Custom event' };
const TIMING_LABELS = { fast: 'Fast', normal: 'Normal', slow: 'Slow', custom: 'Custom' };

// The separator every signature joins on: a NUL cannot occur in an id, a name
// or a label, so the joined string stays one-to-one with what it came from.
const SEP = '\u0000';

/**
 * A host that registers its listeners through the component.
 *
 * `rememberOpen` — and `createPresetGroups`, which is built on it — adds a
 * capture-phase `toggle` listener to the host when it is built, and asks the
 * host for nothing else but `querySelectorAll`. Handing it this facade puts
 * that listener under the lifecycle — removed by `destroy()` like the others —
 * without changing `panel-render.js`, which the rest of the editor shares.
 */
const underLifecycle = (host, listen) => ({
  addEventListener: (type, handler, options) => listen(host, type, handler, options),
  querySelectorAll: (selector) => host.querySelectorAll?.(selector) || []
});

// Fixed arity per item is what keeps one flat join unambiguous.
/** Five per reaction: what the row shows, plus the switch and the issue mark. */
const listSignature = (rows) => rows.flatMap((row) => [row.id, row.name, row.enabled, row.issue, row.description]).join(SEP);
/**
 * Per group its name and how many cards it holds (the summary counts both),
 * then four per card: the id — which fixes the name and description, both
 * constants — whether it can be added, what it resolved to, and what it would
 * need first.
 */
const presetSignature = (groups) => groups.flatMap((entry) => [entry.group, entry.presets.length,
  ...entry.presets.flatMap((preset) => [preset.id, preset.usable, reactionPresetSummary(preset), preset.missing.map((item) => item.label).join(' or ')])]).join(SEP);
/** The kit card counts what it would add and names what it would skip. */
const kitSignature = (plan) => [plan?.added ?? 0, ...(plan?.entries || []).flatMap((item) => [item.kind, item.id, item.name, item.action])].join(SEP);
/** The two `<select>`s the Inspector offers, in the order they are offered. */
const targetSignature = (expressions, clips) => [...expressions.flatMap((item) => [item.id, item.name]), '', ...clips.flatMap((item) => [item.id, item.name])].join(SEP);
/** Every hand pose a gesture can be raised from, and the label each one shows. */
const poseSignature = (poses) => poses.flatMap((entry) => [entry.side, entry.pose.id, entry.pose.name || entry.pose.id]).join(SEP);
/**
 * The whole Inspector in one line: the values the four fieldsets are made of,
 * and the three the guidance above them reads.
 */
const detailSignature = (reaction, issue) => !reaction ? '' : [
  reaction.id, reaction.name, reaction.enabled, reaction.after, reaction.priority, reaction.interrupt,
  reaction.trigger.type, reaction.trigger.name || '', reaction.trigger.interval ?? '',
  reaction.expression?.id || '', reaction.expression?.weight ?? '', reaction.motion?.clipId || '',
  (reaction.gestures || []).map((item) => `${item.side}:${item.pose}`).join(','),
  timingPresetOf(reaction.timing), reaction.timing.attack, reaction.timing.hold, reaction.timing.release,
  issue?.missingExpression || '', issue?.missingClip || '', Boolean(issue?.empty)
].join(SEP);

/**
 * Reactions task: When → Do → Timing → After. Authored reactions live in
 * ProjectDocument.reactions (`reactions` domain, commands); the active
 * reaction is EditorSession state; Test fires the reaction in the preview
 * through the same sequencer the exported runtime uses.
 *
 * Behind the component lifecycle since VNX-03 step 4 (docs/VNEXT_COMPONENTS.md),
 * with one asymmetry worth knowing: `leave()` is *not* wired to `hide()`.
 * `WORKSPACE_OCCUPANTS` gives this panel an `onLeave` and no `onEnter`, so
 * nothing would ever call `show()` again and the panel would stay dark for the
 * rest of the session. It clears the preview and keeps rendering, exactly as
 * before; hiding it is one `onEnter: 'enter'` away in `workspace-manager.js`.
 *
 * The panel's own state — the notice and the draft name — is in the model, for
 * the same reason the guide bar's `expanded` is: a warning that authors nothing
 * changes no project data, and a model without it never reaches the screen.
 */
export function createReactionStudio({ listHost, inspectorHost, store, history, preview, editorContext, onStatus = () => {}, navigate = () => {} }) {
  const commands = createReactionCommands(store, history), starterKit = createStarterKitCommands(store, history);
  let notice = null, draftName = '';
  // Both are built on mount rather than here: which groups and which
  // disclosures are open has to outlive the rebuilt markup, and the listeners
  // that remember them have to go when the panel does.
  let presetGroups = () => '';
  let inspectorSections = { attr: () => '' };
  // Everything derived for the last render. The lists are rebuilt on every
  // derivation, so nothing but their signature can tell two identical passes
  // apart: they stay here and the signature goes in the model.
  let view = { hasArtwork: false, rows: [], groups: [], plan: null, expressions: [], clips: [], poses: [], reaction: null, issue: null };
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

  /** The whole kit in one press: faces, motions, reactions and automatic life, one undo step. */
  function addStarterKit() {
    try { const report = starterKit.add(); notice = starterKitNotice(report); onStatus(notice.text); render(); }
    catch (error) { fail(error); }
  }

  /** Add a preset with whatever it resolved to; it never creates what it references. */
  function addPreset(id) {
    const state = doc();
    let resolved;
    try { resolved = instantiateReactionPreset(state, id); } catch (error) { return fail(error); }
    if (!resolved.usable) { notice = { tone: 'warn', text: `${resolved.name} needs ${resolved.missing.map((item) => item.label).join(' or ')}.` }; return render(); }
    const used = new Set((state.reactions || []).map((item) => item.name));
    const name = used.has(resolved.name) ? `${resolved.name} ${used.size + 1}` : resolved.name;
    try {
      const newId = commands.create({
        name, trigger: resolved.trigger, timing: resolved.timing, after: resolved.after,
        expressionId: resolved.expressionId, clipId: resolved.clipId, gestures: resolved.gestures
      });
      draftName = '';
      notice = { tone: 'success', text: `✓ ${name} added — ${reactionPresetSummary(resolved)}. Press Test in the Inspector.` };
      select(newId);
      onStatus(`Reaction "${name}" added.`);
    } catch (error) { fail(error); }
  }

  const component = createComponent({
    host: listHost,
    onMount: ({ listen }) => {
      presetGroups = createPresetGroups(underLifecycle(listHost, listen));
      // The Inspector is rebuilt on every edit too, and ticking Enabled inside
      // Advanced used to close Advanced.
      inspectorSections = rememberOpen(underLifecycle(inspectorHost, listen));

      listen(listHost, 'submit', (event) => { if (event.target.dataset.reactionForm === undefined) return; event.preventDefault(); create(listHost.querySelector('[data-reaction-name]')?.value.trim() || ''); });
      listen(listHost, 'input', (event) => { if (event.target.dataset.reactionName !== undefined) draftName = event.target.value; });
      listen(listHost, 'change', (event) => { const id = event.target.dataset.reactionToggle; if (!id) return; try { commands.update(id, { enabled: event.target.checked }); onStatus(`Reaction "${findReaction(doc(), id)?.name}" ${event.target.checked ? 'enabled' : 'disabled'}.`); } catch (error) { fail(error); } });
      listen(listHost, 'click', (event) => {
        const button = event.target.closest('button'); if (!button || !listHost.contains(button)) return;
        if (button.dataset.reactionSelect) { select(button.dataset.reactionSelect === activeId() ? null : button.dataset.reactionSelect); return; }
        if (button.dataset.reactionPresetAdd) { addPreset(button.dataset.reactionPresetAdd); return; }
        if (button.dataset.starterKitAdd !== undefined) { addStarterKit(); return; }
        if (button.dataset.reactionPresetFix) { const route = instantiateReactionPreset(doc(), button.dataset.reactionPresetFix).missing[0]?.route; if (route) navigate(route); return; }
        if (button.dataset.reactionGo) navigate({ task: button.dataset.reactionGo });
      });

      listen(inspectorHost, 'click', (event) => {
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

      listen(inspectorHost, 'input', (event) => {
        if (event.target.dataset.reactionWeight === undefined) return;
        const output = inspectorHost.querySelector('[data-reaction-weight-output]');
        if (output) output.value = `${Math.round(Number(event.target.value) * 100)}%`;
      });

      listen(inspectorHost, 'change', (event) => {
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
    },
    // The component empties its own host. The Inspector is this panel's second
    // host, so it is cleared here, while the DOM is still there.
    onDestroy: () => { inspectorHost.innerHTML = ''; },
    render: (model) => { renderList(model); renderInspector(model); }
  });

  function renderList(model) {
    listHost.dataset.reactionsReady = 'true';
    listHost.dataset.reactionsCount = String(model.reactionCount);
    if (!model.hasArtwork) { listHost.innerHTML = '<p class="small">Add artwork first: import an SVG or start from a template.</p>'; return; }
    const gate = model.hasTargets ? '' : '<p class="face-pick-notice" data-tone="warn"><span>A reaction shows an expression or a motion. Create one first.</span><button type="button" class="secondary" data-reaction-go="expressions">Expressions</button><button type="button" class="secondary" data-reaction-go="animate">Animate</button></p>';
    // Presets first: Expressions and Animate open with something to click, and
    // a reaction made of what the project already has is one press away.
    const card = (preset) => `<article class="preset-card" data-reaction-preset-card="${preset.id}" data-preset-usable="${preset.usable}" data-preset-missing="${preset.missing.length}" title="${esc(preset.description)}">
      <div><b>${esc(preset.name)}</b><small>${esc(preset.description)}</small><small class="${preset.usable ? '' : 'preset-missing'}">${preset.usable ? `Uses ${esc(reactionPresetSummary(preset))}` : `Needs ${esc(preset.missing.map((item) => item.label).join(' or '))}`}</small></div>
      ${preset.usable
        ? `<button type="button" data-reaction-preset-add="${preset.id}" aria-label="Add ${esc(preset.name)} reaction">Add</button>`
        : `<button type="button" class="secondary" data-reaction-preset-fix="${preset.id}" aria-label="Make what ${esc(preset.name)} needs">Make it</button>`}
    </article>`;
    const presetSection = `${starterKitMarkup(view.plan)}<section class="preset-catalogue" data-preset-catalogue="reactions"><h3>Ready-made reactions</h3>${presetGroups(view.groups, card, { className: 'reaction-presets' })}</section>`;
    const noticeLine = model.noticeText ? `<p class="face-pick-notice" data-tone="${model.noticeTone}"><span>${esc(model.noticeText)}</span></p>` : '';
    setPanelHtml(listHost, `<div role="status" aria-live="polite">${noticeLine}</div>${gate}${presetSection}<form class="expression-form" data-reaction-form><label>New reaction<input data-reaction-name aria-label="New reaction name" placeholder="Surprise, Wave hello…" value="${esc(model.draftName)}" ${model.hasTargets ? '' : 'disabled'}></label><button type="submit" ${model.hasTargets ? '' : 'disabled'}>Create</button></form>${model.reactionCount ? `<ol class="expression-list" aria-label="Reactions">${view.rows.map((row) => `<li class="reaction-row"><button type="button" class="expression-item reaction-item" data-reaction-select="${esc(row.id)}" data-reaction-issue="${row.issue}" aria-pressed="${row.id === model.activeId}"><span>${esc(row.name)}</span><small>${esc(row.description)}</small></button><label class="check reaction-switch" title="Enabled"><input type="checkbox" data-reaction-toggle="${esc(row.id)}" aria-label="Enable ${esc(row.name)}" ${row.enabled ? 'checked' : ''}></label></li>`).join('')}</ol>` : '<p class="expression-empty">No reactions yet. A reaction is what the mascot does when something happens: when clicked, show Surprised with a Head Pop, then come back.</p>'}`);
  }

  /**
   * Hand gestures a reaction can raise. Only poses that exist are offered, so a
   * reaction can never name one the hand does not have.
   */
  function gestureMarkup(reaction) {
    if (!view.poses.length) return '<p class="small" data-reaction-gestures="none">Assign a hand with a pose in Face Setup to add a gesture here.</p>';
    const has = (side, id) => (reaction.gestures || []).some((item) => item.side === side && item.pose === id);
    return `<fieldset data-reaction-gestures="available"><legend>Hand gesture</legend>${view.poses.map(({ side, pose }) =>
      `<label class="small"><input type="checkbox" data-reaction-gesture="${esc(side)}:${esc(pose.id)}"${has(side, pose.id) ? ' checked' : ''}> ${side === 'left' ? 'Left' : 'Right'} · ${esc(pose.name || pose.id)}</label>`).join('')}</fieldset>`;
  }

  function renderInspector(model) {
    const reaction = view.reaction;
    if (!reaction) { inspectorHost.innerHTML = ''; delete inspectorHost.dataset.reactionId; return; }
    const issue = view.issue, preset = timingPresetOf(reaction.timing);
    inspectorHost.dataset.reactionId = reaction.id;
    const expressionOptions = ['<option value="">None</option>', ...view.expressions.map((item) => `<option value="${esc(item.id)}" ${reaction.expression?.id === item.id ? 'selected' : ''}>${esc(item.name)}</option>`), ...(issue?.missingExpression ? [`<option value="${esc(issue.missingExpression)}" selected>Missing: ${esc(issue.missingExpression)}</option>`] : [])].join('');
    const clipOptions = ['<option value="">None</option>', ...view.clips.map((item) => `<option value="${esc(item.id)}" ${reaction.motion?.clipId === item.id ? 'selected' : ''}>${esc(item.name)}</option>`), ...(issue?.missingClip ? [`<option value="${esc(issue.missingClip)}" selected>Missing: ${esc(issue.missingClip)}</option>`] : [])].join('');
    const guidance = issue ? `<p class="face-pick-notice" data-tone="warn" data-reaction-guidance><span>${issue.missingExpression ? `The expression “${esc(issue.missingExpression)}” no longer exists. ` : ''}${issue.missingClip ? `The motion “${esc(issue.missingClip)}” no longer exists. ` : ''}${issue.empty ? 'This reaction does nothing yet: choose an expression or a motion.' : 'Choose another one below.'}</span>${issue.missingExpression || (issue.empty && !view.expressions.length) ? '<button type="button" class="secondary" data-reaction-go="expressions">Expressions</button>' : ''}${issue.missingClip ? '<button type="button" class="secondary" data-reaction-go="animate">Animate</button>' : ''}</p>` : '';
    inspectorHost.innerHTML = `<label>Reaction name<input data-reaction-rename aria-label="Reaction name" value="${esc(reaction.name)}"></label>${guidance}
      <div class="reaction-fields">
        <fieldset><legend>When</legend><label>Trigger<select data-reaction-trigger aria-label="Trigger">${TRIGGER_TYPES.map((type) => `<option value="${type}" ${reaction.trigger.type === type ? 'selected' : ''}>${TRIGGER_LABELS[type]}</option>`).join('')}</select></label>${reaction.trigger.type === 'custom' ? `<label>Event name<input type="text" data-reaction-event aria-label="Custom event name" value="${esc(reaction.trigger.name)}"></label><p class="small">Fired by your page with <code>mascot.trigger('custom', { name: '${esc(reaction.trigger.name)}' })</code>.</p>` : ''}${reaction.trigger.type === 'timer' ? `<label>Every (seconds)<input type="number" data-reaction-interval aria-label="Timer interval in seconds" min=".1" step=".1" value="${reaction.trigger.interval}"></label>` : ''}${reaction.trigger.type === 'click' ? '<p class="small">In Preview, click the mascot. On your page, <code>mascot.bindEvents()</code> listens for clicks and hovers.</p>' : ''}</fieldset>
        <fieldset><legend>Do</legend><label>Expression<select data-reaction-expression aria-label="Reaction expression">${expressionOptions}</select></label>${reaction.expression ? `<label>Intensity <output data-reaction-weight-output>${Math.round(reaction.expression.weight * 100)}%</output><input type="range" data-reaction-weight aria-label="Reaction intensity" min="0" max="1" step=".05" value="${reaction.expression.weight}"></label>` : ''}<label>Motion<select data-reaction-motion aria-label="Reaction motion">${clipOptions}</select></label>${gestureMarkup(reaction)}</fieldset>
        <fieldset><legend>Timing</legend><label>Speed<select data-reaction-timing aria-label="Reaction timing">${Object.keys(TIMING_LABELS).map((name) => `<option value="${name}" ${preset === name ? 'selected' : ''}>${TIMING_LABELS[name]}${TIMING_PRESETS[name] ? ` · ${TIMING_PRESETS[name].attack + TIMING_PRESETS[name].hold + TIMING_PRESETS[name].release} s` : ''}</option>`).join('')}</select></label>${preset === 'custom' ? `<div class="reaction-timing-custom">${['attack', 'hold', 'release'].map((key) => `<label>${key[0].toUpperCase()}${key.slice(1)}<input type="number" data-reaction-timing-field="${key}" aria-label="${key} seconds" min="0" step=".05" value="${reaction.timing[key]}"></label>`).join('')}</div>` : `<p class="small">In ${reaction.timing.attack} s, hold ${reaction.timing.hold} s${reaction.motion ? ' (or as long as the motion)' : ''}, out ${reaction.timing.release} s.</p>`}</fieldset>
        <fieldset><legend>After</legend><label>Then<select data-reaction-after aria-label="After the reaction"><option value="return" ${reaction.after === 'return' ? 'selected' : ''}>Return to how it was</option><option value="stay" ${reaction.after === 'stay' ? 'selected' : ''}>Stay like this</option></select></label></fieldset>
        <details class="reaction-advanced" data-keep-open="advanced"${inspectorSections.attr('advanced')}><summary>Advanced</summary><div class="reaction-fields"><label class="check"><input type="checkbox" data-reaction-enabled ${reaction.enabled ? 'checked' : ''}>Enabled</label><label>Priority<input type="number" data-reaction-priority aria-label="Priority" step="1" value="${reaction.priority}"></label><label>When another reaction is playing<select data-reaction-interrupt aria-label="Interrupt policy"><option value="replace" ${reaction.interrupt === 'replace' ? 'selected' : ''}>Replace it (if not higher priority)</option><option value="ignore" ${reaction.interrupt === 'ignore' ? 'selected' : ''}>Wait (do not fire)</option></select></label><p class="small">id <code>${esc(reaction.id)}</code> · <code>mascot.fire('${esc(reaction.id)}')</code></p></div></details>
      </div>
      <div class="expression-actions"><button type="button" data-reaction-test aria-label="Test ${esc(reaction.name)}">⚡ Test</button><button type="button" class="secondary" data-reaction-duplicate aria-label="Duplicate reaction">Duplicate</button><button type="button" class="danger secondary" data-reaction-delete aria-label="Delete reaction">Delete</button></div>`;
  }

  /** Every object the two markups read, derived once per render. */
  function derive() {
    const state = doc(), list = state.reactions || [], reaction = active();
    const expressions = state.expressions || [], clips = state.animationClips || [];
    const issues = new Map(reactionIssues(state).map((item) => [item.id, item]));
    const describe = (item) => {
      const parts = [triggerLabel(item.trigger)];
      const expression = item.expression ? expressions.find((entry) => entry.id === item.expression.id) : null;
      const clip = item.motion ? clips.find((entry) => entry.id === item.motion.clipId) : null;
      if (item.expression) parts.push(expression ? expression.name : `missing ${item.expression.id}`);
      if (item.motion) parts.push(clip ? clip.name : `missing ${item.motion.clipId}`);
      if (!item.expression && !item.motion) parts.push('does nothing yet');
      if (!item.enabled) parts.push('off');
      return parts.join(' → ');
    };
    return {
      hasArtwork: Boolean(state.svgMarkup),
      rows: list.map((item) => ({ id: item.id, name: item.name, enabled: Boolean(item.enabled), issue: issues.has(item.id), description: describe(item) })),
      groups: reactionPresetAvailabilityGroups(state), plan: starterKit.plan(),
      expressions, clips,
      poses: ['left', 'right'].flatMap((side) => (state.hands?.[side]?.poses || []).map((pose) => ({ side, pose }))),
      reaction, issue: reaction ? issues.get(reaction.id) || null : null
    };
  }

  /**
   * Flat on purpose: this is what the component compares to decide to redraw.
   *
   * `notice` and `draftName` are panel state rather than project data, and both
   * are here: a warning about a preset that cannot be added authors nothing, so
   * a model without it would never show it.
   */
  const model = () => ({
    hasArtwork: view.hasArtwork,
    reactionCount: view.rows.length,          // the count attribute and the empty line
    activeId: activeId() || '',               // aria-pressed in the list; a stale id simply matches nothing
    reactionId: view.reaction?.id || '',      // what the Inspector is on, which is not the same question
    hasTargets: Boolean(view.expressions.length || view.clips.length),
    draftName,
    noticeTone: notice?.tone || '',
    noticeText: notice?.text || '',
    starterKit: kitSignature(view.plan),
    presets: presetSignature(view.groups),
    reactions: listSignature(view.rows),
    targets: targetSignature(view.expressions, view.clips),
    poses: poseSignature(view.poses),
    detail: detailSignature(view.reaction, view.issue)
  });

  function render() {
    view = derive();
    const next = model();
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  return {
    render,
    /**
     * Leaving the workspace stops whatever the Test button left running. It is
     * deliberately not `hide()`: nothing calls this panel back in.
     */
    leave() { if (preview.getActiveReaction() || Object.keys(preview.getStayedExpressions?.() || {}).length) preview.clearReactions(); },
    snapshot() { const state = doc(); return { activeId: activeId(), reactions: (state.reactions || []).map((item) => ({ id: item.id, name: item.name, trigger: { ...item.trigger }, expression: item.expression ? { ...item.expression } : null, motion: item.motion ? { ...item.motion } : null, timing: timingPresetOf(item.timing), issue: issuesFor(item.id) })) }; },
    destroy: () => component.destroy(),
    counters: () => component.counters()
  };
}
