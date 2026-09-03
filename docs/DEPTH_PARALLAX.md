# Depth and parallax

There is no Z axis, no camera and no projection. Each element carries a scalar
`depth`, and the head pose nudges it sideways by a fraction of that.

```text
hairFront   +0.8
nose        +0.6
eyes        +0.3
face         0
ears        -0.2
hairBack    -0.8
```

```js
offsetX = headX * depth * parallaxAmount
offsetY = headY * depth * parallaxAmount
```

Two multiplications per element, and a mascot reads as having volume.

Implementation: `project/runtime/depth.js`.

## Settings

```js
parallax: {
  enabled: true,
  amount: 6,
  parameterX: 'headX',
  parameterY: 'headY',
  bands: [-0.35, 0.35],
  hysteresis: 0.08
}
```

`depth` is clamped to `[-1, 1]`. An element with no depth, or a rig with no
parallax settings, compiles exactly as before — the offset is added alongside
the pose contribution and under the same constraints, so a disabled `translate`
constraint disables parallax with it.

## Draw order

Depth also sorts. The roadmap is explicit about what to avoid:

```text
depth > 0 → front
depth < 0 → behind      ← flickers whenever a depth sits on the boundary
```

Instead there are three discrete **bands** — `behind`, `normal`, `front` — with
**hysteresis**. An element already at the front must come back past the
boundary *plus* a margin before it drops out; symmetrically at the back. A
depth hovering on a boundary therefore stays where it is instead of swapping
order every frame.

`depthOrder()` sorts back to front within the whole set, tie-breaking on id so
equal depths keep a stable order rather than shuffling between frames.

## Hands

A hand has its own `depth`, plus a `handLDepth` / `handRDepth` parameter that
animates it. The runtime reports `frame[hand].depthBand` — `behind`, `normal`
or `front` — and the engine feeds the previous frame's bands back in, so
hysteresis applies to a hand crossing in front of the body exactly as it does
to hair crossing behind a head. Depth is deliberately excluded from hand
inertia: draw order must not wobble.

## What this is not

No Z buffer, no perspective divide, no per-element camera. If a mascot ever
needs more than this, that is a signal to simplify the mascot, not to add a
renderer — see `docs/FUTURE_OUT_OF_SCOPE.md`.
