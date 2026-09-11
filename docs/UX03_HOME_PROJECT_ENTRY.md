# UX-03 — Home and project entry

## Baseline

UX-03 is based on `e88987162fbcb05e52e23671e163d9cce55b54b0` (merged UX-02.1). The repository Verify gate passed locally before implementation. The recorded upstream Browser E2E run is `33642068205` and Pages run is `33642068253`; this environment could not query GitHub or launch the downloaded Playwright browsers.

## Ownership and navigation

Home is a dedicated application-level surface owned by `AppShell`. Its open flag and loaded-project flag are transient closure state. Home is deliberately absent from `ProjectDocument`, `EditorSession.workspace`, workspace preferences, and the Task Router. The router continues to own only project tasks. Opening Home therefore changes no authored data, revision, history, dirty, selection, or task state; Back only closes the surface.

First boot opens Home and focuses its recommended card. Home is the canonical first-run entry surface. The explicit global Home button opens it without replacement. Escape closes Home only when a project exists — `closeHome` returns `false` with no project loaded, and that refusal is what stops an author interacting with an empty editor. The legacy Canvas empty state remains only as a migration/rollback fallback, alongside the legacy File menu.

Home covers the page from below the top bar (`.home-surface`, `inset: 58px 0 0`, `z-index: 80`). The top bar is `z-index: 90` and therefore stays usable while Home is open. That is load-bearing rather than incidental: it is what lets Home be narrow without stranding a returning author, and `ux03-home.spec.js` asserts it.

## New — a preset, or the mascot as it comes

Previously New Project ran replacement confirmation and then used `location.reload()`. It now opens Home and focuses its recommended card. Selecting a card is the replacement intent and uses `commitProjectReplacement`; cancellation leaves the active project untouched. Success loads the existing template transaction in process, establishes one clean baseline, closes Home, and routes.

Since V3-08 (`docs/V3_ROADMAP.md`) Home offers exactly two ways to have a mascot, which is the whole of what a first run has to decide:

- **New Character** (recommended) loads the Mascot Face template and routes to Character with the presets open (`loadTemplate('basic', { task: 'character' })`, `docs/CHARACTER_BUILDER.md`, "The one-minute path"). It is the focus target of `showHome({ focus: 'new' })`.
- **Mascot Face** loads the same template and routes to Artwork. It is UI metadata over the existing `PROJECT_TEMPLATES`, and `bindLoadSample` binds every `[data-template-id]` it finds, wherever it is.

Both call `projectService.loadTemplate`, so both inherit the same confirmation, rollback and baseline. Home knows no template id and no preset id.

## Open, Import, Blank canvas and the Face Builder — where they went

V3-08 moved all four off Home. None of them is "start a mascot with nothing of your own": two are coming back to work that exists, and two are replacing the artwork in front of you.

| Entry | Where it is now | Binding |
| --- | --- | --- |
| Open Project | ••• menu (over Home) | `bindLoadProject` → `#project-file` |
| Import SVG | ••• menu (over Home); Artwork *Import / Replace SVG* | `bindLoadSvg` → `#svg-file`, `#artwork-svg-file` |
| Blank canvas | Artwork → Add / Create artwork | `bindLoadSample` → `[data-template-id="blank"]` |
| Build a face | Artwork → Add / Create artwork | `bindGenerateFace` → `[data-face-builder]`, `#face-builder` |

The Face Builder had no second home, so it moved rather than being deleted: it sits with the other two things that replace the project's artwork (*Start over with the Mascot Face*, *Blank canvas*) in `buildStartArtworkSection`, one disclosure into Artwork. Home says in one line where each went, because on a first run Home is the screen.

`bindLoadSvg` and `bindLoadProject` lost their `#home-…` inputs with the markup; `app-shell.js` resolves every one of these through `mustQuery`, which **throws at shell construction**, so a deletion that missed a binding is an editor that never boots. `home-entry.test.js` holds every bound selector against the markup the shell renders.

The load handler and the real file inputs are unchanged. JSON parsing, snapshot version/schema normalization, and SVG sanitization still happen before `commitProjectReplacement`, so an invalid file cannot display a destructive confirmation or mutate the active project. Successful replacement closes Home and routes to Artwork; snapshot UI navigation is not restored.

## Local recovery

The storage key remains `boop-mascotte-autosave-v1`. The canonical record is `{ savedAt, projectSnapshot }`; a bare legacy snapshot is accepted. The reader deterministically reports `none`, `available`, or `invalid`, normalizes valid timestamps, tolerates missing/invalid timestamps, and contains JSON, snapshot, and storage-read errors.

Invalid data is never deleted on boot. Home reports that it cannot be read and offers explicit Discard. Recovery is stored only in the current browser and is not cloud-synced.

The previous sequence established a saved baseline (which discarded recovery) before marking a restored recovery dirty. That could remove the only copy while leaving an unsaved document. Recovery replacement now establishes its baseline with `keepRecovery`, then marks the active document recovered and dirty. A later successful autosave may update the record and explicit Save may clear it. New and Open clear recovery only after successful replacement.

## Consistency, focus, and atomicity

All successful New, Open, and Recover operations normalize through `taskRouter.navigate('artwork')`, keeping Shell, EditorSession, Canvas, and Context Inspector on Artwork. Candidate preparation and confirmation cancellation occur before the replacement commit. Home focuses its heading or New Character (`showHome({ focus: 'new' })`); the existing dialog restores initiating focus after cancellation; successful entry focuses the active task tab rather than body.

## Tests and rollback

Node tests cover no record, wrapped and bare formats, timestamps, corrupt JSON, invalid/unsupported snapshots, explicit discard, writes, and storage exceptions. `home-entry.test.js` covers what Home offers, that the moved entries arrived whole, that the recovery container and its Discard-not-delete contract survived, and that every element the shell binds exists in the markup it renders. Browser coverage checks first-run entry, the ••• menu over Home, Home's refusal to close with no project, Basic Face creation, Artwork routing, and non-destructive Home round trips. Existing replacement tests retain cancellation, save failure/no-commit, rollback, history, and baseline contracts.

Since V3-07 the browser suite reaches a project through the opt-in seam (`app/e2e-hooks.js`, `openProject`) rather than by clicking a card on Home, so Home's markup is no longer a contract the whole suite depends on. The specs that are *about* Home still press Home.

Rollback is to hide/disable Home; the canvas empty state, template controls, Open Project, Import SVG, and File menu remain operational.

## Schema, runtime, export, and limitations

ProjectDocument schema impact is none. Runtime and export artifact contracts are unchanged (`mascot.svg`, `rig.json`, `runtime.js`). There is no project naming, recent-files browser, cloud sync, or File System Access persistence. UX-04 may consolidate Artwork entry surfaces later; it must retain the shared replacement and task-normalization boundaries established here.
