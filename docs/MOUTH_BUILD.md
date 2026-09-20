# The mouth: one card, every state

> *« pour la bouche on doit utiliser un systeme similaire avec 1 preset complet
> qui gere tout les etat de la bouche ( voyelle, sourir, langue dents etc) … on
> va retirer tout les preset existant pour y ajouter un preset proprement fini »*

## The five, and what they could not do

```text
mouth.simple      one stroked curve                       open · smile · width
mouth.wide        a filled lens with teeth                open · smile · width · teeth
mouth.small       a shorter stroked curve                 open · smile · width
mouth.cartoon     a filled grin with teeth and a tongue   open · smile · width · teeth · tongue
mouth.expressive  a filled lens with a lip line           open · smile · width
```

What told them apart was **a radius, a fill, and whether the teeth were drawn** —
which is a size, a palette and a movement. And **not one of them could speak**:

| | |
| --- | --- |
| Mouths in the library | 20 |
| Mouths claiming `mouthRound` | **0** |

`mouthRound` is the control the visemes turn on. The difference between AE and
OO is the aperture *puckering* — the corners coming in while the lip line bows
out above and below them — and narrowing a lens is not rounding it
(docs/VISEME_SYSTEM.md). Five drawings of a curve, and no vowels between them.

They could not claim it, either. `mouthRound` is **shaped** rather than
transformed (`strategies: { mouthRound: ['shapeKey'] }`), a shaped movement needs
the asset to ship the shape it deforms to, and the installer only knew how to
build one **for a jaw**. A card that claimed it got a slider that moved nothing.

## The one

`mouth.full`, built from `core/face/mouth-build.js` — the construction the
template has always drawn with, moved out so a card and the sample are the *same*
mouth, exactly as the three eye builds and the template's eyes are the same eye
(docs/EYE_BUILDS.md).

**Four points and one closed path.** The corners, the upper lip's control point
and the lower lip's, moved by four numbers:

```text
   closed              open              smiling            rounded
 ╭────────╮         ╭────────╮         ╭────────╮         ╭──────╮
 ╰────────╯         │  ▁▁▁▁  │         ╰──────╯           │  ▁▁  │
                    │  ▔▔▔▔  │          ╰────╯            │  ▔▔  │
                    ╰────────╯                            ╰──────╯
  mouthOpen 0        mouthOpen 1         smile 1          mouthRound 1
```

| Movement | How |
| --- | --- |
| `mouthOpen` | a **shape key** — the lower lip drops and the aperture opens |
| `smile` | a **shape key** — the corners lift *and* the lip line deepens |
| `mouthWidth` | `scaleX` |
| `mouthRound` | a **shape key** per lip, from the card's own `posePath` |
| `mouthSkew` | a **shape key** — the lean (V6) |
| `teeth` | a **shape key**, `mouthOpen * teeth` — two rows hung clear of their lips |
| `tongue` | a **shape key**, `mouthOpen * tongue` — the body, inside the cavity |

Six of the seven are **shaped**, and the one that is not is the one a transform
says honestly: a wider mouth really is this mouth, wider. That is not how it was
built first. `mouthOpen` as a `scaleY` and `smile` as a `translateY` read right
in the registry and measured wrong on the drawing — `scaleY 2` doubles a lens
eleven pixels tall, where `mouthPath({ open: 1 })` drops the lower lip
**sixty-two units** — so a band drawn at the geometry's fully-open lip reached a
third of the way down the chin while the lips had only doubled. Shaped, the lips
and everything drawn from them are the same arithmetic over the same four points,
and they agree by construction instead of by two numbers kept in step.

Nine states, measured on the drawing: closed, open, smile, frown, AE, OO, EE with
teeth, tongue out, and a toothy grin. OO is narrower **and taller for its width**
than the rest — the check the unit suite makes, because "smaller" is all a
`scaleX` could ever have given.

### Everything inside is drawn from the lips

Six shapes, and five of them are **empty until they are asked for**:

```text
mouth        the lips, and the cavity: one closed path, fill inside, stroke lips
teeth        the upper row, its biting edge scalloped into crowns
teethLower   the lower row, the same band from the lower lip, shallower
tongue       the body: two lobes with the groove between them
tongueTip    the lobe that laps **over** the lower lip
tongueGroove the crease down the middle of that lobe
```

