/**
 * The rig control widgets (docs/FACE_CONTROL_RIG.md, CR-02).
 *
 * ```text
 * ●  target   a point in space        ○  radial   a size
 * ▦  pad      two movements at once   ↻  arc      a turn
 * ◆│ slider   one movement            ▭  cage     a group of controls
 * ```
 *
 * One module per shape, all of them pure: they take a resolved board row and
 * return markup. The interaction contract is one attribute — `data-handle-drag`
 * naming the kind — so a surface that wants a control does not have to know how
 * any of them is drawn, and a new shape is a new file rather than another
 * branch in the board.
 */
export * from './control-geometry.js';
export { renderTargetControl, targetControlPosition } from './target-control.js';
export { renderRadialControl, radialControlFill, radialAxis } from './radial-control.js';
export { renderArcControl } from './arc-control.js';
export { renderSliderControl, renderChipsControl } from './slider-control.js';
export { renderPadControl } from './pad-control.js';
export { renderCage, renderLinkChips } from './cage-control.js';
