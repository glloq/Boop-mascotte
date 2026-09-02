# UX/UI product architecture

## Decision

Adopt an **adaptive hybrid task-first editor (Option C+)**: a resumable guided checklist inside persistent workspaces. It is neither a forced wizard nor seven equal top-level workspaces. Canvas remains the center; beginners follow readiness-backed next actions, while experts jump directly and reveal Advanced tools.

## Options compared

Scores: 1 poor, 5 strong. Complexity is scored as ease of implementation (5 easiest).

| Criterion | A Wizard | B Full workspaces | C Hybrid task-first | Finding |
|---|---:|---:|---:|---|
| Beginner comprehension | 5 | 3 | 5 | Guided next actions preserve a mental model |
| Few steps | 2 | 4 | 4 | Wizard forces revisits; hybrid skips optional work |
| Discoverability | 4 | 4 | 5 | Checklist plus stable destinations wins |
| Canvas space | 4 | 3 | 4 | Hybrid can collapse nav and context |
| Scalability | 2 | 5 | 5 | Wizard branches poorly as Motion/Automatic grow |
| Expert usage | 1 | 5 | 5 | Direct navigation and Advanced are essential |
| Tablet/mobile | 3 | 2 | 4 | Hybrid can turn checklist into drawer/bottom sheet |
| Implementation ease | 2 | 3 | 4 | Existing workspace state can migrate incrementally |
| Legacy migration | 2 | 3 | 5 | Existing panels can be routed behind destinations |

**Rejected:** A as the sole IA because editing is cyclical; B because it gives optional Motion the same weight as Artwork and overloads navigation. **Selected:** C+, with `Animate` removed as an intermediate label and a guided “Next recommended task” rail.

## Target hierarchy and terminology

```text
HOME
  New Mascot · Open Project · Recover autosave · Templates

PROJECT
  Artwork
  Face Setup
  Expressions
  Reactions
  Motion             (optional; hidden until created or explicitly added)
  Idle & Automatic   (optional)
  Preview
  Export

ADVANCED (collapsed and user-revealable)
  Parameters · Bindings · Constraints · Morphs
  Timeline · State Machine · Diagnostics
```

“Animate” is removed because users should choose the outcome. “Rig” becomes “Face Setup.” “Problems” becomes “Readiness.” “States” remains an Advanced runtime term. Expressions are poses; Motions change over time; Reactions coordinate a trigger, Expression, optional Motion, timing and return policy.

## Stable composition rules

- **Global navigation:** Home/back, project name/save status, undo/redo, Preview, Export/readiness; overflow absorbs low-frequency file actions.
- **Left navigation:** project task tree and, when useful, a second-level collection (layers, expressions, reactions). It never becomes an inspector.
- **Canvas:** largest continuous region; direct selection, mode instruction, zoom/fit and safe transient previews.
- **Context Inspector:** one selected subject yields one inspector. Selection state is centralized in `EditorSession`; stale local selection is cleared on route/project changes.
- **Bottom surface:** closed by default except where time/event context is essential; Timeline is advanced. On tablet it becomes a sheet.
- **Dialogs:** only blocking confirmation, creation with required fields, or focused multi-step import; routine edits remain contextual.
- **Advanced:** user-enabled progressive disclosure, deep-linkable from diagnostics, never required for normal templates.
- **Preview:** dedicated test environment with live controls, Expression/Motion/Reaction launchers, behaviors, event simulator, reset and focus.
- **Export:** a workspace, not only a button; shows readiness, formats and privacy/portability. Artifacts stay unchanged.

## One selection → one Inspector

| Selection | Inspector sections | Advanced disclosure |
|---|---|---|
| SVG element/layer | Transform, Appearance, Face role | bindings, constraints, morph/raw ID |
| Face role | Assignment, detected candidate/confidence, movement readiness | generated driver |
| Semantic control | Test value, keyforms/capture | parameter range/generated binding |
| Expression | Name, intensity preview, controls | raw control values/mapping |
| Motion | Preset/parameters, duration, loop | Open in Timeline |
| Reaction | Trigger, Expression, Motion, timing/after | priority/interrupt/runtime mapping |
| Readiness issue | Explanation, impact, Fix action | diagnostic payload |

