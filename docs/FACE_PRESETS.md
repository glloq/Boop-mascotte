# Face style presets

A preset is a **face in one press**: which library part plays each part of
the face, which accessories it wears, which *style* those drawings are
wanted in, the colours it is painted in, what each hand rests on and where
a part sits when it is not exactly where the library puts it. It is a recipe over the [face part library](FACE_PART_LIBRARY.md),
never a project: applying one dresses *the face that is there*, and the rig
underneath -- the movements, the controls, the expressions -- is untouched
(roadmap phases 13, 14, 28 and 46). The model and the code are in
`docs/FACE_PART_LIBRARY.md`, "Presets"; this page is the reader's guide.

## What a preset holds

```json
{ "id": "professor", "name": "Professor", "description": "Bald, glasses, a moustache.",
  "parts": { "head": "head.oval", "ears": "ears.round", "eyes": "eyes.round-small", "eyebrows": "eyebrows.thick",
             "nose": "nose.hook", "mouth": "mouth.small", "hair": "hair.bald", "facialHair": "facialhair.moustache" },
  "accessories": ["accessory.glasses"],
  "style": "workshop",
  "morphology": "muzzle",
  "tags": ["cat", "pet"],
  "palette": "warm",
  "hands": { "left": "fist", "right": "fist" },
  "placements": { "mouth": { "x": 5, "y": -3, "rotation": 4, "scale": 1.2 }, "accessory.glasses": { "x": 7, "y": -2 } } }
```

| Field | Meaning | Required |
| --- | --- | --- |
| `id`, `name` | Lower-case id; the name the card shows | yes |
| `parts` | One library asset per category the face wears one of (`head`, `ears`, `eyes`, `eyebrows`, `nose`, `mouth`, `hair`, `facialHair`); a category not named is left as it is | at least one |
| `accessories` | The assets of the categories a face wears several of (glasses, a hat, an earring); any accessory the preset does not name comes off | no |
| `style` | The look it wants its parts in: a name (lower case, digits, dashes). Where the library holds a drawing that restyles one this preset names into that style, that restyle is what goes on; where it does not, the drawing named goes on as it is. A part wanted differently from the rest is named by its own id | no |
| `morphology` | The kind of face it makes: `human`, `muzzle`, `beak`, `robot` or `monster` (`docs/MASC_LIBRARY_BASELINE.md`; MASC-03). **This is where a species lives** — `cat`, `dog` and `fox` are presets inside `muzzle`, never morphologies of their own, which is why adding one costs drawings rather than a release. Every part the preset names must be drawn for that kind, and an asset that says nothing is drawn for every kind | no |
| `tags` | Words an author finds it by: `cat`, `pet`, `friendly`. Lower case, digits and dashes | no |
| `palette` | A named palette (`warm`, `cool`, `pale`, `robot`) or the tokens themselves (`{ "skin": "#f9d9b0", … }`), each a colour by its syntax (`#hex`, a named colour, `rgb()`/`hsl()`) | no |
| `hands` | What each hand rests on: `left` and `right`, a drawing id (`fist`, `open`, `point`, `peace`, `thumbsUp`, `relaxed`) | no |
| `placements` | Where a part sits over the place its fit gives it: a move, a turn and a size per axis (`scale` for both, or `scaleX` and `scaleY`; a flipped part is a negative one), all relative. Named by its category where the face wears one of it, and by its asset id where it wears several -- `accessory` says nothing about which of a hat and glasses. A placement the preset does not also name under `parts` or `accessories` is refused, never dropped | no |

## The six built-in presets

Classic Cartoon, Professor, Young, Old, Robot and Minimal (roadmap phase
46). They are chosen to look nothing alike -- a round face with a spiky
fringe, a bald professor with a hook nose, a robot with square glasses and
fists -- so that one fact is visible: every one of them blinks, looks,
smiles, talks and turns with the same controls, because the parts they name
carry the same movements (`docs/FACE_PART_LIBRARY.md`, "Animation
compatibility"; every asset's movements are driven through the runtime's
frame compiler in `face-part-animation-matrix.test.js`).

None of the six asks for a style or claims a kind of face yet: the axis is here
(V3-05) and the metadata is here (MASC-03); the restyled drawings and the
presets that ask for them are MASC-06's and MASC-08's.

A preset asking for a style is a **wish**, not a demand. Where the library holds
the restyle, the restyle goes on; where it does not, the drawing the preset
named goes on unchanged. So a style that is in the catalogue with nothing drawn
in it yet is perfectly valid, and a style that is in no catalogue *and* that
nobody has drawn is reported as a warning rather than a refusal: it is almost
always a typo, and a typo here silently dresses the face in the wrong drawings,
but refusing would make it impossible to ship a preset before its restyles.

## Using presets

In the **Character Builder** the first row of the parts column is
*Presets*: one card with a picture per preset, the one the face wears
marked *Current*. The picture is the preset's own parts drawn in its
colours, from the same artwork that goes on the face, never a file kept
beside it.

