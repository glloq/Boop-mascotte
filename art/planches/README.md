# Planches

Delivered art direction, one file per sheet. See `../README.md` for what this
directory is and what is done with what lands in it.

## What is here

| File | Sheet | Used by |
| --- | --- | --- |
| `owl-face-background-only-v7.svg` | Bird face background — owl | `head.bird-owl` |
| `duck-face-background-only-v3.svg` | Bird face background — duck | `head.bird-duck` |
| `parrot-face-background-only-v1.svg` | Bird face background — parrot | `head.bird-parrot` |
| `crow-face-background-only-v1.svg` | Bird face background — crow | `head.bird-crow` |

All four are frontal face backgrounds in a `0 0 240 240` frame: a head
silhouette with its feather masses, and no eyes, beak, ears or accessories —
each file says so in its own `<desc>`.

## These four are load-bearing

`project/editor/core/tests/masc12c-bird-reference.test.js` reads them. It
flattens each delivered outline, samples its half-width at seventeen heights,
and compares that against the head `builtin/birds/heads.js` ships for the same
species. More than **3 units** apart — 1.5% of a head's width — and the test
fails, naming the species and the height.

So: **do not delete or rename these without changing that test.** A drawing here
is not decoration beside the code; it is the thing the code is checked against.
Adding files is always safe. Replacing one with a new version is the intended
way to redirect a head — change the file, run `node --test
project/editor/core/tests/masc12c-bird-reference.test.js`, and the failure tells
you exactly where the shipped head now disagrees with the art.

`docs/BEAK_SOFT_CARTOON_PILOT.md` ("MASC-12C") records what was measured off
these four, what was taken from them, and the two things about the library's
palette that stopped the rest of their painting at the door.

## Still missing

`bird-cute` and `bird-slim` have no reference. They are the two heads in the
pack still drawn from a caption alone.
