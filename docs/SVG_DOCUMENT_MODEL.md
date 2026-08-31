# SVG document model

## Source of truth

`SvgDocument` owns the live authoring SVG DOM. Imports are sanitized before insertion, then the model discovers supported layer nodes, normalizes identifiers, exposes a hierarchy, and serializes the edited DOM. `state.svgMarkup` is only a synchronized snapshot for persistence compatibility; exports and project saves ask the canvas to serialize the current document.

The serializer clones the authoring root, removes editor-only attributes/classes, and restores captured author attributes (`transform`, `d`, `opacity`, `display`). Preview frames therefore remain visual overlays: animation transforms, opacity, and morph geometry are never committed. An inspector or drag operation explicitly captures a new author value.

## Nodes, IDs, and hierarchy

Layer/riggable nodes currently include `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text`, `image`, and `use`. The plugin registry still decides which rig data is created. Document-only nodes such as `defs`, gradients, filters, masks, symbols, metadata, titles, descriptions, and styles remain in the DOM and serialization but are not listed as layers.

Missing IDs use deterministic per-type names (`g-1`, `path-1`, etc.). Duplicate IDs retain their first occurrence and receive stable numeric suffixes (`eye-2`). Lookup compares the DOM `id` attribute rather than constructing a CSS selector, so punctuation in SVG IDs is safe.

Groups form real tree entries. Reorder operations are restricted to siblings and mutate actual DOM order. A technical SVG ID is stable and remains the rig/binding key; a display name is separate editor metadata.

## Editor-only metadata

Display names, lock state, and expanded/collapsed state live in `layerMetadata`. Lock prevents authoring transforms while remaining visible. This metadata is stored in `mascot-project.json`, but deliberately omitted from runtime `rig.json`. Visibility uses the SVG `display` attribute and therefore survives SVG-only export/reimport.

## Persistence and outputs

* `mascot-project.json` is the complete editable snapshot: current serialized SVG, runtime rig, layer tree/metadata, and selection.
* `mascot.svg` is the clean, current visual authoring document, including hierarchy, definitions, geometry, base transforms, DOM order, and visibility.
* `rig.json` contains runtime schema, parameters, states, elements, bindings, transitions, constraints, and runtime configuration only.

Autosave uses the same project snapshot and current serializer as explicit save. SVG import/export and project persistence remain browser-only (File API, Blob, and localStorage).

## Deliberate limits

Deletion, duplication, cross-parent drag-and-drop, and ungrouping are deferred. Reorder uses safe up/down sibling operations. Lock and names require the project file to round-trip because they are intentionally not embedded into the public SVG or runtime rig.
