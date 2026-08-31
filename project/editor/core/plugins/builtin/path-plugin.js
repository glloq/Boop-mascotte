export const pathElementPlugin = {
  type: 'path',
  createRigData(node, transform) {
    const d = node.attr('d') || '';
    return {
      baseTransform: transform,
      baseOpacity: Number(node.attr('opacity') ?? 1),
      constraints: { translate: true, rotate: true, scale: true },
      bindings: {},
      symmetryPeer: null,
      morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d },
      meta: { nodeType: 'path' }
    };
  }
};
