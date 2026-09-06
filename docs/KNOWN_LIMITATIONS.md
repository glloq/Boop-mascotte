# Known limitations

- Morph endpoints require compatible SVG path command topology; arbitrary path normalization and node-count changes are not supported.
- The **legacy** morph slot is still one per element: switching a second semantic control to a shape on the same element is refused with a notice. V2's additive shape keys (`docs/SHAPE_KEYS.md`) have no such limit — a mouth can carry Smile, Open and a head-pose correction at once — and `migrateLegacyMorphs()` converts a legacy morph into one.
- Animations are exported in `rig.json.animations` and play through `mascot.playMotion(id)` or Reactions. Motions cross-fade into one another, fade out at their end, and can be layered with `playMotion(id, { layer: true })` (`docs/ADR_MOTION_LAYERING.md`); a clip played *by a reaction* rides that reaction's attack/hold/release envelope. Two layered motions writing the same parameter resolve by start order — the newer one wins — rather than by a weighted average.
- There is no F-curve/tangent editor, timeline-style multi-clip mixer (motions layer at runtime but there is no track view for them), conditional transition language, bones, mesh deformation, physics, audio timeline, or 3D runtime.
- Shape keys, deformers and depth/parallax are played by the runtime and arrive with an imported rig, but only warps and keyforms have an authoring panel. Advanced → **Deformation** lists what a project carries and says where each one is edited.
- State graph layout is deterministic rather than manually positioned (edges take separate lanes so every one of them is selectable, but nodes stay on one row). Transitions interpolate States and do not trigger Timeline clips.
- Phone layouts expose critical actions, but precision path calibration, marquee selection, and grouped key dragging are best on tablet/desktop.
- A selection of several pieces moves, nudges, aligns, spreads, groups and deletes as one; rotating or scaling several at once is not supported — group them, then transform the group. Copy, paste and duplicate act on the piece in hand, not on the whole selection.
- The marquee picks the pieces wholly inside it (so a box around two eyes picks the eyes and not the face); it never picks a piece it merely touches.
- No gradient editor, guides, boolean operations (union, subtract) or path simplification; fills and strokes are flat colours or `none`.
- Text is placed with the Text tool and typed in the Inspector — there is no editing on the canvas, and the font is the exported `font-family` (Inter, then the system's sans-serif).
- The sanitizer rejects known executable/external SVG features, but applications accepting hostile files should continue to apply their own maintained content policy.
- Keyboard operation covers the XY pads (arrow keys) and focus returns from every surface (UX-21); forced-colors tuning, 200 % zoom baselines and cross-browser screenshot baselines remain follow-ups.

## V2

- The rig calibration pose tools still use `svg.select.js` / `svg.resize.js` /
  `svg.draggable.js`. Ordinary selection uses the Boop gizmo
  (`docs/SELECTION_GIZMO.md`); removing the dependency waits until those tools
  move onto the gizmo too.
- Warp grids are added, sized, faded, reset and removed from the panel, and
  their control points are dragged on the canvas (`ux42-warp.spec.js`), but
  they do not use the transform gizmo: a lattice is moved point by point.
- Pins are placed, dragged, reached and mirrored on the canvas, and several
  are moved together by one movement (`docs/FACE_CONTROL_RIG.md`, "Authoring
  pins"), but they are moved one at a time: no marquee over pins, no dragging
  several at once. Attachment points and holds are numbers in the panel, not
  handles on the canvas. A pin holds a path: a rectangle or an ellipse is
  converted to a path first (the Inspector offers it).
- The head-pose panel is fixed at 3 × 3. The engine and the model support any
  irregular axes (`setHeadPoseAxes`); the panel does not expose that.
- Shape keys and warps both need a rest outline on the element. An element with
  no `restPath` is reported by validation rather than silently doing nothing.
- Depth is a scalar with three draw-order bands, not a Z buffer: two elements
  in the same band keep their SVG order.
- Hand inertia is one spring per parameter. It is not a physics engine and will
  not resolve collisions, hair strands or cloth — see
  `docs/FUTURE_OUT_OF_SCOPE.md`.
- The template ships the 2.5D turn generated, which is 114 keyforms and most of
  the 200 kB of a pretty-printed `rig.json`. It compresses well and costs
  nothing per frame that an authored turn would not, but a project that does not
  want a turn should clear the grid (**Head pose → Reset all**) rather than
  carry it.
- One face template (`docs/MASCOT_TEMPLATE.md`), plus a **Blank canvas** to
  draw from nothing. Starting from something other than this face means
  drawing it, importing an SVG or using **Build a Face**; there is no gallery
  of starting mascots, and a project's artwork is not swappable underneath its
  rig.
- A generated hand is six parts drawn from tables of numbers, not a jointed
  finger: a curl shortens a digit and swells its knuckle, a bend hooks it in
  the plane, and Wave is a rotation rather than a shape. The facing axis stops
  at the palm and the two profiles -- there is no back-of-the-hand view -- and
  a pose without a profile drawing of its own (Peace, OK, Pinch, Stop, Spread,
  Relax) keeps its palm-view shape when the hand turns. On the far side the
  thumb is repainted behind the palm, on the canvas as in the exported
  runtime, and fades out on the way as well (`docs/HAND_RIGGING.md`).
- An imported set of drawings is measured by the browser at import: a drawing
  that references `<defs>` of its file (a gradient, a clip) loses them, and a
  set drawn for the other hand is not flipped automatically.
- The teeth are one band and the tongue one blob: they open, close, follow the
  smile and travel with the turn, but there are no individual teeth, no lower
  row and no tongue that moves on its own inside the mouth
  (`docs/MASCOT_TEMPLATE.md`).
- A movement moves both sides together until **One side at a time** is
  ticked in its Advanced section (Eyes, Pupils / Gaze, Eyelids, Eyebrows):
  that gives each side its own control for a wink or a single raised brow.
  Only a movement that writes a transform can be split; a shaped movement
  cannot.
- Shape keys still have no authoring panel, so a movement using the `shapeKey`
  method cannot have its shapes re-captured from the canvas — switching its
  method away deletes them (undo restores them). Advanced → **Deformation**
  lists what a project carries.
- The Pen draws straight segments between the points it is given; curves are
  made afterwards with the Node tool. There is no bezier handle on the canvas.
- One piece of artwork is selected at a time. There is no marquee or
  Shift-click multi-selection, so no alignment / distribution, grouping of
  several pieces at once, or boolean operations; a group is made from one
  piece and filled by moving others into it. Gradients survive import and can
  be named in the Fill field (`url(#id)`), but there is no gradient editor, and
  there is no grid, ruler or guide (`docs/SYSTEM_AUDIT_2026-09.md`).
- Appearance edits write presentation attributes and clear a conflicting
  inline `style` on the element. A rule in an imported `<style>` block or a
  `class` still wins over the attribute; such a shape shows the computed
  colour but does not change from the Inspector.
- The rig pivot handle and the morph-pose node handles are pointer-only;
  the transform gizmo, path nodes and puppet handles all have arrow keys.
- The exported runtime grew from 6.6 kB to 16.2 kB gzipped across V2. It still
  embeds no editor code, but the next block that is not universally useful
  should be behind an opt-in build.
