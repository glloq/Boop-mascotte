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

Six drawings, and that is the whole set:

| id | label | what it is |
|---|---|---|
| `relaxed` | Relaxed | short fingers, barely fanned, thumb hanging — a hand at rest |
| `open` | Open | long fingers fanned wide, thumb out — a wave, a stop, a hello |
| `fist` | Fist | three knuckles over the top, thumb across — a hold, a grab, a knock |
| `point` | Point | one finger out, two folded — look, there |
| `thumbsUp` | Thumbs up | a fist with the thumb up its own side |
| `peace` | Peace | two fingers in a V, one folded |

They live in `HAND_STYLES` in `project/runtime/hand-vocabulary.js`, and nowhere
else — there is no `if (style === …)` anywhere in the system, so a seventh
drawing is a row in that registry and a table of numbers beside it. **Five to
ten** is the range worth having; six good drawings beat ten redundant ones.

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

## Mirroring

A **mirrorable** style is drawn once and flipped for the other hand, which is
what keeps the shipped set to six files rather than twelve:

```text
project/assets/hands/defaultCartoon/
  manifest.json
  relaxed.svg  open.svg  fist.svg  point.svg  thumbs-up.svg  peace.svg
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
  pivot, and a test holds all six to it;
* the same palm and the same cuff, literally: only the fingers differ;
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

`project/editor/core/hands/hand-style-art.js` holds the six drawings as literal
numbers — a palm, a cuff, and the capsules that are its fingers — and turns them
into `M`, `C`, `L` and `Z` paths. There is no pose table, no curl, no bend, no
view and no morphing in it, and a test greps for all of them.

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
