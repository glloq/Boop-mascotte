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

## MASC-08A — the identities a restyle needs to be safe to do twice

Two hardenings, both about *which drawing* and *which part*. No asset was added
and no slot row was built; this is the layer MASC-08B stands on.

### Soft Cartoon is the style the library is drawn in

```text
head.round                  the drawing, in the base style
  ├── head.round-flat       variant: { of: 'head.round', style: 'flat' }
  ├── head.round-retro      variant: { of: 'head.round', style: 'retro' }
  └── head.round-sketch     variant: { of: 'head.round', style: 'sketch' }
```

**Never** `base → flat → retro`. The chain is one link long — `variant-chained`
has always refused a style of a style — and MASC-08A is what makes that
restriction livable, because every restyle comes home before it goes out again.

`FACE_BASE_STYLE_ID` names the one style that *is* the drawings, and the module
refuses to load if two are marked or none is. That is what lets the catalogue
offer Soft Cartoon without drawing 47 `-soft-cartoon` twins of drawings that
already look exactly like that: asking for the base style resolves to the
drawing itself.

### Canonical identity

`baseAssetId(assetId, library)` answers the drawing a drawing is a style *of*,
and itself when it is not a restyle. Every style question now starts there:

```text
style ''          the drawing named, untouched     ← old presets, unchanged
style base        the canonical base drawing
style other       variant(canonical base, style), or the drawing named
```

The first line is a compatibility contract, not an implementation detail.
`facePresetFromDocument` writes a face down as the drawings it is actually
wearing and asks for no style, so a preset saved from a flat face names the flat
drawings and must go on wearing exactly those.

### Three groups, not two

`restylePlan` sorts every worn part into `replace`, `already` or `kept`.
`already` is the whole point: before it, a face entirely in Soft Cartoon asked
for Soft Cartoon was told *"nothing is drawn in this style yet"* — the opposite
of the truth. `kept` keeps its old meaning and its old guarantee: a part whose
restyle nobody has drawn stays exactly as it is, and is never removed.

The Style card reads the same three numbers as four states — **current**,
**available**, **partial**, **unavailable** — because *current* and
*unavailable* both redraw nothing and mean opposite things.

### The exact part

`planFacePartReplacement`, `commands.plan` and `commands.replace` take an
optional `targetPartId`, and `applyStyle` passes `step.partId` for every
replacement. Without one, nothing changes: a category a face wears one of takes
that one, and a *multiple* category takes the part in the asset's own slot — its
mount point and what it hangs on. That slot rule is enough right up to the
moment two parts share a slot, which is exactly what a muzzle and a pair of
whiskers on a cat's face are. A named part that is not a part of that category
is refused rather than falling back to the search: a silent fallback would
replace the wrong accessory and look like it had worked.

**Known, and for MASC-08B:** two accessories at one mount on one host are not
reachable through the editor today — installing the second replaces the first,
by that same slot rule. The targeting is therefore pre-emptive, proved at the
model and planner level. MASC-08B has to decide whether slots sharing a category
also get distinct mount points (which would make the slot search correct again)
or whether `targetPartId` becomes the install path's answer too.

## MASC-08B — Design ▸ Face is made of visual rows

The question MASC-08A left open is answered: **`targetPartId` becomes the
install path's answer too**, and the slots keep the mount points they have. A
row hands the planner the parts it is allowed to look at, and the mount-point
rule runs inside that.

### Three rows, three parts, one category

```text
Muzzle       → accessory
Whiskers     → accessory
Accessories  → accessory

three visual rows
three semantic parts possible
one semantic category
```

and

```text
Beak → mouth
```

with no new semantic type. `semanticPart.type` is still one of the eleven the
rig has always understood; `muzzle`, `whiskers` and `beak` exist nowhere in a
`ProjectDocument`, in `rig.json` or in the export. A row is authoring, in the
same sense a category is.

