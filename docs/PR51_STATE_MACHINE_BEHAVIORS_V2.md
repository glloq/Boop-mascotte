# PR #51 — State Machine & Behaviors V2

## Exact green baseline

- `main`: `8c84b5fff7509713e01ce0ab6b23f7af85f3add4`
- Verify run `33592497225`: **SUCCESS**
- Browser E2E run `33592497292`: **SUCCESS** (`chromium-critical`, `stability`, and `cross-browser-smoke`: **SUCCESS**)
- Pages run `33592497204`: **SUCCESS** (`build`, `deploy`, and `smoke`: **SUCCESS**)

This was the first fully green baseline after PR #50.

## Legacy audit

The exact pre-edit search found 69 call-site occurrences: 11 `store.setState`, 9 `store.replaceState`, 49 `store.getState`, and 0 `store.subscribe(`. Classification: State Machine panel had 2 authored mutation occurrences and 4 flat reads (A/B); `main.js` had 3 authored/test-seam mutations and 21 flat reads (A/B/D); the retired, unreferenced `preview-player.js` had 5 authored preview mutations and 7 reads (A/B); Layers had 7 read-side calls (B); remaining reads/adapters were cold integration, export, history, and tests (B/C/D). `replaceState` calls were history fallback and tests (C/D). The EditorStore compatibility methods themselves are definitions rather than matching call sites (E).

The post-edit search finds 51 occurrences: 5 `store.setState`, 9 `store.replaceState`, 37 `store.getState`, and 0 legacy `store.subscribe(`. The five `setState` calls are exclusively the opt-in `?e2e` seam (2) and unit tests (3). All nine `replaceState` calls are a cold History fallback (1) or unit tests (8). State Machine and Behavior production UI contain no flat reads or writes. The 37 reads are Layers (7, read-side debt), cold `main.js` save/export/recovery/keyboard/E2E integration (18), exporter/template/history adapters (6), and tests (6). Normal production authored `setState`/`replaceState` callers: **0**.

## Architecture and ownership

State and Transition commands use `store.execute()` with source `state-machine`, explicit `stateMachine` domain, and meaningful `state/*` or `transition/*` types. Behavior commands use the same boundary with source `behaviors`. Commands preflight a detached document before taking their snapshot, so failed validation cannot mutate the document or create phantom history. Snapshot history remains intentional; a UI transaction suppresses per-input snapshots, preserving one Undo entry per continuous gesture.

State selection is canonical `EditorSession.activeStateId`. Transition and Behavior selection remain explicitly panel-local transient UI state: transition identity is an edge string and Behavior identity remains an index because runtime-normalized behaviors have IDs but legacy imported identity constraints make a persistent selection migration inappropriate here. Author mode remains in EditorSession. None is ProjectDocument data.

“Current pose” retains the existing model contract: it captures authored `params[*].value`. It does not read PreviewController live overrides, preserving PR #49 PreviewSession isolation without redesigning capture semantics.

Parameter Add/Rename/Delete helpers are dormant model capability: the production panel only renders a read-only Advanced parameter summary. No parameter mutation UI is reachable, so PR #51 adds no parameter command or UI. Model tests retain coverage of their multi-domain reference behavior.

Test State, Test Transition, and Test Behavior remain PreviewController-only and do not enter the command boundary. The obsolete, unreferenced legacy `preview-player.js`, which persisted preview interactions, was removed; `preview-controller.js` is the active transient implementation.
