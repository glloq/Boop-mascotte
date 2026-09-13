# Beak · Soft Cartoon — the first bird faces

The third body of real content in the face library: the brief (MASC-12A) and
the thirty drawings answering it (MASC-12B), following the delivered art
direction:

```text
sheet        Bibliothèque modulaire Boop — Oiseaux / Beak (BIRD-10A)
morphology   beak
style        soft-cartoon — the style the library is drawn in
species      Hibou · Canard · Perroquet · Corbeau · Oiseau mignon · Oiseau fin
```

**All thirty are drawn**, in `core/face-library/builtin/birds/`, and ship in
`BUILTIN_FACE_PARTS` alongside the six presets. The library holds 150 drawings
and 22 presets; `npm run face:assets` reviews all of them with no geometry
warnings. **`beak` is available**, which makes four kinds of face offered out of
five.

The manifest is still `core/face-library/pilots/beak-soft-cartoon.js`: data
only, written by hand and never derived from the library, so the two can
disagree — and a test asserts they do not, id for id, slot for slot, anchor for
anchor and name for name.

The geometry contract is `docs/FACE_ASSET_AUTHORING.md`; the library contract is
`docs/FACE_PART_LIBRARY.md`; the two pilots this one is modelled on are
`docs/MUZZLE_SOFT_CARTOON_PILOT.md` and `docs/ROBOT_SOFT_CARTOON_PILOT.md`.

## The finding, first

**MASC-01 drew a bird correctly.** The planche's six rows land on six slots, and
every one of them is already in the `beak` morphology's own list:

```text
1  Fonds de tête          6   → head
2  Yeux                   6   → eyes       "pupilles intégrées", again
3  Formes d'yeux/sourcils 5   → eyebrows   "à superposer"
4  Becs                   6   → beak       ← the slot that makes a bird
5  Crêtes / plumes        6   → crest      ← and the other one
6  Accessoires            4   → accessory
```

`beak` offers `head · eyes · pupils · eyebrows · beak · crest · accessory`, and
that is the planche exactly — down to what it leaves out. There is no nose row,
no mouth row, no ears row and no hair row on the sheet, and no such slot in the
morphology. A beak **is** the mouth, and a crest is what a bird has instead of
hair.

Where MASC-11B had to amend `MORPHOLOGY_TABLE` before a line could be drawn,
this pilot amends nothing. `pupils` is the one slot offered and not drawn for,
and that is correct too: an eye set brings its own, and no preset may name one.

## Thirty drawings, not thirty-three

The planche draws thirty-three pieces and two of them already exist. Row 6 is
captioned *"4 accessoires simples et compatibles"*, and compatible is exactly
what the library's accessories are — an accessory that declares no
`morphologies` is universal, so a drawing made for a person is already a drawing
made for a bird.

```text
accessory.glasses   is  Lunettes rondes     ← reuse, whole
accessory.bow-tie   is  Nœud papillon       ← reuse, whole
Monocle                                     ← one drawing
Petit chapeau                               ← a question, not a drawing
```

Unlike ROBOT-V1, no row here is a colour run: the six heads are six silhouettes
and the six beaks six shapes. Thirty drawings is thirty drawings.

## Inventory

Every planned drawing, in the planche's own order, under its own caption.

### 1 · Fonds de tête — 6
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Hibou (avec aigrettes) | `head.bird-owl` | Owl head | owl |
| Canard (ronde et large) | `head.bird-duck` | Duck head | duck |
| Perroquet (plumes latérales) | `head.bird-parrot` | Parrot head | parrot |
| Corbeau (anguleuse) | `head.bird-crow` | Crow head | crow |
| Oiseau mignon (ronde) | `head.bird-cute` | Cute bird head | cute |
| Oiseau fin (élancée) | `head.bird-slim` | Slim bird head | slim |

A head is the bare feathered silhouette with nothing on it, as an animal head is
a bare fur one. The owl's tufts and the parrot's side feathers belong to the
*silhouette* — that is what the captions say — and are short where the crests
are tall.