Each of the five is a closed path whose second half retraces its first — the
same points, the same control points, in reverse — whenever its own number is 0.
The shape encloses nothing and paints nothing. So a closed mouth has nothing
behind it to hide, by construction rather than by arithmetic, which is what lets
each be drawn from the lip it sits behind rather than being a second mouth with
a cavity of its own.

Being empty is also why they **grow** rather than fade. An opacity movement is
right for a card that draws a finished row of teeth and hides it; a shape that
encloses nothing paints nothing at *any* opacity. None carries `opacity="0"`
either — a frame's opacity is the drawn one **multiplied** by the binding's, so
a shape drawn at 0 could never be brought out at all.

### The one rule the whole file obeys

**Every point is affine in every pose number, separately.** A band's anchors
come from the lip curve, which is affine in `open`, `smile`, `arc`, `round` and
`skew`; its offsets are constants times `show`, `out` or `curl`. There is no
cross-term anywhere.

That is what lets the rig drive each number with its own additive shape key and
have the sum be *exactly* the drawing rather than an approximation of it
(docs/SHAPE_KEYS.md). It is also why `BAND_REACH` is a constant and not this
mouth's own height: derived from the pose it would make every offset a product
of `open` and `show`, and a product is not the sum of its ends — a tongue at half
`tongue` on a wide open mouth came out half-sized *and* halfway up the cavity,
floating clear of the lip it grows from.

`core/tests/mouth-build.test.js` holds all three properties — empty, affine, one
topology — for every shape at every pose.

### Under the lip, and out of the mouth

Two things the bands got wrong early, and they were opposite mistakes.

The **teeth** hung from the upper lip with their ends *on* it. The lip's outline
is 3.8 units wide and centred on the path, so a row of teeth drawn from it
painted over the inner half of the stroke and the upper lip went missing where
they were. They hang `clear` of it now — ends and all — which is a multiple of
`show` and nothing else, so the shape is still exactly empty at rest and the one
shape key still interpolates it linearly. That also means the clearance is
*proportional to the opening*: a barely-open mouth shows barely any teeth, just
under the lip, and only a mouth that is really open clears the whole stroke.

The **tongue** was the same kind of band, and that was the wrong shape for it: a
small hump on the floor of the mouth that never came out of it.

## V6: the teeth, the tongue, and the lean

> *« améliorer fortement la bouche SVG pour obtenir un rendu plus propre et plus
> crédible sur : sourire, grimace, bouche ouverte, dents visibles, langue
> visible, langue tirée vers l'extérieur »*

### The rows are crowns, not a slab

A single arc back along the lip draws a white band with a curved bottom: at any
size it reads as a bar of light behind the lips rather than as teeth, which is
why every cartoon mouth ever drawn puts *some* division in it.

So the biting edge is **scalloped**, one quadratic per crown:

```text
     ╭──────────────────╮        the gum edge, tucked just inside the lip
     ╰─╮╭─╮╭─╮╭─╮╭─╮╭──╯         four crowns, tapering away before the corners
```

Four is the fewest that reads as a row and the most that survives being sixty
pixels wide on a page — the brief's *« simple, lisible, cartoon propre »*, and
the reason there is no attempt to draw an individual tooth with an individual
outline. A crown is one quadratic through three points of the lip: its middle
pushed to the full depth, its ends to `valley` of it. The envelope over the top
of that (`crownEnvelope`) tapers the row away before the corners, the way a row
of upper teeth does and a slab does not.

At `depth`, `tuck` and `lift` all 0 the gum edge is the exact sub-arc of the lip,
and each crown is the exact sub-arc of *that* — a quadratic restricted to a
sub-interval is a quadratic, and `through` builds the one that passes through the
lip's own point at the middle of it. So the biting edge retraces the gum edge
exactly and the row is empty, whatever the lips are doing underneath.

**`teethLower`** exists for one reason: a wide open mouth with teeth only along
its top is a face with a hole under its nose. It is shorter and shallower, and
where the rig installs it, it arrives **later** — `mouthOpen * mouthOpen * teeth`,
so a mouth barely parted shows its top row and nothing else. A lower row that
came up with the upper one read as a grimace at every small opening. That costs a
word in a sentence rather than a mechanism, because a driver hint may carry an
expression per role (`hint.roles.teethLower.expression`).