- **A press applies the preset** as one undo step: the parts it names go
  on fresh -- where the library puts them on this head, whatever the author
  had moved -- the skull first; the accessories it names go on and the rest
  come off; each part it places goes where it puts it; each hand it names
  rests on that drawing; then the colours. A step that cannot run because
  the face has nothing to run it on (a hand not drawn, a colour nothing is
  painted as) is skipped, not a refusal. One undo takes the whole preset
  off.
- **Which preset the face wears** is read from the face every time: the
  first preset whose named parts and whose whole set of accessories are
  what the face has -- *in its own style*, since what is compared is the
  drawings it puts on, not the ids it writes down. Two presets over the
  same parts in two styles are two faces. Colours, moves and hands are the
  author's to change, so they are not part of the reading. Nothing is
  stored.
- **Reset** (on the worn preset's card) applies it again: every part back
  where it puts it.
- **Save the face as a preset** reads the face into a preset of the
  author's own: the parts it wears -- a restyled drawing under its own id,
  because a face has parts and not a style -- its colours, where each part
  sits over its fit, and what each hand rests on. It is a card marked *Mine*, with
  *Forget* beside it, kept in this browser (`localStorage`, key
  `boop.facePresets`) and read back on the next open. Built-in presets
  stay.
- **Presets from a pack** arrive with a [face pack](FACE_PART_LIBRARY.md#face-packs)
  (`docs/FACE_PART_LIBRARY.md`, "Face packs"): cards marked *Pack*, kept
  and forgotten like the author's own.

## Styles: a preset with its own look

Six presets are about to be restyled, and each of them wants its own
glasses, its own hat, its own skull. If asking for that meant shipping a
second pair of glasses as a card, the parts column would hold six of
everything and nobody could read it. So a preset asks by **name**:

```json
{ "id": "workshop-professor", "name": "Workshop professor", "style": "workshop",
  "parts": { "head": "head.oval", "mouth": "mouth.small" }, "accessories": ["accessory.glasses"] }
```

and a drawing says which drawing it restyles, and into which style:

```json
{ "id": "accessory.glasses-workshop", "category": "accessory", "name": "Glasses, workshop",
  "variant": { "of": "accessory.glasses", "style": "workshop" },
  "artwork": "<g id=\"accessory-glasses-workshop\">…</g>", "roles": { "element": "accessory" },
  "paletteRoles": { "accessory": { "stroke": "accessorySecondary" } },
  "referenceBox": { "x": 27, "y": 87, "width": 186, "height": 52 } }
```

- **The preset wears what it can get.** A part the style has a drawing for
  goes on restyled; a part it has not goes on as named. So a style can be
  drawn one part at a time, and a preset asking for a style nobody has drawn
  yet is exactly the preset it was before.
- **A restyle is not a card.** It never appears in the parts column: it
  belongs to the drawing it restyles, which is the card. A face wearing the
  restyle marks that card *Current*, and pressing it puts the card's own
  drawing on — a change of look, asked for.
- **It is still reachable.** The part remembers the drawing it came from, so
  *Reset → Restore library drawing* puts the restyle back, and the inspector
  names it. A preset can also name a restyle directly by its own id, which
  is how one part is wanted differently from the rest of the face.
- **The card's picture** is drawn from the restyled artwork, like every
  other preset picture — from the artwork itself, never a file beside it.
- **One accessory of two, in its own colour.** The colours of a preset are
  face-wide by design: a token changes everywhere it is used. An accessory
  that wants a colour of its own gets it by being a restyle that plays a
  different token — the workshop glasses on the trim colour, the bow tie
  beside them on the accessory colour — or by simply being drawn in a colour
  that plays no token at all. There is no per-accessory colour on a preset,
  so there is nothing for *Save as a preset* to lose.
- **A whole look arrives in one file.** A [face pack](FACE_PART_LIBRARY.md#face-packs)
  holds the drawings of a style and the presets that ask for it, taken in
  all or nothing.

## Writing one by hand

A preset is validated when it is registered (`validateFacePreset`): its id
is lower case, digits and dashes and not taken; it names at least one part;
every part is a library asset of the category it is named for; every
accessory is an asset of a category a face wears several of; a named
palette exists; a hand drawing id is one the hand vocabulary knows; a
style is a name of lower-case letters, digits and dashes (a style the
library has no drawing for is not an error: the preset wears what it
names); a placement's category is one a part goes on; a category a face wears
several of (glasses, a hat) is named under `accessories`, never under
`parts` (`parts-category-accessory`), and a category that comes with
another part (the pupils with the eyes) is not named at all. A preset
written into a pack's `presets` list may name a part of the same pack.

## Files

```text
project/editor/core/face-library/face-presets.js     the presets, the palettes, the registry, the style axis (styledAsset), planning and applying, the picture, the browser store
project/editor/core/face-library/face-part-registry.js  list, cards, variant and variantsOf: where a style is held and reached
project/editor/ui/character-builder/preset-browser.js  the cards
project/editor/core/tests/face-presets.test.js
tests/e2e/ux45-character-builder.spec.js               the presets scenario, and the one-minute path that starts from one
```