### 2 · Yeux — 6
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Grands ronds (style hibou) | `eyes.bird-round-large` | Big round | owl |
| Doux (amicaux) | `eyes.bird-soft` | Soft | duck |
| Vifs (alerte) | `eyes.bird-bright` | Bright | parrot |
| Endormis (détendus) | `eyes.bird-sleepy` | Sleepy | slim |
| Joyeux (mignons) | `eyes.bird-happy` | Happy | cute |
| Perçants (intenses) | `eyes.bird-piercing` | Piercing | crow |

### 3 · Formes d'yeux / sourcils — 5
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| En colère (froncés) | `eyebrows.bird-angry` | Angry | crow |
| Curieux (haussés) | `eyebrows.bird-curious` | Curious | **duck, parrot** |
| Endormis (détendus) | `eyebrows.bird-relaxed` | Relaxed | owl |
| Joyeux (courbés) | `eyebrows.bird-happy` | Happy | cute |
| Perçants (anguleux) | `eyebrows.bird-sharp` | Sharp | slim |

Five for six birds: the duck and the parrot are both curious, and that is the
only piece two birds share on this sheet.

### 4 · Becs — 6
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Bec hibou (court et rond) | `mouth.beak-owl` | Owl beak | owl |
| Bec canard (plat et large) | `mouth.beak-duck` | Duck beak | duck |
| Bec perroquet (courbé) | `mouth.beak-parrot` | Parrot beak | parrot |
| Bec corbeau (pointu moyen) | `mouth.beak-crow` | Crow beak | crow |
| Petit bec (mignon) | `mouth.beak-small` | Small beak | slim |
| Bec large (amical) | `mouth.beak-wide` | Wide beak | cute |

**A beak's id begins `mouth.`, and that is not a slip.** A slot is what an
author picks from and a category is what the rig understands; `beak` is the
slot, `mouth` is the category, and a beak keeps `mouthOpen`, `smile` and
`mouthWidth` because a beak opens.

The planche binds no beak to a head — it draws six of each and leaves the
pairing to whoever combines them — so the recipes pair them for the face they
make rather than for the mood in the caption. The cute bird gets the broad
friendly beak; the slim one gets the small neat beak.

### 5 · Crêtes / plumes — 6
| Planche | Id | Nom | Pour |
| --- | --- | --- | --- |
| Aigrettes hibou (pointues) | `accessory.crest-owl-tufts` | Owl tufts | owl |
| Crête simple (3 plumes) | `accessory.crest-simple` | Simple crest | slim |
| Touffe ébouriffée (désordonnée) | `accessory.crest-messy-tuft` | Messy tuft | crow |
| Plume lisse (simple) | `accessory.crest-smooth-feather` | Smooth feather | duck |
| Crête perroquet (haute) | `accessory.crest-parrot-tall` | Parrot crest | parrot |
| Touffe ronde (mignonne) | `accessory.crest-round-tuft` | Round tuft | cute |

### 6 · Accessoires — 4, of which one is drawn
| Planche | Id | Statut |
| --- | --- | --- |
| Lunettes rondes (classiques) | `accessory.glasses` | **reuse**, whole |
| Nœud papillon (élégant) | `accessory.bow-tie` | **reuse**, whole |
| Monocle (distingué) | `accessory.monocle` | one drawing, universal, at `eye.right` |
| Petit chapeau (stylisé) | `accessory.hat`? | an open question |

The monocle ships with **no `morphologies` at all** — universal, like the six
accessories already in the library. Everything else in this pilot says `beak`,
because an owl's beak on a person is not a look anybody asked for; a monocle is
not like that.

## The six recipes

| | Hibou | Canard | Perroquet | Corbeau | Mignon | Fin |
| --- | --- | --- | --- | --- | --- | --- |
| head | `bird-owl` | `bird-duck` | `bird-parrot` | `bird-crow` | `bird-cute` | `bird-slim` |
| eyes | `bird-round-large` | `bird-soft` | `bird-bright` | `bird-piercing` | `bird-happy` | `bird-sleepy` |
| eyebrows | `bird-relaxed` | `bird-curious` | `bird-curious` | `bird-angry` | `bird-happy` | `bird-sharp` |
| beak | `beak-owl` | `beak-duck` | `beak-parrot` | `beak-crow` | `beak-wide` | `beak-small` |
| crest | `crest-owl-tufts` | `crest-smooth-feather` | `crest-parrot-tall` | `crest-messy-tuft` | `crest-round-tuft` | `crest-simple` |
| palette | `bird-owl-cream` | `bird-duck-cream` | `bird-parrot-orange` | `bird-crow-slate` | `bird-cute-blue` | `bird-slim-amber` |

