export const defaultElementPlugin = {
  type: 'default',
  createRigData(node, transform) {
    return {
      baseTransform: transform,
      baseOpacity: Number(node.attr('opacity') ?? 1),
      constraints: { translate: true, rotate: true, scale: true },
      bindings: { translateX: { enabled: true, expression: 'headX', curve: 'linear', amplitude: 2, offset: 0 } },
      symmetryPeer: null,
      morph: { enabled: false, param: 'mouthOpen', min: -1, max: 1, pathA: '', pathB: '' },
      meta: { nodeType: node.type }
    };
  }
};
