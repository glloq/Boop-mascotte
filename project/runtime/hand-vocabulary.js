/**
 * What a 2D hand can be: a **pose**, a **view**, and which way round it is
 * (docs/HANDS_2D.md).
 *
 * ```text
 * pose   what the fingers do          relaxed · open · fist · point · grab · thumbsUp · peace
 * view   which drawing of it          sideLeft · threeQuarterLeft · front · threeQuarterRight · sideRight
 * face   palm towards the viewer, or the back of the hand
 * ```
 *
 * Three closed lists and nothing else. The old hand turned by **morphing**
 * between three tables on a continuous axis, so "which way is this hand
 * facing" was a number that could land anywhere, and everywhere between two
 * drawings was a hand that had never been drawn. Here a view is one of five
 * drawings: the hand is always something somebody drew.
 *
 * The angles are **labels, not rotations**. `threeQuarterRight ≈ +45°` says
 * which turn that drawing stands for, so an orientation the rig already has
 * can pick one (`hand-view-select.js`); nothing rotates anything by it. A
 * hand's own `rotation` is a separate parameter and stays separate
 * (docs/HANDS_2D.md, "Rotation is not view").
 *
 * Pure data and small pure functions: no DOM, no state, no assets. What
 * drawing a given pose and view resolves to is `hand-assets.js`.
 */
import { finite } from './numeric.js';

/* ── Poses (PHASE 3) ───────────────────────────────────────────────────────── */

/**
 * The shape of the hand. One list, in one place: a pose is added here and the
 * resolver, the editor and the validator all know it at once.
 *
 * `mirrorable` says whether the *view* may be obtained by flipping its
 * opposite. A fist reads the same either way round; a pointing finger, a
 * thumbs up and a peace sign do not — flipping them puts the thumb on the
 * wrong side of the hand, which is the one thing a viewer notices. So an
 * asymmetric pose is drawn for both sides or falls back to the front, never
 * mirrored (PHASE 9).
 */
export const HAND_POSES = Object.freeze([
  Object.freeze({ id: 'relaxed', name: 'Relaxed', mirrorable: true }),
  Object.freeze({ id: 'open', name: 'Open', mirrorable: true }),
  Object.freeze({ id: 'fist', name: 'Fist', mirrorable: true }),
  Object.freeze({ id: 'point', name: 'Point', mirrorable: false }),
  Object.freeze({ id: 'grab', name: 'Grab', mirrorable: true }),
  Object.freeze({ id: 'thumbsUp', name: 'Thumbs Up', mirrorable: false }),
  Object.freeze({ id: 'peace', name: 'Peace', mirrorable: false })
]);

/** The pose everything falls back to, and the one a new hand starts on. */
export const DEFAULT_HAND_POSE = 'relaxed';

/**
 * Names that are a **gesture**, not a shape (PHASES 30–31).
 *
 * A wave is an open hand turning. Drawing a `wave` pose would mean five more
 * drawings that differ from `open` in nothing, so the name resolves to `open`
 * and the waving is a rotation clip. Poses are for changes of shape; anything
 * a translation, a turn or a scale can say is an animation, not an asset.
 */
export const HAND_POSE_ALIASES = Object.freeze({
  wave: 'open', hello: 'open', hi: 'open', flat: 'open',
  stop: 'open', spread: 'open', palm: 'open',
  neutral: 'relaxed', rest: 'relaxed', idle: 'relaxed', relax: 'relaxed', relaxed: 'relaxed',
  hold: 'grab', grip: 'grab',
  victory: 'peace', thumbup: 'thumbsUp', thumbsup: 'thumbsUp'
});

/*
 * An alias is for a name that means a pose the system already has. `ok` and
 * `pinch` are not aliases of anything here -- a thumb and finger touching is a
 * shape of its own, and calling it a `point` or a `grab` would put the wrong
 * drawing on screen. They resolve to nothing, and a set that wants them draws
 * them.
 */

const POSE_BY_ID = new Map(HAND_POSES.map((pose) => [pose.id, pose]));

/** A pose id as the system knows it, following aliases; `null` when it knows none. */
export function handPoseId(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (POSE_BY_ID.has(raw)) return raw;
  const alias = HAND_POSE_ALIASES[raw] || HAND_POSE_ALIASES[raw.toLowerCase()];
  return alias && POSE_BY_ID.has(alias) ? alias : null;
}

