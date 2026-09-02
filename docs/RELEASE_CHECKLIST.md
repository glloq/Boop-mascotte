# v1 release checklist

## PR #44 UI gates

- [x] DOM/ARIA audit retains strict duplicate-ID and referenced-target checks.
- [x] Workspace and project Advanced navigation use semantic scoped helpers.
- [x] Export panel exposes ready/unavailable state and stays visible in Animate.
- [x] Artifact construction remains download-triggered; blank creation refuses.
- [x] Decorative SVG selection border does not intercept artwork pointers.
- [x] Resize handles retain pointer ownership.
- [x] Unit tests, build, and verify pass locally.
- [ ] PR-head Chromium critical, stability, and cross-browser smoke succeed.
- [ ] Post-merge `main` browser and Pages jobs succeed.

- [ ] `npm ci`, unit tests, verification and production build pass.
- [ ] Critical Chromium user journeys and Firefox/WebKit smoke tests pass.
- [ ] Extended Chromium scenarios have been reviewed in the scheduled/manual workflow; they do not block routine pushes.
- [ ] GitHub Pages environment uses the Actions deployment source.
- [ ] Sample, SVG import, preview and browser console are clean.
- [ ] Project save/open and autosave recovery work.
- [ ] SVG, rig and runtime exports download and validate.
- [ ] The standalone runtime demo responds to parameters and states.
- [ ] Desktop, tablet and mobile layouts keep critical actions reachable.
- [ ] Malicious SVG fixture is sanitized; runtime contains no dynamic evaluation.
- [ ] README, user guide, format documentation and limitations are current.

Do not tag `v1.0.0` until every required item is checked on the deployed artifact.

## Current public-UX checks

- [ ] Exercise only visible Create/Rig/Animate/Preview controls (hidden file inputs are allowed behind visible picker labels).
- [ ] Download `mascot.svg`, `rig.json`, and `runtime.js` through their three explicit artifact buttons in every browser.
- [ ] Confirm project replacement clears selection, semantic/control focus, timeline focus, preview overrides, and playback.
- [ ] Confirm `/Boop-mascotte/` and `/Boop-mascotte/demo/` on the deployed Pages URL.

## Visual Rig acceptance

- [ ] Import an unrigged SVG and confirm Rig shows **+ Add Part**.
- [ ] Add a part, pick artwork on canvas, cancel with Escape, and verify Undo/Redo.
- [ ] Move a pivot and confirm artwork stays stationary; save/open and confirm the pivot.
- [ ] Capture and calculate two transform poses; assert the rendered SVG transform at control extremes.
- [ ] Capture compatible morph endpoints visually and assert path output at 0, .5 and 1.
- [ ] Confirm Create rectangle/move/resize/appearance/duplicate/delete/Undo/Redo remains operational.

## Dope Sheet release gate
- [ ] Animation navigator CRUD and destructive confirmations
- [ ] Resize does not dirty/export animation data
- [ ] Ruler seek, playhead scrub, zoom/Fit and horizontal scroll
- [ ] Multi-select, marquee, group move/collision, delete and Undo/Redo
- [ ] Copy/paste, duplicate, frame/key navigation and snapping
- [ ] Single/multi-key easing, Auto Key, Save/Open and playback
- [ ] Keyboard/a11y checks and tablet/phone reachability
# States, Transitions, and Behaviors

- [ ] Create State
- [ ] Edit State pose
- [ ] Duplicate/Rename/Delete State
- [ ] Set Initial State
- [ ] Add transition
- [ ] Edit duration/easing
- [ ] Directed policy works
- [ ] Test transition
- [ ] Save/Open transitions
- [ ] Add Blink
- [ ] Add Random Idle
- [ ] Add Oscillator
- [ ] Configure targets
- [ ] Enable/Disable
- [ ] Save/Open behaviors

## PR 40 gate evidence

- [x] Local unit tests, production build, and Verify pass on the PR 40 candidate.
- [x] Basic Face's source contract deterministically includes Gaze and its pupil roles.
- [x] Rig has an explicit **No semantic parts yet** / **+ Add Part** state.
- [x] Timeline Add Control controls use unique IDs and a shared semantic action.
- [ ] Chromium critical and stability are green on PR HEAD.
- [ ] Firefox and WebKit smoke are green on PR HEAD.
- [ ] Pages build, deploy, smoke, and `/demo/` are green on PR HEAD.
- [ ] The 100-cycle and extended stress loops complete in a browser-enabled runner.

## PR 41 stability baseline

- [x] Semantic hooks replace obsolete design-tool, template, workspace, and Rig selectors.
- [x] Preview workspace and Focus Preview stress journeys are separate.
- [x] SVG selection stress uses real mouse input at verified painted hit points.
- [x] Snapshot restore deterministically resolves and binds the active clip/playhead.
- [ ] Chromium critical passes at PR head.
- [ ] Chromium stability passes at PR head.
- [ ] Firefox and WebKit smoke pass without flakes at PR head.
- [ ] Pages build, deploy, and smoke pass for the relevant head/deployment.

## PR 42 exact-head browser gate

- [x] Classify base browser failures by product/test/helper/lifecycle cause.
- [x] Cover reversible compiled gaze for both pupils below Playwright.
- [x] Use state-aware project-menu and Face Builder details helpers.
- [x] Explicitly deactivate prior normal SVG selection tooling.
- [ ] Verify 12/12 Chromium critical on exact PR head.
- [ ] Verify complete Chromium stability and extended stress on exact PR head.
- [ ] Verify Firefox and WebKit smoke without retries on exact PR head.
- [ ] Verify Pages build, deploy, and smoke on exact PR head.
- [ ] Re-run every gate on the merged main SHA.

- [ ] PR45: verify transient stress produces zero document mutations/autosaves and all browser gates remain green.
# PR 46 mandatory gate

- [ ] Exact PR head: Verify, Chromium critical, stability 6/6, Firefox/WebKit smoke
- [ ] Pages build, deploy, starter-project smoke, and preview/export smoke
- [ ] Basic, Expressive, Talking, and Face Builder report zero legacy template mutations
- [ ] Post-merge `main` SHA repeats every browser and Pages gate
