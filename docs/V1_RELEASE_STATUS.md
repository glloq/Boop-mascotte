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
