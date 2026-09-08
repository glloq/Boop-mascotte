/**
 * Which drawing a hand is showing (docs/HANDS_2D.md).
 *
 * ```text
 * resolveHandAsset({ side, pose, view, face })  ─→  one drawing, or the nearest thing to it
 * ```
 *
 * **One place decides.** The old hand chose its look in a dozen places — a
 * keyform per part, a gate per pose, a grid per stop — and a look nobody had
 * drawn was reachable from most of them. Here every question of *what is on
 * screen* comes through this function, so a hand set can be swapped, extended
 * or shipped incomplete without anything else knowing.
 *
 * **It never fails.** A set that draws only `relaxed/front` still animates:
 * the ladder walks from what was asked for down to what exists, reports which
 * rung it landed on, and only ever returns nothing when the set is empty
 * (PHASE 8). A sprite that is missing is a warning in the editor and a silent
 * fallback in a published mascot, never a stopped mascot (PHASE 49).
 *
 * Pure: the library is data, the resolver is a lookup. Nothing is fetched, and
 * nothing is drawn.
 */
import {
  DEFAULT_HAND_FACE, DEFAULT_HAND_POSE, DEFAULT_HAND_VIEW, HAND_VIEWS,
  handFaceId, handFaceOpposite, handPoseId, handSideId, handSideOpposite,
  handViewAngle, handViewId, handViewMirror, handViewNeighbours, handViewRotationRange, isPoseMirrorable
} from './hand-vocabulary.js';

const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/* ── The descriptor (PHASE 24) ─────────────────────────────────────────────── */

/**
 * One drawing, described by the four things that find it and the four that
 * place it.
 *
 * ```js
 * { pose: 'open', view: 'front', face: 'palm', side: null,
 *   element: 'handLeftSprite-open-front',   // in the mascot's own SVG
 *   src: 'hands/defaultCartoon/open/front.svg',
 *   pivot: [100, 100], mirrorable: true, defaultScale: 1 }
 * ```
 *
 * `side: null` is a drawing that serves either hand as it stands — a set that
 * draws one generic hand rather than a pair. `pivot` is where the drawing
 * turns, in its own coordinates, and every drawing in a set shares it
 * (PHASE 21), so a swap never moves the hand.
 */
export function normalizeHandAsset(source = {}, defaults = {}) {
  const pose = handPoseId(source?.pose) || DEFAULT_HAND_POSE;
  const view = handViewId(source?.view) || DEFAULT_HAND_VIEW;
  const face = handFaceId(source?.face) || DEFAULT_HAND_FACE;
  const side = source?.side === 'left' || source?.side === 'right' ? source.side : null;
  const pivot = Array.isArray(source?.pivot) && source.pivot.length === 2
    ? [number(source.pivot[0], 0), number(source.pivot[1], 0)]
    : (defaults.pivot ? [...defaults.pivot] : null);
  const range = Array.isArray(source?.preferredRotation) && source.preferredRotation.length === 2
    ? [number(source.preferredRotation[0], -180), number(source.preferredRotation[1], 180)]
    : handViewRotationRange(view);
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : handAssetId({ side, pose, view, face }),
    pose, view, face, side,
    element: typeof source?.element === 'string' && source.element ? source.element : null,
    src: typeof source?.src === 'string' && source.src ? source.src : null,
    pivot,
    // A drawing may refuse to be flipped even where its pose allows it — a
    // glove with a logo on the back, a hand set drawn for one side only.
    mirrorable: source?.mirrorable !== false,
    defaultScale: number(source?.defaultScale, defaults.defaultScale ?? 1),
    preferredRotation: [...range]
  };
}

/** `left/open/front/palm` — the key a lookup is made on, and a readable id. */
export const handAssetId = ({ side = null, pose = DEFAULT_HAND_POSE, view = DEFAULT_HAND_VIEW, face = DEFAULT_HAND_FACE } = {}) =>
  `${side || 'any'}/${pose}/${view}/${face}`;

const slotKey = (side, pose, view, face) => `${side || 'any'}/${pose}/${view}/${face}`;

/* ── The library (PHASES 6–7) ──────────────────────────────────────────────── */

/**
 * A hand set, indexed for lookup.
 *
 * `set` names it so several may coexist (PHASE 37) and a custom mascot may
 * bring its own (PHASE 38). `pivot` and `defaultScale` are the set's
 * convention, inherited by any drawing that does not override them (PHASE 23).
 */
