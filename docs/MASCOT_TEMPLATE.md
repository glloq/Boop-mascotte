# The mascot template

One template ships: **Mascot Face**. `face-artwork.js` draws it,
`template-project.js` rigs it, and the two files are read together — every id
in the drawing is wired by the rig, and nothing in the rig points at an id the
drawing does not have.

The drawing is **Basic Face V2**. V1's face was assembled feature by feature
and it showed: a perfect circle for a head, eyes a quarter wider than tall, a
half circle for a nose the width of a third of the mouth, a dead flat mouth,
saw-toothed symmetric hair, and two slabs of brown down the cheeks doing duty
as shading. V2 is the same rig — the same ids, the same shape keys, the same
2.5D turn — redrawn:

| | V1 | V2 |
| --- | --- | --- |
| silhouette | circle, r 100 | cranium wider than the jaw, cheeks drawing in, a small soft chin |
| eyes | 26 × 21 (24 % apart) | 24 × 22.5 (7 % apart), and less foreshortened on a turn |
| brows | a stroked three-point curve | a drawn shape, blunt at the nose and tapering at the temple |
| nose | a half circle of radius 9, eye weight | a small lopsided hook, lighter than the mouth |
| mouth at rest | a straight bar | a lip line that curves |
| hair | a symmetric helmet with four notches | a sweep, a parting off the middle line, a tuft |
| ears | as tall as an eye is wide, outlined at the silhouette's own weight | three quarters of the size at two thirds of the weight |
| shading | two slabs at 50 % in a brown darker than the hair | crescents, a hairline shadow and a highlight, all under 25 % in skin tones |

Nothing about the rig moved. The numbers it needs — where the eyes are, how
far a lid travels, the box a brow's pins hang on — now come **from the
artwork** (`FACE_CENTRES`, `LID_TRAVEL`, `BROW_BOXES`, `MOUTH_BOX`) instead of
being a second copy in `template-project.js`, which is the only reason a
redraw of this size did not need every one of them found and edited twice.

`project/editor/core/tests/face-artwork.test.js` holds the *properties* the
drawing has to keep — a blink that covers the eye, a pupil that stays in its
socket at a full gaze, a fringe that never touches a brow at any head pose, a
jaw that lengthens the face without widening it — and
`scripts/face-snapshots.mjs` renders twenty-five poses through the exported
runtime so a change can be looked at as well as asserted.

## Why one

There were three (Basic, Expressive, Talking). The other two were strictly
*smaller* than this one — fewer parts, fewer movements, the same shapes — so a
beginner picking one of them started with less and had no way of knowing it.
Three sets of artwork also meant three rigs to keep working every time the
model changed.

What a beginner needs is **a complete face they can strip down**, not three
partial faces they have to build up. Deleting a part in Artwork takes one
press; drawing an eyebrow does not.

## What it draws

240 × 240, 42 elements, cartoon flat colour. Paint order is the layer order, so
what is written first is behind:

```text
hairBack                         the darker hair that shows around the crown: a solid cap, mostly hidden
earLeft · earRight               a shape, an outline on the outer half only, and a fold; on the turn axis, so they tuck behind the head
head                             the whole outline, and the jaw: one path that lengthens
faceShading                      clipped to the head, and one folder rather than four loose shapes:
  shadeLeft · shadeRight           a crescent inside each edge, fading against `headX`
  faceLight                        one soft field on the cheek the fringe leaves open
  shadeHair                        the shadow the fringe drops on the forehead
mouth                            one closed shape: the fill is the inside, the stroke is the lips
tongue · teeth                   drawn from the mouth's own curves, so they cannot leave it
eyeLeft · eyeRight               each a clipped group: white · pupil · glint · catchlight · upper lid · lower lid · rim
eyebrows (browLeft · browRight)  drawn shapes, not strokes, so they can taper
nose                             a small hook, seen from the front, turned by `headX`
hairTop                          the volume above the skull, and the tuft on it
hairFront > hair                 the fringe, clipped to the head
```

There is no blush. It was two ellipses that never moved and never meant
anything, and a face reads better without a permanent flush.

### The palette and the weights are objects

`FACE_PALETTE` and `FACE_STYLE` hold every colour, stroke width and opacity in
the drawing, and `face-artwork.test.js` fails on a literal that is in neither.
V1 spelled its browns into whichever function needed them, and the outline, the
shading, the crown and the back of the hair all landed within a few percent of
each other — which is why the mascot read as a brown blob at small sizes.

The weights are a **hierarchy**, because a cartoon face is read as one. V1 drew
the eye rim and the mouth at 6 against a silhouette of 4, so the features
fought the outline:

