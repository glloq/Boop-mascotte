# Muzzle · Soft Cartoon — the first animal faces

The brief for the first real content of the new face library (MASC-10A).

```text
morphology   muzzle
style        soft-cartoon — the style the library is drawn in
species      Cat · Dog · Fox · Bear
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

Four species are **not** four libraries. A cat, a dog and a bear share a head; a
cat and a fox share a nose and a mouth; three of the four share a brow. What
makes a cat a cat is its ears, its muzzle, its pupils and its palette.

```text
19  drawings to make
 4  shipped drawings reused instead
 4  recipes
```

Twenty-five was the budget. Nineteen is what four honest recipes need.

## Inventory

Every planned drawing, in the order the validation sheets are drawn.

| # | Group | Id | Name | Slot → category | Mount | For | Tags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 11 | heads | `head.animal-round` | Animal round | head → head | `head.center` | cat, dog, bear | animal, round, soft |
| 12 | heads | `head.animal-narrow` | Animal narrow | head → head | `head.center` | fox | animal, narrow, sharp |
| 21 | eyes | `eyes.cartoon-large` | Cartoon large | eyes → eyes | `eyes` | dog, bear | animal, large, friendly |
| 22 | eyes | `eyes.cartoon-large-slit` | Cartoon large, slit | eyes → eyes | `eyes` | cat | cat, feline, large, slit |
| 23 | eyes | `eyes.alert-almond` | Alert almond | eyes → eyes | `eyes` | fox | animal, almond, alert |
| 31 | pupils | `pupils.round` | Round pupils | pupils → pupils | `eyes` | dog, fox, bear | animal, round |
| 32 | pupils | `pupils.vertical` | Vertical pupils | pupils → pupils | `eyes` | cat | cat, feline, slit, vertical |
| 41 | brows | `eyebrows.animal-sharp` | Animal sharp | eyebrows → eyebrows | `brows` | fox | animal, sharp, alert |
| 51 | ears | `ears.cat-pointed` | Cat pointed | ears → ears | `ears` | cat | cat, feline, pointed |
| 52 | ears | `ears.fox-large-pointed` | Fox large pointed | ears → ears | `ears` | fox | fox, vulpine, pointed, large |
| 53 | ears | `ears.dog-folded` | Dog folded | ears → ears | `ears` | dog | dog, canine, folded, floppy |
| 54 | ears | `ears.bear-round` | Bear round | ears → ears | `ears` | bear | bear, round, small |
| 61 | muzzles | `accessory.muzzle-feline-short` | Short feline muzzle | muzzle → accessory | `nose.center` | cat | cat, feline, short, broad |
| 62 | muzzles | `accessory.muzzle-canine-medium` | Medium canine muzzle | muzzle → accessory | `nose.center` | dog | dog, canine, medium, rounded |
| 63 | muzzles | `accessory.muzzle-canine-narrow` | Narrow canine muzzle | muzzle → accessory | `nose.center` | fox | fox, vulpine, canine, narrow, pointed |
| 64 | muzzles | `accessory.muzzle-bear-broad` | Broad bear muzzle | muzzle → accessory | `nose.center` | bear | bear, broad, round |
| 71 | noses | `nose.triangle-small` | Small triangle | nose → nose | `nose.center` | cat, fox | cat, fox, triangle, small |
| 72 | noses | `nose.broad-bear` | Broad bear nose | nose → nose | `nose.center` | bear | bear, broad, large |
| 81 | mouths | `mouth.animal-smile` | Animal smile | mouth → mouth | `mouth.center` | cat, fox | animal, smile, omega |
| 91 | whiskers | `accessory.whiskers-three-straight` | Three straight whiskers | whiskers → accessory | `nose.center` | cat | cat, feline, three, straight |
| 92 | whiskers | `accessory.whiskers-two-soft` | Two soft whiskers | whiskers → accessory | `nose.center` | fox | fox, soft, two, curved |

Twenty-one entries, **nineteen drawings**: the two pupil families are properties
of the eye sets that draw them, not cards of their own. That is the next section.

## The pupils are inside the eyes

The finding that shaped the whole inventory.

A pair of eyes in this library is a **composite**: every one of the five shipped
sets names `gaze` and `eyelids` under `parts`, and draws its own pupils and lids.
There has never been a standalone pupils card, and `PRESET_PART_ORDER` does not
let a preset name one — so a Cat preset could not put vertical pupils on a face
even if the card existed.

So *two eye families × two pupil families* is not four drawings. It is the
combinations a recipe actually asks for, which is three:

```text
eyes.cartoon-large        round pupils     dog · bear
eyes.cartoon-large-slit   vertical pupils  cat
eyes.alert-almond         round pupils     fox
```

Almond with a vertical pupil — an alert cat — is the fourth, and nobody needs it
yet. It is one more eye drawing whenever a recipe asks, not a decision to take
now.

The Pupils sheet still exists, because the pupil is where a cat stops being a
dog and it deserves looking at on its own. It reviews the two families *inside*
the eye sets that draw them.

## Reuse: what the 47 are worth

All 47 shipped drawings were judged. `PILOT_REUSE` carries the verdict and the
reason for each; the summary:

| Verdict | Count | Meaning |
| --- | --- | --- |
| `reuse` | 4 | a recipe names it, and nothing is drawn for that role |
| `possible-reuse` | 13 | it may work; the first sheet decides |
| `replace` | 17 | an animal needs its own, and this one cannot stand in |
| `not-relevant` | 13 | nothing in this pilot would reach for it |

**The four reuses**, each saving a drawing:

| Drawing | Plays | For |
| --- | --- | --- |
| `eyebrows.thin` | the soft brow family | cat, dog, bear |
| `nose.cartoon` | the rounded-animal nose | dog |
| `mouth.small` | the animal-neutral mouth | bear |
| `mouth.cartoon` | the animal open-friendly mouth | dog |

**The thirteen worth trying first**, which could save more: `head.round`,
`head.narrow`, `head.wide`, `ears.round`, `eyes.round-large`, `eyes.cartoon`,
`eyebrows.expressive`, `mouth.simple`, `nose.dot`, `accessory.glasses`,
`accessory.square-glasses`, `accessory.hat`, `accessory.bow-tie`.

If the Heads sheet says `head.round` and `head.narrow` already carry these four
species, the inventory drops to **17 drawings**. That is the first thing to look
at, and it is why Heads is sheet number one.

## The four recipes

Planned drawings in `code`, **shipped drawings in bold**.

| | Cat | Dog | Fox | Bear |
| --- | --- | --- | --- | --- |
| head | `head.animal-round` | `head.animal-round` | `head.animal-narrow` | `head.animal-round` |
| eyes | `eyes.cartoon-large-slit` | `eyes.cartoon-large` | `eyes.alert-almond` | `eyes.cartoon-large` |
| pupils | `pupils.vertical` | `pupils.round` | `pupils.round` | `pupils.round` |
| eyebrows | **`eyebrows.thin`** | **`eyebrows.thin`** | `eyebrows.animal-sharp` | **`eyebrows.thin`** |
| ears | `ears.cat-pointed` | `ears.dog-folded` | `ears.fox-large-pointed` | `ears.bear-round` |
| muzzle | `accessory.muzzle-feline-short` | `accessory.muzzle-canine-medium` | `accessory.muzzle-canine-narrow` | `accessory.muzzle-bear-broad` |
| nose | `nose.triangle-small` | **`nose.cartoon`** | `nose.triangle-small` | `nose.broad-bear` |
| mouth | `mouth.animal-smile` | **`mouth.cartoon`** | `mouth.animal-smile` | **`mouth.small`** |
| whiskers | `accessory.whiskers-three-straight` | — | `accessory.whiskers-two-soft` | — |
| palette | `cat-ginger` *(or `cat-grey`)* | `dog-brown` | `fox-ginger` | `bear-brown` |

The *pupils* row is a reading, not a key: a recipe names the eyes, and the eyes
bring the pupils.

The *whiskers* dashes are the absence of an accessory, never an empty drawing.

Each recipe's direction, in one line:

* **Cat** — friendly, compact, rounded: large eyes, pointed ears, a short feline
  muzzle, a small triangular nose, whiskers you can see.
* **Dog** — friendly, a slightly longer face, folded ears, a medium canine
  muzzle, a rounded nose, no whiskers.
* **Fox** — alert: a narrower face, large pointed ears, a narrow muzzle, a small
  triangular nose, a lighter expression.
* **Bear** — broad and round: small round ears, a broad muzzle, a large nose,
  friendly eyes, no whiskers.

## Palettes

A ginger cat and a grey cat are **one drawing and two palettes**. Nothing is
drawn twice for a colour, and there is no `cat-orange-head`.

| Palette | Species | Skin | Shadow | Outline |
| --- | --- | --- | --- | --- |
| `cat-ginger` | cat | `#e8a45c` | `#f3d7b4` | `#8a4f22` |
| `cat-grey` | cat | `#9aa3ab` | `#d6dbdf` | `#4a545c` |
| `dog-brown` | dog | `#b98150` | `#f0dcc0` | `#6d4526` |
| `fox-ginger` | fox | `#d86a2c` | `#f7e3cd` | `#5e2f14` |
| `bear-brown` | bear | `#8d6243` | `#d9b892` | `#4e3524` |

