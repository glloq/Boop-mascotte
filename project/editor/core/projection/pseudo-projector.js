/**
 * A pseudo-projector: one coherent virtual rotation behind the 2.5D head turn.
 *
 * The generated turn (docs/HEAD_POSE_2_5D.md) displaces every part linearly —
 * `translateX = headX · unit · depth`. That is parallax, and it reads well as
 * long as nothing has to agree with anything else. But nothing *swings*: both
 * eyes travel the same distance however far apart they are, the nose slides
 * instead of coming round, a feature never passes behind the axis, and a
 * diagonal is two independent slides added together.
 *
 * Here a feature is a point on a virtual volume instead: the artwork's (x, y)
 * plus a `depth` along a z axis that points at the viewer. A head pose turns
 * that volume — one rotation, yaw then pitch — and the projector reports where
 * the point landed, how much nearer or further it now is, and the size change
 * that follows from it. The near half of a face then travels further than the
 * far half because it is *further round the turn*, not because a constant says
 * so, and a feature past the axis comes out with a negative `virtualZ`.
 *
 * Trigonometry and nothing else: no camera, no projection matrix, no mesh, no
 * WebGL. The project's decision rule is "80–90 % of the cartoon result with a
 * much simpler solution" (docs/V2_ROADMAP.md), and a cosine is the simple
 * solution here — the thing it replaces is already three multiplications.
 *
 * Pure: no DOM, no state, no rounding (the caller owns its own precision).
 * This is baked into keyform cells at authoring time, once per cell; it must
 * never run per frame.
 */
import { clamp, finite } from '../../../runtime/numeric.js';

const RADIANS = Math.PI / 180;
const EPSILON = 1e-9;

/**
 * How far a full head pose turns the virtual volume, in degrees.
 *
 * **Yaw 30°, not 90°.** A camera would sweep as far as it likes; flat artwork
 * cannot. What is on screen is one drawing of a face, and every part of it is
 * foreshortened by `cos(yaw)`: at 30° the drawing keeps 87 % of its width,
 * which the existing head squash already accounts for, while `sin(yaw) = 0.5`
 * hands the deepest feature half of its virtual protrusion as travel — the most
 * parallax the same drawing can carry. Past ~35° the far eye's inward slide
 * exceeds a quarter of its offset and the face visibly folds; a real profile is
 * a second drawing, not a bigger angle. 30° is the cartoon three-quarter view:
 * the pose a model sheet draws, and the one an author expects at `headX = 1`.
 *
 * **Pitch 18°, which is 60 % of the yaw.** Exactly the ratio the current
 * generator carries as `VERTICAL_DEPTH = 0.6`: looking up or down reads mostly
 * through the outline, and overdoing it walks the mouth into whatever is drawn
 * above it. Keeping the ratio means switching to the projector does not
 * silently retune the vertical. (`sin(18°)/sin(30°)` is 0.62 rather than 0.60 —
 * the sine is what differs from a linear slide, and two percent of the vertical
 * travel is not a look.)
 */
export const HEAD_SWEEP = Object.freeze({ yaw: 30, pitch: 18 });

/**
 * The hard stop on a sweep, whatever strength asks for.
 *
 * Strength scales the *angle*, not the output, so a stronger turn stays a turn.
 * At 60° a flat drawing has lost half its width and the far half of the face is
 * folded onto the axis: nothing beyond that is a bigger turn, it is a broken
 * drawing.
 */
export const MAX_SWEEP = 60;

/**
 * How much a depth change reads as a size change, per unit of depth.
 *
 * **Not a perspective divide.** `d / (d − z)` needs a camera distance, which is
 * the one thing this project refuses to model; it has a pole, so it needs a
 * guard anyway; and its asymmetry is backwards for a cartoon — it makes what
 * approaches grow faster than what recedes shrinks, which is how a nose becomes
 * a fisheye. So: linear in the depth change, which is the divide's first-order
 * term (`d/(d−z) = 1 + z/d + O((z/d)²)`) with the camera distance folded into
 * one gain that is authored as a cartoon quantity rather than a lens.
 *
 * Two gains, because the far side must lose much more than the near side gains:
 * the same 1:3 the generator's own tuned constants carry (`NEAR_WIDEN 0.12`
 * against `FAR_NARROW 0.35`), and the far side compressing hard is the single
 * strongest cue there is. The kink between the two branches sits exactly where
 * the depth change is zero, which is the neutral pose — a sampled cell, never
 * a value interpolated between two of them.
 */
export const FORESHORTEN = Object.freeze({ near: 0.12, far: 0.35 });

