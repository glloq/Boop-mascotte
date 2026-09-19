/**
 * Every transition, as rows (docs/BEHAVIOR_STUDIO.md §3.3).
 *
 * The board is the right way to *see* a machine and the wrong way to *audit*
 * one: "which of these is 900 ms?" is a question about a column of numbers,
 * and answering it on a diagram means hovering twelve curves. So the table is
 * the second half of the same surface — the same selection, the same commands,
 * the same one history step per intent.
 *
 * It is also where the bulk edit is obvious: tick four rows, set 200 ms once.
 * Selecting four curves on a diagram is possible here too (shift-click), but a
 * checkbox is the control everybody already knows.
 */
import { allTransitions } from '../../core/behavior-graph/behavior-graph.js';
import { createBoardCommands } from '../../core/behavior-graph/board-commands.js';
import { EASINGS, durationLabel } from '../../core/behavior-graph/motion-shapes.js';
import { esc } from '../escape-html.js';

/**
 * Sorted the way a machine is read: out of each state, in the order authored.
 *
 * The needle is matched against the row's key as well as its two ends, so
 * `idle->` finds what leaves idle and `idle` finds everything it touches —
 * both of which are things somebody types into a box labelled *Find*.
 */
export const tableRows = (document, filter = '') => {
  const needle = String(filter || '').trim().toLowerCase();
  return allTransitions(document)
    .filter((row) => !needle || `${row.from} ${row.to} ${row.key}`.toLowerCase().includes(needle))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
};

export function renderTransitionTable(document, { selected = [], filter = '', open = true } = {}) {
  const rows = tableRows(document, filter);
  const picked = new Set(selected);
  const total = allTransitions(document).length;
  const chosen = rows.filter((row) => picked.has(row.key)).length;

  const row = (item) => `<tr class="${picked.has(item.key) ? 'selected' : ''}" data-table-row="${esc(item.key)}">
    <td><label class="check"><input type="checkbox" data-table-pick="${esc(item.key)}" ${picked.has(item.key) ? 'checked' : ''} aria-label="Pick ${esc(item.from)} to ${esc(item.to)}"></label></td>
    <th scope="row"><button type="button" class="link" data-table-select="${esc(item.key)}">${esc(item.from)} <span aria-hidden="true">→</span> ${esc(item.to)}</button></th>
    <td><input type="number" data-table-duration="${esc(item.key)}" min="0" step="10" value="${item.duration}" aria-label="${esc(item.from)} to ${esc(item.to)}, milliseconds"></td>
    <td><select data-table-easing="${esc(item.key)}" aria-label="${esc(item.from)} to ${esc(item.to)}, easing">${EASINGS.map((entry) => `<option value="${entry.id}" ${entry.id === item.easing ? 'selected' : ''}>${esc(entry.label)}</option>`).join('')}</select></td>
    <td><button type="button" class="secondary" data-table-test="${esc(item.key)}" aria-label="Play ${esc(item.from)} to ${esc(item.to)}">▶</button></td>
  </tr>`;

  const bulk = chosen > 1
    ? `<div class="table-bulk" data-table-bulk="${chosen}"><b>${chosen} picked</b>
        <label>All at <input type="number" data-table-bulk-duration min="0" step="10" placeholder="ms" aria-label="Set every picked transition, in milliseconds"> ms</label>
        <label>All <select data-table-bulk-easing aria-label="Set the easing of every picked transition"><option value="">easing…</option>${EASINGS.map((entry) => `<option value="${entry.id}">${esc(entry.label)}</option>`).join('')}</select></label>
        <button type="button" class="danger secondary" data-table-bulk-delete>Delete ${chosen}</button></div>`
    : '';

  return `<details class="transition-table" data-transition-table="${total}" ${open ? 'open' : ''}>
    <summary><span class="setup-title">Transitions</span><span class="setup-summary">${total}${filter ? ` · ${rows.length} shown` : ''}</span></summary>
    <div class="table-tools">
      <label class="table-filter">Find <input type="search" data-table-filter value="${esc(filter)}" placeholder="idle, sleep…" aria-label="Filter transitions"></label>
      <button type="button" class="secondary" data-table-pick-all>${chosen === rows.length && rows.length ? 'Pick none' : 'Pick all'}</button>
    </div>
    ${bulk}
    ${rows.length ? `<table><thead><tr><th><span class="sr-only">Picked</span></th><th>From → To</th><th>Length</th><th>Curve</th><th><span class="sr-only">Play</span></th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>`
      : `<p class="empty">${total ? 'Nothing matches that.' : 'No transitions yet. Drag the handle on a state onto another to make one.'}</p>`}
    ${total ? `<p class="small">${esc(durationLabel(rows[0]?.duration ?? 300))} is what a row of “${rows[0] ? `${rows[0].from} → ${rows[0].to}` : 'a transition'}” feels like. Pick several rows to set them together.</p>` : ''}
  </details>`;
}

