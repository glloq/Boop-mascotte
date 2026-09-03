# Known limitations

- Morph endpoints require compatible SVG path command topology; arbitrary path normalization and node-count changes are not supported.
- An artwork element carries one morph slot. Switching a second control to a shape on the same element (for example Mouth open on the Basic Face mouth, whose Smile is already a morph) is refused with a notice until the owning control uses another method.
- Animations are exported in `rig.json.animations` and play through `mascot.playAnimation(id)` or Reactions (since UX-13); there is still no clip blending or layering at runtime.
- There is no F-curve/tangent editor, multi-clip mixer, animation layering, conditional transition language, bones, mesh deformation, physics, audio timeline, or 3D runtime.
- State graph layout is deterministic rather than manually positioned. Transitions interpolate States and do not trigger Timeline clips.
- Phone layouts expose critical actions, but precision path calibration, marquee selection, and grouped key dragging are best on tablet/desktop.
- The sanitizer rejects known executable/external SVG features, but applications accepting hostile files should continue to apply their own maintained content policy.
- Keyboard operation covers the XY pads (arrow keys) and focus returns from every surface (UX-21); forced-colors tuning, 200 % zoom baselines and cross-browser screenshot baselines remain follow-ups.
