# UX-02 — Task router, selection context, and inspector outlet

## Baseline and scope

UX-02 starts from `main` at `28a12dcf582588b1551e831ef08fdfa2ce6d6ef3`. It is deliberately a foundation: it changes no `ProjectDocument` schema, exported runtime, export artifact, or product entity. Home, complete Artwork/Face Setup experiences, responsive sheets, and inspector redesign remain follow-up work.

Live GitHub Actions could not be queried from this environment because both web search and the GitHub API were rejected (HTTP 401/403). The baseline commit was verified locally and every repository gate was run after the change; this limitation must remain visible in the PR report.

## Architecture before UX-02

Navigation was owned by `app-shell.js`. Tabs, **Continue rigging**, `main.js` Problems/Fix, and helper code addressed the legacy `create`, `rig`, `animate`, and `preview` workspaces directly. `workspacechange` synchronized the shell preference and `EditorSession.workspace`. The latter remains the authoritative session navigation field.

Selection was spread across `selectedId`, `activeSemanticPartId`, `activeControl`, `selectedTrackParameter`, `selectedKey`, `activeStateId`, and `animationEditor.activeClipId`. The generic SVG inspector, Rig panel, state editor, timeline, and Preview controls interpreted those fields independently. CSS selected which right-panel fragments happened to be visible. There was no single answer to “what is being edited?” and Problems/Fix patched workspace and selection fields itself.

## Task router

`ui/task-router.js` owns the registry, normalization, metadata, legacy mapping, navigation idempotency, and typed deep-link normalization. Canonical navigable IDs are `artwork`, `face-setup`, `animate`, and `preview`. Reserved non-navigable metadata entries are `export` and `advanced`.

| Legacy workspace | Canonical task |
| --- | --- |
| `create` | `artwork` |
| `rig` | `face-setup` |
| `animate` | `animate` |
| `preview` | `preview` |

Visible tab labels intentionally remain **Create**, **Rig**, **Animate**, and **Preview**: Create and Rig are legacy UI aliases until UX-04 and UX-05 make the new names truthful. Tabs and Continue rigging emit intent to the router. `shell.setWorkspace()` remains a rollback/compatibility adapter and the one place that persists and emits a workspace change.

There is no `router.currentTask` storage. `EditorSession.workspace`/the shell workspace preference remains authoritative, and `currentTask` is derived each time. Repeating a route does not write the workspace or emit a redundant event. Existing `boop-mascotte-ui-v2` preferences accept either legacy workspaces or canonical task IDs and normalize to the current legacy workspace representation; a saved `rig` and a saved `face-setup` both reopen Rig.

A route accepts a task and optional target. Supported target kinds are artwork element, semantic part, semantic control, animation clip, timeline track, timeline key, state, and diagnostic. Unknown target kinds are ignored rather than leaking arbitrary data into session state. Problems/Fix now activates its task through the router; its existing legacy field patch is retained until diagnostics publish typed targets.

## Selection context

`ui/selection-context.js` derives one active context without replacing specialized session state. It also provides session-only selection intents and target-to-session adapters.

Precedence is task-scoped and deterministic:

* Artwork: artwork element, otherwise none.
* Face Setup: semantic control, then semantic part, otherwise none.
* Animate: timeline key, timeline track, state, clip, otherwise none.
* Preview: none; Preview actions remain a task surface, not another selection inspector.

Thus an SVG element and Gaze can remain remembered for task continuity, but only Gaze is active while Face Setup is current. Selection intents mutate only `EditorSession`; they never invoke history, document mutation, dirty tracking, revision changes, or autosave authored writes.

## Contextual inspector

The right panel now hosts one presentation-independent `#context-inspector` outlet. Its adapters reuse the existing Rig panel (`semantic`) and generic SVG Advanced inspector (`artwork`); Preview actions remain visibly separate. The outlet exposes a stable heading, context kind/id diagnostics, and concise empty copy. The state editor and timeline remain in their existing surfaces in this foundation and will receive fuller adapters in later UX slices.

The context resolver does not depend on a desktop right panel, so a later tablet bottom sheet or mobile sheet can host it without changing routing or selection ownership.

## Focus policy

Ordinary navigation and selection do not move focus: the clicked tab/control retains normal browser focus and programmatic routes do not send focus to `body`. The outlet heading is programmatically focusable for a future explicit Fix handoff, but UX-02 does not focus it because current diagnostic targets are not precise enough to guarantee an actionable destination. Problems itself retains its existing accessible close-button focus behavior.

## Ownership, rollback, and audit

Task, workspace preference, route target, selection, collapsed panels, and inspector context are UI/session state. None is serialized to `ProjectDocument`. Router and selection tests pin document/history/revision/dirty sentinels while navigating and selecting. Existing store ownership tests continue to cover document version tokens and Undo/Redo isolation.

Rollback is localized: bind shell navigation directly to the legacy `setWorkspace` adapter and remove the derived outlet renderer. No Create, Rig, Animate, Preview, inspector, timeline, state, or runtime implementation was removed.

Direct navigation classification after this PR:

* Migrated: workspace tabs, Continue rigging, Problems/Fix, and the opt-in E2E product adapter.
* Compatibility adapter: `app-shell.setWorkspace`, `workspacechange`, `data-workspace`, and `EditorSession.workspace`.
* Legitimate legacy: CSS workspace presentation rules, canvas workspace mode, keyboard workspace checks, and historical E2E helpers (`goToCreate`, etc.).
* Follow-up: template-builder self-navigation and any domain component that needs a typed target once UX-04/UX-05 define it.

## Tests and known limitations

Dedicated Node tests cover canonical/legacy normalization, fallback, compatibility conversion, idempotency, preference migration, typed targets, all principal selection contexts, conflict precedence, and ownership sentinels. The UX-01 product journeys and browser suites remain unchanged in objective.

Known limitations are intentional: visible Create/Rig labels remain; animation/state inspector content is not moved; diagnostic fixes still adapt their legacy context fields after routing; `export` and `advanced` are registry metadata only; no responsive redesign is included.

UX-03 may depend on the router registry and navigation intent contract, but must first inspect the newly merged `main` and its gates. UX-03 owns the Home / New / Open / Recover vertical slice and must not expand this PR.