## Product abstractions mapped to V2

- **Face Setup:** semantic parts/roles remain authored data. An editor-only assignment flow selects a role then canvas element. Detection produces suggestions only; acceptance uses semantic-rig commands.
- **Basic controls:** filtered view over existing semantic control registry/params (`headX`, `headY`, `headTilt`, `lookX`, `lookY`, `eyeOpen`, `browRaise`, `mouthOpen`, `smile`, `frown` where supported). Unsupported controls are not fabricated.
- **Calibration/keyforms:** capture transforms or morph endpoints into current semantic calibration; generated bindings remain inspectable. Neutral/low/high capture uses existing command/history boundaries.
- **Expressions:** new product entity required eventually. Do not map one-to-one to State without an ADR: State includes runtime graph identity/transition semantics, while Expression is reusable pose data plus intensity behavior.
- **Motion:** simple presets may compile to `animationClips`; Timeline remains canonical complex clip authoring. Preset metadata may require editor data/schema evolution.
- **Reaction:** requires an authored orchestration model and runtime event/interrupt semantics. UI prototypes must precede schema/runtime ADR.
- **Idle & Automatic:** friendly views over behaviors where semantics match; additions beyond blink/oscillator require runtime work.

## Auto-detection proposal

Rank candidates, never auto-commit:

1. Exact normalized SVG ID/layer-name aliases (`left-pupil`, `pupilLeft`, etc.).
2. Hierarchy names and sibling pairing.
3. Position relative to SVG viewBox/head candidate (left/right is mascot-relative and previewed).
4. Geometry hints (paired similar shapes, pupil contained by eye).
5. Confidence and reason displayed; ambiguous or low-confidence items require click assignment.

Every accepted suggestion is a normal authored command, undoable individually or as one confirmed batch. Imported markup remains sanitized.

## Layout diagrams

### Desktop large (>=1280 px)

```text
┌ Project/status/actions ───────────────────────────────────────────────┐
├ Task nav 240 ┬──────────── Canvas (dominant) ────────────┬ Inspector 320 ┤
│ task tree    │ direct select + contextual mode banner   │ one context   │
│ collection   │                                          │               │
├──────────────┴ optional contextual bottom/Timeline ─────┴───────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

### Laptop (900–1279 px)

```text
┌ compact top bar + overflow ────────────────────────────────────────────┐
├ collapsible nav ┬──────────── Canvas ───────────────┬ inspector overlay ┤
└─────────────────┴ optional collapsible bottom ──────┴───────────────────┘
```

### Tablet (600–899 px)

```text
┌ top app bar: menu | project | Preview | readiness ┐
│                    Canvas                          │
│                                                   │
├ contextual bottom sheet (collapsed/half/full) ────┤
└ task navigation drawer ────────────────────────────┘
```

### Mobile (<600 px)

```text
┌ project | mode | more ┐
│ full-width Canvas / Preview                        │
│ task-specific compact controls                    │
├ bottom navigation: Preview Expressions Reactions Export ┤
└ modal sheet for list/inspector; one sheet at a time ┘
```

Mobile intentionally prioritizes preview, selecting/applying Expressions, firing/editing simple Reactions, small parameter changes, readiness fixes that are touch-safe, save and export. Raw SVG editing, role geometry detection review, morph node editing, graph editing, complex Timeline and constraints are view-only or hand off to a larger screen.

## Framework decision and guardrails

Continue modular Vanilla JS. Extract shell state, navigation, selection routing and view primitives behind narrow interfaces. Do not couple exported runtime to UI dependencies. Reassess a view library only after multiple vertical slices demonstrate measurable lifecycle/testability pain; require an ADR comparing bundle, migration, accessibility and dual-stack removal.
