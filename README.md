# SVG Mascot Rig Editor (Phase 1 MVP)

This repository contains a modular **Phase 1 MVP** for the SVG Mascot Rig Editor.

## Architecture

- `project/editor`: heavy authoring environment.
  - `svg.js` + `svg.select.js` + `svg.resize.js` + `svg.draggable.js` for SVG selection and transform handles.
  - `immer` for immutable state updates and undo/redo snapshots.
  - `mathjs` for binding expression evaluation.
- `project/runtime`: lightweight runtime modules plus a single-file export runtime (`runtime.js`).
- `project/assets/formats`: rig JSON schema.

## Implemented (Phase 1)

- Load and render SVG files.
- Select, move, scale, rotate SVG elements.
- Basic layer system (select + reorder).
- Inspector for:
  - pivot per element
  - transform values
  - constraints (`translate`, `rotate`, `scale`)
  - simple binding (`translateX` expression)
- Parameters:
  - `headX` `[-1,1]`
  - `headY` `[-1,1]`
  - `eyeOpen` `[0,1]`
  - `mouthOpen` `[-1,1]`
- Basic state system (`idle`, `happy`, `sad`) with editable state param values.
- Preview mode with sliders and live binding application.
- Advanced binding curve mapping (`linear`, `easeInOut`) on `translateX`.
- Symmetry helper with peer element and mirror action from inspector.
- Phase-2-ready path morph interpolation helper for compatible SVG paths.
- Export:
  - `mascot.svg`
  - `rig.json`
  - `runtime.js` (single-file runtime for website integration)

## Run

```bash
npm install
npm run dev
```

Then load `project/assets/mascot-sample.svg` in the editor.

## Runtime integration example

```html
<script type="module">
  import { createMascotEngine } from './runtime.js';
  const svgRoot = document.querySelector('#mascot');
  const rig = await (await fetch('./rig.json')).json();
  const engine = createMascotEngine({ svgRoot, rig, fps: 20 });
  engine.start();
</script>
```
