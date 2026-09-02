# UX-03.1 — Browser gate closure

## Baseline and initial CI

This gate closure is based on `main` at `08ad068ab95ccb316a738fb81cee491d54f365b7`, after PR #57, **feat(UX): add safe Home and project entry flows**.

The initial Browser E2E run was `33645330735`: Verify and Stability were green, while Cross-browser Smoke failed in Firefox and WebKit. Chromium Critical was still running at the initial audit. The initial Pages run was `33645330657`: build and deploy were green, while Pages smoke failed. The final status could not be queried from this environment because GitHub CLI/API authentication was unavailable.

## Root cause

Both failures used the pre-UX-03 `Start with Basic Face` button in the Canvas empty state. Home correctly overlays that migration UI and intercepts pointer input, so Playwright could not click the obscured legacy button. This was a stale test path, not a Home, deployment, asset-base, runtime, or export defect.

The product contract is now explicit:

- Home is the canonical first-run project entry.
- The Home **New Mascot** section exposes the Basic Face card.
- The legacy Canvas empty state and File menu remain migration/rollback fallbacks only.
- Tests whose purpose is simply to create Basic Face use `startBasicFace(page)`.

No production code, ProjectDocument schema, session ownership, runtime, rig schema, exporter, or deployment configuration changed for this closure.

## Test migrations and retained fallback coverage

The cross-browser export/runtime smoke and the first Pages smoke now create Basic Face through the shared Home helper. The Pages smoke first verifies the visible Home, New Mascot, Basic Face, and Open Project entry points; it retains its Canvas, failed-response, and JavaScript-error checks. The export/runtime smoke retains all three exact artifacts, standalone-runtime, SVG/rig/runtime integration, and transform checks.

Other tests that only needed a Basic Face were migrated to the same helper, including hostile project-string and responsive-control coverage. The base/reload smoke now asserts Home rather than the obscured Canvas empty state.

The remaining `#empty-state` reference in `enterFaceBuilder` deliberately exercises the legacy **Build a Face** migration fallback. The `#empty-svg` use deliberately covers sanitization through the retained legacy SVG-import fallback. Neither fallback was removed or made clickable through Home.

## Final validation

Local Verify passed: conflict checking, 155 Node tests, and the production build are green. Playwright discovered all 56 browser tests, but this environment did not contain the required browser executables and its download proxy returned HTTP 403. Consequently Chromium Critical, Firefox/WebKit Smoke, Pages Smoke, and Stability could not execute locally; they remain CI validation gates rather than recorded passes here.

The complete Browser E2E and Pages workflow state also remains to be reported by GitHub after this branch is pushed. GitHub run lookup was unavailable because neither GitHub CLI nor API authentication was configured in this environment.
