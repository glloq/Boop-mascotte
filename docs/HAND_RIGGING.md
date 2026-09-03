# Hand rigging

```text
BODY
 │
 ├─ leftHandAnchor
 │       └─ LEFT HAND
 │
 └─ rightHandAnchor
         └─ RIGHT HAND
```

Boop's hands are **floating artwork**, Rayman-style. There are no arms, no
skeleton and no IK. A hand hangs off an anchor point on the body: the anchor
follows whatever the body does, and the hand keeps its own local animation on
top of that.

That is the roadmap's decision rule in practice — an anchor plus XY, rotation
and a spring gets 80–90 % of the reaching-hand result for a fraction of a
skeleton's machinery.

Implementation: `project/runtime/hands.js`, `project/runtime/inertia.js`,
authoring in `project/editor/core/hands/hand-model.js`.

## The record

```js
hands: {
  left: {
    side: 'left',
    element: 'handLeft',        // artwork
    parent: 'body',             // what the anchor follows
    anchor: { x: -20, y: 40 },  // in the parent's own coordinates
    restOffset: { x: 0, y: 0 },
    reach: { x: 40, y: 30, rotation: 30, scale: 0.2 },
    softness: 0.25,
    depth: 0,
    parameters: { x: 'handLX', y: 'handLY', rotation: 'handLRotation',
                  scale: 'handLScale', depth: 'handLDepth' },
    poses: [{ id: 'wave', name: 'Wave', parameter: 'handLWave',
              shapeKey: 'handLeft-wave', variant: null }],
    inertia: { enabled: false, stiffness: 0.25, damping: 0.65,
               maxOvershoot: 0.35, followAmount: 1 }
  },
  right: { … }
}
```

Parameters are normalized `-1…1`; `reach` converts them into user units, degrees
and a scale factor. One idea — "how far this hand can go" — covers translation,
rotation and size.

## Anchors

The anchor is a point in the body's own coordinates. Each frame the runtime maps
it through the body's **rest** transform and its **current** transform and adds
the difference to the hand:

```text
drift = parentTransform(anchor) − parentRestTransform(anchor)
hand  = rest + localOffset + drift
```

So "the body moves, the anchors move with it" and "the hand keeps its own local
animation" are both true at once, and the anchor follows rotation and scale, not
only translation.

## Reach

```text
((x / reachX)² + (y / reachY)²) ≤ 1
```

The limit is **soft**, not a clamp: outside the ellipse the radius eases towards
`1 + softness` instead of stopping dead, so a cartoon hand can overshoot a
little. `softness: 0` restores a hard limit for anyone who wants one.

`handReachEllipse` returns the guide to draw around the anchor.

## Poses

Two methods, and the system never forces a full set:

**A — Shape key** (preferred, when the topology allows it)

```text
neutral + pose delta
```

The pose contributes a weight to a shape key on the same artwork.

**B — Artwork variant** (when the geometry is too different)

```text
Hand
 ├─ neutral
 ├─ fist
 ├─ point
 └─ thumbsUp
```

The pose cross-fades: the variant fades in by exactly as much as the neutral
hand fades out. Position, rotation and scale stay continuous throughout, so
there is never a visual cut.

Suggested poses: Neutral, Open, Fist, Point, Wave, Peace, Thumbs Up. A mascot
with none of them still animates perfectly well.

## Mirroring

```js
mirrorHand(hands, 'left', { mirrorX: 100, element: 'handRight',
                            shapeKeys: { 'handLeft-wave': 'handRight-wave' } })
```

Anchors and rest offsets mirror around the artboard centre line, the rotation
range flips sign so a "wave outwards" stays outwards, and poses carry over under
the other side's parameter names. Shape keys and variants are only carried when
a mapping is supplied, because the mirrored hand usually has its own artwork.

## Inertia

```js
velocity += (target - position) * stiffness;
velocity *= damping;
position += velocity;
```

One under-damped follower per parameter — **not** a physics engine. It gives the
small lag, overshoot and settle that make a hand feel alive.

| Setting | Effect |
| --- | --- |
| `stiffness` | how hard it chases the target |
| `damping` | how quickly the swing dies down |
| `maxOvershoot` | hard cap, in parameter units, on how far past the target it may swing |
| `followAmount` | dials the whole effect down without retuning the spring |

The defaults are stable, `enabled: false` makes the group a pass-through, and
`engine.setHandInertiaEnabled(side, false)` switches it off at runtime. Timing
is rescaled from a 60 fps reference and capped at four substeps, so a hidden tab
cannot launch a hand across the screen. Depth is deliberately excluded from
inertia: draw order must not wobble.

The same follower can later serve ears, antennae, simple hair, accessories and a
simple tail. It stops there — see `docs/FUTURE_OUT_OF_SCOPE.md`.

## Setup workflow

```text
Select artwork → Place anchor → Place neutral hand → Adjust reach
→ Create poses → Test
```

## Diagnostics

Missing artwork, an anchor pointing at a deleted body part, a reach of zero, a
pose that does nothing, a pose whose shape key or artwork is gone, a movement
parameter that no longer exists, and inertia settings that would never settle —
all reported in the author's language, in the `hands` validation domain.

## Tests

`hands.test.js` covers assignment per side, independence of the two hands, body
movement moving the anchors while local movement survives, anchors following
rotation and scale, rotation and scale ranges, reach mapping, soft limits and
the diagonal case, both pose methods, pose transitions with no jump, mirroring,
spring lag/overshoot/settling, the overshoot cap, long stalls, switchability,
`followAmount`, snapshots, export and diagnostics.
