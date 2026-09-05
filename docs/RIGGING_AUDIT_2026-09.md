# Rigging audit — September 2026

"Il faut vérifier que tous les outils nécessaires sont accessibles et qu'on
peut facilement animer toutes les parties du visage : création et modification
des holdings et de la forme des holdings, avec toutes les sous-parties, et le
groupement de plusieurs holdings."

The audit walked every Face Setup section with a browser (screenshots of the
nine sections, the Part Inspector's four tabs, the Holding panel top to
bottom) and read the code behind each button. This is what it found and what
was done about it. The vocabulary: a **pin** holds a piece of artwork by a
point (`docs/FACE_CONTROL_RIG.md` §9); a **hold** puts a named point on
another (§11); **holding** is the panel that carries pins, relationships,
points and holds.

## Findings

| # | Finding | Resolution |
| --- | --- | --- |
| P1 | **No way to create a pin.** `pins.create` had no caller; the only pins were the seven the face template generates. The panel's empty state told the author to "drag a pin onto" the artwork, which nothing allowed. | **Fixed.** A *Pin* row in Pins & holding: pick a path (the selected piece is offered first), **Place it on the canvas** (the next click says where, on the chosen piece even when the click misses a thin eyelid) or **At the middle**; **Add a pin here** in the canvas menu. |
| P2 | A pin needs a rest outline, and a path drawn or imported in the editor has none — only the template's do. So even with a create button, nothing but the template could have been pinned. | **Fixed.** Placing a pin hands the path's authored `d` over as its rest outline in the same undo step. |
| P3 | A rectangle, ellipse, circle, line or polygon has no points, so it can never be pinned, warped, reshaped or given a shape key. | **Fixed.** **Convert to a path** in the Inspector's Shape section and the canvas menu (`shapeToPath`), keeping id, paint and transform; the Pin row offers it for the selected shape. |
| P4 | The reach — the thing a pin is about — was two numbers in a panel; the ellipse was drawn on the canvas and could not be touched. | **Fixed.** Two handles on the ellipse drag it wider or taller, live, one undo step per drag. |
| P5 | A pin switched to *Directional* or *Slide* had no direction field: both kinds got the normalizer's default (down) silently. | **Fixed.** An **Along** angle in the row; the axis is drawn through the pin. |
| P6 | Pins on the other side of the face had to be made twice by hand. | **Fixed.** **Mirror**: reflected about the working area's middle, on the symmetric piece when the ids name one, sideways motion turned around. |
| P7 | No way to group several pins: each was driven by its own typed expression, and a new movement could not be created anywhere in the UI. | **Fixed.** **Move together**: tick pins, give them one movement — an existing one or a new one, created resting at 0, with a control of its own on the canvas and in Controls — with an amount sideways and up / down. |
| P8 | Deleting a template pin was one-way; `enableMouthRig` / `enableBrowRig` were unreachable. | **Fixed.** *Pin the mouth / the brows like the template* when the parts exist and the pins do not. |
| P9 | The panel ignored the selection: every pin of every piece in one list, and nothing said that pins show on the canvas only for the selected piece. | **Fixed.** The selected piece's pins come first, marked "selected · pins on the canvas"; every other group has **Show on canvas**. The panel re-renders on selection. |
| P10 | Pins & holding was reachable only by opening a collapsed section by hand: no guide step, no readiness route, no palette command, not in the Advanced hub's deformation listing; the `advanced` flag on sections was never rendered. | **Fixed.** Palette commands for every Face Setup section (*Face Setup → Pins & holding* …), pins in the deformation listing, an *advanced* tag on the two advanced sections, the canvas menu's *Add a pin here* landing in the panel. |
| P11 | Dead ends: *Hold it* defaulted both points to the same one and refused; *Add it* (relationship) defaulted to a kind that needs a source with none chosen; remove / configure failures were silent; a refused pin still cost an undo step. | **Fixed.** Different defaults, every refusal is said, pin commands are tried on a copy first. |
| R1 | Movements that already move the face — the template's generated bindings, the head pose grid — read "On · not set up yet", and the calibrate tab counted "0 / 2 poses" as if a step had failed. | **Fixed.** "On · ready · default range" / "from the head pose"; the calibrate tab says the positions only tune how far it goes (`movementMoves`). |
| R2 | One side at a time (a wink, one raised brow) existed only for the template: `enableSemanticSideControl` had no UI, so an imported face never got the eleven per-side handles, the Wink chip or the links. | **Fixed.** **One side at a time** in a movement's Advanced section for Eyes, Pupils / Gaze, Eyelids and Eyebrows. |
| R3 | The Tongue part (four movements, three handles, six poses) was in the registry and not in *Add a Part*. | **Fixed.** |
| R4 | The Warp limitation note said canvas dragging was not wired; `ux42-warp.spec.js` proves it is. | **Fixed** in `docs/KNOWN_LIMITATIONS.md`. |
| R5 | Attachment points and holds are numbers in the panel, not handles on the canvas; pins move one at a time (no marquee over pins). | **Open**, documented in `docs/KNOWN_LIMITATIONS.md`. |
| R6 | The four control modes (Simple / Detailed / Rig / Animate), handle shape, size, controller and spot overrides are in the model and the docs and have no picker. | **Open.** Recorded here; the board exposes name, limits, locks, colour, links, hide, reset and new controls. |
| R7 | The Artwork Inspector (bindings, constraints, presets) is not reachable from Face Setup: the context inspector shows the part for anything inside the head group. The path for a custom piece is Artwork → Inspector → Advanced → Bindings, then Face Setup → Controls → New control. | **Open.** Recorded here; the Holding panel's *Move together* now covers the common case (a new movement with a control) without that detour. |

## Where it is tested

- `core/tests/rig-pins.test.js` — placing a pin on a drawn path carries the outline; mirror; group.
- `core/tests/face-movements.test.js` — a movement that moves already, by bindings or by the head pose.
- `core/tests/path-build.test.js` — a shape becomes the path it draws.
- `tests/e2e/ux43-rig-relationships.spec.js` — a pin on an eyelid by a click and at the middle, its reach dragged, mirrored, grouped under a new control, the angle, the canvas menu, a shape converted, one side at a time.
