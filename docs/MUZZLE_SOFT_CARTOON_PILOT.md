# Muzzle · Soft Cartoon — the first animal faces

The brief for the first real content of the new face library (MASC-10A), following
the delivered art direction:

```text
sheet        Soft Cartoon — Face Parts V1
morphology   muzzle
style        soft-cartoon — the style the library is drawn in
species      Cat · Dog · Fox · Bear · Rabbit · Wolf
```

**Nothing here is drawn yet, and nothing here is registered.** The manifest is
`core/face-library/pilots/muzzle-soft-cartoon.js`: data only, read by this
document and by `masc10a-muzzle-pilot.test.js` and by nothing in the editor.
`npm run face:assets` still reviews the 47 drawings that really exist.

The geometry contract every drawing below is held to is
`docs/FACE_ASSET_AUTHORING.md`; the library contract is
`docs/FACE_PART_LIBRARY.md`.

## The principle

```text
shared parts  +  species-specific parts  +  preset recipe
```

Species are **not** libraries. A fox and a wolf share their eyes and their brows,
a cat and a fox share a nose, a dog and a wolf share a muzzle. What makes each
one itself is its ears, its muzzle and its palette.

```text
45  drawings on the sheet
38  claimed by a recipe   ← six species over eight slots would be 48
 7  catalogue pieces      ← expressions and species an author picks themselves
 6  recipes
```

## What the sheet settled

Two of its own captions answer questions the manifest had open.

**"6 styles d'yeux (pupilles intégrées)."** An eye set draws its own pupils, as
every shipped set already does. There is no standalone pupils card, and
`PRESET_PART_ORDER` does not let a preset name one — so a Cat preset could not
put a slit pupil on a face even if the card existed. The pupil families are
therefore a property of the eye drawings, and the recipes reach them through the
eyes. Two families: round and vertical.

**"6 museaux modulaires (sans nez ni bouche)."** A muzzle is a **pad**, drawn
with the nose and mouth area left open, and the semantic nose and the semantic
mouth sit on top of it keeping every control they have. That was the pilot's
biggest graphical risk and the art answers it. What is left is the draw order:
an accessory installed with nothing before it lands last in the group, so the
pad would still paint over the features. `behind` is the field that fixes it,
one line on each of the six drawings.

## Inventory

Every planned drawing, in the sheet's own order and under its own caption.

### 1 · Fonds de tête — 6
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Ronde | `head.animal-round` | Animal round | cat |
| Étroite | `head.animal-narrow` | Animal narrow | fox |
| Large | `head.animal-wide` | Animal wide | bear |
| Carrée | `head.animal-square` | Animal square | wolf |
| Petite | `head.animal-small` | Animal small | rabbit |
| Joufflue | `head.animal-chubby` | Animal chubby | dog |

### 2 · Yeux — 6
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Grands ronds | `eyes.animal-round-large` | Big round | dog, rabbit |
| Grands ronds pupilles fendues | `eyes.animal-round-slit` | Big round, slit | cat |
| En amande alerte | `eyes.animal-almond-alert` | Alert almond | fox, wolf |
| Endormis | `eyes.animal-sleepy` | Sleepy | *catalogue* |
| Joyeux | `eyes.animal-happy` | Happy | *catalogue* |
| Petits mignons | `eyes.animal-small-cute` | Small and cute | bear |

### 2b · Pupilles — 2
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| (pupilles intégrées) | `pupils.round` | Round pupils | dog, fox, bear, wolf, rabbit |
| (pupilles intégrées) | `pupils.vertical` | Vertical pupils | cat |

### 3 · Sourcils — 5
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Fins doux | `eyebrows.animal-thin-soft` | Thin and soft | cat, rabbit |
| Affirmés | `eyebrows.animal-firm` | Firm | fox, wolf |
| Épais | `eyebrows.animal-thick` | Thick | bear |
| Relevés amicaux | `eyebrows.animal-friendly-raised` | Friendly raised | dog |
| Inquiets courbés | `eyebrows.animal-worried` | Worried | *catalogue* |

