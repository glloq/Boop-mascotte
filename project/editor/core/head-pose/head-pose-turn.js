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
import { headAngles, projectFeature, relativeSample } from '../projection/pseudo-projector.js';

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
  // The outline makes a small bodily shift of its own. It used to be 0 because
  // the head's own translateX binding carried that shift — but then `headX`
  // drove a slide and a turn at once, and the slide won. The turn now owns the
  // whole movement and the binding is switched off (see `headTurnBindings`).
  head: Object.freeze({ depth: 0.18, side: null, squash: true }),
  hair: Object.freeze({ depth: 0.3, side: null }),
  // The crown and the back of the hair are the head's own silhouette rather
  // than features drawn on it, so they travel with the outline and not with
  // the fringe: at the fringe's depth they slid off the skull, which the
  // fringe itself cannot do because it is clipped to the head.
  hairTop: Object.freeze({ depth: 0.2, side: null }),
  hairBack: Object.freeze({ depth: 0.1, side: null }),
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
  // A pupil sits on the eyeball, so it barely moves *within* its socket: give
  // it much more depth than the eye and it reads as "looking sideways" rather
  // than "head turned", with the pupil jammed against the rim.
  leftPupil: Object.freeze({ depth: 0.62, side: 'left' }),
  rightPupil: Object.freeze({ depth: 0.62, side: 'right' }),
  // `narrow`: a feature on the middle line has no near and far half, but it is
  // still foreshortened as the face turns away. Without it a mouth is a rigid
  // bar sliding across the face, which is most of what still read as a slide.
  nose: Object.freeze({ depth: 1, side: null, narrow: true }),
  mouth: Object.freeze({ depth: 0.85, side: null, narrow: true }),
  // Everything inside the mouth travels with the lip line, or an open mouth
  // comes apart as the head turns.
  cavity: Object.freeze({ depth: 0.85, side: null, narrow: true }),
  teeth: Object.freeze({ depth: 0.85, side: null, narrow: true }),
  tongue: Object.freeze({ depth: 0.85, side: null, narrow: true })
  // No `jaw` layer on purpose: a jaw belongs to the outline rather than to the
  // features on it, so it travels with the head and never on its own. On this
  // face it *is* the outline -- one shape that lengthens.
});

/*
 * How much of the effect each channel carries at full turn and full strength.
 *
 * These were all roughly a third of what they are now, and the result read as
 * a slide with a wobble rather than a turn: a 4 % squash and an 8 % near-eye
 * widen are below the threshold where an eye reads them as depth at all. The
 * far side compressing hard is the single strongest cue, so it carries most of
 * the weight.
 */
const NEAR_WIDEN = 0.12;     // the side that comes towards the viewer gains room
const FAR_NARROW = 0.35;     // the side going away is foreshortened
const NEAR_EAR_WIDEN = 0.2;
const FAR_EAR_NARROW = 0.5;
const FAR_EAR_FADE = 0.75;   // and it disappears behind the head
// Which it does by sliding *behind the outline*, not by going translucent over
// whatever the page is: a half-transparent ear sticking out past the cheek
// reads as a grey smudge, because the background shows through it.
const FAR_EAR_TUCK = 0.6;
// A turned head is narrower on screen. This used to be a tuned 0.1 -- a 10 %
// squash at a full turn -- and it is the one constant the projector *replaces*
// rather than composes with: the outline's narrowing is `cos(yaw)` of the same
// rotation that displaces the features (3D-05). Deriving it is not a look
// change (0.900 becomes 0.866 at a full turn, which nobody sees); it is what
// lets a feature drawn inside the head subtract exactly what the head already
// does to it, instead of the two disagreeing by a few pixels that then read as
// the eyes drifting off the face.
const CENTRE_NARROW = 0.15;  // and so is a mouth or a nose drawn on its middle line
// Looking up or down reads mostly through the outline: the features need much
// less travel than a sideways turn, and overdoing it walks the mouth into
// whatever decoration is drawn above it.
const VERTICAL_DEPTH = 0.6;

