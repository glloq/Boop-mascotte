# UX-03 — Home and project entry

## Baseline

UX-03 is based on `e88987162fbcb05e52e23671e163d9cce55b54b0` (merged UX-02.1). The repository Verify gate passed locally before implementation. The recorded upstream Browser E2E run is `33642068205` and Pages run is `33642068253`; this environment could not query GitHub or launch the downloaded Playwright browsers.

## Ownership and navigation

Home is a dedicated application-level surface owned by `AppShell`. Its open flag and loaded-project flag are transient closure state. Home is deliberately absent from `ProjectDocument`, `EditorSession.workspace`, workspace preferences, and the Task Router. The router continues to own only project tasks. Opening Home therefore changes no authored data, revision, history, dirty, selection, or task state; Back only closes the surface.

First boot opens Home and focuses Basic Face. The explicit global Home button opens it without replacement. Escape closes Home only when a project exists. The legacy canvas empty state and File menu remain as rollback paths.

## New

Previously New Project ran replacement confirmation and then used `location.reload()`. It now opens Home and focuses the template catalog. Basic, Expressive, and Talking cards are UI metadata over the existing `PROJECT_TEMPLATES`. Selecting a card is the replacement intent and uses `commitProjectReplacement`; cancellation leaves the active project untouched. Success loads the existing template transaction in process, establishes one clean baseline, closes Home, and routes to Artwork.

## Open

Home and File menu share the existing load handler and real file input. JSON parsing, snapshot version/schema normalization, and SVG sanitization happen before `commitProjectReplacement`, so an invalid file cannot display a destructive confirmation or mutate the active project. Successful replacement closes Home and routes to Artwork; snapshot UI navigation is not restored.

## Local recovery

The storage key remains `boop-mascotte-autosave-v1`. The canonical record is `{ savedAt, projectSnapshot }`; a bare legacy snapshot is accepted. The reader deterministically reports `none`, `available`, or `invalid`, normalizes valid timestamps, tolerates missing/invalid timestamps, and contains JSON, snapshot, and storage-read errors.

Invalid data is never deleted on boot. Home reports that it cannot be read and offers explicit Discard. Recovery is stored only in the current browser and is not cloud-synced.

The previous sequence established a saved baseline (which discarded recovery) before marking a restored recovery dirty. That could remove the only copy while leaving an unsaved document. Recovery replacement now establishes its baseline with `keepRecovery`, then marks the active document recovered and dirty. A later successful autosave may update the record and explicit Save may clear it. New and Open clear recovery only after successful replacement.

## Consistency, focus, and atomicity

All successful New, Open, and Recover operations normalize through `taskRouter.navigate('artwork')`, keeping Shell, EditorSession, Canvas, and Context Inspector on Artwork. Candidate preparation and confirmation cancellation occur before the replacement commit. Home focuses its heading or Basic Face; the existing dialog restores initiating focus after cancellation; successful entry focuses the active task tab rather than body.

## Tests and rollback

Node tests cover no record, wrapped and bare formats, timestamps, corrupt JSON, invalid/unsupported snapshots, explicit discard, writes, and storage exceptions. Browser coverage checks first-run entry, Basic Face creation, Artwork routing, and non-destructive Home round trips. Existing replacement tests retain cancellation, save failure/no-commit, rollback, history, and baseline contracts.

Rollback is to hide/disable Home; the canvas empty state, template controls, Open Project, Import SVG, and File menu remain operational.

## Schema, runtime, export, and limitations

ProjectDocument schema impact is none. Runtime and export artifact contracts are unchanged (`mascot.svg`, `rig.json`, `runtime.js`). There is no project naming, recent-files browser, cloud sync, or File System Access persistence. UX-04 may consolidate Artwork entry surfaces later; it must retain the shared replacement and task-normalization boundaries established here.