### Tokens

**No new palette token.** Every colour above is one of the twelve the library
already has: `skin`, `skinShadow`, `outline`, `eyeWhite`, `pupil`, `mouth`,
`tongue`, `teeth`, `accessoryPrimary`, `accessorySecondary`.

`hair` and `hairShadow` have nothing to paint: a `muzzle` face names no hair
slot, and fur is painted into the head and the ears. A token nothing on the face
is painted in simply has no swatch in the Colours row, so nothing is invented
for them.

The muzzle pad and the inner ear need a colour that is not the fur;
`skinShadow` is the only existing token that fits, and it is also what shades
the head. Whether one colour reads for both is an open question below — and
adding a token is a change to the palette contract, so it needs the evidence of
a sheet, not a guess here.

## Mount points

Every planned drawing uses an anchor that already exists. The muzzle and the
whiskers take the candidate MASC-09 proposed for them.

```text
head            head.center      the eight human skulls' own anchor
eyes · pupils   eyes
brows           brows
ears            ears             ← see the open question: the pilot's ears sit on top of the skull
muzzle          nose.center      ← MASC-09's candidate, to be confirmed by the first sheet
nose            nose.center
mouth           mouth.center
whiskers        nose.center      ← MASC-09's candidate
```

## Animation

**No new runtime control.** A cat, a dog, a fox and a bear run on the parameters
a person runs on.

