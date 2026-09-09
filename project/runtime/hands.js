/**
 * Floating hands (docs/HAND_RIGGING.md, docs/HAND_STYLES.md).
 *
 * ```text
 * BODY
 *  ├─ leftHandAnchor ── LEFT HAND ── one static drawing, chosen by style
 *  └─ rightHandAnchor ─ RIGHT HAND ─ the other, entirely independent
 * ```
 *
 * There are no arms, no elbows, no wrists, no skeleton and no IK. A hand is
 * artwork that hangs off an anchor point on the body: the anchor follows
 * whatever the body does, and the hand keeps its own movement on top.
 *
 * A hand's **shape** is a style and nothing else, and a style is a whole
 * drawing that never deforms. A frame is a transform and a visibility; a
 * change of style is a sprite swap. Nothing here recomputes geometry.
 */

import { finite, clamp } from './numeric.js';
import { applyElementTransform, applyMatrix } from './transform-2d.js';
import { depthBand, clampDepth, DEFAULT_PARALLAX } from './depth.js';
import { DEFAULT_HAND_STYLE, HAND_SIDES, handStyleId, handStyleLabel } from './hand-vocabulary.js';
import { DEFAULT_HAND_SWAP, createHandSwap, handSwapMode } from './hand-sprite.js';
export { applyElementTransform } from './transform-2d.js';

// One list, in the vocabulary that owns the rest of what a hand can be. The
// `from` form so the bundler strips it: a plain re-export would be a second
// `export` of the same name once the modules are one file.
export { HAND_SIDES } from './hand-vocabulary.js';

const DEFAULT_REACH = Object.freeze({ x: 40, y: 30, rotation: 30, scale: 0.2 });

/**
 * A hand pose, as files written before the style refit carry one.
 *
 * **Deprecated** (docs/HAND_STYLES.md, "Deprecated fields"). A pose was a
 * parameter that deformed the hand; a style is a drawing that is chosen. The
 * runtime never reads a pose for shape — the only thing left that reads these
 * is the editor's migration, which maps a pose onto the style nearest to it.
 *
 * `variant` is the one that still draws: a pose whose whole artwork stood in
 * for the hand is already a static drawing, so it goes on being shown until
 * the project is migrated. `shapeKey` — the pose that deformed six paths — is
 * dropped on the way in and moves nothing.
 */
export function normalizeHandPose(source = {}) {
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : '',
    name: typeof source?.name === 'string' && source.name ? source.name : (source?.id || ''),
    parameter: typeof source?.parameter === 'string' ? source.parameter : '',
    variant: typeof source?.variant === 'string' && source.variant ? source.variant : null
  };
}

export function normalizeHand(source = {}, side = 'left') {
  const capital = side === 'right' ? 'R' : 'L';
  const styles = normalizeHandStyleSet(source?.styles ?? source?.sprites);
  const given = source?.parameters && typeof source.parameters === 'object' ? source.parameters : {};
  // `drawing` is what an older file called the style parameter, and `anim`
  // played a drawing's own little rig. The first is renamed; the second is
  // dropped, because nothing deforms a hand any more (docs/HAND_STYLES.md).
  const { drawing: legacyStyleParameter, anim: _retiredAnim, ...carried } = given;
  const parameters = {
    x: `hand${capital}X`, y: `hand${capital}Y`, rotation: `hand${capital}Rotation`,
    scale: `hand${capital}Scale`, depth: `hand${capital}Depth`,
    // The one parameter that decides a hand's shape: which style it shows.
    // Only a hand that *has* styles names it — every entry here is a parameter
    // the rig must carry, and a hand with no drawings has nothing to point it at.
    ...(styles ? { style: legacyStyleParameter || `hand${capital}Style` } : {}),
    ...carried
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
    // Deprecated, and only ever read by the editor's migration and by the
    // legacy variant fallback below.
    poses: (Array.isArray(source?.poses) ? source.poses : []).map(normalizeHandPose).filter((pose) => pose.id),
    inertia: normalizeHandInertia(source?.inertia),
    // The styles this hand can show, and the mark on a hand that still carries
    // the pseudo-3D turn -- deprecated, and read by nothing but the editor's
    // offer to convert it.
    //
    // Both are left out when there is nothing to say, so a hand that has not
    // been converted is byte for byte the hand it always was: a rig written
    // before the refit round-trips through here unchanged.
    ...(styles ? { styles } : {}),
    ...(source?.legacyPseudo3D === true ? { legacyPseudo3D: true } : {})
  };
}

