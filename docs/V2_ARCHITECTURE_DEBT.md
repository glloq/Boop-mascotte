# Deferred V2 architecture debt

PR 38 deliberately stabilizes, rather than canonizes, the current architecture. Follow-up work remains:

- replace whole-project `structuredClone` mutations with ProjectDocument/EditorSession/PreviewSession and command/patch history;
- replace broad JSON string domain detection with domain revisions and a dirty dependency graph;
- add a compiled runtime and bounded precomputed animation/morph data rather than evaluating/parsing static definitions per frame;
- define blend shapes/keyforms and their migration only in a future schema proposal;
- redesign Face Setup separately from lifecycle work;
- design Expressions and Reactions after the core ownership model is established.

Schema version 3 and existing `mascot-project.json`/`rig.json` loading remain unchanged. The expression parser cache is now FIFO-bounded at 512 entries; a fixed rig cannot otherwise grow it after warm-up, but imported expression diversity warranted a defensive ceiling.

## PR45 foundation
ProjectDocument, EditorSession and controller-owned PreviewSession now have explicit ownership and domain revisions. Remaining authoring panels on the instrumented `setState` compatibility facade should be migrated command-by-command; snapshot history remains intentionally snapshot-based.
# PR 46 update

Normal template, Face Builder, SVG import, preset, project-open, recovery, and
rollback paths now use explicit V2 project replacement. Remaining legacy `setState`
callers are ordinary authoring panels (canvas edits, Inspector, semantic rig, State
Machine, Timeline), behavior/feature commands, compatibility tests, and the E2E
seam. Feature installation should next combine artwork append and semantic metadata
in one explicit multi-domain command. Runtime Compiler remains out of scope.

## PR 47 update

Timeline authored changes now use animation-domain commands and its transient controls
use EditorSession; production Timeline has no `store.setState` or flat `store.getState`
calls. Remaining production compatibility callers are canvas/Inspector, semantic rig,
State Machine, feature installation, and behavior commands. The `?e2e` seam retains
legacy mutation helpers (`mutate` and `setAuthoredTransform`) solely for test setup;
its read-only state API is an explicit V2 projection. History is still intentionally
ProjectDocument snapshot-based. Feature installation and behavior commands remain
future multi-domain command migrations.
# PR #48 status

- Timeline: V2 commands.
- Canvas: V2 authored artwork/layer commands.
- Inspector: V2 authored artwork commands.
- Semantic Rig: V2 authored multi-domain commands.
- Face Features: one atomic V2 multi-domain command.
- Remaining production compatibility: State Machine, Behaviors, the layer-panel compatibility surface, and precisely enumerated untouched `main.js` integration.
- History: still ProjectDocument snapshots; patch history is not started.
- Runtime Compiler: not started.
- Keyforms / blend shapes and Expressions / Emotes / Reactions: not started and out of scope.