`ui/character-builder/visual-rows.js` is the whole of it: a pure regrouping of
what `deriveCharacterParts` read out of the document, returning the same shape —
`categories`, `owners`, `instances`, `detached`, `parents` — so
`categoryForElement`, `instanceRootOf`, `resolveActiveCategory`, `pairOf` and
`characterSnapshot` read rows with no change to any of them. `owners` maps a
piece of artwork to its **row**, which is what makes a click on a whisker open
Whiskers rather than Accessories.

### Which row a part is in

Through the asset it was installed from, never through the artwork:

```text
part.assetId  →  library.get(assetId)  →  assetSlot(asset)  →  the row
```

`wornPartSlot` (in `compatibility.js`) is the one helper, and it reads a variant
through its canonical base, so a restyled muzzle that did not repeat its slot is
still a muzzle. A part whose asset the library does not know — one drawn by
hand, one from a pack that has gone, one from a project older than all of this —
falls back to its **category**, which is the row it has always been shown in.
That is the whole of the migration: there is none.

### Where a card lands

```text
a slot of its own, holding a piece   that piece is what the card replaces
a slot of its own, empty            a new part: never something at the same mount
the catch-all row                   the mount point decides, among this row's parts
```

The middle line is the one that had to be added. *Accessories* and *Muzzle* are
both `accessory` parts at `head.center` with no host, so the mount-point rule
alone could not tell them apart and putting a muzzle on would have taken the
glasses off. `planFacePartReplacement` takes a `within` list — the parts the
search may replace — and `[]` is how a row says *this is a new part here*.
`within: null` is every part of the category, which is what every existing
caller passes and what `applyPreset` still does.

A category a face wears one of is untouched by all this: a face has one mouth,
and a beak replaces it whichever row the card was found in.

A preset applies through the same rule. `planFacePreset` names, for every
multiple-category step, the part already wearing that drawing — or none, so the
install adds one. Without that a preset naming two drawings mounted in the same
place (a muzzle and a pair of whiskers, both at `head.center`) would put the
first on and the second over it, and dress the face in one of the two it asked
for. Applied twice it still grows nothing: a drawing the face already wears goes
back onto the part that is wearing it.

### The invariant

```text
the slot decides what is offered
the category decides what is installed
```

`assetsFor({ slot })` fills the row; `commands.replace(row.categoryId, …)`
installs. Nothing above the library can change what the rig gets.

### Presets follow the Type

Type promised "parts and presets" from MASC-05 on, and until MASC-08B only the
parts followed it. `presetsFor` is now what the Presets row lists, and
`presetMorphology` is how a preset that claims no kind of face gets read:

```text
preset.morphology explicit   →  that
otherwise                    →  the distinctive visual slots of its own drawings
no distinctive slot          →  human
```

So Classic, Professor, Young, Old, Minimal — and Robot — stay human. That last
one is deliberate: the shipped Robot preset is a square head, small eyes and a
bow tie, with neither an antenna nor a panel on it. It is a human-styled robot,
and declaring it `robot` would tell the system something untrue about what it is
made of. The real Robot arrives with the slots that make it one.

A preset whose distinctive slots no single kind of face holds claims nothing
rather than a kind that would be a guess. Tags are not consulted: structural
compatibility comes from morphology and slots, and `tag == cat` is for search.

### Still open, for MASC-09

* **Saving a part still names a category, not a slot.** A part saved from the
  Muzzle row lands under Accessories, because `saveAsPart` writes no `slot` and
  the fallback is the category. It is reachable and installable there; naming
  the visual slot, the morphology and the tags on that form is MASC-08C.
* **The catch-all row's verb.** A dedicated row says "Add" on a card because its
  category is *multiple*; "Use" would read better for a row that holds one
  thing. Cosmetic, and left alone rather than churned before there are drawings.
* **No drawing exists for any of the seven new rows.** Every one of them is
  proved against test fixtures and a test face pack. MASC-09 is where Cat, Dog
  and Fox make them real, and where the fit of a muzzle against a head that was
  never drawn to carry one gets its first look.

## MASC-08C — the authoring loop closes

