/**
 * A generated cartoon turn (docs/HEAD_POSE_2_5D.md).
 *
 * The head-pose grid could always hold a 2.5D turn, but nothing ever put one
 * in it: every template shipped with an empty grid, so `headX` only ran its
 * own binding — a plain sideways translation. Turning the head slid it.
 *
 * This builds the turn the doc describes, out of the semantic parts the project
 * already has: the face shifts, the features inside it shift further, the far
 * side compresses, the far ear fades. It is the same parallax trick a 2D
 * animator uses, and it is still **an illusion of rotation** — nothing here
 * projects and no element knows about a camera.
 *
 * Pure: it reads the document and returns cells. What it writes is ordinary
 * head-pose keyforms, so a generated cell and a hand-posed one are the same
 * thing afterwards and either can replace the other.
 */
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { captureHeadPose, createHeadPoseAxes, headPoseCells } from './head-pose-model.js';

/** How far the whole effect is pushed. */
export const HEAD_TURN_STRENGTHS = Object.freeze({ subtle: 0.6, normal: 1, strong: 1.5 });

/**
 * What each face part does when the head turns.
 *
 * `depth` is how far it travels **relative to the head outline**: the nose is
 * the closest thing to the viewer, so it swings furthest; the ears sit on the
 * axis and barely move. `side` marks the pairs whose two halves must not do
 * the same thing — that asymmetry is what reads as volume.
 */
export const HEAD_TURN_LAYERS = Object.freeze({
  head: Object.freeze({ depth: 0, side: null, squash: true }),
  hair: Object.freeze({ depth: 0.3, side: null }),
  leftEar: Object.freeze({ depth: 0.15, side: 'left', ear: true }),
  rightEar: Object.freeze({ depth: 0.15, side: 'right', ear: true }),
  leftEye: Object.freeze({ depth: 0.55, side: 'left' }),
  rightEye: Object.freeze({ depth: 0.55, side: 'right' }),
  leftUpper: Object.freeze({ depth: 0.55, side: 'left' }),
  leftLower: Object.freeze({ depth: 0.55, side: 'left' }),
  rightUpper: Object.freeze({ depth: 0.55, side: 'right' }),
  rightLower: Object.freeze({ depth: 0.55, side: 'right' }),
  leftBrow: Object.freeze({ depth: 0.6, side: 'left' }),
  rightBrow: Object.freeze({ depth: 0.6, side: 'right' }),
  leftPupil: Object.freeze({ depth: 0.75, side: 'left' }),
  rightPupil: Object.freeze({ depth: 0.75, side: 'right' }),
  nose: Object.freeze({ depth: 1, side: null }),
  mouth: Object.freeze({ depth: 0.85, side: null }),
  jaw: Object.freeze({ depth: 0.8, side: null })
});

/* How much of the effect each channel carries at full turn and full strength. */
const NEAR_WIDEN = 0.08;     // the side that comes towards the viewer gains room
const FAR_NARROW = 0.12;     // the side going away is foreshortened
const NEAR_EAR_WIDEN = 0.15;
const FAR_EAR_NARROW = 0.3;
const FAR_EAR_FADE = 0.55;   // and it disappears behind the head
const HEAD_SQUASH = 0.04;    // a turned head is a little narrower on screen
// Looking up or down reads mostly through the outline: the features need much
// less travel than a sideways turn, and overdoing it walks the mouth into
// whatever decoration is drawn above it.
const VERTICAL_DEPTH = 0.6;

/** The default distance the closest feature travels, when nothing is measured. */
export const DEFAULT_HEAD_TURN_UNIT = 8;
const UNIT_LIMITS = Object.freeze({ min: 3, max: 40 });
/** A turn reads best when the nose crosses about this much of the head's width. */
export const HEAD_TURN_WIDTH_RATIO = 0.05;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(4));
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * The distance unit for a turn.
 *
 * Measured from the head's own width when the caller can measure it (the
 * editor can, from the canvas), because a turn has to look right on a 40px
 * head and on a 2000px one. Otherwise it falls back to what the head movement
 * itself travels, which the author may already have calibrated.
 */
const headPart = (document = {}) => Object.values(document.semanticParts || {}).find((part) => part.type === 'head') || null;

/** The amplitude the head movement itself carries, per axis. */
function bindingAmplitude(document, part, control) {
  const property = part?.controlDrivers?.[control]?.property || SEMANTIC_PART_REGISTRY.head.drivers[control].property;
  const binding = document.elements?.[part?.roles?.head]?.bindings?.[property];
  if (!binding || binding.enabled === false || binding.expression !== control) return 0;
  return Number.isFinite(Number(binding.amplitude)) ? Number(binding.amplitude) : 0;
}

/**
 * How far the head outline travels on its own, which is what the features
 * inside it inherit for free.
 */
