# Known limitations

This stabilization keeps the current rig format intentionally small.

- Base transforms are preserved and animation is applied as a delta, but the editor does not yet expose separate base/delta tracks.
- Continuous inspector input still creates many history entries; transaction/coalescing support is pending.
- Keyboard operation of XY pads is not complete.
- The built-in sanitizer blocks common executable SVG features but is not a replacement for a maintained, policy-driven sanitizer for untrusted documents.
- Morph currently requires compatible SVG path command/token layouts; arbitrary path normalization remains post-v1.
- Animation clips remain project/editor metadata under runtime schema v3.
- There is no multi-clip mixer, animation layering, physics, bones, mesh deformation, or 3D runtime.

## Release-gate note

The browser suite must still run on GitHub-hosted Chromium, Firefox, and WebKit because Playwright browser downloads are blocked in the current local environment. Animation clips intentionally remain project-only metadata in schema v3 and are not shipped in runtime `rig.json`.
