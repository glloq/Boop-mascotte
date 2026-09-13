# Robot · Soft Cartoon — the first machine faces

The brief for the second body of real content in the face library (MASC-11A),
following the delivered art direction:

```text
sheet        Soft Cartoon — Bibliothèque Robot V1 (ROBOT-V1)
morphology   robot
style        soft-cartoon — the style the library is drawn in
types        Écran · Rétro · Industriel · Jouet
```

**Nothing here is drawn yet, and nothing here is registered.** The manifest is
`core/face-library/pilots/robot-soft-cartoon.js`: data only, read by this
document and by `masc11a-robot-pilot.test.js` and by nothing in the editor.
`npm run face:assets` still reviews the 92 drawings that really exist.

The geometry contract every drawing below is held to is
`docs/FACE_ASSET_AUTHORING.md`; the library contract is
`docs/FACE_PART_LIBRARY.md`; the animal pilot this one is modelled on is
`docs/MUZZLE_SOFT_CARTOON_PILOT.md`.

## The principle, unchanged

```text
shared parts  +  type-specific parts  +  preset recipe
```

The four kinds of robot are **presets inside `robot`**, exactly as Cat and Fox
are presets inside `muzzle`. A morphology is what a face is made of; a preset is
what it looks like.

And — the thing this pilot exists to test for the third time — **nothing here
adds a slot.** The planche's seven rows land on seven slots that already exist:

```text
Coque de tête          → head
Modules latéraux       → ears        ← a mapping decision, see below
Yeux / écran           → eyes
Sourcils / visière     → eyebrows    ← the same decision
Bouche / haut-parleur  → mouth
Antenne                → antenna     ← drawn for the first time
Panneaux / détails     → panels      ← drawn for the first time
```

`antenna` and `panels` are the two that make `robot` available. They have been
in `FACE_SLOTS` since MASC-01 and empty ever since; the day the first of each
exists, `availableMorphologies()` reports `robot: AVAILABLE` on its own, with
nothing added to any list.

## How many drawings this actually is

The planche lays out **7 rows × 4 types = 28 labelled families**, and draws
**three variants of each** — 84 cells. It labels the family and never the
variant: `head.retro-square` names one cell showing a cream box, a green box and
a red box.

Which is the pilot's first real question, because this library has a rule about
that: **a colour is a palette, not a drawing.** A ginger cat and a grey cat are
one drawing and two palettes. A cream caisson and a red caisson should be too.

```text
84  cells on the planche
74  drawings if every triple that looks like three shapes really is
28  drawings at the floor — one per labelled family
```

So the manifest plans **28 ids**, each carrying `variants: 3` and a
`variantAxis` recording how the three seem to differ:

| axis | reading | cost |
| --- | --- | --- |
| `shape` | three silhouettes | three drawings (`-b`, `-c`) |
| `detail` | one silhouette, different fittings | three drawings |
| `colour` | one silhouette, three colours | **one drawing**, extra palette entries |

Five families currently read as `colour`: the retro caisson, the toy shell, the
retro side module, the toy side module and the retro brow plate. If that reading
survives their review sheets, fifteen cells become five drawings and ten palette
entries. **The axis is a reading of an image, not a fact** — each row's sheet
settles its own before that row is drawn.

## Inventory

Every planned drawing, in the planche's own order, with the caption and the id
the planche itself prints.

### 1 · Coques de tête — 4 familles
| Planche | Id | Nom | Pour | Axe |
| --- | --- | --- | --- | --- |
| Écran | `head.robot-screen-rounded` | Screen shell | screen | shape |
| Rétro | `head.robot-retro-square` | Retro shell | retro | **colour** |
| Industriel | `head.robot-industrial-plate` | Industrial shell | industrial | detail |
| Jouet | `head.robot-toy-round` | Toy shell | toy | **colour** |

A shell is the bare skull: the bezel, the face plate, and nothing on it. Every
fitting is its own piece — the same rule that makes an animal head a bare fur
silhouette.

### 2 · Modules latéraux — 4 familles
| Planche | Id | Nom | Pour | Axe |
| --- | --- | --- | --- | --- |
| Écran | `ears.robot-screen-round` | Screen side module | screen | detail |
| Rétro | `ears.robot-retro-round` | Retro side module | retro | **colour** |
| Industriel | `ears.robot-industrial-bolt` | Industrial side module | industrial | detail |
| Jouet | `ears.robot-toy-colorful` | Toy side module | toy | **colour** |