MASC-01…08B taught Boop to carry `slot`, `morphologies` and `tags`, to filter by
them and to show real visual rows. A part created *in the editor* still lost all
three: it was saved as a semantic category and nothing else, so a pack's muzzle
reshaped and saved came back an accessory, listed beside the glasses. This is
the last arrow of the loop.

```text
Visual Row  →  Save as Part  →  slot metadata  →  library  →  same Visual Row
```

### The slot is what is asked for; the category is derived

```text
slot 'muzzle'  →  FACE_SLOTS.muzzle.category  →  category 'accessory'
slot 'beak'    →  FACE_SLOTS.beak.category    →  category 'mouth'
```

Never both as competing answers. The dropdown's list comes from `FACE_SLOTS`
rather than a copy in the UI, narrowed to the slots whose semantic part the
piece's shapes could fill — the library's own required roles are the test, so
there is no second semantic validator in the interface. The derived category is
stated once, under the field, so nothing is hidden either.

`saveAsPart({ rootId, slot, name, roles, mountPoint, morphologies, tags, description })`.
`category` alone is still read and means the slot of the same name. The asset id
stays `category.slug` — that is what the rig gets, and a listing sorts by it.

### Defaults

```text
slot           the row the piece is already in: for a drawing from the
               library that drawing's own slot, for anything else its category
morphologies   what the drawing says, `[]` included; a suggestion of the kind
               being browsed when a new drawing is saved as a row a person has
               not got; universal otherwise
tags           the drawing's own, or none
```

The first line of `morphologies` is the one that matters: a drawing that said
nothing must not acquire a restriction by being edited. The suggestion is a
suggestion — ticked, and unticked by anybody who disagrees, before saving.

### One way to say universal

Everything the editor writes is `morphologies: []`. `'*'` is still **read**, for
the assets written before this, and is never written again.

### Presets know what kind of face they make

`facePresetFromDocument` writes a morphology when the face says so.

```text
presetMorphology(preset)        the reading   — a claimless preset is a person
presetMorphologyClaim(recipe)   the writing   — silence stays silence
```

Both read the same thing: the visual slots of the recipe's own drawings that
`human` has not got. They differ by one case, on purpose. Reading a claimless
preset as human keeps the six shipped ones classified and is a judgement anybody
can revisit; *writing* `human` into an author's saved preset is a fact they
never stated and could never tell from a choice afterwards.

The Type row is never consulted — it is a session preference about what Design
is offering, and a preset is made of what the mascot is really wearing. Tags are
the caller's and default to none: a species is editorial, and `cat` is never
invented from `muzzle`.

### A row that holds one thing says Use

Cosmetic, and the last thing MASC-08B left behind: a dedicated row's cards said
*Add* because its semantic category is `multiple`. Only the catch-all rows
accumulate, so only they say *Add*. Nothing about where a card lands changed.

### Still open, for MASC-09

* **No drawing exists for any of the seven rows.** Everything above is proved
  against test fixtures and a test face pack. Cat, Dog and Fox are MASC-09, and
  with them the first real look at a muzzle fitted to a head that was never
  drawn to carry one.
* **Nothing searches by tag yet.** `assetTags` and `assetHasTag` are readers and
  that is all; there is no search field, and species discovery is not built.
* **A preset's tags have no field.** `saveAsPreset` carries them, the Save
  preset form does not ask for them. It is a one-input change whenever the
  editorial vocabulary is settled.
* **`Works with` is per part, not per pack.** An author drawing a whole cat
  ticks *Muzzle* on each piece in turn. A pack-level default would be kinder,
  and is a question for whoever authors the first real pack.

## MASC-09 — the geometry contract, and a way to look at it

Seven visual slots exist and nothing is drawn for any of them. Before fifty SVGs
arrive, two things were missing: the contract an author draws against was never
written down, and there was no way to look at one drawing and see what the
layout engine makes of it.

### The contract, stated

`docs/FACE_ASSET_AUTHORING.md` is the new document. In one line: a drawing is
authored in the template face's frame, its `referenceBox` centre is the pivot,
and `fitFacePart` is one similarity — the offset from the template anchor to
that centre, carried to the same anchor on the target face at that head's scale.

