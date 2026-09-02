import { capabilityMap } from './mobile-capabilities.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const LEVEL_LABELS = { full: 'Works here', limited: 'Limited here', unavailable: 'Not on phones' };

/**
 * Capability sheet (UX-20): what this device supports, with the handoff for
 * the rest, and the desktop-layout escape hatch. Read-only over the policy;
 * the layout choice is a UI preference, never project data.
 */
export function createCapabilitySheet(host, { layout = () => ({ layout: 'desktop', forced: 'auto' }), onForce = () => {} } = {}) {
  host.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !host.contains(button)) return;
    if (button.dataset.closeCapabilities !== undefined) { close(); return; }
    if (button.dataset.forceLayout) { onForce(button.dataset.forceLayout); close(); }
  });
  function render() {
    const state = layout(), items = capabilityMap(state.layout);
    host.innerHTML = `<div class="card-title"><h3 id="capability-heading">What works on this ${state.layout === 'mobile' ? 'phone' : state.layout === 'tablet' ? 'tablet' : 'screen'}</h3><button class="icon" data-close-capabilities aria-label="Close capabilities">×</button></div>
      <p class="small">${state.layout === 'desktop' ? 'Everything is available in this layout.' : 'Precision tools need more room; everything else works here. Nothing is lost: save, export and open always work.'}</p>
      <ul class="capability-list">${items.map((item) => `<li data-capability="${esc(item.area)}" data-capability-level="${item.level}"><b>${esc(item.label)}</b><span class="capability-level">${LEVEL_LABELS[item.level]}</span>${item.note ? `<small>${esc(item.note)}${item.handoff ? ` ${esc(item.handoff)}` : ''}</small>` : ''}</li>`).join('')}</ul>
      <div class="capability-actions">${state.forced === 'desktop' ? '<button type="button" data-force-layout="auto">Back to the automatic layout</button>' : '<button type="button" class="secondary" data-force-layout="desktop">Use the desktop layout on this device</button>'}<p class="small">The desktop layout shows both panels at once; it is cramped on a phone but nothing is gated.</p></div>`;
  }
  function open() { render(); host.setAttribute('aria-labelledby', 'capability-heading'); host.hidden = false; host.querySelector('[data-close-capabilities]')?.focus(); }
  function close() { host.hidden = true; host.removeAttribute('aria-labelledby'); }
  return { open, close, render, isOpen: () => !host.hidden };
}
