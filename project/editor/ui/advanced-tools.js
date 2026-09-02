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
  Object.freeze({ id: 'plugins', label: 'Plugin manager', description: 'Enable or disable editor plugins (in the ••• menu → Advanced).', needs: null })
]);

const firstElementId = (document) => Object.keys(document?.elements || {})[0] || null;

/** Availability and reason per tool for the current document and session. */
export function describeAdvancedTools(document, session = {}) {
  const hasArtwork = Boolean(String(document?.svgMarkup || '').trim());
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
export function advancedToolRoute(id, document, session = {}) {
  const tool = describeAdvancedTools(document, session).find((item) => item.id === id);
  if (!tool || !tool.available) return null;
  switch (id) {
    case 'parameters': return { detail: 'parameters' };
    case 'diagnostics': return { detail: 'diagnostics' };
    case 'plugins': return { menu: 'advanced' };
    case 'bindings': return { route: { task: 'artwork', target: { kind: 'artwork-element', id: tool.elementId } } };
    case 'timeline': return { route: { task: 'animate' }, authorMode: 'animations', timeline: true };
    case 'state-machine': return { route: { task: 'animate' }, authorMode: 'states' };
    case 'behaviors': return { route: { task: 'animate' }, authorMode: 'behaviors' };
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
