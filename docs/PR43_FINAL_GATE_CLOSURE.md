# PR #43 final browser-gate closure

Base: `618b01693213e6a42260e00e3100d44eb1c155b0`  
Observed workflow run: `33569437914` (the public run log was unavailable from this environment; exact assertion text below is transcribed from the supplied failure report and will be refined from local reproduction before completion).

## Initial failure matrix (before fixes)

| Test | Browser | Exact assertion | Actual | Expected | Classification | Root cause | Production fix | Test fix | Regression coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cross-browser production workflow / expressive gaze | Chromium, Firefox, WebKit | `expect.poll(() => window.__BOOP_E2E__.effectiveParams().lookX).toBeGreaterThan(0)` | `0` | greater than `0` after public `lookX = +0.8` input | INPUT EVENT BUG | Under investigation: trace the public range input through the transient preview bridge. | Pending trace. | No state-injection shortcut; retain real public range interaction and numeric SVG assertions. | Basic, Expressive, and generated face at `+0.8` and `-0.8`; Expressive in all engines. |
| Critical DOM/ARIA audit / blank editor | Chromium | `expect(result, label).toEqual({ duplicates: [], missing: [] })` | `{ duplicates: ["new-clip"], missing: [] }` | `{ duplicates: [], missing: [] }` | DOM BUG | Both the animation navigation and no-active-animation empty state render `id="new-clip"` simultaneously. | Replace the repeated command ID with a semantic `data-action` contract. | Keep the audit enabled and share its scanner across audited workspaces. | Blank, Basic, Rig, populated/empty Animate, States, Problems, Export, and Preview. |
| Repeated SVG selection attaches one handler set | Chromium | `hitTestablePoint(page.locator('#mouth'))` | throws `No painted, hit-testable point found for mouth` | a genuine painted point that can be clicked with `page.mouse.click` | SVG HIT-TEST BUG | The helper samples only a bounding-box grid; the mouth is a thin stroked path whose box is mostly unpainted. Overlay interception remains to be measured. | None unless hit-stack diagnostics prove a production overlay defect. | Sample SVG geometry with `getTotalLength()` / `getPointAtLength()`, verify the top hit via `elementsFromPoint()`, retain bbox fallback and detailed diagnostics. | Fresh hit point on every head/mouth transition ×100 and ×1000 stress; bounded selection/overlay/listener state. |
| Generated Build-a-Face gaze critical flow | Chromium | pupil numeric translation must change after public `lookX = +0.8` input | visually unchanged / zero translation | non-zero translations for both pupils, reversing at `-0.8` | INPUT EVENT BUG | Under investigation alongside the shared public Rig input bridge and generated bindings. | Pending trace. | Exercise the same public control contract as normal projects. | Generated gaze semantic part, bindings, effective values, and both pupil translations. |

## Investigation log

Values, lifecycle counts, hit stacks, and final command results are recorded here as they are measured. Interactive Rig controls are intended to be transient preview inputs: they update `PreviewController` live parameters, compile/apply a frame immediately, and do not mutate project history or dirty state.

## Final implementation findings

### A. Duplicate DOM ID

`timeline-panel.js` rendered the animation-navigation command and the no-active-clip empty-state command together with the same `id="new-clip"`. Both are commands, not label targets. They now share `data-action="new-clip"`; the delegated click handler and direct test selectors use that semantic contract. No ARIA attribute referenced the old ID.

### B. Public Rig gaze contract

The selected gaze part exposes one range with `data-rig-control="gaze:lookX"`, `min=-1`, `max=1`, and `step=.01`. Its `input` event is a transient preview operation: the handler converts the DOM string to a number, writes `PreviewController` live state, applies the compiled frame immediately, and updates the adjacent output without a panel rerender. `change` offers the value to Timeline Auto Key when enabled; it does not change the persistent parameter merely for testing a pose. Leaving Rig clears live values. Thus slider motion creates neither a project history snapshot nor dirty/autosave work, and no permanent RAF is involved.

A read-only E2E `controlState(name)` diagnostic reports match/visibility/value state, live and effective values, and both compiled pupil transforms. The helper targets the unique part/control hook, asserts exactly one enabled visible control, uses native range `fill`, performs a real keyboard nudge, restores the requested value, and blurs once. Existing numeric assertions cover Expressive in Chromium/Firefox/WebKit; generated-face assertions were strengthened at unit level. The existing template unit matrix proves Basic and Expressive at `0`, `+0.8`, and `-0.8`; the new generated-face test proves both generated pupils move and reverse.

### C. SVG hit testing and selection

The Basic mouth is a `path` with `fill="none"`, a rounded `#9f3d46` stroke of width `9`, and a curved centerline. The old helper inspected only 81 bounding-box interior points, so it could miss the narrow painted curve. The new helper:

1. samples 41 positions along `getTotalLength()` / `getPointAtLength()` geometry;
2. transforms each local point through `getScreenCTM()`;
3. probes the centerline plus four small stroke/scale-derived offsets;
4. accepts only a target/descendant that is actually topmost;
5. falls back to a denser bounding-box scan for filled shapes; and
6. reports the target, rect, paint, stroke width, geometry length, selected ID, sampled points, top hits, and `elementsFromPoint()` stacks on failure.

A read-only E2E `hitStack(x, y)` diagnostic remains available. Hit points are still recomputed on every selection transition and clicks still use `page.mouse.click`; there is no forced click, synthetic click, click-through, or selected-state mutation. Static inspection found no reason to weaken production overlay pointer behavior.

## Verification record

- `npm ci`: registry download was blocked with HTTP 403; `npm ci --offline` succeeded from the package cache and reported 0 vulnerabilities.
- `npm test`: 121/121 passed, including generated-face gaze.
- `npm run build`: passed.
- `npm run verify`: passed.
- Browser E2E and screenshot capture: not runnable locally because all Playwright browser downloads were blocked with HTTP 403 and no browser executable exists in the environment. These gates must run on the PR HEAD in GitHub Actions before the PR can be declared ready.
- `npm audit` and `npm audit --omit=dev`: the registry advisory endpoint was blocked with HTTP 403. The offline install's audit reported 0 vulnerabilities, but this is not a substitute for the requested online checks.
- Schema remains `RIG_SCHEMA_VERSION = 3`.

## Merge readiness

**NOT READY TO MERGE until the PR-head Chromium critical, stability, cross-browser smoke, Pages, and stress jobs have completed successfully.** No result is inferred for an unrun browser gate.
