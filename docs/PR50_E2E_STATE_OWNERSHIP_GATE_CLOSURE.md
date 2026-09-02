# PR #50 — E2E state-ownership gate closure

## Exact merged-main baseline

Base `main` SHA: `f5462ad6d8122f9eccc110d1bc509cb863546c02`.

| Workflow | Run | Job | Merged-main result |
| --- | ---: | --- | --- |
| Verify | 33591557396 | Verify | SUCCESS |
| Browser E2E | 33591557540 | chromium-critical | FAILURE (11 passed, 1 failed) |
| Browser E2E | 33591557540 | stability | SUCCESS |
| Browser E2E | 33591557540 | cross-browser-smoke | FAILURE (8 passed, 2 failed) |
| Deploy GitHub Pages | 33591557440 | build | SUCCESS |
| Deploy GitHub Pages | 33591557440 | deploy | SUCCESS |
| Deploy GitHub Pages | 33591557440 | smoke | SUCCESS |

PR #49 was therefore **not fully green**. Its product repair did work: the failing
critical/smoke journey observed `lookX = +0.8`, effective `lookX` near `+0.8`, and
a non-zero pupil translation, followed by effective `lookX` near `-0.8` and a
reversed pupil translation. The only failure was the final ownership assertion.

The observed compatibility-snapshot differences were `workspace: create → rig`,
`activeSemanticPartId: head → gaze`, and `selectedId: null → pupilLeft`. All three
are legitimate EditorSession changes, not ProjectDocument mutations. Firefox and
WebKit failed for exactly the same deterministic reason; this was not flakiness.

## Local pre-change baseline

`npm ci` could not fetch `@playwright/test@1.55.0` because the registry returned
HTTP 403 and removed the previously installed Vite/Playwright executables. Before
the code change, `npm test` passed 135/135. `npm run build`, the build phase of
`npm run verify`, and every Playwright command were consequently unavailable
(`vite: not found` / `playwright: not found`). These environment failures are not
reported as passes. An offline retry subsequently restored the cached packages, so
the final unit, build, and Verify checks ran successfully. Playwright browser binary
downloads still returned HTTP 403; local browser gates remain environment-blocked
and PR-head CI is required.

## Root cause and corrected E2E contract

Before this change, `state()` returned a detached, flat compatibility composite of
ProjectDocument and EditorSession. A PR #49 regression test named that value
`documentBefore` and compared it after entering Rig and selecting Gaze. The test
therefore treated expected session navigation as a persistent edit.

The opt-in `?e2e=1` seam now makes ownership explicit:

- `document()` is the canonical detached ProjectDocument snapshot.
- `session()` is a detached, allow-listed EditorSession projection.
- `state()` remains the unchanged flat compatibility composite for legacy tests.
- Existing explicit PreviewSession reads (`effectiveParams()`, live-control and
  frame diagnostics) remain in place; no broad preview snapshot was added.

Normal URLs still do not install `window.__BOOP_E2E__`. The owner snapshots use
`structuredClone`, are plain structured-clone-safe data, and cannot mutate either
store owner when a caller mutates the returned value. Tests guard that document
snapshots exclude every session key and session snapshots exclude every document
domain. The compatibility projection is also tested as detached.

`ProjectDocument.activeState` remains authored state, whereas
`EditorSession.activeStateId` is editor context. Likewise,
`ProjectDocument.animationClips` is persistent while `animationEditor` (active
clip, playhead, panel, and Auto Key UI state) belongs to EditorSession. Preview
clip time, playback, live/effective parameters, transitions, and behavior tests
belong to PreviewSession and are excluded from document immutability checks.

## Rig regression invariant

The critical journey now captures ProjectDocument and EditorSession separately.
After Create → Rig → Gaze, the document is equal while the session is unequal with
`workspace = rig` and `activeSemanticPartId = gaze`. It intentionally does not
couple the contract to the current concrete pupil selection. After live `+0.8` and
`-0.8` input, ProjectDocument equality is checked again alongside the existing
effective-parameter and reversible rendered-pupil assertions.

Independent persistence evidence remains and is stronger: document mutation,
history, autosave schedule, autosave write, and validation deltas are zero; dirty
state remains false; the persistent revision, every domain revision (`artwork`,
`layers`, `rig`, `stateMachine`, `semanticRig`, and `animation`), and the exposed
stable document-version-token identity are unchanged. Session revision is not
required to remain unchanged because navigation and selection are session writes.

## `state()` audit

`rg -n '__BOOP_E2E__\.state|state\(page\)' tests/e2e` produced 18 matches: one
helper definition, 12 persistent-data reads, two session reads, and three deliberate
composite compatibility reads. One incorrect persistent-equality use was found and
migrated to `document()`. Other reads remain unchanged to avoid a gratuitous legacy
test rewrite. Legacy E2E mutation helpers (`mutate` and `setAuthoredTransform`) are
separate test-only compatibility debt.

## Scope and next work

Schema V3 and snapshot version 3 are unchanged; no project-format migration or
PreviewSession data serialization was introduced. Timeline and Visual Authoring
remain V2, and Rig live controls remain PreviewSession-owned (Auto Key persists only
animation edits). State Machine and Behaviors production commands remain the next
V2 migration target, expected in PR #51. Layer-facade and `main.js` compatibility
reads remain debt, while snapshot history stays intentionally snapshot-based.
Runtime Compiler, Control Model V2, Keyforms/blend shapes, Expressions/Emotes, and
Reactions are not started and are explicitly outside this gate repair.

PR-head and post-merge workflow results cannot be recorded from the local working
tree. They must be checked on the exact pushed head and then on the exact merged
`main` SHA; post-merge health must not be inferred from PR-head CI.
