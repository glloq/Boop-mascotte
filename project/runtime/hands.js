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
import {
  DEFAULT_HAND_FACE, DEFAULT_HAND_POSE, DEFAULT_HAND_VIEW, HAND_POSES, HAND_VIEWS,
  handFaceId, handPoseId, handViewId
} from './hand-vocabulary.js';
import { createHandAssetLibrary, normalizeHandAsset } from './hand-assets.js';
import { DEFAULT_HAND_VIEW_MODE, HAND_VIEW_HYSTERESIS, HAND_VIEW_SWEEP, HAND_VIEW_THRESHOLDS, handViewMode, normalizeHandViewThresholds } from './hand-view-select.js';
import { DEFAULT_HAND_SWAP, HAND_SWAP_SECONDS, createHandSprite, handSwapMode } from './hand-sprite.js';
export { applyElementTransform } from './transform-2d.js';

export const HAND_SIDES = Object.freeze(['left', 'right']);

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
  const sprites = normalizeHandSprites(source?.sprites, side);
  const parameters = {
    x: `hand${capital}X`, y: `hand${capital}Y`, rotation: `hand${capital}Rotation`,
    scale: `hand${capital}Scale`, depth: `hand${capital}Depth`,
    // The 2D hand's own three (docs/HANDS_2D.md): which drawing it shows, and
    // -- for a hand picking its view automatically -- which way it is turned.
    // `facing` is the name the pseudo-3D turn used, kept so a migrated project
    // keeps the orientation it already had. Only a hand that *has* drawings
    // names them: every entry here is a parameter the rig must carry, and a
    // hand still deforming has nothing to point them at.
    ...(sprites ? { pose: `hand${capital}Pose`, view: `hand${capital}View`, facing: `hand${capital}Facing` } : {}),
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
 * A hand's 2D set: which drawings it has, which one it rests on, and how it
 * chooses.
 *
 * ```js
 * sprites: {
 *   set: 'defaultCartoon',
 *   pose: 'relaxed', view: 'front', face: 'palm',
 *   viewMode: 'manual',                 // or 'auto', from the orientation
 *   swap: 'crossfade',
 *   thresholds: [-67.5, -22.5, 22.5, 67.5], hysteresis: 6, sweep: 90,
 *   drawings: [{ pose, view, face, element, pivot, mirrorable, defaultScale }]
 * }
 * ```
 *
 * `null` when a hand has none, which is every hand of a project written before
 * the refit: those keep the pseudo-3D path until they are migrated, and
 * nothing here runs for them.
 */
export function normalizeHandSprites(source = null, side = 'left') {
  if (!source || typeof source !== 'object') return null;
  const drawings = (Array.isArray(source.drawings) ? source.drawings : [])
    .map((drawing) => normalizeHandAsset({ side, ...drawing }))
    .filter((drawing) => drawing.element || drawing.src);
  if (!drawings.length) return null;
  return {
    set: typeof source.set === 'string' && source.set ? source.set : 'defaultCartoon',
    pose: handPoseId(source.pose) || DEFAULT_HAND_POSE,
    view: handViewId(source.view) || DEFAULT_HAND_VIEW,
    face: handFaceId(source.face) || DEFAULT_HAND_FACE,
    viewMode: handViewMode(source.viewMode),
    swap: handSwapMode(source.swap),
    swapSeconds: Math.max(0, finite(source.swapSeconds, HAND_SWAP_SECONDS)),
    thresholds: normalizeHandViewThresholds(source.thresholds),
    hysteresis: Math.max(0, finite(source.hysteresis, HAND_VIEW_HYSTERESIS)),
    sweep: Math.abs(finite(source.sweep, HAND_VIEW_SWEEP)) || HAND_VIEW_SWEEP,
    pivot: Array.isArray(source.pivot) && source.pivot.length === 2 ? [finite(source.pivot[0], 0), finite(source.pivot[1], 0)] : null,
    drawings
  };
}

/** The poses a set draws, in the catalogue's order: what a pose parameter indexes. */
export function handSpritePoses(sprites) {
  const drawn = new Set((sprites?.drawings || []).map((drawing) => drawing.pose));
  const poses = HAND_POSES.filter((pose) => drawn.has(pose.id)).map((pose) => pose.id);
  return poses.length ? poses : [DEFAULT_HAND_POSE];
}

/** A hand's set as a library the resolver can read. */
export const handAssetLibrary = (sprites) => createHandAssetLibrary(sprites?.drawings || [], {
  set: sprites?.set || 'defaultCartoon', pivot: sprites?.pivot || null
});

/**
 * One `HandSprite` per hand, made once and kept: the swap's timing and the
 * view's hysteresis are both memories, and a hand that made a new one every
 * frame would have neither.
 */
export function createHandSprites(hands, { warn = null } = {}) {
  if (!hands) return null;
  const out = {};
  for (const side of HAND_SIDES) {
    const sprites = hands[side]?.sprites;
    if (!sprites) continue;
    out[side] = createHandSprite({
      library: handAssetLibrary(sprites), side, warn,
      view: { mode: sprites.viewMode, view: sprites.view, thresholds: sprites.thresholds, hysteresis: sprites.hysteresis, sweep: sprites.sweep },
      swap: { mode: sprites.swap, seconds: sprites.swapSeconds }
    });
  }
  return Object.keys(out).length ? out : null;
}

/** Whether every hand has finished changing drawing. */
export const handSpritesSettled = (sprites) => !sprites || Object.values(sprites).every((sprite) => sprite.settled);

const roundIndex = (value, length) => Math.max(0, Math.min(length - 1, Math.round(finite(value, 0))));

/**
 * The pose a hand is in, as its parameters say.
 *
 * `handLPose` indexes the poses the set draws, which is what makes a pose
 * keyframable and steppable (PHASE 32). A project migrated from the pseudo-3D
 * hand has no such parameter and one `handLFist`-shaped parameter per pose
 * instead, so the **most raised** of those is read instead — the bridge that
 * keeps an old project showing the pose it was showing (PHASE 40).
 */
export function handPoseFromValues(hand, values = {}) {
  const poses = handSpritePoses(hand?.sprites);
  const chosen = values?.[hand?.parameters?.pose];
  if (Number.isFinite(Number(chosen))) return poses[roundIndex(chosen, poses.length)];
  let best = null, weight = 0.5;
  for (const pose of hand?.poses || []) {
    const raised = finite(values?.[pose.parameter], 0);
    if (raised <= weight) continue;
    const id = handPoseId(pose.id);
    if (id) { best = id; weight = raised; }
  }
  return best || hand?.sprites?.pose || DEFAULT_HAND_POSE;
}

/** The view a hand is asked for by hand, as an index into the row. `null` in automatic mode. */
export function handViewFromValues(hand, values = {}) {
  const chosen = values?.[hand?.parameters?.view];
  if (!Number.isFinite(Number(chosen))) return hand?.sprites?.view || DEFAULT_HAND_VIEW;
  return HAND_VIEWS[roundIndex(chosen, HAND_VIEWS.length)].id;
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
 * them already and there is nothing to place: this writes opacity, and a flip
 * when the chosen drawing is a mirror of another. That is the whole of the
 * runtime cost of a pose or a view change (PHASE 46).
 *
 * There is no interpolation between two drawings, only between their
 * opacities, and only for the length of a swap.
 */
function showHandDrawing(hand, sprite, entry, frame, values, delta) {
  const state = {
    side: hand.side,
    pose: handPoseFromValues(hand, values),
    view: handViewFromValues(hand, values),
    face: hand.sprites.face,
    visible: entry.opacity > 0
  };
  const drawn = sprite.resolve(state, { delta, orientation: values?.[hand.parameters.facing], hidden: entry.opacity <= 0 });
  entry.handDrawing = drawn.asset ? drawn.asset.element : null;
  entry.handView = drawn.view;
  entry.handPose = drawn.pose;
  const showing = drawn.asset?.element || null;
  const leaving = drawn.leaving ? (hand.sprites.drawings.find((drawing) => drawing.id === drawn.leaving) || {}).element : null;
  for (const drawing of hand.sprites.drawings) {
    const target = frame[drawing.element];
    if (!target) continue;
    const opacity = drawing.element === showing ? drawn.opacity : (drawing.element === leaving ? drawn.leavingOpacity : 0);
    target.opacity = clamp(target.opacity * opacity, 0, 1);
    // A drawing reached as the mirror of another is drawn turned over, around
    // the pivot every drawing in the set shares.
    if (drawing.element === showing && drawn.flipX) {
      const pivot = drawn.transform.pivot;
      target.transform = {
        ...target.transform, scaleX: -target.transform.scaleX,
        ...(pivot ? { pivotX: pivot[0], pivotY: pivot[1] } : {})
      };
    }
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
