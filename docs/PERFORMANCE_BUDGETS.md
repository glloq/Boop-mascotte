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

## V4 reference scenes (docs/V4_ROADMAP.md, V4-004)

The raster program changes what a mascot is *made of*, so it is measured
against three scene shapes rather than one number. The load-bearing
assertions are structural and hold on any machine; the ceiling is roughly
four times what the scene measured when it was frozen, and exists only to
catch an order-of-magnitude regression.

| Scene | Nodes | Frozen | Ceiling | What it guards |
|---|---:|---:|---:|---|
| Rigid raster — nodes that only move | 200 | 1.41 ms/frame | 6 ms | Phase 2: `<image>` nodes must not add per-node compile work |
| Mesh — nodes whose shape is rebuilt | 8 | 0.06 ms/frame | 1 ms | Phase 7: `mesh-image` deformation |
| Vector — today's built-in face | 130 | 1.45 ms/frame | 6 ms | No regression while the other two are built |

Evidence: `v4-reference-scenes.test.js`, scenes in `fixtures/reference-scenes.js`.

| Budget | Limit | Evidence |
|---|---:|---|
| Nodes compiled per scene | exactly the scene's count | a scene that stops drawing half of itself would read as a speed-up |
| Path strings rebuilt when nothing changed | 0 (same string instance back) | identity, not equality |
| Cost of a deforming node vs a rigid one | < 12× | it was ~1.1× when frozen |

**The finding this baseline exists to protect.** Two hundred nodes that only
move cost about the same per frame as a hundred and thirty that deform —
roughly 7 µs a node against 11 µs. Deformation is not where the money goes;
node count is. So the scene to watch through Phase 2 is the rigid one, and
Phase 7 starts with more headroom than it appears to.
