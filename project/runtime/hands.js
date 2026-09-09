/**
 * Floating hands (docs/HAND_RIGGING.md).
 *
 * ```text
 * BODY
 *  ├─ leftHandAnchor ── LEFT HAND
 *  └─ rightHandAnchor ─ RIGHT HAND
 * ```
 *
 * There are no arms and no IK. A hand is artwork that hangs off an anchor point
 * on the body: the anchor follows whatever the body does, and the hand keeps its
 * own local animation on top. That is 80–90 % of the cartoon result for a
 * fraction of a skeleton's machinery.
 */

import { finite, clamp } from './numeric.js';
import { applyElementTransform, applyMatrix } from './transform-2d.js';
import { depthBand, clampDepth, DEFAULT_PARALLAX } from './depth.js';
import { DEFAULT_HAND_DRAWING, HAND_SIDES, handDrawingId, handDrawingName } from './hand-vocabulary.js';
import { DEFAULT_HAND_SWAP, HAND_SWAP_SECONDS, createHandSwap, handSwapMode } from './hand-sprite.js';
export { applyElementTransform } from './transform-2d.js';

// One list, in the vocabulary that owns the rest of what a hand can be. The
// `from` form so the bundler strips it: a plain re-export would be a second
// `export` of the same name once the modules are one file.
export { HAND_SIDES } from './hand-vocabulary.js';

const DEFAULT_REACH = Object.freeze({ x: 40, y: 30, rotation: 30, scale: 0.2 });

export function normalizeHandPose(source = {}) {
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : '',
    name: typeof source?.name === 'string' && source.name ? source.name : (source?.id || ''),
    parameter: typeof source?.parameter === 'string' ? source.parameter : '',
    // Method A: deform the neutral hand. Method B: cross-fade to other artwork.
    shapeKey: typeof source?.shapeKey === 'string' && source.shapeKey ? source.shapeKey : null,
    variant: typeof source?.variant === 'string' && source.variant ? source.variant : null,
    // The numbers a generated pose was drawn from, kept so the editor can
    // reopen it. Never read here: the runtime plays the keys they produced.
    ...(isTable(source?.table) ? { table: source.table } : {}),
    ...(isTable(source?.profileTable) ? { profileTable: source.profileTable } : {})
  };
}

const isTable = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function normalizeHand(source = {}, side = 'left') {
  const capital = side === 'right' ? 'R' : 'L';
  const sprites = normalizeHandSprites(source?.sprites);
  const parameters = {
    x: `hand${capital}X`, y: `hand${capital}Y`, rotation: `hand${capital}Rotation`,
    scale: `hand${capital}Scale`, depth: `hand${capital}Depth`,
    // The 2D hand's own two (docs/HANDS_2D.md): which drawing it shows, and
    // how far that drawing's own animation has played. Only a hand that *has*
    // drawings names them: every entry here is a parameter the rig must carry,
    // and a hand still deforming has nothing to point them at.
    ...(sprites ? { drawing: `hand${capital}Drawing`, anim: `hand${capital}Anim` } : {}),
    ...(source?.parameters && typeof source.parameters === 'object' ? source.parameters : {})
  };
  return {
    side: side === 'right' ? 'right' : 'left',
    element: typeof source?.element === 'string' ? source.element : '',
    parent: typeof source?.parent === 'string' && source.parent ? source.parent : null,
    anchor: { x: finite(source?.anchor?.x, 0), y: finite(source?.anchor?.y, 0) },
    restOffset: { x: finite(source?.restOffset?.x, 0), y: finite(source?.restOffset?.y, 0) },
    reach: {
      x: Math.abs(finite(source?.reach?.x, DEFAULT_REACH.x)),
      y: Math.abs(finite(source?.reach?.y, DEFAULT_REACH.y)),
      rotation: finite(source?.reach?.rotation, DEFAULT_REACH.rotation),
      scale: finite(source?.reach?.scale, DEFAULT_REACH.scale)
    },
    // A cartoon hand may leave its reach a little; a hard clamp reads as a wall.
    softness: Math.max(0, finite(source?.softness, 0.25)),
    depth: finite(source?.depth, 0),
    parameters,
    poses: (Array.isArray(source?.poses) ? source.poses : []).map(normalizeHandPose).filter((pose) => pose.id),
    inertia: normalizeHandInertia(source?.inertia),
    // The drawings this hand swaps between (docs/HANDS_2D.md), and the mark on
    // a hand that still carries the pseudo-3D turn -- deprecated, and read by
    // nothing but the editor's offer to convert it.
    //
    // Both are left out when there is nothing to say, so a hand that has not
    // been converted is byte for byte the hand it always was: a rig written
    // before the refit round-trips through here unchanged.
    ...(sprites ? { sprites } : {}),
    ...(source?.legacyPseudo3D === true ? { legacyPseudo3D: true } : {})
  };
}

