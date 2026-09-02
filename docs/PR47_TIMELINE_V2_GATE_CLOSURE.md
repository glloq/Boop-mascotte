# PR 47 — Timeline V2 browser-gate closure

## Exact merged-main baseline

- main SHA: `b929dfb93d52fcf1d05bed62ebb3ec52f5f9d523`
- Browser E2E run: `33585707280`
- Verify: **SUCCESS**
- cross-browser-smoke: **SUCCESS**
- chromium-critical: **FAILURE** (11 passed, 1 failed)
- stability: **FAILURE** (0 passed, 6 failed)
- Pages build/deploy/smoke: **SUCCESS**

PR 46 was therefore not globally green.

## Failure diagnosis

The critical failure was `@critical timeline project metadata persists and remains playable after reload`.
Its obsolete `state()` seam cloned the merged compatibility facade. The authored
`ProjectDocument` and normalized `EditorSession` are independently structured-cloneable;
the compatibility boundary has no such contract and can retain values originating in
the legacy Proxy mutation facade. The first reported clone root was the flat facade
(`Object`), with a Proxy-originated nested object (`#<Object>`); it was not a DOM node,
function, or Symbol. Timeline entered that legacy path when its authored and transient
recipes used `store.setState`. The replacement inspection seam now projects and clones
the two canonical V2 owners separately, so no compatibility-facade identity is exposed.

The six stability tests all shared `beforeEach → Basic Face → createAnimation('Stress')`.
The name input's `change` listener performed a synchronous legacy store mutation. Its
animation notification called `timeline.render()`, whose `host.innerHTML` replacement
removed the dispatch target while the browser was still completing change/blur. This
is the common source of the observed `NotFoundError`.

## Architecture and history policy

Authored Timeline recipes now cross a small command boundary which owns exactly one
`history.snapshot()` followed by one `animation`-domain document mutation. Transient
active clip, playhead, panel, and Auto Key state use `mutateSession` and create no
history entry. Snapshot-based ProjectDocument history remains in place.

Reactive Timeline rendering is requested through one `requestAnimationFrame` slot.
Requests coalesce, reentrant calls are deferred, and reset generations cancel or reject
stale work. Immediate rendering remains only for boot and local, known-safe UI updates.
Diagnostics expose requests, coalescing, renders, prevented reentrancy, and pending work.

Schema version 3 is unchanged. Runtime Compiler, Keyforms, Expressions, Emotes, and
Reactions were not started.
