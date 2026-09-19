# Eyes: three builds, and a socket you can see

> *« les preset des yeux sont relativement similaire … on va limiter le choix
> des yeux a 3 modes : simpliste avec juste un point sans blanc des yeux, un
> mode simple avec pupille paupiere et blanc des yeux et une autre avec l'iris …
> j'ai aussi remarqué que le montage des yeux utilisent un cercle pour cacher
> les paupiere ⇒ il n'apparait nul part et je ne peut pas redimenssionner ou
> deplacer un ou plusieurs oeil ! »*

Two complaints, and they turned out to be one answer.

## What was there

**Twenty-one pairs of eyes, and seventeen of them were one construction.**

```text
builtin/eyes.js          round-large · round-small · sleepy · cartoon · minimal
animals/eyes.js          animal-round-large · animal-round-slit · animal-almond-alert
                         animal-small-cute · animal-sleepy · animal-happy
birds/eyes.js            bird-round-large · bird-soft · bird-bright
                         bird-sleepy · bird-happy · bird-piercing
robots/eyes.js           four lit panels — a different construction, and they stay
```

The animal file said so in its own header: *"Built the way the shipped sets are
built (`builtin/eyes.js`)"*. The bird file said it twice. Every one of the
seventeen was a socket clip, a white, a pupil, a glint, an outline and two lids
drawn open and parked outside the socket — at another radius, or with its lids
resting lower.

So an author choosing between them was choosing:

| What differed | What it actually is |
| --- | --- |
| `round-large` vs `round-small` | a **size** — the scale field |
| `sleepy` | a lid parked lower — `eyeOpen` at 0.6, which can be keyed |
| `animal-happy` | a lid parked all the way down — `eyeOpen 0` |
| `bird-bright` vs `bird-soft` | a pupil radius against a white radius |
| `animal-almond-alert`, `bird-piercing` | a corner pulled — the one real difference |

Twenty-one cards for two questions.

## The three builds

```text
   dot                simple                  iris
    ●                ╭─────╮                ╭─────╮
                     │ ⬤   │                │ ◎   │
                     ╰─────╯                ╰─────╯
   a pupil        white · pupil        white · iris · pupil
   and nothing    · lid · outline      · lid · outline
```

The vocabulary is the two questions that change the **drawing**: *is there a
white, and is there an iris.* Everything else an eye does, it does by moving.

None of the three declares a morphology, so all three suit every head — a muzzle
and a beak no longer need eyes of their own, which is twelve cards and a
compatibility warning gone. `core/face/eye-build.js` holds the geometry and the
drivers, and `builtin/eyes.js` is a thin skin over it.

### The iris is a role, not a decoration

`eyes.iris` draws a disc of colour with the pupil inside it, and the iris
**travels with the pupil**: a look that moved only the dark centre would slide it
out of its own iris. So `gaze` grew two optional roles —

```js
gaze: { roles: ['leftPupil', 'rightPupil', 'leftIris', 'rightIris'],
        requiredRoles: ['leftPupil', 'rightPupil'],
        bindings: { leftIris: { lookX: 'translateX', lookY: 'translateY' }, … } }
```

— optional, so the dot and the simple eye install exactly as they always did.
The iris carries the two look axes and **not** `pupilScale`: a pupil dilates, and
an iris that grew with it would swallow the white.

It is also the thirteenth **palette token** (`iris`), because a blue-eyed mascot
is the whole point of the build and a palette that cannot set the colour makes it
half a feature. All twenty-one palettes carry one; nothing in the robot or bird
packs paints with it.

### What the three gave up

A **slit pupil**. That was the one thing in the seventeen that was a *shape*
rather than a size, and `pupilScale` cannot stand in for it — it scales both axes
together on purpose, because a pupil narrowed on one axis is an oval. An author
who wants a cat's slit draws the pupil and gives it the `leftPupil` role in Face
Setup, which is the path any hand-drawn part takes. The muzzle pilot's
`pupils.vertical` row records that rather than pretending otherwise.

## The socket, and why that was two problems

