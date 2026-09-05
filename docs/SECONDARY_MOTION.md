# Secondary motion (3D-10)

Hair and ears do not arrive when the head does. They are late, they swing past,
and they settle — and that lag is most of what separates a rig that *moves*
from a rig that is *alive*.

The head turn (`docs/HEAD_POSE_2_5D.md`) places every feature exactly where the
projection says it should be, every frame. That is correct, and slightly dead:
a head that snaps to a pose carries everything drawn on it with the same
infinite stiffness, which is a thing puppets do and heads do not.

## A follower is one element lagging one parameter

```text
headX ────────────────► the head is here now
       ╲
        ╲ spring ─────► the hair still thinks it is here
         ╲
          displacement = (lagging − now) × amount
```

That is the whole model. Two consequences make it safe to leave switched on:

* **at rest it is exactly zero.** The displacement is a *difference*, so a head
  that is not moving displaces nothing at all — no drift, no bias, and a rig
  with followers renders identically to one without whenever it holds still;
* **it never authors anything.** The springs are render-time state in the
  engine, not keyforms. Nothing about them reaches the document, undo has
  nothing to undo, and a runtime that ignores the block plays the movement
  without the trail.

The spring is the one already tuned for hands (`runtime/inertia.js`): the same
critically-under-damped follower, the same overshoot cap, the same rescaling so
the motion keeps its character when the frame rate changes. No collisions, no
cloth, no physics engine — `docs/FUTURE_OUT_OF_SCOPE.md` is where that stays.

## What trails

Not everything. A nose that lagged would read as the face coming apart, not as
weight. The parts that earn a follower come from the semantic roles the author
already assigned:

| Role | Catch-up | Throw | Swing |
| --- | ---: | ---: | ---: |
| `hairBack` | slowest | furthest | 2° |
| `hairTop` | slow | far | 1.2° |
| `hair` (the fringe) | medium | medium | 1.5° |
| `leftEar` / `rightEar` | quick | short | none |

An ear that rotates looks broken; hair that rotates looks alive, so the swing
is zero for anything not long enough to read one.

## Where it comes from

**Generate turn** writes it, in the same command that writes the grid, the
pivots and the bindings — because it is the same decision, and a second
checkbox in a second place for the half of the movement that sells it is how a
feature ships switched off. The checkbox beside the button (*"Hair and ears
trail"*) clears it: regenerate with the box unticked and the followers go, in
one undoable step. The template mascot ships with them for the same reason it
ships with the turn.

## The rig block

```json
"followers": [
  { "element": "hairBack", "enabled": true,
    "parameterX": "headX", "parameterY": "headY",
    "amount": { "x": 9, "y": 5, "rotation": 2 },
    "inertia": { "enabled": true, "stiffness": 0.15, "damping": 0.7,
                 "maxOvershoot": 0.5, "followAmount": 1 } }
]
```

Additive, like every other block: a runtime that predates it ignores an unknown
field, and `normalizeRig` on a rig without one produces `[]`. One follower per
element — a second declaration for the same artwork is dropped rather than
merged, because two springs on one piece is not a richer motion, it is a bug
that is hard to see.

`maxOvershoot` is in **parameter** units, and a head parameter runs −1…+1, so
`0.5` is half a full turn of swing past the mark: generous, and still short of
the artwork leaving the head it is drawn on.

## Where it is computed

In the engine and in the editor's preview — the same module, so what the author
watches cannot trail differently from the mascot they ship. `compileRigFrame`
is handed the offsets and stays a pure function of the pose it is given; the
springs are the only thing in the frame path that remembers a previous frame,
which is why they live beside the render loop and not inside the compile.

`step()` returns the **same object** every frame, mutated in place. This runs
sixty times a second on every element that has one, and a fresh map of fresh
points per frame is exactly the allocation `docs/RUNTIME_PERFORMANCE.md` exists
to keep out of the loop. A recompile that is not a new frame (a state change, a
stop) passes `dt = 0`, which holds what is on screen rather than advancing the
spring by an invented step.

## What this is not

Not a physics system. There is no mass, no collision, no chain of segments, no
cloth. A follower cannot be attached to another follower. If a mascot ever
needs that, it is a signal to simplify the mascot.