export function createHandAssetLibrary(assets = [], { set = 'defaultCartoon', pivot = null, defaultScale = 1, viewBox = null } = {}) {
  const defaults = { pivot: Array.isArray(pivot) && pivot.length === 2 ? [number(pivot[0], 0), number(pivot[1], 0)] : null, defaultScale: number(defaultScale, 1) };
  const entries = (Array.isArray(assets) ? assets : []).map((asset) => normalizeHandAsset(asset, defaults));
  const index = new Map();
  for (const asset of entries) {
    const key = slotKey(asset.side, asset.pose, asset.view, asset.face);
    // First one wins: a set that declares the same slot twice keeps the
    // drawing it declared first rather than depending on iteration order.
    if (!index.has(key)) index.set(key, asset);
  }
  return Object.freeze({
    set: String(set || 'defaultCartoon'),
    viewBox: typeof viewBox === 'string' && viewBox ? viewBox : null,
    pivot: defaults.pivot,
    defaultScale: defaults.defaultScale,
    assets: Object.freeze(entries),
    /** The drawing in exactly this slot, or `null`. Sideless drawings serve either hand. */
    at(side, pose, view, face) {
      return index.get(slotKey(side, pose, view, face)) || index.get(slotKey(null, pose, view, face)) || null;
    },
    /** Every pose this set draws, in the catalogue's order. */
    poses() { return [...new Set(entries.map((asset) => asset.pose))]; },
    /** Every view this set draws for a pose, in spatial order. */
    views(pose) {
      const drawn = new Set(entries.filter((asset) => asset.pose === (handPoseId(pose) || DEFAULT_HAND_POSE)).map((asset) => asset.view));
      return HAND_VIEWS.filter((view) => drawn.has(view.id)).map((view) => view.id);
    },
    get size() { return entries.length; }
  });
}

/** An empty set: every lookup misses, nothing throws. */
export const EMPTY_HAND_LIBRARY = createHandAssetLibrary([], { set: 'empty' });

/* ── The ladder (PHASES 8–9, 28) ───────────────────────────────────────────── */

/**
 * Every slot worth trying for one request, best first.
 *
 * ```text
 * pose + view + face                       exact
 * pose + view + other face                 face
 * mirror of pose + view + face             mirror        ← flipX, symmetric poses only
 * pose + front + face                      view
 * pose + nearest drawn view                nearest
 * relaxed + …                              pose          ← the same ladder again
 * ```
 *
 * A mirror candidate is the *flipped* drawing of the mirrored view: flipping a
 * left hand's three-quarter-left drawing gives a right hand's
 * three-quarter-right, and flipping a sideless drawing turns its view over
 * where it stands. One rule, both kinds of symmetry (PHASE 9).
 *
 * Exported so the editor can show an author why a hand is showing what it is.
 */
