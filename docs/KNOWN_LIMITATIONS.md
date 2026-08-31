# Known limitations

This stabilization keeps the current rig format intentionally small.

- Simple semantic drivers cover translation, rotation, scale, opacity metadata, and morph-capable strategies, but morph pose normalization and per-role method selectors still need richer UI.
- Base transforms are preserved and animation is applied as a delta, but the editor does not yet expose separate base/delta tracks.
- SVG layers are flat. Nested hierarchy and advanced drag/drop are not represented.
- `mascot.svg` export is the sanitized imported markup, not a lossless serialization of live reorder, preview morph, or transforms.
- Continuous inspector input still creates many history entries; transaction/coalescing support is pending.
- Timeline keyframe pointer dragging and keyboard operation of XY pads are not complete.
- Morphing requires paths with matching command/token layouts; Bézier normalization is not implemented.
- The built-in sanitizer blocks common executable SVG features but is not a replacement for a maintained, policy-driven sanitizer for untrusted documents.
