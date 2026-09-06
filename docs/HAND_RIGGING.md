# Hand rigging

```text
BODY
 │
 ├─ leftHandAnchor
 │       └─ LEFT HAND  (g)
 │            ├─ palm · ring · middle · index · thumb · cuff
 │            └─ shape keys per part, a pose grid for the facing
 │
 └─ rightHandAnchor
         └─ RIGHT HAND (g)
```

Boop's hands are **floating artwork**, Rayman-style. There are no arms, no
skeleton and no IK. A hand hangs off an anchor point on the body: the anchor
follows whatever the body does, and the hand keeps its own local animation on
top of that.

That is the roadmap's decision rule in practice — an anchor plus XY, rotation
and a spring gets 80–90 % of the reaching-hand result for a fraction of a
skeleton's machinery.

Implementation: `project/runtime/hands.js`, `project/runtime/inertia.js`,
authoring in `project/editor/core/hands/hand-model.js`, the generated hand in
`project/editor/core/sample/hand-artwork.js`, `hand-feature.js` and
`hand-set.js`. How the hand came to be made of parts is
`docs/HAND_REPRESENTATIONS_STUDY.md`.

## The record

```js
hands: {
  left: {
    side: 'left',
    element: 'handLeft',        // artwork: one element, a group when generated
    parent: 'body',             // what the anchor follows
    anchor: { x: -20, y: 40 },  // in the parent's own coordinates
    restOffset: { x: 0, y: 0 },
    reach: { x: 40, y: 30, rotation: 30, scale: 0.2 },
    softness: 0.25,
    depth: 0,
    parameters: { x: 'handLX', y: 'handLY', rotation: 'handLRotation',
                  scale: 'handLScale', depth: 'handLDepth' },
    poses: [{ id: 'fist', name: 'Fist', parameter: 'handLFist',
              shapeKey: null, variant: null, table: { … } }],
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

A pose is a **parameter** — `handLFist`, `handRWave`, named by one rule
(`handPoseParameterName(side, poseId)`) that the panel, the commands and the
reactions share. Raising it moves the hand in one of three ways, and the system
never forces a full set:

**A — Shape keys** (what a generated hand uses)

```text
part + Σ (pose delta × weight)
```

The parameter drives a key on every part the pose moves — the way the finger
curls always did — and the pose record carries no key of its own.
`handPoseDrive(document, pose, side)` answers what a pose moves: its own key or
artwork, or a key, a pose grid or a binding driven by its parameter. The pose
chips and the `hands` validator both read that answer, so a pose that moves
nothing is the only one reported as doing nothing.

**B — Drawings** (a set of drawings, the cut-out way)

```text
Hand
 ├─ neutral artwork          fades out by exactly as much as…
 ├─ handLeftSetFist   (g)    …the drawing the pose raises fades in
 └─ handLeftSetPoint  (g)
```

The pose names another piece of artwork (`variant`). The drawing takes the
hand's own reach, anchor drift, turn and size around the hand's pivot, and its
place in the draw order; several drawings raised at once **share** the one hand
(their weights are rescaled to sum to one) rather than piling up past it. See
"Sets of drawings" below.

**C — A key on the record** (`shapeKey`), the original form, still honoured:
its weight is added to the hand element's shape weights.

## Mirroring

```js
mirrorHand(hands, 'left', { mirrorX: 100, element: 'handRight',
                            shapeKeys: { 'handLeft-wave': 'handRight-wave' } })
```

Anchors and rest offsets mirror around the artboard centre line, the rotation
range flips sign so a "wave outwards" stays outwards, and poses carry over under
the other side's parameter names with their tables. Shape keys and variants are
only carried when a mapping is supplied, because the mirrored hand usually has
its own artwork. A generated pair draws both sides itself.

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

## Drawing a pair

Setup used to open with *"Choose the artwork that draws this hand"*, and the
editor had no way to make that artwork. **Draw a pair of hands** (Face Setup →
Hands, and the Artwork feature list) generates them, as the classic
four-fingered cartoon glove — a skin look is one select away — and rigs both
sides in one undo step.

### A hand is six parts

```text
handLeft  (g)                  paint order, back → front
 ├─ handLeftPalm     M C×9 Z  + M C C     the palm, and the heel of the thumb
 ├─ handLeftRing     M C×10   + M C C  ─┐ bezier tubes with a round tip, open
 ├─ handLeftMiddle   M C×10   + M C C   │ at the base so the root melts into
 ├─ handLeftIndex    M C×10   + M C C   │ the palm; the second sub-path is the
 ├─ handLeftThumb    M C×10   + M C C  ─┘ fold across a bent knuckle
 └─ handLeftCuff     M L C L C L C L C Z  the band at the wrist
