# Saying what a drawing is

> Every place an author can name a piece of artwork as part of a face, and
> every role they can name it as. Written after an author imported a picture
> and could not find anywhere to make the assignment — which was accurate:
> for most of the face there was nowhere.

```text
  IMG_2043.png  ─┬─▸ the import form        "What is it?"  [ Left ear ▾ ]
                 ├─▸ the Inspector          "What it is"   [ Left ear ▾ ]
                 └─▸ Face Setup ▸ More parts   ○ Left ear   [Assign]
                                                    │
                                        semanticParts.ears.roles.leftEar
```

## What was wrong

The rig has always held twenty-five assignable roles across thirteen face
parts (`SEMANTIC_PART_REGISTRY`, docs/SEMANTIC_RIGGING.md). The editor offered
**eight**: the Face Setup checklist walks a beginner through a head, two eyes,
two pupils, two brows and a mouth, and says so. The other seventeen — the four
eyelids, the nose, two ears, three kinds of hair, facial hair, the jaw, the
tongue, the teeth, the mouth cavity, an accessory — were reachable only from
*Rig ▸ Deform ▸ All parts*: an advanced screen, inside a collapsed section,
behind a **+ Add Part** menu, which is not a place an author looks for "this
drawing is an ear".

Three consequences, all of them things an author actually hit:

1. **An imported picture had nowhere to be named.** The import form proposed a
   role, and its vocabulary was the same eight. `cheveux.png` read as hair and
   then had no *Hair* to offer.
2. **The Inspector asked only how a piece moved.** *What it is* — the question
   that decides whether a drawing is an eye or a hat — was not on the piece.
   And *How it moves*, which was, sat inside a block gated on
   `geometryFields(kind).length`, which is empty for a path: so on every
   drawn shape the Inspector asked neither question.
3. **The library could not be browsed.** A hundred and fifty drawings ship
   with the editor and `facePartCommands.replace()` had no caller, because the
   Character Builder that used to call it was removed. See
   docs/FACE_PART_LIBRARY.md § *Choosing a drawing*.

## The vocabulary

`rig-editor/semantic-parts/face-role-vocabulary.js` is the whole list, **derived
from the registry** rather than written out again, so a part added to
`SEMANTIC_PART_REGISTRY` is assignable the day it exists.

| Field | Meaning |
| --- | --- |
| **id** | `part.role` — `ears.leftEar`. Unique across parts, because the tongue is a role of the `mouth` (whether it shows) *and* a part of its own (where it is), and those are different answers to "what is this drawing". |
| **part**, **role** | What `assignSemanticRole` is called with. |
| **label**, **hint** | The author's words. Written out, not generated: `leftUpper` is "left upper eyelid" to a person and `hairBack` is "hair behind the head", and splitting camel case says neither. A role with no entry still appears, under its own id — worse than a sentence, much better than unassignable. |
| **partLabel** | The part that owns it, for an `<optgroup>`. |
| **required** / **optional** | Whether the part needs it before it can move (`requiredSemanticRoles`). |

Two hands are left out on purpose: a hand is drawn as a pair from
*Design ▸ Hands* and giving it a row would offer a way to half-make one
(docs/HAND_RIGGING.md).

`rolesOfElement(document, id)` is which roles one drawing plays — usually none
or one, legitimately more — and `rolesInUse(document)` is the reverse, so a
`<select>` can say *"Left ear — earLeft now"* and nobody takes a role off
something by surprise.

## Where it is offered

### On the piece — Inspector ▸ This piece

```text
  This piece
    What it is    [ Nose                    ▾ ]
    How it moves  [ Several drawings        ▾ ]
```

Both questions, under one heading, for every kind of piece. `data-piece-role`
holds the vocabulary grouped by part; the empty option reads *"Not part of the
face yet"* or *"— take the role off this piece —"* depending on whether the
piece plays one. A drawing playing more than one role says so underneath, and
choosing here replaces all of them.

Lifting the section out of the geometry gate repaired *How it moves* on every
path at the same time, which had been invisible since it was written.

### One command, one undo step

`semanticRigCommands.setFaceRole(elementId, { part, role })`. Moving a drawing
from one role to another is a clear and an assign, and as two commands it is
two undo steps with a state between them where the piece plays both or neither.
So it is one: the roles the piece played are cleared and the new one assigned
inside a single `store.execute`, and `role: null` is the piece leaving the face.

Clearing first is also why one drawing can never occupy two roles of one part —
the rig refuses that (`assignSemanticRole`) and the clear means the question
never arises. Refusals still come from the rig, not from a second set of rules:
an unsupported role, an unknown part, a drawing that is not in the document.
The command runs whole on a copy first, so a refusal that would have arrived
*after* the clear leaves the piece with the role it had.

### In the checklist — Face Setup ▸ More parts

The eight rows stay the eight, and `8 / 8` still means finished: a face with no
ears and no jaw is a finished face, and a progress count of `8 / 25` would call
every mascot ever made unfinished for ever. The other seventeen are a
disclosure below the list, grouped by the part that owns them, with the same
row an assigned role has — pick from the canvas, pick from the layers, clear.
`deriveFaceRoleExtras(document)` is the derivation, and it reports `assigned`
for the summary only.

`findFaceRoleUsage` now looks in both lists, so an optional role cannot take a
piece out from under a basic one in silence.

### On the way in — the import form

`ui/picture-intake.js` reads a dropped file's name and proposes a role. Its
`FEATURES` table covers the whole face in English and French — lids, teeth, a
tongue, a cavity, a jaw, a nose, ears, three kinds of hair, facial hair — and
its `INTAKE_ROLES` is the eight of the checklist followed by the rest of the
vocabulary, so a name it reads is always a role the form can offer.

A name is read as tokens *and* as adjacent tokens joined, because the tokeniser
splits `hair-back.png` into `hair` and `back`, neither of which is the piece.
It proposes and never decides: both boxes are `<select>`s, and a name it cannot
read says nothing rather than guessing.

## What is held to

```text
project/editor/rig-editor/semantic-parts/face-role-vocabulary.js   the list, the groups, who plays what
project/editor/rig-editor/semantic-parts/semantic-rig-commands.js  setFaceRole
project/editor/rig-editor/semantic-parts/face-roles.js             the eight, the seventeen, usage
project/editor/rig-editor/semantic-parts/face-setup-panel.js       the checklist and its More parts
project/editor/inspector/inspector.js                              This piece
project/editor/ui/picture-intake.js                                the reading of a file name
project/editor/core/tests/face-roles-everywhere.test.js            the vocabulary, the split, setFaceRole, the library model
project/editor/core/tests/picture-intake.test.js                   the names, in both languages
tests/e2e/face-roles-everywhere.spec.js                            the three surfaces, in a browser
```

The browser spec is not a duplicate of the unit tests: both failures this page
describes were *missing surfaces* rather than wrong arithmetic, and a unit
suite cannot see a control that renders nowhere.