| | brows | silhouette | eyes | mouth | nose | details |
| --- | --- | --- | --- | --- | --- | --- |
| V2 | 8.4 (filled) | 4 | 4 | 3.8 | 2.8 | 2.2 |

`buildMascotFaceSvg({ palette })` takes an override, which is where a future
"recolour the mascot" goes without any of this being restructured.

### The soft shapes are point lists

The hair, the shadows and the highlight are authored as lists of points and
turned into cubics by `spline()` — a Catmull-Rom curve, so the tangents match
on both sides of every point and there is no way to write a corner into one of
these shapes by accident. V1's hair was hand-written cubics, and every join
where two segments met without their control points lining up was a notch.

## The eye is a clipped group

`eyeLeft` and `eyeRight` are not the whites — they are the whole eye, a group
carrying `clip-path="url(#eyeSocketLeft|Right)"` and holding the white, the
pupil, the glint, the two eyelids and the outline.

That is what makes a closed eye behave. The eyelids are ordinary skin-coloured
shapes parked above and below the socket; `eyeOpen` drives their `translateY`
so they meet over the middle as the eye shuts. The pupil does not fade — it is
still there, **behind the lid**, exactly as it would be on paper. Everything
the lids push past the socket edge is simply not drawn.

The artwork draws them **open**, and the bindings carry an offset so `eyeOpen 1`
lands on the drawing and `eyeOpen 0` is the movement. V1 drew them shut and let
the rig lift them, which meant the artwork on its own — the file an author
opens, the thumbnail, the `mascot.svg` Export writes — was a mascot asleep.

How far they travel is `LID_TRAVEL`, and it is derived rather than tuned: the
half-socket, plus the lid's own curved edge, plus a margin. The rigging reads
the same constant, so resizing the eye keeps a full blink covering it instead
of needing both numbers found and re-tuned.

The previous face faded the pupil out with `opacity`, which is why a closing
eye looked like a pupil dissolving rather than an eyelid coming down.

The fringe is clipped the same way, to the head itself — `hairFront` carries
`clip-path="url(#headShape)"` and the fringe is drawn *wider than the head on
purpose*. Whatever the turn or `hairSway` does to it, it can neither leave the
silhouette nor slide off the hairline: it used to do both, sticking out past
the outline on one side and uncovering the forehead on the other.

**The clip has to travel with the eye.** A `clip-path` is applied to an
element's content in its own space and then transformed with it, so the clip
follows the element it is *on* and not the elements *inside* it. With the clip
on a wrapper, a turn moved the white and the pupil out from under a socket
pinned to the face, and the eye came apart. On the group, socket, white, pupil,
lids and rim turn as one assembly — which is also why the rim is inside the
clip (drawn at double stroke width, since a clip cuts a boundary stroke in
half) and why the `eyeOpen` squash is gentle: it scales everything in the
group, and a hard squash would pull the lids out of the socket.

`clipPath` survives the whole pipeline, which was verified before the artwork
was drawn on that assumption: the sanitizer keeps it (internal `#` references
are allowed), the DOM keeps `clip-path="url(#…)"`, `defs` children with no id
are excluded from `elements` and from the layer tree, and it round-trips
through save and export unchanged.

### One fade that is legitimate

`rimLeft` / `rimRight` *do* fade with `eyeOpen` (amplitude 3, offset −0.15, so
they are gone only at the very end of the close). The rim is the socket
outline: a closed cartoon eye is a crease, not a circle with a line through it.
The rim really does stop existing; the pupil does not. That is the difference
between the two, and it is why one is a fade and the other is a clip.

The fade reads `eyeOpen + eyeOpenLeft|Right`, and so does the lower lid's own
binding. Both were written against the shared `eyeOpen` alone, which is fine
for a blink and wrong for a **wink**: one lid came down over an eye whose lower
lid had not moved and whose outline was still drawn, so a wink was a crescent
of white inside a circle with a crease through it.

## The mouth is one shape

It was two: a stroked lip line that morphed for the smile, and a filled cavity
that scaled for the opening. Two shapes deforming under two different systems
cannot agree — a smile put the lip corners outside the cavity, and half-open
the lip lay across the hole like a stick.

One closed path has no such seam. The **fill is the inside of the mouth** and
the **stroke is the lips**, so every pose is a mouth:

```js
mouthPath({ open, smile })   // one function, four shapes
```

