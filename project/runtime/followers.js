/**
 * Secondary motion (3D-10, docs/SECONDARY_MOTION.md).
 *
 * Hair, ears and the things hanging off a mascot do not arrive when the head
 * does. They trail a little, overshoot, and settle — and that lag is most of
 * what separates a rig that moves from a rig that is alive. The head turn
 * (`docs/HEAD_POSE_2_5D.md`) places every feature exactly where the projection
 * says it should be, every frame, which is correct and slightly dead.
 *
 * A **follower** is one element lagging one parameter:
 *
 * ```text
 * headX ────────────────► the head is here now
 *        ╲
 *         ╲ spring ─────► the hair still thinks it is here
 *          ╲
 *           displacement = (lagging − now) × amount
 * ```
 *
 * Two consequences worth stating, because they are what makes this safe to
 * leave switched on:
 *
 * * **at rest it is exactly zero.** The lag is a *difference*, so a head that
 *   is not moving displaces nothing at all — no drift, no bias, and a rig with
 *   followers renders identically to one without whenever it holds still;
 * * **it never authors anything.** This is render-time state in the engine, not
 *   a keyform: nothing about it reaches the document, and a runtime that
 *   ignores the block simply plays the movement without the trail.
 *
 * The spring is the one already tuned for hands (`inertia.js`) — the same
 * critically-under-damped follower, the same overshoot cap, the same rescaling
 * so the motion keeps its character when the frame rate changes. No physics
 * engine, no collisions, no cloth; the module that declines to add them is
 * `docs/FUTURE_OUT_OF_SCOPE.md`.
 */
import { finite } from './numeric.js';
import { createSpringFollower, DEFAULT_INERTIA } from './inertia.js';

/** How far a full unit of lag throws an element, in artwork units. */
export const DEFAULT_FOLLOWER_AMOUNT = Object.freeze({ x: 6, y: 4, rotation: 0 });

/**
 * The spring a follower uses when the rig does not tune one.
 *
 * Softer than a hand's (`stiffness 0.25`): a hand is being *carried* and has to
 * arrive, hair is being dragged and is allowed to be late. `maxOvershoot` is in
 * parameter units, and a head parameter runs −1…+1, so 0.5 is half a full turn
 * of swing past the mark — generous, and still short of the artwork leaving the
 * head it is drawn on.
 */
export const DEFAULT_FOLLOWER_INERTIA = Object.freeze({
  enabled: true, stiffness: 0.2, damping: 0.7, maxOvershoot: 0.5, followAmount: 1
});

const amountOf = (source) => ({
  x: finite(source?.x, DEFAULT_FOLLOWER_AMOUNT.x),
  y: finite(source?.y, DEFAULT_FOLLOWER_AMOUNT.y),
  rotation: finite(source?.rotation, DEFAULT_FOLLOWER_AMOUNT.rotation)
});

export function normalizeFollower(source = {}) {
  const inertia = { ...DEFAULT_FOLLOWER_INERTIA, ...(source?.inertia || {}) };
  return {
    element: typeof source?.element === 'string' ? source.element : '',
    enabled: source?.enabled !== false,
    parameterX: typeof source?.parameterX === 'string' && source.parameterX ? source.parameterX : 'headX',
    parameterY: typeof source?.parameterY === 'string' && source.parameterY ? source.parameterY : 'headY',
    amount: amountOf(source?.amount),
    inertia: {
      enabled: inertia.enabled !== false,
      stiffness: Math.max(0.01, finite(inertia.stiffness, DEFAULT_FOLLOWER_INERTIA.stiffness)),
      damping: Math.max(0, finite(inertia.damping, DEFAULT_FOLLOWER_INERTIA.damping)),
      maxOvershoot: Math.max(0, finite(inertia.maxOvershoot, DEFAULT_FOLLOWER_INERTIA.maxOvershoot)),
      followAmount: finite(inertia.followAmount, DEFAULT_INERTIA.followAmount)
    }
  };
}

/** The rig's followers, one per element, in declaration order. */
export function normalizeFollowers(rig = {}) {
  const seen = new Set();
  return (Array.isArray(rig?.followers) ? rig.followers : [])
    .map(normalizeFollower)
    .filter((follower) => {
      if (!follower.element || seen.has(follower.element)) return false;
      seen.add(follower.element);
      return true;
    });
}

/**
 * The stateful half: one spring pair per follower, stepped once per frame.
 *
 * `step` returns the *same* object every frame, mutated in place. The render
 * loop runs this sixty times a second on every element that has one, and a
 * fresh map of fresh points per frame is exactly the allocation
 * `docs/RUNTIME_PERFORMANCE.md` exists to keep out of it.
 *
 * @param {ReturnType<typeof normalizeFollowers>} records
 */
export function createFollowerGroup(records = []) {
  const entries = records.filter((record) => record.enabled && record.element).map((record) => ({
    record,
    x: createSpringFollower(record.inertia),
    y: createSpringFollower(record.inertia),
    offset: { x: 0, y: 0, rotation: 0 }
  }));
  const offsets = {};
  for (const entry of entries) offsets[entry.record.element] = entry.offset;

  return {
    get size() { return entries.length; },
    /**
     * Forget where everything was. The springs are rebuilt rather than zeroed:
     * a spring told it is at 0 while the head is held at +1 would swing across
     * on the next frame, and starting a preview must not look like a movement.
     * A fresh spring seeds itself from the first value it is given.
     */
    reset() {
      for (const entry of entries) {
        entry.x = createSpringFollower(entry.record.inertia);
        entry.y = createSpringFollower(entry.record.inertia);
        entry.offset.x = 0;
        entry.offset.y = 0;
        entry.offset.rotation = 0;
      }
    },
    /**
     * @param {Record<string, number>} values the parameters this frame
     * @param {number} dt seconds since the last frame; `0` holds what is on
     *   screen, which is what a recompile that is not a new frame wants
     * @returns {Record<string, {x: number, y: number, rotation: number}>}
     */
    step(values = {}, dt = 1 / 60) {
      if (!(dt > 0)) return offsets;
      for (const entry of entries) {
        const { record, offset } = entry;
        const nowX = finite(values[record.parameterX], 0);
        const nowY = finite(values[record.parameterY], 0);
        // The displacement is how far behind the follower is, not where it is:
        // a head that stops moving lets its hair catch up to exactly zero.
        const lagX = record.inertia.enabled ? entry.x.step(nowX, dt) - nowX : 0;
        const lagY = record.inertia.enabled ? entry.y.step(nowY, dt) - nowY : 0;
        offset.x = lagX * record.amount.x;
        offset.y = lagY * record.amount.y;
        // A swing reads as a rotation for anything long — a fringe, a ribbon —
        // and the horizontal lag is what swings it.
        offset.rotation = lagX * record.amount.rotation;
      }
      return offsets;
    }
  };
}
