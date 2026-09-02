# UX/UI current-state audit (UX-00)

**Audit date:** 2026-09-02
**Live code baseline:** `main` at `f9c417659918bc800702fc2a3d50e98161d274f3` (the checked-out `work` branch had the same commit before this documentation-only change).

## Method and scope

This is a code-led audit, not a restatement of older UX notes. It covered `README.md`, `package.json`, all editor/runtime modules, unit and Playwright tests, existing docs, and all workflows. The live product is a browser-only Vite/ES-module application, deployed under `/Boop-mascotte/`; there is no backend. The exported runtime is a separate module.

## Current architecture and ownership

| Layer | Reality observed | UX consequence | Decision |
|---|---|---|---|
| `ProjectDocument` | Schema-v3 authored domains: artwork, layers, rig, state machine, semantic rig and animation clips | Durable product concepts must map deliberately to this contract | **KEEP** |
| `EditorSession` | Selection, workspace, active semantic part/control/state/clip, playhead, auto-key, focus mode | Correct home for transient navigation/selection; extend rather than persist UI state in the project | **KEEP / IMPROVE** |
| `PreviewSession` | Running/playing state, clocks, live/effective params, transient transition/behavior/errors | Supports non-destructive test surfaces | **KEEP** |
| Commands/history | Domain-scoped explicit mutations; continuous transactions; undo/redo | Every authored workflow needs commands before UI | **KEEP** |
| Runtime | Frame compiler, expressions, constraints, morphs, states, transitions, behaviors | Powerful foundation, but its vocabulary currently leaks into navigation | **HIDE ADVANCED** |
| UI | Modular vanilla JS controllers, but a large inline HTML/CSS composition and imperative renders | Incremental slices are feasible; shell/style decomposition is debt | **IMPROVE** |

**Non-negotiable ownership rule:** workspace, opened panels, search query, popovers, drawers, bottom-sheet detents and command-palette state are UI/session preferences. They must never enter `ProjectDocument`. Authored persistent changes use explicit commands. Preview must never write authored state. Exported runtime remains UI-independent.

## Current shell map

```text
Top bar: brand | Create Rig Animate Preview | project/file actions | Problems | Save | Export
Main:    left panel (task/navigation) | Canvas + toolbars | right panel/inspectors
Animate: main above + bottom Timeline (resizable/collapsible)
Preview: Canvas | preview actions; optional focus mode
Dialogs/popovers: replacement confirmation, state/behavior/timeline creation, export, file menu
```

CSS uses 260 / flexible / 310 px desktop columns. At <=900 px the right panel overlays. At <=600 px both panels become floating lower panels while tabs remain in a wrapping top bar. This is responsive rearrangement, not a mobile task model.

## Surface inventory and disposition

| Element | Current implementation and UX | Decision | Target |
|---|---|---|---|
| Workspaces/navigation | Four engine-adjacent tabs: Create, Rig, Animate, Preview; Save/Export global | **REPLACE** | Home + task-first Project tree; Advanced separated |
| Top bar | Dense file, history, status, problems, export and workspace controls | **IMPROVE** | Project identity/history + compact mode/action affordances; overflow by width |
| Left panel | Changes meaning per workspace; layers, semantic navigator, animation/state navigation compete | **IMPROVE / MOVE** | Stable task navigation plus workspace-specific collection/list |
| Canvas | Central SVG.js selection/transform/morph/pivot/role-pick surface; zoom/fit; preview interaction is disabled in author modes | **KEEP / IMPROVE** | Always dominant, mode banner and direct assignment cues |
| Right panels | Generic SVG Inspector, Rig inspector, author inspectors and preview controls can coexist | **MERGE** | Exactly one contextual Inspector determined by selection + task |
| Bottom panel | Timeline only in Animate; dense dope sheet and clip navigation | **KEEP / HIDE ADVANCED** | Contextual bottom surface; Timeline for advanced motion |
| Dialogs/popovers | Native dialogs plus file/export popovers; locally managed focus/close behavior | **IMPROVE** | Shared focus, escape, restore-focus, destructive confirmation rules |
| Templates | Basic/Expressive/Talking project templates plus feature installation | **KEEP / MOVE** | Home/New Mascot; explain included readiness/capabilities |
| Face Builder | Complete-face starters and atomic brow/lid additions | **IMPROVE / MOVE** | Artwork onboarding, never confused with Face Setup |
| Layers | Nested filter, select, visibility, lock, rename/order | **KEEP** | Artwork left collection; role badge and advanced tree detail |
| Inspector | Element transform/display, bindings, constraints, morph details | **MERGE / HIDE ADVANCED** | SVG selection inspector; internals in Advanced disclosure |
| Rig | Parts catalog, role picking, controls, calibration, generated internals | **REPLACE (label) / IMPROVE** | Face Setup; guided role assignment then movements/calibration |
| Semantic Parts | Head, eyes/gaze/eyelids/brows/nose/mouth/jaw/ears/hair/accessory definitions and roles | **KEEP / MOVE** | Face Setup model, with Basic required roles first |
| Semantic Rig | Generates bindings/morph drivers and owns calibration metadata | **KEEP / HIDE ADVANCED** | Product controls/keyforms front; generated implementation inspectable only |
| Face Controls | Live sliders and human labels; control catalog is broader than novice needs | **IMPROVE** | Basic set first; “More controls” progressive disclosure |
| States | Pose snapshots, create/duplicate/rename/delete/initial state | **HIDE ADVANCED** | Runtime State Machine; do not relabel states as Expressions |
| Transitions | Directed graph, timing/easing and guards | **HIDE ADVANCED** | Advanced State Machine/Reaction mapping details |
| Behaviors | Blink and oscillator catalog/inspectors | **REPLACE (presentation)** | Idle & Automatic: Blink, Natural gaze, Idle head movement |
| Timeline | Multi-clip dope sheet, playhead, auto-key, keys, clipboard, resize/collapse | **KEEP / MOVE** | Advanced editor for complex Motion; simple Motion presets above it |
| Preview | Non-destructive live params, examples, states/transitions/behaviors and focus | **IMPROVE** | Test environment organized by product concepts + event simulator |
| Problems | Validation count/popover and export policy; errors can block | **REPLACE** | Readiness sections with severity, rationale and “Fix” deep link |
| Export | Separate downloads for `mascot.svg`, `rig.json`, `runtime.js` | **KEEP / IMPROVE** | Readiness-gated Export workspace; formats unchanged |
| Save/Open | Project JSON snapshot; import/replacement lifecycle guarded | **KEEP / IMPROVE** | Home recent/open and global save state; browser file caveats explicit |
| Responsive | Breakpoints collapse/overlay existing panels | **REPLACE** | Desktop/laptop/tablet/mobile strategies, not stacked desktop |
| Accessibility | Some labels, roles, focus-visible, keyboard handlers and native controls; graph hidden on small screens | **IMPROVE** | Landmark/focus model, names/status announcements, contrast and reduced motion audits |
| Keyboard | Undo/redo, delete/cancel and timeline shortcuts exist but no discoverable map | **IMPROVE** | Context-scoped shortcuts, shortcut help and command palette |