| Group | Installs as | Roles | Controls |
| --- | --- | --- | --- |
| heads | `head` | `head` | `headX`, `headY`, `headTilt` |
| eyes | `eyes` | `leftEye`, `rightEye` | `eyeOpen` (+ `gaze` and `eyelids` under `parts`) |
| pupils | `gaze` | `leftPupil`, `rightPupil` | `lookX`, `lookY`, `pupilScale` |
| brows | `eyebrows` | `leftBrow`, `rightBrow` | `browRaise`, `browTilt` |
| ears | `ears` | `leftEar`, `rightEar` | `earWiggle` |
| muzzles | `accessory` | `element` | none |
| noses | `nose` | `nose` | `noseScrunch` |
| mouths | `mouth` | `mouth` | `mouthOpen`, `smile`, `mouthWidth` |
| whiskers | `accessory` | `element` | none |

The muzzle carries **no** mouth logic. `mouthOpen`, `smile` and `mouthWidth`
stay the semantic mouth's, exactly as on a person — a snout is artwork parented
to the head, and the rig that plays it is the accessory rig it already has.

### 2.5D turn

| Group | Turn profile |
| --- | --- |
| heads, eyes, pupils, brows, noses, mouths | what the category already does |
| ears | **needs a profile** — all four pairs sit on top of the skull, where the three shipped pairs sit at its sides |
| muzzles | **needs a profile** — an accessory that says nothing about the turn does not turn; a snout projects further than the glasses or the moustache, which each declare one |
| whiskers | **needs a profile** — they sweep with the muzzle |

Nothing is written until the drawings exist. The moustache's `{ depth: 0.88,
narrow: true }` is the nearest precedent for a muzzle.

## The sheets

The order the validation planches are produced, coarse to fine — each one is
`node scripts/face-asset-sheet.mjs --slot <slot>` once the drawings are in a
test pack:

```text
1  Heads      2 drawings   ← and the comparison against head.round / head.narrow
2  Eyes       3
3  Pupils     2            ← inside their eye sets
4  Brows      1            ← and the comparison against eyebrows.thin
5  Ears       4            ← the species read; fit matrix on Round, Narrow, Wide, Square
6  Muzzles    4            ← the draw-order question
7  Noses      2
8  Mouths     1
9  Whiskers   2
```

Every drawing goes through the loop in `docs/FACE_ASSET_AUTHORING.md`
individually — alone, auto-fitted, fit matrix — **before** any of them reaches a
pack.

## Still open

Seven questions the drawings have to settle. They are in `PILOT_OPEN_QUESTIONS`
with a proposal each; the three that matter most:

1. **The muzzle hides the mouth.** A muzzle is an accessory painted over the
   face; the nose and the mouth are semantic parts under it. Drawn plainly, the
   snout covers both. The proposal is that the muzzle declares its pads under
   `behind`, as `hair.long` declares `hairBack`, so they paint behind the
   features. The alternative is a snout drawn with the nose and mouth area cut
   out. This is the single biggest graphical risk in the pilot.
2. **The ears move to the top of the skull.** Every shipped pair sits at the
   side at y 118. A fit keeps the offset from the anchor, so this should work —
   and the fit matrix across four skulls is what proves it. If it does not,
   `head.top` is the anchor to try. Their draw order is the same question: ears
   on top want to be in front of the skull, where the shipped ones are behind it.
3. **Two of the drawings may not be needed.** If `head.round` and `head.narrow`
   already carry these four species, the inventory is 17 and not 19.

## Status

Every planned drawing starts at `needs-art`.

```text
needs-art → candidate → approved → rejected
```

This is pilot vocabulary. No face part carries it, and nothing in the editor
reads it; it is how a drawing moves between the artistic review and MASC-10B.
