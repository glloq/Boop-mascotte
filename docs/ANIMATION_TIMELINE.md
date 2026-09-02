# Animation Timeline Beta

Animation clips are project/editor metadata in snapshot v3. They are deliberately not part of runtime rig schema v3 yet. A clip has a positive duration, one optional loop, and tracks keyed by semantic parameter name. Tracks contain sorted numeric keyframes and supported easing names.

The pure clip evaluator clamps or loops time and interpolates parameter overrides. The intended preview pipeline is:

1. state/pose and transition;
2. one active animation clip;
3. behaviors;
4. temporary live controls;
5. effective parameters passed to the existing frame compiler.

The beta does not support clip blending, animation layers, audio, physics, or raw SVG matrix keyframes.

The preview owns transient playback time; the persisted editor playhead changes only when a scrub is committed. Re-rendering Timeline never resets the same clip. Pause freezes clip time while the independent preview clock keeps Blink/Idle behaviors running; Stop resets clip time and the authoring playhead. Auto Key creates a missing track and upserts one key at the committed playhead. Duration shrink clamps, sorts, and deduplicates colliding keys. The ruler and Fit/+/− controls provide basic horizontal scale feedback.

## Simple motions (UX-11)
A clip may carry optional `motion` metadata (`preset`, `amplitude`, `repeats`, `controls`) when it was added from a Motion preset. Its tracks are a deterministic compilation of those settings, so the Motion Inspector can regenerate them; a key edited here turns the clip into an "edited" motion whose settings no longer apply, and undo restores the relationship. See `docs/ADR_MOTIONS.md`.

## Authoring a clip
Create a clip → enable Auto Key → move the playhead → adjust a graphical Rig control → Play. Committed controls create or replace the key at the exact playhead time; scrubbing and pointer dragging remain transient until release.

Release scenarios cover track removal/Undo, real-output scrubbing, pointer key movement, collision replacement, one-step Undo/Redo, loop wrapping, paused behavior composition, transitions, and save/reload playback. These scenarios are authored but await execution in an environment where Playwright browsers can be installed.

The selected-key editor exposes the runtime's four supported interpolation curves: Linear,
Ease In, Ease Out, and Ease In Out. Broader Timeline authoring debt is tracked in
`PR33_BROWSER_GATE_AUDIT.md` for the planned Timeline overhaul rather than being folded into
this release-gate change.

## Dope Sheet editor
Animate now uses a two-column Dope Sheet: the fixed Property column groups controls by semantic mascot part while the time viewport pans and zooms independently. The animation navigator creates, selects, renames, duplicates, and deletes clips without changing the AnimationClip schema.

The ruler, keys, playhead, marquee, drag, paste, and snapping share one time/pixel layout. Selection is transient: click replaces, Ctrl/Cmd-click toggles, Shift-click adds, and dragging empty lanes creates a marquee. Selected keys can be moved together, deleted, duplicated one 30 fps frame later, copied, and pasted relative to the playhead. Moving keys is strictly clamped to the clip duration; selected keys win exact-time collisions.

Shortcuts while the Timeline is focused: Space play/pause; Home/End seek bounds; Ctrl/Cmd+C/V copy/paste; Ctrl/Cmd+D duplicate keys; Delete/Backspace delete keys; Escape clear selection. Snap uses the 30 fps frame grid and nearby key times. Zoom is 25–800%, with Fit available. Graph/F-curve editing is intentionally not included.
