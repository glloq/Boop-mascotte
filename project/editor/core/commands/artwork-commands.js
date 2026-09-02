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
    syncSvg(payload, options = {}) {
      return run('artwork/sync-svg', options.domains || ['artwork', 'layers'], options.source || 'canvas', document => {
        for (const key of ['svgMarkup', 'elements', 'layers', 'layerMetadata', 'svgWarnings']) if (key in payload) document[key] = structuredClone(payload[key]);
      }, options);
    }
  };
}
