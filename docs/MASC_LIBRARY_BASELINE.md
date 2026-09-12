# MASC-00 — the library the morphology work is measured against

The plan (MASC-01 … MASC-12) adds three ideas to the face library: a
**morphology** (what kind of creature this is), a **style** (what look its
drawings are in) and a **visual slot** (what the author picks in Design, as
opposed to what the rig understands). None of them is a runtime concept, and
none of them may become one: the exported mascot sees a semantic rig, exactly
as it does today.

The risk in work of that shape is not the screen that breaks loudly. It is the
capability that quietly changes meaning — an asset that stops being offered
because a field it never had is now required, a preset that resolves to another
drawing, a pack that imported yesterday and is refused today. Nobody notices
until somebody's saved face opens wrong.

So before anything is added, this is the inventory: **what the library can
already do, which module owns it, what tests it, and what the plan does to it.**

## The capability matrix

| Capability | Owned by | Shape | Covered by | MASC does |
| --- | --- | --- | --- | --- |
| An asset's shape and defaults | `face-part-model.js` (`normalizeFacePart`) | 20 fields, frozen; missing values normalise rather than throw | `face-part-model.test.js` | MASC-02 adds `slot`, `morphologies`, `tags` — all optional |
| What may enter the library | `face-part-validation.js` (`validateFacePart`) | issues with `severity`, `code`, `field`; errors keep it out, warnings let it in | `face-part-validation.test.js` | MASC-02 validates the three new fields; absence stays legal |
| The categories | `face-part-model.js` (`FACE_PART_CATEGORIES`) | 11, each naming the semantic part it becomes | `face-part-model.test.js` | untouched — MASC-07 adds *slots* over them, as a UI layer |
| The library itself | `face-part-registry.js` | `register`, `registerMany` (all-or-nothing), `list`, `cards`, `variant`, `variantsOf` | `face-part-registry.test.js` | MASC-04 reads it; nothing here changes |
| The style axis | `face-part-model.js` (`variant`), registry (`variant()`) | `variant: { of, style }`; a variant is reached *through* the drawing it restyles, never listed beside it | `face-part-validation.test.js`, `face-part-registry.test.js` | MASC-01 gives the styles a catalogue; the mechanism is not replaced |
| A preset | `face-presets.js` | parts, accessories, `style`, palette, hands, placements | `face-presets.test.js` | MASC-03 adds `morphology` and `tags`; `style` is reused as-is |
| Resolving a preset's style | `face-presets.js` (`styledAsset`) | the restyle where the library holds one, **the named asset where it does not** | `face-presets.test.js` | untouched — this is the fallback the whole plan rests on |
| Which preset a face wears | `face-presets.js` (`presetOfFace`) | read from the parts' `assetId`, never stored; the style is part of the identity | `face-presets.test.js` | untouched |
| Face packs | `face-pack.js` | one JSON of `parts[]` + `presets[]`, validated against library *and* pack, all or nothing | `face-pack.test.js` | MASC-02/03 carry the new fields through; the contract does not move |
| The author's own parts and presets | `face-part-registry.js`, `face-presets.js` (`loadCustom*`) | `boop.faceParts`, `boop.facePresets`; a part the validator now refuses is skipped, never crashes | `face-part-registry.test.js`, `face-presets.test.js` | MASC-02 must keep an old saved part loadable |
| The Character Builder | `ui/character-builder/` | category list → cards → install; presets in their own browser | `character-builder.test.js` | MASC-05/06/07 add Type, Style and slot filtering above it |
| Hand states | `core/hands/hand-state-model.js` | a library per hand, six verbs, the two sides independent | `hand-states.test.js` | MASC-12, and not before |
| Hand sets | `core/hands/hand-set-install.js` | one active set, plus the author's own gestures | `hand-sets.test.js`, `hand-set-install.test.js` | MASC-12 turns this into a catalogue |

## What the library actually holds today