### The tongue is three shapes, because it does three things in three places

```text
         ╭──╮╭──╮          tongue        the body: two lobes and the groove
  ───────┤   ┊    ├──────  the lower lip, where all three are anchored
          ╲__┊_╱           tongueTip     the lobe that laps over it
             ┊             tongueGroove  the crease down the middle of that lobe
```

A tongue that is out is *in front of the lower lip*, and a tongue that is in is
*behind* it. One element cannot be both, and the one that used to try was drawn
in front of the lips always — which is why it had to be kept narrow enough never
to reach a corner.

Split, the **body** is drawn inside the aperture and clipped to it, so nothing it
is asked to do can push it through a lip; the **tip** is drawn in front of
everything, because that is where a tongue hanging out belongs (§8.4 of the
brief).

**The groove, inside the mouth.** V5 drew the back as one arch, on purpose: a
single cubic with a node in its middle pulled up on both sides of it and came
out as a butterfly. One arch has one peak, and one peak is a hill rather than a
tongue. Two arches — a lobe per half, meeting at a node that stops short of
their peaks — have two peaks and a groove between them, which is what a tongue
looks like and what the butterfly was reaching for. It costs nothing at the rig:
the same shape key, two segments longer.

The underside uses the back's own control *parameters in reverse*, which is what
makes the body exactly empty when every offset is 0.

**The groove, out of it.** Inside the cavity the groove is the *silhouette*
between the two lobes and needs no ink. On a tongue lapping over the lip there
is no silhouette to read it from: the tip is seen from above, so the crease down
the middle of it has to be drawn, or the tongue is a flat paddle. `tongueGroove`
is that line — a narrow lens, in the cavity's own colour at three tenths, along
the axis of the tip — and it is a **role of its own** rather than ink on the
tip's path, for the same reason the tip is a shape of its own: one element is
one fill, and a crease is a second one *on top of* the shape it is a crease in.

Being a role is also what makes it move. It is bound where the tip is bound and
poses where the tip poses — `mouthOpen`, `smile`, `mouthRound`, `mouthSkew` from
the mouth; `tongueX`, `tongueY`, `tongueOut`, `tongueCurl` from the tongue — so
it goes where the tip goes and lengthens as the tip reaches, instead of being a
mark left behind on the chin the moment anything moved. It is empty at rest like
the rest of them, and more bluntly so: `tongueGroove-rest` is a single point
repeated, so a face that never puts its tongue out draws exactly nothing for it.

Its width is a constant times `out` rather than a fraction of the tip's own
width — the affine rule, again. A crease that narrowed with the pucker would be
a product of `round` and `out`, and no pair of additive keys can carry a product.
What it does follow is the lip: puckering takes the tip down and the crease goes
with it, because both are measured from the same lower lip.

### `tongueOut` and `tongueCurl` are shapes now

They were a `scaleY` about the tongue's middle and a `rotation` of the whole
drawing. Neither is what the word means, and both were visible the moment the
tongue was drawn as anything more than a hump:

| | was | is |
| --- | --- | --- |
| `tongueOut` | `scaleY` — stretches the root as far as the tip, and grows the tongue *up into the skull* as readily as out of the mouth | a shape: the tip extends past the lip, the body reaches forward behind it |
| `tongueCurl` | `rotation` — swings the root out through a cheek | a shape: the **middle** of the free edge lifts, the shoulders barely, the lobe draws in |
| `tongueX` / `tongueY` | `translateX` / `translateY` | unchanged — a tongue that moves sideways really does move sideways |

The shoulders matter as much as the middle. Lifting the whole free edge by one
number is not a curl, it is the tongue going back in: at `tongueCurl 1` there was
nothing left lapping over the lip. Lifting the middle and holding the sides turns
the end up and leaves the tongue as long as it was — and, signed, the same key
droops it.

Both keep the old transform in `strategies`, so a project rigged that way can be
switched back to it, and a document that carries one goes on carrying it: a
stored binding is the document's, not the registry's.

### The tip comes out of a mouth that need not be open

