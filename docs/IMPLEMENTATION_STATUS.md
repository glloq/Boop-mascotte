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

- Semantic Rig and Timeline browser release contracts are IMPLEMENTED / E2E AUTHORED; execution is BLOCKED locally by the Playwright registry HTTP 403. Cross-browser GitHub release gates remain pending.
- Complete template modules and atomic switching now cover Look Around, Smile, Blink, Happy, Surprised, Head Nod, and Simple Talk.
- Domain-scoped panel rendering, cached/debounced validation, and transient autosave isolation are implemented.

## NOT STARTED

- Runtime schema v4 clip promotion (deferred in favor of stable editor metadata).
- Pose insertion helper and resizable timeline.

## BLOCKED

- `npm ci`: registry proxy returns HTTP 403 for `playwright-core-1.55.0.tgz` (2026-08-31).
- `npm run build` and `npm run verify` passed before the required `npm ci` retry removed dependencies; reruns are now blocked until installation is available.
- `npm run test:e2e`: Playwright is unavailable after the failed install, so Chromium, Firefox, and WebKit are unverified locally.
- `npm audit --omit=dev`: registry advisory endpoint returns HTTP 403.

## Last checkpoint

- Last local checkpoint: `npm test` — 74/74 tests pass. The prior production build passed; the final clean-install retry is locally blocked by registry HTTP 403, so Vite/Playwright are unavailable.
- Method selection now switches owned transform/morph drivers atomically; mouth and eye path poses capture without raw path input, reject incompatible layouts safely, and persist ownership metadata.
- Next exact task: push `work`, run the authored suite in Chromium/Firefox/WebKit via GitHub Actions, repair any observed application/test failures, then verify Pages.