| Shape key | Drawn as | Driven by |
| --- | --- | --- |
| rest | `mouthPath()` | — the outline the others deform |
| `mouth-open` | `mouthPath({ open: 1 })` | `mouthOpen` 0 → 1 |
| `mouth-smile` | `mouthPath({ smile: 1 })` | `smile` 0 → 1 |
| `mouth-frown` | `mouthPath({ smile: -1 })` | `smile` 0 → −1 |

Every control point is **affine** in `open` and `smile`, so the additive shape
keys reproduce any combination exactly rather than approximately: a laughing
mouth is `mouthPath({ open: 1, smile: 1 })` to the last unit, and the unit test
asserts that.

Neither a transform nor the legacy morph can do this. A scale that closes the
mouth flattens the smile with it, and the legacy A/B morph is one shape per
element — which is why the Mouth's `mouthOpen` and `smile` controls use the
`shapeKey` method (`docs/SEMANTIC_RIGGING.md`). `mouthWidth` stays an honest
`scaleX`.

### Teeth and a tongue

Both are drawn from the mouth's **own curves** — the teeth hang off the upper
lip, the tongue sits on the lower one — so they are inside it by construction.
A shape that only happens to line up stops lining up the moment anything moves,
which is exactly how the old cavity came apart.

| Shape key | Driver | Why an expression |
| --- | --- | --- |
| `teeth-show` | `mouthOpen * teeth` | a **product**: closed lips have nothing behind them to show, however far the control is up |
| `teeth-follow` | `smile` | the upper lip moves with the smile whether or not anything shows behind it — signed, so a frown carries it the other way |
| `tongue-show` | `mouthOpen * tongue` | the same product |
| `tongue-follow` | `smile` | the same follow |

`teeth` and `tongue` are the Mouth part's optional roles, so the 2.5D turn
carries them with the lip line, and they are ordinary movements: a slider, a
pose chip, an animation track, a reaction.

### The jaw is the outline

The lower face used to be a second shape: a wide ellipse behind the head, slid
down by `mouthOpen + jawOpen`. Sliding it exposed its own top edge against the
head it was meant to extend, and what you got was a **double chin** — two
outlines where a face has one.

The head is one path now, and the jaw is that path getting longer:

```js
headPath({ jaw: 1 })   // the sides pinned, the bottom 16 units lower
```

Every point below the middle is scaled away from the centre and everything at
or above it is left alone, so the silhouette stays a single closed curve at
every value. The `head-jaw` shape key carries the head between the two outlines, driven
by the expression `mouthOpen + jawOpen`: the chin drops when the mouth opens,
**and** an author can drop it on its own without opening anything. One shape
key, two ways to move it, and no seam to show.

## The hair has a top

The mascot used to be bald above the hairline. There were two hair shapes and
neither of them was **hair**: `hairBack` sat entirely behind the head outline,
and the fringe is clipped to the head on purpose, so everything above the skull
was skin. The top of the hair was drawn and then hidden — and a piece of
artwork nobody can see is a piece nobody can control either.

Three pieces now, and all three are the Hair part:

| Element | What it is | Clipped? |
| --- | --- | --- |
| `hairTop` | the volume above the skull — a crown that reaches well inside the head, under the fringe, and rises above it | no: that is the point |
| `hairBack` | the darker hair showing around the crown and behind the ears — one solid cap, not a rim | no |
| `hair` | the fringe on the forehead | to the head, so it cannot cross the outline |

`hairSway` and `hairLift` drive all three (the registry gives the Hair part
`hairTop` and `hairBack` as optional roles), each about its own pivot, so the
hair moves as one head of hair rather than as a fringe with a static hat
behind it.

The three **overlap**, and that is the whole of why the hair holds together.
The crown used to meet the back along a shared curve and to end exactly on the
head's outline: two edges that are one drawing only while nothing moves. A
turn, or the beat of secondary motion, slid them apart and drew the page and
the head's own border across the top of the hair. So the back is a solid cap
whose middle is simply hidden, the crown overlaps the head by about twelve
units where the fringe covers it, and the crown is given **no depth of its
own** (`hairTop: { depth: 0 }` in `head-pose-turn.js`), so the turn writes it
no travel at all and it rides the head group exactly — it is the skull's
silhouette, not a feature drawn on it. A depth there is not "a little lag", it
is the crown sliding off the skull: `screenDepth` already adds the outline's
own depth for anything inside the head, so a crown asked to travel *with* the
head travels twice as far as it, and the head's border comes out from under
the hair on the far side. The other two keep a depth, because they are the
front and the back of a volume: the fringe swings furthest of the three
(`0.42`) and is clipped to the head, and `hairBack` swings the *other* way
(`-0.2`) — it is behind the axis, so turning the head to the right shows more
of the back of the hair on the left. That counter-swing is the cue that says
the hair has a volume rather than being painted on the front.