/** The pose record, or the default one when the name is not a pose. */
export const handPose = (value) => POSE_BY_ID.get(handPoseId(value) || DEFAULT_HAND_POSE) || POSE_BY_ID.get(DEFAULT_HAND_POSE);

/** Whether a pose may be drawn by flipping the opposite view (PHASE 9). */
export const isPoseMirrorable = (value) => handPose(value).mirrorable === true;

/* ── Views (PHASE 4) ───────────────────────────────────────────────────────── */

/**
 * The five drawings, in spatial order — the order the editor lays them out in,
 * and the order a turn passes through.
 *
 * ```text
 *   sideLeft   threeQuarterLeft   front   threeQuarterRight   sideRight
 *     −90°           −45°           0°          +45°             +90°
 * ```
 *
 * `mirrorOf` is the view a drawing **becomes** when it is flipped
 * horizontally, which makes it an involution over the row: the two sides swap,
 * the two three-quarters swap, and the front maps to itself. That one rule
 * covers both kinds of mirroring at once — a left hand's drawing flipped is a
 * right hand's drawing of the mirrored view (PHASE 9) — so nothing downstream
 * has to reason about them separately.
 *
 * `preferredRotation` is advice, not a clamp (PHASE 20): how far the animation
 * system may turn this drawing before it stops reading as a hand. A front view
 * survives anything; a hand seen edge-on turned upside down does not.
 */
export const HAND_VIEWS = Object.freeze([
  Object.freeze({ id: 'sideLeft', name: 'Side (left)', short: '◄ side', angle: -90, mirrorOf: 'sideRight', preferredRotation: Object.freeze([-70, 70]) }),
  Object.freeze({ id: 'threeQuarterLeft', name: 'Three quarter (left)', short: '◄ 3/4', angle: -45, mirrorOf: 'threeQuarterRight', preferredRotation: Object.freeze([-110, 110]) }),
  Object.freeze({ id: 'front', name: 'Front', short: 'front', angle: 0, mirrorOf: 'front', preferredRotation: Object.freeze([-180, 180]) }),
  Object.freeze({ id: 'threeQuarterRight', name: 'Three quarter (right)', short: '3/4 ►', angle: 45, mirrorOf: 'threeQuarterLeft', preferredRotation: Object.freeze([-110, 110]) }),
  Object.freeze({ id: 'sideRight', name: 'Side (right)', short: 'side ►', angle: 90, mirrorOf: 'sideLeft', preferredRotation: Object.freeze([-70, 70]) })
]);

/** The view everything falls back to: the one pose set that is always drawn. */
export const DEFAULT_HAND_VIEW = 'front';

/** Names an older project or a hurried author may use for a view. */
export const HAND_VIEW_ALIASES = Object.freeze({
  left: 'sideLeft', right: 'sideRight', side: 'sideRight', profile: 'sideRight', far: 'sideLeft',
  threeQuarter: 'threeQuarterRight', '3/4': 'threeQuarterRight',
  threeQuarterL: 'threeQuarterLeft', threeQuarterR: 'threeQuarterRight',
  '3/4L': 'threeQuarterLeft', '3/4R': 'threeQuarterRight',
  centre: 'front', center: 'front', face: 'front'
});

const VIEW_BY_ID = new Map(HAND_VIEWS.map((view) => [view.id, view]));

/** A view id as the system knows it, following aliases; `null` when it knows none. */
export function handViewId(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (VIEW_BY_ID.has(raw)) return raw;
  const alias = HAND_VIEW_ALIASES[raw] || HAND_VIEW_ALIASES[raw.toLowerCase()];
  return alias && VIEW_BY_ID.has(alias) ? alias : null;
}

/** The view record, or the front one when the name is not a view. */
export const handView = (value) => VIEW_BY_ID.get(handViewId(value) || DEFAULT_HAND_VIEW) || VIEW_BY_ID.get(DEFAULT_HAND_VIEW);

/** The angle a view stands for, in degrees. A label; nothing is rotated by it. */
export const handViewAngle = (value) => handView(value).angle;

/** The view a drawing becomes when flipped horizontally. `front` maps to itself. */
export const handViewMirror = (value) => handView(value).mirrorOf;

/** Whether flipping this view leaves it where it was: only the front does. */
export const isSelfMirroredView = (value) => handViewMirror(value) === (handViewId(value) || DEFAULT_HAND_VIEW);