/* ── The drawings a hand swaps between (docs/HANDS_2D.md) ──────────────────── */

/**
 * One picture of a hand: what it is called, which group draws it, and the
 * animation it carries of its own.
 *
 * `anim` is a **name**, not a rig: the animation itself is ordinary shape keys
 * over that drawing's own parts, driven by the hand's animation parameter, and
 * the runtime plays them the way it plays any other shape key. A drawing with
 * no animation of its own leaves this null and ignores the parameter.
 */
export function normalizeHandDrawing(source = {}) {
  const id = typeof source?.id === 'string' ? source.id.trim() : '';
  if (!id) return null;
  return {
    id,
    name: typeof source?.name === 'string' && source.name ? source.name : handDrawingName(id),
    element: typeof source?.element === 'string' && source.element ? source.element : '',
    anim: typeof source?.anim === 'string' && source.anim ? source.anim : null,
    pivot: Array.isArray(source?.pivot) && source.pivot.length === 2 ? [finite(source.pivot[0], 0), finite(source.pivot[1], 0)] : null,
    defaultScale: Math.abs(finite(source?.defaultScale, 1)) || 1
  };
}

/**
 * A hand's 2D set: which pictures it has, which one it rests on, and how it
 * gets from one to the next.
 *
 * ```js
 * sprites: {
 *   set: 'defaultCartoon',
 *   showing: 'palmOpen',                // the drawing it rests on
 *   swap: 'crossfade', swapSeconds: 0.08,
 *   pivot: [100, 100],
 *   drawings: [{ id, name, element, anim, pivot, defaultScale }]
 * }
 * ```
 *
 * There is no view here, no facing axis and no thresholds: which picture is on
 * screen is a choice, not a consequence of an angle. `null` when a hand has no
 * pictures, which is every hand of a project written before the refit: those
 * keep the deforming path until they are migrated, and nothing here runs for
 * them.
 */
export function normalizeHandSprites(source = null) {
  if (!source || typeof source !== 'object') return null;
  const drawings = (Array.isArray(source.drawings) ? source.drawings : [])
    .map(normalizeHandDrawing)
    .filter((drawing) => drawing && drawing.element);
  if (!drawings.length) return null;
  return {
    set: typeof source.set === 'string' && source.set ? source.set : 'defaultCartoon',
    showing: handDrawingId(source.showing ?? source.drawing ?? source.pose, drawings) || drawings[0].id,
    swap: handSwapMode(source.swap),
    swapSeconds: Math.max(0, finite(source.swapSeconds, HAND_SWAP_SECONDS)),
    pivot: Array.isArray(source.pivot) && source.pivot.length === 2 ? [finite(source.pivot[0], 0), finite(source.pivot[1], 0)] : null,
    drawings
  };
}

/** The pictures a hand has, in the order its parameter indexes them. */
export const handDrawings = (sprites) => sprites?.drawings || [];

/**
 * One swap per hand, made once and kept: a cross-fade is a memory, and a hand
 * that made a new one every frame would never finish one.
 */
export function createHandSprites(hands) {
  if (!hands) return null;
  const out = {};
  for (const side of HAND_SIDES) {
    const sprites = hands[side]?.sprites;
    if (!sprites) continue;
    // Started empty rather than on the drawing the set rests on: the first
    // frame is a cut to whatever is asked for, and a fade only ever happens
    // between two drawings somebody has actually seen.
    out[side] = createHandSwap({ mode: sprites.swap, seconds: sprites.swapSeconds });
  }
  return Object.keys(out).length ? out : null;
}

/** Whether every hand has finished changing drawing. */
export const handSpritesSettled = (sprites) => !sprites || Object.values(sprites).every((swap) => swap.settled);

const roundIndex = (value, length) => Math.max(0, Math.min(length - 1, Math.round(finite(value, 0))));

