# V1 release status

Updated 2026-09-01. This is the authoritative status; unchecked/manual gates are not claimed as passes.

| Gate | Status | Evidence / action |
| --- | --- | --- |
| Build | Automated locally | `npm run build` |
| Unit | Automated locally | `npm test`, including canonical validation purity and optional-feature policy |
| Chromium | Pending final Actions | `npm run test:e2e:critical` and extended suite |
| Firefox | Pending final Actions | smoke project |
| WebKit | Pending final Actions | smoke project |
| Pages | Pending final Actions | Pages workflow and Pages smoke |
| Security | Automated locally | sanitizer/expression tests and npm audits |
| Desktop | Partial | automated editor flows; 1366×768 and 1920×1080 visual review required |
| Tablet | Partial | responsive CSS; 768×1024 manual review required |
| Phone | Partial | critical controls responsive; 390×844 precision/reachability review required |
| Save/Open | Automated | snapshot and browser critical coverage |
| Export | Automated | unit/runtime artifact and browser download coverage |
| Runtime | Automated | transition, behavior, morph and exported-source tests |

## Blockers

- Required final GitHub Actions results have not been observed from this local environment.
- The complete 390/768/1366/1920 manual accessibility and visual matrix has not been signed off.

## Warnings

- Timeline animations are project/editor metadata and are not exported in runtime schema v3.
- Local browser execution depends on installed Playwright browser binaries.

## Deferred post-V1

F-curves, bones, mesh deformation, physics, clip mixing/layers, conditional transitions, event scripting, audio/lip sync, networking, plugins marketplace, cloud saving, and collaboration.

## Verdict

**NOT READY FOR V1 TAG** until the two blockers above are closed. Do not tag from this consolidation change.

## PR 40 evidence update

The gate-closure candidate fixes the remaining known browser contracts and adds
regressions for clean/dirty replacement, rendered DOM references, semantic Rig
readiness/empty state, and lifecycle input paths. Local `npm test`, `npm run
build`, and `npm run verify` pass. Playwright and deployed Pages results remain
pending because this environment cannot download browser binaries or inspect
Actions without GitHub authentication. Accordingly the V1 verdict remains
**NOT READY FOR V1 TAG** pending green PR-head jobs.

## PR 41 status

Browser regression fixes and focused restore lifecycle coverage are implemented locally. Release browser gates remain **pending** until Chromium critical/stability, Firefox/WebKit smoke, and Pages run successfully for the PR head; this document does not infer PASS from source changes.

## PR 42 browser closure status

The final known gaze render-pipeline, SVG selection-lifecycle, and deterministic helper fixes are implemented with unit coverage. V1 is **not yet declared browser-green**: exact-head Chromium, Firefox, WebKit, stability, and Pages Actions results are required before the merge verdict changes. Schema remains v3 and Core Editor Architecture V2 is intentionally deferred.
