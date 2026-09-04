# Create your first mascot in 10 minutes

Boop Mascotte runs entirely in your browser. Nothing is uploaded.

1. **Start on Home.** Pick **Mascot Face** — the one template, a complete cartoon face that arrives rigged, blinking and turning in 2.5D (`docs/MASCOT_TEMPLATE.md`) — or **Import SVG** for artwork only, or **Open Project** for a previously saved complete project. **Build a Face** and the other starters live in **Artwork → Add / Create artwork → More templates and tools**.
2. **Add hands (optional).** **Face Setup → Hands → Draw a pair of hands** gives the mascot two four-fingered hands, rigged, with six poses (Fist, Point, Peace, Thumbs Up, Spread, Relax), a curl slider per finger and a Wave to try — no SVG to import. They are also in **Artwork → Add / Create artwork**.
3. **Set up the face.** *(The template arrives with every part assigned and every movement calibrated, so steps 3 and 4 are what imported artwork needs — open them anyway to see how the mascot is put together.)* Open **Face Setup**. The checklist lists Head, eyes, pupils, eyebrows and mouth. Imported artwork with recognizable layer names gets suggestions (hover a row to see the candidate): **Accept** one, **Accept N suggestions** for all, or choose one, click its artwork on the canvas, and the next part is offered automatically (Escape cancels). Then select a part to choose and calibrate its Movement. Other parts are added under **All parts → + Add Part**.
4. **Turn on and calibrate movements.** *(Every part of the face has a row of pose chips — Head, Eyes, Gaze, Eyebrows, Nose, Mouth, Jaw, Hair, Ears — and one press puts that part somewhere useful. The Mouth row reaches Grin, Laugh and Tongue out, because an open mouth has teeth and a tongue in it.)* Still in **Face Setup**, tick the movements you want (Head, Eyes, Gaze, Eyebrows, Mouth). Open one to test it with the XY pad or sliders, then **Pose & capture** two positions by dragging the artwork on the canvas; the movement is calibrated immediately. Internal IDs and generated bindings are available only under Advanced.
5. **Add a Nod.** Open **Animate** and **Add** a motion preset (Nod, Shake, Bounce, Tilt, Look Around, Eye Dart, Head Pop): it plays once, and the Inspector tunes amplitude, duration, repeats and loop. **Open in Timeline** shows the same animation key by key; editing a key there turns the motion into a custom animation, and the Inspector offers **Reset to preset** or **Keep as custom**. For anything more complex, create a clip in the Timeline, enable Auto Key, move the playhead and pose the mascot.
6. **Create Happy.** Open **Expressions** and **Add** a preset (Happy, Sad, Surprised…): it uses the movements you have and tells you which ones it would also like, with a link to Face Setup. Or type a name and **Create**, then move the movement sliders (Smile, Eyes…) to shape the face; test it at any intensity. **Capture current face** turns whatever the mascot shows right now into an expression. Expressions are exported and applied with `mascot.setExpression('happy', { weight })`. States (**Animate → States**) remain the advanced runtime graph.
7. **Make it react.** Open **Reactions**, name one (Surprise) and **Create**: When clicked → an expression (Surprised) → a motion (Head Pop) → Fast → Return. **Test** plays it here; in Preview, click the mascot. Exported mascots react by themselves with `mascot.bindEvents()`, or from your page with `mascot.trigger('click')` / `mascot.fire('surprise')`.
8. **Add Blink.** Open **Animate → Automatic**. The template already blinks, glances around and breathes with a slow head movement; turn any of them off, or on for imported artwork. **Test** shows each one. They are ordinary Behaviors: **Behaviors (advanced)** keeps every value editable.
9. **Preview.** Trigger events (Click, Hover, a custom name) and read the event log to see which reaction fired, was blocked or had no listener. Test live controls (gaze pad, sliders), poses, animations and automatic behaviors. Everything in Preview is temporary: **Reset mascot** clears it, **Focus** hides editor chrome, and the **Ready?** list shows what is left with **Go**/**Fix** links.
10. **Check Problems.** The project check lists task readiness (Artwork, Face parts, Movements, Animate, Export) with deep links, then blocking errors and optional information. **Fix** opens the relevant workspace and authoring context.
11. **Save Project.** This downloads editable `mascot-project.json`, including artwork, Rig, Animations, States, and Behaviors. Local autosave is recovery only and is not a saved project.
12. **Export.** The Export panel says what blocks it (with **Fix** deep links and a **Back to Export** chip), lists warnings that do not block, and downloads the files used outside the editor.

## Cartoon extras

These are optional. A mascot works without any of them; each one adds a
particular kind of life.

**Move things around.** Select artwork and the gizmo appears: drag inside it to
move, a corner to scale, the handle above it to rotate, and the ⊕ to move the
pivot — the artwork stays exactly where it is while the pivot moves. `G` `R` `S`
`P` pick a mode, Shift constrains and snaps, and Escape cancels a drag and puts
everything back. Each drag is one undo step.

**Turn the head.** In **Face Setup → Head pose**, pick a cell of the 3 × 3 grid
(`↖ ↑ ↗ / ← ● → / ↙ ↓ ↘`), press **Capture**, move the artwork on the canvas
into that head position, and press Capture again. Boop blends between the cells
you filled, so a few positions are enough. **Mirror** does the other side for
you. The pad below the grid turns the head live — drag it, or use the arrow keys
and Home. Nothing is saved until you confirm a capture, and **Cancel** puts the
artwork back exactly as it was.

**Give it hands.** In **Face Setup → Hands**, choose each hand's artwork, the
body part it hangs from, and where its anchor sits. The hands float — there are
no arms. The anchor follows the body while each hand keeps its own movement.
**Reach** is how far a hand can go, with a little overshoot allowed because
that reads as cartoon rather than mechanical. Add poses (Wave, Fist, Point…)
and link each to a shape or to its own artwork. **Mirror to the other side**
copies everything across. **A little cartoon lag** makes a hand trail and settle
instead of snapping.

**Make a shape do two things at once.** A mouth can smile *and* open *and* be
nudged by the head pose, all at the same time. Capture each as its own shape,
and Boop adds them up.

**Wave when clicked.** In **Reactions**, a reaction can raise an expression, a
motion and a **hand gesture** together — click → Happy + a small bounce + the
right hand waving.

**Bend something transforms cannot.** **Warp (advanced)** puts a small 3 × 3 or
4 × 4 grid over an outline that will not move properly any other way — a face
outline, hair, a soft cheek. It is deliberately the last resort: transforms and
shapes handle almost everything.

## SVG versus Project

- **Import SVG — artwork only.** It replaces the current artwork and starts an unconfigured project.
- **Open Project — complete editing data.** It restores artwork, Rig, Animations, States, Transitions, and Behaviors from project JSON.

## What gets exported?

- `mascot.svg` — sanitized artwork.
- `rig.json` — schema-v3 runtime rig configuration: parameters, bindings, States, transitions, and Behaviors.
- `runtime.js` — standalone browser runtime.
- `mascot-project.json` — editable project downloaded by **Save Project**, not by Export.

Animations and Reactions are exported in `rig.json` (`animations`, `reactions`) and play through `mascot.playAnimation(id)`, `mascot.trigger(name)` and `mascot.bindEvents()`; the Timeline's editing state (active clip, playhead, Auto Key) stays in `mascot-project.json`.

## Advanced authoring

Advanced disclosures retain SVG IDs, parameter IDs, manual bindings, curves, amplitude/offset, constraints, generated ownership, morph endpoints, and diagnostics. Normal authoring uses Parts, Controls, Movements, Poses, Animations, States, and Behaviors.

## Keyboard shortcuts

- Global: Ctrl/Cmd+K search, ? shortcut help, Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+S Save Project, Esc closes the topmost surface.
- Create: V Select, N Node, P Pen, R Rectangle, O Ellipse, H Hand; Delete removes selected artwork; Ctrl/Cmd+D duplicates it.
- Animate: Space plays/pauses when an input is not focused; Timeline focused: Home/End seek, Delete and Ctrl/Cmd+C/V/D act on selected keys.
- Preview and Face Setup: arrow keys nudge a test pad or slider; Escape exits Focus mode.

## Advanced tools

Everything expert lives behind **••• → Advanced → Advanced tools…**: Parameters, Bindings · Constraints · Morphs, the Timeline, the State Machine, Behaviors, Diagnostics (with **Copy diagnostics** for bug reports) and the plugin manager. None of it is required for a normal mascot.

## Search (Ctrl/Cmd+K)

Press **Ctrl/Cmd+K** or the 🔍 button and type what you want: a task (Preview), an action (Export, Save, Undo), or a name (Happy, Nod, Surprise, a face part, a state, a layer). Arrows choose, Enter runs, Esc closes. Actions that are not safe right now (Export while blocked, Undo with nothing to undo) say why instead of running.

## Tablet and phone

Below 900 px the tasks and tools live in a drawer (☰) and the Inspector or Preview controls in a bottom sheet with half / full / collapsed heights. Opening one closes the other; Esc closes the topmost first. Selecting something or entering Preview raises the sheet. The Timeline opens full-screen on tablet and is unavailable on phones (motion presets still work).

On a phone, Preview, Expressions, Reactions, Automatic, Save and Export work in full; drawing tools, node editing, the Timeline and the transition graph are gated with a note that says where to do them. The 📱 button lists what works on the device and offers **Use the desktop layout on this device** as an escape hatch.

## Keyboard and accessibility

Press **?** for the shortcut list. The first Tab stop is **Skip to canvas**; every panel is a labelled landmark; **Esc** closes the topmost surface first (menu, palette, help, popovers, drawer, sheet, Home, Focus Preview) and returns focus to what opened it. Everything on the canvas has a keyboard or numeric alternative (Layers, checklists, sliders, numeric fields), and the editor honours reduced-motion settings. See `docs/UX21_ACCESSIBILITY.md` for the audit.
