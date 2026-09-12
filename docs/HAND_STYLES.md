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
no morphing. A drawing is made of named layers an author can open and reshape
(see "A gesture is a file"), but **nothing inside one ever moves at runtime** —
not a finger, not the palm, not the thumb. No layer carries a key, a parameter
or a binding.

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
| `relaxed` | Relaxed | three short fingers, barely fanned, thumb tucked — a hand at rest |
| `open` | Open | three long fingers fanned wide, thumb out — a wave, a stop, a hello |
| `fist` | Fist | three knuckles over the top, thumb across the front — a hold, a grab, a knock |
| `point` | Point | one finger out, two folded — look, there |
| `thumbsUp` | Thumbs up | a closed hand with the thumb straight up out of it |
| `peace` | Peace | two fingers in a V, one folded |
| `ok` | OK | thumb and index in a ring, two fingers up — good, exactly, fine |
| `sideFist` | Closed side | a closed hand seen side on, no fingers showing |

They are **files**, in `project/assets/hands/defaultCartoon/`, and a ninth
drawing is a ninth file — no code, no registry row, no table of numbers (see
"A gesture is a file"). There is no `if (style === …)` anywhere in the system.
**Five to ten** is the range worth having; eight good drawings beat twelve
redundant ones.

`HAND_STYLES` in `project/runtime/hand-vocabulary.js` keeps the same eight
names for the **standalone runtime**, which ships without an editor and has to
know what a saved project can say. The editor's live list is whatever set is
installed:

```js
handStyleIds()          // ['relaxed', 'open', 'fist', …] — the set's own order
defaultHandStyle()      // the set's fallback
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

## A gesture is a file

**A drawing is a piece of one or more named layers, and it lives on disk.**

```text
project/assets/hands/<set>/
  manifest.json      what the set is: pivot, scale, radius, its gestures
  relaxed.svg        one <g> of named layers
  open.svg           …
  sheets/hands.svg   every drawing, both hands, side by side
```

```svg
<svg viewBox="0 0 200 200" data-hand-pivot="100 100" data-hand-scale="2">
  <g id="hand-open" data-name="Open">
    <path id="index"  data-name="Index"  d="…"/>
    <path id="middle" data-name="Middle" d="…"/>
    <path id="ring"   data-name="Ring"   d="…"/>
    <path id="thumb"  data-name="Thumb"  d="…"/>
    <path id="palm"   data-name="Palm"   d="…"/>
  </g>
</svg>
```

Open one in any editor and it is a hand-sized icon, because the file's own
frame is a 200 box with the pivot in the middle at 2×. The editor converts
every coordinate into the **drawing's own units** on the way in — pivot at the
origin, one unit to a unit — so nothing downstream knows what box the file
used.

Installed into a mascot, the group's ids are namespaced by the hand and the
drawing that own them:

```text
  a drawing, in the layer tree
  ────────────────────────────
  handLeft                        (g)   the hand: reach, drift, turn, size
   ├─ Relaxed                     (g)   handLeftStyle-relaxed
   │   ├─ Index                 (path)  handLeftStyle-relaxed-index
   │   ├─ Middle                (path)
   │   ├─ Ring                  (path)
   │   ├─ Thumb                 (path)
   │   └─ Palm                  (path)
   ├─ Open                        (g)   handLeftStyle-open      opacity="0"
   └─ …
