export const defaultElementPlugin = {
  type: 'default',
  createRigData(node, transform) {
    return {
      baseTransform: transform,
      baseOpacity: Number(node.attr('opacity') ?? 1),
      constraints: { translate: true, rotate: true, scale: true },
      bindings: {},
      symmetryPeer: null,
      morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' },
      meta: { nodeType: node.type }
    };
  }
};
