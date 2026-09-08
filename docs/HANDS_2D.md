# Hands: 2D drawings, chosen

```text
        pose            view              side          transform
     what it does   which drawing      whose hand      where it is
   ┌────────────┐ ┌──────────────┐  ┌────────────┐  ┌──────────────┐
   │  relaxed   │ │   sideLeft   │  │    left    │  │  x  y        │
   │  open      │ │   3/4 left   │  │    right   │  │  rotation    │
   │  fist      │ │   front      │  └────────────┘  │  scale       │
   │  point     │ │   3/4 right  │                  │  flipX       │
   │  grab      │ │   sideRight  │   face: palm     │  visible     │
   │  thumbsUp  │ └──────────────┘         · back   └──────────────┘
   │  peace     │
   └────────────┘
```

Boop's hands float, Rayman-style: no arms, no elbows, no wrists, no skeleton
and no IK (`docs/HAND_RIGGING.md`). What changed is how one is **drawn**.

A hand used to turn by morphing six paths between three view tables on a
continuous axis, which meant that everywhere between two drawings was a hand
nobody had drawn — and a hand that moved while it turned wobbled through all of
them. Here a hand is a **static drawing chosen by pose and view**. It never
passes through a shape that was not designed, so it cannot wobble; and choosing
is cheaper than deforming, so it cannot cost more.

What is left to make it feel alive is what always did the work anyway:

```text
translation + rotation + scale + a change of view + a change of pose
```

and none of it deforms anything.

## The model

Appearance and transformation are two records, on purpose. Moving a hand never
touches its drawing; changing its drawing never moves it.

```js
{
  id: 'leftHand',
  side: 'left',        // whose hand

  pose: 'relaxed',     // ─┐ appearance: which drawing
  view: 'front',       //  │
  face: 'palm',        // ─┘

  x: 0, y: 0,          // ─┐ transformation: where that drawing goes
  rotation: 0,         //  │
  scale: 1,            //  │
  flipX: false,        //  │
  visible: true        // ─┘
}
```

`normalizeHandState` in `project/runtime/hand-vocabulary.js` is that record;
`normalizeHandAppearance` is its first half on its own. The transformation half
lives on the hand's ordinary parameters — `handLX`, `handLY`, `handLRotation`,
`handLScale` — so everything that already moved a hand still moves it, and the
reach ellipse, the anchor drift and the cartoon inertia are untouched.

## Pose

The shape of the hand, from one list:

```text
relaxed   open   fist   point   grab   thumbsUp   peace
```

`relaxed` is the default and the fallback. Poses are added to `HAND_POSES` and
nowhere else — there is no `if (pose === …)` anywhere in the system, so a new
pose is a row in a list and a drawing.

**A pose is a change of shape.** Anything a translation, a turn or a scale can
say is an *animation*, not a pose: a wave is an open hand rotating, so `wave`
resolves to `open` and the waving is a clip (`HAND_POSE_ALIASES`). Otherwise
every gesture anyone ever names costs five more drawings that differ from
`open` in nothing.

Poses also say whether they may be **mirrored**. A fist reads the same either
way round; a pointing finger, a thumbs up and a peace sign do not — flip one
and the thumb is on the wrong side of the hand, which is the single thing a
viewer notices. So `point`, `thumbsUp` and `peace` are drawn for both sides or
fall back to the front, never mirrored.

## View

Which drawing of that pose, from five:

```text
  sideLeft    threeQuarterLeft    front    threeQuarterRight    sideRight
    −90°           −45°            0°           +45°              +90°
```

**The angles are labels, not rotations.** They say which turn each drawing
stands for, so an orientation the rig already has can pick one; nothing is ever
rotated by them. These are five separate drawings, not one drawing at five
angles — that is the whole difference from the system this replaces.

Flipping a drawing horizontally maps the row onto itself: the two sides swap,
the two three-quarters swap, the front stays put. One rule covers both kinds of
symmetry at once, because flipping a *left* hand's three-quarter-left drawing
gives a *right* hand's three-quarter-right.

## Face

Palm towards the viewer, or the back of the hand.

This is not a sixth view. A view says how far round the hand has turned; the
face says which of its two sides that drawing shows, and the two are
independent — a three-quarter view exists palm-out and back-out. Keeping them
apart is what stops the list growing ten names long
(`threeQuarterRightBack`…). A hand set that draws only palms costs nothing for
having the parameter: the resolver falls back to the palm drawing.

## What is not here

No WebGL. No 3D engine. No finger rig, no IK, no arms, no skeleton. No
geometric interpolation between two drawings: two hands are two pictures, and
the only thing ever blended between them is opacity.

## Finding the drawing

```text
resolveHandAsset({ side, pose, view, face })  ─→  one drawing, or the nearest thing to it
```

One function, in `project/runtime/hand-assets.js`, and every question of *what
is on screen* comes through it. A hand set can then be swapped, extended or
shipped half-drawn without anything else knowing.

A **hand set** is a list of drawings and the convention they share:

