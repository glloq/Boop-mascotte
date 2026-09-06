# Boop Mascotte

Boop Mascotte is a privacy-friendly, browser-only SVG mascot editor. It turns an SVG into a parameterized mascot with layers, states, transitions and behaviors, then exports portable assets for any static web page. It needs no account, backend, database or private API.

## Artwork → Face Setup → Animate → Preview

The visual editor is organized as four stages with their steps: **Create** (Artwork, Face Setup), **Animate** (Expressions, Motions), **Behaviors** (Reactions and the automatic behaviours) and **Publish** (Preview, with the readiness checklist and Export). **Artwork** starts from a face template or imported SVG and edits layers, colours and shapes, **Face Setup** assigns face parts by clicking the canvas and provides friendly Face Controls, **Motions** holds the presets and the key-by-key Timeline, and **Preview** offers clean, non-destructive testing. Save and Export stay available throughout; implementation-level settings live under **••• → Advanced**.

## Live Editor

**https://glloq.github.io/Boop-mascotte/**

The editor, persistence, preview and exports use browser APIs only. The [standalone runtime demo](https://glloq.github.io/Boop-mascotte/demo/) shows the default Mascot Face driven by the exported runtime: it loads `mascot.svg`, `rig.json` and `runtime.js` from its own folder exactly as a web page would, and those three files are the ones Export writes for the untouched template (generated at build time by `scripts/demo-assets.mjs`).

## Features

- Sanitized SVG import and Face Builder starters
- Nested layer selection, visibility, locking, naming, ordering (forward, backward, to front, to back), duplication, copy / paste and flipping
- Transform and Appearance inspector (fill, stroke, opacities, line ends, dashes, shape geometry, text), parameter bindings, constraints and path morphs
- Expressions (named faces applied at any intensity) exported for `mascot.setExpression`
- Seven motion presets (Nod, Shake, Bounce, Tilt, Look Around, Eye Dart, Head Pop) compiled to editable animation clips, with a key-by-key Timeline
- Reactions (click, hover, timer or custom event → expression + motion → return) tested in Preview and exported for `mascot.bindEvents()` / `mascot.trigger()`
- States, guarded transitions, blink and idle oscillator behaviors
- Non-destructive preview, validation, undo/redo and local autosave
- Project JSON save/open and `mascot.svg`, `rig.json`, `runtime.js` export

### Cartoon 2D / 2.5D (V2)

- A transform gizmo that does not hide the artwork: move, rotate, scale and a
  draggable pivot, one undo per drag, `G` `R` `S` `P` and Escape
  ([selection gizmo](docs/SELECTION_GIZMO.md))
- **Keyforms**: 1D and 2D pose grids over any parameters, with irregular axes
  and sparse captures ([keyform engine](docs/KEYFORM_ENGINE.md))
- **Additive shape keys**: several deformations on one element at once — a
  mouth can smile, open and be corrected by the head pose together
  ([shape keys](docs/SHAPE_KEYS.md))
- **Head pose 2.5D**: capture the whole face at each position of a `headX × headY`
  grid and turn the head with an XY pad ([head pose](docs/HEAD_POSE_2_5D.md))
- **Floating hands**, Rayman style: anchors that follow the body, a soft reach,
  rotation, poses and a little cartoon inertia ([hand rigging](docs/HAND_RIGGING.md))
- **Continuous transitions**: expression changes cross-fade from what is on
  screen and never pass through neutral ([continuous transitions](docs/CONTINUOUS_TRANSITIONS.md))
- A declared [parameter mixer](docs/PARAMETER_MIXER.md), a light
  [transform hierarchy](docs/DEFORMER_MODEL.md), [depth parallax](docs/DEPTH_PARALLAX.md),
  optional small [warp grids](docs/WARP_GRID.md) and cartoon idle behaviours
- Reactions that orchestrate an expression, a motion and a
  [hand gesture](docs/HAND_GESTURES.md)

## Quick Start

1. Open the Live Editor: Home offers the Basic Face template (recommended), Import SVG and Open Project.
2. **Face Setup**: assign face parts by clicking the artwork, turn on the movements you want and calibrate them by posing the artwork.
3. **Expressions**, **Animate** and **Reactions**: add presets (Happy, Nod, Click → Surprised…) and tune them in the Inspector.
4. **Preview**: test controls, expressions, animations and events, then read the event log.
5. **Save Project** (editable JSON) and **Export** (`mascot.svg`, `rig.json`, `runtime.js`); the Export panel explains anything that blocks it.

## GitHub Pages

Vite builds with the `/Boop-mascotte/` base. `.github/workflows/pages.yml` verifies, builds, uploads a Pages artifact and deploys it with the official Pages actions. No `gh-pages` branch is needed.

## Import SVG and rigging

Use **Import SVG** (Home, Artwork or the project menu) and standard file inputs in every browser. Imports are sanitized before entering the document. IDs are retained when valid and deterministically generated when absent. Select a layer to edit base transforms, bindings, constraints, morphing and display metadata. See [SVG document model](docs/SVG_DOCUMENT_MODEL.md) and [rig model](docs/RIG_MODEL.md).

## Parameters, states and behaviors

Parameters define numeric inputs and ranges. Bind an element property to a safe arithmetic expression such as `lookX * 0.5`, then tune amplitude and curve. States store parameter snapshots; transition settings control duration and easing. Behaviors provide temporary blink overrides and continuous oscillation without overwriting state values. See [behavior reference](docs/BEHAVIORS.md).

## Export

The exported runtime is one standalone file:

```js
import * as BoopMascot from './runtime.js';
const mascot = await BoopMascot.load({ mount: '#mascot', svg: 'mascot.svg', rig: 'rig.json' });
mascot.setExpression('happy');
mascot.playMotion('wave');
mascot.setParameter('headX', 0.5);
```

See the [runtime API](docs/RUNTIME_API.md) and
[runtime performance](docs/RUNTIME_PERFORMANCE.md).

**Save Project** downloads the complete editable snapshot. **Export** downloads:

- `mascot.svg` — sanitized authoring SVG;
- `rig.json` — schema version 4 rig data;
- `runtime.js` — standalone ES module runtime.

Downloads use `Blob`, object URLs and `<a download>` for Chrome, Firefox and Safari compatibility. Rig schema versions 1 to 3 are normalized to the current version 4 by the importer.

## Runtime API

Place the exported SVG inside the container, import the exported module, and pass the SVG root (not the container) to the engine:

```html
<div id="mascot"><!-- contents of mascot.svg --></div>
<script type="module">
  import { createMascotEngine } from './runtime.js';
  const rig = await fetch('./rig.json').then((response) => response.json());
  const mascot = createMascotEngine({
    svgRoot: document.querySelector('#mascot svg'),
    rig
  });
  mascot.setParam('lookX', 0.5);
  mascot.setState('happy');
  mascot.start();
</script>
```

For mouse control, map normalized pointer coordinates to `lookX` and `lookY`:

```js
addEventListener('pointermove', ({ clientX, clientY }) => {
  mascot.setParam('lookX', clientX / innerWidth * 2 - 1);
  mascot.setParam('lookY', clientY / innerHeight * 2 - 1);
});
```

Call `mascot.stop()` when removing the mascot. The runtime caches expressions and SVG nodes and does not use `eval` or `new Function`, so it is compatible with CSP policies that prohibit `unsafe-eval`.

## Local development

```bash
npm ci
npm run dev
```

Development opens at `http://localhost:5173/Boop-mascotte/`. To exercise the production artifact:

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test             # Node unit/security/migration tests
npm run verify       # conflicts + unit tests + production build
npm run test:e2e     # Chromium suite; Firefox/WebKit smoke checks
npm run verify:e2e   # critical Chromium + Firefox/WebKit smoke release gate
npm run test:e2e:stability # long-session stability budgets (Chromium)
npm run test:e2e:pages     # GitHub Pages base-path journey (Chromium)
npm run test:e2e:extended  # detailed Chromium scenarios (manual/nightly)
npm run test:e2e:stress    # long-project stress budgets (manual/nightly)
npm run test:e2e:visual    # reviewed screenshot baselines (on demand)
npm run demo:assets        # write the demo's mascot.svg, rig.json and runtime.js to dist/demo
```

Install browsers once with `npx playwright install --with-deps`. E2E tests start Vite Preview and therefore verify the Pages base rather than relying on the development server.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Rig format](docs/RIG_MODEL.md)
- [Behaviors](docs/BEHAVIORS.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [UX program roadmap and delivery log](docs/UX_UI_IMPLEMENTATION_ROADMAP.md)
- [VNext roadmap](docs/VNEXT_ROADMAP.md), its [baseline](docs/VNEXT_BASELINE.md) and the [panel lifecycle](docs/VNEXT_COMPONENTS.md)
- [Performance budgets](docs/PERFORMANCE_BUDGETS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Changelog](CHANGELOG.md)

## License

No license has been declared for this repository. Copyright remains with its owner; do not assume permission beyond applicable law.

### v1 authoring quick start
Choose a complete face template, assign or select a Semantic Part, choose its Method, calibrate/capture poses, then create a Timeline clip and enable Auto Key. Runtime schema v3 remains stable; editor animation clips are saved with the project.

## Canonical editor workflow

The supported public path is **Home → Artwork → Face Setup → Animate → Preview → Save/Export**. Start from a Home template card or Import SVG, assign face parts from the Face Setup checklist, use the top-bar file menu for New/Open/Import, and use the top-bar Save, Export, Problems, Undo, and Redo actions. Export exposes one direct download button for each portable artifact.
