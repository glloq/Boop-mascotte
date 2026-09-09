# Hands: 2D drawings, chosen

```text
        drawing              side          transform            animation
   which picture it is    whose hand      where it goes     what that picture does
   ┌──────────────────┐ ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐
   │  Side, open      │ │    left    │  │  x  y        │  │  0 ─────────────► 1 │
   │  Palm, open      │ │    right   │  │  rotation    │  │  rest      closed   │
   │  Front fist      │ └────────────┘  │  scale       │  └─────────────────────┘
   └──────────────────┘                 │  visible     │
                                        └──────────────┘
```

Boop's hands float, Rayman-style: no arms, no elbows, no wrists, no skeleton
and no IK (`docs/HAND_RIGGING.md`). What changed is how one is **drawn**.

A hand used to turn by morphing six paths between three view tables on a
continuous axis, which meant that everywhere between two drawings was a hand
nobody had drawn — and a hand that moved while it turned wobbled through all of
them. A first refit replaced that with a grid of *poses times views*, and an
angle that chose a cell of the grid. That was still a machine for deriving a
picture from a number.

**A hand is now one of a handful of whole pictures, and you say which.** There
is no angle, no view, no facing axis, no threshold and no hysteresis. Each
picture also carries **one animation of its own** — its own little rig, over
its own parts — because "the fist closes" is a thing *that* drawing does, not a
thing the system does to drawings.

What is left to make it feel alive is what always did the work anyway:

```text
translation + rotation + scale + a change of drawing + that drawing's own animation
```

and none of it morphs one picture into another.

## The model

Appearance and transformation are two records, on purpose. Moving a hand never
touches its drawing; changing its drawing never moves it.

```js
{
  side: 'left',           // whose hand
  drawing: 'palmOpen',    // ─┐ appearance: which picture, and how far
  anim: 0,                // ─┘ its own animation has played

  x: 0, y: 0,             // ─┐ transformation: where that picture goes
  rotation: 0,            //  │
  scale: 1,               //  │
  flipX: false,           //  │
  visible: true           // ─┘
}
```

`normalizeHandState` in `project/runtime/hand-vocabulary.js` is that record.
The transformation half lives on the hand's ordinary parameters — `handLX`,
`handLY`, `handLRotation`, `handLScale` — so everything that already moved a
hand still moves it, and the reach ellipse, the anchor drift and the cartoon
inertia are untouched.

## The drawings

The built-in catalogue is three pictures:

| id | name | what it is | its own animation |
|---|---|---|---|
| `sideOpen` | Side, open | an open hand seen edge-on | Close the fist |
| `palmOpen` | Palm, open | an open hand, palm to the viewer | Close the hand |
| `frontFist` | Front fist | a fist, facing the viewer | Thumb up |

They live in `HAND_DRAWINGS`, and nowhere else — there is no `if (drawing ===
…)` anywhere in the system, so a fourth picture is a row in a list, a recipe in
`HAND_DRAWING_RECIPES`, and nothing more.

A hand's own list is what its parameter indexes, so a mascot that draws two
pictures has a two-position `handLDrawing` and a mascot that brings ten of its
own has a ten-position one. The catalogue is only what the built-in generator
knows how to draw.

**A drawing is a change of picture.** Anything a translation, a turn or a scale
can say is an *animation*, not a picture: a wave is an open palm rotating, so
`wave` resolves to `palmOpen` and the waving is a clip
(`HAND_DRAWING_ALIASES`). Otherwise every gesture anyone ever names costs
another drawing that differs from `palmOpen` in nothing.

## A drawing's own animation

Each picture may carry exactly one, and it is optional.

```text
handLAnim   0 ─────────────────────────► 1
            the picture as drawn         the thing it does
```

It is ordinary **shape keys over that picture's own parts**, driven by the
hand's animation parameter — the same machinery any other shape key uses, and
the runtime plays it the same way. Nothing about it reaches another picture, so
a set can carry one that animates beside one that does not; a picture with no
animation simply ignores the parameter.

