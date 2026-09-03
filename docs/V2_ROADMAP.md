# Boop V2 — cartoon 2D / 2.5D roadmap

Boop V2 turns the existing SVG rig editor into an editor and runtime for
**interactive cartoon mascots**: animated faces, expressions, continuous
motion, a 2.5D head rotation illusion, floating Rayman-style hands, chained
animations without pose snaps, small cartoon deformations, automatic idle
behaviours, and a light runtime that drops into a web page.

It is explicitly **not** a Live2D / Inochi2D / Spine / Blender clone. The order
of priorities is: *user simplicity → runtime lightness → cartoon look →
stability*.

## Rendering philosophy

```text
SVG → Transforms → Shape Keys → Keyforms → small optional warps → SVG DOM
```

Not:

```text
SVG → dense mesh → triangulation → skin weights → skeleton → WebGL
```

## Architecture target

```text
                   BOOP V2
                      │
                      ▼
               Parameter Mixer
       ┌──────────────┼──────────────┐
 Expressions       Motions       Behaviors
 Reactions         Timeline      Live control
       └──────────────┼──────────────┘
                      ▼
              Final Parameters
           ┌──────────┼──────────┐
      Bindings     Keyforms   Shape Keys
           └──────────┼──────────┘
                      ▼
             Deformation Core
       ┌──────────────┼───────────────┐
 Transform        Path Shape       Small Warp
       └──────────────┼───────────────┘
                      ▼
                 SVG Renderer
```

## Phases

| Phase | Subject | Priority | Docs |
| --- | --- | --- | --- |
| A | Baseline audit | P0 | `V2_BASELINE.md` |
| B | Selection + transform gizmo | P0 | `SELECTION_GIZMO.md` |
| C | Keyform core 1D | P0 | `KEYFORM_ENGINE.md` |
| D | Keyform core 2D | P0 | `KEYFORM_ENGINE.md` |
| E | Schema v4 keyforms | P0 | `KEYFORM_ENGINE.md` |
| F | Runtime keyform evaluation | P0 | `KEYFORM_ENGINE.md` |
| G | Additive shape keys | P0 | `SHAPE_KEYS.md` |
| H | Head pose 2.5D | P0 | `HEAD_POSE_2_5D.md` |
| I | Hand semantic parts | P0 | `HAND_RIGGING.md` |
| J | Cartoon hand inertia | P1 | `HAND_RIGGING.md` |
| K | Parameter mixer | P1 | `PARAMETER_MIXER.md` |
| L | Continuous transitions | P0 | `CONTINUOUS_TRANSITIONS.md` |
| M | Light matrix hierarchy | P1 | `DEFORMER_MODEL.md` |
| N | Small SVG warp grid | P2 | `WARP_GRID.md` |
| O | Depth / parallax | P1 | `DEPTH_PARALLAX.md` |
| P | Cartoon idle behaviours | P1 | `BEHAVIORS.md` |
| Q | Mascot presets | P1 | — |
| R | Validation diagnostics | P1 | — |
| S | Performance | P2 | `RUNTIME_PERFORMANCE.md` |
| T | Public runtime | P0 | `RUNTIME_PERFORMANCE.md` |
| U | Documentation | — | this file |

Absolute priority order when resources are limited:

```text
P0  Selection/Gizmo · Keyforms · Shape Keys · Head Pose · Continuous Transitions · Hands
P1  Parameter Mixer · Transform Hierarchy · Hand Inertia · Hand Poses · Depth · Behaviors
P2  WarpGrid · Advanced cartoon corrections · Performance refinements
```

WarpGrid must never delay head pose, hands, transitions, or shape keys.

## Hard constraints

* Keep JS ES modules, Vite, SVG, and the existing `editor/core/runtime` split.
  No React, no rewrite, incremental change only.
* **No duplicated math.** Editor preview and the exported runtime call the same
  evaluator. `editorKeyformMath()` + `runtimeKeyformMath()` is a defect.
* `normalizeRig()` stays the one migration boundary: v1/v2/v3 → canonical v4.
  Old projects never break.
* The exported runtime embeds no editor code: no undo, no inspectors, no
  gizmos, no Playwright, no authoring commands.
* Per frame: never parse a path, never rebuild the SVG, never clone the
  project, never `querySelector` the document per parameter.

## Decision rule

For every feature ask: *can we get 80–90 % of the cartoon result with a much
simpler solution?* If yes, take the simple one.

| Instead of | Boop does |
| --- | --- |
| IK + skeleton for arms | floating hand + anchor + XY + rotation + inertia |
| 3D head mesh | 2D keyform grid + shape keys + parallax |
| Hair physics | small secondary motion / spring / warp grid |

Out-of-scope subjects are listed in `FUTURE_OUT_OF_SCOPE.md`; references and
their licences in `OSS_REFERENCES.md`.

## Definition of done (V2)

A user can import an SVG mascot, assign face parts, select/move/rotate/scale
each part with a readable gizmo and an adjustable pivot, stack several shape
keys on one element, build a head-pose grid and rotate the head in X/Y with
continuous interpolation, assign and animate two floating hands with poses and
a little cartoon inertia, combine head + expression + hand + motion, switch
expressions without a snap, author reactions, use blink/eye-wander/idle, see a
preview identical to the runtime, export, and embed the result in a web page.
