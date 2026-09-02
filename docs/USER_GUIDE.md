# Create your first mascot in 10 minutes

Boop Mascotte runs entirely in your browser. Nothing is uploaded.

1. **Start artwork.** Choose **Start with Basic Face**, **Import SVG** for artwork only, or **Open Project** for a previously saved complete project.
2. **Set up the face.** Open **Face Setup**. The checklist lists Head, eyes, pupils, eyebrows and mouth. Imported artwork with recognizable layer names gets suggestions (hover a row to see the candidate): **Accept** one, **Accept N suggestions** for all, or choose one, click its artwork on the canvas, and the next part is offered automatically (Escape cancels). Then select a part to choose and calibrate its Movement. Other parts are added under **All parts → + Add Part**.
3. **Turn on and calibrate movements.** Still in **Face Setup**, tick the movements you want (Head, Eyes, Gaze, Eyebrows, Mouth). Open one to test it with the XY pad or sliders, then **Pose & capture** two positions by dragging the artwork on the canvas; the movement is calibrated immediately. Internal IDs and generated bindings are available only under Advanced.
4. **Add a Nod.** Open **Animate** and **Add** a motion preset (Nod, Shake, Bounce, Tilt, Look Around, Eye Dart, Head Pop): it plays once, and the Inspector tunes amplitude, duration, repeats and loop. **Open in Timeline** shows the same animation key by key; editing a key there turns the motion into a custom animation, and the Inspector offers **Reset to preset** or **Keep as custom**. For anything more complex, create a clip in the Timeline, enable Auto Key, move the playhead and pose the mascot.
5. **Create Happy.** Open **Expressions** and **Add** a preset (Happy, Sad, Surprised…): it uses the movements you have and tells you which ones it would also like, with a link to Face Setup. Or type a name and **Create**, then move the movement sliders (Smile, Eyes…) to shape the face; test it at any intensity. **Capture current face** turns whatever the mascot shows right now into an expression. Expressions are exported and applied with `mascot.setExpression('happy', { weight })`. States (**Animate → States**) remain the advanced runtime graph.
6. **Make it react.** Open **Reactions**, name one (Surprise) and **Create**: When clicked → an expression (Surprised) → a motion (Head Pop) → Fast → Return. **Test** plays it here; in Preview, click the mascot. Exported mascots react by themselves with `mascot.bindEvents()`, or from your page with `mascot.trigger('click')` / `mascot.fire('surprise')`.
7. **Add Blink.** Open **Animate → Automatic** and turn on Blink, Natural gaze or Idle head movement; **Test** shows each one. They are ordinary Behaviors: **Behaviors (advanced)** keeps every value editable.
8. **Preview.** Trigger events (Click, Hover, a custom name) and read the event log to see which reaction fired, was blocked or had no listener. Test live controls (gaze pad, sliders), poses, animations and automatic behaviors. Everything in Preview is temporary: **Reset mascot** clears it, **Focus** hides editor chrome, and the **Ready?** list shows what is left with **Go**/**Fix** links.
9. **Check Problems.** The project check lists task readiness (Artwork, Face parts, Movements, Animate, Export) with deep links, then blocking errors and optional information. **Fix** opens the relevant workspace and authoring context.
10. **Save Project.** This downloads editable `mascot-project.json`, including artwork, Rig, Animations, States, and Behaviors. Local autosave is recovery only and is not a saved project.
11. **Export.** Download files used outside the editor.

## SVG versus Project

- **Import SVG — artwork only.** It replaces the current artwork and starts an unconfigured project.
- **Open Project — complete editing data.** It restores artwork, Rig, Animations, States, Transitions, and Behaviors from project JSON.

## What gets exported?

- `mascot.svg` — sanitized artwork.
- `rig.json` — schema-v3 runtime rig configuration: parameters, bindings, States, transitions, and Behaviors.
- `runtime.js` — standalone browser runtime.
- `mascot-project.json` — editable project downloaded by **Save Project**, not by Export.

**V1 scope note:** Timeline animations stay in `mascot-project.json`; they are not included in runtime `rig.json`. This does not prevent export.

## Advanced authoring

Advanced disclosures retain SVG IDs, parameter IDs, manual bindings, curves, amplitude/offset, constraints, generated ownership, morph endpoints, and diagnostics. Normal authoring uses Parts, Controls, Movements, Poses, Animations, States, and Behaviors.

## Keyboard shortcuts

- Global: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y redo, Ctrl/Cmd+S Save Project.
- Create: V Select, N Node, P Pen, R Rectangle, O Ellipse, H Hand; Delete removes selected artwork; Ctrl/Cmd+D duplicates it.
- Animate: Space plays/pauses when an input is not focused.
- Preview: Escape exits Focus mode.