export function headTurnTravel(document = {}) {
  const part = headPart(document);
  return { x: bindingAmplitude(document, part, 'headX'), y: bindingAmplitude(document, part, 'headY') };
}

const isDescendant = (layers = [], ancestorId, elementId) => {
  const walk = (nodes, inside) => nodes.some((node) => {
    if (!node) return false;
    const here = inside || node.id === ancestorId;
    if (here && node.id === elementId && node.id !== ancestorId) return true;
    return walk(node.children || [], here);
  });
  return Boolean(ancestorId) && walk(layers || [], false);
};

export function headTurnUnit(document = {}, { headWidth = null } = {}) {
  if (Number.isFinite(Number(headWidth)) && Number(headWidth) > 0) {
    return clamp(round(Number(headWidth) * HEAD_TURN_WIDTH_RATIO), UNIT_LIMITS.min, UNIT_LIMITS.max);
  }
  // Otherwise: what the head movement itself travels, which the author may
  // already have calibrated.
  const amplitude = bindingAmplitude(document, headPart(document), 'headX') || SEMANTIC_PART_REGISTRY.head.drivers.headX.amplitude;
  return clamp(round(Math.abs(amplitude) || DEFAULT_HEAD_TURN_UNIT), UNIT_LIMITS.min, UNIT_LIMITS.max);
}

/** Every element that takes part, with the layer it plays. */
export function headTurnElements(document = {}, { centers = null } = {}) {
  const headElement = headPart(document)?.roles?.head || null;
  const found = [];
  for (const part of Object.values(document.semanticParts || {})) {
    const roles = SEMANTIC_PART_REGISTRY[part.type]?.roles || [];
    for (const role of roles) {
      const elementId = part.roles?.[role];
      const layer = HEAD_TURN_LAYERS[role];
      // Hands and generic accessories are left out: one is not on the head and
      // the other could be anything. They stay hand-posable.
      if (!elementId || !layer || !document.elements?.[elementId]) continue;
      if (found.some((item) => item.elementId === elementId)) continue;
      // A feature drawn inside the head group already travels with it; a
      // sibling has to carry that motion itself, or the turn only reads on
      // artwork that happens to be nested.
      const base = document.elements[elementId].baseTransform || {};
      const measured = centers?.[elementId];
      const pivot = { x: number(base.pivotX), y: number(base.pivotY) };
      const centre = measured && Number.isFinite(Number(measured.x)) && Number.isFinite(Number(measured.y))
        ? { x: Number(measured.x), y: Number(measured.y) } : null;
      found.push({
        elementId, role, part: part.id, ...layer,
        pivot,
        centre,
        // Within a pixel is "at the centre": a scale around it moves nothing.
        // An unset pivot counts too, because generating the turn sets it (see
        // `headTurnPivots`) in the same command that writes these samples.
        pivotAtCentre: Boolean(centre) && (Math.hypot(pivot.x - centre.x, pivot.y - centre.y) < 1 || (!pivot.x && !pivot.y)),
        inherits: elementId === headElement || isDescendant(document.layers, headElement, elementId)
      });
    }
  }
  return found;
}

/**
 * What one cell of the turn holds.
 *
 * `x > 0` turns the head towards the right of the screen, which brings its
 * left side towards the viewer; `y > 0` follows `headY` and points down.
 */
