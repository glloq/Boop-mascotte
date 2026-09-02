# UX-04.2 browser gate closure

## Baseline and initial gate state

- Baseline: `e78417a72ad08bcf2f8daf3e6677f99f8c3da823` on `main` (merge of #62, UX-04.1).
- Verify, Stability, and GitHub Pages build/deploy/smoke were green on that commit.
- Browser E2E run `33655977827` was red: Chromium Critical failed 3 of 23, Cross-browser Smoke failed 2 of 10.

## Root causes

All five failures were stale or racy browser contracts. None was a production regression, and no production file was changed to close them.

| Failure | Cause | Fix |
| --- | --- | --- |
| `editor.spec.js` › sample, preview and project download (Chromium, Firefox, WebKit) | `openArtwork` asserted the exact tab text `Artwork`, but the task tab carries a readiness badge (`Artwork ✓`). | Assert the label with `toContainText`; the badge is not a navigation contract. |
| `rig-timeline.spec.js` › Build a Face (Chromium) | `enterFaceBuilder` read `getAttribute('open')`, which is an empty string for `<details open>`; the helper therefore clicked the summary and closed the already-open Face Builder. | Disclosure helpers now use `hasAttribute('open')` through one `isOpen` utility. |
| `ux04-artwork.spec.js` (Chromium) | The Layers tree item is named from the humanized display name (`JourneyHead`), so the case-sensitive `/journeyHead/` regex never matched. A second latent violation followed: `heading "Appearance"` resolves to both the section heading and the tab sub-heading. | Case-insensitive name; assert the stable `#transform-heading` / `#appearance-heading` ids inside the context inspector. |

The same stale `Artwork` text assertion also existed in the extended (nightly) test `editor.spec.js` › essential editor controls remain available on phone and tablet; it now uses `toContainText` too.

A local Chromium run also surfaced a race in `editor.spec.js` › dirty New Project: the save pill reads `Unsaved changes` and then `Autosaved locally` after the 500 ms autosave, so a text assertion can fail on a slower machine. Both texts are the dirty state; the test now asserts the `dirty` class.

## Validation

Local Chromium (pinned Playwright 1.55 against the pre-installed browser): critical, stability, and Pages suites pass after the fixes. Firefox and WebKit could not be downloaded in this environment; their failures were the same `openArtwork` contract as Chromium and are expected to close with it. Hosted CI remains the authority.

## Pre-existing extended-suite debt (not closed here)

`npm run test:e2e:extended` (nightly `Extended Browser E2E`, `continue-on-error: true`, last green at UX-00 `a1f8d5b`) fails identically on the baseline `e78417a` and after this closure, so these are not part of the merge gates and predate this branch:

- `editor.spec.js` › runtime resolves CSS-significant SVG ids: the dynamic `import('../runtime/runtime.js')` is not served by `vite preview` (`dist/` has no `runtime/`).
- `rig-timeline.spec.js` (8 tests) › `part(page, name)` uses `getByRole('button', { name, exact: true })`; no button has an exact `Head`/`Mouth`/`Eyelids` name in the UX-02+ Face Setup collection, which appends status text.
- `rig-timeline.spec.js` › loop playback / paused clip / track CRUD / numeric key time: Preview no longer exposes `#clip-play` and the timeline assertions expect the pre-UX-02 bottom surface.

These should be realigned in a dedicated extended-gate closure before UX-12 (Motion/Timeline bridge) relies on them.

## Scope

Test-only change. No schema, runtime, persistence, preview, export, or UI behavior was modified. UX-05 starts from this closure.
