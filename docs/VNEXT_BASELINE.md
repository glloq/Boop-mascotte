# VNext baseline (VNX-00)

VNext rebuilds the editing experience on an engine that works. Before moving
anything, this records what "works" is — measured, not remembered — so a
refactor that loses something has a number to fail against.

Measured on the commit that introduced this file.

## Gates, green

| Gate | Command | Result |
| --- | --- | --- |
| Unit | `npm test` | 694 passed, 0 failed (3.2 s) |
| Build + conflicts + unit | `npm run verify` | green; 222 modules transformed |
| Browser, full Chromium suite | `npx playwright test --project=chromium` | 147 passed (4.7 min) |
| Browser, release gate | `npm run verify:e2e` | 83 `@critical` across 36 files, then the Firefox/WebKit smoke |

## Capability floor

The capabilities of the journey -- its fourteen steps, plus moving between
them -- are each pinned to the tests that hold them up, declared in
`project/editor/core/tests/vnext-baseline.test.js` and checked on every run: the named files must exist, and a spec declared critical
must really carry a `@critical` test.

```text
import SVG → template → edit artwork → assign parts → movements → head 2.5D →
hands → expressions → motions → reactions → timeline → behaviours → preview →
export/load          (+ navigate, which is how an author reaches any of them)
```

That test is the floor. Merging two workspaces is allowed; merging them and
leaving a capability with nothing watching it is not — the baseline fails and
names the capability.

## Contracts

`project/editor/core/tests/vnext-contracts.test.js` freezes the four things
VNext is not allowed to break, because something outside the editor already
depends on them (VNX-01):

| Contract | What is frozen |
| --- | --- |
| Runtime API | 26 public methods and 8 pre-V2 aliases, asserted on the **exported bundle** |
| `rig.json` | 22 top-level fields; authoring-only state (`rigHandles`, `semanticParts`) must stay out |
| `ProjectDocument` | every key belongs to exactly one domain, and every domain names a real key |
| Save / load | every domain survives, and normalisation happens exactly once — the format does not drift on repeated saves |

Adding is always allowed. Every assertion is about what must still be there.

The editor/runtime import boundary is already held up by
`release-regressions.test.js` and is not repeated.

## Numbers the roadmap will be judged against

| Measure | Now | Item that should move it |
| --- | --- | --- |
| `main.js` | 694 lines, orchestrating almost everything → **8 lines** | VNX-02 ✅ |
| Editor modules | 168 files (excluding tests) | — |
| `index.html` | 68.0 kB, of which 67.3 kB is one inline `<style>` | VNX-67 (`styles/`) |
| Editor bundle | 771.9 kB raw / 231.9 kB gzip, one chunk | VNX-55, VNX-56 (lazy workspaces) |
| Runtime chunk | 50.1 kB raw / 17.3 kB gzip | VNX-64 → VNX-66 (modular runtime) |
| Document domains | 12 | VNX-05 ✅ (the fan-out is a checked table) |

The editor bundle being a single chunk is the reason Vite warns about it, and
it is the honest reading of the current architecture: no workspace can be
loaded on demand while everything imports everything.

## What this file is not

Not a promise that the editor is good. `V1_UX_AUDIT.md`,
`UX_UI_CURRENT_AUDIT.md` and `KNOWN_LIMITATIONS.md` cover what is wrong with
it, and the roadmap in `VNEXT_ROADMAP.md` is the answer to them. This file only
establishes that the thing being rebuilt is, right now, whole.