/**
 * The drawing a hand is showing, as its parameters say.
 *
 * `handLDrawing` indexes the hand's own pictures, which is what makes the
 * choice keyframable and steppable. A project migrated from the deforming hand
 * has no such parameter and one `handLFist`-shaped parameter per pose instead,
 * so the **most raised** of those is read instead and mapped onto a picture --
 * the bridge that keeps an old project showing the hand it was showing.
 */
export function handDrawingFromValues(hand, values = {}) {
  const drawings = handDrawings(hand?.sprites);
  if (!drawings.length) return null;
  const chosen = values?.[hand?.parameters?.drawing];
  if (Number.isFinite(Number(chosen))) return drawings[roundIndex(chosen, drawings.length)].id;
  let best = null, weight = 0.5;
  for (const pose of hand?.poses || []) {
    const raised = finite(values?.[pose.parameter], 0);
    if (raised <= weight) continue;
    const id = handDrawingId(pose.id, drawings);
    if (id) { best = id; weight = raised; }
  }
  return best || hand?.sprites?.showing || drawings[0].id;
}

export function normalizeHandInertia(source = {}) {
  return {
    enabled: source?.enabled === true,
    stiffness: clamp(finite(source?.stiffness, 0.25), 0.01, 1),
    damping: clamp(finite(source?.damping, 0.65), 0.01, 1),
    maxOvershoot: Math.max(0, finite(source?.maxOvershoot, 0.35)),
    followAmount: clamp(finite(source?.followAmount, 1), 0, 1)
  };
}

export function normalizeHands(rig = {}) {
  const source = rig?.hands;
  if (!source || typeof source !== 'object') return null;
  const hands = {};
  for (const side of HAND_SIDES) {
    if (!source[side] || typeof source[side] !== 'object') continue;
    const hand = normalizeHand(source[side], side);
    if (hand.element) hands[side] = hand;
  }
  return Object.keys(hands).length ? hands : null;
}

/**
 * The parameter that brings a hand out from behind the head, matching what
 * the hand panel writes (`handLShow`): 0 tucked away, 1 out at its rest place.
 */
export function handShowParameterName(side) {
  return `hand${side === 'right' ? 'R' : 'L'}Show`;
}

/**
 * How long a hand takes to come out from behind the head, or to go back.
 *
 * The show parameter is an ordinary parameter, so anything can set it in one
 * frame -- a page calling `setParameter`, a pose chip, a state change, an
 * expression with no blend span. A hand that *appeared* at its rest place
 * would look like it had never been behind the head at all, so the runtime
 * and the editor both ease the drawn value towards the asked-for one over
 * this span (`createHandReveal`): the hand always travels.
 */
export const HAND_REVEAL_SECONDS = 0.45;

const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * The eased show parameters: whatever value is asked for, the drawn value
 * travels there over `seconds`, ease in and out, from wherever it is. A
 * parameter that is already animated -- the Wave's own track -- is followed
 * with the same lag, which only makes its slide a beat longer.
 *
 * @param {Record<string, object>} params the rig's parameters, read for which show parameters exist
 * @returns {{ step(values: object, delta: number): object, settled(): boolean, reset(): void, names: string[] }}
 */
export function createHandReveal(params = {}, { seconds = HAND_REVEAL_SECONDS } = {}) {
  const names = HAND_SIDES.map(handShowParameterName).filter((name) => name in (params || {}));
  const span = Math.max(0, finite(seconds, HAND_REVEAL_SECONDS));
  const entries = new Map();
  const current = (entry) => (span <= 0 || entry.elapsed >= span ? entry.to : entry.from + (entry.to - entry.from) * smoothstep(entry.elapsed / span));
  return {
    names,
    /** `values` with each show parameter replaced by where its hand has got to. `delta` is in seconds. */
    step(values = {}, delta = 0) {
      if (!names.length) return values;
      const out = { ...values };
      for (const name of names) {
        const target = clamp(finite(values[name], 0), 0, 1);
        let entry = entries.get(name);
        // The first frame is where the hand starts: nothing slides in from nowhere.
        if (!entry) { entry = { from: target, to: target, elapsed: span }; entries.set(name, entry); }
        else if (entry.to !== target) entry = Object.assign(entry, { from: current(entry), to: target, elapsed: 0 });
        entry.elapsed += Math.max(0, finite(delta, 0));
        out[name] = current(entry);
      }
      return out;
    },
    /** Whether every hand is where it was asked to be. */
    settled() { for (const entry of entries.values()) if (entry.elapsed < span && entry.from !== entry.to) return false; return true; },
    reset() { entries.clear(); }
  };
}