/* ── The styles a hand can show (docs/HAND_STYLES.md) ─────────────────────── */

/**
 * One style a hand holds: which style it is, what to call it, and which group
 * draws it.
 *
 * That is the whole record. There is no animation on it, no view, no pivot of
 * its own and no scale of its own: every style in a hand shares the hand's
 * pivot and the hand's size, which is exactly what stops a change of style
 * from moving or resizing the hand (docs/HAND_STYLES.md, "One pivot").
 */
export function normalizeHandStyleEntry(source = {}) {
  const raw = typeof source?.id === 'string' ? source.id.trim() : '';
  if (!raw) return null;
  // An older file names the style the registry has since renamed
  // (`palmOpen` → `open`); the element it points at is left exactly as it is.
  const id = handStyleId(raw) || raw;
  return {
    id,
    label: typeof source?.label === 'string' && source.label ? source.label
      : (typeof source?.name === 'string' && source.name ? source.name : handStyleLabel(id)),
    element: typeof source?.element === 'string' && source.element ? source.element : '',
    // Whether this hand's copy of the drawing is the mirror of the shared
    // asset. Informational: the flip is baked into the artwork the editor
    // appended, so nothing at runtime has to apply it.
    mirrored: source?.mirrored === true
  };
}

/**
 * A hand's library: which styles it holds, which one it rests on, and how it
 * gets from one to the next.
 *
 * ```js
 * styles: {
 *   set: 'defaultCartoon',
 *   showing: 'relaxed',            // the style it rests on
 *   swap: 'cut',
 *   pivot: [100, 100],
 *   library: [{ id, label, element, mirrored }]
 * }
 * ```
 *
 * There is no view here, no facing axis and no thresholds: which drawing is on
 * screen is a choice, not a consequence of an angle. `null` when a hand has no
 * drawings at all, which is every hand of a project written before the refit.
 */
export function normalizeHandStyleSet(source = null) {
  if (!source || typeof source !== 'object') return null;
  // `drawings` is what an older file called the library.
  const entries = Array.isArray(source.library) ? source.library : (Array.isArray(source.drawings) ? source.drawings : []);
  const library = [];
  const seen = new Set();
  for (const entry of entries) {
    const style = normalizeHandStyleEntry(entry);
    // Two entries that migrate onto one style are one style: the first wins,
    // so a library never offers the same drawing twice.
    if (!style || !style.element || seen.has(style.id)) continue;
    seen.add(style.id);
    library.push(style);
  }
  if (!library.length) return null;
  return {
    set: typeof source.set === 'string' && source.set ? source.set : 'defaultCartoon',
    showing: handStyleId(source.showing ?? source.style ?? source.drawing ?? source.pose, library) || library[0].id,
    swap: handSwapMode(source.swap),
    pivot: Array.isArray(source.pivot) && source.pivot.length === 2 ? [finite(source.pivot[0], 0), finite(source.pivot[1], 0)] : null,
    library
  };
}

/** The styles a hand holds, in the order its parameter indexes them. */
export const handStyleList = (styles) => styles?.library || [];

/** The style ids a hand holds. */
export const handStyleIds = (styles) => handStyleList(styles).map((style) => style.id);

/**
 * One swap per hand, made once and kept: which drawing is on screen is a
 * memory, and a hand that made a new swap every frame would never hold one.
 */
export function createHandStyleSwaps(hands) {
  if (!hands) return null;
  const out = {};
  for (const side of HAND_SIDES) {
    const styles = hands[side]?.styles;
    if (!styles) continue;
    // Started empty rather than on the style the hand rests on: the first
    // frame is a cut to whatever is asked for, whatever that is.
    out[side] = createHandSwap({ mode: styles.swap });
  }
  return Object.keys(out).length ? out : null;
}

/** Whether every hand is showing the style it was asked for. */
export const handStylesSettled = (swaps) => !swaps || Object.values(swaps).every((swap) => swap.settled);

const roundIndex = (value, length) => Math.max(0, Math.min(length - 1, Math.round(finite(value, 0))));

/**
 * The style a hand is showing, as its parameters say.
 *
 * `handLStyle` indexes the hand's own library, which is what makes the choice
 * keyframable and steppable — a discrete choice, never a blend
 * (docs/HAND_STYLES.md, "Timeline"). A project migrated from the deforming
 * hand has no such parameter and one `handLFist`-shaped parameter per pose
 * instead, so the **most raised** of those is read instead and mapped onto a
 * style — the bridge that keeps an old project showing the hand it was
 * showing.
 */