## The nose turns with the head

A nose is the one feature a flat drawing cannot carry by sliding: it is the
part that sticks out, so at three quarters it is a different drawing. It is
also the simplest shape on this face — **one small hook**, seen from the front
(`NOSE_REST`, about `120, 148`), drawn the way the rest of the face is drawn,
one curve and no shading.

V1 drew that curve as a half circle of radius 9 in the same weight as the eye
rims, on the middle line above the mouth: a small `U`, above a larger `U`, in
matching ink, and it read as a second mouth. V2's is half the span, a third
lighter than the mouth, and deliberately lopsided — the left wing short, the
right one carrying on and lifting — so it reads as a nose at the sizes where it
is four pixels wide, and disappears politely at the sizes where it is one.

What turns it is not a second drawing but a **rotation**: the template binds
`nose.rotation` to `headX` with `NOSE_TURN` (−70°) about the middle of the
shape, so the curve that reads as the underside of the nose from the front
comes round to read as its ridge from the side.

Rotating it is the one thing a shape key could not do. A shape key is a linear
morph between two drawings, so the way from a curve to its mirror passes
through the straight line halfway: the nose flattened into a bar in the middle
of every turn — the wall the hands hit as "a mirror whose midpoint is a hand
folded onto its axis" (`docs/HAND_REPRESENTATIONS_STUDY.md`). A rotation has no
such midpoint. Every angle of it is the same curve seen from further round, so
there is no angle at which the nose is not a nose, and there is nothing left to
keep the two profiles from blending into each other: there are no profiles.

It also makes the turn symmetric for free. A rotation by `+θ` and by `−θ` are
each other's mirror, so the nose travels exactly as far one way as the other —
what the pair of hand-drawn profiles had to be offset by hand to achieve.
`ux41-pseudo-3d.spec.js` measures that symmetry on the canvas — on the mouth,
since the nose is lopsided on purpose and the middle of a rotating asymmetric
box is not a fixed point of the drawing. `templates.test.js` checks the rest:
the curve is the drawing, there are no nose shape keys, the binding is the
rotation, and half of `headX` is half the angle.

## The ear is outlined on its outer half

An ear is a fill and an arc, not a stroked ellipse. Behind the head the
difference does not show — the outline only appears where the ear leaves the
silhouette — but the 2.5D turn brings the near ear *in front of* the cheek, and
there the whole ellipse was drawn: a ring on the side of the face whose inner
half read as a seam between two pieces of artwork rather than as one head.

So `earLeftShape` is skin with no stroke (skin on skin has nothing to draw) and
`earLeftEdge` is the arc from the top of the ear round the outside to the
bottom. Its two ends land on the head's own outline, within about a unit at
rest, so the silhouette simply detours around the ear. `earLeftFold` is
unchanged.

## Cartoon shading

V1 did not really have shading. It had two slabs the height of the face at 50 %
in a brown darker than the hair, which is not a shadow but a second colour on
the face, and they sat loose in the layer list between the head and its
features.

V2 keeps the two ids — `headX` still fades them against each other, which is
the cheapest volume cue this face has — but they are narrow crescents inside
the silhouette in a lighter skin tone, and they live in a `faceShading` folder
with two new shapes: `faceLight`, one soft field on the cheek, and `shadeHair`,
the shadow the fringe drops on the forehead. The folder is clipped to the head,
so none of them can be seen as an edge against the outline.

Every opacity is under 25 % and every colour is within 60 of the skin
(`face-artwork.test.js` asserts both). `shadeLeft` / `shadeRight` are bound to
`headX` at `amplitude ±0.6, offset 0.3` — the offset was 0.1, which is another
way of writing "invisible until the head moves"; V2 rests at a light shading
and deepens from there. `faceLight` drifts seven units against the turn and
dims a quarter, which is enough to stop a highlight reading as painted on and
not enough for anyone to see it move.

## The hair is the signature

Three things, and between them they are what the mascot is recognised by at
32 px, when none of the features are legible:

1. a **parting well off the middle line** (x 138) — symmetry is what stops any
   head of hair from having one, and a parting is most of what makes one head
   of hair different from another;
2. **one long sweep** carried across the whole forehead from it, falling past
   the left temple and out of the silhouette, with a shorter lock over the
   right temple;
3. a **tuft** lifting off the crown, also off the middle line.

The constraint that decides where any of it can go is the brows: a fringe that
touches one takes half the face's expressions with it. The sweep is drawn to
clear both of them, and `face-artwork.test.js` checks that it still does at
every head pose, since the fringe and the brows travel by different amounts on
a turn.

