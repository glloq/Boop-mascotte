import { BEHAVIOR_TITLES, renderBehaviorCatalog } from './behavior-catalog.js';
import { esc } from '../../ui/escape-html.js';

/**
 * The behaviours the mascot runs by itself, as a **list and an Add**, and
 * nothing else (docs/BEHAVIOR_STUDIO.md §1.6).
 *
 * It used to carry an inspector of its own — raw numbers, no picture — while
 * the Automatic panel edited the same `document.behaviors` array through preset
 * cards and switches. One model, two editors, two vocabularies, and a line in
 * one of them pointing at the other. What edits a behaviour now is the tuning
 * rail, which draws its waveform first and its numbers under it; this column
 * lists them, adds them, and hands the picked one to the rail.
 */
export function renderBehaviorsPanel(rig, selectedId, catalog = false) {
  const rows = (rig.behaviors || []).map((behavior) => `<div class="behavior-row ${behavior.id === selectedId ? 'selected' : ''}">
    <input type="checkbox" aria-label="Enable ${esc(behavior.name)}" data-behavior-enabled="${esc(behavior.id)}" ${behavior.enabled !== false ? 'checked' : ''}>
    <button data-select-behavior="${esc(behavior.id)}"><b>${esc(behavior.name)}</b><small>${BEHAVIOR_TITLES[behavior.type] || 'Oscillation'} · ${esc(behavior.parameter)}</small></button>
  </div>`).join('');
  return `<div class="author-intro"><b>BEHAVIOR</b> is automatic, procedural recurring movement.</div>
    <section><div class="section-heading"><h3>Behaviors</h3><button data-action="show-behavior-catalog">+ Add Behavior</button></div>
    <p class="small">Pick one to see what it does and tune it in the Inspector. Automatic movement runs in Preview, where each behaviour can also be muted on its own.</p>
    <div class="behavior-list">${rows || '<p class="empty">No automatic movement yet.</p>'}</div></section>
    ${catalog ? renderBehaviorCatalog() : ''}`;
}
