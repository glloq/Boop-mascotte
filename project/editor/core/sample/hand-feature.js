/**
 * A pair of hands, drawn and rigged in one press (docs/HAND_RIGGING.md,
 * docs/HAND_REPRESENTATIONS_STUDY.md).
 *
 * Hand Setup could always rig a hand; what it could not do was give you one.
 * Its first step read "Choose the artwork that draws this hand", which for
 * anyone without an SVG editor open in another tab is where the feature ended.
 *
 * This is the artwork (`hand-artwork.js`), the rig, the poses and one example
 * motion, as a single undo step. Everything it writes is ordinary: a group the
 * runtime already moves, parts whose shape keys the runtime already blends, a
 * clip like any other. Nothing here is a special case afterwards.
 *
 * ```text
 * handLeft (g)  ← the hands record names the group; reach, drift and turn land here
 *  ├─ handLeftPalm … handLeftCuff   ← six parts, each with a rest outline
 *  └─ shape keys per part, driven by the pose, curl and grip parameters
 * ```
 *
 * A pose is a **parameter**: `handLFist` drives one key on every part the fist
 * moves, the way the finger curls always did. The pose record carries no key of
 * its own, so nothing above the parameter — reactions, the mixer, Auto Key, the
 * catalogue — has to know how many parts a hand has.
 */
import { assignHand, addHandPose, handPoseParameter, mirrorHand, normalizeHand } from '../hands/hand-model.js';
import { createShapeKey, upsertShapeKey } from '../shape-keys/shape-key-model.js';
import { HAND_SIDES } from '../hands/hand-model.js';
import { inverseElementTransform } from '../../../runtime/runtime.js';
import { normalizeKeyform } from '../../../runtime/keyforms.js';
import {
  HAND_DEFAULT_STYLE, HAND_DIGITS, HAND_GRIP_TABLE, HAND_LOCAL_RADIUS, HAND_PART_IDS, HAND_PART_NAMES, HAND_POSE_TABLES, HAND_PROFILE_POSE_TABLES, HAND_REST_TILT,
  HAND_STYLES, artboardBox, handArtwork, handDigitCurlTable, handElementId, handPartId, handParts, handRestPoint, handScale
} from './hand-artwork.js';

export { artboardBox };

/** The poses the generated hand ships with: a table each, so every one of them works. */
export const GENERATED_HAND_POSES = Object.freeze([
  Object.freeze({ id: 'fist', name: 'Fist' }),
  Object.freeze({ id: 'point', name: 'Point' }),
  Object.freeze({ id: 'peace', name: 'Peace' }),
  Object.freeze({ id: 'thumbsUp', name: 'Thumbs Up' }),
  Object.freeze({ id: 'spread', name: 'Spread' }),
  Object.freeze({ id: 'relax', name: 'Relax' }),
  Object.freeze({ id: 'ok', name: 'OK' }),
  Object.freeze({ id: 'pinch', name: 'Pinch' }),
  Object.freeze({ id: 'stop', name: 'Stop' })
]);

/**
 * And every digit on its own.
 *
 * A pose is a whole hand at once; these are the rig underneath it — one curl
 * parameter per digit, so a hand can be posed by hand, animated finger by
 * finger, or driven from a reaction. Shape keys add, so raising Fist and
 * curling one finger further is a mouth-and-smile situation, not a fight.
 */
export const HAND_DIGIT_CONTROLS = HAND_DIGITS;