export function createTransitionTable({ host, store, history, preview = null, onStatus = () => {}, onSelect = () => {}, getSelection = () => ({ edges: [] }), getLens = () => 'all' }) {
  const commands = createBoardCommands(store, history);
  let filter = '';
  const doc = () => store.getDocument();
  const guard = (fn) => { try { return fn(); } catch (error) { onStatus(error.message, 'warn'); return undefined; } };
  const picked = () => getSelection().edges || [];

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    const data = button.dataset;
    if (data.tableSelect) { onSelect([data.tableSelect]); return; }
    if (data.tableTest) {
      const [from, to] = data.tableTest.split('->');
      const settings = doc().transitionSettings?.[data.tableTest] || {};
      preview?.testTransition({ from, to, duration: settings.duration, easing: settings.easing });
      return;
    }
    if (data.tablePickAll !== undefined) {
      const rows = tableRows(doc(), filter).map((row) => row.key);
      const all = rows.length && rows.every((key) => picked().includes(key));
      onSelect(all ? [] : rows);
      return;
    }
    if (data.tableBulkDelete !== undefined) { guard(() => commands.deleteTransitions(picked())); onSelect([]); render(); }
  });

  host.addEventListener('input', (event) => {
    const data = event.target.dataset;
    if (data.tableFilter !== undefined) { filter = event.target.value; render(); host.querySelector('[data-table-filter]')?.focus(); }
  });

  host.addEventListener('change', (event) => {
    const data = event.target.dataset, value = event.target.value;
    if (data.tablePick) {
      const key = data.tablePick, current = picked();
      onSelect(event.target.checked ? [...new Set([...current, key])] : current.filter((item) => item !== key));
      return;
    }
    if (data.tableDuration) { guard(() => commands.setTransitions([data.tableDuration], { duration: Number(value) })); render(); return; }
    if (data.tableEasing) { guard(() => commands.setTransitions([data.tableEasing], { easing: value })); render(); return; }
    if (data.tableBulkDuration !== undefined && value !== '') { guard(() => commands.setTransitions(picked(), { duration: Number(value) })); render(); return; }
    if (data.tableBulkEasing !== undefined && value) { guard(() => commands.setTransitions(picked(), { easing: value })); render(); }
  });

  /**
   * The table is the states' half of the board, so it shows where the states
   * are the subject. On Automatic and Reactions it would be a list about
   * something else taking a third of the column.
   */
  function render() {
    const lens = getLens();
    const shows = lens === 'states' || lens === 'all';
    host.hidden = !shows;
    if (!shows) { host.innerHTML = ''; return false; }
    const open = host.querySelector('[data-transition-table]')?.open ?? true;
    host.innerHTML = renderTransitionTable(doc(), { selected: picked(), filter, open });
    return true;
  }

  return { render, destroy() { host.innerHTML = ''; } };
}