This is not the pseudo-3D turn coming back. That morphed a hand between two
*views*, through shapes that were nobody's drawing. This morphs one picture
between two shapes of **the same view**, both of them drawn, which is what a 2D
animator does with a hold and an in-between.

## What is not here

No WebGL, no 3D engine, no finger rig, no IK, no arms, no skeleton, and no
geometric interpolation between two *pictures*. A hand that changes picture
cross-fades opacity for 80 ms and that is all.

There is also no **angle**. Nothing in the system turns a rotation into a
choice of picture, because a hand's rotation is a hand's rotation: turn a hand
and its drawing turns with it, exactly as any other artwork does.

## Rotation is not a drawing

`handLRotation` turns the whole group. It has no effect on which picture is
showing, and picking a picture has no effect on the rotation. A hand upside
down is the same drawing upside down.

## Drawing it

```text
handLeft (g)                        the hand: reach, drift, turn, size
 ├─ handLeftDraw-sideOpen   (g)  ─┐ one picture each,
 ├─ handLeftDraw-palmOpen   (g)   │ one of them visible,
 └─ handLeftDraw-frontFist  (g)  ─┘ all of them still
```

Every picture is a **child of the hand's own group**, so the hand's transform
carries it and a swap is one opacity. What the runtime does per frame is choose
one drawing and write opacities; there is nothing to place, and nothing to
deform.

### One box, one pivot, one size

Every picture in a set is drawn by the same generator at the same scale around
the same point, and the descriptor the rig carries repeats the pivot on each of
them. That is what makes a swap invisible: the hand does not resize, does not
shift, and does not change where it turns. The wrist is in the same place in
every picture and in every animation of one, to within two units.

A picture *is* allowed to be a different shape — a fist is shorter than an open
hand, which is the point of having both.

### Swapping

```text
cut         the new drawing, this frame
crossfade   both for 80 ms, the opacities summing to one      (the default)
hidden      held until the hand is off screen, then instant
```

Deliberately short: a long cross-fade between two hands is a double exposure,
not an animation. `createHandSwap` in `project/runtime/hand-sprite.js` is the
whole of it, and it is deterministic — the same deltas give the same opacities.

## In a mascot

A hand that shows drawings carries them on its rig record:

```js
hands: {
  left: {
    element: 'handLeft',
    sprites: {
      set: 'defaultCartoon',
      showing: 'sideOpen',                 // the picture it rests on
      swap: 'crossfade', swapSeconds: 0.08,
      pivot: [120, 268],
      drawings: [
        { id: 'sideOpen',  name: 'Side, open',  element: 'handLeftDraw-sideOpen',  anim: 'Close the fist' },
        { id: 'palmOpen',  name: 'Palm, open',  element: 'handLeftDraw-palmOpen',  anim: 'Close the hand' },
        { id: 'frontFist', name: 'Front fist',  element: 'handLeftDraw-frontFist', anim: 'Thumb up' }
      ]
    },
    parameters: { …, drawing: 'handLDrawing', anim: 'handLAnim' }
  }
}
```

`sprites` is absent on a hand that has none, so a rig written before the refit
round-trips through `normalizeHand` unchanged and keeps deforming.

### Two parameters, not fifteen

```text
handLDrawing   0 … n-1, a choice; `options` names the pictures
handLAnim      0 … 1,   how far the picture showing has played its own animation
```

`handLDrawing` is discrete and **stepped**: halfway between two pictures is not
a picture, so a clip keyframes it with `step` easing and a reaction strikes it
once it is half in. `handLAnim` is continuous, and eases like anything else.

### What a frame does

For each hand with drawings: read `handLDrawing`, ask the swap what to show,
and write one opacity per picture. That is all. The picture's own animation has
already been played by the ordinary shape-key pass, because it is ordinary
shape keys.

## Converting a hand