/** The parameters cartoon inertia lags. Depth is excluded: draw order must not wobble. */
export function handMotionParameters(hand) {
  return [hand.parameters.x, hand.parameters.y, hand.parameters.rotation, hand.parameters.scale];
}

/* ── Reach ───────────────────────────────────────────────────────────────── */

/**
 * Soft reach limit. Inside the ellipse nothing changes; outside it the radius
 * eases towards `1 + softness` instead of stopping dead, so a hand can
 * overshoot a little the way a cartoon hand should.
 *
 * ```text
 * ((x / reachX)² + (y / reachY)²) ≤ 1
 * ```
 */
export function softenReach(radius, softness = 0.25) {
  const r = Math.max(0, finite(radius, 0));
  if (r <= 1) return r;
  if (softness <= 0) return 1;
  return 1 + softness * (1 - Math.exp(-(r - 1) / softness));
}

/** Normalized hand input → an offset in user units, softly bounded by `reach`. */
export function handOffset(hand, x, y) {
  const nx = finite(x, 0);
  const ny = finite(y, 0);
  const radius = Math.hypot(nx, ny);
  if (radius === 0) return { x: hand.restOffset.x, y: hand.restOffset.y };
  const factor = softenReach(radius, hand.softness) / radius;
  return {
    x: hand.restOffset.x + nx * factor * hand.reach.x,
    y: hand.restOffset.y + ny * factor * hand.reach.y
  };
}

/* ── Anchors ─────────────────────────────────────────────────────────────── */

/**
 * How far the anchor travelled because the body moved. The hand adds this to
 * its own local animation, so "body movement moves the anchor" and "local hand
 * movement is preserved" are both true at once.
 */
export function anchorDrift(hand, elements = {}, frame = {}, matrices = null) {
  if (!hand.parent) return { x: 0, y: 0 };
  const base = elements?.[hand.parent]?.baseTransform;
  const animated = frame?.[hand.parent]?.transform;
  if (base && animated) {
    const rest = applyElementTransform(base, hand.anchor);
    const now = applyElementTransform(frame[hand.parent].matrix ? matrixTransform(frame[hand.parent].matrix, hand.anchor, animated) : animated, hand.anchor);
    return { x: now.x - rest.x, y: now.y - rest.y };
  }
  // An anchor may also hang off a deformer rather than a drawn element.
  const matrix = matrices?.get?.(hand.parent);
  if (!matrix) return { x: 0, y: 0 };
  const moved = applyMatrix(matrix, hand.anchor);
  return { x: moved.x - hand.anchor.x, y: moved.y - hand.anchor.y };
}