```

The `hands` record names the **group**, so reach, anchor drift, rotation and
scale land there and the parts ride inside; `HAND_REST_TILT` (180° ± 20, fingers
down, thumbs towards the middle) and the mascot-relative size go on the group
too. Every part keeps a `restPath`, and every curve is a Catmull-Rom spline
through a **fixed number of points**: a pose can move the points anywhere and
the command list never changes, which is what a shape key needs. The fold
across a knuckle and the heel of the thumb are second sub-paths of the part
they belong to, folded onto its own outline until the pose draws them out — so
they are part of the pose, with no opacity to wire.

The hand used to be one outline, and that outline could draw neither a side
view nor a finger separation nor an OK sign: every digit was visited once, left
to right, so nothing could overlap and no line could sit inside the silhouette.
`docs/HAND_REPRESENTATIONS_STUDY.md` measures that limit; `scripts/hand-figures.mjs`
(`npm run figures:hands`) draws its figures from the shipped tables.

### Where a finger meets the palm

A digit is a tube open at its base, so its fill hides the palm's outline where
the finger grows out of it. Its two edges have to end somewhere, though, and
a stroke that ends on the palm's fill shows its round cap as a stub — the
"dirty finger base". So `digitTube` lands each edge **on the palm's outline**:
the palm hands out its outline as a polyline (`palmOutline`, sampled off the
same spline it is drawn with) and each edge is slid along its own direction to
the nearest crossing, then pulled `BASE_INSET` inside it, where the cap hides
under the palm's own line and the tube's fill still covers the outline's inner
half. That holds for every pose, because the crossing is found against the
palm *of that pose*: a fist's lowered knuckle line, a profile's narrow palm, a
thumb barring a fist. The base flares a touch (`BASE_FLARE`) so two neighbours
meet the palm in a rounded valley — not on a folded finger, whose short tube
would kink. What is left is a cap a fraction of a unit tall where a finger's
edge is not covered by its neighbour, which reads as the line thickening at a
junction, the way an inked line does.

### Views, poses and tables

A **view** is a full table of numbers — `HAND_VIEWS.front`, the palm towards the
viewer; `HAND_VIEWS.profile`, a profile with the thumb towards the viewer;
`HAND_VIEWS.far`, the same profile turned over with the thumb tucked away,
built point for point in the **same traversal** as the near profile rather than
mirrored, so the turn towards it is a morph like any other and never passes
through a line — and a **pose** is a sparse override of one:

```text
digit   { base, angle, length, width, curl, bend }
          curl 0…1   shortens the tube and swells the knuckle — a finger folded
                     away from the viewer, which is what a fist shows; the fold
                     line appears past 0.45 and sits higher on a folded finger.
                     In a profile a curl is a hook instead (`hook`, per view)
          bend  °    in-plane curvature — the ring of an OK, a thumb hooked
                     over a fist
palm    { hw, top, bottom, arch, cx }     the blob; hw ≈ 10 is a profile
order   [ … ]                             paint order, back → front
heel    0 | 1                             the heel of the thumb, palm view only
```

`handParts(side, { view, pose, at, box })` draws every part from a table;
`aimDigit(digit, target)` searches the angle and bend that put a fingertip on
another, which is how OK and Pinch close.

A generated pair ships nine poses — Fist, Point, Peace, Thumbs Up, Spread,
Relax, OK, Pinch, Stop — **one curl parameter per digit** (`handLThumb`,
`handLIndex`, `handLMiddle`, `handLRing`) and a **grip** (`handLGrip`) that closes
every finger at once. Shape keys add, so a fist and one straightened finger
compose rather than fight. Each pose record keeps its `table`, so the pose
editor can reopen it.

### Facing: palm, side, far side

```text
handLFacing   -1            0            1
              far side     palm         side
          (thumb away)                (thumb near)
