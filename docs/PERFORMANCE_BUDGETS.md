# Stability and performance budgets

These are structural lifecycle gates, not flaky shared-runner microbenchmarks.

| Budget | Limit |
|---|---:|
| Active Preview RAF loops | 0 or 1 |
| RAF after Preview stop/destroy | 0 |
| RAF after engine stop | 0 |
| Handler executions for one click | 1 |
| Persistent Store writes during playback | 0 (except explicit authored commits) |
| History additions / dirty changes / validation / autosave during playback | 0 |
| Completely idle DOM updates | 0 |
| Timeline full renders per animation frame | 0 |

With `?debug=1` or `?e2e=1`, diagnostics additionally collect request/cancel/frame counts, compute/apply/timeline elapsed time, store amplification, canvas reconciles, attachments, and DOM writes. Timing is directional evidence only. Tests reset counters without changing application state.

## UX-22 additions

| Budget | Limit | Evidence |
|---|---:|---|
| Validation runs per document revision | 1 | `ux22-stress`: 50 readiness reads and 60 task switches add no runs |
| Document writes while switching tasks | 0 | `ux22-stress` |
| Export of a 60 expressions / 33 motions / 40 reactions project | < 1.5 s in the browser test (typically < 100 ms) | `ux22-stress` |
| Preview loops while a reaction plays / after it returns | ≤ 1 / 0 | `ux22-stress` |
| Palette result for a long project | < 2 s end to end (search itself is synchronous) | `ux22-stress` |
| Horizontal overflow at 320–1440 px | none | `ux22-layout` (critical) |

## Character Builder (roadmap phase 32)

| Budget | Limit | Evidence |
|---|---:|---|
| Pictures drawn per redraw of the parts column, nothing changed | 0 (a registered asset or preset is drawn once; ~0.01 ms a pass for the six presets, against ~4 ms drawn afresh) | `thumbnail-cache.test.js` (`thumbnailStats`, `presetThumbnailStats`) |
| Panel rebuilds per redraw, nothing changed | 0 (the flat model's signature is compared first) | `character-builder.test.js`, "the lifecycle skips an unchanged mascot" |
| Document writes per field | 1 (`change`, never `input`: no rebuild while a number is typed) | `character-builder.test.js`, `ux45` |
