/**
 * Which parts of a head trail behind it (3D-10, docs/SECONDARY_MOTION.md).
 *
 * The runtime knows how to make one element lag one parameter
 * (`runtime/followers.js`); this is the editor's answer to *which* elements,
 * and it comes from the semantic parts the author already assigned rather than
 * from a list they have to fill in. Hair and ears are the pieces a viewer
 * expects to be late; a nose is not, and a nose that lagged would read as the
 * face coming apart.
 *
 * The tuning is per role and deliberately small: the back of the hair is the
 * slowest and swings furthest, an ear barely lags at all. These are cartoon
 * numbers, not a simulation — the spring behind them is the one already tuned
 * for hands.
 */
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';

/**
 * `stiffness` is how fast the piece catches up, `amount` how far the lag
 * throws it in artwork units at a full turn's worth of lag. `rotation` is in
 * degrees and is left at zero for anything that is not long enough to read a
 * swing: a rotating ear looks broken, rotating hair looks alive.
 */
export const FOLLOWER_TUNING = Object.freeze({
  hair: Object.freeze({ stiffness: 0.2, amount: { x: 7, y: 4, rotation: 1.5 } }),
  hairTop: Object.freeze({ stiffness: 0.18, amount: { x: 6, y: 4, rotation: 1.2 } }),
  hairBack: Object.freeze({ stiffness: 0.15, amount: { x: 9, y: 5, rotation: 2 } }),
  leftEar: Object.freeze({ stiffness: 0.28, amount: { x: 3, y: 2, rotation: 0 } }),
  rightEar: Object.freeze({ stiffness: 0.28, amount: { x: 3, y: 2, rotation: 0 } })
});

const DAMPING = 0.7;

/**
 * The followers this project's artwork earns, in a stable order.
 *
 * Only roles the author has actually assigned, and only once per element: a
 * rig that draws its hair as one shape gets one follower, not three.
 */
export function suggestedFollowers(document = {}) {
  const seen = new Set();
  const followers = [];
  for (const part of Object.values(document.semanticParts || {})) {
    const roles = SEMANTIC_PART_REGISTRY[part.type]?.roles || [];
    for (const role of roles) {
      const elementId = part.roles?.[role];
      const tuning = FOLLOWER_TUNING[role];
      if (!elementId || !tuning || seen.has(elementId) || !document.elements?.[elementId]) continue;
      seen.add(elementId);
      followers.push({
        element: elementId,
        enabled: true,
        parameterX: 'headX',
        parameterY: 'headY',
        amount: { ...tuning.amount },
        inertia: { enabled: true, stiffness: tuning.stiffness, damping: DAMPING, maxOvershoot: 0.5, followAmount: 1 }
      });
    }
  }
  return followers;
}

/** Whether two follower lists say the same thing, so a no-op writes nothing. */
export function sameFollowers(a = [], b = []) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}
