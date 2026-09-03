# Known limitations

- Morph endpoints require compatible SVG path command topology; arbitrary path normalization and node-count changes are not supported.
- The **legacy** morph slot is still one per element: switching a second semantic control to a shape on the same element is refused with a notice. V2's additive shape keys (`docs/SHAPE_KEYS.md`) have no such limit — a mouth can carry Smile, Open and a head-pose correction at once — and `migrateLegacyMorphs()` converts a legacy morph into one.
- Animations are exported in `rig.json.animations` and play through `mascot.playAnimation(id)` or Reactions (since UX-13); there is still no clip blending or layering at runtime.
- There is no F-curve/tangent editor, multi-clip mixer, animation layering, conditional transition language, bones, mesh deformation, physics, audio timeline, or 3D runtime.
- State graph layout is deterministic rather than manually positioned. Transitions interpolate States and do not trigger Timeline clips.
- Phone layouts expose critical actions, but precision path calibration, marquee selection, and grouped key dragging are best on tablet/desktop.
- The sanitizer rejects known executable/external SVG features, but applications accepting hostile files should continue to apply their own maintained content policy.
- Keyboard operation covers the XY pads (arrow keys) and focus returns from every surface (UX-21); forced-colors tuning, 200 % zoom baselines and cross-browser screenshot baselines remain follow-ups.

## V2

- The rig calibration pose tools still use `svg.select.js` / `svg.resize.js` /
  `svg.draggable.js`. Ordinary selection uses the Boop gizmo
  (`docs/SELECTION_GIZMO.md`); removing the dependency waits until those tools
  move onto the gizmo too.
- Warp grids can be added, sized, faded, reset and removed from the panel, and
  their control points moved through commands, but dragging the handles
  directly on the canvas is not wired to the gizmo yet.
- The head-pose panel is fixed at 3 × 3. The engine and the model support any
  irregular axes (`setHeadPoseAxes`); the panel does not expose that.
- Shape keys and warps both need a rest outline on the element. An element with
  no `restPath` is reported by validation rather than silently doing nothing.
- Depth is a scalar with three draw-order bands, not a Z buffer: two elements
  in the same band keep their SVG order.
- Hand inertia is one spring per parameter. It is not a physics engine and will
  not resolve collisions, hair strands or cloth — see
  `docs/FUTURE_OUT_OF_SCOPE.md`.
- The exported runtime grew from 6.6 kB to 16.2 kB gzipped across V2. It still
  embeds no editor code, but the next block that is not universally useful
  should be behind an opt-in build.
