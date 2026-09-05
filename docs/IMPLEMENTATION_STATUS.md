# Implementation status

Updated 2026-09-05 after the system audit (`docs/SYSTEM_AUDIT_2026-09.md`); per-slice records of the UX program are listed in `docs/UX_UI_IMPLEMENTATION_ROADMAP.md`.

## Rigging audit complete

- Pins are placed, dragged, reached, mirrored and grouped under one movement from Face Setup → Pins & holding and the canvas menu (`docs/FACE_CONTROL_RIG.md`, "Authoring pins"); any path, sub-parts included, can be pinned, and a basic shape converts to a path. Movements split into one control per side from their Advanced section. Statuses say what moves already. Findings and resolutions: `docs/RIGGING_AUDIT_2026-09.md`.

## Drawing and editing rework complete

- Drawing from nothing (`docs/VECTOR_EDITING.md`): a **Blank canvas** on Home; Pen with curves, Line, Rectangle, Ellipse, Polygon / Star and Text with Shift / Alt modifiers; an options bar for paint, sides, text, grid and snapping; the preview measured against the artwork matrix and clipped to the working area; bezier handles, Curve / Straight / Smooth / Corner and Delete point under the Node tool.
- Several pieces at once: Shift + click, marquee, Ctrl/Cmd + A, group drag as one undo step, Align / Spread / Group, nudge and Delete on the set; the Layers highlight it and the Inspector counts it. A set moves only — rotate or scale several by grouping them first.

## System audit complete

- One grouped navigation (Create: Artwork, Face Setup · Animate: Expressions, Motions · Behaviors: Reactions · Publish: Preview), one panel per step, the States / Behaviors editor folded under Motions, duplicate controls removed or renamed, every route landing on a visible panel, phones keeping Undo / Redo / Problems / Search in the ••• menu, `rig.json` import.
- Artwork Inspector rebuilt for editing: fields that keep focus and one undo step per gesture, fill / stroke with None, opacities, line ends, dashes, shape geometry and text, plus nudge, copy / paste, to front / to back, flip, and wheel pan / zoom on the canvas.

## UX program complete

- Task-based shell (Home → Artwork → Face Setup → Expressions / Motions / Reactions → Preview → Export) with the contextual Inspector, Advanced hub and command palette.
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