```text
template anchor → offset to the box's centre → × scaleReference → target anchor
```

No new anchoring system, and **no new mount point**: the fifteen that exist are
enough until a sheet of real drawings proves otherwise. The seven new slots have
*candidate* anchors (`SLOT_ANCHOR_CANDIDATES`, one table, read by the sheet, the
docs and the tests) and nothing in the editor consults them — `fitFacePart` fits
to the asset's own `mountPoint`, as it always has.

### The review model

`core/face-library/face-asset-review.js` is pure and writes nothing. For one
drawing it answers what the engine sees — slot, category, kinds of face, tags,
mount point *and the one the fit really used*, host, reference box, centre,
canonical base, style, the fit itself — and what is wrong or suspect about it.

It is **not a second validator**. `validateFacePart` still owns what an asset
may say; this adds only what validation cannot reach: whether the layout engine
can place the thing (`box-missing`, `mount-unknown`, `fit-failed`, `fit-scale`)
and whether a style has drifted from the drawing it restyles.

### A style may not move the piece

```text
mountPoint differs · host differs · slot contradicts
centre moved  > 6% of the base box's longer side
size changed  > 15% on either axis
```

`variantGeometryIssues` says so, as warnings on a sheet and never as validation
errors: the library goes on registering the variant, because a restyle whose
author knew what they were doing must stay possible. Silence is inheritance — a
variant repeats neither its slot, its kinds of face nor its tags, and the review
model reads all three through the canonical base.

### The sheet

`npm run face:assets` → `out/face-assets/index.html` and `assets.svg`, both
ignored by git. Three views per drawing — alone with its box, pivot and anchor;
auto-fitted on the reference face; and a fit matrix across Round, Oval, Wide,
Narrow and Square — plus a slot reference page showing where an artist draws
each of the seven new pieces.

Nothing is nudged. The placement is `fitFacePart` over `layoutFromBoxes`, through
the runtime's own transform string, so a piece that lands badly lands badly on
the sheet. `--measure` adds a browser's real bounding boxes, and is optional
because a sheet nobody can generate without a working Chromium is a sheet nobody
generates.

### The mount point survives an edit

The last of the MASC-08C round trip. *Save as a library part* offered the
semantic category's default anchor, so a muzzle anchored at `nose.center`,
reshaped and saved, came back anchored at `head.center` — a piece the author
would have to re-place after every edit. It now offers the anchor the drawing
already uses, and the author can still change it.

### What the built-ins say

All 47 shipped drawings place: every one has a box with a size, an anchor a face
has, a computable centre and a fit at a real scale, and none is moved or resized
on the face it was drawn for. With `--measure`, nine carry a `box-slack` note —
the brows, two noses and mouths, the bald cap and the two moustaches have boxes
about 1.6–2× their ink's height. That is deliberate: a brow's box is the room it
lives in. It is recorded here so the next author reads it as a convention rather
than as a bug.

### Still open, for MASC-10

* **No drawing exists yet.** The pilot is `muzzle` in `soft-cartoon`, with Cat,
  Dog, Fox and Bear as presets inside it; about 25 drawings, each reviewed
  individually before any reaches a pack. The list is in
  `docs/FACE_ASSET_AUTHORING.md`.
* **`crest` has two candidate anchors.** `head.top` is the skull and `hair.top`
  is the top of the hair, which on a bird *is* the crest. The first real crest
  decides; the sheet draws both.
* **The fit is uniform and never rotates.** A piece that needs a different
  proportion on a narrow skull needs a second drawing, not a cleverer fit. Worth
  re-reading once four muzzles exist.
* **`--measure` cannot see a clip.** It skips the overflow reading for a clipped
  fragment rather than reporting a box that is right as wrong.

## MASC-10A — the brief for the first animal faces

