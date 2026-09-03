# Open-source references for Boop V2

Boop V2 studies several open-source projects as **conceptual references**. The
rule for this program is *reimplement simple concepts, do not copy code*. Every
module written against a reference below was written from the description of
the idea, in Boop's own idiom, against Boop's own data model.

If that ever stops being true for a file, this document must record the copy
and the licence obligation it carries.

| Project | Repository | Licence | Inspected | Concept reused | Status in Boop |
| --- | --- | --- | --- | --- | --- |
| Iki | `github.com/zeikar/iki` | MIT | `main`, docs + module names of `packages/engine/src/warp.ts`, `warp-grid.ts`, `packages/editor-core/src/grid-keyform.ts` | parameters, 1D/2D keyforms, bilinear parameter interpolation, AngleX × AngleY grid, transform hierarchy, warp grid, local deformation before parent transform | **reimplemented** — `project/editor/core/keyforms/*`, `project/runtime/*` |
| Inochi2D | `github.com/Inochi2D/inochi2d` | BSD-2-Clause | conceptual only | parameters, nodes, deformers, model/runtime separation, pseudo 2D depth | **concept only** — no D code ported |
| Inochi Creator | `github.com/Inochi2D/inochi-creator` | BSD-2-Clause | conceptual only | rigging UX, pivot manipulation, parameter panels, deformation UX, controller organisation | **UX reference only** |
| Stretchy Studio | `github.com/MangoLion/stretchystudio` | see repository | conceptual only | shape keys, additive deformation, direct shape editing, cartoon workflow | **reimplemented** — `project/editor/core/shape-keys/*` |
| SVG.js | `github.com/svgdotjs/svg.js` | MIT | v2.7.1 as shipped | SVG DOM helper | **dependency** (already in `package.json`) |
| Moveable | `github.com/daybrush/moveable` | MIT | conceptual only | move/rotate/scale/resize/pivot handles, snapping | **UX reference only** — Boop's gizmo is hand-written, Moveable is not a dependency |

## Notes on each reuse

### Iki — keyforms

Boop's `keyforms` module implements the same *idea*: a parameter axis carries
ordered sample values, a keyform stores a channel value at each sample, and a
parameter between two samples produces a linear blend; two axes produce a grid
blended bilinearly from the four surrounding corners. The Boop implementation
is a standalone, DOM-free module with its own naming (`createAxis`,
`evaluateKeyform1D`, `evaluateKeyform2D`) and its own irregular-axis and clamp
semantics, and it is shared by editor and runtime rather than split across two
packages.

### Iki — warp grid

Same distinction: Boop implements bilinear *spatial* interpolation over a small
control grid. Boop deliberately keeps grids at 3×3/4×4, applies them to parsed
path coordinates rather than to a mesh, and keeps parameter interpolation and
spatial interpolation in separate modules with separate tests.

### Stretchy Studio — shape keys

Boop implements `final = rest + Σ(delta × weight)` over parsed numeric path
vectors with a topology signature guard. The additive formulation is a
well-known blend-shape technique; no Stretchy Studio source was consulted while
writing it.

### Moveable — gizmo

Boop's gizmo is a hand-written SVG overlay because it must live in the editor's
own SVG coordinate space, respect the rig's authored pivot, and emit one undo
command per drag. Moveable is credited for the interaction vocabulary
(corner/edge handles, a detached rotate handle, a movable pivot marker, shift
constraints) and for nothing else.

## Adding a reference

When a new project is consulted, add a row with: repository, licence, the
commit or tag actually inspected, the concept taken, the files studied, and
whether Boop's code is copied, adapted, or reimplemented. Large copies need a
licence review before they land.
