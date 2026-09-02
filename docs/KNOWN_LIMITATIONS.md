# Known limitations

- Morph endpoints require compatible SVG path command topology; arbitrary path normalization and node-count changes are not supported.
- Animations are exported in `rig.json.animations` and play through `mascot.playAnimation(id)` or Reactions (since UX-13); there is still no clip blending or layering at runtime.
- There is no F-curve/tangent editor, multi-clip mixer, animation layering, conditional transition language, bones, mesh deformation, physics, audio timeline, or 3D runtime.
- State graph layout is deterministic rather than manually positioned. Transitions interpolate States and do not trigger Timeline clips.
- Phone layouts expose critical actions, but precision path calibration, marquee selection, and grouped key dragging are best on tablet/desktop.
- The sanitizer rejects known executable/external SVG features, but applications accepting hostile files should continue to apply their own maintained content policy.
- Keyboard operation of XY pads and complete focus restoration across every legacy dialog need further accessibility work.
