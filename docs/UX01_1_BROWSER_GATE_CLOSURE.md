# UX-01.1 — Browser gate closure

## Baseline and failure audit

This closure was prepared from `dd1383297fc689c4577f3214bf7ed2fa538c9a30`, the requested post-UX-01 `main` baseline. The analyzed Chromium CI result contained 16 critical tests, with 14 passing and these two failures:

1. `user can understand an export blocker and recover` failed because the empty document exposes multiple actionable diagnostics and the adapter selected the non-unique English label `Fix`.
2. `editable project survives a save, reset and open round trip` failed because project serialization normalized the rig. In particular, binding normalization discarded `generatedBy`, while state-constraint defaults were materialized only during serialization/import.

## Failure 1: stable diagnostic identity

The Problems panel now carries each validator issue's stable ID as `data-diagnostic-id` on its article. The product helper scopes the existing `Fix` action to `artwork.missing`; it uses neither order nor message copy. The action still only navigates to the current Create recovery surface, where the journey explicitly chooses Basic Face. No readiness or navigation redesign is included.

## Failure 2: A → B → C serialization audit

The audited path is:

- **A — before Save:** the live `ProjectDocument`, including SVG, layer tree/metadata, semantic Parts, generated binding ownership, authored States/constraints, controls/parameters, clips, and the user rename.
- **B — downloaded `mascot-project.json`:** `createProjectSnapshot` serializes SVG/layers/editor metadata and runs the runtime-compatible rig fields through `normalizeRig`.
- **C — after Open:** `prepareProjectSnapshot` validates/sanitizes and normalizes B; `applyProjectSnapshot` restores the normalized rig and editor metadata into a clean project before the store replacement.

The loss occurred at **A → B**: `normalizeRig` replaced each binding with `normalizeBinding`'s runtime shape, which intentionally has no editor ownership metadata. **B → C** then faithfully restored the already-stripped binding. `generatedBy` is authoritative editor data, not a disposable cache: semantic-control conflict detection, parameter rename/removal, recalibration, method switching, and owned-driver cleanup all consult it. Editor-side rig normalization now preserves this metadata without changing the standalone runtime normalizer or exported runtime contract.

`stateConstraints` values are authoritative when authored. Missing `translate`, `rotate`, and `scale` values are compatibility defaults and may be canonicalized to `1`. The built-in template producer now materializes those defaults when it creates its States, so A, B, and C share one canonical structure rather than changing shape only at Save/Open.

The critical journey inspects B directly and requires its elements and state constraints to equal A before it opens the file. It then retains complete A/C equality, the user rename, semantic roles and parameters, and functional gaze. Export usability remains covered by the Basic/export and blocker-recovery critical journeys. A focused Node regression additionally covers semantic ownership, canonical constraints, semantic Parts, animation data, and layer metadata.

## Files and scope

- Production: the Problems semantic hook, editor-side rig ownership preservation, and canonical built-in template constraints.
- Tests: the product adapter's diagnostic-scoped action, explicit A/B assertions, and the serialization regression.
- Documentation: this closure record and the clarified UX-01 persistence contract.
- Unchanged: `project/runtime/`, `runtime.js` export format, `rig.json` runtime contract, `mascot.svg`, navigation, shell design, and all UX-02 product work.

## Commands and results

- `npm ci`: blocked by registry HTTP 403; `npm ci --offline` succeeded from the cache.
- `npm run verify`: passed (143 Node tests and production build).
- `npm run test:e2e:critical`: attempted, but all launches were blocked because Playwright Chromium build 1187 is absent.
- `npm run test:e2e:smoke`: attempted, but Firefox/WebKit browser executables are absent.
- `npm run test:e2e:pages`: attempted locally, but Chromium is absent (the deployed Pages base is a CI-only input).
- `npm run test:e2e:stability`: attempted, but Chromium is absent.

The workflow jobs already have 30-minute critical, 20-minute stability, and 15-minute cross-browser timeouts. Local launches fail immediately and the Vite web server shuts down; no orphan-process or application hang was reproduced. The long CI jobs are therefore not changed here and should be investigated as runner/browser-install infrastructure if they recur. A browser-equipped CI run remains required to record Chromium Critical green.