/** The same limits the generator clamps a scale channel to. */
export const SCALE_LIMITS = Object.freeze({ min: 0.2, max: 3 });

const point = (value) => (value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))
  ? { x: Number(value.x), y: Number(value.y) } : null);

/** The middle of a measured box, in the shape the editor measures one. A plain point passes through. */
export function boxCentre(box) {
  if (!box) return null;
  const x = finite(box.x ?? box.left, NaN);
  const y = finite(box.y ?? box.top, NaN);
  const width = finite(box.width, NaN);
  const height = finite(box.height, NaN);
  if (![x, y, width, height].every(Number.isFinite)) return point(box);
  return { x: x + width / 2, y: y + height / 2 };
}

/**
 * `headX` / `headY` in −1…+1 → the angles of one turn, in **radians**.
 *
 * The parameter is not clamped, because head-pose axes are ordinary keyform
 * axes and may run wider than −1…+1; the resulting angle is, at `MAX_SWEEP`.
 *
 * `headY` grows downwards like every vertical parameter in the rig, and so does
 * the pitch: at `headY = +1` the head looks down and a nose drops.
 */
export function headAngles({ x = 0, y = 0, strength = 1, sweep = HEAD_SWEEP } = {}) {
  const push = clamp(finite(strength, 1), 0, 3);
  const swing = (value, degrees) => clamp(finite(value, 0) * finite(degrees, 0) * push, -MAX_SWEEP, MAX_SWEEP) * RADIANS;
  return {
    yaw: swing(x, sweep?.yaw ?? HEAD_SWEEP.yaw),
    pitch: swing(y, sweep?.pitch ?? HEAD_SWEEP.pitch)
  };
}

/**
 * How many artwork units one unit of `depth` is worth, given how far the
 * deepest feature should travel at a full turn.
 *
 * The generator already measures that travel (`headTurnUnit`, about 14 % of the
 * head's width) and it is the calibration a turn was tuned against, so the
 * projector is fed with it rather than inventing a length of its own. A feature
 * of depth 1 sitting on the axis then travels exactly `travel` at a full turn,
 * which is what the old formula gave it — the projection changes how that
 * travel is *distributed*, not how much there is.
 */
export function depthScaleForTravel(travel, { yaw = HEAD_SWEEP.yaw } = {}) {
  const swing = Math.abs(Math.sin(clamp(finite(yaw, HEAD_SWEEP.yaw), -MAX_SWEEP, MAX_SWEEP) * RADIANS));
  // A sweep of zero turns nothing, so there is no travel to distribute.
  return swing > EPSILON ? Math.abs(finite(travel, 0)) / swing : 0;
}

/**
 * Where one feature lands when the head turns.
 *
 * `x, y` are the feature's centre and `originX, originY` the head's centre of
 * rotation, both in artwork coordinates. `depth` is the semantic depth the
 * generator already holds — the nose sticks out at 1, an ear sits near the axis
 * at 0.15, something drawn behind the head is negative — and `depthScale` turns
 * it into artwork units. The default of 1 means "`depth` is already in artwork
 * units", which is what a property test wants; the generator passes
 * `depthScaleForTravel(unit)`.
 *
 * `yaw` and `pitch` are radians (`headAngles`). Positive yaw turns the head
 * towards the right of the screen, which is what brings its left side towards
 * the viewer; positive pitch looks down.
 *
 * @returns {{x: number, y: number, virtualZ: number, scale: number}} the
 *   projected centre in artwork coordinates, the signed depth it ended at, and
 *   the size change that follows from that depth change.
 */
export function projectPoint({
  x = 0, y = 0, depth = 0, originX = 0, originY = 0,
  yaw = 0, pitch = 0, depthScale = 1, foreshorten = FORESHORTEN
} = {}) {
  const ox = finite(originX, 0);
  const oy = finite(originY, 0);
  const dx = finite(x, 0) - ox;
  const dy = finite(y, 0) - oy;
  const unit = finite(depthScale, 1);
  const z = finite(depth, 0) * unit;

  const cosYaw = Math.cos(finite(yaw, 0));
  const sinYaw = Math.sin(finite(yaw, 0));
  const cosPitch = Math.cos(finite(pitch, 0));
  const sinPitch = Math.sin(finite(pitch, 0));

  // Yaw about the vertical axis: x and z turn into each other, y is untouched.
  const xYaw = dx * cosYaw + z * sinYaw;
  const zYaw = z * cosYaw - dx * sinYaw;
  // Then pitch about the horizontal axis, on what the yaw left standing. This
  // order (pitch ∘ yaw) is what makes a diagonal one rotation instead of two
  // slides: a feature already swung sideways has spent part of its depth, so it
  // has that much less left to lift. Adding two slides instead lifts it by its
  // whole resting depth — off by `(zYaw − z) · sin(pitch)`, which on the far ear
  // of a 200-wide face is fifteen pixels of the error the old formula carried.
  const yPitch = dy * cosPitch + zYaw * sinPitch;
  const virtualZ = zYaw * cosPitch - dy * sinPitch;

  // Measured from where the feature started, so the neutral pose is exactly the
  // artwork at every depth: no angle, no depth change, no scale.
  const moved = (virtualZ - z) / (Math.abs(unit) > EPSILON ? Math.abs(unit) : 1);
  const gain = moved >= 0
    ? Math.abs(finite(foreshorten?.near, FORESHORTEN.near))
    : Math.abs(finite(foreshorten?.far, FORESHORTEN.far));
  return {
    x: ox + xYaw,
    y: oy + yPitch,
    virtualZ,
    scale: clamp(1 + gain * moved, SCALE_LIMITS.min, SCALE_LIMITS.max)
  };
}

