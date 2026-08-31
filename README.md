# SVG Mascot Rig Editor (Phase 1 MVP+)

This repository contains a modular **SVG Mascot Rig Editor** with an integrated authoring UI, preview simulator, project persistence workflow, and embeddable runtime export.

## Architecture

- `project/editor`: authoring environment (UI + state + preview).
  - SVG manipulation stack: `svg.js` + select/resize/draggable plugins.
  - Immutable state updates and undo/redo via `immer`.
  - Binding expression evaluation (`mathjs`) in editor.
- `project/runtime`: lightweight runtime modules + single-file runtime export (`runtime.js`) for web integration.
- `project/assets/formats`: rig JSON schema.

## Current capabilities

### 1) SVG edition & rigging
- Load custom SVG files or the built-in sample mascot.
- Select/transform elements (translate/rotate/scale + pivot editing).
- Layer workflow (selection and ordering sync).
- Inspector tabs:
  - **Transform**: pivot, rotation, scale, per-element motion constraints.
  - **Bindings**: expression + curve mapping (`linear`, `easeInOut`), symmetry peer and mirror action.
  - **Morph**: param-linked path morph setup (`pathA`, `pathB`, min/max).
  - **Presets**: per-part animation presets for **head / eye / mouth** with suggested preset based on element id.

### 2) State machine & behavior tuning
- Editable states (`idle`, `happy`, `sad`) with per-state parameter values.
- Transition graph rules (allowed transitions list).
- Runtime behavior tuning in editor:
  - `blink`
  - `idleMotion`
- Global and per-state motion constraint scaling (`translate`, `rotate`, `scale`).

### 3) WYSIWYG preview & animation tuning
- Live parameter sliders with immediate canvas update.
- Quick actions: reset to active state, randomize params.
- Transition guard feedback (allowed/blocked transitions).
- **WYSIWYG transition lab**:
  - from/to state selectors,
  - duration tuning,
  - easing selection,
  - manual scrub (progress slider),
  - realtime transition playback.

### 4) Presets, plugins, validation
- Preset SVG library (`Classic`, `Chill`).
- Face Builder for quick starter mascot generation (head/eyes/mouth variants).
- Plugin registry with built-in `default` and `path` plugins, with UI toggle for path plugin activation.
- Rig validation feedback surfaced in editor status area.

### 5) Persistence & import/export
- Rig import (`rig.json`) to continue iteration.
- Project snapshot workflow:
  - manual project save/load (`mascot-project.json`),
  - browser autosave,
  - autosave restoration.
- Export bundle:
  - `mascot.svg`
  - `rig.json`
  - `runtime.js` (single-file runtime)

## Run locally

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

## Quality checks

```bash
npm test
npm run check:conflicts
npm run verify
```

- `npm test` runs the Node unit suite in `project/editor/core/tests/*.test.js`.
- `npm run verify` runs conflict-marker checks + full core tests.

## Notes for contributors

- UI sidebar markup is intentionally split into small section builders (`project/editor/ui/sidebar-sections.js`) to reduce merge conflicts.
- Keep editor-facing features previewable in real-time when possible (WYSIWYG-first workflow).

## Stabilization status

The repository verification command runs the conflict scan, unit suite, and production build:

```bash
npm run verify
```

Imported SVG is filtered for common executable features, runtime binding expressions use a restricted arithmetic parser, and editor preview/runtime preserve base transforms while applying `translateX` bindings as animation deltas. See [known limitations](docs/KNOWN_LIMITATIONS.md) before relying on SVG export as a lossless project representation.

## SVG document and export model

The editor now treats the sanitized, live SVG DOM as its authoring source of truth. Real group hierarchy, deterministic generated IDs, duplicate-ID repair, sibling DOM ordering, visibility, editor locks, and display names are supported. `mascot.svg`, `rig.json`, and `mascot-project.json` have intentionally distinct responsibilities; see [the SVG document model](docs/SVG_DOCUMENT_MODEL.md) for serialization and preview guarantees.
