# UX-23.1 — Extended suite realignment

## Baseline

After UX-23 the extended Chromium suite (`npm run test:e2e:extended`, run nightly by `extended-e2e.yml`) still failed 12 journeys that predate the UX program: one in `tests/e2e/editor.spec.js` and eleven in `tests/e2e/rig-timeline.spec.js`. They encoded the pre-UX-02 shell — bare part buttons in a Rig tab, a Canvas transport in Preview, quick-state buttons, calibration by direct capture — rather than product regressions. This closure moves each journey onto the task-based shell without weakening what it proves.

## Realigned journeys

| Journey | Stale expectation | Current contract used |
| --- | --- | --- |
| runtime resolves CSS-significant SVG ids | `import('../runtime/runtime.js')` from the served editor (the runtime is not deployed next to the built editor) | the standalone source (`project/runtime/runtime.js`) is loaded through a Blob module, as the exporter ships it |
| Head calibration and controls | `Capture Head X CENTER` buttons, `[data-control]` sliders in the part view | Face Setup → Movement Inspector: `Pose and capture CENTER/RIGHT`, a real canvas drag, `[data-rig-control="head:headX"]`, the Tilt movement, `Center` |
| Eye Open morph, method switching, binding conflicts | part buttons matched by bare name; `Capture CLOSED/OPEN` without a session | `selectSemanticPartById` + Controls / Calibrate tabs; `[data-edit-morph]` shape sessions closed with `#capture-morph-pose` |
| method switching | Basic Face mouth without a morph | the Basic Face smile is a morph; an element carries one morph slot owned by the last captured control |
| Save/Open survival | `[data-control="lookX"]` after a bare-name part click | `openGazeControl` (`[data-rig-control="gaze:lookX"]`) |
| track CRUD drag, Talking Face drag | `dragTo` at a fraction of the lane width (lanes are wider than the clip) | `dragKey`: the lane scale is derived from two existing keys, so a drag lands on an exact time |
| loop playback wrap | four samples in 1.5 s could miss a 0.4 s wrap | sampled every 40 ms for up to 4 s |
| paused clip + Blink | transport in Preview; `#eyeLeft` transform; zero blink interval; pupils frozen although Idle sway moves them | transport in Animate (Preview is a bench since UX-08); effective `eyeOpen` cycles with a 0.15 s interval while the clip-driven `lookX` and `clipTime` stay frozen |
| state transition | `[data-quick-state]`, mouth transform | `[data-preview-state="happy"]` chips; the smile morph changes the mouth path |
| Talking Face auto-key | control sliders next to the timeline; play from wherever Auto Key left the playhead | Auto Key records the Face Setup movement slider at the Animate playhead; rewind before playing, also after reload |

`essential editor controls remain available on phone and tablet` already matched the badge-bearing task tabs on the branch and needed no change.

## Product fixes surfaced by the realignment

- `svg-canvas.js` `parseTransform`: SVG.js 2.x `transform()` extracts `{x, y, rotation, scaleX, scaleY}`; the parser only read the 3.x names, so any artwork moved through its `transform` (groups such as the Basic Face `faceRoot`) calibrated to a zero pose and imported with an identity base transform. The 2.x names are read first, the 3.x names stay as a fallback.
- `timeline-panel.js` key-time edit: committing the same time again pushed a no-op history entry, so one Undo after a collision edit appeared to do nothing. The edit is now idempotent, like the value edit since UX-11.

## Tests

- `npm run verify`, `npm run test:e2e:extended` and `npm run test:e2e:stress` (the nightly pair) green in Chromium.
- Critical, stability, `pages.spec.js`, every `ux*.spec.js` slice and the visual baselines re-run because two product files changed.

## Deferred

Nothing from the extended suite remains stale. Cross-browser runs of the extended suite stay out of the nightly job, as before.