```

One parameter turns the hand, stored as ordinary pose grids the way the head
turns (`docs/HEAD_POSE_2_5D.md`): a `pathShape` keyform per part weights that
part's *view* key at each stop, so palm → side is a continuous morph of six
parts and never the collapse a mirror key passed through. A pose with a drawing
of its own in profile — a fist, a pointing finger, a thumbs up, the grip, the
curls — carries a key per part per stop, gated by a `pose × facing` grid, so the
fist seen from the side is the profile fist and not the palm fist's deltas laid
over a profile. The other poses keep one driven key per part, applied whatever
the facing.

On the far side the thumb is behind the palm: a `depth` keyform puts it in the
`behind` band, and the canvas repaints it behind the palm exactly as the
exported runtime does (`docs/DEPTH_PARALLAX.md`); an opacity grid fades it out
early in the turn as well — the fallback for a rig that keeps its stacking
(`parallax.drawOrder: false`) — unless the thumb is up, the one pose that shows
it from behind.

Hand Setup shows the stops as a **View** row beside the pose chips; the hand's
group of controls has a facing handle; the catalogue reads `Facing` as *Palm or
side*. The former `handLFlip` (a mirror key) is no longer generated and stays
on the projects that have one.

### Pose editor

Hand Setup → *Pose editor* (a generated hand only): pick a pose or start a new
one, choose a digit or the palm, move its sliders — curl, bend, angle, length,
width; the palm's width and heel — and watch a preview drawn from the same
generator. **Touch the thumb** aims the digit's tip at the thumb's. **Capture**
writes a key on every part the pose moves, its parameter and its record, in one
command and one undo step, then strikes it on the mascot; capturing again
replaces what the earlier capture wrote, so a part the new table leaves alone
loses its key rather than keeping a stale one. Edit the *side view* and the pose
gains a profile drawing of its own. **Remove pose** takes the keys and grids
with it, so creating and removing a pose live on one surface.

`capturePoseKeys(state, side, { id, name, table, profileTable })` is the model;
`createHandCommands().capturePose` and `.dropPose` are the commands.

### Sets of drawings

Hand Setup → Advanced → **Use a set of drawings** gives a hand whose artwork the
generator did not draw — an imported blob, a part standing in for a hand —
every gesture of the built-in set as a whole drawing, placed where the hand is
and no bigger than it, each a pose the hand swaps to (method B). **Import
drawings…** takes an SVG for any hand: its top-level drawings are measured by
the browser, wrapped so they are centred on the hand and no bigger than it, and
named after the pose their id or name points at — `fist` stays `fist`, twins are
numbered, a drawing with no size is skipped. Appended first, rigged as one
command over it, one undo step, exactly as a pair of hands is
(`core/sample/hand-set.js`).

### Behind the head

A pair drawn by **Draw a pair of hands** rests **behind the head** and comes out
only when something asks for it: a reaction, the Wave, or the page calling
`mascot.showHands()`. Nothing about the hand changes for that — its anchor,
reach and poses are measured at the rest place, as ever — it is one more
parameter and three ordinary keyforms:

```text
handLShow   0 ──────────── 0.7 ────── 1
            tucked behind the head    out, at the rest place
