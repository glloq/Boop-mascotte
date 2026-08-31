# Known limitations

This stabilization keeps the current rig format intentionally small.

- Simple semantic drivers cover translation, rotation, scale, opacity metadata, and morph-capable strategies, but morph pose normalization and per-role method selectors still need richer UI.
- Base transforms are preserved and animation is applied as a delta, but the editor does not yet expose separate base/delta tracks.
- Continuous inspector input still creates many history entries; transaction/coalescing support is pending.
- Keyboard operation of XY pads is not complete.
- Morphing requires paths with matching command/token layouts; Bézier normalization is not implemented.
- The built-in sanitizer blocks common executable SVG features but is not a replacement for a maintained, policy-driven sanitizer for untrusted documents.
- Animation clips remain project-only snapshot metadata and are intentionally absent from runtime schema v3 exports.

- Morph currently requires compatible SVG path command/token layouts; arbitrary path normalization remains post-v1.
- Animation clips remain project/editor metadata under runtime schema v3.
- The complete browser contracts are authored, but this checkpoint could not execute them locally because the npm proxy rejects Playwright packages with HTTP 403; CI remains authoritative.
