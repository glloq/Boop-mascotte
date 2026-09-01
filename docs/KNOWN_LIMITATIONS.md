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

## Visual Rig authoring

- Morph endpoint editing reuses authored path/node editing and intentionally requires identical path command topology. Adding or deleting nodes during endpoint authoring is not supported.
- Calibration pose capture currently reads the authored transform shown on the canvas; a fully isolated ghost-pose editor and automatic mirrored calibration are not yet available.
- Phone layouts prioritize assignment and testing; detailed calibration is best performed on tablet or desktop.

## Dope Sheet limits
- Key drags clamp to the current duration rather than auto-extending it.
- The timeline-local clipboard is intentionally not written to project files and resets with the editor session.
- Phone layout retains essential authoring, but precise marquee/group dragging is intended for tablet/desktop.
- There is no graph editor, F-curves, Bezier/tangent editing, or loop sub-range.
- States, transitions, and behaviors retain their existing editors and are outside this redesign.
