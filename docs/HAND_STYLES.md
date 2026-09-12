# Hands: static drawings, chosen

```text
        style                side          transform
  which drawing it is     whose hand      where it goes
   ┌──────────────┐      ┌──────────┐    ┌──────────────┐
   │  Relaxed     │      │   left   │    │  x  y        │
   │  Open        │      │   right  │    │  rotation    │
   │  Fist        │      └──────────┘    │  scale       │
   │  Point       │                      │  visible     │
   │  Thumbs up   │                      └──────────────┘
   │  Peace       │
   │  OK          │
   │  Closed side │
   └──────────────┘
```

Boop's hands float, Rayman-style: **no arms, no elbows, no wrists, no skeleton,
no IK** (`docs/HAND_RIGGING.md`). What this file is about is how one is
**drawn**.

A hand is one of a handful of whole pictures, and you say which. There is no
angle, no view, no facing axis, no threshold, no hysteresis, no perspective and
no morphing. Nothing inside a drawing ever moves — not a finger, not the palm,
not the thumb — because a drawing has no parts anything can address.

Everything that makes a hand feel alive is a transformation of the **whole**
drawing:

```text
translation + rotation + scale + visibility + a change of drawing
```

and none of it deforms one, or blends one into another.

## The model

Appearance and transformation are separate on purpose. Moving a hand never
touches its drawing; changing its drawing never moves it.

```js
{
  side: 'left',        // whose hand
  style: 'relaxed',    // appearance: which drawing, and nothing else

  x: 0, y: 0,          // ─┐ transformation: where that drawing goes
  rotation: 0,         //  │
  scale: 1,            //  │
  flipX: false,        //  │
  visible: true        // ─┘
}
```

`normalizeHandState` in `project/runtime/hand-vocabulary.js` is that record —
seven fields, and a test that holds it to seven. The transformation half lives
on the hand's ordinary parameters — `handLX`, `handLY`, `handLRotation`,
`handLScale` — so everything that already moved a hand still moves it, and the
reach ellipse, the anchor drift and the cartoon inertia are untouched.

## The library

Eight drawings, and that is the whole set:

| id | label | what it is |
|---|---|---|
| `relaxed` | Relaxed | four short fingers, barely fanned, thumb hanging — a hand at rest |
| `open` | Open | four long fingers fanned wide, thumb out — a wave, a stop, a hello |
| `fist` | Fist | four knuckles over the top, thumb up the side — a hold, a grab, a knock |
| `point` | Point | one finger out, three folded — look, there |
| `thumbsUp` | Thumbs up | a closed hand with the thumb up its own side |
| `peace` | Peace | two fingers in a V, two folded |
| `ok` | OK | thumb and index in a ring, three fingers up — good, exactly, fine |
| `sideFist` | Closed side | a closed hand seen side on, no fingers showing |

They live in `HAND_STYLES` in `project/runtime/hand-vocabulary.js`, and nowhere
else — there is no `if (style === …)` anywhere in the system, so a ninth
drawing is a row in that registry and a table of numbers beside it. **Five to
ten** is the range worth having; eight good drawings beat twelve redundant
ones.

The registry says only what a style is:

```js
relaxed: { id: 'relaxed', label: 'Relaxed', asset: 'relaxed', mirrorable: true }
```

### No wave style

A wave is `open` and a rotation track: −15° → +15° → −15°, with the hand coming
out from behind the head to do it. It is not a drawing. Anything a turn or a
translation can say stays an animation, and the registry does not grow a style
for it. The same goes for `grab` (that is `fist`) and `hello` (that is `open`) —
both are aliases, resolved on the way in.

## Resolving a style

```js
resolveHandStyle('open', 'right')   // { id: 'open', asset: 'open', flipX: true }
resolveHandStyle('palmOpen')        // { id: 'open',  … }  an old name, followed
resolveHandStyle('nonsense')        // { id: 'relaxed', …, fallback: true }
```

A name and a side in, an asset and a flip out. That is the entire logic between
"which hand does this want" and "which file draws it": no angle, no view, no
interpolation.

### Fallback

An unknown style is **never** an error at render time. It falls back to
`relaxed` and says so on the console once per name — once, not once a frame.
`resetHandStyleWarnings()` exists so a test can watch it happen.

## One outline

**A drawing is one layer.** A hand is not a palm, four fingers and a cuff
stacked on each other: the whole silhouette is walked once — up the thumb side,
left to right over the knuckles, down the far side and back along the wrist —
and comes out as a single `<path>`.

```text
  a drawing, in the layer tree          what it is made of
  ────────────────────────────          ───────────────────
  handLeft            (g)               corner   a point on the rim, rounded
   ├─ Relaxed         (path)            digit    a finger or a thumb: up one
   ├─ Open            (path)                     edge, round the tip, down
   ├─ Fist            (path)                     the other
   └─ …
```

A finger is not drawn *on* the hand; it **is** part of the hand's edge, which
is why the whole thing closes into one shape with no seam inside it. A folded
finger is the same node with a short tip, so it reads as a knuckle over the top
of a fist rather than as a stub hidden behind a palm.

