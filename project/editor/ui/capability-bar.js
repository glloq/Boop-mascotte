/**
 * The capabilities of a screen, all of them visible at once (UX-60 PR 3,
 * docs/SHELL_V2_AUDIT.md §7).
 *
 * A screen's capabilities were nine stacked `<details>`, and on Rig ▸ Controls
 * **twelve of the thirteen opened shut**. So the way to find out what a screen
 * could do was to open everything, and the column hid 3 206 px of structure
 * below its own bottom — measured, at 1440×900. Scrolling is for going through
 * a collection; it is not how anybody should discover that Shape Keys exist.
 *
 * ```text
 *   before                          after
 *   ▸ Movements                     ┌──────────┬───────┬──────┬────────┐
 *   ▸ Part poses                    │ Movements│ Poses │ Gaze │ Hands  │
 *   ▸ Gaze                          └──────────┴───────┴──────┴────────┘
 *   ▸ Controls                      ┌────────────────────────────────────┐
 *   ▸ Hands                         │ the one that is open               │
 *   (3 206 px of it below the fold) └────────────────────────────────────┘
 * ```
 *
 * One tab strip, one panel showing. Everything the screen can do is a word on
 * screen, and the scroll height of the column becomes the scroll height of
 * *one* capability rather than of all of them stacked.
 *
 * ## What it does not do
 *
 * It does not move a panel or touch what one renders. The hosts keep their ids
 * — `#face-movements`, `#gaze-panel`, every spec and every deep link still find
 * them — and the `<details>` they live in stay in the DOM, forced open, with
 * the inactive ones hidden. That is what lets the accordion stop being
 * navigation without thirty panels being rewritten in one commit (§32).
 *
 * Which tab is open is session state, per screen, and never reaches the
 * document: it is where the author is standing.
 */
import { esc } from './escape-html.js';

/** Where the open tab is remembered, per screen, for as long as the tab lives. */
const KEY = 'boop.capability';

export function readCapabilities(storage = globalThis.sessionStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function writeCapabilities(open, storage = globalThis.sessionStorage) {
  try { storage?.setItem(KEY, JSON.stringify(open || {})); return true; } catch { return false; }
}

/**
 * Which capability is showing, given what a screen holds and what was left open.
 *
 * A remembered tab that the screen no longer has — the author changed screen,
 * or a capability became unavailable — falls back to the first rather than
 * showing nothing, because an empty task area is the one outcome worse than
 * the wrong tab.
 */
export function activeCapability(ids = [], remembered = null) {
  const list = ids.filter(Boolean);
  if (!list.length) return null;
  return list.includes(remembered) ? remembered : list[0];
}

/**
 * The tab strip.
 *
 * `state` marks readiness the way the old headings did (`ready` / `partial` /
 * `empty`), because that information was the one good thing about a summary
 * line and there is no reason to lose it: a capability that is set up says so
 * without being opened.
 */
export function capabilityBarMarkup(items = [], active = null, { label = 'Capabilities' } = {}) {
  if (items.length < 2) return '';
  const tabs = items.map((item) => {
    const on = item.id === active;
    return `<button type="button" role="tab" id="cap-tab-${esc(item.id)}" class="capability-tab${on ? ' capability-tab-active' : ''}"
      data-capability="${esc(item.id)}" aria-selected="${on}" aria-controls="cap-panel-${esc(item.id)}"
      tabindex="${on ? '0' : '-1'}"${item.state ? ` data-capability-state="${esc(item.state)}"` : ''}${item.summary ? ` title="${esc(item.label)}: ${esc(item.summary)}"` : ''}>
      <span class="capability-name">${esc(item.label)}</span>${item.state ? `<span class="capability-mark" aria-hidden="true">${item.state === 'ready' ? '✓' : item.state === 'partial' ? '●' : '○'}</span>` : ''}
    </button>`;
  }).join('');
  return `<div class="capability-bar" role="tablist" aria-label="${esc(label)}" data-capability-bar>${tabs}</div>`;
}

/**
 * Arrow keys move between tabs, which is what a `tablist` promises.
 *
 * Home and End too: six capabilities is enough that "the last one" is a thing
 * somebody wants to reach without pressing Right five times.
 *
 * @returns {string|null} the capability to open, or `null` for a key this does not own
 */
export function capabilityKey(event, ids = [], active = null) {
  const list = ids.filter(Boolean);
  const at = list.indexOf(active);
  if (at < 0 || !list.length) return null;
  const key = event?.key;
  if (key === 'ArrowRight' || key === 'ArrowDown') return list[(at + 1) % list.length];
  if (key === 'ArrowLeft' || key === 'ArrowUp') return list[(at - 1 + list.length) % list.length];
  if (key === 'Home') return list[0];
  if (key === 'End') return list[list.length - 1];
  return null;
}

/**
 * Bind a strip to its host.
 *
 * The host is whatever wraps the bar and the panels; this listens on it, so a
 * re-rendered bar keeps working without being rebound.
 *
 * @param {HTMLElement} host
 * @param {object} deps
 * @param {() => string[]} deps.ids       the capabilities on screen, in order
 * @param {() => string} deps.active
 * @param {(id: string) => void} deps.onOpen
 */
export function wireCapabilityBar(host, { ids = () => [], active = () => null, onOpen = () => {} } = {}) {
  if (!host) return () => {};
  const onClick = (event) => {
    const tab = event.target.closest?.('[data-capability]');
    if (!tab || !host.contains(tab)) return;
    onOpen(tab.dataset.capability);
  };
  const onKey = (event) => {
    if (!event.target.closest?.('[data-capability-bar]')) return;
    const next = capabilityKey(event, ids(), active());
    if (!next) return;
    event.preventDefault();
    onOpen(next);
    // Focus follows selection in a tablist, or the keyboard leaves the author
    // on a tab that is no longer the one they are looking at.
    host.querySelector(`[data-capability="${CSS.escape(next)}"]`)?.focus();
  };
  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);
  return () => { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); };
}
