# `art/` — the delivered art direction

Where the source art lives. Nothing here is built, imported or bundled: the
editor never reads this directory, and `npm run build` does not touch it. It is
the **reference** the drawings in `project/editor/core/face-library/builtin/`
are made from, kept beside the code so the two cannot drift apart in anybody's
head.

```text
art/planches/     the delivered sheets, one file per planche
```

## Why this exists

Every pack in the library so far was drawn from a sheet delivered as an image in
conversation:

| Sheet | Pack | Milestone |
| --- | --- | --- |
| Soft Cartoon — Face Parts V1 | `builtin/animals/` | MASC-10A · 10B |
| ROBOT-V1 | `builtin/robots/` | MASC-11A · 11B |
| BIRD-10A | `builtin/birds/` | MASC-12A · 12B |

An image is enough to work from and it is not enough to work from *well*. A
silhouette read off a screenshot is a silhouette guessed at; the same silhouette
delivered as SVG is a path that can be measured, re-parameterised and lifted.

## Drop files here

Any of these, named after the planche:

```text
art/planches/BIRD-10A-heads.svg
art/planches/ROBOT-V1.svg
art/planches/humanoid-v1.png
```

**SVG is worth much more than a raster.** An SVG is text, so its path data, its
exact coordinates and its colours can be read and reused directly — the drawing
that ends up in the library can be the delivered one re-fitted to the template
frame, rather than an approximation of it. A PNG or a JPEG still works; it is
just back to reading by eye.

Multiple planches, or one per row, or one file per piece: all fine. Whatever is
easiest to export is the right thing to put here.

## What happens to them

A planche dropped here is **not** a face part. It goes through the same route
every pack has:

1. a manifest in `core/face-library/pilots/`, transcribing the sheet piece by
   piece, with its own caption on every entry;
2. drawings in `core/face-library/builtin/<pack>/`, fitted to the template frame
   (`docs/FACE_ASSET_AUTHORING.md`) and reviewed by `npm run face:assets`;
3. a test that holds the two to each other, id for id and name for name.

The geometry contract is the part that never bends: a library drawing is
authored in the template's frame — the face's middle at 120, 116, the eyes at
113, the brow line at 81 — so the same reference box fits it onto any face. A
delivered SVG almost never arrives in that frame, and re-fitting it is the first
thing that happens to it.

## What not to put here

Renders, screenshots of the editor, and exported mascots. `out/` is where
`npm run face:assets` and `scripts/face-snapshots.mjs` write their review
sheets, and it is gitignored precisely because a render is not a source.