Never automatically. A file written before the refit opens exactly as it did,
keeps deforming, and is marked `legacyPseudo3D` so the editor can *offer* the
conversion and say what it will do.

The conversion, in the one order that works:

```text
1  rename what asked for a pose        needs the pose records
2  hide the parts, drop their keys     clears the pose records and the grids
3  drop the parameters nothing names   needs the grids gone
```

The parts are **hidden, not deleted**: a conversion an author can undo by
making them visible again is one they can try.

### The mascot has to go on working

A mascot that waved has a Wave clip, a reaction that plays it and an expression
that brings the hands out. None of them knows about drawings, and none of them
has to:

```text
handLFist = 1     →   handLDrawing = <index of 'frontFist'>
handLSpread = 1   →   handLDrawing = <index of 'palmOpen'>
handLOk = 1       →   (nothing: no picture of it, and no honest stand-in)
```

A pose parameter is a weight and a drawing index is a choice, so the rewrite is
a threshold: raised means chosen. The facing axis goes out with the
deformation — nothing reads an angle any more.

An author's own binding on `handLFist` is a use like any other: the parameter
stays if anything still names it.

## In the editor

The Hands card shows the pictures a hand has, as pictures — a name says which
drawing you asked for, only the drawing says which one you got. Under them, the
picture showing beside what it does, and the slider that plays it.

## Picking a hand on the canvas

```text
        ┌ the face ┐
   ▣    │          │        ▣  the drawings, beside the face, on the hand's
   ▣    └──────────┘        ▣  own side
   ▣  ▲    ╭─────╮      ▲   ▣
      │ ╭──┤ ✋  ├──╮   │      the slider that brings it out, as it was
        ╰─────────────╯
            ▬▬▬▬▬            the turn, as it was
            ▬▬▬▬▬            and this picture's own animation
```

One column a side, one cell per picture, every cell holding the drawing it
selects. A press writes one parameter through the same channel every other
canvas control uses, so picking a hand keys with Auto Key on and lands in an
expression while one is being shaped.

### Every hand is one press away

The column offers **every** picture the generator can draw, not only the ones
this set already has. A picture the hand has is a choice; one it has not is an
offer, and pressing it draws the picture and shows it, in one undo step.

A hand still resting behind the head has no picker — a column of pictures
beside a hand nobody can see is clutter around nothing — and the slider that
brings it out is ungated, exactly as before.

## Hand sets

A set on disk is a directory of standalone SVGs plus a manifest:

```text
project/assets/hands/defaultCartoon/
  manifest.json
  left/{sideOpen,palmOpen,frontFist}.svg          the pictures
  left/{sideOpen,palmOpen,frontFist}-anim.svg     what each of them does
  right/…
  sheets/hands.svg                                all of it, side by side
```

`npm run hands:sprites` writes it. Every file shares one box (`0 0 200 200`),
one pivot (`100 100`) and one scale, and nothing in a file is specific to a
mascot — no document ids, no rig transforms, no offsets baked in to correct for
one. That is what makes the directory the shape a **custom** set takes too.

The set the editor installs is drawn from the same functions, straight into the
mascot's own SVG. These files are the library, the reference and the visual
snapshot; they are not fetched at runtime.

## What the template ships

Both hands, three pictures each, every one with its own animation — twenty-one
nodes a side, fewer than the five views of a single pose the angle system
needed. The whole catalogue, so the picker beside the face has something to
pick from the moment a mascot is drawn.

## In the exported file

`hand-vocabulary.js` and `hand-sprite.js` are in the runtime bundle, ahead of
`hands.js`. A page gets one concatenated module; a hand that shows drawings
works there exactly as it does in the editor's preview.

## What did not change

The reach ellipse, the soft limit, the anchor drift, the cartoon inertia, the
depth bands and their hysteresis, the reveal from behind the head, the holds
that put a palm on the chin, the Wave clip, `mascot.showHands()`. A hand is
still a floating hand. Only the way it is drawn is different.