### 3 · Yeux / écran — 4 familles
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Écran | `eyes.robot-display-friendly` | Friendly display | screen |
| Rétro | `eyes.robot-retro-led` | Retro LED | retro |
| Industriel | `eyes.robot-industrial-led` | Industrial LED | industrial |
| Jouet | `eyes.robot-toy-expressive` | Toy expressive | toy |

### 4 · Sourcils / visière — 4 familles
| Planche | Id | Nom | Pour | Axe |
| --- | --- | --- | --- | --- |
| Écran | `eyebrows.robot-screen-simple` | Screen brow | screen | shape |
| Rétro | `eyebrows.robot-retro-plate` | Retro brow plate | retro | **colour** |
| Industriel | `eyebrows.robot-industrial-visor` | Industrial visor | industrial | shape |
| Jouet | `eyebrows.robot-toy-cute` | Toy brow | toy | shape |

### 5 · Bouche / haut-parleur — 4 familles
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Écran | `mouth.robot-display` | Display mouth | screen |
| Rétro | `mouth.robot-retro-grille` | Retro grille | retro |
| Industriel | `mouth.robot-industrial-vent` | Industrial vent | industrial |
| Jouet | `mouth.robot-toy-simple` | Toy mouth | toy |

### 6 · Antenne — 4 familles
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Écran | `accessory.antenna-single-short` | Single short antenna | screen |
| Rétro | `accessory.antenna-retro-multi` | Retro multi antenna | retro |
| Industriel | `accessory.antenna-industrial-robust` | Industrial antenna | industrial |
| Jouet | `accessory.antenna-toy-fun` | Toy antenna | toy |

### 7 · Panneaux / détails — 4 familles
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Écran | `accessory.panels-light-panel` | Light panel | screen |
| Rétro | `accessory.panels-retro-buttons` | Retro buttons | retro |
| Industriel | `accessory.panels-warning-stripe` | Warning stripe | industrial |
| Jouet | `accessory.panels-toy-buttons` | Toy buttons | toy |

## The four recipes

| | Écran | Rétro | Industriel | Jouet |
| --- | --- | --- | --- | --- |
| head | `robot-screen-rounded` | `robot-retro-square` | `robot-industrial-plate` | `robot-toy-round` |
| ears | `robot-screen-round` | `robot-retro-round` | `robot-industrial-bolt` | `robot-toy-colorful` |
| eyes | `robot-display-friendly` | `robot-retro-led` | `robot-industrial-led` | `robot-toy-expressive` |
| eyebrows | `robot-screen-simple` | `robot-retro-plate` | `robot-industrial-visor` | `robot-toy-cute` |
| mouth | `robot-display` | `robot-retro-grille` | `robot-industrial-vent` | `robot-toy-simple` |
| antenna | `antenna-single-short` | `antenna-retro-multi` | `antenna-industrial-robust` | `antenna-toy-fun` |
| panels | `panels-light-panel` | `panels-retro-buttons` | `panels-warning-stripe` | `panels-toy-buttons` |
| palette | `robot-screen` | `robot-retro` | `robot-industrial` | `robot-toy` |

**No nose and no hair**, on any of the four. That is not an omission: the
planche draws neither, and the `robot` morphology already says a robot is not
made of them.

Unlike the animals, **nothing is shared between the four** — and that is a
finding rather than a failure. A fox and a wolf share their eyes because they
are both canids; a screen robot and an industrial one share nothing by design,
because the four columns *are* four visual languages. The sharing in this pack
is between an author's choices, not between the recipes.

## Reuse: what the 92 are worth to a machine

Short, and that is the answer: a robot shares almost nothing with a person or an
animal.

| Verdict | Drawings |
| --- | --- |
| `reuse` | `accessory.bow-tie` — and only that |
| `possible-reuse` | both pairs of glasses, the hat, `eyebrows.flat`, `ears.small` |
| `replace` | `head.square-soft`, `eyes.round-small`, `mouth.small` |
| `not-relevant` | the earrings, `nose.cartoon`, `hair.bald` |

`head.square-soft` is the interesting `replace`: it is the nearest shipped shape
to a retro caisson and still a *skull* — a soft square of skin with a jaw that
drops. A shell is rigid and bolted, and no palette makes one out of the other.

`eyes.round-small` is the other: the shipped `robot` preset uses it, which is
exactly the confusion this pilot ends. A white with a pupil in it is an eye; a
robot has a lamp.

## Palettes

Four, following the planche's own swatch rows. No new token: every colour is one
of the twelve the library already has.