/** The default distance the closest feature travels, when nothing is measured. */
export const DEFAULT_HEAD_TURN_UNIT = 8;
const UNIT_LIMITS = Object.freeze({ min: 3, max: 90 });
/**
 * A turn reads best when the nose crosses about this much of the head's width.
 * At 5 % the deepest feature moved four pixels on a hundred-pixel head, which
 * is not a turn; the parallax has to be a sizeable fraction of the face.
 */
export const HEAD_TURN_WIDTH_RATIO = 0.14;

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

/**
 * The head's own translate bindings, which a generated turn takes over.
 *
 * `headX` used to drive two things at once: the head element's `translateX`
 * binding (a plain sideways slide) and the grid. The slide is unconditional
 * and the parallax is a fraction of it, so the eye read the slide and the turn
 * was invisible — the bug reported three times as "it only moves the head".
 *
 * The turn owns the whole movement instead: the outline's bodily shift is the
 * `head` layer's own depth, in the grid, where an author can re-pose it. These
 * bindings are switched off rather than deleted, so the change is visible in
 * the inspector and one undo brings them back.
 *
 * @returns {{elementId: string, property: string}[]}
 */
export function headTurnBindings(document = {}) {
  const part = headPart(document);
  const elementId = part?.roles?.head;
  if (!elementId) return [];
  const found = [];
  for (const control of ['headX', 'headY']) {
    const property = part?.controlDrivers?.[control]?.property || SEMANTIC_PART_REGISTRY.head.drivers[control].property;
    const binding = document.elements?.[elementId]?.bindings?.[property];
    // Only a binding that is still doing exactly this job: one the author
    // repurposed to drive something else is left alone.
    if (binding && binding.expression === control) found.push({ elementId, property, enabled: binding.enabled !== false });
  }
  return found;
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
  return found.map((layer) => ({ ...layer, ...carriedFrom(found, document, layer) }));
}

/**
 * What a part already gets for free, from the part it is drawn inside.
 *
 * A feature nested in the head group travels with the outline; a pupil drawn
 * inside its eye group travels with the eye, and an eyelid with it. Each of
 * them only adds the difference — otherwise the two depths stack, and a pupil
 * crosses the face while its socket stays put. That is the artwork coming
 * apart, not a head turning.
 *
 * `screenDepth` is what the viewer sees a part travel: the outline it rides on
 * plus its own depth. Subtracting the ancestor's leaves what this part has to
 * write for itself, which for a part drawn *outside* the head is the whole
 * thing — the old `carry`, restated, and now it also covers nesting one
 * feature inside another.
 *
 * @returns {{parentId: string|null, depth: number, carryScale: boolean}}
 */
