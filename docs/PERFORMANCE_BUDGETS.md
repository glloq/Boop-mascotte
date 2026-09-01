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
