# ADR — Simple Motions over animation clips

Status: accepted for UX-11. Scope: editor data (additive metadata on animation clips), project snapshot (additive, version stays 3), editor UI and commands. No runtime or `rig.json` change.

## Context

The product needs short named movements over time (Nod, Shake, later Bounce, Tilt, Look Around…) that a beginner adds from a preset, tests immediately and tunes with three settings (amplitude, duration, repeats), without learning the Timeline. The editor already has **animation clips** (`ProjectDocument.animationClips`: duration, loop, keyframe tracks per parameter) with a capable Dope Sheet, a pure evaluator (`animation-editor/timeline/clip-evaluator.js`) and preview playback. Clips are editor data: they are saved in the project but, since V1, deliberately **not** exported to runtime `rig.json` (`docs/ANIMATION_TIMELINE.md`, `docs/KNOWN_LIMITATIONS.md`).

## Decision

### A Motion is an animation clip

There is no second entity. A preset compiles to an ordinary clip and the clip remembers how it was made:

```json
{
  "id": "nod", "name": "Nod", "duration": 0.8, "loop": false,
  "tracks": { "headY": [ { "time": 0, "value": 0, "easing": "linear" }, { "time": 0.4, "value": 0.5, "easing": "easeInOut" }, { "time": 0.8, "value": 0, "easing": "easeInOut" } ] },
  "motion": { "preset": "nod", "amplitude": 0.5, "repeats": 1, "controls": { "headY": "headY" } }
}
```

- `motion` is optional metadata. `preset` names a catalogue entry; `amplitude` (0–1) and `repeats` (1–10) are the settings; `duration` and `loop` are the clip's own fields; `controls` pins each preset slot to the parameter it was compiled for (the slot control or one of its fallbacks) so the relationship stays stable when movements change later.
- Everything that reads clips (evaluator, preview, Timeline, snapshot, validation) keeps working unchanged: they ignore `motion`.

### Deterministic compiler

`compileMotionTracks(preset, settings, controls, params)` tiles one normalized cycle per slot `repeats` times across `duration`; normalized values (−1…1) scale by `amplitude` within the parameter's range around its neutral value. Keys at cycle boundaries keep the easing that arrives at them. The same inputs always produce the same tracks, which is what makes the relationship **lossless**:

- **simple**: `tracks` equal the compilation of `motion` → the Motion Inspector edits amplitude, duration and repeats and regenerates the tracks (one undoable command);
- **edited**: `motion` is present but the tracks differ (the user changed keys in the Timeline) → the settings are shown as no longer driving the clip; keys stay untouched, nothing is regenerated silently;
- **custom**: no `motion` → a Timeline clip, summarized in the Motion Inspector with **Open in Timeline**.

Classification is derived (`classifyClip`), never stored, so undoing a key edit restores the simple status without extra bookkeeping.

### Storage

- `ProjectDocument.animationClips[].motion` (optional). Domain `animation`, source `motion`; commands `motion/create`, `motion/update-settings`, `motion/reset` (rebuild tracks from settings), `motion/detach` (forget the preset, keep the keys), `motion/set-loop`, `motion/rename`, `motion/duplicate`, `motion/remove` (atomic, preflighted, undoable).
- Project snapshot: `document.editor.animationClips` already carries clips verbatim; older snapshots simply have no `motion`. Version stays 3.
- Export: unchanged. Clips, simple or not, are still not part of `rig.json` (V1 limitation). Runtime playback of clips is a separate, runtime-scoped ADR (planned with Reactions, UX-13), where simple motions will need nothing beyond what any clip needs.

### Making one, when nothing ready-made fits (VNX-27)

The catalogue is Head, Eyes and Face. A mascot that wiggles its ears, sways its
hair, or has a hand pose its author invented finds **nothing** in it — and the
reason is structural, not an oversight: a hand's controls are generated
(`handLGrip`, `handRThumbsUp`), so no fixed table can name them (VNX-34). Those
movements were reachable only through the Timeline, key by key, which is the
timeline the Motion Studio exists to avoid.

So the *shapes* the presets are built from became a vocabulary of their own —
**Dip · Rise · Sweep · Hold · Pulse · Settle · Tremble**, each one already
proven in a shipped preset, which is why there are seven and not twenty. Pick a
movement, pick a shape, and the pair compiles through the same deterministic
compiler:

```text
shape:settle:earWiggle
      │       └── any parameter the project has
      └────────── one of MOTION_SHAPES
```

One string, stored in the `motion.preset` field a clip already had, so a
composed motion needs no new document field and a project written before this
reads back unchanged. `resolveMotionPreset()` returns a catalogue preset or a
synthetic one built from the id, and everything downstream — amplitude,
duration, repeats, *edited* classification, reset, detach, the summary — takes
either without knowing which it has. **This adds a way to name a motion, not a
second kind of motion.**

Two deliberate differences from a catalogue preset: a composed slot has **no
fallbacks** (the author named this movement, and quietly animating a different
one because theirs is off would be a lie), and it is offered under *Make your
own*, an Advanced disclosure — an author who has not run out of ready-made
motions should not have to read a second way of making one.

### What Motions are not

They do not create States, transitions or behaviors, and they do not alter Expressions. Blink/Idle remain automatic behaviors.

## Consequences

- The Animate task gets a simple entry (Motion Studio: presets, motions list, Motion Inspector) above the advanced editors; the Timeline remains the canonical key editor and is one click away (**Open in Timeline**).
- Adding presets later is data only (`core/motion/motion-presets.js`); each preset lists the basic movements it uses with fallbacks, so it is offered only when the project has a matching movement and explains what to turn on otherwise.
- Rollback: hide the Motion Studio; `motion` metadata is inert for every other reader.

## Alternatives rejected

- **Separate Motion entity compiled on export**: two sources of truth for one movement, with a synchronization problem the moment the user opens the Timeline.
- **Regenerate tracks whenever settings or movements change, even after key edits**: destructive; Timeline work would be lost silently.
- **Store the classification** (`simple`/`edited`): would drift from the tracks under undo/redo and Timeline operations; deriving it from a deterministic compiler is cheaper and always right.
