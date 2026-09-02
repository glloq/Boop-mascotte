# PR45 — Core Editor Architecture V2

## Ownership

```text
             ProjectDocument
            persistent/authored
                    |
             domain revisions
                    |
      +-------------+-------------+
      |             |             |
     UI        Validation      Autosave
      |
   Commands

              EditorSession
               transient
      selection/workspace/timeline UI

              PreviewSession
               transient
                    |
            PreviewController
                    |
                 Canvas
```

`ProjectDocument` owns `schemaVersion`, `svgMarkup`, `elements`, `layers`, `layerMetadata`, `params`, `states`, `transitions`, `transitionSettings`, `activeState`, `globalConstraints`, `stateConstraints`, `runtimeConfig`, `behaviors`, `semanticParts`, and `animationClips`. `activeState` is the authored default.

`EditorSession` owns selection, SVG diagnostics, workspace/navigation context, timeline selection, `animationEditor` (`activeClipId`, `playhead`, `panel`, `autoKey`) and focus state. `svgWarnings` is diagnostic output, not authored content. Snapshot V3 may serialize timeline context as editor metadata without making it authored state.

`PreviewSession` owns running/playing flags, active clip and clocks, live/effective parameters, transition/preview state, behavior test and last error. The controller is its sole owner; preview state changes never write `ProjectDocument.activeState`.

## Persistent domain map

| Domain | Fields |
| --- | --- |
| artwork | `svgMarkup`, `elements` |
| layers | `layers`, `layerMetadata` |
| rig | `params`, `globalConstraints`, `stateConstraints`, `runtimeConfig` |
| stateMachine | `states`, `transitions`, `transitionSettings`, `activeState`, `behaviors` |
| semanticRig | `semanticParts` |
| animation | `animationClips` |

Each explicit document command supplies type, source and domains. Only those domain roots are cloned. Each domain revision and the persistent revision advance on document mutations; session mutations advance neither. Document version tokens are stored in undo entries, so returning to a saved token restores clean state without serialization.

## API migration audit

| File / area | API actuelle | Persistent/transient | Domain | Nouvelle API | Status migration |
| --- | --- | --- | --- | --- | --- |
| `core/state/store.js` and authored panels | `setState`, `replaceState`, `getState` | mixed | all | `execute`/`mutateDocument`, `replaceDocument`, `getDocument` | facade deprecated; remaining cold/non-frame callers listed by `rg` |
| `svg-editor/svg-canvas.js`, `layers-panel.js` selection | `setState(selectedId)` | transient | selection | `mutateSession('selectedId')` | migrated hot path |
| `ui/editor-context.js` | private context object | transient | editor UI | adapter over EditorSession | migrated |
| `preview-runtime/preview-controller.js` | flat reads and authored active-state write | transient runtime | preview | direct `getDocument`; controller-owned PreviewSession | migrated compute and state transition |
| `core/undo/history.js` | clone flat state | persistent + transient | all | document + version-token snapshot | migrated |
| `main.js` domain detection | `JSON.stringify`, `previousDomains` | persistent | all | targeted domain/session subscriptions | migrated |
| `main.js` dirty/autosave | serialized flat signature | persistent | all | document version token/document subscription | migrated |
| `validation-cache.js` / `main.js` | serialized validation signature | persistent | validation domains | relevant domain revision key | migrated application path; legacy export retained for compatibility tests |
| snapshot/import/export | `structuredClone` | persistent cold path | all | normalized snapshot/replacement | intentionally retained |
| timeline and authoring panels | `history.snapshot` + facade mutation | mixed | animation/state/rig | commands and session APIs | compatibility facade remains; instrumented |

## Clone audit

Before V2, every `setState` cloned the complete flat project. Normal V2 `mutateDocument` clones only roots belonging to declared domains and `mutateSession` clones no project data. Whole-document clones remain in history snapshots, project replacement rollback, snapshot preparation, legacy import/export, test fixtures, and the instrumented compatibility `setState`. These are cold paths or documented migration debt. `store.wholeDocumentMutationClones` exposes compatibility calls; history cloning is separately attributable.

## JSON audit

Domain detection and dirty checking in `main.js` no longer use `JSON.stringify`. Validation uses domain revisions. Remaining JSON serialization is intentional I/O: project download, autosave/local storage, export artifacts, and tests verifying serialized formats. It is not used for change detection, dirty state, or hot-path cache invalidation.

## Targeted notifications and diagnostics

Document subscriptions are independently available for artwork, layers, rig, stateMachine, semanticRig and animation. Session subscriptions are keyed (including selection and animationEditor). Diagnostics expose document/session mutations and notifications, whole-document compatibility clones, autosave schedules/writes, validation runs, and domain revisions through the store API.

## Compatibility callers

Run `rg -n 'store\\.(getState|setState|replaceState)' project/editor --glob '*.js'` for the authoritative remaining list. `getState` is a cached facade (not reconstructed per frame). `setState` is deprecated, instrumented, tracks the roots written, and emits only relevant domains; no new code should use it. `replaceState` remains for atomic template/import compatibility.