export function handStyleFromValues(hand, values = {}) {
  const library = handStyleList(hand?.styles);
  if (!library.length) return null;
  const chosen = values?.[hand?.parameters?.style];
  if (Number.isFinite(Number(chosen))) return library[roundIndex(chosen, library.length)].id;
  let best = null, weight = 0.5;
  for (const pose of hand?.poses || []) {
    const raised = finite(values?.[pose.parameter], 0);
    if (raised <= weight) continue;
    const id = handStyleId(pose.id, library);
    if (id) { best = id; weight = raised; }
  }
  return best || hand?.styles?.showing || library[0].id;
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
 * result into their frames.
 *
 * ```text
 * per hand, per frame:   transform  +  depth  +  which style is visible
 * ```
 *
 * That is all of it. Nothing here recomputes geometry, deforms a drawing or
 * blends two of them, and the two hands never read each other: a left hand
 * showing `open` beside a right hand showing `point` is two independent
 * lookups (docs/HAND_STYLES.md, "Two hands").
 */
export function evaluateHands(hands, elements = {}, frame = {}, values = {}, { matrices = null, parallax = DEFAULT_PARALLAX, previousBands = null, handStyles = null } = {}) {
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
    if (hand.styles) showHandStyle(hand, handStyles?.[side] || null, entry, frame, values);
    else showLegacyHandVariants(hand, entry, frame, values, move);
  }
  return frame;
}

/**
 * Show the style this hand is asking for, and hide the rest.
 *
 * `swap` is the hand's memory of what is on screen, and it is optional: with
 * one, a `hidden` swap can hold a change until nobody is looking; without one,
 * the style asked for is shown at once.
 *
 * The drawings are **children of the hand group**, so the hand's own transform
 * — its reach, its anchor drift, its turn and its size — carries them already
 * and there is nothing to place: this writes one visibility per style, and
 * nothing else. That is the whole of the runtime cost of a change of style.
 *
 * There is no interpolation of any kind: a style is either on screen or it is
 * not.
 */
function showHandStyle(hand, swap, entry, frame, values) {
  const wanted = handStyleFromValues(hand, values);
  // Without a swap -- a one-off frame, a test, a caller that keeps no state --
  // the style asked for is the style shown, which is what `cut` does anyway.
  const showing = swap ? swap.step(wanted, { hidden: entry.opacity <= 0 }).showing : wanted;
  entry.handStyle = showing;
  for (const style of hand.styles.library) {
    const target = frame[style.element];
    if (!target) continue;
    target.opacity = style.id === showing ? clamp(target.opacity, 0, 1) : 0;
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

/**
 * **Deprecated** (docs/HAND_STYLES.md, "Deprecated fields"): a hand from
 * before the style refit whose poses were whole pieces of artwork beside it.
 *
 * Those drawings are already static — they are a style library that has not
 * been given its name yet — so they go on being shown, carried by the hand the
 * way they always were, until the project is migrated. A pose that deformed
 * the hand instead moves nothing: no shape weight is written here, and the
 * pseudo-3D turn it belonged to is gone.
 */
function showLegacyHandVariants(hand, entry, frame, values, move) {
  const variants = new Map();
  for (const pose of hand.poses) {
    if (!pose.variant || !frame[pose.variant]) continue;
    variants.set(pose.variant, Math.max(variants.get(pose.variant) || 0, clamp(finite(values[pose.parameter], 0), 0, 1)));
  }
  if (variants.size === 0) return;
  // A choice, not a blend: the most-raised drawing stands in for the hand and
  // the rest are off, which is what a style swap does and what these become.
  let chosen = null, weight = 0.5;
  for (const [id, raised] of variants) if (raised > weight) { chosen = id; weight = raised; }
  const pivot = { x: entry.transform.pivotX, y: entry.transform.pivotY };
  for (const id of variants.keys()) {
    const target = frame[id];
    // A drawing stands in for the hand, so it goes where the hand goes: the
    // same reach, the same anchor drift, the same turn around the same pivot,
    // and the same place in the draw order.
    carry(target, move, pivot);
    target.depth = entry.depth;
    target.depthBand = entry.depthBand;
    target.opacity = id === chosen ? clamp(target.opacity, 0, 1) : 0;
  }
  if (chosen) entry.opacity = 0;
}