### 4 · Oreilles — 8
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Chat pointues | `ears.cat-pointed` | Cat pointed | cat |
| Renard grandes pointues | `ears.fox-large-pointed` | Fox large pointed | fox |
| Chien tombantes | `ears.dog-folded` | Dog folded | dog |
| Ours rondes | `ears.bear-round` | Bear round | bear |
| Lapin grandes | `ears.rabbit-long` | Rabbit long | rabbit |
| Loup pointues | `ears.wolf-pointed` | Wolf pointed | wolf |
| Petites rondes | `ears.small-round` | Small round | *catalogue* |
| Avec touffes | `ears.tufted` | Tufted | *catalogue* |

### 5 · Museaux — 6
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Félin court | `accessory.muzzle-feline-short` | Short feline muzzle | cat |
| Félin arrondi | `accessory.muzzle-feline-rounded` | Rounded feline muzzle | *catalogue* |
| Canin moyen | `accessory.muzzle-canine-medium` | Medium canine muzzle | dog, wolf |
| Canin étroit | `accessory.muzzle-canine-narrow` | Narrow canine muzzle | fox |
| Ours large | `accessory.muzzle-bear-broad` | Broad bear muzzle | bear |
| Rongeur petit | `accessory.muzzle-rodent-small` | Small rodent muzzle | rabbit |

### 6 · Nez — 5
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Petit triangle | `nose.triangle-small` | Small triangle | cat, fox |
| Arrondi animal | `nose.animal-rounded` | Rounded animal | dog |
| Large ours | `nose.bear-broad` | Broad bear | bear |
| Minuscule bouton | `nose.button-tiny` | Tiny button | rabbit |
| Ovale doux | `nose.oval-soft` | Soft oval | wolf |

### 7 · Bouches — 5
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Sourire animal | `mouth.animal-smile` | Animal smile | cat |
| Neutre | `mouth.animal-neutral` | Neutral | bear, wolf |
| Ouverte amicale | `mouth.animal-open-friendly` | Open and friendly | dog |
| Petit sourire | `mouth.animal-small-smile` | Small smile | fox, rabbit |
| Joyeuse courbée | `mouth.animal-happy-curve` | Happy curve | *catalogue* |

### 8 · Moustaches — 4
| Sheet | Id | Name | For |
| --- | --- | --- | --- |
| Trois droites | `accessory.whiskers-three-straight` | Three straight | cat |
| Deux douces | `accessory.whiskers-two-soft` | Two soft | fox |
| Longues courbées | `accessory.whiskers-long-curved` | Long curved | wolf |
| Subtiles courtes | `accessory.whiskers-subtle-short` | Subtle short | rabbit |

## The six recipes

Every piece below is a pilot drawing: no recipe leans on a shipped one.

| | Cat | Dog | Fox | Bear | Rabbit | Wolf |
| --- | --- | --- | --- | --- | --- | --- |
| head | `animal-round` | `animal-chubby` | `animal-narrow` | `animal-wide` | `animal-small` | `animal-square` |
| eyes | `animal-round-slit` | `animal-round-large` | `animal-almond-alert` | `animal-small-cute` | `animal-round-large` | `animal-almond-alert` |
| pupils | `vertical` | `round` | `round` | `round` | `round` | `round` |
| eyebrows | `animal-thin-soft` | `animal-friendly-raised` | `animal-firm` | `animal-thick` | `animal-thin-soft` | `animal-firm` |
| ears | `cat-pointed` | `dog-folded` | `fox-large-pointed` | `bear-round` | `rabbit-long` | `wolf-pointed` |
| muzzle | `muzzle-feline-short` | `muzzle-canine-medium` | `muzzle-canine-narrow` | `muzzle-bear-broad` | `muzzle-rodent-small` | `muzzle-canine-medium` |
| nose | `triangle-small` | `animal-rounded` | `triangle-small` | `bear-broad` | `button-tiny` | `oval-soft` |
| mouth | `animal-smile` | `animal-open-friendly` | `animal-small-smile` | `animal-neutral` | `animal-small-smile` | `animal-neutral` |
| whiskers | `whiskers-three-straight` | — | `whiskers-two-soft` | — | `whiskers-subtle-short` | `whiskers-long-curved` |
| palette | `cat-ginger` | `dog-tan` | `fox-orange` | `bear-brown` | `rabbit-cream` | `wolf-grey` |

The *pupils* row is a reading, not a key: a recipe names the eyes, and the eyes
bring the pupils. The *whiskers* dashes are the absence of an accessory, never
an empty drawing.

Each recipe's direction, in one line:

