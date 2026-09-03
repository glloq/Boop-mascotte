# Implementation status

Updated 2026-09-03 after the UX program (UX-01 → UX-23.1); per-slice records are listed in `docs/UX_UI_IMPLEMENTATION_ROADMAP.md`.

## UX program complete

- Task-based shell (Home → Artwork → Face Setup → Expressions / Animate / Reactions → Preview → Export) with the contextual Inspector, Advanced hub and command palette.
- Expressions, Motions and Reactions as product entities with runtime support (`rig.json` `expressions`, `animations`, `reactions`).
- Tablet and mobile layouts, accessibility gate, visual/layout/stress budgets, legacy UI removed with fixture parity.

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
- Accessibility: landmarks, skip link, shortcut help, Escape order and focus return are covered by `ux21-accessibility.spec.js`; forced-colors and 200 % zoom baselines remain manual checks.
- Dirty replacement uses the shared atomic guard and the product `#unsaved-dialog`; no browser `confirm`/`alert` remains in the editor.

## Deferred post-V1

Runtime animation-clip promotion/schema v4, F-curves/tangents, mixer/layers, bones, meshes, physics, audio/lip sync, conditional/event scripting, network control, marketplace, cloud, and collaboration.

## Release gates

See [V1 release status](V1_RELEASE_STATUS.md). A V1 tag requires green Verify, Chromium critical, Firefox smoke, WebKit smoke, GitHub Pages, and Pages smoke checks plus responsive/accessibility sign-off.
