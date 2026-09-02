# UX-01 — Product journey contracts

## Baseline audit

UX-01 started from local branch `work` at `a1f8d5b2cce8538973a12448eb2acea0a0ea4b4d`, the requested UX-00 baseline. The checkout has no configured Git remote, so a newer live `main` could not be fetched; `HEAD` and the requested SHA were identical.

Before any source change:

- `npm ci` was blocked by registry HTTP 403; `npm ci --offline` succeeded from the available cache.
- `npm run verify` passed: conflict check, 141 unit tests, and production build.
- Chromium critical could not launch because Playwright build 1187 was absent.
- The stability run reached the same browser-launch limitation and was stopped after the cause was established.
- Firefox/WebKit smoke and Chromium Pages were not represented as green: all required browser binaries were absent.
- `npx playwright install chromium firefox webkit` was attempted and failed with HTTP 403 from all Playwright download mirrors.

This is an environment limitation, not an observed application regression. Browser gates must run in CI or an environment with the pinned Playwright browsers.

## Protected product outcomes

`tests/e2e/product-journeys.spec.js` protects four user-facing contracts:

1. Create a Basic mascot, prove reversible horizontal gaze, enter test mode, inspect readiness, and obtain exactly `mascot.svg`, `rig.json`, and `runtime.js`.
2. Import deterministic SVG artwork, assign it as a Head Face Part, and test the result.
3. Identify the stable `artwork.missing` export blocker on an empty project, recover using the currently supported Basic mascot action, recalculate readiness, and export.
4. Make a real authored layer-name change, save the editable project, inspect the downloaded document, start a new project, reopen the file, compare the complete canonical `ProjectDocument`, and prove gaze remains usable.

Existing coverage was deliberately retained. `editor.spec.js` already protects Cancel, Discard, and Save-then-replace, so UX-01 does not duplicate project-replacement safety. Existing sample/export, sanitization, timeline persistence, gaze, and Pages scenarios remain useful legacy coverage.

## Semantic helper layer

`tests/e2e/product-journey-helpers.js` is the migration boundary. Specs call product operations such as `createBasicMascot`, `testHorizontalGaze`, `testMascot`, `inspectExportReadiness`, `saveEditableProject`, and `openEditableProject`. Only this adapter knows the current workspace helpers and implementation locators. UX-02 should update the adapter rather than rewrite outcome contracts.

Selectors prefer accessible names. Current semantic-rig role-picking and SVG artwork IDs remain temporary adapter-only selectors because the existing picker exposes no unique accessible role name.

## State ownership contracts

- Persistent assertions read `window.__BOOP_E2E__.document()`.
- Transient navigation and selection assertions read `window.__BOOP_E2E__.session()`.
- Live gaze and Preview must leave the document, document version token, document revisions, history, and dirty state unchanged.
- Confirmed Face Part assignment must change the document; picker selection belongs to the editor session.
- Save/Open compares A (the authored document), B (the downloaded snapshot document), and C (the restored document). Generated semantic-driver ownership is authoritative editor data and must survive A → B → C. State-constraint values are authoritative, while omitted scale dimensions are compatibility defaults that may be materialized as `1`; built-in project producers create that canonical shape before Save. The editor session remains intentionally outside the persistence contract.
- The composite `state()` projection is not used by the new journeys.

The only production seam added is opt-in `window.__BOOP_E2E__.readiness()`. It returns detached, structured-clone-safe validation issues (including stable IDs) and derived readiness. It is read-only, introduces no user mutation or normal-runtime global, and avoids brittle English-message assertions.

## Current UX limitations and baseline measurement

The current export blocker recovery is indirect: `Fix` can navigate to the artwork surface, but it does not complete artwork creation itself. UX-01 therefore validates the stable blocker and recovers through the existing Basic mascot action; it does not implement Readiness V2.

`tests/e2e/baselines/product-journeys.json` records descriptive action counts, surface transitions, visible technical concepts, and blocking dialogs. Counts document the pre-redesign experience and do not determine test success.

## UX-02 dependency

UX-02 may replace the current Create/Rig/Animate/Preview information architecture only after UX-01 is merged and all browser gates are rerun against the new `main`. It must preserve these product outcomes and update the semantic adapter where current selectors change. Remaining risks are the temporary role-picker locator, browser validation still required outside this environment, and the current blocker flow's incomplete guided recovery.
