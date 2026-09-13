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
