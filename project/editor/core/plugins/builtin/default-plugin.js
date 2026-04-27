export const defaultElementPlugin = {
  type: 'default',
  createRigData(node, transform) {
    return {
      ...transform,
      constraints: { translate: true, rotate: true, scale: true },
      bindings: { translateX: 'headX * 2' },
      bindingCurves: { translateX: 'linear' },
      symmetryPeer: null,
      morph: { enabled: false, param: 'mouthOpen', min: -1, max: 1, pathA: '', pathB: '' },
      meta: { nodeType: node.type }
    };
  }
};
