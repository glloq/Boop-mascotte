# V2 Baseline — audit before the cartoon 2D/2.5D program

Phase A of `docs/V2_ROADMAP.md`. Nothing in this document changes behaviour; it
records the state of `main` that every later V2 phase is measured against.

## Starting point

| Item | Value |
| --- | --- |
| Baseline commit | `bc78c88` (`Merge pull request #64 … ux-ui-audit`) |
| Branch | `claude/boop-mascotte-roadmap-v2-080vvw` |
| Node | >= 22 (`package.json#engines`) |
| Build tool | Vite 6 |
| Runtime schema | `RIG_SCHEMA_VERSION = 3` (`project/runtime/runtime.js:1`) |

## Verification results

```
npm run verify   → check:conflicts + node --test + vite build
  tests 196 / pass 196 / fail 0   (~1.6 s)
  build ✓ 159 modules
```

Bundle sizes produced by the baseline build:

| Chunk | Raw | Gzip |
| --- | --- | --- |
| `assets/runtime-*.js` | 17.03 kB | 6.57 kB |
| `assets/editor-*.js` | 465.11 kB | 137.07 kB |
| `index.html` | 51.29 kB | 11.26 kB |

`npm run verify:e2e` (Playwright: chromium `@critical` + firefox/webkit smoke)
needs browser binaries. The container ships Chromium at
`/opt/pw-browsers/chromium`; Firefox and WebKit are not installed, so the smoke
half of the gate cannot run here. The unit gate (`npm run verify`) is therefore
the authoritative signal for this program, and browser gates are re-run in CI.

## Architecture that V2 touches

```text
project/
├── runtime/runtime.js         ← the whole public runtime (single file, 496 lines)
│     RIG_SCHEMA_VERSION, BINDING_PROPERTIES, normalizeBinding, parseExpression,
│     evaluateExpression, curveValue, compileRigFrame, normalizeExpressions,
│     composeExpressionParams, normalizeAnimations, evaluateAnimationClip,
│     normalizeReactions, createReactionController, normalizeBehaviors,
│     composeBehaviorParams, createBehaviorController, createMascotEngine
├── editor/core/
│   ├── rig/                   ← project-model, normalize-rig, parameters, symmetry
│   ├── bindings/, morph/      ← thin re-export layers over runtime math
│   ├── preview-runtime/       ← frame-compiler (delegates to compileRigFrame)
│   ├── expressions/ motion/ reactions/ behaviors/ state/
│   ├── validation/ export/ commands/ undo/ svg-document/
│   └── tests/                 ← 196 node:test cases
├── editor/svg-editor/         ← svg-canvas.js (340 lines), layers-panel.js
├── editor/rig-editor/         ← rig-store + semantic-parts (face roles/setup)
├── editor/inspector/, editor/ui/, editor/animation-editor/
└── assets/, demo/
```

### Data model, as it exists today

`normalizeRig()` (`project/editor/core/rig/normalize-rig.js`) is the single
migration boundary and returns:

```text
{ schemaVersion: 3, params, states, elements, activeState, transitions,
  transitionSettings, behaviors, globalConstraints, stateConstraints, … }
```

* **params** — `{ type:'number', min, max, default, value }`, arbitrary names.
* **states** — dense `{ paramName: number }` maps, one per state.
* **elements** — `{ baseTransform{x,y,rotation,scaleX,scaleY,pivotX,pivotY},
  baseOpacity, bindings, constraints, morph? }`.
* **bindings** — per property of `BINDING_PROPERTIES`
  (`translateX, translateY, rotation, scaleX, scaleY, opacity`), each
  `{ enabled, mode, expression, curve, amplitude, offset }`.
* **morph** — at most **one** A/B path morph per element, driven by one
  parameter with a `min`/`max` window.

### Evaluation pipeline, as it exists today

```text
state params ─┬─ transition lerp ─┬─ animation clip ─┬─ reactions ─┬─ expressions
              │                   │                  │             │
              └───────────────────┴──────────────────┴─────────────┴─ overrides
                                        │
                                        ▼
                              composeBehaviorParams
                                        │
                                        ▼
                                 compileRigFrame
                          expression → curve → ×amplitude → +offset
                          → constraints → base transform → frame
                                        │
                                        ▼
                          SVG attribute writes (transform / opacity / d)
```

Composition today is a chain of `{ ...a, ...b }` spreads inside
`createMascotEngine`, not a declared mixer.

## Limitations this baseline confirms

1. **One morph per element.** `element.morph` is a single object with `pathA`,
   `pathB`, `param`. Smile *and* mouth-open on the same mouth is impossible.
2. **Path strings are re-split every frame.** `morphPath()` calls
   `String(a).replace(/,/g,' ').split(/\s+/)` inside the render loop.
3. **No keyforms.** Parameter → geometry goes through arithmetic expressions
   only; there is no `[-1, 0, +1]` pose axis and no 2D pose grid.
4. **No head pose, no hands.** `semanticParts` covers face roles
   (eyes/brows/mouth/pupils); there is no `leftHand`/`rightHand` concept and no
   anchor model.
5. **No transform hierarchy.** Every element is transformed independently from
   its own `baseTransform`; SVG nesting is the only parenting.
6. **Composition order is implicit.** Spread-merge order in
   `createMascotEngine` decides who wins; nothing declares additive vs.
   multiplicative vs. override.
7. **Transitions are state-machine only.** `setState` lerps between two resolved
   *state* vectors. Expression → expression changes have no continuity layer.
8. **Selection overlay is library-driven.** `svg.select.js` / `svg.resize.js` /
   `svg.draggable.js` draw the current selection chrome; pivot is inspector-only.
9. **No depth/parallax metadata** and no draw-order control beyond SVG order.

## Runtime and preview parity today

`project/editor/core/preview-runtime/frame-compiler.js` delegates to the
runtime's `compileRigFrame`, and `bindings/` and `morph/` are re-export shims
over the same functions, so editor preview and the exported runtime already
share expression/curve/constraint math. **Preserving that single-implementation
rule is a hard constraint for every V2 phase.**

## Dependencies

Runtime dependencies are `svg.js@2.7.1` plus its `svg.select.js`,
`svg.resize.js`, `svg.draggable.js` plugins. Dev: `vite`, `@playwright/test`.
The exported runtime chunk imports none of them.

## Approximate performance

Measured indirectly: `compileRigFrame` is O(elements × bound properties) with a
cached expression parser (FIFO, 512 entries), and the engine ticks at `fps: 20`
by default with per-node attribute diffing (`applied` WeakMap) so unchanged
nodes skip DOM writes. The two known per-frame costs are `morphPath` string
splitting and the `{ ...spread }` allocations in `composed()`.

## Rule for the phases that follow

No behaviour change lands without: the unit gate green, a test for the new
behaviour, and no second copy of any math that the runtime already owns.
