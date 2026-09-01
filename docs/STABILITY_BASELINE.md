# PR 38 stability baseline

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
