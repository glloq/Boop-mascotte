import { DEFAULT_RIGGING } from '../../rig/rigging-types.js';

export const pathElementPlugin = {
  type: 'path',
  createRigData(node, transform) {
    const d = node.attr('d') || '';
    return {
      baseTransform: transform,
      baseOpacity: Number(node.attr('opacity') ?? 1),
      constraints: { translate: true, rotate: true, scale: true },
      // How this piece moves (V5-02, core/rig/rigging-types.js). Written here
      // rather than left to the normalizer so the document the editor holds is
      // already the document it saves: the round trip compares the two.
      rigging: DEFAULT_RIGGING,
      bindings: {},
      symmetryPeer: null,
      morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d },
      meta: { nodeType: 'path' }
    };
  }
};