Every eye in the library was clipped to a `<clipPath>` holding an anonymous
ellipse, living in `<defs>`, with its lids drawn open and **parked outside**
that clip. Measured on screen:

| | |
| --- | --- |
| The eye as drawn | 114 × 107 px |
| The eye's **bounding box** | 219 × 321 px |

Two separate faults, and the first attempt at this treated them as one and
deleted the clip. That was a misreading — of the artwork and of the ask:

> *« je t'avais demandé d'afficher le cercle qui faisait le cut autour de
> l'œil mais tu l'as supprimé »*

### The box: where a lid is drawn

A lid is the eye's own shape squashed to a band on the rim it swings from, and
scaled about that rim:

```text
   scaleY 1          scaleY meet/2       scaleY meet
   ╭─────╮           ╭─────╮            ╭─────╮
   │ ⬤   │           ├─────┤            │█████│
   ╰─────╯           ╰─────╯            ╰─────╯
    open             half                shut
```

Drawn there it is inside the eye at rest and inside it shut — never parked
outside, never counted into a box three times too big. **The eye's bounding box
is the eye**, so the selection handles land on it and a resize drags the eye.

### The cut: what does the cutting

The clip is still needed, and deleting it was wrong. Scaling a shape in `y`
alone keeps its full width, and an ellipse is only that wide across its middle:
at a quarter shut the lid hung past the outline on both sides, which is exactly
what an author sees as *les paupières dépassent des yeux*.

What changed is **what cuts**:

```html
<ellipse id="eyeWhiteLeft" data-name="Left eye socket" … />
<clipPath id="eyeSocketLeft"><use href="#eyeWhiteLeft" /></clipPath>
<g id="lidsLeft" data-name="Left eyelids" clip-path="url(#eyeSocketLeft)"> … </g>
```

A `<use>`, not a second ellipse — and that is the whole point. A copy could
drift from the white, and an author who resized one would have moved a cut that
no longer matched anything. A reference cannot drift: the shape in the layer
tree **is** the shape that cuts, carrying its own transform, so moving or
resizing the socket moves and resizes the cut with it. What you see is what
cuts, and there is nothing left that an author cannot find. The menu on the
artwork already names what is cutting a piece, and the name it gives is now a
drawing you can go and press.

The cut sits on a **wrapper group**, never on the lids themselves. `clip-path`
is resolved in the user space an element establishes, which is the space *after*
its own `transform`: put it on a lid and the lid's `scaleY` stretches its own
socket eight times over and it stops cutting at exactly the moment it is needed.
Measured — it is why the first attempt drew an hourglass.

### And the corners, which is why a lid is not eye-shaped

A shut eye has to be shut, including the two corners where the eye is widest.
Two edges that bulge towards each other meet in the middle and leave a white
wedge at each end, and no arrangement of bulges fixes it: near the corner an
ellipse's own edge is *above* its widest point. The corners close only when the
two edges land on **one curve**.

So a lid is drawn by where its edge has to arrive:

```text
   end    the eye's widest point, (cx ± rx, cy) — both lids, so the two edges
          meet there and the corner has no area left to show
   mid    the seam, a shade below the middle — the upper lid reaching a little
          further than the lower, which is what a blink looks like
```

divided by the factor that lid grows by. What gets drawn is a band a couple of
units deep hanging off the rim whose ends and middle are a tenth of a unit
apart; one `scaleY` multiplies both, so the ends arrive on the corners and the
middle on the seam in the same move. The shape is a flat run along the rim, two
vertical sides, and the edge — the first three outside the socket, cut away, so
the only edge that ever shows is the one facing the pupil.

That is also what lets a lid carry its **own line**. A closed shape stroked all
the way round draws every edge it has, which is why this used to need a separate
crease path; here the other three edges are cut away, so the only stroke that
survives is the leading one. One shape, one line, and they cannot drift apart.

The binding is the usual `amplitude · control + offset`, and `eyeOpen` rests at
1, so a lid that must read 1 open and `meet` shut is `-(meet - 1) · eyeOpen +
meet`. Both lids travel nearly the whole way: a lower lid that stopped a third
of the way up would leave the bottom half of the eye white. What reads as "a
blink is mostly the upper lid" is the seam sitting below the middle, which is
where the drawing already puts it.