```text
tongueTip-out      tongueTipPath({ out: 1 })      tongue * tongueOut
tongueGroove-out   tongueGroovePath({ out: 1 })   tongue * tongueOut
tongue-out         tonguePath({ out: 1 })         mouthOpen * tongue * tongueOut
tongueTip-curl     tongueTipPath({ curl: 1 })     tongue * tongueOut * tongueCurl
tongueGroove-curl  tongueGroovePath({ curl: 1 })  tongue * tongueOut * tongueCurl
```

`tongue * tongueOut` and not `mouthOpen * …`: a tongue can come out between lips
that are barely parted, which is the whole of a blep. The **body** behind it is
gated on `mouthOpen * tongue` — the same product that draws one at all — so a
shut mouth stays shut.

Every pose is the single factor at 1 with the others at 0, and the expression
carries the product. The construction being affine makes that exact: the delta
of `{ curl: 1 }` alone *is* the curl's contribution at any `out`.

### The lean

`mouthSkew`: one corner up, the other down by as much, and the lip line leaning
after them. Signed, so one shape key leans the mouth both ways.

The rig has had asymmetric **corners** since CR-28 — two pins, one per end of the
lip line (docs/FACE_CONTROL_RIG.md §12). What they cannot do is take the lip line
between them with them: a pin moves the artwork near it and lets go. A smirk is
the whole mouth leaning, which is a shape.

`skewRise` lifts one corner and drops the other by the same amount, so a lean is
never half a smile — `core/tests/mouth-build.test.js` holds it to that.

### The order, and the clip

```text
mouth                    the lips, and the cavity they enclose
mouthInside  ▸ clipped   tongue · teethLower · teeth
tongueTip                in front of the lips, because that is where it is
tongueGroove             and in front of the tip, because it is a crease in it
```

Inside the cavity the tongue is behind the lower teeth and both are behind the
upper row, because that is the order they are in; and the tip is in front of the
lips, because a tongue lapping out lies *over* the lower lip and there is no
other way to say that in a flat drawing (§5.2 of the brief).

**The clip is the belt to the geometry's braces.** Everything inside the mouth is
drawn from the mouth's own curves and stays inside it by construction — but only
as long as nothing else moves it. `tongueX` and `tongueY` translate the tongue,
`mouthWidth` scales the rows, and a warp or a pin can reach any of them: each of
those is a way for an inside to end up on the chin, and each of them used to be.
Clipping to the lips answers all of them at once, and it costs one `<use>`
because the aperture is already a path: `#mouth` *is* the shape of the hole, so
the clip follows every pose of it with nothing to keep in step.

The tip is outside the clip on purpose, and so is its groove — a crease drawn
in front of a tongue that is itself in front of the lips cannot be cut to the
hole they make. They are the only two things that are.

### The pairs a corrective can now reach

`docs/FACE_SVG_STATES.md` holds the vocabulary; V6 added four sentences to the
mouth's, and each is a pair the arithmetic is least kind to rather than a pair
somebody listed:

```text
skew        mouthSkew                        the lean the lips gained
openSmile   mouthOpen * smile                a grin
smileWide   smile * mouthWidth               a grin stretched across the face
tongueOut   mouthOpen * tongue * tongueOut   a tongue out of an open mouth, not a blep
```

Thirteen slots, every one a distinct monomial, so a face carrying all of them is
corrected exactly once.

## What stayed

The animal **ω**, the six **beaks** and the four robot **grilles**. A muzzle's
mouth is two curves meeting under a nose, a beak is a rigid wedge that hinges, and
a grille is a lit panel: different constructions, not this one at another radius.
They are **legacy** since V6 — kept and not offered, so a face already wearing one
goes on opening and wearing it while the human shelf is one mouth long
(docs/FACE_PART_LIBRARY.md, "Active and legacy").

## The mechanism this needed

**`installShapedControl`.** A shaped movement is buildable from any asset, not
only from a head's jaw: the hint carries `posePath`, the amplitude *is* the pose,
a role may ship its own (`hint.roles.teeth.posePath`) because each inside puckers
as the lip it is drawn from does, and — since V6 — a role may ship its own
**sentence** as well (`hint.roles.teethLower.expression`), because the lower row
shows later than the upper one on the same control. A role that draws something
other than a path gets no key, and the movement then goes **off** rather than
becoming a slider that moves nothing.

