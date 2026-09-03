# Out of scope for V2 (documented, deliberately not built)

These subjects are recorded so they stop being re-litigated during V2. They are
not rejected forever; they are rejected *for this program*, because each one
trades Boop's core promise — a light, understandable cartoon mascot editor —
for professional-rigging generality.

## Not implemented in V2

* A real 3D engine, a 3D renderer, mandatory WebGL or WebGPU.
* UV textures, high-density meshes, general SVG triangulation.
* Skinning, per-vertex weights, humanoid skeletons, advanced bones, arm IK.
* Full physics: cloth, complex hair dynamics, rigid bodies, a general
  collision solver.
* A complete Live2D or Inochi2D engine.
* ONNX / on-device ML inference inside the runtime.
* Professional F-curve editing, a Blender-class editor.

## What V2 does instead

| Wanted effect | V2 answer |
| --- | --- |
| head turns in 3D | 2D keyform grid (`headX` × `headY`) + shape keys + parallax offsets |
| arms reaching | floating hands: anchor + XY + rotation + poses + spring inertia |
| hair/ears reacting | one shared light spring follower, optionally a 3×3 warp grid |
| squash & stretch | additive shape keys on parsed path vectors |
| depth | a scalar `depth` per element, small parallax offsets, hysteretic draw-order bands |

## The test each idea has to pass

> Can we get 80–90 % of the cartoon result with a much simpler solution?

If yes, the simple solution is the correct one, and the sophisticated one
belongs on this page.

## Revisit conditions

Any item here can be reconsidered once V2 ships, if a real mascot cannot be
made convincing without it and no simpler approximation exists. The burden of
proof is a concrete mascot that fails, not a general capability argument.
