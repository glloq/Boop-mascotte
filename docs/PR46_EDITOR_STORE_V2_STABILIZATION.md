# PR 46 — EditorStore V2 stabilization

## Merged-main evidence

Baseline: `6efb36119c69fa195b99dc185c544d825e56abf1` (PR 45 merge).

| Workflow run | Job | Merged-main result | Failure |
| --- | --- | --- | --- |
| Browser E2E `33582753475` | `chromium-critical` | not assumed; final log was not available in this workspace | CI must be checked on PR head |
| Browser E2E `33582753475` | `stability` | failure, 0/6 passed | all six scenarios fail in `startBasicFace` before their stress assertions |
| Browser E2E `33582753475` | `cross-browser-smoke` | not assumed; final log was not available in this workspace | CI must be checked on PR head |
| Pages `33582753447` | `build` | success | — |
| Pages `33582753447` | `deploy` | success | — |
| Pages `33582753447` | `smoke` | failure | deployed Basic Face path reproduces `DataCloneError` |

The shared diagnostic was `{workspace:"create", loaded:false, semanticParts:[],
e2e:true, svgPresent:true}`. This is consistent with the canvas parse completing and
the subsequent template-state recipe failing.

## Exact root cause

The caller was `loadProjectTemplate()` in `core/sample/template-loader.js`. The old
sequence was `replaceState(clean) → canvas.loadSvgFromText → store.setState(
applyTemplateProject)`. `loadSvgFromText` committed SVG artwork first, producing the
visible SVG-only intermediate state.

The initial flat facade was cloneable: no DOM node, SVG.js wrapper, `Window`, event,
function, `NodeList`, or plugin object had entered either owned state object. The
failure was caused by the compatibility recipe's own tracking `Proxy`:

1. `setState` cloned the flat facade and supplied a recursively proxied draft.
2. `applyTemplateProject` read `state.animationClips`; that getter returned a
   `Proxy` whose target was an `Array`.
3. At `state.animationClips = structuredClone(state.animationClips)`, browser
   `structuredClone` received that proxy and threw `DataCloneError: [object Array]
   could not be cloned`.
4. Independently, the helper's temporary `document` bag captured proxied
   `elements`, `layers`, `layerMetadata`, and `svgWarnings` and assigned them back
   into the tracked draft. That is a second proxy-escape hazard had execution
   reached the legacy commit boundary.

Thus the concrete failing root/path was `animationClips` (root array, runtime type
`Proxy<Array>`); it was not DOM/SVG.js leakage. The canvas/plugin boundary continues
to extract plain rig records and transforms from wrappers rather than storing those
wrappers.

## Replacement lifecycle

Template parsing now returns a plain artwork candidate while `updateStore:false`.
The loader combines it with a clean flat candidate, applies the template to that
unproxied object, explicitly constructs `ProjectDocument` and `EditorSession`, and
calls one `replaceProject(document, session, {source})`. It then resets/configures
`PreviewSession`. The canvas may display its parsed candidate before the commit for
technical parsing reasons, but store subscribers observe one complete project
replacement only: no empty, SVG-only, or rig-only persistent commit.

The same contract covers Basic, Expressive, Talking, and Face Builder because all
enter through `loadProjectTemplate`. SVG import, presets, snapshot open, autosave
recovery, and rollback now also use explicit split `replaceProject` calls. A newly
created project retains the existing clean baseline: the outer replacement
coordinator clears history and establishes the saved version token after the single
commit. One replacement may notify each targeted domain, while autosave's debounce
coalesces those notifications; no initialization undo entries are created.

## Legacy API audit

| Area | Operation/ownership | Classification | PR 46 |
| --- | --- | --- | --- |
| template loader / built-ins / Face Builder | full document + reset session | normal project creation | migrated |
| SVG import and preset | artwork/layers + reset session | normal project load | migrated |
| project JSON and autosave recovery | all document domains + restored session | cold project load | migrated |
| rollback | all document domains + prior session | exceptional cold path | migrated |
| feature installation | artwork + semantic rig/rig | ordinary authoring command | deferred; append and feature metadata need one combined command |
| behavior toggle | state machine | ordinary authoring | deferred |
| canvas edit/import helpers | artwork/layers | ordinary authoring | initial SVG parse migrated; edit commands deferred |
| inspector, state machine, semantic rig, timeline | declared authoring/session domains | ordinary panels | deferred command-migration debt from PR 45 |
| E2E seam and legacy tests | compatibility-only | test | intentionally retained |

`replaceState` remains deprecated but now explicitly constructs separate document
and session objects rather than blindly passing the same flat object as both. The
legacy `setState` counter and whole-document-clone counter remain exposed. The public
Basic flow asserts both deltas are zero; the identical loader guarantees the same for
Expressive, Talking, and Face Builder.

## Serializable ownership invariant

`inspectProjectDocument` walks every canonical authored field, reports concrete
paths for functions, symbols, circular values, and non-plain prototypes, and finally
checks structured-clone support. It is test/development tooling, not a frame-time
normalizer or fallback clone. Template lifecycle tests prove all built-ins yield
plain serializable documents, populated elements/semantic parts, sane sessions, one
persistent revision, and one increment of every replacement domain revision.

Selection, workspace, semantic/timeline navigation, playhead, and focus remain in
`EditorSession`. Runtime clocks, live/effective params, author-preview state, and
runtime clip remain in `PreviewSession`. Selection and playhead changes therefore do
not change document revisions. Schema and snapshot versions remain 3; there is no
migration.

## Gate policy

Local browser results are not substituted for PR-head Actions or post-merge Pages.
PR 46 is **not ready to merge** until Verify, Chromium critical, stability (6/6),
Firefox/WebKit smoke, and—when triggered—Pages build/deploy/smoke are green on the
exact head. Runtime Compiler work was not started.
