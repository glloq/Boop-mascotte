# Face style presets

A preset is a **face in one press**: which library part plays each part of
the face, which accessories it wears, the colours it is painted in, what
each hand rests on and where a part sits when it is not exactly where the
library puts it. It is a recipe over the [face part library](FACE_PART_LIBRARY.md),
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
  "palette": "warm",
  "hands": { "left": "fist", "right": "fist" },
  "placements": { "mouth": { "x": 5, "y": -3, "rotation": 4, "scale": 1.2 } } }
```

| Field | Meaning | Required |
| --- | --- | --- |
| `id`, `name` | Lower-case id; the name the card shows | yes |
| `parts` | One library asset per category the face wears one of (`head`, `ears`, `eyes`, `eyebrows`, `nose`, `mouth`, `hair`, `facialHair`); a category not named is left as it is | at least one |
| `accessories` | The assets of the categories a face wears several of (glasses, a hat, an earring); any accessory the preset does not name comes off | no |
| `palette` | A named palette (`warm`, `cool`, `pale`, `robot`) or the tokens themselves (`{ "skin": "#f9d9b0", … }`) | no |
| `hands` | What each hand rests on: `left` and `right`, a drawing id (`fist`, `open`, `point`, `peace`, `thumbsUp`, `relaxed`) | no |
| `placements` | Where a part sits over the place its fit gives it, per category: a move, a turn and a size per axis (`scale` for both, or `scaleX` and `scaleY`; a flipped part is a negative one), all relative | no |

## The six built-in presets

Classic Cartoon, Professor, Young, Old, Robot and Minimal (roadmap phase
46). They are chosen to look nothing alike -- a round face with a spiky
fringe, a bald professor with a hook nose, a robot with square glasses and
fists -- so that one fact is visible: every one of them blinks, looks,
smiles, talks and turns with the same controls, because the parts they name
carry the same movements (`docs/FACE_PART_LIBRARY.md`, "Animation
compatibility"; every asset's movements are driven through the runtime's
frame compiler in `face-part-animation-matrix.test.js`).

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
  what the face has. Colours, moves and hands are the author's to change,
  so they are not part of the reading. Nothing is stored.
- **Reset** (on the worn preset's card) applies it again: every part back
  where it puts it.
- **Save the face as a preset** reads the face into a preset of the
  author's own: the parts it wears, its colours, where each part sits over
  its fit, and what each hand rests on. It is a card marked *Mine*, with
  *Forget* beside it, kept in this browser (`localStorage`, key
  `boop.facePresets`) and read back on the next open. Built-in presets
  stay.
- **Presets from a pack** arrive with a [face pack](FACE_PART_LIBRARY.md#face-packs)
  (`docs/FACE_PART_LIBRARY.md`, "Face packs"): cards marked *Pack*, kept
  and forgotten like the author's own.

## Writing one by hand

A preset is validated when it is registered (`validateFacePreset`): its id
is lower case, digits and dashes and not taken; it names at least one part;
every part is a library asset of the category it is named for; every
accessory is an asset of a category a face wears several of; a named
palette exists; a hand drawing id is one the hand vocabulary knows; a
placement's category is one a part goes on; a category a face wears
several of (glasses, a hat) is named under `accessories`, never under
`parts` (`parts-category-accessory`), and a category that comes with
another part (the pupils with the eyes) is not named at all. A preset
written into a pack's `presets` list may name a part of the same pack.

## Files

```text
project/editor/core/face-library/face-presets.js     the presets, the palettes, the registry, planning and applying, the picture, the browser store
project/editor/ui/character-builder/preset-browser.js  the cards
project/editor/core/tests/face-presets.test.js
tests/e2e/ux45-character-builder.spec.js               the presets scenario, and the one-minute path that starts from one
```
