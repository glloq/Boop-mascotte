// Advanced tools registry (UX-17): the expert surfaces the product hides by
// default, each with an availability rule and a route. Presentation only;
// nothing here writes to the project.
export const ADVANCED_TOOLS = Object.freeze([
  Object.freeze({ id: 'parameters', label: 'Parameters', description: 'Every control the runtime knows, with its range and default.', needs: 'artwork' }),
  Object.freeze({ id: 'bindings', label: 'Bindings · Constraints · Morphs', description: 'How a selected element follows its controls. Face Setup generates these; the Artwork inspector edits them.', needs: 'element' }),
  Object.freeze({ id: 'timeline', label: 'Timeline', description: 'Key-by-key animation editing under Animate.', needs: 'artwork' }),
  Object.freeze({ id: 'state-machine', label: 'State Machine', description: 'Runtime States and transitions (mascot.setState).', needs: 'artwork' }),
  Object.freeze({ id: 'behaviors', label: 'Behaviors', description: 'Every automatic behavior with all of its values.', needs: 'artwork' }),
  Object.freeze({ id: 'diagnostics', label: 'Diagnostics', description: 'Validation counts and lifecycle counters, ready to paste into a bug report.', needs: null }),
  Object.freeze({ id: 'plugins', label: 'Plugin manager', description: 'Enable or disable editor plugins (in the ••• menu → Advanced).', needs: null }),
  // Read-only for now: the runtime plays shape keys, deformers, depth and warps,
  // and a rig can be imported carrying them, but only warps have an editor. A
  // listing is the difference between "not editable here" and "invisible".
  Object.freeze({ id: 'deformation', label: 'Deformation', description: 'Shape keys, deformers, depth and warps this project carries. Read-only: imported or hand-authored.', needs: 'artwork' })
]);

const firstElementId = (document) => Object.keys(document?.elements || {})[0] || null;

/** Availability and reason per tool for the current document and session. */
export function describeAdvancedTools(document, session = {}, layout = 'desktop') {
  const hasArtwork = Boolean(String(document?.svgMarkup || '').trim());
  if (layout === 'mobile') return describeAdvancedTools(document, session).map((tool) => (tool.id === 'timeline' ? { ...tool, available: false, reason: 'Needs a tablet or desktop.' } : tool));
  const selected = session.selectedId && document?.elements?.[session.selectedId] ? session.selectedId : null;
  return ADVANCED_TOOLS.map((tool) => {
    if (tool.needs === 'artwork') return { ...tool, available: hasArtwork, reason: hasArtwork ? null : 'Add artwork first.' };
    if (tool.needs === 'element') {
      const element = selected || firstElementId(document);
      return { ...tool, available: hasArtwork && Boolean(element), reason: !hasArtwork ? 'Add artwork first.' : element ? (selected ? null : 'Opens the first element; select another on the canvas.') : 'No element to inspect yet.', elementId: element };
    }
    return { ...tool, available: true, reason: null };
  });
}

/**
 * Route for a tool: a task (and target) for the router plus optional shell
 * intents (author mode, expanded Timeline, hub detail) the caller applies.
 */
export function advancedToolRoute(id, document, session = {}, layout = 'desktop') {
  const tool = describeAdvancedTools(document, session, layout).find((item) => item.id === id);
  if (!tool || !tool.available) return null;
  switch (id) {
    case 'parameters': return { detail: 'parameters' };
    case 'diagnostics': return { detail: 'diagnostics' };
    case 'deformation': return { detail: 'deformation' };
    case 'plugins': return { menu: 'advanced' };
    // Selecting the element is not enough: the editor this names lives inside
    // the Inspector's Advanced disclosure, which renders closed.
    case 'bindings': return { route: { mode: 'design.artwork', target: { kind: 'artwork-element', id: tool.elementId } }, inspectorTab: 'bindings' };
    // The Timeline is the surface; there is no separate "Animations" author
    // mode any more, and the one that existed rendered a sentence.
    case 'timeline': return { route: { mode: 'animate.timeline' }, timeline: true };
    // The states and the automatic behaviours are Behavior's, not Motions'
    // (UIR-01): the editor they open is a screen of the workspace whose subject
    // they are, rather than an accordion inside the step above it.
    case 'state-machine': return { route: { mode: 'behavior.stateMachine' }, authorMode: 'states' };
    case 'behaviors': return { route: { mode: 'behavior.stateMachine' }, authorMode: 'behaviors' };
    default: return null;
  }
}

