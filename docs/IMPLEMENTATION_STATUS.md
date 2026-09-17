# Implementation status

Updated 2026-09-17 after the V4 programme (`docs/V4_ROADMAP.md`,
`docs/V4_RELEASE_NOTES.md`); previously updated 2026-09-10 after the Character Builder program (`docs/CHARACTER_BUILDER.md`); per-slice records of the UX program and of the Character Builder program are listed in `docs/UX_UI_IMPLEMENTATION_ROADMAP.md`.

## V4 complete — a mascot can be made of pictures

- **Raster artwork** (`docs/V4_ROADMAP.md`, Phases 1–5): PNG and WebP imported as
  pieces or as the head/body everything is placed on, from Home, from the
  Artwork column or by dropping a file on the canvas; replaced without losing
  the rig; cut to another picture's alpha; deduplicated by content; never
  carried inside the document (`ASSET-REF`), so undo stays cheap, the autosave
  snapshot stays JSON and the sanitizer's no-external-references rule stays
  literally true. A whole project saves as one `.boop` package, pictures
  included.
- **Meshes** (Phase 7): a picture bends on a 3×3 or 4×4 grid of draggable
  points, driven by a parameter, rendered as clipped affine triangles of the
  same `<image>`.
- **The IF** (Phase 9): a reaction runs *only if* its conditions hold — a
  movement against a number, or the state the mascot is in, joined with `and`.
  Named in `requires` as `reaction:condition`, because a runtime that ignores a
  condition fires the reaction unconditionally.
- **The state graph** (Phase 10): positions are authored data — dragged, saved,
  undone — with pan, zoom, fit, drawn links, marquee selection, groups, notes,
  auto-arrange, and a live highlight on the state the mascot is in and the
  transition playing.
- **The matrix** (Phase 11): five reference mascots — paths, pictures, both,
  a photograph with features on it, and a bent picture behind an alpha mask —
  run through versioning, round-trips, `.boop`, export, runtime parity,
  deduplication, sanitising and corruption in
  `project/editor/core/tests/v4-matrix.test.js`.

## Character Builder complete

- **Character** is the first step of Create and the simple surface (`docs/CHARACTER_BUILDER.md`): the parts a person names as a list and on the mascot, moved, resized, recoloured and swapped for a style from the face part library on the same canvas and the same document, with Edit Shape and Advanced leading to the full tools; a pair edited as one; every action one undo step.
- The face part library (`docs/FACE_PART_LIBRARY.md`): forty-two built-in assets in nine categories, fitted onto any face at its size, the part's movements kept through a replacement (every asset's movements driven through the runtime in a test); palette tokens; six face style presets carrying parts, accessories, colours, hands and placements (`docs/FACE_PRESETS.md`); a jaw on every library skull.
- The author's own (`docs/CUSTOM_FACE_PARTS.md`): a piece saved as a library part, a reshaped instance read as custom, presets saved from the face, face packs imported all or nothing, all kept in the browser; old projects opened with their library parts recognised.
- Hands placed like any piece with depth and mirror, their drawings as cards; New Character on Home lands in the builder with the presets open, and the browser test walks preset → parts → hands → Preview under a minute; drag and drop, arrow keys, touch-size targets, pictures drawn once.

## Rigging audit complete

- Pins are placed, dragged, reached, mirrored and grouped under one movement from Face Setup → Pins & holding and the canvas menu (`docs/FACE_CONTROL_RIG.md`, "Authoring pins"); any path, sub-parts included, can be pinned, and a basic shape converts to a path. Movements split into one control per side from their Advanced section. Statuses say what moves already. Findings and resolutions: `docs/RIGGING_AUDIT_2026-09.md`.

## Drawing and editing rework complete

- Drawing from nothing (`docs/VECTOR_EDITING.md`): a **Blank canvas** in Artwork → Add / Create artwork; Pen with curves, Line, Rectangle, Ellipse, Polygon / Star and Text with Shift / Alt modifiers; an options bar for paint, sides, text, grid and snapping; the preview measured against the artwork matrix and clipped to the working area; bezier handles, Curve / Straight / Smooth / Corner and Delete point under the Node tool.
- Several pieces at once: Shift + click, marquee, Ctrl/Cmd + A, group drag as one undo step, Align / Spread / Group, nudge and Delete on the set; the Layers highlight it and the Inspector counts it. A set moves only — rotate or scale several by grouping them first.

## System audit complete

- One grouped navigation (Create: Artwork, Face Setup · Animate: Expressions, Motions · Behaviors: Reactions · Publish: Preview), one panel per step, the States / Behaviors editor folded under Motions, duplicate controls removed or renamed, every route landing on a visible panel, phones keeping Undo / Redo / Problems / Search in the ••• menu, `rig.json` import.
- Artwork Inspector rebuilt for editing: fields that keep focus and one undo step per gesture, fill / stroke with None, opacities, line ends, dashes, shape geometry and text, plus nudge, copy / paste, to front / to back, flip, and wheel pan / zoom on the canvas.

## UX program complete

- Task-based shell (Home — a preset or the mascot as it comes — → Artwork → Face Setup → Expressions / Motions / Reactions → Preview → Export) with the contextual Inspector, Advanced hub and command palette.
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