translate   hidden − rest             0        `handLeft-show-x`, `-y`
depth       −1        −1  ──────────  0        `handLeft-show-depth`
```

`handHiddenPoint` picks the hiding place from the measured body — the lower
half of the head, a little towards the hand's own side, so the whole glove is
inside the silhouette that hides it — and the depth stays at `−1` until the
hand is nearly clear of the head, so the band flips (`docs/DEPTH_PARALLAX.md`)
where nothing overlaps. `evaluateHands` adds the artwork's depth to the hand's
own, which is what lets a keyform on the group sink the hand; the canvas
paints the same order as the exported mascot.

Three things raise the parameter:

* the **"Hands out" expression** (`hands-out`, both show parameters at 1),
  written with the pair — a reaction picks it like any expression, the
  Expressions panel lists it, and `mascot.setExpression('hands-out')` is what
  `mascot.showHands()` does when the rig has it (`{ duration, easing }` ramp
  it; `{ side }` limits a rig without the expression to one hand);
* the **Wave** clip, whose `handLShow` track brings the hand out at the start
  and sends it back at the end, so a reaction that plays the Wave needs
  nothing else;
* **Hand Setup** itself: a hand that rests behind the head comes out while it
  is posed there — a pose chip, a View chip, a finger slider, a capture, or
  opening the card raises its show parameter with the pose — so the author
  sees the gesture and not the back of a head.

The tick **Rests behind the head, out on request** is on every hand's card;
untick it and the parameter, the keyforms and the hand's share of the
expression go, and the hand rests in the open as before (one undo step). A
hand of the author's own artwork can be tucked the same way: the hiding place
is measured from the body it hangs from. `installHands(state, { hidden: false })`
draws a pair that rests in the open.

### Which way a hand hangs, and where

The parts are drawn with the fingers up and the wrist below, which is the one
orientation a hand beside a mascot never has. Half a turn fixes both at once:
fingers down, and the thumb carried across to the inner edge — thumbs towards
the middle, which is what makes a pair read as a pair rather than as two left
hands. `HAND_REST_TILT` is 180° ± 20 so they fan outwards instead of hanging
parallel like a doll's, and it is an ordinary `baseTransform.rotation` on the
group, so the reach adds to it and the shape keys still measure against the
untilted parts.

**Adding hands adds room — measured from the mascot (VNX-20), not from the
artboard.** A face drawn to fill its artboard leaves nowhere below it, so the
pair landed across the chin. `handsArtboard` grows the artboard by exactly the
room the pair needs in the same undo step, the hands hang in the new band, the
reach is a share of the mascot's own size with a **full half-turn** of rotation,
and the hand is the mascot's size rather than the artboard's. A generated hand
is grabbed by its **cuff** on the canvas, so the anchor at the middle of its
palm stays free for hand mode.

## Setup workflow

```text
Select artwork → Place anchor → Place neutral hand → Adjust reach
→ Create poses → Test
```

`project/editor/rig-editor/hands/hand-setup-panel.js` walks exactly those steps
and always says **what to do next**, not only what is wrong:

> Choose the artwork that draws this hand.
> Choose the body part the hand hangs from.
> Place the anchor point on the body.
> Add a pose, such as Wave — optional, but it is what makes a hand act. A drawn
> pair rests behind the head: a reaction, the Wave or `mascot.showHands()`
> brings it out ("Behind the head" above).
> Ready. Test it from Preview.

Assigning a hand creates the parameters it needs in the same undo step: a hand
that exists but cannot be moved would be a trap. Mirroring does the same for
the other side, poses included. Selecting any part of a generated hand on the
canvas opens hand mode for that hand.

## Diagnostics

Missing artwork, an anchor pointing at a deleted body part, a reach of zero, a
pose that moves nothing, a pose whose shape key or artwork is gone, a movement
parameter that no longer exists, and inertia settings that would never settle —
all reported in the author's language, in the `hands` validation domain.

## Tests

`hands.test.js` covers assignment per side, independence of the two hands, body
movement moving the anchors while local movement survives, anchors following
rotation and scale, rotation and scale ranges, reach mapping, soft limits and
the diagonal case, the three pose methods, a drawing following the hand and
several sharing it, pose transitions with no jump, mirroring, spring
lag/overshoot/settling, the overshoot cap, long stalls, switchability,
`followAmount`, snapshots, export and diagnostics. `hand-feature.test.js` covers
the six parts and their fixed layouts, the fold, the installed pair, driven
poses and curls, the facing axis; `hand-set.test.js` the built-in and imported
sets; `hand-setup-panel.test.js` the panel, the pose editor and the drawings
offer; `hand-placement.test.js`, `hand-mode.test.js` and `hand-handles.test.js`
the placement, hand mode and the handles. `tests/e2e/ux32-hands.spec.js` draws
the pair in a browser and works it.
