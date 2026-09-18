# Eyes: three builds, no hidden socket

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

## No socket, and why that was the same problem

Every eye in the library was clipped to a `<clipPath>` living in `<defs>`, with
its lids drawn open and **parked outside** that clip. Measured on screen:

| | |
| --- | --- |
| The eye as drawn | 114 × 107 px |
| The eye's **bounding box** | 219 × 321 px |

The clip appeared in neither the layer tree nor `document.elements`, so an author
could not see it, move it, resize it or delete it. And because the parked lids
are real geometry, the selection handles sat a hundred pixels away from the eye
on every side: resizing one meant dragging a box three times too big whose
contents were cropped by a mask that was not there. That is complaint four,
exactly.

A lid here is the **eye's own ellipse, scaled about the rim it sits on**:

```text
   scaleY 1          scaleY cover/2      scaleY cover
   ╭─────╮           ╭─────╮            ╭─────╮
   │ ⬤   │           ├─────┤            │█████│
   ╰─────╯           ╰─────╯            ╰─────╯
    open             half                shut
```

Scaling an ellipse about its top point gives another ellipse sitting on that
edge, so the lid's leading edge is a curve at every opening and lands exactly on
the far rim at `cover = ry / lidRy`. Nothing is ever outside the eye, so nothing
needs clipping, and **the eye's bounding box is the eye**. One pivot instead of
one hidden mask.

The binding is the usual `amplitude · control + offset`, and `eyeOpen` rests at
1, so a lid that must read 1 open and `cover` shut is `-(cover - 1) · eyeOpen +
cover`. The lower lid comes up a third as far, because a real blink is the upper
lid — two lids meeting in the middle is what a *squint* looks like, and getting
that asymmetry right is the difference between sleepy and suspicious.

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
core/face-library/builtin/eyes.js     the three cards
rig-editor/semantic-parts/
  part-registry.js                    gaze grew leftIris/rightIris; scaleY is a lid strategy
  part-model.js                       cleanupOwnedDriver exported
core/face-library/
  face-part-model.js                  PALETTE_TOKENS + iris; DRIVER_PIVOTS
  face-part-install.js                pivotWords → anchor; the stale-driver fix
  palette-model.js                    the iris token's label and seed
  face-presets.js                     twenty-two recipes migrated; 21 palettes + iris
```

## Still to do

The **template's own eyes** (`core/sample/templates/face-artwork.js`) still draw
`<clipPath id="eyeSocketLeft">` with their lids parked outside it, so the default
mascot keeps the box an author cannot grab. They are the harder half, because the
template's lids also carry the `eyeSquint` and `eyeCurve` shape keys that the
closed-eye styles are made of, and a shape key needs a path.