## Usability findings

1. **The implementation model is the IA.** A beginner must infer relationships among semantic parts, parameters, bindings, states, clips and behaviors before achieving “eyes look left.”
2. **The semantic rig is already the bridge.** Role picking, generated bindings and capture calibration make Face Setup viable without a schema rewrite.
3. **“Animate” conflates pose, time and runtime logic.** States, clips, transitions and behaviors are technically distinct but not organized as Expression, Motion, Reaction and Automatic.
4. **Selection ownership is ambiguous.** Canvas selection can imply layer, part or inspector context while multiple controllers retain local selections.
5. **Preview is technically sound but product-incomplete.** It composes state, clips, behaviors and live overrides without document writes, yet it lacks a coherent event/reaction test story.
6. **Validation is late and technical.** Problems/export policy exists, but completion is not visible across the workflow and diagnostics lack universal deep-link metadata.
7. **Mobile preserves too much authoring chrome.** It offers panels rather than prioritized mobile jobs.
8. **Large inline CSS and HTML are migration friction.** Functional modules are testable, while shell composition/styles need gradual extraction—not a framework rewrite.

## Accessibility and keyboard audit

Positive baseline: native buttons/inputs/dialogs, visible `:focus-visible`, several ARIA list/tree/listbox labels, Escape cancellation, and keyboard-tested timeline/history. Gaps: no skip/landmark strategy; icon/name consistency is uneven; local `innerHTML` rerenders can lose focus; selection/status announcements are incomplete; graphs and canvas operations need keyboard equivalents; tooltip/help conventions are absent; minimum touch targets are not systematic; reduced-motion and high-contrast behavior are undocumented.

## Framework audit

| Choice | Fit now | Cost/risk | Recommendation |
|---|---|---|---|
| Modular Vanilla JS | Existing architecture, zero new runtime, direct browser/Pages fit, current tests understand it | Imperative lifecycle and manual focus/render discipline | **Retain through the refactor**; extract controllers/views and shared primitives |
| Web Components | Native encapsulation and incremental adoption | Shadow DOM styling/accessibility/testing complexity; no current base | Pilot only if a genuinely reusable isolated primitive proves value |
| Preact | Small and testable component model | Dual rendering paradigms and migration layer | Reassess after UX-12, not now |
| React | Ecosystem and predictable component composition | Highest migration/bundle/tooling cost for this small client | Do not migrate |
| Vue | Approachable templates/reactivity | Full second architecture and migration | Do not migrate |
| Svelte | Compact compiled UI | Build/compiler migration and mixed ownership | Do not migrate |

No strong evidence justifies migration. Framework choice does not solve IA, command ownership or selection semantics.

## Baseline debts/dependencies discovered

- Expression, Reaction and simple Motion are not first-class schema concepts.
- Existing `states` can approximate poses, and clips approximate motion, but silently aliasing them would create semantic and migration debt.
- Behavior catalog currently supports blink and generic oscillator, not the complete proposed Automatic vocabulary.
- Auto-detection has ID/name preset heuristics but no confidence-scored geometry/hierarchy service.
- Readiness diagnostics need stable codes, target routes and selection payloads before reliable deep links.
- Autosave exists locally but recovery, quota/privacy communication and recency UI need definition.
- Search/command palette and true mobile editing do not exist.

## DoD assessment

Repository and baseline audited; current architecture/workspaces mapped; functionality and flows inventoried in companion documents; external benchmark and A/B/C comparison completed; target desktop/tablet/mobile and feature destinations defined; schema/runtime implications called out; dependency-ordered PR roadmap includes tests, risks and rollback. No runtime, schema, exports, workflow or framework changed in UX-00.
