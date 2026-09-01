# Implementation status

Updated 2026-09-01 from audited base `f83f5e22332c36723c2f708ad70284be1e26f4d9`.

## V1 complete

- Browser-only Create, Rig, Animate, States/Transitions, Behaviors, and Preview authoring.
- Semantic Parts, visual role assignment, transform calibration, compatible-topology morph capture, and human control labels.
- Dope-sheet clip/key authoring, Auto Key, timeline clipboard, marquee/group operations, and resizable/collapsible timeline.
- State/transition and Behavior authoring with structured inspectors.
- Non-destructive preview composition of state, clip, behaviors, transition, and live overrides.
- Sanitized SVG import, atomic project replacement, JSON project snapshot round-trip, local recovery autosave, and schema-v3 runtime export.
- Derived readiness, canonical normalized validation, first-class Problems, deep-link context, export-blocking policy, and export manifest.

## V1 partial

- Phone supports critical workflows, but precision path/timeline work remains desktop-oriented.
- Accessibility fundamentals exist; the complete modal focus-restoration and four-viewport manual pass remains a release gate.
- Dirty replacement uses the shared atomic guard, but the legacy replacement prompt still needs conversion from browser confirmation to the product dialog.

## Deferred post-V1

Runtime animation-clip promotion/schema v4, F-curves/tangents, mixer/layers, bones, meshes, physics, audio/lip sync, conditional/event scripting, network control, marketplace, cloud, and collaboration.

## Release gates

See [V1 release status](V1_RELEASE_STATUS.md). A V1 tag requires green Verify, Chromium critical, Firefox smoke, WebKit smoke, GitHub Pages, and Pages smoke checks plus responsive/accessibility sign-off.
