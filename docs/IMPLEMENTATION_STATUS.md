# Implementation Status

Updated: 2026-08-31

## DONE

- Release baseline is audited main `04dadd2bddf48a0d918794ec213db7a2dd07bad9`. At the requested audit checkpoint, Verify was green while Browser E2E and Pages were running; the final release report records the completed gate results separately.
- Preview now has independent preview elapsed, clip, and transition clocks. Pausing a clip leaves behaviors active; interrupted timed transitions capture current effective values.
- All transform-capable semantic parts have generic driver defaults and generated-binding ownership. Role reassignment rebuilds owned bindings, deletion preserves manual/shared references, and asymmetric calibration solves amplitude/offset.
- Head and Gaze use pointer/touch XY pads. Timeline no longer resets the same clip, scrub is transient until commit, missing Auto Key tracks are created, easing selection is correct, duration shrink clamps/deduplicates, and ruler/zoom controls are present.
- Starter SVG/example/preset loads clear project state before applying the next asset.
- Unified `PreviewController` owns the RAF and composes state, clip, behaviors, and live overrides without frame-rate store writes.
- Graphical Semantic Part panel: registry-driven add/delete, role assignment from canvas selection, validation, control enablement, sliders, blink test, and reversible transform capture.
- Timeline MVP: clip CRUD, track CRUD, sorted/upserted keyframes, key fields, playhead scrub, playback, loop, and Auto Key on committed graphical controls.
- Basic Face, Expressive Face, and Talking Face configured starters with editable clips.
- Snapshot v3 continues to preserve semantic parts, calibration, clips, selected clip, playhead, and Auto Key metadata. Runtime clip export remains deliberately editor-only.
- Unit regression coverage for clip operations, exact-time upsert, and PreviewController composition/non-persistence/one-loop behavior.

## IN PROGRESS

- Browser-level validation of the new Rig and Timeline workflow.
- Rich morph capture/calculation and per-control method selector polish.
- Rich method-selector and morph-capture browser UX.
- Complete preset catalog (current starters cover Look Around, Smile, Blink, Head Nod, and Simple Talk).

## NOT STARTED

- Runtime schema v4 clip promotion (deferred in favor of stable editor metadata).
- Pose insertion helper and resizable timeline.

## BLOCKED

- `npm ci`: registry proxy returns HTTP 403 for `playwright-core-1.55.0.tgz` (2026-08-31).
- `npm run build` / `npm run verify`: dependencies were removed by failed `npm ci`; Vite is unavailable.
- `npm run test:e2e`: Playwright is unavailable after the failed install, so Chromium, Firefox, and WebKit are unverified locally.
- `npm audit --omit=dev`: registry advisory endpoint returns HTTP 403.

## Last checkpoint

- Last local checkpoint: `npm test` — 67/67 tests pass.
- Next exact task: finish morph capture/method selection and run the full Chromium authoring plus Firefox/WebKit smoke gate.
