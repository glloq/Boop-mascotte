# Direct controls

Posing a mascot meant finding the right panel, then the right slider, then
reading a number:

```text
Gaze · Look left / right   [————●————]  -0.42
```

The mascot was on screen the whole time, and nobody could touch it.

A **handle** puts a movement back on the part it moves. Drag the pupils to look
around, the eyelid down to close the eyes, the mouth sideways to smile and down
to open it, the head to turn it. The sliders are still there — they are the
precise path, and the accessible one — but they are no longer the only way in.

## What a handle is

`core/puppet/puppet-handles.js` is the model. A handle is one or two of the
**project's own movements**, bound to the artwork those movements move:

| Handle | Sits on | Sideways | Up and down |
| --- | --- | --- | --- |
| Look around | the pupils | `lookX` | `lookY` |
| Open and close | the top of the eye | — | `eyeOpen` (inverted) |
| Eyebrows | the brows | `browTilt` | `browRaise` (inverted) |
| Mouth | the mouth | `smile` | `mouthOpen` |
| Turn the head | above the face | `headX` | `headY` |

A handle only exists when the project has that movement, turned on, with a
parameter behind it. An unrigged project has no handles at all, rather than a
canvas full of controls that do nothing.

Nothing here knows how a movement is *implemented*. A drag sets the same
parameters a slider sets, so a transform-driven mouth and a morph-driven one
behave identically and the runtime is untouched.

## What a drag means

The pointer delta arrives in the artwork's own units and is divided by the
part's own size, so the same gesture feels right on a 40px face and on a
2000px one — `throw` is how much of the part you cross to cover the whole
range. Values are clamped to each parameter's range, so a drag stops at the
end of a movement instead of running away.

Two axes are inverted, and the reason is worth stating once: `eyeOpen` and
`browRaise` rise as the pointer goes **up**, while `headY`, `lookY` and
`mouthOpen` grow **downwards** like every vertical parameter in the rig
(`headY` is calibrated UP at -1). The handles follow the parameter, so
dragging up always moves the part up.

## Where a drag lands

- **Face Setup** and **Preview**: it is a live preview, exactly like the
  sliders and the XY pads. The project is not touched.
- **Expressions**: on release it also writes into the expression being shaped,
  through the same command the sliders use — one gesture, one undo step, and
  only the movements that handle drives.

Handles appear in those three tasks and nowhere else: Artwork is for drawing
and Animate is for timing. The `✋ Handles` button in the canvas toolbar turns
them off for anyone who wants a clean canvas, and the choice is remembered.

## Keyboard

A handle is a control, so it answers like one: arrow keys nudge (hold Shift for
a bigger step), `Home` puts the movement back to rest, and a double-click does
the same with the pointer. Each handle carries its value as `aria-valuetext` in
plain words — `look left / right +0.5`, not `lookX 0.5`.

## Placement

Handles ride the artwork they move: every frame that changes the mascot
schedules one repositioning pass, coalesced to at most one per animation frame
(and to one every 200ms when nothing is being dragged) since placing them reads
layout. Hidden handles schedule nothing at all, so a task that does not pose
costs nothing per frame, and switching tasks hides them rather than rebuilding
them.

A handle that moves a pair sits **between** the two parts, not on one of them:
the gaze between the pupils, the eyes between the eyes. And two handles never
share a spot — the gaze takes the middle, so the eyelid's handle goes to the
top of the eye and the head's floats above the face, where a puppeteer would
hold it.