### Proportions

A cartoon hand is a **mitten before it is a hand**, and the proportions are the
half of it a reader sees:

```text
palm             49 across, 50 tall            big and round
finger           15.6 wide                     a third of the palm
three fingers    exactly the palm's width      touching down their length
thumb            18 wide                       fatter again
line             3.8                           heavy enough at thumbnail size
```

**Three fingers and a thumb**, which is what Boop has always had. A fourth
finger buys nothing at this size and costs the width that makes the other three
read. Drawn thinner than this a hand reads as a rake — spikes on a stub,
however correct the anatomy is.

### Creases

Some of what a hand has to say is not on its edge. A fist has its folded
fingers ruled down the front; a closed hand has its thumb lying **over** them,
which is a line and not a silhouette — draw it as a bite out of the side
instead and the hand comes back with a gash in it.

A single path cannot hold a stroked line, because fill and stroke belong to the
whole path. It can hold a **sliver**: a closed shape half a unit wide that
`fill-rule="evenodd"` turns into a hole and that the outline's own stroke —
three units either side of it — paints over completely. What is left on screen
is a line of exactly the outline's weight, in a drawing that is still one
layer. `creases` is a list of polylines, so one can follow a contour as easily
as run straight.

That matters in three places:

* the **layer tree** shows eight leaves per hand instead of eight folders of
  six shapes, so the thing an author clicks is the thing they meant;
* **nothing inside a drawing can be selected, moved or rigged by accident**,
  because there is nothing inside one;
* an **export** carries one path per drawing, and the one on screen is one
  path's worth of a frame's work.

The OK sign is the one drawing with a hole in it — the ring its thumb and index
make. That is a second subpath in the *same* path, with `fill-rule="evenodd"`,
so it is still one layer.

## Mirroring

A **mirrorable** style is drawn once and flipped for the other hand, which is
what keeps the shipped set to eight files rather than sixteen:

```text
project/assets/hands/defaultCartoon/
  manifest.json
  relaxed.svg  open.svg  fist.svg  point.svg  thumbs-up.svg  peace.svg
  ok.svg  side-fist.svg
  sheets/hands.svg      every drawing, both hands, side by side
```

The flip is applied to the **geometry** when a drawing is placed in a mascot's
own SVG, not left as a transform — so the artwork inside a project is plain path
data that measures, exports and sanitises like anything else.

A style whose mirror image would read wrong says `mirrorable: false` and names
`leftAsset` and `rightAsset` instead. No shipped style needs it; the registry
allows it so that one can be added without changing anything else.

## One pivot

Every drawing shares:

* the same `viewBox` — `0 0 200 200`;
* the same pivot — `(100, 100)`, the **middle of the palm**, not an anatomical
  wrist: the hands float, and a floating hand turns about the middle of itself;
* the same apparent scale — every drawing fits the same radius around that
  pivot, and a test holds all eight to it;
* the same wrist and the same far side, literally: they are the same points in
  every table, shared rather than copied into each;
* the same palette and the same line weight.

That is what makes a change of drawing a change of picture and never a change of
size or position.

## Rotation

A static drawing carries a small turn well and a large one badly. **±25 to ±35
degrees** is the range that reads as a hand turning; much past that reads as a
picture rotating, because it is one. This is advice for whoever is animating
(`HAND_ROTATION_ADVICE`), not a limit — the engine clamps nothing.

## Two hands

The left and the right hold their own libraries, choose their own drawings, and
move, turn, resize and hide independently. No graphic data of one reaches the
other:

```js
mascot.setHandStyle('left', 'open');
mascot.setHandStyle('right', 'point');
```

Mirroring in the editor copies a hand's **placement** to the other side and
nothing about its appearance.

The Character Builder lists each hand's drawings as cards under the pair
(`docs/CHARACTER_BUILDER.md`, "Hands"): a press rests the hand on one it has,
or draws one it has not and rests on it, as one undo step -- through
`setHandStyles` and the same drawing press as the picker, nothing new in the
model.

## Timeline

```text
x · y · rotation · scale        interpolated, as they always were
style                           STEP: t=1.0 relaxed, t=1.1 point
visible                         discrete
```

A style is an index into the hand's own library, keyframed with `step` easing —
held until the key is reached, then taken. There is no attempt to morph between
two drawings, because halfway between two drawings is not a drawing. `step`
joined `CURVES` for exactly this, and anything else whose halfway point is not a
value can use it too.

### Changing style mid-animation

A direct swap is fine, and the best places for one are:

* under a fast movement, where nobody reads the frame it changed on;
* while the hand is off the artboard or behind the head;
* at the start of a gesture.

`swap: 'hidden'` does the third of those for you: the change is held until the
hand is out of sight and then taken instantly. The two clips a pair ships with
use it — the Wave opens its hand *as it comes out from behind the head* and
closes it back on the way in, so the swap is never seen. There is no cross-fade
and no transition engine: blending two hands is a double exposure.

## What a frame costs

```text
per hand, per frame:   transform  +  which drawing is visible
a change of drawing:   one sprite swap
```

