# Custom face parts

Three things make a part the author's own, and none of them is a second
kind of part: a custom part is an asset like a built-in, validated the same
way, installed the same way, animated the same way (roadmap phases 15, 27
and 44). The model and the code are in `docs/FACE_PART_LIBRARY.md`,
"Custom parts", "Migration" and "Face packs"; this page is the reader's
guide.

## A library part reshaped: a custom instance

Every library part on a face remembers the shape it was installed with --
a word its shapes sign as (`part.assetShape`), made of the path data, the
points and the sizes of what it draws, not of where it sits. *Edit Shape*
drags a point, and the word no longer matches: the instance is **custom**
(the inspector says *Custom · from Round*, no style card is current for
it). It keeps its category, its roles and every movement; the card of the
asset it came from puts the library drawing back (*Restore library
drawing* under *Reset*, one undo step). Nothing is stored beyond the word:
the SVG is the truth. A move, a turn or a resize of the whole piece is
never custom -- that is placement, and a preset can carry it.

## A piece saved as a library part

Under the piece in hand, *Save as a library part* makes an asset of it:

1. **Name** it. The id is the category and the name (`mouth.my-mouth`),
   made unique if taken.
2. **Category**: what it is on a face. A category a face wears one of
   replaces; an accessory joins.
3. **Roles**: which of the piece's shapes plays which role of the category
   (the mouth, the teeth, the tongue…). The required ones are marked.
4. **Mount point**, if the category's default is not where it goes.

The artwork is read from the document -- the element and everything inside
it, without the root's own transform, which is where the author put it on
*this* face and which the fit will decide on the next. The movements of the
part the piece belongs to become the asset's capabilities; the palette
tokens its paints play are read from the face's colours, so the part comes
back in whatever colours the next face has; its reference box is its own
box. It is validated exactly as a built-in is (`docs/FACE_PART_LIBRARY.md`,
"Validation": ids, roles, the mount point, no script, no external
reference) and kept in this browser (`localStorage`, key `boop.faceParts`),
read back on the next open, skipping any the validator refuses by then.

It is then a style card like any other, marked **Mine**, with *Forget*
beside it. A face wearing a forgotten part keeps its drawing.

## A part from a pack

A [face pack](FACE_PART_LIBRARY.md#face-packs) is one JSON file of parts
and presets somebody hands over (`••• → Import face pack`, or
`registerFacePack` from a module). Its parts are validated as a whole with
the pack and installed all or nothing, as the author's own with the pack's
id on them: cards marked **Pack**, kept and forgotten like the ones saved
from a face.

## Writing one by hand

```json
{ "id": "mouth.grin", "category": "mouth", "name": "Grin", "description": "A small grin.",
  "artwork": "<g id=\"mouth-grin\" data-name=\"Mouth\"><path id=\"mouth\" data-name=\"Mouth\" d=\"…\" fill=\"#b83a3a\" stroke=\"#111\"/></g>",
  "roles": { "mouth": "mouth" },
  "capabilities": ["mouthOpen", "smile", "mouthWidth"],
  "paletteRoles": { "mouth": { "fill": "mouth", "stroke": "outline" } },
  "referenceBox": { "x": 88, "y": 150, "width": 64, "height": 20 },
  "mountPoint": "mouth.center" }
```

The rules are in `docs/FACE_PART_LIBRARY.md`, "An asset" and "Validation":
the artwork is one root element with an id, every role names an element
inside it, every element has a `data-name` a person would read (the simple
surface never shows an id), a capability is a movement the category has,
the reference box is where the part sits on the template face (the fit
scales and moves it onto any other), and the palette roles say which
colour of the face each paint takes. Put it in a pack's `parts` list to
hand it over, or register it from a module with `registerFacePart`.

## Old projects

A project saved before the library opens with its parts recognised where
they are a library asset drawn exactly (`identifyFaceParts`,
`docs/FACE_PART_LIBRARY.md`, "Migration"); every other part reads as the
author's own drawing, with its movements, and can be saved as a library
part from the piece in hand.

## Files

```text
project/editor/core/face-library/face-part-commands.js   saveAsPart, removeCustomPart, repaint, installPack
project/editor/core/face-library/face-part-registry.js   loadCustomParts, saveCustomParts
project/editor/core/face-library/face-pack.js            packs
project/editor/ui/character-builder/character-model.js   instanceIsCustom
project/editor/ui/character-builder/part-inspector.js    the save form, Reset
project/editor/core/tests/face-part-commands.test.js
project/editor/core/tests/face-pack.test.js
project/editor/core/tests/character-model.test.js
```
