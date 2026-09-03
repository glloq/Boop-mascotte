# V2 release status

Where the cartoon 2D/2.5D program stands against
`docs/V2_ROADMAP.md`'s definition of done.

## Gates

| Gate | Command | Result |
| --- | --- | --- |
| Unit | `npm run verify` | 570 / 570, build ✓ |
| Browser (Chromium) | `--grep @critical` | 53 pass, 1 known failure |
| Browser (Firefox, WebKit) | `npm run test:e2e:smoke` | not runnable in the dev container; CI gate |

The one Chromium failure is `@critical blank editor boots safely and
diagnostics stay opt-in`: the container's preview server returns 404 for a
favicon and the test asserts an empty console. It reproduces on `main` at the
program's baseline commit and is unrelated to any V2 change.

Firefox and WebKit binaries are not installed in the container, so the smoke
half of `verify:e2e` runs in CI only.

## Definition of done

| # | A user can… | Status |
| --- | --- | --- |
| 1 | import an SVG mascot | ✅ (unchanged from V1) |
| 2 | assign the face parts | ✅ (unchanged from V1) |
| 3 | select each part without an opaque overlay | ✅ `SELECTION_GIZMO.md` |
| 4 | move / rotate / scale parts easily | ✅ gizmo, one undo per drag |
| 5 | set the pivot intuitively | ✅ pivot handle; the artwork does not move |
| 6 | put several shape keys on one element | ✅ `SHAPE_KEYS.md` |
| 7 | build a head-pose grid | ✅ `HEAD_POSE_2_5D.md` |
| 8 | turn the head in X/Y | ✅ grid + XY pad |
| 9 | get continuous interpolation between poses | ✅ keyform engine |
| 10 | assign two floating hands | ✅ `HAND_RIGGING.md` |
| 11 | place the hand anchors | ✅ anchors follow the body |
| 12 | move the hands | ✅ XY within a soft reach |
| 13 | rotate the hands | ✅ rotation range |
| 14 | define a few hand poses | ✅ shape key or artwork variant |
| 15 | make a Wave animation | ✅ pose parameter, keyable and reaction-driven |
| 16 | use a little cartoon inertia | ✅ spring follower, switchable |
| 17 | combine head + expression + hand + motion | ✅ tested as one fixture |
| 18 | move between expressions without a snap | ✅ `CONTINUOUS_TRANSITIONS.md` |
| 19 | author reactions | ✅ expression + motion + hand gesture |
| 20 | use blink / eye wander / idle | ✅ `BEHAVIORS.md` |
| 21 | preview exactly what the runtime does | ✅ parity asserted by test |
| 22 | export the mascot | ✅ v4 rig + one standalone runtime file |
| 23 | embed it in a web page | ✅ `RUNTIME_API.md` |

## What V2 added

```text
Better editing gizmo
+ Keyforms 1D / 2D
+ Additive Shape Keys
+ Head Pose grid
+ Floating Hands (anchors / XY / rotation / poses / inertia)
+ Parameter Mixer
+ Continuous Transitions
+ Light transform hierarchy
+ Optional small WarpGrid
+ Simple depth / parallax
+ Cartoon idle behaviours
```

and stops there, before any mesh or 3D architecture — see
`FUTURE_OUT_OF_SCOPE.md`.

## Numbers

| | Baseline | Now |
| --- | --- | --- |
| Unit tests | 196 | 570 |
| Rig schema | v3 | v4 |
| Runtime bundle | 17.0 kB / 6.6 kB gz | 46.7 kB / 16.2 kB gz |
| Editor bundle | 465.1 kB / 137.1 kB gz | 609.8 kB / 179.2 kB gz |
| Frame cost (stress fixture) | — | ≈ 0.09 ms |

## Compatibility

Every V2 block is additive. `normalizeRig()` remains the one migration
boundary and turns any v1/v2/v3 rig into v4 with empty blocks; a rig that uses
none of them compiles to a byte-identical frame, and a test asserts exactly
that. Legacy A/B morphs still render, and their conversion to shape keys is an
explicit, tested, opt-in step.

## Known gaps

* **Legacy selection plugins** (`svg.select.js`, `svg.resize.js`,
  `svg.draggable.js`) are still used by the rig calibration pose tools. Ordinary
  selection no longer uses them. Removing the dependency (roadmap PR V2-14)
  waits until those tools move onto the gizmo too.
* **Warp handles on the canvas.** The warp panel adds, sizes, resets, fades and
  removes a grid, and the commands move individual control points; dragging the
  handles directly on the canvas is not wired to the gizmo yet.
* **Head-pose axes are fixed at 3 × 3 in the UI.** The engine and the model
  support any irregular axes (`setHeadPoseAxes`); the panel does not expose it.
* **Firefox and WebKit** are covered by CI only, not by the dev container.
* **Bundle size.** The runtime nearly tripled. It is still 16 kB gzipped and
  buys the entire V2 feature set, but it is worth watching: the next block that
  is not universally useful should be behind an opt-in build.