* **Cat** — friendly, compact, rounded: big eyes with a slit pupil, pointed
  ears, a short feline muzzle, a small triangular nose, whiskers you can see.
* **Dog** — friendly and full-cheeked: big round eyes, brows raised at the outer
  end, folded ears, a medium canine muzzle, a rounded nose, an open mouth.
* **Fox** — alert: a narrow face, almond eyes, firm brows, large pointed ears, a
  narrow muzzle, a small triangular nose, a light smile.
* **Bear** — broad and heavy: small wide-set eyes, thick brows, small round
  ears, a broad muzzle, a large nose, a plain mouth.
* **Rabbit** — small and soft: a neat head under long upright ears, big round
  eyes, a small rodent muzzle, a tiny pink nose, fine short whiskers.
* **Wolf** — squared and watchful: almond eyes, firm brows, upright ears, a
  medium canine muzzle, a soft oval nose, long whiskers.

### The catalogue

Seven drawings no recipe names: `eyes.animal-sleepy`, `eyes.animal-happy`,
`eyebrows.animal-worried`, `ears.small-round`, `ears.tufted`,
`accessory.muzzle-feline-rounded`, `mouth.animal-happy-curve`.

They stay. A parts library exists to be combined, and the sheet says so in its
own header — these are the pieces an author reaches for when they are making
something the six recipes do not cover. They are marked `catalogue` in the
manifest so nobody reads them as an oversight.

## Reuse: what the 47 are worth

All 47 shipped drawings were judged, each with a reason.

| Verdict | Count | Meaning |
| --- | --- | --- |
| `reuse` | 0 | — |
| `possible-reuse` | 17 | it may work; the first sheet decides |
| `replace` | 17 | an animal needs its own, and this one cannot stand in |
| `not-relevant` | 13 | nothing in this pilot would reach for it |

The audit was made before the sheet arrived, when `eyebrows.thin`,
`nose.cartoon`, `mouth.small` and `mouth.cartoon` were going to stand in for an
animal brow, an animal nose and two animal mouths. **The sheet draws its own**,
so those four moved back to `possible-reuse`: they are what to fall back on if a
planned drawing is cut, and nothing is drawn twice either way.

What survives as real value is the other direction — which shipped pieces an
animal face may still *wear*. `accessory.glasses`, `accessory.square-glasses`,
`accessory.hat` and `accessory.bow-tie` are universal, and a fox in square
glasses is a perfectly good mascot.

## Palettes

A ginger cat and a grey cat are **one drawing and two palettes**. Nothing is
drawn twice for a colour, and there is no `cat-orange-head`. The colours follow
the six heads on the sheet.

| Palette | Species | Skin | Shadow | Outline |
| --- | --- | --- | --- | --- |
| `cat-ginger` | cat | `#e8a45c` | `#f7e3c8` | `#8a4f22` |
| `cat-grey` | cat | `#9aa3ab` | `#e2e6e9` | `#4a545c` |
| `dog-tan` | dog | `#d3a878` | `#f4e4cd` | `#7a5330` |
| `fox-orange` | fox | `#e9a25a` | `#fbeedd` | `#8a4a1c` |
| `bear-brown` | bear | `#a97d55` | `#e2c9a8` | `#5c3f28` |
| `rabbit-cream` | rabbit | `#f3e3cd` | `#fdf6ec` | `#a3866a` |
| `wolf-grey` | wolf | `#a9a6a0` | `#e6e4e0` | `#4f4c48` |

### Tokens

**No new palette token.** Every colour above is one of the twelve the library
already has: `skin`, `skinShadow`, `outline`, `eyeWhite`, `pupil`, `mouth`,
`tongue`, `teeth`, `accessoryPrimary`, `accessorySecondary`.

`hair` and `hairShadow` have nothing to paint: a `muzzle` face names no hair
slot, and fur is painted into the head and the ears. A token nothing on the face
is painted in simply has no swatch in the Colours row, so nothing is invented
for them.

The muzzle pad and the inner ear need a colour that is not the fur — the sheet
paints both a pale cream against the coat — and `skinShadow` is the only
existing token that fits. Whether one colour reads for both is an open question
below. The rabbit's pink nose is the other case; `accessorySecondary` can carry
it.

## Mount points