**A pose the card ships is a pose the card means.** `installShapedControl` used
to build keys only for the roles the *registry* binds a control to, and that is
a shorter list than the roles that have to move: `mouthOpen` and `smile` are
bound to the **lips and nothing else**, on purpose, because binding them to an
inside as well would be a second part writing `translateY` on a drawing the
tongue part already translates. So a card that shipped
`roles.tongueTip.posePath` for `mouthOpen` was shipping a pose nobody read, and
`mouth.full`'s insides sat still while the template's followed the lip line —
the same mouth, built twice, behaving differently.

Since V6 the roles a control is built for are the bound ones **plus any the card
ships a `posePath` for**. A shape key writes no `bindings` entry, so the extra
ones cost nothing and conflict with nothing: several may deform one element and
they simply sum. `validateFacePart` warns the other way round — a shaped
`mouthOpen` or `smile` on a card that draws an inside and ships no pose for it is
`driver-inside-adrift`, a warning rather than a refusal, because a drawing that
means its teeth to stay put is entitled to say so.

**A part the asset draws takes the roles it shares with the asset's own.** One
shape plays one role, so `mouth.full` cannot list the tongue under its own roles
*and* under `parts.tongue` — `validateFacePart` refuses the second mention at the
door, and rightly. But the tongue part *moves* that tongue: the mouth says whether
it shows, the tongue part says where it is. So the installer hands it over before
its movements are refreshed, which is the one moment at which a shaped movement
can still be built for it.

**A shape two parts move must be moved by shapes.** The mouth follows the lower
lip onto the tongue's tip (`mouthOpen`, `smile`) and the tongue part aims and
extends it. Shaped, they add up — a shape key writes no transform, and several on
one element simply sum. As transforms they are two parts writing `translateY` on
one drawing, which `enableSemanticControl` refuses at install with a message about
a property rather than about the drawing. `validateFacePart` says it instead,
before the asset is ever registered, in the words of the thing that is wrong.

**A control writes one property.** The first attempt at the bands gave
`mouthRound` a per-role *method* in the registry — a shape on the teeth, a
transform on the lips — and 477 tests said no: *"Semantic binding conflict:
tongue.translateY is already controlled"*. A control names one property and
`enableSemanticControl` writes it on **every** role the bindings table binds. What
a card may vary per role is the *pose* and, now, the *sentence*.

## What moved, and what did not

The **head turn** moved, by exactly twenty-one channels: the generator writes
seven per element and the mouth grew three. A hundred and seventeen of the
baseline's words moved with it, all by the same twenty-one, because every head,
eye, brow, nose, ear and head of hair is installed on a face that now has a lower
row of teeth, a tongue tip and a crease in it. The fifteen that did **not** move
are the fifteen that replace the mouth with one of their own, and none of those
draws any of the three (`core/tests/fixtures/head-turn-baseline.js`).
`mouthInside` gets no channels at all: it is a clipping group, not a drawing, and
a group with nothing of its own to turn is not given a turn.

The **shape count** moved by three paths, and the budget moved with it rather
than being quietly exceeded: the mouth is the feature a mascot spends its screen
time in, and three paths is what the whole of V6 cost.

## Where things are

```text
core/face/mouth-build.js                geometry: the four points, the six shapes
core/face-library/builtin/mouth-full.js the one card
core/face-library/face-catalogue.js     which drawings are offered at all
core/face-library/face-part-install.js  installShapedControl, and role adoption
core/face-library/face-part-model.js    a role may ship its own posePath and sentence
core/face-library/face-correctives.js   the thirteen mouth slots
rig-editor/semantic-parts/part-registry.js  the roles, the bindings, the strategies
core/sample/templates/face-artwork.js   draws the five, and clips the insides
core/sample/templates/template-project.js   the shape keys: thirty-nine over the six shapes
core/tests/mouth-build.test.js          empty, affine, one topology
core/tests/fixtures/mouth-line.js       a mouth that carries less, for the tests that need one
```

`mouth.line` is a **fixture**, not a card: the tests that are about a drawing
carrying less than the rig asks for — a movement going off, a refusal — need one,
and the library's own mouth can do everything.
