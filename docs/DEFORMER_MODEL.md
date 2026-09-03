# Deformer model — light transform hierarchy

```text
root
 │
 └─ body
      │
      ├─ head
      │   ├─ eyes
      │   ├─ eyebrows
      │   └─ mouth
      │
      ├─ leftHandAnchor
      │     └─ leftHand
      │
      └─ rightHandAnchor
            └─ rightHand
```

A **deformer** is a named transform with a parent. That is all: no bones, no
bind poses, no weights, no skinning. It exists so a head can carry its features
and an anchor can carry a hand, independently of how the SVG happens to be
nested.

Implementation: `project/runtime/deformers.js` with the matrix maths in
`project/runtime/transform-2d.js`.

## The record

```js
{
  id: 'head',
  name: 'Head',
  parent: 'body',
  pivot: { x: 0, y: 0 },
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
  bindings: { rotation: { expression: 'headTilt', amplitude: 8 } }
}
```

An element joins the hierarchy with `element.deformer = 'head'`. Bindings are
evaluated exactly like element bindings — the same parser, the same curves, no
second implementation.

## The order is the point

```text
rest / local deformation
       ↓
local transform
       ↓
parent transform
       ↓
world transform
```

Local deformation never happens after the world transform. A shape key that
squashes a mouth squashes it in the mouth's own space, and only then does the
head carry the result.

## Why matrices

`compileRigFrame` composes `parentWorld ∘ elementLocal` as a 2×3 affine matrix
and emits `frame[id].matrix`; the renderer writes it as `matrix(a b c d e f)`.
Decomposing back into `{x, y, rotation, scaleX, scaleY}` would lose a parent's
rotation combined with a non-uniform scale, which is exactly the case a
hierarchy exists to handle.

An element with no deformer — or one whose chain resolves to identity — keeps
its channel-based transform, so a rig that does not use the hierarchy compiles
to byte-identical output.

## Cycles

A parent chain that closes a loop is **reported, never followed**: an evaluator
that walked one would hang the render loop. A deformer inside a cycle resolves
to its own local matrix, so a broken hierarchy looks wrong rather than making
artwork vanish while the author fixes it.

`deformerIssues()` returns `{ cycles, missing }`, and validation turns those
into author-facing messages in the `hierarchy` domain:

> Group "Head": its parent chain forms a loop, so it cannot be placed.
> Group "Hand": it is inside "torso", which does not exist.

Duplicate ids are dropped rather than shadowing each other, and a scale of zero
is reported because it would collapse everything inside the group.

## Hand anchors

A hand's `parent` may name either a drawn element or a deformer. When it names
a deformer, the anchor drift comes from that deformer's world matrix. See
`docs/HAND_RIGGING.md`.

## Tests

`hierarchy-depth.test.js` covers matrix/transform equivalence, composition
order, binding-driven channels, cycle and missing-parent reporting, duplicate
ids, the composed frame matrix, the identity no-op, normalization and export,
and the author-facing diagnostics.
