/**
 * The dock under the canvas: one surface, opened by the screen that needs it
 * (UIR-03, docs/UIR_REFACTOR_BASELINE.md).
 *
 * The Timeline is the detailed editor of a motion rather than a second way to
 * start one (§9), so it is a dock rather than a column -- the motion catalogue
 * stays where it is while its keys are edited underneath. It is the only entry
 * so far; the event log and the diagnostics panel are the two the roadmap names
 * next, and they arrive as rows here rather than as another footer.
 *
 * `data-dock` on the root says which one is open, so "one dock at a time" is a
 * fact the stylesheet can read rather than a convention panels have to keep.
 */
export const DOCKS = Object.freeze({
  timeline: Object.freeze({ id: 'timeline', label: 'Timeline', host: 'timeline-panel' })
});

export const bottomDockMarkup = () => `<footer class="bottom" aria-label="Timeline"><div id="timeline-resize" class="timeline-resize" role="separator" aria-label="Resize Timeline" aria-orientation="horizontal" tabindex="0"></div><button id="collapse-timeline" class="collapse-timeline">⌄ Timeline</button><div id="timeline-panel"></div></footer>`;

export function wireBottomDock({ root, q, preferences, savePreferences }) {
  /** "Timeline" told nobody what the button does; it names the two states now. */
  const syncToggle = () => {
    const button = q('#collapse-timeline'), closed = preferences.timelineCollapsed;
    button.textContent = closed ? '⌃ Edit key by key' : '⌄ Hide timeline';
    button.setAttribute('aria-expanded', String(!closed));
    button.title = closed ? 'Open the Timeline to edit this animation key by key' : 'Hide the Timeline';
  };
  const setHeight = (value) => root.style.setProperty('--timeline-height', `${Math.max(120, Math.min(innerHeight * .68, value))}px`);
  const height = () => q('.bottom').getBoundingClientRect().height;

  const resize = q('#timeline-resize');
  let resizing = null;
  resize.addEventListener('pointerdown', (event) => { resizing = { y: event.clientY, height: height() }; resize.setPointerCapture(event.pointerId); });
  resize.addEventListener('pointermove', (event) => { if (resizing) setHeight(resizing.height + resizing.y - event.clientY); });
  resize.addEventListener('pointerup', () => { resizing = null; });
  resize.addEventListener('dblclick', () => setHeight(210));
  // The separator is a focus stop, so it has to do something from the keyboard.
  resize.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 60 : 20;
    if (event.key === 'ArrowUp') { event.preventDefault(); setHeight(height() + step); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setHeight(height() - step); }
    else if (event.key === 'Home') { event.preventDefault(); setHeight(210); }
  });
  syncToggle();
  root.dataset.dock = DOCKS.timeline.id;

  const showTimeline = () => {
    if (!preferences.timelineCollapsed) return;
    preferences.timelineCollapsed = false;
    root.classList.remove('timeline-collapsed');
    syncToggle(); savePreferences();
    root.dispatchEvent(new CustomEvent('timelinetoggle', { detail: { open: true } }));
  };

  return {
    previewEl: q('#timeline-panel'),
    syncToggle,
    showTimeline,
    /** Open a dock by name, whichever screen asked for it. Unknown names do nothing. */
    openDock(id) {
      if (!DOCKS[id]) return false;
      root.dataset.dock = id;
      if (id === 'timeline') showTimeline();
      return true;
    },
    /** Which dock is open, for the panels that ask rather than assume. */
    openDockId: () => root.dataset.dock || null,
    /** Told when the Timeline footer opens or closes, so a panel offering to open it can follow. */
    onTimelineToggle(handler) { root.addEventListener('timelinetoggle', (event) => handler(event.detail.open)); },
    /** Whether the Timeline footer is open, so a panel can offer to open it only when it is not. */
    isTimelineOpen: () => !preferences.timelineCollapsed
  };
}
