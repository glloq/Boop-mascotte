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
| `teeth` | a **shape key**, `mouthOpen * teeth` |
| `tongue` | a **shape key**, `mouthOpen * tongue` |

Five of the six are **shaped**, and the one that is not is the one a transform
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

### The teeth and the tongue are drawn from the lips

Each is **two quadratics sharing their ends on the lip**, one control point
pushed into the mouth. At `show 0` the two are the same curve traced twice: the
shape encloses nothing and paints nothing. So a closed mouth has nothing behind
it to hide, by construction rather than by arithmetic — which is what lets each
be one band drawn from the lip it sits behind rather than a second mouth with its
own cavity, and why they taper into nothing before the corners the way a row of
upper teeth does.

Being empty is also why they **grow** rather than fade. An opacity movement is
right for a card that draws a finished row of teeth and hides it; a shape that
encloses nothing paints nothing at *any* opacity. Neither carries `opacity="0"`
either — a frame's opacity is the drawn one **multiplied** by the binding's, so a
shape drawn at 0 could never be brought out at all.

So each band's pose is itself **open and shown at once**, and its sentence is a
product:

```text
teeth   posePath teethPath({ open: 1, show: 1 })   expression  mouthOpen * teeth
tongue  posePath tonguePath({ open: 1, show: 1 })  expression  mouthOpen * tongue
```

Both halves earn their place. The **product** keeps a closed mouth honest: shut
lips have nothing behind them to show, however far the control is up. And it is
the *construction's* rule rather than the part's, which is why the card says it
and the registry does not — a card that draws a finished row of teeth and fades
it in wants `teeth` alone.

Folding the **opening** into the same pose is what keeps the band inside the lips
it is drawn from. A control writes one property for every role it binds, so
`mouthOpen` cannot be a scale on the lips and a shape on the bands; drawn at the
closed lip line a band stayed there while the lips dropped, which is a row of
teeth over the chin. In one pose it travels with the aperture — 0 with the mouth
shut, the whole delta with it open and the control up, proportional in between.

### What stayed

The animal **ω**, the six **beaks** and the four robot **grilles**. A muzzle's
mouth is two curves meeting under a nose, a beak is a rigid wedge that hinges, and
a grille is a lit panel: different constructions, not this one at another radius.
Sixteen mouths on the shelf, and one of them fits every face.

## The mechanism this needed

**`installShapedControl`.** A shaped movement is now buildable from any asset, not
only from a head's jaw: the hint carries `posePath`, the amplitude *is* the pose,
and a role may ship its own (`hint.roles.teeth.posePath`) because each band
puckers as the lip it is drawn from does. A role that draws something other than a
path gets no key, and the movement then goes **off** rather than becoming a slider
that moves nothing — which is the state every mouth claiming `mouthRound` would
otherwise have been in.

**A control writes one property.** The first attempt at the bands gave
`mouthRound` a per-role *method* in the registry — a shape on the teeth, a
transform on the lips — and 477 tests said no: *"Semantic binding conflict:
tongue.translateY is already controlled"*. A control names one property and
`enableSemanticControl` writes it on **every** role the bindings table binds, so
that registry cannot be written. The registry is untouched; what a card may vary
per role is the *pose*, and the three poses above are how the pucker reaches the
bands: a band drawn from a resting lip curve is wider than a rounded mouth, so
left alone it is a row of teeth floating beside an O.

## What did not move

The **head turn**. `mouth.full` signs the word `mouth.cartoon` signed —
`139:2f2375adaccd78f8` — which is the template's own 125 keyforms plus the seven
channels the generator writes for each of the two shapes inside the lips. A turn is
generated from roles and profiles, never from path data.

## Where things are

```text
core/face/mouth-build.js                geometry: the four points, the two bands
core/face-library/builtin/mouth-full.js the one card
core/face-library/face-part-install.js  installShapedControl
core/face-library/face-part-model.js    a role may ship its own posePath
rig-editor/semantic-parts/part-registry.js  unchanged — and the comment saying why
core/sample/templates/face-artwork.js   re-exports the geometry it draws with
core/tests/fixtures/mouth-line.js       a mouth that carries less, for the tests that need one
```

`mouth.line` is a **fixture**, not a card: the tests that are about a drawing
carrying less than the rig asks for — a movement going off, a refusal — need one,
and the library's own mouth can do everything.