export function headTurnCellSamples(layers = [], { x = 0, y = 0, unit = DEFAULT_HEAD_TURN_UNIT, strength = 1, travel = { x: 0, y: 0 } } = {}) {
  const samples = {};
  const push = clamp(Number(strength) || 0, 0, 3);
  for (const layer of layers) {
    const sample = {};
    if (layer.depth) {
      const carry = layer.inherits ? { x: 0, y: 0 } : { x: Number(travel?.x) || 0, y: Number(travel?.y) || 0 };
      sample.translateX = round(x * (unit * layer.depth * push + carry.x));
      sample.translateY = round(y * (unit * layer.depth * VERTICAL_DEPTH * push + carry.y));
    }
    // Scaling happens around the element's stored pivot, which for most
    // artwork is (0, 0) — the far corner of the canvas. Scaling there would
    // fling the part across the drawing, so a scale is only generated when the
    // caller measured where the part actually is, and it comes with the
    // translation that keeps that centre still.
    const centre = layer.centre;
    if (centre) {
      if (layer.squash) {
        sample.scaleX = round(1 - HEAD_SQUASH * Math.abs(x) * push);
        sample.scaleY = round(1 - HEAD_SQUASH * Math.abs(y) * push);
      }
      if (layer.side && x !== 0) {
        // The half of a pair that turns away from the viewer is the far one.
        const far = (x > 0 && layer.side === 'right') || (x < 0 && layer.side === 'left');
        const amount = Math.abs(x) * push;
        if (layer.ear) {
          sample.scaleX = round(1 + (far ? -FAR_EAR_NARROW : NEAR_EAR_WIDEN) * amount);
          sample.opacity = round(far ? 1 - FAR_EAR_FADE * amount : 1);
        } else {
          sample.scaleX = round(1 + (far ? -FAR_NARROW : NEAR_WIDEN) * amount);
        }
      }
    } else if (layer.side && layer.ear && x !== 0) {
      // Opacity needs no geometry, and a fading far ear is most of the trick.
      const far = (x > 0 && layer.side === 'right') || (x < 0 && layer.side === 'left');
      sample.opacity = round(far ? 1 - FAR_EAR_FADE * Math.abs(x) * push : 1);
    }
    for (const channel of ['scaleX', 'scaleY']) {
      if (channel in sample) sample[channel] = round(clamp(sample[channel], 0.2, 3));
    }
    if ('opacity' in sample) sample.opacity = round(clamp(sample.opacity, 0, 1));
    if (centre && !layer.pivotAtCentre) {
      // The element is scaled around a pivot that is not its middle, so the
      // scale drags it sideways. Cancel exactly that: a point c maps to
      // pivot + s·(c − pivot) + translate.
      //
      // This is a fallback. It is arithmetic that holds the centre still, but
      // the correction grows with the distance from the pivot, so it swamps
      // the parallax and the two sides of a face end up travelling completely
      // differently. Generating the turn moves the pivot instead (see
      // `headTurnPivots`), which leaves nothing to correct.
      const hold = (axis, scale) => (1 - scale) * (Number(centre[axis]) - Number(layer.pivot?.[axis] || 0));
      if ('scaleX' in sample) sample.translateX = round(number(sample.translateX) + hold('x', sample.scaleX));
      if ('scaleY' in sample) sample.translateY = round(number(sample.translateY) + hold('y', sample.scaleY));
    }
    samples[layer.elementId] = sample;
  }
  return samples;
}

/**
 * The pivots a generated turn needs.
 *
 * A near/far scale only reads as a turn when each part is scaled around its
 * own middle. Most artwork carries no pivot at all — `(0, 0)`, the corner of
 * the drawing — so scaling there throws the part across the face, and the
 * arithmetic that cancels it swamps the parallax it was meant to add.
 *
 * So the turn sets the pivot instead, once, for the parts it scales and only
 * where none was configured. On an element that is not rotated or scaled yet
 * (which is what an unset pivot means in practice) moving the pivot changes
 * nothing on screen; from then on the scale turns the face instead of sliding
 * it sideways.
 *
 * @returns {Record<string, {pivotX: number, pivotY: number}>}
 */
export function headTurnPivots(document = {}, { centers = null } = {}) {
  const pivots = {};
  for (const layer of headTurnElements(document, { centers })) {
    const scales = layer.squash || layer.side;
    if (!scales || !layer.centre) continue;
    if (layer.pivot.x || layer.pivot.y) continue; // configured by hand: leave it
    // Already in the middle (a part drawn around the origin): nothing to set.
    if (Math.hypot(layer.pivot.x - layer.centre.x, layer.pivot.y - layer.centre.y) < 1) continue;
    pivots[layer.elementId] = { pivotX: round(layer.centre.x), pivotY: round(layer.centre.y) };
  }
  return pivots;
}

/**
 * The whole grid.
 *
 * The centre cell is included and deliberately neutral, so the rest pose holds
 * there instead of being interpolated through from its neighbours.
 *
 * @returns {{cells: {cell: {i:number,j:number}, x:number, y:number, samples: object}[],
 *            elements: object[], unit: number, strength: number}}
 */
export function generateHeadTurn(document = {}, { axes = createHeadPoseAxes(), strength = 1, unit = null, headWidth = null, centers = null } = {}) {
  const layers = headTurnElements(document, { centers });
  const distance = Number.isFinite(Number(unit)) && Number(unit) > 0 ? Number(unit) : headTurnUnit(document, { headWidth });
  const travel = headTurnTravel(document);
  const cells = headPoseCells(axes).map((cell) => ({
    cell: { i: cell.i, j: cell.j }, x: cell.x, y: cell.y,
    samples: headTurnCellSamples(layers, { x: cell.x, y: cell.y, unit: distance, strength, travel })
  }));
  return { cells, elements: layers, unit: distance, strength: clamp(Number(strength) || 0, 0, 3), travel };
}

/** The generated turn as head-pose keyforms, replacing whatever the grid held. */
export function headTurnKeyforms(keyforms = [], document = {}, options = {}) {
  const axes = options.axes || createHeadPoseAxes();
  const turn = generateHeadTurn(document, { ...options, axes });
  if (!turn.elements.length) return keyforms;
  let next = keyforms;
  for (const entry of turn.cells) next = captureHeadPose(next, { axes, cell: entry.cell, samples: entry.samples });
  return next;
}
