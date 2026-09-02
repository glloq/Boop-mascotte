# PR #44 UI gate closure

Base: `86acb899d84c72840c96ca41dec5a0af96c238a6`  
Browser E2E run: `33574928478`

## Initial failure matrix

| Gate | Exact assertion | Actual state | Expected state | Classification | Proven root cause | Production fix | Test fix | Regression coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chromium critical — rendered IDs/ARIA | workspace navigation must reach every audited state | `getByRole('button', {name: 'Animate', exact: true})` times out because navigation is exposed through the workspace selector | Animate workspace is audited with duplicate IDs `[]` and dangling ARIA references `[]` | STALE TEST CONTRACT | The shell's canonical workspace control is a select; the test bypassed the existing `goToAnimate` helper | None | Use `goToAnimate`, retaining the audits unchanged | Blank, Basic, Rig, populated/empty Animate, States, Behaviors, Problems, Export and Preview audits |
| Chromium critical — Build a Face | opening project-menu Advanced must be strict and unambiguous | exact text `Advanced` resolves to project menu, Rig tab and inspector summary | Project-menu Advanced opens | BRITTLE SELECTOR | A global text selector ignored the existing project-menu scope | None | Scope `openAdvanced` to `details.file-menu` and use the helper | Full Build-a-Face generation, gaze, readiness, Preview and Save journey |
| Chromium/Firefox/WebKit shared journey | `Download mascot.svg` must exist after Export | Export dispatches through the top action, but the export panel is not the active observable UI | Visible ready panel with three enabled artifact buttons | UI STATE BUG | Pending browser instrumentation; see Export evidence below | Pending evidence | Add semantic `openExport` diagnostics and verify all downloads | Shared Expressive journey on all engines plus lower-level export contracts |
| Chromium stability — repeated selection | every genuine click selects the requested artwork | painted mouth candidates exist but the selected head's interaction geometry is above them | Target artwork owns the pointer except at functional handles | SELECTION OVERLAY BUG | Pending `elementsFromPoint` evidence; SVG.js selection tooling is the blocking layer | Pending evidence | Preserve geometry-aware genuine pointer helper and enrich failure diagnostics | head/mouth ×100 and ×1000, drag and resize |

This matrix is created before implementation. Evidence and final results below are updated only after they are observed; future CI results are never predicted.


## Root-cause evidence and fixes

### Canonical navigation

The shell exposes workspaces as `.workspace-tab[data-workspace]` and changes the visible label when readiness changes. The DOM audit's exact `Animate` text therefore encoded presentation rather than the public workspace contract. It now calls `goToRig`, `goToAnimate`, and `goToPreview`; the duplicate-ID and ARIA-reference assertions are unchanged. The project menu, Rig tab, and inspector all legitimately render `Advanced`; `openAdvanced` now scopes the project-menu `details` structurally rather than selecting by position.

### Export lifecycle

The shared journey remained in the Animate workspace. Validation did run, produced no blocking issue for the built-in Expressive project, and the handler called `render()` and `open()`. The exact blocker was CSS: `#app[data-workspace=animate] .export { display:none }` overrode removal of the panel's `hidden` attribute. This was a **UI STATE BUG**, not a validation or validation-cache bug. The rule now hides the panel only while its native `hidden` state is present. The panel also publishes `data-export-state="ready|unavailable"`, and the semantic helper reports workspace, Problems visibility, panel state and status on failure.

Validation evolution for fresh Expressive, gaze +0.8, gaze -0.8, Animate, Play, Pause, Save, and immediately before Export is unchanged: blocking issue IDs are `[]`. Warning/info guidance does not enter `exportBlockingIssues`, which filters errors only. Existing validation-cache tests prove transient revision changes do not recompute and relevant Rig changes do.

Opening Export still creates zero artifacts. `createExportArtifacts` remains behind delegated `[data-download-artifact]` clicks. Blank UI construction is safe while blank artifact creation throws. A valid document advertises exactly `mascot.svg`, `rig.json`, and `runtime.js`, all enabled; unit coverage validates the SVG input, parses rig JSON, and requires non-empty runtime source.

### SVG interaction layer

The painted mouth is a stroked `path` (`fill="none"`). With `head` selected, `elementsFromPoint` placed SVG.js's `.svg_select_boundingRect` above painted mouth candidates. That rectangle is decorative selection geometry owned by the current head, while `.svg_select_points` are the functional resize handles. The narrow production fix applies `pointer-events:none` only to `.svg_select_boundingRect`; resize points keep their default pointer ownership, draggable artwork stays active, and selection teardown remains `selectize(false)`, `resize(false)`, then `draggable(false)` before the next activation.

The geometry-aware helper still requires the artwork itself to be topmost and still uses path length sampling, screen CTM, `elementsFromPoint`, and bbox fallback. Its blocked-point output now includes pointer-events/owner for the stack, selected ID, overlay and handle counts, and interaction attachments.

## Local verification and external status

- `npm test`: PASS (122 tests).
- `npm run build`: PASS.
- `npm run verify`: PASS.
- Playwright browser gates: NOT RUN locally because the required browser download endpoint returned HTTP 403; no result is claimed.
- `npm audit` and `npm audit --omit=dev`: NOT AVAILABLE because the registry advisory endpoint returned HTTP 403. The supplied baseline reports two high-severity development/build advisories; no dependency changes were made.
- PR-head Actions: pending until the committed head is pushed.
- Post-merge `main` Actions and Pages: pending; the V1 browser baseline is not declared closed.
