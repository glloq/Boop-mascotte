# Semantic Rigging

Semantic Parts are editor-only metadata layered over the generic runtime rig. The runtime continues to consume parameters, bindings, morphs, states, and behaviors; it does not need to understand parts.

The registry covers Head, Eyes, Pupils/Gaze, Eyelids, Eyebrows, Nose, Mouth, Jaw, Hair, Ears, and Accessory/Generic. A part assigns named roles to SVG elements. Enabling a control creates its canonical parameter and ordinary low-level bindings. Simple mode is intended for role assignment and graphical controls; Advanced mode remains the place to edit expressions, curves, amplitudes, offsets, pivots, and constraints.

Fresh SVG imports are intentionally neutral: no face parameters, movement bindings, or morph animation are inferred. Rigging begins only when the user adds a Semantic Part or explicitly uses Advanced controls.
