# Mascot design — the face and the hands

The brief this answers is a design audit of Boop's own artwork, and its verdict
is worth quoting because it is the right one:

> *"Le moteur actuel de pseudo-3D est déjà exploitable ; le principal problème
> vient surtout du design du visage lui-même et de la manière dont les formes
> sont construites."*

That matches what `docs/PSEUDO_3D_BASELINE.md` had already measured from the
other side. Every mechanism the roadmap asked for exists — the projector, the
depth bands, outlines in head-pose cells — and the last item, 3D-07, closed with
**"What is left is a drawing, not a mechanism."** This is that drawing, and the
rules it was drawn to.

---

## 1. The rule everything else follows: it has to work with no shading

Before any shadow, gradient, blush or highlight, the three views —
**left / front / right** — have to read as one character seen from three angles.
Strip the colour and the light and the mascot must still turn.

The old face failed this test in one specific way, and it is worth naming
precisely, because it explains almost every other change here: **the head was a
circle** (`cx 120, cy 120, r 100`). A circle compressed horizontally is an
ellipse. It is never a turned head. So there was nothing in the silhouette that
could say which way the face pointed, and the job of saying so fell to two
half-opaque slabs down the cheeks — light standing in for geometry, which is
what made the drawing look heavy and the turn look like a slide.

The test is now runnable, not just stated. `mascot-design.test.js` is this
document as assertions — one test per criterion of the brief, each measuring the
property the criterion is about rather than the drawing that happens to satisfy
it today. *"The three views work with the light switched off"* sets both cheek
shades to nothing and asks the head's own outline what it looks like at each of
the three positions.

## 2. Silhouette first

A mascot is read as a silhouette: small, in one colour, at a glance. So the
stroke hierarchy is now an actual hierarchy, heaviest outward:

| | Before | Now |
| --- | ---: | ---: |
| head outline | 4 | **6.5** |
| eyebrows | 8 | 5 |
| mouth | 6 | 5 |
| ears | 4 | 4.5 |
| eye outline | 6 | 3.4 |
| nose | 4.5 | 2.8 |
| eyelids | 3 / 2.5 | 2.6 / 2.4 |

The old drawing's heaviest line was an *eyebrow*, and its silhouette was the
lightest thing in it. Everything drawn on the face is now lighter than the face.

## 3. Drawn as functions, because the rig needs poses and not a picture

Every outline in `face-artwork.js` is generated: `headPath({ jaw, turn })`,
`nosePath({ turn })`, `mouthGeometry({ open, smile, turn })`, `hairTopPath({ turn })`.

This is not tidiness. A shape key is a **per-point delta**, so two poses of one
shape are only interchangeable when their paths have the same commands in the
same order (`docs/SHAPE_KEYS.md`). Typed out by hand that is a promise nobody
can keep; generated from one function it holds by construction — exactly the
argument `hand-artwork.js` already made for the hand poses. The curves are
Catmull-Rom through a list of knots, so the command list depends only on how
many knots there are.

It is what makes §5 possible at all.

## 4. The face, part by part

### 4.1 The head

Seven knots for the right half, mirrored for the left: crown, temple, widest
point, cheekbone, jaw, chin corner, chin. Broad cranium, cheekbones, a jaw that
draws in, a soft chin — a head, rather than a disc.

Each knot also carries what a turn does to it, in two variants: `far` for when
it is on the half going away, `near` for the half coming forward. Because both
are written in the right-hand frame and mirrored, **turning left is turning
right reflected, exactly** — not tuned twice.

The numbers say what a three-quarter view does:

| knot | far (at a full turn) | near |
| --- | ---: | ---: |
| temple | −10 | +6 |
| widest point | −1 | +1 |
| cheekbone | −14 | +2 |
| jaw | −14 | +4 |
| chin corner | −13 | −10 |
| crown / chin | −4 / +14 along the turn | |

The cranium's widest points barely move — a skull is nearly round in plan, and
its silhouette survives a turn — while the cheek, jaw and chin swing a long way
and the chin follows the nose. So the outline carries the rotation **without the
head appearing to shrink**: the shape changes, the width does not. That also
keeps the head's own screen travel small, which is the property `ux24` asserts
("a turn is not a translation").

The jaw is the same outline stretched below the middle line, as before.

### 4.2 The eyes

Almonds, and each the mirror of the other rather than the same drawing twice.
Two identical ellipses read as two discs stuck on a face however far the rig
displaces them, because a disc looks the same from every angle. An almond has a
near corner and a far corner, so foreshortening it actually shows.

