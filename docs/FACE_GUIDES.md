# The canvas says where a face's parts go

> *« on doit pouvoir créer n'importe quel mascotte facilement => il faut
> chercher a ajouter des aides graphique pour guider un nouvel utilisateur »*

## What an author saw

Import a head you drew, and the editor gave you an oval and a panel of nine
categories. Nothing on the canvas said a face *has* places, how big a mouth
should be on **this** head, or what the card you were about to press would do
to it. The card's picture is the drawing on the *template's* head, which is the
one question it cannot answer.

```text
        ┌──────────────┐        the head you drew
        │  ╌╌╌╌  ╌╌╌╌  │        Left eye · Right eye
        │      ╌╌      │        Nose
        │    ╌╌╌╌╌╌    │        Mouth
        └──────────────┘
```

Three guides, and each answers one of those:

| | When | What it says |
| --- | --- | --- |
| **Slots** | a face is missing a part | a dashed box, named, where that part would go, at the size it would be on this head |
| **The ghost** | there is no head at all | a dashed oval in the middle of the working area: draw something about this big, about here |
| **The landing frame** | a library card is under the pointer, or focused | a solid frame where *that* drawing will land, before the press |

## Derived, never invented

A slot is the template's own role box put through **`fitFacePart`** — the same
call the install makes when a card is pressed. So is the landing frame. The
guide is therefore a promise the install keeps, rather than a second opinion
about where things go: the browser test presses the card and checks the drawing
arrives inside the frame that was there a moment before.

On the template's own face the fit is the identity, so each slot sits exactly
where the template draws that part. That is what makes it believable on a head
that is half the size, twice the size, or an oval somebody drew freehand: the
same arithmetic, in proportion.

`face-guides.js` is pure and reads no DOM. The canvas measures, and this
derives — the same division `face-layout.js` already draws.

## Four slots, and why not more

```text
Left eye · Right eye · Nose · Mouth
```

Hair, ears, eyebrows and facial hair are **not** slots. Plenty of mascots have
none of them, and a dashed box telling an author their face is unfinished
because it has no beard is a guide that has started lying. The four that are
here are the four a face is not a face without.

A role that points at an element that is no longer there counts as missing, not
as filled: the drawing was deleted and the role left behind, and what an author
needs then is the slot back — not a face that quietly has no mouth.

## Where they show

On the screens where a mascot is being **made** — Design, which is Assemble and
Draw — and nowhere else. Everywhere else the mascot is being tried on, and a
dashed box over a finished one is clutter. It costs nothing to leave on: a face
with every part has no slots to draw.

The guides live in a layer of their own above the artwork and outside the
serialized document (`data-face-guides`, `pointer-events: none`), like the
gizmo and the artboard edge, so they can never be selected, exported, or
mistaken for the drawing.

Labels are drawn at a fixed size in screen pixels, undone from the artwork
matrix: a guide that shrinks with the zoom is unreadable exactly when an author
has zoomed out to see the whole face. Their halo is **white**, because they are
drawn on the working area and on the mascot rather than on the dark canvas
behind them.

## The fixture this found

`TEMPLATE_ROLE_BOXES` is the template's face measured once in a browser and
written down, so the layout can be derived without one. Which makes it a
fixture — and a fixture nothing checks is a fixture that drifts. It had:

```text
              written            drawn
leftEye    92 x 135  at 37,44.5   48 x 45  at 59,90.5
rightEye   92 x 135  at 111,44.5  48 x 45  at 133,90.5
```

The eyes were still the box of a group with its **lids parked outside a
socket** — three times the size the eye actually is, since the eyes came off
that socket (docs/EYE_BUILDS.md). Everything fitted beside an eye was fitted
beside a box three times too big, and the measured eye line was 112 where the
geometry's own centre is 113.

Re-signed, and now held to the live face by `face-guides.spec.js`, which is the
test the constant's own comment always claimed existed.

## Where things are

```text
core/face-library/face-guides.js     the slots, the ghost, the landing box
core/face-library/face-layout.js     the fit they are all derived from
svg-editor/svg-canvas.js             the layer, and showFaceGuides / previewFacePart
rig-editor/semantic-parts/face-library-panel.js   a card under the pointer
app/editor-app.js                    on where a mascot is made, off elsewhere
```