/** Flatten nested diagnostic counters into stable dotted keys for display and copy. */
export function flattenDiagnostics(snapshot = {}, prefix = '') {
  return Object.entries(snapshot || {}).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value) ? flattenDiagnostics(value, path) : [[path, value]];
  });
}

/**
 * What a project carries in each deformation system, and where each is edited.
 *
 * The six the roadmap gathers under **Rig ▸ Deform** (UIR-10). `editor` is the
 * screen an author reaches the authoring surface on, and `route` is that screen
 * as the router names it; a system with neither has a runtime that plays it and
 * no editor yet, which the listing says out loud rather than leaving to be
 * discovered.
 */
export function describeDeformation(document = {}) {
  const count = (value) => (Array.isArray(value) ? value.length : 0);
  return [
    { id: 'pins', label: 'Pins & holds', count: count(document.rigPins), doc: 'docs/FACE_CONTROL_RIG.md', names: (document.rigPins || []).map((item) => item?.id).filter(Boolean), editor: 'Rig ▸ Deform → Pins & holding', route: 'rig.deform', panel: 'holding-panel' },
    { id: 'warps', label: 'Warp grids', count: count(document.warps), doc: 'docs/WARP_GRID.md', names: (document.warps || []).map((item) => item?.target).filter(Boolean), editor: 'Rig ▸ Deform → Warp', route: 'rig.deform', panel: 'warp-panel' },
    { id: 'keyforms', label: 'Keyforms', count: count(document.keyforms), doc: 'docs/KEYFORM_ENGINE.md', names: (document.keyforms || []).map((item) => item?.targetId).filter(Boolean), editor: 'Rig ▸ Head 2.5D', route: 'rig.head2d', panel: 'head-pose' },
    { id: 'shapeKeys', label: 'Shape keys', count: count(document.shapeKeys), doc: 'docs/SHAPE_KEYS.md', names: (document.shapeKeys || []).map((item) => item?.name || item?.id).filter(Boolean) },
    { id: 'deformers', label: 'Deformers', count: count(document.deformers), doc: 'docs/DEFORMER_MODEL.md', names: (document.deformers || []).map((item) => item?.name || item?.id).filter(Boolean) },
    { id: 'parallax', label: 'Depth / parallax', count: document.parallax ? 1 : 0, doc: 'docs/DEPTH_PARALLAX.md', names: [] }
  ];
}

/**
 * The expert bench, as markup: the six systems, what this project carries in
 * each, and the screen that edits it (UIR-10).
 *
 * Read-only on purpose. Three of the six have an authoring surface and it is
 * one press away; the other three are played by the runtime and authored
 * nowhere yet, and a bench that pretended otherwise would be worse than one
 * that says so.
 */
export function deformBenchMarkup(rows) {
  const carried = rows.filter((row) => row.count);
  return `<p class="small">The expert bench: everything that bends artwork rather than moving it whole. ${carried.length ? `This project carries ${carried.map((row) => `${row.count} ${row.label.toLowerCase()}`).join(', ')}.` : 'This project carries none of these yet — they arrive with an imported rig, or are authored in the panels below.'}</p>
    <table class="advanced-table deform-bench" data-deform-bench><thead><tr><th>System</th><th>Here</th><th>Edited in</th></tr></thead><tbody>${rows.map((row) => `<tr data-deform-row="${row.id}" data-deform-count="${row.count}"><td>${row.label}</td><td>${row.count || '—'}</td><td>${row.route ? `<button type="button" class="link" data-deform-open="${row.panel}">${row.editor}</button>` : '<small class="preset-missing">No editor yet</small>'}</td></tr>`).join('')}</tbody></table>`;
}
