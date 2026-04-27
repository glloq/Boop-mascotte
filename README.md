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
- Runtime behavior config (`blink`, `idleMotion`) editable in state panel and exported in `rig.json`.
- Runtime now uses a lightweight safe expression parser (no `new Function`) and caches transforms to reduce DOM writes.
- Phase 2 in progress: inspector-based path morph setup (`pathA`/`pathB` + param range) with live preview and runtime playback.
- Improved interface: sticky status banner, built-in sample loader button, and clearer dark UI styling for faster iteration.
- Added rig validation feedback (binding/morph checks) surfaced directly in editor status.
- Phase 3 in progress: plugin-ready element registry (`default`, `path`) and preset asset library (`Classic`, `Chill`).
- UI enhancement: layer filtering, keyboard shortcuts (undo/redo + state hotkeys), and inline shortcut help panel.
- UI enhancement: quick state chips + preview actions (reset/randomize params) for faster facial tuning loops.
- UI enhancement: tabbed inspector (Transform / Bindings / Morph) to reduce panel overload and speed editing.
- Phase 3 UI: plugin manager controls (enable/disable `path` plugin) with live plugin status in sidebar.
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


## Tests

```bash
npm test
```

Covers core utilities: morph interpolation, plugin registry toggling, rig validation rules, and undo/redo availability state.


## Merge notes

To reduce PR conflicts, sidebar markup has been split into small section builders (`ui/sidebar-sections.js`) instead of one large template literal.