const capital = (side) => (side === 'right' ? 'R' : 'L');
const named = (side, name) => `hand${capital(side)}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
/** `handLIndex`, `handRThumb`… — the same shape as every other hand parameter. */
export const handDigitParameter = (side, digit) => named(side, digit);

/**
 * The two controls a hand needs that a digit curl cannot give it.
 *
 * **Grip** closes every finger at once: the four curls are the individual
 * control and this is the group one, which is the way a hand is actually
 * animated — you close the hand, then bend one finger further.
 *
 * **Flip** turned the single outline over by mirroring it. A hand made of parts
 * turns through its facing axis instead, so no new pair gets a Flip; the
 * parameter name is kept for the projects that already have one.
 */
export const handGripParameter = (side) => named(side, 'grip');
export const handFlipParameter = (side) => named(side, 'flip');

/* ── Facing (docs/HAND_REPRESENTATIONS_STUDY.md, stage 2) ──────────────────
 *
 * ```text
 * handLFacing   -1            0            1
 *               far side     palm         side
 *          (thumb away)                (thumb near)
 * ```
 *
 * One parameter turns the hand, stored as ordinary pose grids the way the head
 * turns: a `pathShape` keyform per part weights that part's *view* key at each
 * stop, so palm → side is a continuous morph of six parts and never a collapse.
 * A pose that has a drawing of its own in profile (a fist, a pointing finger,
 * a thumbs up, the grip, the curls) carries three keys per part -- palm, side,
 * far side -- gated by a `pose × facing` grid, so the fist seen from the side
 * is the profile fist and not the palm fist's deltas added to a profile.
 */
export const handFacingParameter = (side) => named(side, 'facing');

/** The three stops of the facing axis, in axis order. */
export const HAND_FACING_STOPS = Object.freeze([
  Object.freeze({ id: 'far', name: 'Far side', value: -1, view: 'far', flip: true }),
  Object.freeze({ id: 'palm', name: 'Palm', value: 0, view: 'front', flip: false }),
  Object.freeze({ id: 'near', name: 'Side', value: 1, view: 'profile', flip: false })
]);
const facingAxis = (side) => ({ parameter: handFacingParameter(side), values: HAND_FACING_STOPS.map((stop) => stop.value) });

/** A wave is a rotation, not a shape: the hand turns, the fingers do not move. */
export const HAND_WAVE_CLIP = Object.freeze({
  id: 'hand-wave', name: 'Wave', duration: 1.4, loop: false,
  tracks: {
    handLRotation: [
      { time: 0, value: 0, easing: 'linear' }, { time: .25, value: .7, easing: 'easeInOut' },
      { time: .55, value: -.5, easing: 'easeInOut' }, { time: .85, value: .6, easing: 'easeInOut' },
      { time: 1.4, value: 0, easing: 'easeInOut' }
    ],
    handLY: [{ time: 0, value: 0, easing: 'linear' }, { time: .3, value: -.7, easing: 'easeOut' }, { time: 1.1, value: -.7 }, { time: 1.4, value: 0, easing: 'easeIn' }]
  }
});

export const HANDS_DOMAINS = ['artwork', 'layers', 'rig', 'hands', 'keyforms', 'stateMachine', 'animation'];

/** Both hands drawn, rigged and pointing at artwork that still exists. */
export function areHandsInstalled(state = {}) {
  return HAND_SIDES.every((side) => {
    const hand = state.hands?.[side];
    return Boolean(hand?.element && state.elements?.[hand.element]);
  });
}

/** The style a pair was drawn in, read from the palm's fill; the default for a pair that has none. */
export function installedHandStyle(state = {}) {
  const fill = /<path id="handLeftPalm"[^>]*fill="([^"]+)"/.exec(state.svgMarkup || '')?.[1];
  return Object.values(HAND_STYLES).find((style) => style.fill === fill)?.id || HAND_DEFAULT_STYLE;
}

/* ── First placement (VNX-20, docs/VNEXT_ROADMAP.md) ───────────────────────
 *
 * ```text
 * measure the body → place one hand below and outside it → mirror it
 *        → a reach in proportion → keep the pair on the artboard
 * ```
 *
 * A pair used to arrive at the coordinates the *template* wanted: a fifth of
 * the artboard in from each edge, four fifths of the way down it. That is
 * right for a face drawn to fill its artboard and wrong for every import — a
 * mascot half the size of its canvas, or one whose head sits off-centre, got
 * hands somewhere beside it, and the author had four numbers per hand to fix
 * before anything was worth dragging.
 *
 * So the placement is measured. The measuring itself belongs to the canvas
 * (only the DOM knows how big a path really is), so it arrives as an injected
 * `measure(id)`; with nothing to measure the pair falls back to exactly where
 * it used to go, which is the right answer for the drawing that fills its
 * artboard and the honest guess for anything else.
 */

/** How far a hand may travel each way, as a share of the mascot's own size. */
const REACH_SHARE = 0.16;
/** A full half-turn either way, and a quarter of its size. */
const REACH_ROTATION = 180, REACH_SCALE = 0.25;
/** The floor Hand Setup's fields and hand mode already use (`HAND_REACH_MINIMUM`). */
const REACH_FLOOR = 1;

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 100) / 100;
const reachOf = (x, y) => ({ x: Math.max(REACH_FLOOR, x), y: Math.max(REACH_FLOOR, y), rotation: REACH_ROTATION, scale: REACH_SCALE });

/** A box worth placing against, or null when there is nothing there to measure. */
const usableBox = (box) => (number(box?.width) > 0 && number(box?.height) > 0
  ? { x: number(box.x), y: number(box.y), width: number(box.width), height: number(box.height) }
  : null);

/**
 * The element the hands hang from, and the one they are measured against.
 *
 * Never one of the hands themselves: a project whose only artwork is the pair
 * being drawn would otherwise anchor a hand to itself.
 */
export function handBodyElement(state = {}, parent = null) {
  if (parent) return parent;
  const own = new Set(HAND_SIDES.flatMap((side) => [handElementId(side), ...HAND_PART_IDS.map((part) => handPartId(side, part))]));
  const drawn = Object.keys(state.elements || {}).filter((id) => !own.has(id));
  return drawn.includes('faceRoot') ? 'faceRoot' : (drawn[0] || null);
}

/** The hand's own size and travel for a body this big. One definition, two readers. */
function handRoom(body) {
  return {
    // The hand is drawn for the artboard; at the mascot's width it is the same
    // drawing at the mascot's scale, so a small mascot does not get a hand
    // bigger than its head.
    radius: HAND_LOCAL_RADIUS * handScale({ width: body.width }),
    reach: reachOf(Math.round(REACH_SHARE * body.width), Math.round(REACH_SHARE * body.height))
  };
}

/**
 * The artboard the pair needs: the one there is, or a taller one.
 *
 * Hands hang **below** the mascot, and a drawing that fills its artboard
 * leaves nowhere for them: the pair landed on the cheeks, and their reach --
 * the whole point of a floating hand -- was whatever few pixels were left
 * between the chin and the edge. Adding hands therefore adds room, once, in
 * the same undo step. An artboard that is already tall enough is left alone.
 */
function grownArtboard(state, body) {
  const box = artboardBox(state);
  // Nothing measured: assume the drawing fills its artboard, as the shipped
  // template's face does. 4:3 leaves a band below it for the pair.
  if (!body) return { width: box.width, height: Math.max(box.height, Math.round(box.width * 1.35)) };
  // Measured: the room the pair actually needs under the mascot -- the hand,
  // its reach, and the hand again, so a hand at full reach is still drawn.
  const { radius, reach } = handRoom(body);
  return { width: box.width, height: Math.max(box.height, Math.ceil(body.y + body.height + 2 * radius + reach.y)) };
}

/** Below the mascot and outside it, as far as the artboard allows. */
function placeBesideBody(body, artboard) {
  const { radius, reach } = handRoom(body);
  const centre = body.x + body.width / 2;
  // A hand at full reach must still be on the drawing, so the anchor keeps its
  // whole ellipse -- or at least its own outline -- inside the edge.
  const margin = Math.max(radius, reach.x);
  // One distance from the mascot's middle serves both hands, so the artboard
  // can never pull one side in without the other and leave the pair lopsided.
  const room = Math.min(centre - margin, artboard.width - margin - centre);
  const dx = Math.max(radius, Math.min(body.width / 2 + radius, room));
  // `grownArtboard` has already made the room below, so the lower bound only
  // catches a caller placing against an artboard it did not grow.
  const y = Math.min(body.y + body.height + radius, artboard.height - Math.max(radius, reach.y));
  return { left: { x: round(centre - dx), y: round(y) }, mirrorX: centre, reach, size: body.width / artboard.width };
}

/**
 * Nothing to measure: the lower corners, which is where the pair has always
 * gone. Right for a drawing that fills its artboard, and the best guess when
 * nothing has said otherwise -- never (0, 0), and never off the artboard.
 */
function placeInCorners(artboard) {
  return {
    left: handRestPoint('left', artboard), mirrorX: artboard.width / 2,
    reach: reachOf(Math.round(artboard.width * 0.16), Math.round(artboard.height * 0.17)), size: 1
  };
}

/**
 * The other hand, from this one.
 *
 * Through the same function Hand Setup's "Mirror to the other side" calls, so
 * a pair drawn in one press and a pair mirrored by hand mean the same thing by
 * "the other side". Only the anchor is taken from it: a generated pair is two
 * new hands, so each side's poses and turn range are its own rather than a
 * copy of a gesture authored on the first.
 */
function mirrorPoint(point, mirrorX) {
  const pair = mirrorHand({ left: normalizeHand({ element: handElementId('left'), anchor: point }, 'left') },
    'left', { mirrorX, element: handElementId('right') });
  return { x: round(pair.right.anchor.x), y: round(pair.right.anchor.y) };
}

/**
 * Where a pair of hands goes on *this* project.
 *
 * The measuring is injected because only the canvas can do it: `measure(id)`
 * answers a box in the artboard's own units, the same way `hand-setup-panel`
 * and `head-pose-panel` already take one. Answering `null` — an empty project,
 * a caller with no canvas — is not an error, it is the fallback above.
 *
 * The artwork is appended before the rig is written, so a caller that answers
 * with the whole drawing rather than with the element asked about has to
 * measure **once** and remember it: measured again with the hands already on
 * the canvas, it would place the rig somewhere the outline is not.
 *
 * @param {object} state the document as it stands before the hands are drawn
 * @param {{measure?: ?(id: string) => ?{x,y,width,height}, parent?: ?string}} options
 * @returns {{artboard, body, parent, measured, reach, size, points, anchors}}
 */
export function handPlacement(state = {}, { measure = null, parent = null } = {}) {
  const parentId = handBodyElement(state, parent);
  const body = typeof measure === 'function' && parentId ? usableBox(measure(parentId)) : null;
  const artboard = grownArtboard(state, body);
  const placed = body ? placeBesideBody(body, artboard) : placeInCorners(artboard);
  const points = { left: placed.left, right: mirrorPoint(placed.left, placed.mirrorX) };
  // The document keeps an anchor in the *parent's* coordinates -- that is what
  // `handReachEllipse` maps back through -- while the artwork is drawn in the
  // artboard's. On a body carrying a transform of its own the two differ, and
  // an ellipse drawn around the wrong one is an ellipse beside the hand.
  const base = parentId ? state.elements?.[parentId]?.baseTransform : null;
  const anchors = Object.fromEntries(HAND_SIDES.map((side) => {
    const local = base ? inverseElementTransform(base, points[side]) : points[side];
    return [side, { x: round(local.x), y: round(local.y) }];
  }));
  return { artboard, body, parent: parentId, measured: Boolean(body), reach: placed.reach, size: placed.size, points, anchors };
}

/** The artboard a pair of hands needs, grown if the pair needs the room. */
export function handsArtboard(state = {}, options = {}) {
  return handPlacement(state, options).artboard;
}

/** The viewBox that room needs, or null when the artboard already had it. */
export function handsViewBox(state = {}, options = {}) {
  const box = artboardBox(state), grown = handsArtboard(state, options);
  return grown.height > box.height ? `0 0 ${grown.width} ${grown.height}` : null;
}

/**
 * The markup to append. Kept separate: the canvas draws it before anything is
 * authored — so it is placed by the same function that rigs it, and the
 * outline can never land somewhere its anchor is not.
 */
export const handsMarkup = (state = {}, options = {}) => {
  const placement = handPlacement(state, options);
  const style = HAND_STYLES[options.style] ? options.style : HAND_DEFAULT_STYLE;
  return HAND_SIDES.map((side) => handArtwork(side, { at: placement.points[side], box: placement.artboard, style })).join('');
};

/* ── Rigging the parts ──────────────────────────────────────────────────────
 *
 * ```text
 * table  ──handParts──►  paths per part  ──minus rest──►  one driven key per moved part
 *                                                          driver: { parameter, 0…1 }
 * ```
 */

/**
 * The shape keys one table needs: a delta on every part it moves, all driven
 * by the same parameter. Parts the table leaves alone get no key, so a fist
 * touches the four digits and never the palm.
 *
 * @returns {{ok: boolean, keys: object[], message?: string}}
 */
export function handTableKeys(side, { id, name, parameter = null, table, rest, at, box, view = 'front', flip = false }) {
  const posed = handParts(side, { view, flip, at, box, pose: table });
  const element = handElementId(side);
  const keys = [];
  for (const part of HAND_PART_IDS) {
    if (posed.paths[part] === rest.paths[part]) continue;
    const created = createShapeKey({
      id: `${element}-${id}-${part}`, target: handPartId(side, part),
      name: `${name} · ${HAND_PART_NAMES[part]} (${side})`,
      restPath: rest.paths[part], posePath: posed.paths[part],
      // A key with no driver is weighted by a pose grid instead.
      driver: parameter ? { parameter, min: 0, max: 1 } : null
    });
    if (!created.ok) return { ok: false, keys, message: created.message };
    keys.push(created.shapeKey);
  }
  return { ok: true, keys };
}

/**
 * Rig the hands that `handsMarkup` just drew.
 *
 * The same `options` the markup was drawn with: both go through
 * `handPlacement`, so the rig lands on the artwork rather than beside it.
 *
 * @param {object} state a draft document that already carries the artwork
 * @param {{parent?: ?string, measure?: ?(id: string) => ?{x,y,width,height}}} options
 */
export function installHands(state, { parent = null, measure = null } = {}) {
  const placement = handPlacement(state, { parent, measure });
  const box = placement.artboard;
  const body = placement.parent;
  for (const side of HAND_SIDES) {
    const element = handElementId(side);
    if (!state.elements?.[element]) return false;
    if (!HAND_PART_IDS.every((part) => state.elements[handPartId(side, part)])) return false;
    const at = placement.points[side];
    // Room to move and a full turn, in proportion to the mascot rather than to
    // the drawing area: a rotation that cannot pass a right angle cannot point
    // at anything.
    const result = assignHand(state.hands, side, { element, parent: body, anchor: placement.anchors[side], reach: placement.reach });
    if (!result.ok) return false;
    state.hands = result.hands;
    for (const [name, parameter] of Object.entries(result.parameters)) {
      state.params[name] ||= structuredClone(parameter);
      for (const pose of Object.values(state.states || {})) if (!(name in pose)) pose[name] = parameter.default;
    }
    // Fingers down and thumbs inwards: the parts are drawn pointing up, and a
    // hand hanging beside a body does not. The size is a transform too, so the
    // outlines stay the ones the shape keys measure against: a hand drawn for
    // the artboard, shown at the mascot's own scale. All of it on the group,
    // so reach, drift and turn carry every part at once.
    Object.assign(state.elements[element].baseTransform,
      { pivotX: at.x, pivotY: at.y, rotation: HAND_REST_TILT[side], scaleX: placement.size, scaleY: placement.size });
    // Every part keeps the outline its keys deform.
    const rest = handParts(side, { at, box });
    for (const part of HAND_PART_IDS) state.elements[handPartId(side, part)].restPath = rest.paths[part];

    const parameter = (name, range = { min: 0, max: 1 }) => {
      state.params[name] ||= { type: 'number', ...range, default: 0, value: 0 };
      for (const stored of Object.values(state.states || {})) if (!(name in stored)) stored[name] = 0;
    };
    const keep = (made) => { for (const key of made.keys) state.shapeKeys = upsertShapeKey(state.shapeKeys, key); return made.keys; };
    state.keyforms ||= [];
    const grid = (record) => { state.keyforms = state.keyforms.filter((item) => item.id !== record.id).concat([normalizeKeyform(record)]); };
    /** A key applied in one view only: a pose grid over the facing axis. */
    const viewGrid = (key, stop) => grid({
      id: `${key.id}-kf`, target: { kind: 'element', id: key.target }, channel: 'pathShape', shapeKey: key.id,
      axes: [facingAxis(side)], keyforms: HAND_FACING_STOPS.map((item, j) => ({ at: [j], value: item.id === stop.id ? 1 : 0 }))
    });
    /** A key applied at one view *and* one pose: a `pose × facing` grid. */
    const poseViewGrid = (key, poseParameter, stop) => grid({
      id: `${key.id}-kf`, target: { kind: 'element', id: key.target }, channel: 'pathShape', shapeKey: key.id,
      axes: [{ parameter: poseParameter, values: [0, 1] }, facingAxis(side)],
      keyforms: [0, 1].flatMap((i) => HAND_FACING_STOPS.map((item, j) => ({ at: [i, j], value: i === 1 && item.id === stop.id ? 1 : 0 })))
    });

    // The facing axis: the palm to the viewer at 0, a profile either way.
    const facing = handFacingParameter(side);
    parameter(facing, { min: -1, max: 1 });
    const views = {};
    for (const stop of HAND_FACING_STOPS) {
      views[stop.id] = stop.view === 'front' ? rest : handParts(side, { at, box, view: stop.view, flip: stop.flip });
      if (stop.view === 'front') continue;
      const made = handTableKeys(side, { id: `facing-${stop.id}`, name: stop.name, table: null, rest, at, box, view: stop.view, flip: stop.flip });
      if (!made.ok) return false;
      for (const key of keep(made)) viewGrid(key, stop);
    }
    // On the far side the thumb is behind the palm: behind in the draw order
    // for the exported runtime, and faded out so the editor's canvas -- which
    // never reorders the artwork it edits -- agrees. Unless the thumb is up,
    // which is the one pose that shows it from behind.
    const thumb = handPartId(side, 'thumb');
    grid({ id: `${element}-facing-thumb-depth`, target: { kind: 'element', id: thumb }, channel: 'depth', axes: [facingAxis(side)],
      keyforms: HAND_FACING_STOPS.map((stop, j) => ({ at: [j], value: stop.id === 'far' ? -0.6 : 0 })) });
    // The fade is over by halfway to the far side, while the thumb is still
    // near its palm-view place, so no half-drawn thumb pokes out of the turn.
    const fadeStops = [-1, -0.5, 0, 1];
    grid({ id: `${element}-facing-thumb-opacity`, target: { kind: 'element', id: thumb }, channel: 'opacity',
      axes: [{ parameter: handPoseParameter(side, 'thumbsUp'), values: [0, 1] }, { parameter: facing, values: fadeStops }],
      keyforms: [0, 1].flatMap((i) => fadeStops.map((at, j) => ({ at: [i, j], value: i === 0 && at < 0 ? 0 : 1 }))) });

    /**
     * One table, as keys. A table with a drawing of its own in profile gets a
     * key per part per stop, gated by `pose × facing`; any other table gets one
     * key per part driven by its parameter, applied whatever the facing.
     */
    const keys = (id, name, table, driver, profile = null) => {
      if (!profile) {
        const made = handTableKeys(side, { id, name, parameter: driver, table, rest, at, box });
        if (!made.ok) return false;
        keep(made);
      } else {
        for (const stop of HAND_FACING_STOPS) {
          const made = handTableKeys(side, {
            id: stop.view === 'front' ? id : `${id}-${stop.id}`, name: stop.view === 'front' ? name : `${name} · ${stop.name}`,
            table: stop.view === 'front' ? table : profile, rest: views[stop.id], at, box, view: stop.view, flip: stop.flip
          });
          if (!made.ok) return false;
          for (const key of keep(made)) poseViewGrid(key, driver, stop);
        }
      }
      parameter(driver);
      return true;
    };

    // The poses: a parameter each, driving a key on every part it moves. The
    // pose record carries no key of its own -- `handPoseDrive` finds these.
    for (const pose of GENERATED_HAND_POSES) {
      if (!keys(pose.id, pose.name, HAND_POSE_TABLES[pose.id], handPoseParameter(side, pose.id), HAND_PROFILE_POSE_TABLES[pose.id] || null)) return false;
      state.hands = addHandPose(state.hands, side, { id: pose.id, name: pose.name });
    }
    // One curl per digit, driven by its own parameter: the poses are the quick
    // way, this is the complete one. A curl reads the same in profile, so the
    // same table serves both views.
    for (const digit of HAND_DIGITS) {
      const curl = handDigitCurlTable(digit.id, 1);
      if (!keys(`curl-${digit.id}`, `${digit.name} curl`, curl, handDigitParameter(side, digit.id), curl)) return false;
    }
    // And the group control the digits cannot give: closing the whole hand.
    // Shape keys add, so a grip and one straightened finger compose.
    if (!keys('grip', 'Grip', HAND_GRIP_TABLE, handGripParameter(side), HAND_GRIP_TABLE)) return false;
  }
  if (!state.animationClips.some((clip) => clip.id === HAND_WAVE_CLIP.id)) state.animationClips.push(structuredClone(HAND_WAVE_CLIP));
  return true;
}

/**
 * Draw and rig both hands as one document revision.
 *
 * `options` are the ones `handsMarkup` was called with — the same measurement,
 * so the rig is placed on the artwork the canvas already holds.
 */
export function addHandsCommand(store, history, artwork, options = {}) {
  const current = store.getDocument();
  if (areHandsInstalled(current)) return false;
  for (const side of HAND_SIDES) {
    for (const id of [handElementId(side), ...HAND_PART_IDS.map((part) => handPartId(side, part))]) {
      if (current.elements?.[id]) throw new Error(`SVG id collision: "${id}" already exists.`);
    }
  }
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installHands(candidate, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/add-pair', source: 'hands', domains: HANDS_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'shapeKeys', 'keyforms', 'params', 'states', 'animationClips']) document[field] = structuredClone(candidate[field]);
    }
  });
  return true;
}
