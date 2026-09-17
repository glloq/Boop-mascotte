/**
 * The speech layer's vocabulary (docs/VISEME_SYSTEM.md).
 *
 * ```text
 *   expression  ──┐
 *                 ├──▶  additive expression mixing  ──▶  semantic controls
 *   viseme      ──┘
 * ```
 *
 * A viseme is **not a drawing and not a mouth**. It is a handful of values for
 * the semantic controls the mouth already has — `mouthOpen`, `mouthWidth`,
 * `mouthRound`, `smile` — and it reaches the artwork through the very same
 * expression mixer a face does (`composeExpressionParams`). That is what makes
 * *happy + AE* a thing the rig can be: two weighted deltas from neutral,
 * summed, rather than one pose winning and the other being lost.
 *
 * So there is no viseme engine here, and deliberately no interpolator: this
 * module is the **vocabulary** — which visemes exist, what each one is called,
 * and the one naming rule that turns a viseme into the id of the expression
 * record that carries it. Everything that blends is `createWeightBlender`,
 * everything that composes is the mixer, and both already existed.
 *
 * Kept in the runtime rather than in the editor because the runtime is where a
 * lipsync would call from, and because the editor preview and the exported
 * mascot have to agree about what `AE` means down to the name.
 */

/**
 * The visemes, in mouth order: shut, then open, then rounded.
 *
 * Eight are the set a cartoon mouth needs to read as speaking; `WQ` is the
 * ninth and optional — a `w` is an `OO` that opens, and a mouth without it
 * loses nothing but a little crispness on *one* and *what*.
 *
 * | Key | The mouth |
 * | --- | --- |
 * | `REST` | at rest, lips together, nothing said |
 * | `MBP` | lips pressed shut — *m*, *b*, *p* |
 * | `FV` | lower lip up against the upper teeth — *f*, *v* |
 * | `AE` | open wide — *a*, *e* as in *cat*, *bed* |
 * | `EE` | wide and shallow, corners back — *ee*, *i* |
 * | `OH` | open and rounded — *o*, *aw* |
 * | `OO` | small and strongly rounded — *oo*, *u* |
 * | `L` | tongue up to the upper teeth — *l*, *n*, *d*, *t* |
 * | `WQ` | rounded and opening — *w*, *qu* |
 */
export const VISEME_KEYS = Object.freeze(['REST', 'MBP', 'FV', 'AE', 'EE', 'OH', 'OO', 'L', 'WQ']);

/** The eight a mouth needs; `WQ` is offered and never required. */
export const REQUIRED_VISEME_KEYS = Object.freeze(VISEME_KEYS.filter((key) => key !== 'WQ'));

/**
 * The id of the expression record that carries one viseme.
 *
 * Lower case and prefixed, so a viseme is findable in a project by name alone
 * and can never collide with a face an author called *AE*. The rule is here
 * and nowhere else: the editor installs under it and the runtime looks up
 * through it, which is the only reason `setViseme('AE')` can work on a rig the
 * runtime has never seen before.
 */
export const visemeExpressionId = (key) => `viseme-${String(key ?? '').trim().toLowerCase()}`;

/** `viseme-ae` → `AE`, and `null` for anything that is not a viseme's id. */
export function visemeKeyFromId(id) {
  const match = /^viseme-(.+)$/.exec(String(id ?? ''));
  if (!match) return null;
  const wanted = match[1].toLowerCase();
  return VISEME_KEYS.find((key) => key.toLowerCase() === wanted) || null;
}

/** Whether a string names one of the visemes, whatever its case. */
export const isVisemeKey = (key) => VISEME_KEYS.some((item) => item.toLowerCase() === String(key ?? '').toLowerCase());

/** The canonical spelling of a viseme key, or `null`. */
export const visemeKey = (key) => VISEME_KEYS.find((item) => item.toLowerCase() === String(key ?? '').toLowerCase()) || null;

/**
 * The weights one *transition* between two visemes asks for.
 *
 * `AE → OO` at 0.5 is half of each, which is the mouth halfway between the two
 * and **never** the mouth at rest: both deltas are live at once, and their sum
 * is the straight line from one to the other. Passing through REST is what a
 * pose-swapping speech layer does, and it is the one thing this cannot do —
 * REST is a viseme like any other and is only ever reached by being asked for.
 *
 * Returned as weights rather than applied, because what applies them is the
 * weight blender the expressions already ramp through.
 *
 * @param {string|null} previous the viseme being left
 * @param {string|null} next the viseme being reached
 * @param {number} blend 0 → entirely `previous`, 1 → entirely `next`
 * @returns {Record<string, number>} weights keyed by expression id
 */
export function visemeBlendWeights(previous, next, blend = 1) {
  const value = Number(blend);
  const t = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
  const from = visemeKey(previous), to = visemeKey(next);
  const weights = {};
  // One viseme sliding into itself is that viseme, at full weight: summing the
  // two halves would be right arithmetically and would read as a stutter every
  // time a lipsync repeated a sound.
  if (from && to && from === to) { weights[visemeExpressionId(to)] = 1; return weights; }
  if (from && 1 - t > 0) weights[visemeExpressionId(from)] = 1 - t;
  if (to && t > 0) weights[visemeExpressionId(to)] = t;
  return weights;
}
