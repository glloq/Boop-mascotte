import { parseAssetRef } from '../../../../runtime/asset-reference.js';

/**
 * A picture on the canvas: rigged like anything else, reshaped like nothing.
 *
 * An `<image>` is the rigid raster node (docs/V4_ROADMAP.md, Phase 2). It
 * moves, turns, scales, fades and takes a depth exactly as a path does -- the
 * rig never asked what a piece was drawn with -- and it has no outline, so
 * everything that reshapes artwork declines it. That is not a gap to fill: a
 * picture's shape is its pixels, and deforming those is what `mesh-image` is
 * for, three phases from here.
 *
 * What this plugin adds over the default one is the two things a picture knows
 * about itself that a path does not: which asset it draws, and how big that
 * asset is. Both are read from the node rather than from the document, so a
 * piece pasted, duplicated or imported carries them without anyone having to
 * remember to copy them across.
 */
export const imageElementPlugin = {
  type: 'image',
  createRigData(node, transform) {
    // Either attribute, and either state: a node already painted keeps its
    // reference in `data-editor-asset` while `href` holds an object URL
    // (runtime/asset-paint.js).
    const reference = ['data-editor-asset', 'href', 'xlink:href']
      .map((name) => node.attr(name))
      .find((value) => parseAssetRef(value)) ?? '';
    const size = (name) => { const value = Number(node.attr(name)); return Number.isFinite(value) && value > 0 ? value : 0; };
    return {
      baseTransform: transform,
      baseOpacity: Number(node.attr('opacity') ?? 1),
      constraints: { translate: true, rotate: true, scale: true },
      bindings: {},
      symmetryPeer: null,
      // Declared and off, like every other non-path piece: a picture has no
      // outline to interpolate between.
      morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' },
      meta: { nodeType: 'image', assetRef: reference, width: size('width'), height: size('height') }
    };
  }
};
