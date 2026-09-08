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