```js
createHandAssetLibrary([
  { pose: 'open', view: 'front', face: 'palm', side: null,
    element: 'handLeftSprite-open-front',        // in the mascot's own SVG
    src: 'hands/defaultCartoon/open/front.svg',  // or on disk
    pivot: [100, 100], mirrorable: true, defaultScale: 1 }
], { set: 'defaultCartoon', pivot: [100, 100], viewBox: '0 0 200 200' })
```

`side: null` is a drawing that serves either hand as it stands. `pivot` is
where it turns, in its own coordinates, and every drawing in a set shares it,
so a swap never moves the hand (PHASE 21).

### It never fails

```text
pose + view + face                     exact
pose + view + the other face           face
mirror of pose + view, flipped         mirror     ← symmetric poses only
pose + front                           view
pose + the nearest view it is drawn in nearest
relaxed + …                            pose       ← the same ladder again
                                       missing    ← only an empty set
```

A set that draws nothing but `relaxed/front` still animates. What rung the
answer came from is reported (`fallback`), so the editor can say *why* a hand
is showing what it is, and a substitution is a warning in development and a
silent fallback in a published mascot (PHASE 49):

```text
Missing hand asset:
pose=point
view=sideRight
side=left
```

The ladder is walked once per distinct request and the answer remembered
(`createHandAssetCache`), so a hand asking the same question sixty times a
second costs one lookup. `handAssetsToPreload` names what to have ready: the
drawing shown, the views either side of it — the ones a turning hand reaches
next — and the set's own fallback. Not the whole library: eight poses in five
views is forty drawings, and a mascot that only waves needs three.

## Picking a view automatically

```text
 −90°        −67.5°      −22.5°       +22.5°      +67.5°       +90°
  ├── sideLeft ──┼── 3/4 left ──┼── front ──┼── 3/4 right ──┼── sideRight ──┤
```

A rig that already knows which way a hand is turned hands that number over and
gets a drawing back. The thresholds are configurable; every band is half-open,
so an angle exactly on one belongs to the view above it, the same rule at both
ends of the row.

**Hysteresis is the point of the module.** Bare thresholds turn a hand hovering
on a boundary into a strobe — front, 3/4, front, 3/4, once a frame — so leaving
a view costs six degrees more than entering it did. The current view keeps its
band widened on both sides; an angle outside the widened band is classified
afresh, which means the memory can hold a decision back but never drag one
along: a hand that jumps three views in one frame still lands on the right
drawing.

Automatic is never compulsory (PHASE 18). In `manual` mode the chosen view is
simply kept and none of this runs.

### Rotation is not view

`hand.rotation` and `hand.view` stay two parameters. A hand drawn front-on and
turned 15° is still a hand drawn front-on; coupling them would make every small
animated tilt a sprite swap, which is the pop the refit exists to remove.

Each view does carry a `preferredRotation` — how far that drawing may be turned
before it stops reading as a hand: ±180° for the front, ±110° for a three
quarter, ±70° for a side. It is **advice, not a clamp** (PHASE 20). An author
who wants a hand upside down gets one; what the animation system gets is a way
to know.

## Drawing it

`createHandSprite` is the seam between "what this hand is doing" and "what is
on screen" (PHASE 10). It selects a drawing and places it — translate, rotate,
scale, flip, show or hide. It does not deform one: no skew, no perspective, no
squash, no finger morph, and no geometric interpolation between two drawings.

A change of drawing is a **swap**:

* `cut` — the new drawing, this frame.
* `crossfade` — both for 80 ms, the old fading out by exactly as much as the
  new fades in. Deliberately short: a long cross-fade between two hands is a
  double exposure, not an animation.
* `hidden` — held until the hand is invisible or off the artboard, then taken
  instantly. A floating hand leaves the frame all the time (PHASE 14), and a
  swap nobody saw is the cleanest swap there is.

Two hands are two sprites with two caches and two selectors, so neither can
reach the other (PHASE 13).

## The drawings

They come from the glove generator the project already had
(`core/sample/hand-artwork.js`) — the same six parts, the same line, the same
palm — but each is drawn **once, statically**, at the pose and view it is for.
Nothing deforms them afterwards. So the look is the one the mascot always
shipped, and the wobble it used to have on the way between two views is gone,
because there is no longer a way between two views.

Five drawings need five tables. `front`, `profile` (the thumb towards the
viewer) and `far` (the thumb away) were already there; `threeQuarter` and
`threeQuarterFar` are new, and are tables of their own rather than a blend of
the two either side — halfway between two drawings is exactly where the old
turn lived, and the point of drawing this one is that nothing has to go there.

A view names which way a drawing reads **on screen**, and the right hand is
drawn by mirroring, so:

```text
right hand at view V  =  the left hand's drawing of mirror(V), flipped
```

One rule, written down once (`handSpriteTable`). It is why a pair reads as a
pair at the front, and why two hands turning the same way show different things
at three quarters — they are mirror-image objects, so a turn that brings the
left hand's thumb round takes the right hand's away.

### A pose across views

