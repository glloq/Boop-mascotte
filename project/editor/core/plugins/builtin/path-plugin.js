export const pathElementPlugin = {
  type: 'path',
  createRigData(node, transform) {
    const d = node.attr('d') || '';
    return {
      ...transform,
      constraints: { translate: true, rotate: true, scale: true },
      bindings: { translateX: 'headX * 2' },
      bindingCurves: { translateX: 'linear' },
      symmetryPeer: null,
      morph: { enabled: true, param: 'mouthOpen', min: -1, max: 1, pathA: d, pathB: d },
      meta: { nodeType: 'path' }
    };
  }
};
