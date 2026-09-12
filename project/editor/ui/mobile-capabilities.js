// Mobile capability policy (UX-20): what a phone supports in full, what is
// limited to safe edits, and what needs a larger screen, with the handoff
// explained instead of hidden. Pure data; the shell reads it per layout.
//
// UIR-15 files the policy under the four questions. The list used to be
// thirteen areas in the order they were written, naming screens that no longer
// exist ("Face Setup") and silent about three that do (Hands, Head 2.5D,
// Deform) -- so an author on a phone could not tell whether a screen was gated
// or simply not found. It reads as the navigation reads now, and `global` is
// the handful of things that are true wherever you are.
import { esc } from './escape-html.js';

/** The groups the sheet reads in, in navigation order. */
export const CAPABILITY_GROUPS = Object.freeze({ design: 'Design', rig: 'Rig', animate: 'Animate', behavior: 'Behavior', global: 'Everywhere' });

export const MOBILE_POLICY = Object.freeze({
  /* -- Design ------------------------------------------------------------- */
  character: Object.freeze({ workspace: 'design', level: 'full', label: 'Face', note: 'Pick a part, swap it, recolour it and move it. The parts are the drawer and the inspector the sheet.' }),
  hands: Object.freeze({ workspace: 'design', level: 'limited', label: 'Hands', note: 'Use, rename, duplicate, mirror and delete a hand state, and add one from a file. Reshaping a drawing needs the vector tools.', handoff: 'Edit a state\u2019s drawing on a tablet or desktop.' }),
  artwork: Object.freeze({ workspace: 'design', level: 'limited', label: 'Artwork', note: 'Import, select, rename, show or hide layers and nudge transforms. Drawing tools and node editing are off on phones.', handoff: 'Edit shapes and transforms on a tablet or desktop.' }),

  /* -- Rig ---------------------------------------------------------------- */
  'face-setup': Object.freeze({ workspace: 'rig', level: 'limited', label: 'Assign', note: 'Accept suggestions and assign parts by tapping clear shapes. Overlapping artwork is easier to review on a larger screen.', handoff: 'Review ambiguous parts on a tablet or desktop.' }),
  calibration: Object.freeze({ workspace: 'rig', level: 'limited', label: 'Controls', note: 'Turn movements on and test them here; calibrating one means posing the mascot precisely.', handoff: 'Calibrate by posing on a tablet or desktop.' }),
  'head-pose': Object.freeze({ workspace: 'rig', level: 'limited', label: 'Head 2.5D', note: 'The captured positions can be tested and cleared; capturing one means dragging the face into place.', handoff: 'Capture the turn on a tablet or desktop.' }),
  deform: Object.freeze({ workspace: 'rig', level: 'unavailable', label: 'Deform', note: 'Pins, holds and warp grids are placed a few pixels at a time.', handoff: 'Use a tablet or desktop; what a project already carries is listed here.' }),

  /* -- Animate ------------------------------------------------------------ */
  expressions: Object.freeze({ workspace: 'animate', level: 'full', label: 'Expressions', note: 'Add presets, apply, rename, duplicate and adjust sliders.' }),
  motions: Object.freeze({ workspace: 'animate', level: 'limited', label: 'Motions', note: 'Presets and their amplitude, duration and repeats. Key-by-key editing needs the Timeline.', handoff: 'Open the Timeline on a tablet or desktop.' }),
  timeline: Object.freeze({ workspace: 'animate', level: 'unavailable', label: 'Timeline', note: 'Key-by-key animation needs room for the dope sheet.', handoff: 'Open the Timeline on a tablet or desktop; motion presets still work here.' }),

  /* -- Behavior ----------------------------------------------------------- */
  reactions: Object.freeze({ workspace: 'behavior', level: 'full', label: 'Reactions', note: 'Create, enable, test and edit When / Do / Timing / After.' }),
  automatic: Object.freeze({ workspace: 'behavior', level: 'full', label: 'Automatic', note: 'Turn Blink, Natural gaze and Idle head movement on or off and test them.' }),
  'state-machine': Object.freeze({ workspace: 'behavior', level: 'limited', label: 'State Machine', note: 'States can be selected and previewed; the transition graph is read-only.', handoff: 'Edit transitions on a tablet or desktop.' }),

  /* -- Everywhere --------------------------------------------------------- */
  preview: Object.freeze({ workspace: 'global', level: 'full', label: 'Preview', note: 'Live controls, expressions, reactions, hand states and reset all work here.' }),
  export: Object.freeze({ workspace: 'global', level: 'full', label: 'Save and Export', note: 'Save, export and readiness deep links stay available.' }),
  bindings: Object.freeze({ workspace: 'global', level: 'limited', label: 'Bindings \u00b7 Constraints \u00b7 Morphs', note: 'Shown as a read-only summary.', handoff: 'Edit bindings on a tablet or desktop.' }),
  morphs: Object.freeze({ workspace: 'global', level: 'unavailable', label: 'Morph node editing', note: 'Path topology work needs precision.', handoff: 'Use a tablet or desktop.' })
});

export const CAPABILITY_LEVELS = Object.freeze(['full', 'limited', 'unavailable']);

/** Policy for an area on a layout: desktop and tablet are always full. */
export function describeCapability(area, layout = 'desktop') {
  const policy = MOBILE_POLICY[area];
  if (!policy) return { area, workspace: 'global', level: 'full', label: area, note: '', handoff: null, gated: false };
  if (layout !== 'mobile') return { area, workspace: policy.workspace, level: 'full', label: policy.label, note: '', handoff: null, gated: false };
  return { area, workspace: policy.workspace, level: policy.level, label: policy.label, note: policy.note, handoff: policy.handoff || null, gated: policy.level !== 'full' };
}

/** Every area at a glance, for the capability sheet and tests. */
export function capabilityMap(layout = 'desktop') {
  return Object.keys(MOBILE_POLICY).map((area) => describeCapability(area, layout));
}

/**
 * The same list, under the question each area belongs to (UIR-15).
 *
 * Derived from the policy rather than authored beside it: an area added to the
 * table arrives in the sheet by itself, under its own heading, and one added
 * with a workspace nobody navigates to would have nowhere to appear — which is
 * what `core/tests/mobile-capabilities.test.js` asserts.
 */
export function capabilityGroups(layout = 'desktop') {
  const items = capabilityMap(layout);
  return Object.entries(CAPABILITY_GROUPS)
    .map(([id, label]) => ({ id, label, items: items.filter((item) => item.workspace === id) }))
    .filter((group) => group.items.length);
}

/**
 * Markup for the inline gate shown where a limited or unavailable area lives.
 *
 * `mode` files the gate under one screen: Rig's four share a column, and a gate
 * that lived inside a section said nothing until that section was opened — on
 * the one screen whose whole point is that it is hard to use here (UIR-15). A
 * gate with a mode is drawn beside the sections and shown by the stylesheet on
 * the screen it belongs to, which is the same rule the sections follow.
 */
export function gateMarkup(area, layout = 'desktop', { mode = null } = {}) {
  const item = describeCapability(area, layout);
  if (!item.gated) return '';
  return `<p class="mobile-gate" data-mobile-gate="${esc(area)}"${mode ? ` data-gate-mode="${esc(mode)}"` : ''} data-gate-level="${item.level}"><b>${item.level === 'unavailable' ? 'Not on phones' : 'Limited on phones'}:</b> ${esc(item.note)} ${item.handoff ? `<span>${esc(item.handoff)}</span>` : ''}</p>`;
}
