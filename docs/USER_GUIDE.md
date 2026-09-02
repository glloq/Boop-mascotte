# Create your first mascot in 10 minutes

Boop Mascotte runs entirely in your browser. Nothing is uploaded.

1. **Start artwork.** Choose **Start with Basic Face**, **Import SVG** for artwork only, or **Open Project** for a previously saved complete project.
2. **Set up the face.** Open **Face Setup**. The checklist lists Head, eyes, pupils, eyebrows and mouth: choose one, click its artwork on the canvas, and the next part is offered automatically (Escape cancels). Then select a part to choose and calibrate its Movement. Other parts are added under **All parts → + Add Part**.
3. **Test controls.** Move the friendly Head, Gaze, Eyes, and Mouth controls. Internal IDs are available only under Advanced.
4. **Create Look Around.** Open **Animate → Animations**, create a clip, enable Auto Key, move the playhead, and pose Gaze.
5. **Add a Happy State.** Open **Animate → States**. A State is a persistent pose; transitions belong here too.
6. **Add Blink.** Open **Animate → Behaviors**. A Behavior is optional automatic recurring movement.
7. **Preview.** Combine a State, Animation, Behaviors, and live controls. **Reset** clears temporary preview input; **Focus** hides editor chrome.
8. **Check Problems.** The project check separates blocking errors from optional information. **Fix** opens the relevant workspace and authoring context.
9. **Save Project.** This downloads editable `mascot-project.json`, including artwork, Rig, Animations, States, and Behaviors. Local autosave is recovery only and is not a saved project.
10. **Export.** Download files used outside the editor.

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