```text
47 assets      head 8 · eyes 5 · eyebrows 5 · nose 4 · mouth 5 · ears 3
               hair 6 · facialHair 5 · accessory 6 · pupils 0 · eyelids 0
 0 variants    the style axis is built, and nothing uses it
 6 presets     classic · professor · young · old · robot · minimal
               every one of them with style: ''
```

That last line is the finding this milestone exists to write down. **The style
axis is complete and unexercised**: `asset.variant`, `registry.variant()`,
`preset.style`, `styledAsset()` and the fallback to the named drawing are all
there, tested, and reach nothing, because no shipped asset declares a variant
and no shipped preset asks for a style. MASC-06 does not build a theming system;
it fills in the one that is already here.

The categories, equally, are a **human** face read literally — head, eyes,
pupils, eyelids, brows, nose, mouth, ears, hair, facial hair, accessories. They
carry a cat by bending `accessory`, and they cannot carry a beak or a muzzle
honestly. That is the gap MASC-01 and MASC-07 are for, and the answer is a slot
layer above the categories rather than new semantic parts underneath them.

## The four invariants, as tests

`core/tests/masc00-baseline.test.js` writes down the behaviours the plan must
not change, against the models rather than the panels:

```text
variant resolution     a restyle is reached through its base and never listed beside it
preset fallback        a style nobody drew leaves the drawing the preset named
pack import            all or nothing, across parts and the presets that name them
custom assets          an asset with none of tomorrow's metadata still enters
```

They are deliberately model-level. A test that drove the Character Builder would
have to be rewritten by MASC-05, which is the change most likely to break the
invariant — and a safety net re-tied by the change it is watching is not one.

## What MASC-00 deliberately does not do

No field is added, no UI moves, no asset is drawn. The point of a baseline is
that everything after it has something to be compared to.

## What each milestone did

| Item | What it added | Held to it by |
| --- | --- | --- |
| MASC-00 | The matrix above, and four invariants as tests | `masc00-baseline.test.js` |
| MASC-01 | `face-morphologies.js`, `face-styles.js`: slots, five kinds, one style | `masc01-morphology.test.js` |
| MASC-02 | `slot`, `morphologies`, `tags` on an asset — all optional | `masc02-part-metadata.test.js` |
| MASC-03 | `morphology`, `tags` on a preset; `style` reused | `masc03-preset-metadata.test.js` |
| MASC-04 | `compatibility.js`: the pure layer that only answers | `masc04-compatibility.test.js` |
| MASC-05 | Type in Design ▸ Face | `masc05-type.test.js`, `ux45-character-builder.spec.js` |
| MASC-06 | Style in Design ▸ Face, and `applyStyle` | `masc06-style.test.js`, `ux45-character-builder.spec.js` |
| MASC-07 | The parts on offer follow the kind of face | `masc07-filtering.test.js` |

### MASC-07, and what is deliberately left to MASC-08

Filtering is done: the rows are the slots of the kind of face being browsed,
and the cards in each are the drawings that suit it. Two rules hold it
together — the slot decides what is **offered** and the semantic category still
decides what is **installed**, so nothing above the library can change what the
rig gets; and the filter never hides a row the mascot is wearing something in.
A human face browsed as a bird still shows its hair, because hiding the only
door to a part somebody has already put on is precisely the failure this layer
exists to prevent.

What is **not** here is a row of its own for the six slots no category shares —
Muzzle, Whiskers, Beak, Horns, Antenna, Panels. The builder keys its open row,
its selection and its inspector by *category* id, and giving rows their own slot
identity means threading that distinction through `character-model.js` and the
795-line component around it. That is worth doing exactly once, against real
drawings: today every one of those rows could only say "nothing drawn for this
yet", and a structural refactor whose only test is an empty list is a refactor
nobody can check. It belongs with MASC-08's pilot pack, where a Muzzle row has a
muzzle in it.

Until then a slotted drawing is reachable and installable — it is simply
offered under the category it installs as, which is where it already works.