Nothing recomputes geometry. Basic Face's pair exports **zero** shape keys; it
used to export 202 (the pseudo-3D turn) and then 30 (the drawings' own little
animations), all of them recomputed whenever anything moved.

## Drawing them

`project/editor/core/hands/hand-style-art.js` holds the eight drawings as literal
numbers — a ring of rim points and digits, walked once — and turns each into one
`M`, `C`, `L` and `Z` path. There is no pose table, no curl, no bend, no view
and no morphing in it, and a test greps for all of them.

```sh
npm run hands:styles      # writes project/assets/hands/defaultCartoon/ and a contact sheet
```

### Palette

Two colours and a line width, taken from the face's own palette so a hand beside
a warm face is not a white glove:

```js
glove: { fill: '#ffffff', line: '#1b1b1b', width: 3.1 }
skin:  { fill: '#f9d9b0', line: '#a4674a', width: 3.1 }
```

A mascot may hand in its own palette whole, which is how the template dresses
its pair to match its face. There is **no shading**: no gradient, no filter, no
second light. A floating cartoon hand has to read at thumbnail size, and
everything it needs to say it says with its silhouette.

## Anchors

The points something can be held by — each drawn fingertip, the middle of the
palm, the wrist — are fixed points on the drawing (`handStyleAnchors`). A style
that does not show a finger offers no tip for it, which is the honest answer:
there is nothing there to hold on to.

## In a project

```text
handLeft (g)                      the hand: reach, drift, turn, size, depth
 ├─ handLeftStyle-relaxed   (g)  ─┐ one drawing each,
 ├─ handLeftStyle-open      (g)   │ one of them visible,
 ├─ handLeftStyle-fist      (g)   │ all of them still
 ├─ handLeftStyle-point     (g)   │
 ├─ handLeftStyle-thumbsUp  (g)   │
 └─ handLeftStyle-peace     (g)  ─┘
```

A drawing is a **child of the hand group**, so the hand's own transform carries
it and a swap is one visibility. The rig record is:

```js
hands: {
  left: {
    element: 'handLeft', parent: 'faceRoot', anchor: {…}, reach: {…},
    parameters: { x: 'handLX', y: 'handLY', rotation: 'handLRotation',
                  scale: 'handLScale', depth: 'handLDepth', style: 'handLStyle' },
    styles: {
      set: 'defaultCartoon', showing: 'relaxed', swap: 'cut', pivot: [x, y],
      library: [{ id, label, element, mirrored }]
    }
  }
}
```

A hand's artwork must be a **group** for it to hold drawings. A hand set up on a
single shape is told so, and pointed at "Draw a pair of hands", which is the
shorter road.

## Migration

Old projects open unchanged. Nothing is converted behind anybody's back: a hand
that still carries the pseudo-3D turn is *marked* (`legacyPseudo3D`), and the
conversion is an action its author takes.

| old | becomes |
|---|---|
| `sideOpen`, `relax`, `rest`, `neutral` | `relaxed` |
| `palmOpen`, `spread`, `stop`, `wave` | `open` |
| `frontFist`, `grab`, `grip`, `punch` | `fist` |
| `pointing`, `index` | `point` |
| `victory`, `v` | `peace` |
| anything else | `relaxed` |

`retireHandDeformation` does the whole thing in the one order that works:

1. rename what asked for a pose — clips, expressions and stored states are
   rewritten to ask for the **style** instead, as `step` tracks, so a mascot
   that waved still waves;
2. take the drawings' own animation off — the keys `handLAnim` drove, and the
   parameter with them;
3. hide the six parts and drop every key measured on them — hidden, never
   deleted, so an author can undo the conversion by making them visible again;
4. drop the parameters nothing else names — the facing axis, the grip, the flip
   and the per-digit curls. A parameter an author still drives from their own
   binding is left standing.

### Deprecated fields

Read, never written, and ignored by the runtime:

| field | was | now |
|---|---|---|
| `hand.sprites` | the 2D drawing set | read as `hand.styles` |
| `sprites.drawings` | the drawings | read as `styles.library` |
| `drawing.anim` | the little rig a drawing carried | dropped |
| `handLDrawing` / `handRDrawing` | which drawing | read as the style parameter |
| `handLAnim` / `handRAnim` | how far a drawing's animation had played | dropped on load |
| `handLFacing` | the pseudo-3D turn | retired by the conversion |
| `handLGrip`, `handLFlip`, `handLIndex`… | the finger rig | retired by the conversion |
| `hand.poses` | a hand's gestures | read by the migration only |
| `pose.shapeKey` | method A: deform the hand | dropped on load |
| `pose.variant` | method B: a whole drawing per pose | still shown, as the choice it always was |
| `swap: 'crossfade'` | a short blend between two drawings | read as `cut` |

## Read with

* `docs/HAND_RIGGING.md` — what a floating hand is, and how it hides behind the head
* `docs/HAND_GESTURES.md` — a reaction asking for one
* `docs/DIRECT_CONTROLS.md` — the console and the picker on the canvas