function carriedFrom(layers, document, layer) {
  const outline = layers.find((item) => item.role === 'head');
  const screenDepth = (item) => (item.role === 'head' ? 0 : number(outline?.depth)) + number(item.depth);
  // The innermost part this one is drawn inside: the deepest ancestor wins, so
  // a pupil inside an eye inside the head carries the eye, not the head.
  const parent = layers
    .filter((item) => item.elementId !== layer.elementId && isDescendant(document.layers, item.elementId, layer.elementId))
    .sort((a, b) => screenDepth(b) - screenDepth(a))[0] || null;
  return {
    parentId: parent?.elementId || null,
    depth: round(screenDepth(layer) - (parent ? screenDepth(parent) : 0)),
    // The depth this part really has, not what it adds to its parent. A
    // rotation cannot be composed by subtracting depths -- two features at the
    // same differential swing differently depending on how far out they start
    // -- so the projector is given the absolute value and the parent's own
    // projection is subtracted afterwards (3D-05).
    screenDepth: round(screenDepth(layer)),
    // A scale is inherited the same way. Where the part and the one it is drawn
    // inside foreshorten *identically* -- a pupil and its eye are both on the
    // near side, a cavity and its mouth are both on the middle line -- the
    // child must not apply it twice. The head's own squash is not that: the
    // outline narrowing and a feature's near/far compression are two different
    // cues, and they are meant to compose.
    carryScale: Boolean(parent && ((parent.side && parent.side === layer.side) || (parent.narrow && layer.narrow)))
  };
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
  const byId = new Map(layers.map((layer) => [layer.elementId, layer]));
  const outline = layers.find((item) => item.role === 'head');
  const { yaw, pitch } = headAngles({ x, y, strength: push });
  // Projected once per layer per cell: the answer is a pure function of the
  // cell, and a chain of nested parts asks for the same one repeatedly.
  const projections = new Map();
  const project = (layer) => projections.get(layer) || (projections.set(layer, projectFeature({
    centre: layer.centre, origin: outline?.centre || layer.centre,
    depth: layer.screenDepth,
    headX: x, headY: y, strength: push, unit
  })), projections.get(layer));

  // What a part, once placed, does to a point drawn on it: its own translate,
  // plus its scale about its own centre. The centre is the fixed point whatever
  // pivot the artwork carries, because the correction at the bottom of the loop
  // holds it there.
  const placed = new Map();
  const inside = (layer) => (layer?.parentId ? byId.get(layer.parentId) : null);
  /**
   * Everything the parts this one is drawn inside already do to its centre.
   *
   * The generator used to subtract *depths* (`carriedFrom`), which works while
   * a displacement is `unit · depth`: two parts at the same depth move the same
   * way, so the difference of the depths is the difference of the movements. A
   * rotation is not like that -- it also turns a part's offset from the axis --
   * so what is subtracted has to be the parent's actual placement, evaluated at
   * this part's centre. Otherwise the head's squash and the projection both
   * pull an eye inwards and it lands twice as far in as it should.
   *
   * First order, one ancestor at a time: the parent's scale acting on the
   * child's *own* displacement is left on the table, the same simplification
   * `relativeSample` documents.
   */
  const inheritedBy = (layer) => {
    const point = layer.centre;
    let translateX = 0;
    let translateY = 0;
    for (let parent = inside(layer); parent; parent = inside(parent)) {
      const done = placed.get(parent.elementId);
      if (!done) continue;
      const offset = point && done.centre ? { x: point.x - done.centre.x, y: point.y - done.centre.y } : { x: 0, y: 0 };
      translateX += done.translateX + (done.scaleX - 1) * offset.x;
      translateY += done.translateY + (done.scaleY - 1) * offset.y;
    }
    return { translateX, translateY };
  };
  // Parents first, so a part is written against ancestors that are already
  // placed. `layers` comes out of the semantic parts in registry order, which
  // says nothing about nesting. This is the order the work happens in and not
  // the order the result is written in: the samples come back keyed the way
  // they were asked for, or generating a turn would reshuffle every rig.json.
  const nesting = (layer) => {
    let deep = 0;
    for (let parent = inside(layer); parent && deep < 32; parent = inside(parent)) deep += 1;
    return deep;
  };
  for (const layer of [...layers].sort((a, b) => nesting(a) - nesting(b))) {
    const sample = {};
    if (layer.depth) {
      // `depth` is already what this part adds to what it is drawn inside
      // (`carriedFrom`). What is left to carry is the head's own translate
      // binding, when the caller is keeping it: a part outside the head group
      // does not get that for free either.
      const carry = layer.parentId || layer.role === 'head'
        ? { x: 0, y: 0 }
        : { x: Number(travel?.x) || 0, y: Number(travel?.y) || 0 };
      // The displacement is a rotation now, not two slides (3D-05,
      // docs/PSEUDO_3D_BASELINE.md). `x` and `y` meet inside the projector, so
      // a diagonal is no longer the sum of a sideways and an upward move; the
      // carry stays here, because inheriting the head's own translate binding
      // is bookkeeping rather than geometry.
      const projected = relativeSample(project(layer), layer.parentId ? inheritedBy(layer) : null);
      sample.translateX = round(projected.translateX + x * carry.x);
      sample.translateY = round(projected.translateY + y * carry.y);
      // `projected.virtualZ` -- where the part ended up along the depth axis,
      // negative once it has passed behind the head's centre -- is deliberately
      // not written yet. It belongs in the `depth` keyform channel, as a
      // difference from the element's authored depth, and it wants the
      // reordering that consumes it (3D-03) to land in the same step.
    }
    // Scaling happens around the element's stored pivot, which for most
    // artwork is (0, 0) — the far corner of the canvas. Scaling there would
    // fling the part across the drawing, so a scale is only generated when the
    // caller measured where the part actually is, and it comes with the
    // translation that keeps that centre still.
    const centre = layer.carryScale ? null : layer.centre;
    // The scale is kept unrounded alongside the sample: a part drawn inside
    // this one subtracts what this one does to it, and four decimals of a
    // cosine is a thousandth of a pixel of asymmetry between turning left and
    // turning right. The sample itself still stores the rounded value.
    const exact = {};
    if (centre) {
      if (layer.squash) {
        // The outline narrows by the cosine of the turn it is making -- the
        // same angle the features are displaced by, so a feature drawn inside
        // the head can subtract this exactly.
        exact.scaleX = Math.cos(yaw);
        exact.scaleY = Math.cos(pitch);
      } else if (layer.narrow) {
        exact.scaleX = 1 - CENTRE_NARROW * Math.abs(x) * push;
        exact.scaleY = 1 - CENTRE_NARROW * Math.abs(y) * push;
      }
      if (layer.side && x !== 0) {
        // The half of a pair that turns away from the viewer is the far one.
        const far = (x > 0 && layer.side === 'right') || (x < 0 && layer.side === 'left');
        const amount = Math.abs(x) * push;
        if (layer.ear) {
          exact.scaleX = 1 + (far ? -FAR_EAR_NARROW : NEAR_EAR_WIDEN) * amount;
          sample.opacity = round(far ? 1 - FAR_EAR_FADE * amount : 1);
          if (far) sample.translateX = round(number(sample.translateX) - Math.sign(x) * FAR_EAR_TUCK * unit * amount);
        } else {
          exact.scaleX = 1 + (far ? -FAR_NARROW : NEAR_WIDEN) * amount;
        }
      }
    } else if (layer.side && layer.ear && x !== 0 && !layer.carryScale) {
      // Neither the tuck nor the fade needs geometry -- which side of the head
      // an ear is on is enough — and between them they are most of the trick.
      const far = (x > 0 && layer.side === 'right') || (x < 0 && layer.side === 'left');
      const amount = Math.abs(x) * push;
      sample.opacity = round(far ? 1 - FAR_EAR_FADE * amount : 1);
      if (far) sample.translateX = round(number(sample.translateX) - Math.sign(x) * FAR_EAR_TUCK * unit * amount);
    }
    for (const channel of ['scaleX', 'scaleY']) {
      if (channel in exact) {
        exact[channel] = clamp(exact[channel], 0.2, 3);
        sample[channel] = round(exact[channel]);
      }
    }
    if ('opacity' in sample) sample.opacity = round(clamp(sample.opacity, 0, 1));
    // Recorded before the pivot correction, because the correction is what
    // makes the centre the fixed point this record assumes.
    placed.set(layer.elementId, {
      centre: layer.centre || null,
      translateX: number(sample.translateX),
      translateY: number(sample.translateY),
      scaleX: 'scaleX' in exact ? exact.scaleX : 1,
      scaleY: 'scaleY' in exact ? exact.scaleY : 1
    });
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
  return Object.fromEntries(layers.map((layer) => [layer.elementId, samples[layer.elementId]]));
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
    const scales = (layer.squash || layer.side || layer.narrow) && !layer.carryScale;
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
export function generateHeadTurn(document = {}, { axes = createHeadPoseAxes(), strength = 1, unit = null, headWidth = null, centers = null, takeOverBindings = true } = {}) {
  const layers = headTurnElements(document, { centers });
  const distance = Number.isFinite(Number(unit)) && Number(unit) > 0 ? Number(unit) : headTurnUnit(document, { headWidth });
  // The generated turn switches the head's own translate bindings off, so the
  // siblings it moves must not also carry the slide those bindings used to do.
  const travel = takeOverBindings ? { x: 0, y: 0 } : headTurnTravel(document);
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
