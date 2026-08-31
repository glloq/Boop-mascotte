export const pathElementPlugin = {
  type: 'path',
  createRigData(node, transform) {
    const d = node.attr('d') || '';
    return {
      baseTransform: transform,
      baseOpacity: Number(node.attr('opacity') ?? 1),
      constraints: { translate: true, rotate: true, scale: true },
      bindings: { translateX: { enabled: true, expression: 'headX', curve: 'linear', amplitude: 2, offset: 0 } },
      symmetryPeer: null,
      morph: { enabled: true, param: 'mouthOpen', min: -1, max: 1, pathA: d, pathB: d },
      meta: { nodeType: 'path' }
    };
  }
};
