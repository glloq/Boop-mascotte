# UX-04.1 browser gate closure

## Baseline and initial gate state

- Baseline: `07bd3b0087179e68510669d94f7bcb37a6e11cdd` on `main`.
- UX-04 merge: #61.
- Failed Browser E2E run: `33653674200`.
- Verify, Stability, and GitHub Pages build/deploy/smoke were green.
- Chromium Critical was red with five failures (17 passed), and Cross-browser Smoke was red with two failures (8 passed).

## Root cause and closure

The failures were stale pre-UX-04 browser contracts, not production regressions. Tests still expected the visible **Create** label, the removed `.artwork-layers` disclosure, and the old **More templates** hierarchy.

The editor helpers and specs now use the canonical UX-04 surface: **Artwork** via `data-task="artwork"` while retaining the internal `create` workspace, the accessible **Layers** tree, and the **Add / Create artwork** → **More templates and tools** disclosure path. Face Builder remains the existing `#face-builder`; the behavioral journeys and their model/runtime assertions remain intact.

Production behavior was intentionally not reverted, and no production files were changed. The UX-04 vertical slice is now critical browser coverage.

## Validation and scope

Local validation was attempted for the repository verification suite, targeted Chromium critical specs, the UX-04 spec, and the Critical, Cross-browser Smoke, Stability, and Pages gates. The unit suite passed, but dependency installation was blocked by an npm registry `403`; after `npm ci` removed the existing installation, Vite and Playwright were unavailable. Browser gate results therefore remain pending hosted CI and are not claimed as passing. Final local results are recorded in the commit and PR report.

No schema, runtime, persistence, preview, or export-format changes were made. UX-05 was not started.