// When the parent itself is inside a hierarchy, its world matrix is the truth.
function matrixTransform(matrix, point, fallback) {
  if (!matrix) return fallback;
  const moved = applyMatrix(matrix, point);
  return { x: moved.x - point.x, y: moved.y - point.y, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
}

/* ── Evaluation ──────────────────────────────────────────────────────────── */

/**
 * Resolve both hands after the ordinary elements are compiled, and fold the
 * result into their frames. Poses contribute shape-key weights (method A) or
 * variant opacities (method B); the caller applies shape weights through the
 * usual shape-key pass.
 */
export function evaluateHands(hands, elements = {}, frame = {}, values = {}, { matrices = null, parallax = DEFAULT_PARALLAX, previousBands = null, handSprites = null, delta = 0 } = {}) {
  if (!hands) return frame;
  for (const side of HAND_SIDES) {
    const hand = hands[side];
    if (!hand) continue;
    const entry = frame[hand.element];
    if (!entry) continue;
    const offset = handOffset(hand, values[hand.parameters.x], values[hand.parameters.y]);
    const drift = anchorDrift(hand, elements, frame, matrices);
    // One movement for the hand and for every drawing that stands in for it.
    const move = {
      x: offset.x + drift.x, y: offset.y + drift.y,
      rotation: finite(values[hand.parameters.rotation], 0) * hand.reach.rotation,
      scale: 1 + finite(values[hand.parameters.scale], 0) * hand.reach.scale
    };
    carry(entry, move);
    // The hand's own depth and its parameter, on top of whatever the artwork's
    // depth already says: a keyform on the group can sink a hand behind the
    // head while it rests there (docs/HAND_RIGGING.md, "Behind the head").
    entry.depth = clampDepth(hand.depth + finite(values[hand.parameters.depth], 0) + finite(entry.depth, 0));
    // behind / normal / front, with hysteresis: a hand hovering on a boundary
    // must not swap draw order every frame (docs/DEPTH_PARALLAX.md).
    entry.depthBand = depthBand(entry.depth, parallax, previousBands?.[hand.element] || null);
    // A 2D hand shows one of its drawings; a hand that has not been converted
    // deforms the one it has (docs/HANDS_2D.md, docs/HANDS_2D_AUDIT.md).
    if (hand.sprites && handSprites?.[side]) showHandDrawing(hand, handSprites[side], entry, frame, values, delta);
    else applyHandPoses(hand, entry, frame, values, move);
  }
  return frame;
}

/**
 * Show the drawing this hand is asking for, and hide the rest.
 *
 * The drawings are **children of the hand group**, so the hand's own
 * transform — its reach, its anchor drift, its turn and its size — carries
 * them already and there is nothing to place: this writes opacity, and
 * nothing else. That is the whole of the runtime cost of a change of drawing.
 *
 * There is no interpolation between two drawings, only between their
 * opacities, and only for the length of a swap. Whatever a drawing does on its
 * own — a fist closing, a thumb going up — is that drawing's own shape keys
 * over its own parts, and the runtime has already played them by here.
 */
function showHandDrawing(hand, swap, entry, frame, values, delta) {
  const wanted = handDrawingFromValues(hand, values);
  const step = swap.step(wanted, delta, { hidden: entry.opacity <= 0 });
  entry.handDrawing = step.showing;
  for (const drawing of hand.sprites.drawings) {
    const target = frame[drawing.element];
    if (!target) continue;
    const opacity = drawing.id === step.showing ? step.opacity : (drawing.id === step.leaving ? step.leavingOpacity : 0);
    target.opacity = clamp(target.opacity * opacity, 0, 1);
  }
}

/** Add the hand's movement to a frame entry; a pivot, when given, is where it turns. */
function carry(entry, move, pivot = null) {
  const t = entry.transform;
  entry.transform = {
    ...t,
    x: t.x + move.x, y: t.y + move.y,
    rotation: t.rotation + move.rotation,
    scaleX: t.scaleX * move.scale, scaleY: t.scaleY * move.scale,
    ...(pivot ? { pivotX: pivot.x, pivotY: pivot.y } : {})
  };
}

function applyHandPoses(hand, entry, frame, values, move) {
  if (hand.poses.length === 0) return;
  const variants = new Map();
  for (const pose of hand.poses) {
    const weight = clamp(finite(values[pose.parameter], 0), 0, 1);
    if (pose.shapeKey) {
      entry.shapeWeights ||= {};
      entry.shapeWeights[pose.shapeKey] = finite(entry.shapeWeights[pose.shapeKey], 0) + weight;
    }
    if (pose.variant && frame[pose.variant]) variants.set(pose.variant, finite(variants.get(pose.variant), 0) + weight);
  }
  if (variants.size === 0) return;
  // Method B: a short cross-fade, never a hard cut — the neutral hand fades out
  // by exactly as much as the drawings fade in. Several drawings raised at once
  // share that one hand rather than piling up past it.
  let total = 0;
  for (const weight of variants.values()) total += weight;
  const share = total > 1 ? 1 / total : 1;
  const pivot = { x: entry.transform.pivotX, y: entry.transform.pivotY };
  for (const [id, weight] of variants) {
    const target = frame[id];
    // A drawing stands in for the hand, so it goes where the hand goes: the
    // same reach, the same anchor drift, the same turn around the same pivot,
    // and the same place in the draw order.
    carry(target, move, pivot);
    target.depth = entry.depth;
    target.depthBand = entry.depthBand;
    target.opacity = clamp(target.opacity * weight * share, 0, 1);
  }
  entry.opacity = clamp(entry.opacity * (1 - Math.min(1, total)), 0, 1);
}