The socket clip is the same almond at 1.12×, which keeps the eye's outline
unclipped while still hiding whatever the lids push past the edge.

The near/far behaviour is the rig's, and one constant moved with this work:
`NEAR_WIDEN` **0.12 → 0.24**. At 0.12 the near eye ended at 0.97 of its resting
width once the head's own cosine was applied — it did not come *towards* the
viewer at all, which the baseline listed as an open gap ("`nearEyeWidth` should
exceed 1"). At 0.24 it reaches 1.07. `NEAR_EAR_WIDEN` moved 0.2 → 0.3 for the
same reason.

### 4.3 The nose

The old nose was a single stroked curve — the least a nose can be, and far too
little to carry a turn: the head rotated and the one landmark that should have
said so kept its shape.

It is now a closed, filled wedge with a bridge, a ridge, two wings and a tip:
still minimal, but each part moves differently under `turn`. The bridge lags
(it is the least protruding part of a nose, so it swings least), the wing coming
towards the viewer flares, the wing going away tucks in behind the ridge. That
is the yaw cue, and it is a shape rather than a slide.

### 4.4 The mouth

One closed path, unchanged in principle and kept deliberately: the fill is the
inside of the mouth and the stroke is the lips, so there is no seam between a
lip line and a cavity that deform under different systems.

What is new is `turn`. The corner going away draws in towards the middle while
the near one stays out, and the middle of the lip line — which follows the nose
— travels further than either corner. At a full turn the near half of the mouth
is 41 units long and the far half 23. The two corners move together, so the
mouth's *width* is left to the rig's own foreshortening and the shape key is
purely the asymmetry.

The teeth and the tongue are still drawn from the mouth's own curves, and `turn`
reaches them through the same geometry — so a turned mouth takes what is behind
it with it, instead of leaving it floating.

### 4.5 Light

One narrow crescent down each cheek, tapering to nothing at both ends, at
**0.22** base opacity (it was 0.5) and faded to near-invisible at rest by its
`headX` binding. It supports the turn; it no longer has to invent it.

It is also drawn a clear seventeen units inside the outline. The shading does
not follow the turned silhouette, and the far cheek comes in by fourteen units
at a full turn — a band drawn on the edge would hang outside the face there.

### 4.6 Ears and hair

The ears are simple rounded shapes with one fold, at the cheekbone. What makes
them read on a turn is the rig, which already had the whole trick: the near one
widens, the far one narrows, fades and is repainted **behind** the head (3D-08).

The hair is three masses in three tones, all built from the head's own knots —
so the crown follows a turn for free rather than being a shape that happens to
sit near a skull. The hairline is off-centre on purpose: a parting a third of
the way across is the cheapest asymmetry available, and asymmetry is what stops
a three-quarter view reading as a squashed front view.

The fringe is drawn well inside the silhouette on both sides (worst clearance
7 units at a full turn, on top of the head clip), which is what lets it skip a
turned outline of its own.

## 5. The turn is in the artwork now, not only in the transform

Six outlines are captured into the head-pose grid, at `headX = ±1`:

```
head · hairTop · nose · mouth · teeth · tongue
```

Each is an ordinary additive shape key weighted by an ordinary `pathShape`
keyform — 3D-06's mechanism, with no new concept and nothing head-pose-specific
in the runtime. Two captures, not eighteen: a lone sample holds across the axis
it was not captured on (`docs/KEYFORM_ENGINE.md`), so one capture at "turned
right, level" weights the whole right-hand column, and 3D-06's rest anchor pins
zero at the centre.

Two layer depths moved with it, and both are geometry rather than taste:

* **`hairTop: 0.2 → 0`.** The crown is the top of the skull and sits on the axis
  of the turn. It should ride the outline exactly; what it does on a turn is
  change shape, which is now an outline and not a displacement.
* **`hairBack: 0.1 → −0.4`.** The mass behind the head is the one part of a
  mascot that is genuinely *behind* the axis. Saying so is worth more than any
  amount of shading: it swings the opposite way from the face, so the back of
  the head comes round as the nose goes away, and the negative depth also drops
  it into the `behind` band.

**Regenerating the turn from the panel does not rewrite these.** The generator
displaces and foreshortens measured parts; it cannot invent what a particular
face looks like from three-quarters. Press *Generate turn* after *Reset all* and
you get the movement back without the outlines, which is the correct behaviour
for imported artwork and is what an author gets on any drawing that is not this
one.

## 6. The hands

Same brief, same rules: read at a glance, deform simply, turn by silhouette.

The hand was already close — one generated path, four digits, poses as shape
keys off one function. Four things changed.

* **Conical fingers.** Parallel-sided fingers read as pipes; a pipe with a domed
  end reads as a glove. The tip is now 0.84 of the knuckle.
* **A palm with a heel.** The wrist is narrower than the knuckles and the heel
  curves into the thumb instead of turning a corner — the difference between a
  hand and a mitten.
* **A thumb that is unmistakably a thumb**: thicker than the fingers (8 against
  6.4) and shorter. *"Une main dont le pouce est mal défini paraît immédiatement
  plate ou cassée."*
* **`turn`** — a yaw about the hand's own axis, doing to a hand exactly what the
  head turn does to a face. The half going away compresses (palm edge, digit
  spacing, digit width), the half coming forward eases out, and the landmark
  that sticks out of the plane swings. On a hand that landmark is the thumb, so
  it gets numbers of its own: towards the viewer it opens away from the palm and
  keeps its length; away from the viewer it folds across the palm and loses a
  third of it.

`turn` is exposed as a signed parameter per hand (`handLTurn`, `handRTurn`) with
one shape key each way — the same shape as the mouth's smile and frown, and for
the same reason: two additive keys on one control reproduce every value between
them exactly. It has a canvas handle of its own, because *rotation* (where the
hand points), *flip* (which face you see) and *turn* (which way it faces between
the two) are three different things and an author needs all three.

One pose was added: **Present**, an open palm barely closed. It is on the
brief's priority list and the pose set had no answer for it — a hand that
presents is not a fist, not a wave and not a point.

### What the hand deliberately does not do

The brief asks for the hand to be split into palm / thumb / index / finger
group / wrist as separate layers. It is one path, on purpose, and that is the
tradeoff that buys everything else: a pose is then **one shape key** whose
topology cannot disagree with the rest shape, and every pose, every digit curl,
the grip, the flip and the turn all compose additively on one outline. Splitting
it would mean five shapes to keep in register through every pose, which is the
class of bug the mouth's single closed path exists to avoid
(`docs/SHAPE_KEYS.md`). The masses the brief asks for are there in the geometry
(`HAND_PALM`, `HAND_DIGITS`) and each digit already has its own control.

## 7. Where to look at it

The brief asks for a model sheet — left / front / right, a slight up and down,
a handful of expressions, a handful of hand poses. All of those exist in the
editor rather than as a picture, which is the point of building them into the
rig:

| View | Where |
| --- | --- |
| left · front · right · up · down, and the four corners | Face Setup → **Head pose**, the nine cells of the grid, or the XY pad |
| neutral · happy · sad · surprised · lightly cross | Expressions, and the preset catalogue behind it |
| hand poses | Face Setup → **Hands** → the pose chips (Fist, Point, Peace, Thumbs Up, Spread, Relax, Present), plus **Facing** on the canvas |
| the whole thing moving | Preview |

Everything on that list is a live pose of one rig, not a drawing of one. That
is the difference this redesign is for.

## 8. What the brief asked for, and where it landed

| Asked | Where |
| --- | --- |
| Drop the circular head, give it a real profile | §4.1 — `HEAD_PROFILE`, seven knots |
| Eyes that are not two identical ellipses | §4.2 — mirrored almonds |
| The near eye should come forward | §4.2 — `NEAR_WIDEN` 0.12 → 0.24 |
| A nose that carries the yaw, with left / front / right | §4.3 — `nosePath({ turn })` |
| Keep the mouth one closed shape; make it turn | §4.4 |
| Cut the lateral shadows right back | §4.5 — 0.5 → 0.22, narrow, tapered, faded at rest |
| Put the head outline back at the top of the hierarchy | §2 |
| Ears and hair that carry the volume | §4.6 |
| Shapes that genuinely turn, not just move | §5 — six outlines in the grid |
| Hands: simplified mascot style, distinct thumb, readable poses | §6 |
| A hand turn that reads by silhouette, not by translation | §6 — `HAND_TURN` |
| Separate, riggable layers | already the structure; §6 records the one exception |

Two items are deliberately not done, and both are content rather than mechanism:

* **Three alternative face proposals.** The project ships one template on
  purpose — *"three starter faces meant three sets of artwork to keep rigged"*
  (`templates/index.js`). The parametric construction is what makes a variant
  cheap now; adding two more rigged faces is a separate decision about what the
  library holds, not a design fix.
* **Up / down turned outlines.** The grid can hold them at `headY = ±1` the same
  way, and the pitch already reads through the outline and the parallax. Worth
  drawing when someone wants it; not needed for the acceptance criteria, which
  are all about left / front / right.