**Four parts and one accessory each**, and no nose, no ears, no hair and no
facial hair. Not an omission: the morphology offers none of them.

Thirty pieces named across six birds, over twenty-nine drawings — the one
overlap being the curious brow.

## Palettes

Six plumages following the planche's own head colours. No new token: a feather
is `skin`, its shading `skinShadow`, its edge `outline`; the beak takes
`accessoryPrimary` and the crest `accessorySecondary`, because both are what a
bird is *coloured* by rather than what it is made of.

**`hair`, `hairShadow`, `tongue` and `teeth` paint nothing.** There is no hair
slot in a `beak` face, and a beak has neither a tongue nor teeth. The manifest
leaves all four out; a registered palette carries all twelve, so MASC-12B fills
them in at registration.

## What the drawings settled

Eight questions, **none of them blocking** — which was the difference between
this pilot and the robot one, and stayed true: every one was about a drawing
rather than about the shape of the library.

**The crest anchor, and MASC-09's question closed.** It gave the crest two
candidates — `head.top`, the skull, and `hair.top`, the top of whatever hair the
face has, "which on a bird *is* the crest" — and said the first real crest would
decide. It is **`head.top`**, and the argument settled it without waiting for
the drawings: a `beak` face offers no hair slot at all, so `hair.top` would be
an anchor measured from something that can never be there. All six crests are
there, and the test that asserts it also asserts the reason.

**A beak is a mouth, and the group is what the role names.** `mouthOpen` is a
`scaleY` on whatever the `mouth` role names, so the beak stretches about its own
centre and gapes. The two mandibles are separate paths *inside* that group —
which is what makes the seam read, not an attempt to move them independently,
which would need a role the mouth part has not got. The lower is painted first
and the upper over it, because that is how a beak closes.

**And a beak is not where a mouth is.** All six are drawn well above the
template's lip line, taking the middle of the face. The fit keeps the offset
from the anchor to the box centre, so a part saying "higher than a mouth" costs
nothing and lands where it was drawn.

**A bird head keeps its jaw**, where a robot shell has none: a feathered head is
soft, so it ships the same outline twice, at rest and dropped. What a bird has
not got is a *separate* mouth — `jawOpen` drops the face and `mouthOpen` opens
the beak, and the two read together.

**The owl's tufts appear twice** and both are wanted, so the head's are short
and the crest's tall. An owl wearing both reads as one bird.

**The parrot's side feathers** stay inside the head's own reference box: three
short feathers against the cheek, not a second silhouette. The review sheet
reports no overflow.

**The small hat** is still open — the one question these drawings did not need
to answer, because row 6 cost exactly one drawing either way.

## The sheets

```text
1  Heads         6  ← the parrot's side feathers against the reference box
2  Eyes          6  ← pupils reviewed inside them
3  Brows         5  ← do they read as brows or as a second pair of lids
4  Beaks         6  ← two mandibles, and whether it still reads shut at rest
5  Crests        6  ← head.top confirmed; the parrot crest against the headroom
6  Accessories   1  ← the monocle, and the shipped hat on six birds
```

Every drawing goes through the loop in `docs/FACE_ASSET_AUTHORING.md`
individually — alone, auto-fitted, fit matrix. All thirty have, and all thirty
come back with no geometry warning.

## Status

Every drawing is `candidate`: it exists, and nobody has signed it off.

```text
needs-art → candidate → approved → rejected
```

This is pilot vocabulary. No face part carries it, and nothing in the editor
reads it; it is how a drawing moves from the brief through the artistic review.
`npm run face:assets` is where that review happens.

One thing the baseline noticed and this document should carry: **the beaks sign
five different turn words between six drawings**, where every other row in the
library signs one per row. `tests/fixtures/head-turn-baseline.js` records the
observation and deliberately does not explain it — the beaks are the only part
of any pack whose role names a group of two paths rather than a single shape,
and the six sit at six different heights on the face. The baseline's job is to
notice if that changes.