## What it ships switched on

- **Every face part assigned**: head, eyes, gaze, eyelids, eyebrows, nose,
  jaw, ears, hair, mouth, tongue.
- **Every movement on**, eighteen of them: `headX/Y/Tilt`, `lookX/Y`,
  `eyeOpen`, `browRaise/Tilt`, `noseScrunch`, `mouthOpen`, `smile`,
  `mouthWidth`, `teeth`, `tongue`, `jawOpen`, `hairSway/Lift`, `earWiggle`.
  Each drives a generated binding or a shape key, so none of them asks to be
  calibrated first; the five shaped ones (`mouthOpen`, `smile`, `teeth`,
  `tongue`, `jawOpen`) report *calibrated*, since a shape key already says what
  the movement looks like at both ends. Every one of them has a row of pose
  chips and a handle on the mascot (`docs/DIRECT_CONTROLS.md`).
- **The automatic life running**: blink, natural gaze on both axes, idle head
  movement. A mascot that arrives frozen reads as broken.
- **Six motions**: Look Around, Blink, Smile, Head Nod, Head Turn, Simple Talk.
- **The 2.5D turn generated** — see below.
- Three states (idle, happy, surprised) with transitions.

## 3D by default

`headX` turns the head from the first frame. `applyTemplateProject` generates
the same 3 × 3 grid the **Generate turn** button writes
(`headTurnKeyforms` / `headTurnPivots` / `headTurnBindings` — the shared
generator, not a copy), so a template turn and an authored one are the same 108
keyforms and either can replace the other.

Pressing **Reset all** in the Head pose panel is the exact inverse: the grid
clears *and* the head's own `translateX` / `translateY` bindings come back on,
so `headX` slides the head again rather than being left driving nothing. That
is also the state an imported drawing starts in.

The Face Builder generates faces through this same `applyTemplateProject`, and
those keep the plain head movement until their author presses **Generate
turn**: a generated face has no measured centres, and the parallax needs them.

## What the redraw shook out

Two things had been quietly untested because of what V1 was drawn as, and both
started failing the moment the drawing changed. Neither is a redesign bug:

* **a cancelled warp drag left the bend on the canvas.** Escape abandoned the
  gesture correctly and the restore then wrote the artwork's own markup, where
  a warp is never baked. V1's head was a circle inscribed in its own bounding
  box, so every point of it sat on the edge of a 3 × 3 lattice where the middle
  handle has no weight: moving that handle bent nothing, and a cancelled drag
  had nothing to put back. V2 has control points inside the box;
* **a wink left a crescent of white in a closed eye.** The lower lid's binding
  and the rim's fade both read the shared `eyeOpen` and not the side offset the
  eyelids grew with the face control rig, so one lid came down over an eye
  whose partner had not moved and whose outline was still drawn.

## Keeping it honest

Two things check the drawing, and they check different halves of it.

`project/editor/core/tests/face-artwork.test.js` asserts **properties**, not
coordinates: the eyes are round and the pupils stay inside them, a blink covers
the eye and half a blink covers half of it, the neutral mouth curves and a
smile is unmistakably more, an open mouth stays inside the face it opens, the
fringe never touches a brow, the jaw lengthens the face without widening it,
the clip path is the silhouette's own geometry, no colour is a literal, and
nothing on the face costs a filter. Redrawing this face again should leave
every one of them true; one that cannot be is the conversation the test exists
to start.

`scripts/face-snapshots.mjs` is the other half — the part no assertion covers.
It poses the shipped template through the exported runtime (the same
`mascot.svg`, `rig.json` and `runtime.js` a page would serve) and writes a PNG
per pose plus a contact sheet:

```sh
node scripts/face-snapshots.mjs out/face-v2
```

Twenty-five views: every expression the brief names, the eyelid range, the gaze
extremes, the mouth at rest and open, and the head turned four ways. Nothing is
checked in — the images are a review aid, and what is worth defending in CI is
asserted numerically above, where it needs no browser.

`project/assets/mascot-sample.svg` is written from the same artwork
(`npm run assets:sample`, and a test that fails if the two part company). It
used to be a yellow circle with two black ovals and a smile, from before there
was a template at all; nothing loaded it, so nothing noticed that the "sample
mascot" in the repository had not looked like the mascot for a long time.

## Extending it

`add(state, type, roles, controls)` skips a role whose element the artwork does
not draw, and creates no part at all when none of its roles is present. So the
rig above is written once and serves both the full template and whatever subset
the Face Builder produced. Adding a part to the drawing and a line to the rig is
all a new feature costs.