| Palette | Coque | Écran / lampe | Accent |
| --- | --- | --- | --- |
| `robot-screen` | `#f5f7fa` | `#23272e` / `#37c9e8` | `#a8d4ef` |
| `robot-retro` | `#f2ece0` | `#3a3630` / `#f2c230` | `#d1453f` |
| `robot-industrial` | `#b6b9bc` | `#33373a` / `#e08a24` | `#f0c02c` |
| `robot-toy` | `#fdfdfd` | `#ffffff` / `#3b4046` | `#e04a48` |

A robot's shell is `skin`, its seam `skinShadow`, its edge `outline`; the screen
ground is `eyeWhite` and the lit element `pupil`; `mouth` paints the grille
ground and `tongue` the toy robot's open mouth. **`hair` and `hairShadow` are
the two a robot never paints** — there is no hair slot in a `robot` face, and an
antenna stands where hair would — so the manifest leaves them out, exactly as
the animal pilot does. A registered palette carries all twelve, so MASC-11B
fills them in at registration.

## Two decisions before a line is drawn

### 1 · `robot` does not offer the rows the planche draws

`MORPHOLOGY_TABLE` (MASC-01) gives robot:

```text
head · eyes · pupils · mouth · antenna · panels · accessory
```

Neither `ears` nor `eyebrows` is in it. So the Modules latéraux and Sourcils /
visière rows would be drawn and then never offered by Design.

**Proposal: add the two slots.** One line in `MORPHOLOGY_TABLE`, and the side
modules get `earWiggle` while the visor gets `browRaise` and `browTilt` for
nothing. Calling them `panels` pieces instead costs the animation and gains
nothing. This is MASC-01's table, so it is a decision and not a detail — and
`masc11a-robot-pilot.test.js` asserts the gap so nobody discovers it halfway
through the row.

### 2 · Shapes or colours

Above. Settled row by row on the review sheets, before that row is drawn.

## What else the drawings have to settle

Nine more questions, in `PILOT_OPEN_QUESTIONS` with a proposal each. The ones
that matter:

**A robot eye is a lamp, and a lamp has to be a whole eye set.** MASC-10B
established that an eye set bringing no `gaze` and no `eyelids` is refused by
the install, because swapping it in takes the pupils off the face. The proposal:
**the lit element is the pupil.** `lookX`/`lookY` move the light inside its
housing — which is exactly what a robot eye does when it looks at you — and the
dark bezel is the socket that clips it. `eyeOpen` closes the housing. The heart
and star variants are the `eyes.animal-happy` case: they hold the roles and
claim nothing, because a heart does not look anywhere.

**A shell has no jaw.** Every head the library ships carries a `jaw` part: the
same outline drawn twice, at rest and with its chin stretched down. A bolted
plate does not stretch. The proposal is to ship no jaw part at all and check on
the shells sheet that a head without one still leaves a rig the validator
accepts. Nothing in the contract requires one — but no shipped head has ever
left it out.

**A robot names no nose.** `validateFacePreset` already accepts it; one test
convention asserts every shipped preset names one. Relax it the way MASC-10B
relaxed the same assertion for `hair`.

**A visor is two brows.** The industrial visor spans both eyes as one piece, and
`eyebrows` requires `leftBrow` and `rightBrow` so the two can raise
independently. Draw it as two halves meeting at the middle; a visor that raises
as one piece is then two halves that happen to move together, which is what
`browRaise` does anyway.

**Panels sit on the shell, and that is free.** A panel is drawn at
`head.center`, the same anchor the shell uses, and has to paint *over* it — and
an accessory installed with nothing before it lands last in the group, which is
on top. The muzzle's problem inverted, and worth writing down for that reason.

**The hazard stripe belongs to `panels`.** It appears twice on the planche: as a
third variant of the industrial shell and as the first industrial panel. A shell
is the bare skull here and every marking on it is its own piece.

## The sheets

The order the validation planches are produced, row by row —
`node scripts/face-asset-sheet.mjs --slot <slot>`:

```text
1  Shells     4 familles  ← the jaw question; the colour-or-shape reading
2  Sides      4           ← the anchor, against a shell rather than a skull
3  Eyes       4           ← what plays the pupil
4  Visors     4           ← the one-piece visor as two halves
5  Mouths     4
6  Antennae   4           ← head.top confirmed; the hat collision
7  Panels     4           ← draw order over the shell
```

Every drawing goes through the loop in `docs/FACE_ASSET_AUTHORING.md`
individually — alone, auto-fitted, fit matrix — **before** any of them reaches a
pack.

## Status

Every planned drawing starts at `needs-art`.

```text
needs-art → candidate → approved → rejected
```

This is pilot vocabulary. No face part carries it, and nothing in the editor
reads it; it is how a drawing moves from the brief through the artistic review
to MASC-11B.