Everything from MASC-01 to MASC-09 exists so that adding a species costs
drawings rather than a release. This is the sentence being tested for the first
time: `docs/MUZZLE_SOFT_CARTOON_PILOT.md` and
`core/face-library/pilots/muzzle-soft-cartoon.js` are the cahier des charges for
the **Soft Cartoon — Face Parts V1** sheet, in `muzzle` / `soft-cartoon`.

**Nothing is drawn and nothing is registered.** The manifest is data, read by
the document and by one test; `BUILTIN_FACE_PARTS` is still 47 and
`FACE_PRESET_LIBRARY` still holds the six it always did.

### The sheet is the inventory

Eight sections, forty-five drawings, each entry carrying the sheet's own French
caption under `sheetLabel` so the planche and the manifest are one list read two
ways.

```text
6  heads      6  eye sets    5  brows     8  ear pairs
6  muzzles    5  noses       5  mouths    4  sets of whiskers
```

### Six recipes, not six libraries

```text
45  drawings on the sheet
38  claimed by a recipe   ← six species over eight slots would be 48
 7  catalogue pieces      ← expressions and species an author picks themselves
 6  recipes               ← Cat · Dog · Fox · Bear · Rabbit · Wolf
```

Six species and not four: the sheet draws a rabbit's ears, a rodent's muzzle, a
button nose and a wolf's ears, which is a rabbit and a wolf fully specified.
Leaving them unnamed would be drawing pieces for nobody. A fox and a wolf share
their eyes and their brows; a cat and a fox share a nose; a dog and a wolf share
a muzzle.

The seven the recipes do not name are the **catalogue** — two eye expressions, a
worried brow, two ear pairs, a second feline muzzle, a wide happy mouth. A parts
library exists to be combined, and the sheet's own header says so.

### Two captions settled two questions

**"6 styles d'yeux (pupilles intégrées)"** confirms what the library already
does: an eye set draws its own pupils and lids, there has never been a
standalone pupils card, and `PRESET_PART_ORDER` does not let a preset name one.
The two pupil families are properties of the eye drawings, and a recipe reaches
them through the eyes.

**"6 museaux modulaires (sans nez ni bouche)"** answers the pilot's biggest
graphical risk. A muzzle is a **pad**, drawn with the nose and mouth area left
open, and the semantic nose and mouth sit on top of it keeping every control.
What is left is the draw order, which `behind` fixes.

### The audit, after the sheet

All 47 shipped drawings were judged, each with a reason. The four that were
going to stand in for an animal brow, nose and mouths moved back to
`possible-reuse` once the sheet drew its own: **no recipe leans on a shipped
drawing**, and those four are the fallback if a planned one is cut. What the
audit is worth now is the other direction — glasses, a hat and a bow tie are
universal, and an animal may wear them.

Beside it sits a second discipline: two planned drawings in one slot wanted by
one species must each say how they differ, and `duplicateConcerns` checks the
line was written.

### Colours are palettes

Seven palettes following the sheet's own head colours, no new token, no drawing
named for a colour. `hair` and `hairShadow` have nothing to paint on an animal
and are simply unused. The muzzle pad and the inner ear take `skinShadow`, which
is the one colour question left open.

### No new control, and three turn profiles to write

Six species run on the parameters a person runs on. What is genuinely new is the
2.5D turn: an accessory that says nothing about it does not turn, so the six
muzzles and the four sets of whiskers each need a profile, and so do the eight
ear pairs, which sit on top of the skull where every shipped pair sits at its
side. Nothing is written until the drawings exist.

### Still open, for MASC-10B

* **Muzzle draw order.** The shape is settled; an accessory installed with
  nothing before it still lands last in the group. `behind` is the fix, one line
  per drawing.
* **The happy eyes are drawn shut** and have no pupil to move, while `gaze`
  requires two. Either it names no `parts.gaze`, or it hides a pupil behind the
  arc.
* **The ears move to the top of the skull**, and the rabbit's are taller than
  the head is high against an artboard with 60 units of headroom. The fit matrix
  across four skulls is what proves it.
* **A pad colour may need a thirteenth token.** Try `skinShadow` first.
