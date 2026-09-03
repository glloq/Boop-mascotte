/**
 * Cartoon inertia (docs/HAND_RIGGING.md, "Inertia").
 *
 * A single critically-under-damped follower, not a physics engine:
 *
 * ```js
 * velocity += (target - position) * stiffness;
 * velocity *= damping;
 * position += velocity;
 * ```
 *
 * That is enough for the small lag, overshoot and settle that make a hand feel
 * alive. The same follower serves ears, antennae, simple hair, accessories and
 * a simple tail — and deliberately stops there.
 */

import { finite } from './numeric.js';

export const DEFAULT_INERTIA = Object.freeze({
  enabled: false, stiffness: 0.25, damping: 0.65, maxOvershoot: 0.35, followAmount: 1
});

/** Frame length the tuning constants are expressed against (60 fps). */
const REFERENCE_STEP = 1 / 60;

/**
 * @param {object} settings stiffness, damping, maxOvershoot, followAmount
 * @returns a follower with `step(target, dt)`, `reset(value)` and `value`
 */
export function createSpringFollower(settings = {}) {
  const config = { ...DEFAULT_INERTIA, ...settings };
  let position = 0;
  let velocity = 0;
  let started = false;
  return {
    get value() { return position; },
    get velocity() { return velocity; },
    reset(value = 0) { position = finite(value, 0); velocity = 0; started = true; return position; },
    /**
     * Advance towards `target`. `dt` is in seconds; the tuning constants are
     * expressed for 60 fps and rescaled, so the motion does not change
     * character when the frame rate does.
     */
    step(target, dt = REFERENCE_STEP) {
      const goal = finite(target, 0);
      if (!started) { position = goal; velocity = 0; started = true; return position; }
      // Long stalls (a hidden tab) must not launch the hand across the screen.
      const steps = Math.min(4, Math.max(1, Math.round(finite(dt, REFERENCE_STEP) / REFERENCE_STEP)));
      for (let i = 0; i < steps; i += 1) {
        velocity += (goal - position) * config.stiffness;
        velocity *= config.damping;
        position += velocity;
      }
      // Cap how far past the goal the spring may swing, in parameter units.
      // Without it a stiff setting can throw a hand off the artboard.
      const overshoot = position - goal;
      if (Math.abs(overshoot) > config.maxOvershoot) {
        position = goal + Math.sign(overshoot) * config.maxOvershoot;
        velocity *= 0.5;
      }
      return position;
    }
  };
}

/**
 * A follower per parameter name, created on demand.
 *
 * `followAmount` blends between the raw target and the lagging value, so the
 * effect can be dialled down without retuning the spring, and `enabled: false`
 * makes it a pass-through — inertia is always switchable off.
 */
export function createInertiaGroup(settings = {}) {
  const config = { ...DEFAULT_INERTIA, ...settings };
  const followers = new Map();
  return {
    reset() { followers.clear(); },
    configure(next) { Object.assign(config, next); followers.clear(); },
    /** @returns {Record<string, number>} the smoothed values, by parameter name */
    step(targets = {}, dt = REFERENCE_STEP) {
      const out = {};
      for (const [name, target] of Object.entries(targets)) {
        const goal = finite(target, 0);
        if (!config.enabled) { out[name] = goal; continue; }
        let follower = followers.get(name);
        if (!follower) { follower = createSpringFollower(config); follower.reset(goal); followers.set(name, follower); }
        const lagging = follower.step(goal, dt);
        out[name] = goal + (lagging - goal) * config.followAmount;
      }
      return out;
    }
  };
}

