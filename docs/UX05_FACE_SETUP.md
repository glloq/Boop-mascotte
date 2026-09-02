# UX-05 — Face Setup assignment vertical slice

## Baseline and prior gates

UX-05 was implemented from `e78417a72ad08bcf2f8daf3e6677f99f8c3da823` (merge of #62) after the UX-04.2 browser-gate closure recorded in `docs/UX04_2_BROWSER_GATE_CLOSURE.md`. Verify and Pages were green on the baseline; the red Browser E2E run was closed by test-only fixes before any UX-05 code.

## Goal

Rename and reframe **Rig** as **Face Setup**, and let a user assign the eight basic face roles by clicking artwork directly on the Canvas, without the part catalog, SVG IDs, parameters or bindings vocabulary.

```text
Face Setup
  Face parts  0 / 8 assigned
  ○ Head            [Assign]
  ○ Left eye        [Assign]
  ○ Right eye       [Assign]
  ○ Left pupil      [Assign]
  ○ Right pupil     [Assign]
  ○ Left eyebrow    [Assign]
  ○ Right eyebrow   [Assign]
  ○ Mouth           [Assign]
  [ Assign next: Head ]
  ▾ All parts (existing parts tree, + Add Part)
```

Choosing a role puts the Canvas in pick mode: a mode banner says which part to click, the checklist row turns yellow, hovered artwork is highlighted, and Escape or Cancel leaves without authoring anything. Clicking artwork assigns it and automatically moves to the next missing role until all eight are assigned. Assigned rows show the artwork's layer name and offer Replace / Clear. A manual **Or choose from layers** select is always available as a fallback for hidden or overlapping artwork. Left and right are the canvas sides, and the hint text says so.

## Composition and ownership

- `rig-editor/semantic-parts/face-roles.js` is a pure derivation over `ProjectDocument`: the ordered checklist, per-role status (`missing`, `assigned`, `invalid` when the referenced element disappeared), next missing role, duplicate usage and assignable elements. Nothing in it is persisted; the authored truth remains `semanticParts[*].roles`.
- `rig-editor/semantic-parts/face-setup-panel.js` renders the left collection. Its only state is the transient pick target and a notice. It never mutates the document directly.
- `semantic-rig-commands.assignFaceRole(type, role, elementId)` is one atomic V2 command: it reuses the existing basic part of that type or creates it, then assigns the role. Preflight keeps a failed assignment (missing element, in-part duplicate) out of history and never leaves an orphan part. One Undo removes both the role and the part it created.
- Cross-role duplicates among the eight basic roles are refused in the checklist with an explanation and no mutation. The Face Part inspector keeps its existing in-part duplicate guard.
- Selection stays in `EditorSession`: a confirmed assignment sets `selectedId` to the artwork and `activeSemanticPartId` to the owning part, so the single contextual Inspector shows the Face Part Inspector. Entering or cancelling pick mode changes no document, revision, history or dirty state.
- Canvas pick mode is shared: both the checklist and the inspector's **Pick artwork** use `canvas.beginRolePick`, which cancels any previous pick tool. The Canvas now renders one visible mode banner with a Cancel button for role picking; it is transient UI created by the Canvas adapter.

## Vocabulary changes

| Before | After |
| --- | --- |
| Rig (task tab, hint, headings) | Face Setup |
| Parts / Semantic parts | Face parts / All parts |
| No semantic parts yet | No face parts yet |
| Continue rigging | Continue to Face Setup |
| Reset all rig controls | Reset test controls |
| Rig inspector (tab group name) | Face part sections |

Setup / Controls / Calibrate / Advanced remain as the Face Part inspector sections, and the part catalog (**+ Add Part**) remains for eyelids, nose, jaw, ears, hair and accessories. Bindings, drivers and calibration internals stay under Advanced.

## Compatibility

Task router IDs, the legacy `rig` workspace, saved UI preferences, `EditorSession` fields, `ProjectDocument` schema, runtime, and export artifacts are unchanged. Templates and Face Builder projects populate the checklist automatically (Basic Face shows 6 / 8 assigned with eyebrows missing). Existing Rig tabs, role picking from the inspector, calibration and morph flows are intact; UX-05 adds a beginner entry point in front of them rather than replacing them.

## Tests

- Unit (`core/tests/face-setup.test.js`): checklist order/status derivation without mutation, next-missing wrap-around, duplicate usage, atomic create-and-assign with Undo/Redo, and no-history rejection of invalid assignments.
- Browser (`tests/e2e/ux05-face-setup.spec.js`): the critical eight-role Canvas journey on an imported SVG with per-step mutation counts and session/inspector checks; duplicate refusal, Escape without authoring and single-Undo part removal; template checklist plus the layer-select fallback and row → inspector navigation.
- The UX-01 product journey **import artwork → assign Head → test** now goes through the checklist instead of the part catalog.

## Deferred

Role suggestions from IDs/names/geometry (UX-06), control selection and visual calibration (UX-07), readiness integration (UX-08), and moving the parts tree behind progressive disclosure once controls have a checklist-driven entry (UX-07/UX-17) are out of scope. The legacy Rig inspector tabs are the rollback path.

## Gates

Run `npm run verify`, `tests/e2e/ux05-face-setup.spec.js`, and the Chromium critical, cross-browser smoke, stability and Pages suites.

Local results on this branch (pinned Playwright 1.55 with the pre-installed Chromium): Verify green (159 unit tests, build), Chromium critical 25 / 25, stability 6 / 6, Pages 3 / 3, `ux05-face-setup` 3 / 3. Firefox and WebKit could not be downloaded here; hosted CI remains the authority for cross-browser smoke. The nightly extended suite carries the pre-existing failures listed in `docs/UX04_2_BROWSER_GATE_CLOSURE.md`; UX-05 adds none (identical failure set on the baseline).
