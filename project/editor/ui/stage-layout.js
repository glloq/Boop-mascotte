/**
 * How much of the window the mascot gets (UX-60 PR 1–2, docs/SHELL_V2_AUDIT.md).
 *
 * The shell has always sized the *columns* and let the canvas take whatever was
 * left:
 *
 * ```text
 *   ┌──────────┬──────────────────────────┬──────────┐
 *   │  400px   │           1fr            │  320px   │
 *   └──────────┴──────────────────────────┴──────────┘
 * ```
 *
 * The columns are pixels and the canvas is `1fr`, so **every pixel a wider
 * monitor adds goes to the mascot**. Measured: 52 % of a 1280 window, and
 * 62–69 % of a 1920 one. A bigger screen bought a bigger face rather than more
 * room for the work, which is the inversion this module exists to end.
 *
 * `ui/panel-split.js` made it a rule rather than an accident — `CANVAS_SHARE =
 * 0.52` is a *floor* under the canvas, and no screen had a ceiling.
 *
 * So a screen may now declare what the stage is **for**, and the arithmetic
 * runs the other way round: the stage takes its share, and the columns take the
 * rest. On a 1920 window a `medium` stage is 672 px and the columns have 1248 px
 * to share, instead of 720 px of columns and a 1200 px face.
 *
 * ## What this is not
 *
 * It is not a second layout system. A mode with no `stage` goes through
 * `resolveSplit` exactly as before, which is what keeps the migration one
 * screen at a time (§33). It writes nothing to the document and nothing to
 * disk: where the author is standing is session state (§ invariants).
 *
 * ## Which screens have one, and why the rest wait
 *
 * A `stage` share sizes **the canvas column**, and that column is only the
 * mascot on the screens where the mascot is all it holds. On Behavior it holds
 * the *board* (#160, "the board is the workspace"), so sizing it as a stage
 * crushes the surface the screen is about -- which is exactly what happened
 * the first time this was wired for all fourteen screens at once, and what
 * `ux39-state-graph` caught.
 *
 * So the migrated set is the screens whose column is a mascot and nothing
 * else: Assemble, Hands, Assign, Controls, Expressions, Motions. The drawing
 * screens (Draw, Head 2.5D, Deform), the Timeline, Behavior and Preview keep
 * the old arithmetic until their own layout primitive lands, because each of
 * them wants something the share alone cannot express.
 */

/**
 * The stage sizes a screen can ask for, as a share of the window.
 *
 * Named rather than numeric because the names are the product decision and the
 * numbers are an implementation of it: "the mascot is small while you configure
 * its capabilities" survives a change of mind about whether small is 30 % or
 * 28 %, and a screen asking for `0.3` does not say why.
 *
 * ```text
 * mini      a corner of a board       Behavior, Timeline
 * small     beside a collection       Assemble, Hands, Expressions, Motions
 * medium    beside a control deck     Assign, Controls
 * large     the subject of the screen Draw, Deform, Head 2.5D
 * dominant  the point of the screen   Preview
 * ```
 */
export const STAGE_SIZES = Object.freeze({
  mini: 0.16,
  small: 0.30,
  medium: 0.35,
  large: 0.60,
  dominant: 0.78
});

/** A stage never shrinks below this, or it stops being a mascot and becomes a stamp. */
export const MIN_STAGE_PX = 240;

/**
 * How the stage behaves when the drawing does not fill it.
 *
 * ```text
 * down-only  shrink to fit, never grow past 1:1   configuration screens
 * preserve   the author's own zoom, remembered    drawing screens
 * fit        fill the stage, up or down           Preview
 * ```
 *
 * `down-only` is the fix for the measured 246 % on Design ▸ Hands: a pair of
 * hands blown up two and a half times on the screen that is about *choosing
 * which drawing they use*. Fitting upwards is a thing an author should ask for,
 * which is what the `Fit` button is (§5 of the brief).
 */
export const ZOOM_POLICIES = Object.freeze(['down-only', 'preserve', 'fit']);

/** A screen's stage declaration, with every field defaulted. */
export function stageFor(mode) {
  const stage = mode?.stage || null;
  const size = stage?.size && STAGE_SIZES[stage.size] ? stage.size : null;
  return {
    /** `null` means "this screen has not been migrated", and the old path runs. */
    size,
    share: size ? STAGE_SIZES[size] : null,
    position: stage?.position || 'right',
    autoZoom: ZOOM_POLICIES.includes(stage?.autoZoom) ? stage.autoZoom : 'preserve'
  };
}