### The pivot is part of the asset format now

An install measures each piece of a fragment and pivots it at its own middle,
which is right for everything that rotates or slides and wrong for the one thing
that *grows*. So a driver hint may name a pivot in words:

```js
lidUpper: { property: 'scaleY', amplitude: -reach, offset: 1 + reach, pivot: 'top' }
```

`DRIVER_PIVOTS` is `['top', 'bottom', 'left', 'right', 'centre']` — words rather
than coordinates, because the asset does not know where the install will put its
drawing; the fit may move and scale the whole fragment. The installer resolves
the word against the piece's own measured box *after* the fit
(`pivotWords` → `anchor` in `face-part-install.js`).

`scaleY` also joined the eyelids' `eyeOpen` strategies in the registry, so the
*How should it move?* dropdown can see the method the shipped lids use.

## A shut eye has styles, and they are controls

A shut eye is a **seam**, and which seam is the character:

| Style | `eyeCurve` | |
| --- | --- | --- |
| Seam | `0` | one straight line where the lids meet |
| Happy | `1` | both lids arc upwards — the classic smiling eye |
| Tired | `-1` | the seam droops at the outer corner |
| Lashes | `0.35` | a heavier seam, with a lash at the outer corner |

Those are not four more drawings. They are one control at a value, which is why
they can be animated, keyed and blended (docs/FACE_SVG_STATES.md), and why
`eyes.animal-sleepy` and `eyes.animal-happy` did not need replacing: sleepy is
`eyeOpen` partway and happy is `eyeOpen 0` with `eyeCurve` up. Six drawings of
expressions became two controls and four names (`CLOSED_EYE_STYLES`).

The seam is the **template's** line, not a library card's: a card can only drive
the elements its roles name, and there is no role for a seam, while the template
has the shape keys that bend it. A card's eye closes as skin under its own
outline, which is how most cartoon eyes close.

## What did not move

**The head turn.** `eyes.simple` and `eyes.iris` sign exactly the word
`eyes.round-large` signed — `139:620f5cafd8c98fa2`
(`tests/fixtures/head-turn-baseline.js`). A turn is generated from roles and
profiles, never from path data, so rebuilding an eye out of an ellipse scaled
about its rim instead of a path parked outside a mask is a drawing change and not
a look change. Had it re-proportioned one sample, that fixture would say so.

`eyes.dot` is its own word (`111:32375159a1d6d404`): twenty-eight fewer channels,
which is the four elements it does not draw, twice over for two eyes.

## Two things this fixed on its way past

**A blink that erased the eye.** With lids doing the closing, the obvious move is
to give the `eyes` part no driver of its own and let the lids carry `eyeOpen`. A
part that claims a control and leaves the driver out gets the registry's own
(`scaleY`, amplitude 1, offset 0), which reads 1 open and **0** shut: the eye
group scaled to nothing, and the pupil, the iris and both lids inside it with it.
Every child's CTM had a vertical scale of zero — an eye that vanished rather than
closed. The unit suite could not see it (the binding was exactly what the asset
asked for); a browser measuring the painted box could. The builds carry the
shipped sets' own gentle squash instead: `amplitude 0.12, offset 0.88`, so 1 open
and 0.88 shut, which is what a real eye does under a closing lid.


**A stale driver.** `refreshControls` re-enabled a control without dropping the
driver it *used* to write. A lid installed as a `translateY` and re-installed as a `scaleY` kept
both, and blinked by sliding and growing at once. `cleanupOwnedDriver` already
knew how to find every binding a part's control owns — it is exported now, and
the install calls it before re-enabling.

## Where things are

