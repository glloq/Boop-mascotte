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