export function handAssetCandidates({ side = 'left', pose = DEFAULT_HAND_POSE, view = DEFAULT_HAND_VIEW, face = DEFAULT_HAND_FACE } = {}) {
  const wantSide = handSideId(side);
  const wantPose = handPoseId(pose) || DEFAULT_HAND_POSE;
  const wantView = handViewId(view) || DEFAULT_HAND_VIEW;
  const wantFace = handFaceId(face) || DEFAULT_HAND_FACE;
  const out = [];
  const seen = new Set();
  const push = (candidate) => {
    const key = `${candidate.side}/${candidate.pose}/${candidate.view}/${candidate.face}/${candidate.flipX ? 1 : 0}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(candidate);
  };
  /** The rungs for one pose, from the asked-for view outwards. */
  const forPose = (posed, poseReason) => {
    const mirrorable = isPoseMirrorable(posed);
    const step = (v, viewReason) => {
      const reason = poseReason || viewReason;
      push({ side: wantSide, pose: posed, view: v, face: wantFace, flipX: false, fallback: reason || 'exact' });
      push({ side: wantSide, pose: posed, view: v, face: handFaceOpposite(wantFace), flipX: false, fallback: reason || 'face' });
      if (!mirrorable) return;
      // Flip the mirrored view: the same drawing, turned over.
      const mirrored = handViewMirror(v);
      push({ side: handSideOpposite(wantSide), pose: posed, view: mirrored, face: wantFace, flipX: true, fallback: reason || 'mirror' });
      push({ side: handSideOpposite(wantSide), pose: posed, view: mirrored, face: handFaceOpposite(wantFace), flipX: true, fallback: reason || 'mirror' });
    };
    step(wantView, null);
    if (wantView !== DEFAULT_HAND_VIEW) step(DEFAULT_HAND_VIEW, poseReason || 'view');
    // Then outwards along the row, nearest angle first: a set drawn only in
    // three-quarter serves a side request from the three-quarter beside it
    // rather than from the front (PHASE 28).
    const near = [...HAND_VIEWS].map((item) => item.id)
      .filter((id) => id !== wantView && id !== DEFAULT_HAND_VIEW)
      .sort((a, b) => Math.abs(handViewAngle(a) - handViewAngle(wantView)) - Math.abs(handViewAngle(b) - handViewAngle(wantView)));
    for (const id of near) step(id, poseReason || 'nearest');
  };
  forPose(wantPose, null);
  if (wantPose !== DEFAULT_HAND_POSE) forPose(DEFAULT_HAND_POSE, 'pose');
  return out;
}

/**
 * The drawing to show, and how it got chosen.
 *
 * ```js
 * { asset, pose, view, face, flipX, fallback, missing, exact }
 * ```
 *
 * `fallback` is the rung: `exact`, `face`, `mirror`, `view`, `nearest`, `pose`
 * or `missing`. `flipX` is the mirroring the choice implies and is **added to**
 * whatever flip the hand itself asks for, never a replacement for it.
 *
 * @param {object} library from `createHandAssetLibrary`
 * @param {{side?, pose?, view?, face?}} request
 * @param {{warn?: ?(report: object) => void}} options `warn` is called once per inexact resolution — the editor's missing-sprite notice (PHASE 49)
 */
export function resolveHandAsset(library, request = {}, { warn = null } = {}) {
  const set = library || EMPTY_HAND_LIBRARY;
  const wanted = {
    side: handSideId(request?.side),
    pose: handPoseId(request?.pose) || DEFAULT_HAND_POSE,
    view: handViewId(request?.view) || DEFAULT_HAND_VIEW,
    face: handFaceId(request?.face) || DEFAULT_HAND_FACE
  };
  for (const candidate of handAssetCandidates(wanted)) {
    const asset = set.at(candidate.side, candidate.pose, candidate.view, candidate.face);
    if (!asset) continue;
    // A drawing may opt out of being flipped even where its pose allows it.
    if (candidate.flipX && asset.mirrorable === false) continue;
    const report = {
      asset,
      pose: candidate.pose, view: candidate.view, face: candidate.face,
      flipX: candidate.flipX === true,
      fallback: candidate.fallback,
      exact: candidate.fallback === 'exact',
      missing: false,
      wanted
    };
    if (!report.exact && warn) warn(report);
    return report;
  }
  const report = { asset: null, ...wanted, flipX: false, fallback: 'missing', exact: false, missing: true, wanted };
  if (warn) warn(report);
  return report;
}

/**
 * The message a missing or substituted sprite deserves in development
 * (PHASE 49). One line, naming what was asked for and what was used.
 */
export function handAssetWarning(report = {}) {
  const { wanted = {} } = report;
  const asked = `pose=${wanted.pose} view=${wanted.view} side=${wanted.side}${wanted.face && wanted.face !== DEFAULT_HAND_FACE ? ` face=${wanted.face}` : ''}`;
  if (report.missing) return `Missing hand asset:\n${asked.split(' ').join('\n')}`;
  return `Missing hand asset: ${asked} — using ${report.pose}/${report.view}${report.flipX ? ' (mirrored)' : ''}`;
}

/* ── Cache (PHASE 48) ──────────────────────────────────────────────────────── */

/**
 * Resolutions, remembered.
 *
 * A hand asks the same question every frame and the answer only changes when
 * its pose or view does, so the ladder is walked once per distinct request and
 * never again. The library is immutable, which is what makes that safe; a new
 * set is a new cache.
 */
export function createHandAssetCache(library, { warn = null, limit = 256 } = {}) {
  const set = library || EMPTY_HAND_LIBRARY;
  const cache = new Map();
  return {
    library: set,
    resolve(request = {}) {
      const key = handAssetId({
        side: handSideId(request?.side),
        pose: handPoseId(request?.pose) || DEFAULT_HAND_POSE,
        view: handViewId(request?.view) || DEFAULT_HAND_VIEW,
        face: handFaceId(request?.face) || DEFAULT_HAND_FACE
      });
      let hit = cache.get(key);
      if (!hit) {
        hit = resolveHandAsset(set, request, { warn });
        // Warn once per distinct request, not once per frame.
        if (cache.size >= limit) cache.clear();
        cache.set(key, hit);
      }
      return hit;
    },
    clear() { cache.clear(); },
    get size() { return cache.size; }
  };
}

/* ── Preloading (PHASE 47) ─────────────────────────────────────────────────── */

/**
 * The drawings worth having ready: what the hand shows now, the views either
 * side of it, and the set's own fallback.
 *
 * A hand turning through the row reaches its neighbours next, so those are the
 * swaps that would otherwise flash. Everything else is loaded when it is asked
 * for — a set with eight poses in five views is forty drawings, and a mascot
 * that only ever waves needs three of them.
 */
export function handAssetsToPreload(library, states = [], { includePoses = [] } = {}) {
  const set = library || EMPTY_HAND_LIBRARY;
  const wanted = new Map();
  const add = (request) => {
    const report = resolveHandAsset(set, request);
    if (report.asset && !wanted.has(report.asset.id)) wanted.set(report.asset.id, report.asset);
  };
  for (const state of Array.isArray(states) ? states : [states]) {
    if (!state) continue;
    const base = { side: state.side, pose: state.pose, view: state.view, face: state.face };
    add(base);
    for (const view of handViewNeighbours(state.view)) add({ ...base, view });
    for (const pose of includePoses) add({ ...base, pose, view: DEFAULT_HAND_VIEW });
    add({ ...base, pose: DEFAULT_HAND_POSE, view: DEFAULT_HAND_VIEW });
  }
  return [...wanted.values()];
}