Every planned drawing uses an anchor that already exists. The muzzle and the
whiskers take the candidate MASC-09 proposed for them.

```text
head            head.center      the eight human skulls' own anchor
eyes · pupils   eyes
brows           brows
ears            ears             ← the sheet's eight pairs sit on top of the skull; see below
muzzle          nose.center      ← MASC-09's candidate, to be confirmed by the first sheet
nose            nose.center
mouth           mouth.center
whiskers        nose.center      ← MASC-09's candidate
```

## Animation

**No new runtime control.** Six species run on the parameters a person runs on.

| Section | Installs as | Roles | Controls |
| --- | --- | --- | --- |
| heads | `head` | `head` | `headX`, `headY`, `headTilt` |
| eyes | `eyes` | `leftEye`, `rightEye` | `eyeOpen` (+ `gaze` and `eyelids` under `parts`) |
| pupils | `gaze` | `leftPupil`, `rightPupil` | `lookX`, `lookY`, `pupilScale` |
| brows | `eyebrows` | `leftBrow`, `rightBrow` | `browRaise`, `browTilt` |
| ears | `ears` | `leftEar`, `rightEar` | `earWiggle` |
| muzzles | `accessory` | `element` | none |
| noses | `nose` | `nose` | `noseScrunch` |
| mouths | `mouth` | `mouth` | `mouthOpen`, `smile`, `mouthWidth` (+ `tongue` for Ouverte amicale) |
| whiskers | `accessory` | `element` | none |

The muzzle carries **no** mouth logic. `mouthOpen`, `smile` and `mouthWidth`
stay the semantic mouth's, exactly as on a person — a snout is artwork parented
to the head, and the rig that plays it is the accessory rig it already has.

### 2.5D turn

| Section | Turn profile |
| --- | --- |
| heads, eyes, pupils, brows, noses, mouths | what the category already does |
| ears | **needs a profile** — all eight pairs sit on top of the skull, where the three shipped pairs sit at its sides |
| muzzles | **needs a profile** — an accessory that says nothing about the turn does not turn; a snout projects further than the glasses or the moustache, which each declare one |
| whiskers | **needs a profile** — they sweep with the muzzle |

Nothing is written until the drawings exist. The moustache's `{ depth: 0.88,
narrow: true }` is the nearest precedent for a muzzle.

## The sheets

The order the validation planches are produced, section by section, once the
drawings are in a test pack — `node scripts/face-asset-sheet.mjs --slot <slot>`:

```text
1  Heads      6   ← the tufted fur edge against the reference box
2  Eyes       6   ← pupils reviewed inside them; the closed pair's gaze question
3  Brows      5
4  Ears       8   ← the species read; fit matrix on Round, Narrow, Wide, Square
5  Muzzles    6   ← the draw-order question
6  Noses      5
7  Mouths     5
8  Whiskers   4
```

Every drawing goes through the loop in `docs/FACE_ASSET_AUTHORING.md`
individually — alone, auto-fitted, fit matrix — **before** any of them reaches a
pack.

## Still open

Nine questions, in `PILOT_OPEN_QUESTIONS` with a proposal each. The four that
matter most:

1. **Muzzle draw order.** The sheet settles the shape — a pad with the nose and
   mouth area open — but an accessory installed with nothing before it lands
   last in the group and would paint over both. The proposal is `behind`, as
   `hair.long` uses it for `hairBack`.
2. **The happy eyes have no pupil.** *Joyeux* is drawn shut. The `gaze` part
   requires `leftPupil` and `rightPupil`, and `eyeOpen` closes an eye that is
   already closed. Either it names no `parts.gaze` — a face wearing it has no
   gaze — or it draws a pupil hidden behind the arc.
3. **The ears move to the top of the skull.** A fit keeps the offset from the
   anchor, so it should work, and the fit matrix across four skulls proves it.
   Their draw order is the same question, and the rabbit's ears are taller than
   the head is high, against an artboard with 60 units of headroom.
4. **The pad colour.** `skinShadow` is the only token that fits the muzzle pad
   and the inner ear, and it also shades the head. Try it before adding a
   thirteenth token.

## Status

Every planned drawing starts at `needs-art`.

```text
needs-art → candidate → approved → rejected
```

This is pilot vocabulary. No face part carries it, and nothing in the editor
reads it; it is how a drawing moves between the artistic review and MASC-10B.