```

### Why layers

**The order is the drawing.** A finger goes down before the palm it grows out
of; a thumb goes down after the palm it lies *on*. That is a thing one path
cannot say, and it is what a hand is made of:

```text
open       index · middle · ring · thumb · palm      the palm closes over the roots
fist       palm · index · middle · ring · thumb      the fingers fold onto the palm
```

A single path had to fake all of it. A thumb folded in front of the fingers had
no silhouette, so it was drawn first as a bite out of the side of the hand and
then as a hairline sliver turned into a hole by `fill-rule="evenodd"` — both
workarounds for a shape the format could not hold. A layer just goes on top.

It is also what makes a hand **editable** and **extensible**: there is something
inside a drawing to open, select and reshape, and adding a gesture is adding a
file.

### What a layer is not

Nothing inside a drawing is rigged. A layer carries no key, no parameter and no
binding; the hand's own group carries the transform, and the runtime swaps whole
drawings by **one opacity write per drawing** (`runtime/hands.js`,
`showHandStyle`). Seven of the eight a hand holds sit under `opacity="0"` on
their group — one attribute, however many layers the drawing has.

So a hand on screen is a handful of paths rather than one, and the other seven
drawings are free: an invisible group is not a frame's work.

### The rules a drawing has to pass

The face part library's artwork rules, to the letter
(`core/face-library/face-part-validation.js`), because a drawing an author
brings is a drawing a stranger wrote:

* one root element, and it is the `<g>`, not the `<svg>`;
* the root has an id, and so does **every layer inside it** — the layer tree,
  the roles and the palette all address a layer by its id;
* no id drawn twice;
* nothing a sanitizer would strip: no script, no handler, no external
  reference;
* every path written with **`M`, `C`, `L` and `Z`** only. A drawing is placed,
  scaled and mirrored by arithmetic on its coordinates, so every number in it
  has to *be* a coordinate — an arc or a relative command would be moved
  wrongly and silently.

A set installs **all of it or none of it**: a set that half-installs is a hand
with three drawings and a gap.

### Proportions

A cartoon hand is a **mitten before it is a hand**, and the proportions are the
half of it a reader sees:

```text
palm             48 across, 40 tall            big, straight-sided, round-cornered
finger           15 wide                       a third of the palm
three fingers    the palm's width              touching down their length
thumb            18 wide                       fatter again
line             1.9                           heavy enough at thumbnail size
```

**Three fingers and a thumb**, which is what Boop has always had. A fourth
finger buys nothing at this size and costs the width that makes the other three
read. Drawn thinner than this a hand reads as a rake — spikes on a stub,
however correct the anatomy is.

A palm drawn as an ellipse reads as a ball with fingers stuck in it. What makes
it read as a palm is that its sides are straight and its corners are round.

The OK sign is the one drawing with a hole in it — the ring its thumb and index
make. That is one layer with two subpaths wound opposite ways and
`fill-rule="evenodd"`, which the file carries and the editor passes through.

## Mirroring

A **mirrorable** style is drawn once and flipped for the other hand, which is
what keeps the shipped set to eight files rather than sixteen:

```text
project/assets/hands/defaultCartoon/
  manifest.json
  relaxed.svg  open.svg  fist.svg  point.svg  thumbsUp.svg  peace.svg
  ok.svg  sideFist.svg
  sheets/hands.svg      every drawing, both hands, side by side
```

The flip is applied to the **geometry** when a drawing is placed in a mascot's
own SVG, not left as a transform — so the artwork inside a project is plain path
data that measures, exports and sanitises like anything else.

A gesture whose mirror image would read wrong says `"mirrorable": false` in the
manifest and ships a drawing a side. No shipped gesture needs it; the model
allows it so that one can be added without changing anything else.

## One pivot

Every drawing in a set shares, and the **manifest says so once** for all of
them:

* the same `viewBox` — `0 0 200 200`;
* the same pivot — `(100, 100)`, the **middle of the palm**, not an anatomical
  wrist: the hands float, and a floating hand turns about the middle of itself;
* the same `radius` — every drawing fits inside it around that pivot, and a
  test holds all eight to it *and* to each other's apparent size;
* the same palette and the same line weight.

A radius rather than a box, because a pair of hands hangs tilted; one number
for the whole set, because that is what "the same apparent scale" means.

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

**There is no geometry in the editor.** A gesture is a drawing somebody made,
and it lives on disk:

```text
project/assets/hands/<set>/*.svg        the drawings, authored — the source of truth
        │
        ▼  core/hands/hand-set.js       read, validated, in drawing units
        │
        ▼  core/hands/hand-style-art.js placed, scaled, mirrored, painted
        │
        ▼  <g id="handLeftStyle-open">  on the mascot, one layer per shape
```

`core/hands/sets/index.js` is a **generated** copy of those files, so the
editor's bundle and the unit suite can both read a set without an asynchronous
startup — an empty hand library for the first frames is a mascot with no hands.
`hand-sets.test.js` re-reads the directory and fails if the two have parted
company, so the copy can never quietly become the truth.

```sh
npm run hands:sets        # re-reads project/assets/hands/ into core/hands/sets/index.js
npm run hands:sheet       # every drawing, both hands, into <set>/sheets/hands.svg
```

**To add a gesture**: put an SVG in the set's directory, add a row to
`manifest.json`, run `npm run hands:sets`. To change one: edit its file and run
the same command.

The geometry that seeded the shipped eight is `scripts/hand-set-seed.mjs`, and
**nothing imports it**. Running it again throws the eight files away and puts
the originals back, which is occasionally what you want and never what you want
by accident — it is deliberately wired to no npm script.

### Palette

Two colours and a line width, taken from the face's own palette so a hand beside
a warm face is not a white glove:

```js
glove: { fill: '#ffffff', line: '#1b1b1b', width: 1.9 }
skin:  { fill: '#f9d9b0', line: '#a4674a', width: 1.9 }
```

A mascot may hand in its own palette whole, which is how the template dresses
its pair to match its face. There is **no shading**: no gradient, no filter, no
second light. A floating cartoon hand has to read at thumbnail size, and
everything it needs to say it says with its silhouette.

## Anchors

The points something can be held by — each drawn fingertip, the middle of the
palm, the wrist — are fixed points on the drawing (`handStyleAnchors`). The
**set declares them**, in the manifest, because only the drawing knows where its
fingers end. A gesture that does not show a finger offers no tip for it, which
is the honest answer: there is nothing there to hold on to.

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
