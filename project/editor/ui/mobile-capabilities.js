// Mobile capability policy (UX-20): what a phone supports in full, what is
// limited to safe edits, and what needs a larger screen, with the handoff
// explained instead of hidden. Pure data; the shell reads it per layout.
export const MOBILE_POLICY = Object.freeze({
  preview: Object.freeze({ level: 'full', label: 'Preview', note: 'Live controls, expressions, reactions and reset all work here.' }),
  expressions: Object.freeze({ level: 'full', label: 'Expressions', note: 'Add presets, apply, rename, duplicate and adjust sliders.' }),
  reactions: Object.freeze({ level: 'full', label: 'Reactions', note: 'Create, enable, test and edit When / Do / Timing / After.' }),
  motions: Object.freeze({ level: 'limited', label: 'Motions', note: 'Presets and their amplitude, duration and repeats. Key-by-key editing needs the Timeline.', handoff: 'Open the Timeline on a tablet or desktop.' }),
  automatic: Object.freeze({ level: 'full', label: 'Automatic', note: 'Turn Blink, Natural gaze and Idle head movement on or off and test them.' }),
  export: Object.freeze({ level: 'full', label: 'Save and Export', note: 'Save, export and readiness deep links stay available.' }),
  'face-setup': Object.freeze({ level: 'limited', label: 'Face Setup', note: 'Accept suggestions and assign parts by tapping clear shapes. Overlapping artwork is easier to review on a larger screen.', handoff: 'Review ambiguous parts on a tablet or desktop.' }),
  calibration: Object.freeze({ level: 'limited', label: 'Calibration', note: 'Test movements here; visual capture needs precise dragging.', handoff: 'Calibrate by posing on a tablet or desktop.' }),
  artwork: Object.freeze({ level: 'limited', label: 'Artwork', note: 'Import, select, rename, show or hide layers and nudge transforms. Drawing tools and node editing are off on phones.', handoff: 'Edit shapes and transforms on a tablet or desktop.' }),
  timeline: Object.freeze({ level: 'unavailable', label: 'Timeline', note: 'Key-by-key animation needs room for the dope sheet.', handoff: 'Open the Timeline on a tablet or desktop; motion presets still work here.' }),
  'state-machine': Object.freeze({ level: 'limited', label: 'State Machine', note: 'States can be selected and previewed; the transition graph is read-only.', handoff: 'Edit transitions on a tablet or desktop.' }),
  bindings: Object.freeze({ level: 'limited', label: 'Bindings · Constraints · Morphs', note: 'Shown as a read-only summary.', handoff: 'Edit bindings on a tablet or desktop.' }),
  morphs: Object.freeze({ level: 'unavailable', label: 'Morph node editing', note: 'Path topology work needs precision.', handoff: 'Use a tablet or desktop.' })
});

export const CAPABILITY_LEVELS = Object.freeze(['full', 'limited', 'unavailable']);

/** Policy for an area on a layout: desktop and tablet are always full. */
export function describeCapability(area, layout = 'desktop') {
  const policy = MOBILE_POLICY[area];
  if (!policy) return { area, level: 'full', label: area, note: '', handoff: null, gated: false };
  if (layout !== 'mobile') return { area, level: 'full', label: policy.label, note: '', handoff: null, gated: false };
  return { area, level: policy.level, label: policy.label, note: policy.note, handoff: policy.handoff || null, gated: policy.level !== 'full' };
}

/** Every area at a glance, for the capability sheet and tests. */
export function capabilityMap(layout = 'desktop') {
  return Object.keys(MOBILE_POLICY).map((area) => describeCapability(area, layout));
}

/** Markup for the inline gate shown where a limited or unavailable area lives. */
export function gateMarkup(area, layout = 'desktop') {
  const item = describeCapability(area, layout);
  if (!item.gated) return '';
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  return `<p class="mobile-gate" data-mobile-gate="${esc(area)}" data-gate-level="${item.level}"><b>${item.level === 'unavailable' ? 'Not on phones' : 'Limited on phones'}:</b> ${esc(item.note)} ${item.handoff ? `<span>${esc(item.handoff)}</span>` : ''}</p>`;
}