A pose is authored for the palm view: `THUMB_ACROSS` sits at x −16 because that
is where the edge of a *front* palm is. Those numbers are wrong on a narrow
edge-on palm, and wrong in a way that shows — a thumb placed off the side of it
reads as a lobe crossing the fingers. So a pose travels between views only as
far as it is a change of **shape** rather than of **place**:

```text
palm-side view (front, 3/4 towards the palm)   the pose's own table, whole
any other view, and the pose has a profile     the profile table
any other view, and it has not                 the pose, as curl and bend only
```

A curl and a bend are things a finger *does*, and mean the same on every
drawing; a base, an angle, a length and a width are things a finger *is*,
measured on the drawing they were authored for. That is why an open hand in
profile stays an open hand, and why a pose does not have to be drawn five times
to be usable in five views (PHASE 28).

How much of a fold a view sees as a bend rather than as a shortening comes from
its own `hook`: edge-on, a curl is nearly all bend; at three quarters it is
half of each, because that is what a finger folding at 45° to the viewer does.

### One box, one pivot, one size

```text
viewBox   0 0 200 200      the same for every drawing in a set
pivot     100, 100         the middle of the palm — where the hand turns
scale     2                the glove's own radius is a little over 42
```

Every drawing in a set is the same generator at the same scale around the same
point, so a swap cannot resize or shift the hand (PHASES 21–23). There is no
wrist and no arm to hang a hand from, so the pivot is a **convention**, not an
anatomical joint: the middle of the palm, on every drawing, always. Corrections
belong in the drawings, never as offsets in the engine.

`npm run hands:sprites` writes the set out:

```text
project/assets/hands/defaultCartoon/
  manifest.json                             a hand set, ready for createHandAssetLibrary
  left/relaxed/{sideLeft,…,sideRight}.svg
  right/relaxed/…
  sheets/relaxed.svg                        every view side by side, with the pivot marked
```

Nothing in a file is specific to a mascot — no document ids, no rig transforms,
no offsets baked in to correct for one — which is what makes the directory the
shape a **custom** hand set takes too (PHASE 38). The set the editor installs
is drawn from the same functions, straight into the mascot's own SVG; these
files are the library, the reference and the visual snapshot.

The shipped set is `relaxed` in five views for both hands (PHASE 25). One pose
proves the architecture — the swap, the pivot, the sizes, the automatic view —
and five drawings is a set an author can check in one glance. The generator
draws `open`, `fist`, `point`, `grab`, `thumbsUp` and `peace` as well, and they
arrive pose by pose, which the resolver's ladder is built to allow.

## In a mascot

A hand's set lives on the hand's record:

```js
hands: {
  left: {
    element: 'handLeft',              // the group, as it always was
    anchor: …, reach: …, inertia: …,  // unchanged
    sprites: {
      set: 'defaultCartoon',
      pose: 'relaxed', view: 'front', face: 'palm',
      viewMode: 'manual',             // or 'auto', from the orientation
      swap: 'crossfade',
      thresholds: [-67.5, -22.5, 22.5, 67.5], hysteresis: 6, sweep: 90,
      drawings: [{ pose, view, face, side, element, pivot, mirrorable }]
    }
  }
}
```

`sprites: null` — which is every hand of a project written before the refit —
means the hand deforms as it always did. Nothing in the 2D path runs for it.

Three parameters come with a set, and only with a set:

| Parameter | What it does |
| --- | --- |
| `handLPose` | which pose, as an index into the poses the set draws |
| `handLView` | which view, as an index into the row — manual mode |
| `handLFacing` | which way the hand is turned — automatic mode |

`handLFacing` is the name the pseudo-3D turn used. Reusing it is the migration:
a project that already turned its hand keeps the number it turned it with, and
gets a drawing chosen where it used to get a morph.

Everything that moved a hand still moves it, untouched — `handLX`, `handLY`,
`handLRotation`, `handLScale`, `handLDepth`, `handLShow`, the reach ellipse, the
anchor drift, the cartoon inertia, the depth bands. That is the point of
separating transformation from appearance: the refit did not have to touch any
of it.

### What a frame does

The drawings are **children of the hand group**, so the hand's own transform —
reach, drift, turn, size — carries them already. What the runtime does per
frame is choose one and write opacities:

```text
frame[handLeft]                       transform, depth, band   ← unchanged
frame[handLeftDraw-relaxed-front]     opacity 1
frame[handLeftDraw-relaxed-sideLeft]  opacity 0
…
```

No path is recomputed, no shape key is weighted, no morph is evaluated. A
change of pose or view costs one comparison and two opacities (PHASE 46).

A drawing reached as a **mirror** of another is drawn turned over, around the
pivot every drawing in the set shares. A set installed into a mascot stamps
each drawing with the hand's own side, so a left hand can never flip its own
drawings — a left glove turned over is a right glove. Only a drawing that
declares `side: null`, one generic hand serving either, is flipped in place.

### Poses in an old project

A migrated hand has no `handLPose` at first; it has one `handLFist`-shaped
parameter per pose, which is how poses always worked. So when there is no pose
parameter the **most raised** of those is read instead, and a project that was
showing a fist goes on showing a fist — as a drawing now, rather than as a
deformation. A `handLPose` of its own always wins over the bridge.
