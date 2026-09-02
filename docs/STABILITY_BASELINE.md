# PR 38 stability baseline

## PR #44 local closure

The final V1 browser gates were traced to integration contracts rather than the gaze pipeline: the DOM audit used stale text navigation, Export was hidden by an Animate-workspace CSS rule, and SVG.js's decorative selection rectangle owned pointer input above thin artwork. PR #44 uses canonical workspace/menu helpers, keeps Export observable in Animate, and makes only the decorative bounding rectangle pointer-transparent while retaining interactive handles.

Local verification is recorded in `PR44_UI_GATE_CLOSURE.md`. Remote PR-head and post-merge action results remain pending; the baseline is not declared closed until those exact runs succeed.

## Base SHA
`29398a29cbcb6771aabe186bb13f78251d3cade8` (`main`).

## Current CI
The audit supplied: Verify green; Chromium critical red; Firefox/WebKit smoke red; Pages build and deploy green; Pages smoke red. The public Actions API and `gh` artifacts were unavailable in this environment (`gh auth login` required; outbound API tunnel returned HTTP 403), so reports could not be downloaded locally. This limitation is not treated as a passing result.

## Reported user bug
Rapid repeated animation/playback actions progressively freeze or block the editor.

## Reproduction attempts
The base controller was exercised with repeated start, play/pause, stop, captured stale callbacks, clip replacement, and live controls. Browser scenarios cover 100 rapid playback actions, Space, preview/workspace changes, selection, and a manually scheduled 1,000/10,000-operation tier.

## Observed failures
The base used a Boolean RAF guard. A cancelled callback captured before stop could run after a subsequent start, observe `running === true`, and schedule another loop. `pauseClip`/`stopClip` left the always-running preview loop alive. SVG interactions were attached on every refresh/reconcile traversal with no explicit node guard. Runtime writes transform/opacity/path on every evaluated frame.

## Suspected hotspots and measurements before fix
Structural inspection found: one continuously scheduled preview RAF after `start`; seven SVG.js event types re-registered per traversal; three unconditional runtime DOM writes per element/frame; behavior normalization on each preview compute; whole-state clone/normalization per Store mutation; broad stringify domain signatures. The last two are instrumented or deferred rather than redesigned here.

## Categories
**Editor preview:** stale-generation scheduling, permanent RAF, repeated interaction attachment, and redundant DOM writes were actionable. **Standalone runtime:** start was nominally idempotent, but had the same stale-callback generation risk and unconditional writes.

## PR 39 gate closure (base `84022e0511945089b4b872a963cd214200aa334b`)

PR 38's reported browser result was Verify green with Chromium critical,
Stability, Firefox/WebKit smoke, and Pages smoke red. Those browser failures did
not reach the lifecycle loops: blank boot called `exporter.render()`, render
eagerly called `createExportArtifacts()`, and its valid-document guard threw
`Cannot export a project without a valid SVG document`. Module evaluation then
stopped before the opt-in E2E seam was installed.

PR 39 separates the pure export UI policy from explicit artifact creation. A
blank document now produces an unavailable UI model, while artifact creation
retains the strict exception. Editor readiness is published only after initial
renderers and the opt-in seam have been installed.

The logic-level lifecycle suite passed locally, including stale RAF generation,
idempotent playback, and live-control stress coverage. Dependencies were
restored from the local npm cache, but the required browser 100-cycle and
extended 1,000/10,000-operation runs could not be executed in this container
because the Playwright browser download was rejected with HTTP 403; therefore
no browser pass or new timing claim is recorded here. The RAF budget
remains at most one active loop and zero after stop; the interaction attachment
budget remains constant across reconcile. No remaining lifecycle defect was
demonstrated by the executable logic-level checks.

## PR 40 browser-gate closure candidate (base `3952e667f835cf50a60763c39fad76a661472302`)

The remaining failures were separated by contract: clean New Project replacement
must not open the dirty dialog; Face Builder must be reached through the current
Templates disclosure; Preview exits through **Exit Preview**; and canvas stress
uses the public coordinate input path rather than Playwright's raw-SVG locator.
Timeline Add Control now has unique IDs with one shared semantic action. Rig
publishes a ready marker, deterministic semantic-Part hooks, and an explicit
zero-Part state.

The Basic Face and Expressive Face template source guarantees `head`, `gaze`,
`mouth`, and `eyes`; `gaze` owns `pupilLeft` and `pupilRight`. The Face Builder
additionally guarantees `eyebrows`. Thus Gaze is a real template contract, and
the failure was the navigator hook mismatch rather than missing template data.

Local unit (117 tests), production build, and Verify passed. Browser binaries
are absent and their downloads return HTTP 403, so Play/Pause ×100,
Play/Stop ×100, Space ×100, Preview ×100, SVG selection ×100, cross-browser,
Pages, and extended stress remain **pending**, not PASS. V1 browser stability
gates are not declared closed until PR-head Actions supplies that evidence.

## PR 41 browser gate closure (local, CI pending)

The stability coverage now separates Preview workspace navigation from Focus Preview, exercises Space 100 times, uses painted SVG hit-test points for 100 alternating selections, and checks transient dirty/history invariants. Extended and cross-browser results are not marked PASS until PR-head CI evidence exists. Local browser execution was unavailable after `npm ci` was blocked by the registry policy.

## PR 42 closure work

PR 42 corrects the SVG.js 2 frame-application contract, explicitly tears down prior normal selection tooling, and makes details-based E2E helpers state-aware. Gaze assertions now compare numeric translation rather than serialization syntax. The local browser gate remains unverified because Playwright browser downloads are blocked by HTTP 403; do not call this baseline green until Actions succeeds on the exact PR head. See `PR42_FINAL_BROWSER_BASELINE.md`.