```text
core/face/eye-build.js                geometry, markup and drivers, shared
                                      eyeLidPath · eyeSocketClip · eyeLidsGroup
core/face-library/builtin/eyes.js     the three cards
core/sample/templates/
  face-artwork.js                     the template's lids, creases and seam
  template-export.js                  a shape that only cuts is not a layer
  template-project.js                 the scale, the pivots, the rim's fade
svg-editor/svg-canvas.js              inside(): a group is draggable by its children
svg-editor/transform-gizmo.js         a body press is claimed on the first move
rig-editor/semantic-parts/
  part-registry.js                    gaze grew leftIris/rightIris; scaleY is a lid strategy
  part-model.js                       cleanupOwnedDriver exported
core/face-library/
  face-part-model.js                  PALETTE_TOKENS + iris; DRIVER_PIVOTS
  face-part-install.js                pivotWords → anchor; the stale-driver fix
  palette-model.js                    the iris token's label and seed
  face-presets.js                     twenty-two recipes migrated; 21 palettes + iris
```

## The template's own eyes

The library's cards were half of it. The **default mascot** — what every author
opens the editor on — had the same socket, and the numbers were the ones the
complaint described:

| | Before | After |
| --- | --- | --- |
| The eye as drawn | 100 × 94 px | 100 × 94 px |
| The eye group's **box** | 191 × 281 px | **100 × 94 px** |
| The shape that cuts, in the layer tree | absent | **Left eye socket** |
| Press the middle of the box and drag | nothing moves | the eye moves |

The lids are bands on the rim, scaled about it, exactly as the cards' are —
but written as **paths**, because the template's lids carry the `eyeSquint` and
`eyeCurve` shape keys the closed-eye styles are made of, and a shape key needs a
path. Four cubics round a squashed ellipse; the half facing the pupil is the
leading edge, and that is where both poses act.

Three details the growing construction needed:

- **The lid is a hairline at rest** (`slice: 0.05`, about two units tall). Drawn
  any deeper its edge is a line across the white — and a hairline is also what
  makes half a blink cover half the eye, because the edge starts *at* the rim and
  travels linearly to the seam. Drawn a fifth of the eye deep, half a blink was
  two thirds.
- **The lid carries no outline.** A closed shape stroked all the way round draws
  its rim half too, and the rim half of a sliver sits inside the eye at the
  corners — so each lid read as a lens-shaped ring lying across the eye. The line
  is its own path instead (`creaseUpperLeft` and its three companions), sharing
  its lid's pivot, its `scaleY` and its shape keys, with `non-scaling-stroke` so
  a 3-unit crease does not arrive as a 10-unit band. It cannot drift from the
  lid, because it *is* the lid's edge — one piece of arithmetic read twice
  (`leadingEdge`).
- **The eye's outline goes out with the light.** A shut cartoon eye is a line,
  not a circle with a line through it. `rim` fades on `eyeOpen`, on an `easeOut`
  curve so the outline holds through most of the blink and only lets go at the
  end.

Both lids grow to the **seam** rather than across the whole eye — `LID_MEET`,
which lands each leading edge on the line a shade below the middle where a lash
line sits. That is the template's own closed-eye vocabulary kept exactly: two
lids that meet on one line, which `eyeCurve` bends into the happy `^ ^` and the
tired droop. The two arcs are matched (the lower lid's is divided by its own
smaller scale) so a shut eye is one line and not two a unit apart.

### Two more things this turned up

**A group you could select and never drag.** The piece model that answers "is
this shape inside the selected piece" is installed on Hands alone, so on Artwork
`canDragBody` refused every press on a child — and a group is covered by its own
children, so there was no point on it that was not on one of them. An eye an
author could select and never move, which is the second half of what they
reported. `inside()` reads the containment off the DOM the pointer just hit, and
the gizmo claims a **body** press only on the first `pointermove`: claiming it on
`pointerdown` killed the click two ways over — `preventDefault` suppresses the
compatibility mouse events, and `setPointerCapture` redirects the ones that
survive — so a click could no longer reach the shape under the pointer. Now a
click selects the shape and a drag moves the group.

**Catchlights that stayed behind.** `lookX 1` slid the pupil eight units and left
both highlights where they were, so a mascot looking sideways had its glint on
the white beside its pupil. They are siblings of the pupil rather than children
of it, and they take its own bindings now.
