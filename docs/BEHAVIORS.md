# Behaviors

A **Behavior** adds automatic, procedural motion over the current State and Animation result. The catalog exposes every runtime-supported type:

- **Automatic Blink** temporarily overrides its target with the closed value, then restores the underlying animated pose.
- **Random Idle** adds an occasional value in the configured range.
- **Oscillation** continuously adds a sine-wave offset. Sine is the only supported waveform.

Targets use the shared semantic control catalog while retaining the raw parameter id in secondary text. Missing targets remain visible and editable. Behavior ids are stable across render and save; duplication alone creates a new id.

Composition follows the existing runtime pipeline: State interpolation, Animation track values, Behaviors, then live editor overrides. Oscillator and Random Idle values are additive; an active Blink overrides its target temporarily. Behavior array order is not user-significant for the supported types except that multiple operations on the same target naturally compose in array order, so this release does not add reordering UI.