/**
 * The same projection as the sample a head-pose cell stores.
 *
 * The generator holds a measured centre (or a box), the head's centre, a depth,
 * the cell's `headX` / `headY`, a strength and the travel `unit`; what it needs
 * back is a translate and a scale. This is that, and nothing else: the carry
 * for a part drawn outside the head group, the far ear's fade, the near/far
 * horizontal narrowing and the rounding all stay where they are.
 *
 * Unmeasured artwork still works. With no centre the feature is treated as
 * sitting on the axis, where the projection reduces to `unit · depth · sin(yaw)`
 * — the old formula, so nothing that used to move stops moving.
 *
 * `scaleX` and `scaleY` are both the one `scale`, because this is the size
 * change of moving towards or away from the viewer and that is uniform. The
 * *horizontal* compression of a feature painted on a surface that turns away is
 * a different cue, and the generator already owns it (`NEAR_WIDEN`,
 * `FAR_NARROW`, `CENTRE_NARROW`); folding it in here would double-count it.
 *
 * @returns {{translateX: number, translateY: number, scale: number, scaleX: number,
 *            scaleY: number, virtualZ: number, x: number, y: number}}
 */
export function projectFeature({
  centre = null, box = null, origin = null, originBox = null,
  depth = 0, headX = 0, headY = 0, strength = 1, unit = 0,
  sweep = HEAD_SWEEP, foreshorten = FORESHORTEN
} = {}) {
  const measured = boxCentre(box) || point(centre);
  const axis = boxCentre(originBox) || point(origin) || measured || { x: 0, y: 0 };
  const from = measured || axis;
  const { yaw, pitch } = headAngles({ x: headX, y: headY, strength, sweep });
  const projected = projectPoint({
    x: from.x, y: from.y, depth, originX: axis.x, originY: axis.y,
    yaw, pitch, depthScale: depthScaleForTravel(unit, { yaw: sweep?.yaw ?? HEAD_SWEEP.yaw }), foreshorten
  });
  return {
    translateX: projected.x - from.x,
    translateY: projected.y - from.y,
    scale: projected.scale,
    scaleX: projected.scale,
    scaleY: projected.scale,
    virtualZ: projected.virtualZ,
    x: projected.x,
    y: projected.y
  };
}

/**
 * What a part has to write for itself, given what the part it is drawn inside
 * already does — the projected form of the subtraction the generator does on
 * depths (`carriedFrom`, docs/HEAD_POSE_2_5D.md: "nesting is subtracted, not
 * stacked"). Without it a pupil crosses the face while its socket stays put.
 *
 * Exact while the parent only translates, which is the case a group hierarchy
 * usually is; where the parent also scales, this leaves the second-order term
 * (the parent's scale acting on the child's own offset) on the table, in the
 * same spirit as everything else here. `virtualZ` is deliberately *not*
 * relative: draw order compares elements against each other, so it has to stay
 * the absolute depth this part ended at.
 */
export function relativeSample(sample, parent = null) {
  const own = sample || {};
  if (!parent) return { ...own };
  const ratio = (child, above) => (Math.abs(finite(above, 1)) > EPSILON ? finite(child, 1) / finite(above, 1) : finite(child, 1));
  return {
    ...own,
    translateX: finite(own.translateX, 0) - finite(parent.translateX, 0),
    translateY: finite(own.translateY, 0) - finite(parent.translateY, 0),
    scale: ratio(own.scale, parent.scale),
    scaleX: ratio(own.scaleX, parent.scaleX),
    scaleY: ratio(own.scaleY, parent.scaleY)
  };
}
