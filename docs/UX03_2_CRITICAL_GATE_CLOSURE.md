# UX-03.2 — Chromium Critical gate closure

## Baseline and initial CI

- Baseline: `main` at `1465bd8a762e8c937025ffc365bd4703e707aae7`.
- Previous change: PR #58, “test(UX): align browser gates with Home entry flow”.
- Browser E2E run: `33647381830`.
- Initial Chromium Critical result: 20 tests, 15 passed, 5 failed. Verify,
  Cross-browser Smoke, Stability, and the GitHub Pages build, deploy, and smoke
  jobs were green; Chromium Critical was red.

## Failure analysis

| Critical test | Classification | Root cause and closure |
| --- | --- | --- |
| SVG import sanitizes executable content and remains editable | Production regression plus stale navigation | Home correctly blocked the legacy hidden import path. Home now exposes the shared safe SVG importer, and the security test uses that entry. |
| user can import artwork, assign a semantic face part and test it | Production regression plus stale navigation | The journey helper used `#empty-svg`, leaving Home open. It now imports from Home and verifies Artwork before entering Face Setup. |
| Build a Face generates an honest valid project that previews and saves | Stale E2E navigation | The helper looked below the hidden empty state after Basic Face creation. It now opens the loaded-project Create “More templates” surface and its existing Face Builder. |
| timeline project metadata persists and remains playable after reload | Stale E2E navigation | Project open intentionally returns to Artwork. The test explicitly enters Animate and opens Timeline, while proving navigation does not change authored document ownership. |
| empty Face Setup creation is accessible and preserves ownership until Add Head | Stale E2E setup | A fresh app is owned by Home. The test first imports artwork with no semantic parts, then enters Face Setup and retains its transient catalog/navigation assertions. |

## Product closure

Home includes a distinct **Import SVG — Artwork only** action alongside, but not
confused with, **Open Project**. Its `#home-svg-file` input is bound to the same
handler as the project-menu and legacy empty-state inputs. There is no duplicate
parser or importer.

The shared handler continues to prepare and sanitize SVG before using the guarded
project replacement transaction. Only after a successful commit does it mark the
project loaded, navigate to Artwork, close Home, fit the canvas, and report status.
Rejected SVG remains on Home and cannot replace the document, history, dirty
state, or recovery. Import into an existing dirty project retains the existing
Cancel / Discard / Save replacement confirmation.

The legacy `#empty-svg`, `#empty-project`, and `#empty-state` controls remain for
compatibility; canonical first-run product helpers no longer depend on them.
Open Project and local recovery retain their existing shared pipelines and
semantics.

## Files and scope

Production changes are limited to the Home markup, shared app-shell SVG binding,
and successful-import lifecycle in `main.js`. E2E changes cover editor and product
helpers, SVG sanitation, Face Setup ownership, Face Builder access, Timeline
post-open navigation, and dedicated Home valid/invalid SVG cases.

There are no ProjectDocument, snapshot, or rig schema changes; no runtime or
export changes; and no UX-04 Artwork workspace consolidation.

## Final gates

Record the final local and GitHub gate results in the PR report after execution:

- Verify
- Chromium Critical
- Cross-browser Smoke
- GitHub Pages smoke
- Stability
