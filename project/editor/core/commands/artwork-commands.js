import { normalizeArtboard, readArtboard, writeArtboard } from '../artwork/artboard.js';
import { migrateElementTopology } from '../path/path-topology.js';

/** V2 command boundary for authored SVG/element data. Payloads are plain data. */
export function createArtworkCommands(store, history) {
  const run = (type, domains, source, apply, { snapshot = true } = {}) => {
    if (snapshot) history?.snapshot();
    return store.execute({ type, domains, source, apply });
  };
  return {
    setTransform(id, transform, options = {}) {
      return run('artwork/set-transform', ['artwork'], options.source || 'inspector', document => {
        if (!document.elements[id]) throw new Error(`Element "${id}" does not exist.`);
        document.elements[id].baseTransform = { ...document.elements[id].baseTransform, ...structuredClone(transform) };
      }, options);
    },
    setPivot(id, x, y, options = {}) { return this.setTransform(id, { pivotX: Number(x), pivotY: Number(y) }, { ...options, source: options.source || 'inspector' }); },
    updateElement(id, type, apply, options = {}) {
      return run(`artwork/${type}`, ['artwork'], options.source || 'inspector', document => {
        const element = document.elements[id]; if (!element) throw new Error(`Element "${id}" does not exist.`); apply(element, document);
      }, options);
    },
    /**
     * Resize the working area.
     *
     * The artboard is the `viewBox`, and a nested `<svg>` clips to it, so this
     * is the difference between artwork that exists and artwork that is cut
     * off. One undo step, and nothing else in the markup moves.
     */
    setArtboard(box, options = {}) {
      const next = normalizeArtboard(box);
      return run('artwork/set-artboard', ['artwork'], options.source || 'artwork', document => {
        const current = readArtboard(document.svgMarkup);
        if (current.x === next.x && current.y === next.y && current.width === next.width && current.height === next.height) return;
        document.svgMarkup = writeArtboard(document.svgMarkup, next);
      }, options);
    },
    /**
     * A change to a path's *shape* — a node added or removed — carrying the
     * rig that is pinned to its point count with it.
     *
     * One undo step across three domains: a half-migrated rig, with a rest
     * outline of one length and deltas of another, is worse than an edit that
     * did not happen, so this refuses rather than writing part of it.
     *
     * @param {string} id
     * @param {import('../path/path-edit.js').PathEdit} edit
     * @param {{posedPath?: string}} [options]
     */
    editPath(id, edit, options = {}) {
      const plan = migrateElementTopology(store.getDocument(), id, edit, options.posedPath || null);
      if (!plan.ok) return plan;
      run('artwork/edit-path', ['artwork', 'keyforms', 'semanticRig'], options.source || 'canvas', document => {
        for (const [elementId, patch] of Object.entries(plan.elements)) Object.assign(document.elements[elementId], structuredClone(patch));
        document.shapeKeys = structuredClone(plan.shapeKeys);
        document.semanticParts = structuredClone(plan.semanticParts);
      }, options);
      return { ok: true, migrated: plan.migrated };
    },
    syncSvg(payload, options = {}) {
      return run('artwork/sync-svg', options.domains || ['artwork', 'layers'], options.source || 'canvas', document => {
        for (const key of ['svgMarkup', 'elements', 'layers', 'layerMetadata', 'svgWarnings']) if (key in payload) document[key] = structuredClone(payload[key]);
      }, options);
    }
  };
}
