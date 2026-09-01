# Boop Mascotte

Boop Mascotte is a privacy-friendly, browser-only SVG mascot editor. It turns an SVG into a parameterized mascot with layers, states, transitions and behaviors, then exports portable assets for any static web page. It needs no account, backend, database or private API.

## Live Editor

**https://glloq.github.io/Boop-mascotte/**

The editor, persistence, preview and exports use browser APIs only. The [standalone runtime demo](https://glloq.github.io/Boop-mascotte/demo/) uses the same engine shipped by Export.

## Features

- Sanitized SVG import and Face Builder starters
- Nested layer selection, visibility, locking, naming and ordering
- Transform inspector, parameter bindings, constraints and path morphs
- States, guarded transitions, blink and idle oscillator behaviors
- Non-destructive preview, validation, undo/redo and local autosave
- Project JSON save/open and `mascot.svg`, `rig.json`, `runtime.js` export

## Quick Start

1. Open the Live Editor.
2. Import an SVG (or start from the sample).
3. Select a part.
4. Add a parameter binding.
5. Create states.
6. Preview the result.
7. Save the project and Export.

## GitHub Pages

Vite builds with the `/Boop-mascotte/` base. `.github/workflows/pages.yml` verifies, builds, uploads a Pages artifact and deploys it with the official Pages actions. No `gh-pages` branch is needed.

## Import SVG and rigging

Use **Open SVG** and standard file inputs in every browser. Imports are sanitized before entering the document. IDs are retained when valid and deterministically generated when absent. Select a layer to edit base transforms, bindings, constraints, morphing and display metadata. See [SVG document model](docs/SVG_DOCUMENT_MODEL.md) and [rig model](docs/RIG_MODEL.md).

## Parameters, states and behaviors

Parameters define numeric inputs and ranges. Bind an element property to a safe arithmetic expression such as `lookX * 0.5`, then tune amplitude and curve. States store parameter snapshots; transition settings control duration and easing. Behaviors provide temporary blink overrides and continuous oscillation without overwriting state values. See [behavior reference](docs/BEHAVIORS.md).

## Export

**Save Project** downloads the complete editable snapshot. **Export** downloads:

- `mascot.svg` — sanitized authoring SVG;
- `rig.json` — schema version 3 rig data;
- `runtime.js` — standalone ES module runtime.

Downloads use `Blob`, object URLs and `<a download>` for Chrome, Firefox and Safari compatibility. Rig schema versions 1 and 2 are normalized to the current version 3 by the importer.

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
npm run test:e2e:extended # detailed Chromium scenarios (manual/nightly)
```

Install browsers once with `npx playwright install --with-deps`. E2E tests start Vite Preview and therefore verify the Pages base rather than relying on the development server.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Rig format](docs/RIG_MODEL.md)
- [Behaviors](docs/BEHAVIORS.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Changelog](CHANGELOG.md)

## License

No license has been declared for this repository. Copyright remains with its owner; do not assume permission beyond applicable law.

### v1 authoring quick start
Choose a complete face template, assign or select a Semantic Part, choose its Method, calibrate/capture poses, then create a Timeline clip and enable Auto Key. Runtime schema v3 remains stable; editor animation clips are saved with the project.