/** How far this drawing may be turned before it stops reading (PHASE 20). Advice. */
export const handViewRotationRange = (value) => handView(value).preferredRotation;

/** Where a view sits in the spatial row, `0` at the far left. */
export const handViewIndex = (value) => HAND_VIEWS.findIndex((view) => view.id === (handViewId(value) || DEFAULT_HAND_VIEW));

/** The view `steps` further along the row, stopping at either end. */
export function handViewStep(value, steps = 1) {
  const at = handViewIndex(value) + Math.trunc(Number(steps) || 0);
  return HAND_VIEWS[Math.max(0, Math.min(HAND_VIEWS.length - 1, at))].id;
}

/** The views either side of this one: what to preload when a hand is turning (PHASE 47). */
export function handViewNeighbours(value) {
  const id = handViewId(value) || DEFAULT_HAND_VIEW;
  return HAND_VIEWS.filter((view) => Math.abs(handViewIndex(view.id) - handViewIndex(id)) === 1).map((view) => view.id);
}

/* ── Faces (PHASE 5) ───────────────────────────────────────────────────────── */

/**
 * Palm towards the viewer, or the back of the hand.
 *
 * This is **not** a sixth view. A view says how far round the hand has turned
 * in the drawing plane; the face says which of its two sides that drawing
 * shows, and the two are independent — a three-quarter view exists palm-out
 * and back-out. Keeping them apart is what stops the parameter list growing
 * ten view names long (`threeQuarterRightBack`…), which is the duplication
 * PHASE 5 asks to avoid.
 *
 * A hand set may draw only palms. The resolver then falls back to the palm
 * drawing rather than to nothing, so `face` costs a set that ignores it
 * exactly nothing.
 */
export const HAND_FACES = Object.freeze([
  Object.freeze({ id: 'palm', name: 'Palm', opposite: 'back' }),
  Object.freeze({ id: 'back', name: 'Back', opposite: 'palm' })
]);

export const DEFAULT_HAND_FACE = 'palm';

const FACE_BY_ID = new Map(HAND_FACES.map((face) => [face.id, face]));

export function handFaceId(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return FACE_BY_ID.has(raw) ? raw : null;
}

export const handFace = (value) => FACE_BY_ID.get(handFaceId(value) || DEFAULT_HAND_FACE);
export const handFaceOpposite = (value) => handFace(value).opposite;

/* ── Sides ─────────────────────────────────────────────────────────────────── */

export const HAND_SIDES = Object.freeze(['left', 'right']);
export const handSideId = (value) => (value === 'right' ? 'right' : 'left');
export const handSideOpposite = (value) => (handSideId(value) === 'right' ? 'left' : 'right');

/* ── A hand's appearance, as one record (PHASES 1–2) ───────────────────────── */

/**
 * What a hand looks like, apart from where it is.
 *
 * Transformation and appearance are two records on purpose (PHASE 2): moving a
 * hand never touches its drawing, and changing its drawing never moves it.
 * `x`, `y`, `rotation`, `scale`, `flipX` and `visible` are the transformation
 * and live on the hand's parameters; `pose`, `view` and `face` are the
 * appearance and live here.
 */
export function normalizeHandAppearance(source = {}, side = 'left') {
  return {
    side: handSideId(side),
    pose: handPoseId(source?.pose) || DEFAULT_HAND_POSE,
    view: handViewId(source?.view) || DEFAULT_HAND_VIEW,
    face: handFaceId(source?.face) || DEFAULT_HAND_FACE
  };
}

/**
 * A whole 2D hand: what it looks like and where it is (PHASE 1).
 *
 * The one record a `HandSprite` is handed, and the one an animation keyframes:
 * `x`, `y`, `rotation` and `scale` interpolate continuously, `pose`, `view`,
 * `face`, `flipX` and `visible` step (PHASE 32).
 */
export function normalizeHandState(source = {}, side = 'left') {
  const resolved = handSideId(source?.side ?? side);
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : `${resolved}Hand`,
    ...normalizeHandAppearance(source, resolved),
    x: finite(source?.x, 0),
    y: finite(source?.y, 0),
    rotation: finite(source?.rotation, 0),
    scale: finite(source?.scale, 1),
    flipX: source?.flipX === true,
    visible: source?.visible !== false
  };
}