/** Whether a screen sizes its stage the new way. */
export const hasStage = (mode) => Boolean(stageFor(mode).size);

/**
 * What the drawing should be scaled by, given the policy.
 *
 * `fitScale` is what the canvas already computes: the scale that makes the
 * artwork fill the stage. The policy decides whether to take it.
 *
 * @param {number} fitScale  what `Fit` would use
 * @param {number} current   the zoom now, for `preserve`
 * @param {string} policy
 * @returns {number} the scale to draw at
 */
export function autoScale(fitScale, current, policy = 'preserve') {
  const fit = Number(fitScale) > 0 ? Number(fitScale) : 1;
  if (policy === 'fit') return fit;
  if (policy === 'down-only') return Math.min(1, fit);
  const held = Number(current) > 0 ? Number(current) : null;
  return held ?? Math.min(1, fit);
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * The two column widths for a screen that declares a stage.
 *
 * The stage takes its share and the columns divide the rest **in the
 * proportion the screen asked for**, so a screen that wanted a wide list and a
 * narrow detail keeps that shape on every monitor instead of donating the
 * difference to the mascot.
 *
 * An author's drag still wins, and is still per screen: what it can no longer
 * do is starve the other column, because the pair is resolved together.
 *
 * @param {object} mode       a `MODES` entry carrying `stage` and `layout`
 * @param {number} available  the window's width
 * @param {object} [saved]    `{ left, right }` the author dragged on this screen
 */
export function columnsForStage(mode, available = 0, saved = {}) {
  const { share } = stageFor(mode);
  if (!share || !available) return null;
  const stage = clamp(Math.round(available * share), MIN_STAGE_PX, Math.round(available * 0.9));
  const budget = Math.max(0, available - stage);

  // Nullish rather than falsy, because **zero is an answer**: a control screen
  // asking for `right: 0` is saying its detail lives inside the deck rather
  // than in a third permanent column (§22), and `|| 300` would have given it
  // one anyway.
  const pick = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

  /**
   * A width the author dragged is a **width**, not a proportion.
   *
   * This read the saved pair as a ratio like the route's own, and a drag to
   * 500 px came back as 25: the ratio was computed against a column the author
   * had not touched, so the number they let go of was not the number they got.
   * A drag says "this side is this wide"; the other side takes the rest of the
   * task area, and the stage is not part of the bargain.
   */
  const dragged = { left: pick(saved?.left), right: pick(saved?.right) };
  if (dragged.left !== null || dragged.right !== null) {
    const side = dragged.left !== null ? 'left' : 'right';
    const held = clamp(dragged[side], 0, budget);
    return side === 'left'
      ? { left: held, right: budget - held, stage }
      : { left: budget - held, right: held, stage };
  }

  // Nothing dragged: the screen's own pair, read as the *shape* it wants.
  // `layout` keeps its pixels -- fourteen screens and a stylesheet speak it --
  // and the shape is what survives a change of monitor.
  const wanted = { left: pick(mode?.layout?.left) ?? 320, right: pick(mode?.layout?.right) ?? 300 };
  const total = wanted.left + wanted.right;
  if (!total) return { left: budget, right: 0, stage };
  const left = Math.round((budget * wanted.left) / total);
  return { left, right: budget - left, stage };
}

/**
 * How wide one column may be dragged, on a screen that declares a stage.
 *
 * `panel-split.js`'s own clamp measures against `minCanvas` -- the 52 % floor
 * under the canvas -- and on a staged screen that floor is exactly what the
 * stage share replaced. Worse, the splitter re-reads the *other* column on
 * every pointer move, so a clamp computed from a floor that no longer applies
 * shrank the budget on each step and a drag of a hundred pixels spiralled down
 * to twenty-five.
 *
 * The bound here is the task area itself: a column may take all of it but the
 * other column's floor, and the stage is never part of the bargain.
 */
export function clampStageColumn(mode, available = 0, width = 0, { floor = 200 } = {}) {
  const columns = columnsForStage(mode, available);
  if (!columns) return null;
  const budget = available - columns.stage;
  return clamp(Math.round(Number(width) || 0), 0, Math.max(0, budget - floor));
}
