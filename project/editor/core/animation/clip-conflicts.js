/**
 * Two clips fighting over one movement (VNX-32).
 *
 * WHY this module exists — what the runtime does today, so the warning names a
 * real surprise rather than a hypothetical one:
 *
 * ```js
 * // createMotionLayer().layers(), runtime/runtime.js
 * out.push({ source: 'motion', mode: 'weightedOverride', weight, values: … });
 * // mixParameters(), runtime/mixer.js
 * else if (mode === 'weightedOverride' || weight !== 1) result[name] = current + (value - current) * weight;
 * ```
 *
 * Clips are emitted in start order and `weightedOverride` at a settled weight
 * of 1 is plainly `value`, so **the clip started last wins the parameter
 * outright** and the other clip's keys are dropped with nothing said. That is
 * deterministic, but it is invisible: nothing in the editor shows start order.
 *
 * This module decides nothing. It reports which movement, which clips, and the
 * span over which they really overlap; the resolutions an author may be offered
 * are in `CONFLICT_RESOLUTIONS`, each with an honest `supported` flag, because
 * three of the four the roadmap names cannot be honoured by the engine today.
 *
 * Pure functions, no DOM. The overlap is computed here; every question about
 * what a clip writes and what it is worth at a time goes to the shared
 * evaluator, never to a second copy of the interpolation.
 */
import { finite } from '../../../runtime/runtime.js';
import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
// Presentation metadata, no DOM: the one place that holds the author's word for
// a parameter. A conflict is only useful if it is phrased in those words.
import { controlMeta } from '../../ui/control-catalog.js';

/**
 * The four the roadmap sketches, and whether the runtime can actually do them.
 * `supported: false` is not a to-do list for this module — it is a warning to
 * whoever renders the buttons: offering one of these today would lie.
 */
export const CONFLICT_RESOLUTIONS = Object.freeze([
  Object.freeze({
    id: 'override', label: 'Override', supported: true,
    summary: 'One clip wins the movement outright.',
    detail: 'What the mixer already does. The winner is the clip mixed last, which is the clip started last, so choosing a different winner means changing the order the clips are played in — not the mixer.'
  }),
  Object.freeze({
    id: 'add', label: 'Add', supported: true,
    summary: 'The distance each clip keeps from neutral is added, not replaced.',
    detail: 'A clip carries `blend: "additive"` since VNX-31, and `createMotionLayer` emits the mixer mode from it, so the two contributions sum instead of the later one winning. Written only when it is not the default, so a rig full of ordinary clips is unchanged.'
  }),
  Object.freeze({
    id: 'blend', label: 'Blend', supported: false,
    summary: 'The clips average instead of one replacing the other.',
    detail: 'createWeightBlender holds any weight, but createMotionLayer.play always asks for 1, and a weight covers a whole clip rather than one movement. Honouring this needs a play weight, and a per-parameter one for a blend that is not all-or-nothing.'
  }),
  Object.freeze({
    id: 'priority', label: 'Priority', supported: false,
    summary: 'A declared rank decides, not start order.',
    detail: 'Clips carry no priority and the layer emits in insertion order. `priority` exists on reactions, where it decides which reaction may interrupt another — not how two clips combine.'
  })
]);

/** The resolution ids a panel may offer today. Deliberately short. */
export const SUPPORTED_RESOLUTIONS = Object.freeze(CONFLICT_RESOLUTIONS.filter((item) => item.supported).map((item) => item.id));

const clipsOf = (source) => Array.isArray(source) ? source : (source?.animationClips || []);
const nameOf = (clip) => typeof clip?.name === 'string' && clip.name.trim() ? clip.name.trim() : 'Untitled motion';

/**
 * Where each clip sits on one shared clock.
 *
 * The document has no multi-clip arrangement yet (VNX-29), so a clip that does
 * not declare a `start` is read as starting at 0 — which is what happens when
 * motions are layered from code: `playMotion(b, { layer: true })` starts b now,
 * beside whatever is already playing. A timeline that knows better should pass
 * its own placements; this is the fallback, not a schema.
 *
 * @param {object|object[]} source project document, or the clips themselves
 * @param {{clipId?: string, id?: string, start?: number, end?: number, loop?: boolean}[]} [placements]
 * @returns {{clip: object, id: string, name: string, start: number, end: number, index: number}[]}
 */
export function clipPlacements(source, placements) {
  const byId = new Map();
  for (const clip of clipsOf(source)) if (clip && typeof clip.id === 'string' && clip.id && !byId.has(clip.id)) byId.set(clip.id, clip);
  const requested = Array.isArray(placements)
    ? placements.map((entry) => ({ clip: byId.get(entry?.clipId ?? entry?.id) || null, at: entry }))
    : [...byId.values()].map((clip) => ({ clip, at: clip }));
  const placed = [];
  for (const { clip, at } of requested) {
    if (!clip) continue;
    // The evaluator returns nothing for a clip without a positive duration, so
    // such a clip writes nothing and can fight over nothing.
    const duration = finite(clip.duration, 0);
    if (!(duration > 0)) continue;
    const start = Math.max(0, finite(at?.start ?? at?.offset, 0));
    // A looping clip is never released by the motion layer, so with no explicit
    // end it writes for as long as it is playing.
    const looping = at?.loop === undefined ? Boolean(clip.loop) : Boolean(at.loop);
    const end = Math.max(start, finite(at?.end, looping ? Infinity : start + duration));
    placed.push({ clip, id: clip.id, name: nameOf(clip), start, end, index: placed.length });
  }
  return placed.sort((a, b) => a.start - b.start || a.index - b.index);
}

/**
 * The movements a clip writes.
 *
 * Asked of the evaluator rather than read off `clip.tracks`, because the two
 * differ: a track with no keys still writes the value underneath it (the
 * `defaults` pass at the end of `evaluateAnimationClip`), and that silent write
 * overrides an earlier clip exactly like a keyed one does.
 */
export function clipParameters(clip) {
  const names = Object.keys(clip?.tracks || {});
  return Object.keys(evaluateAnimationClip(clip, 0, Object.fromEntries(names.map((name) => [name, 0]))));
}

/** What a clip is worth on one movement, `at` seconds into the shared clock. */
function valueAt(placement, parameter, at) {
  return finite(evaluateAnimationClip(placement.clip, at - placement.start, { [parameter]: 0 })[parameter], 0);
}

/**
 * The stretches where two or more of `writers` are on screen together.
 *
 * A sweep over the span boundaries: every gap between two consecutive edges has
 * one fixed set of writers, and neighbouring gaps with the same set are one
 * conflict, not two. Spans are half-open — clips that only touch at an instant
 * do not overlap, the same rule `assignEdgeLanes` uses for its lanes.
 */
function overlapSegments(writers, minimumOverlap) {
  const edges = [...new Set(writers.flatMap((writer) => [writer.start, writer.end]))].sort((a, b) => a - b);
  const segments = [];
  for (let index = 0; index < edges.length - 1; index += 1) {
    const start = edges[index], end = edges[index + 1];
    const inside = writers.filter((writer) => writer.start <= start && writer.end >= end);
    if (inside.length < 2) continue;
    const previous = segments.at(-1);
    if (previous && previous.end === start && previous.writers.length === inside.length && previous.writers.every((writer, at) => writer === inside[at])) previous.end = end;
    else segments.push({ start, end, writers: inside });
  }
  return segments.filter((segment) => segment.end - segment.start > minimumOverlap);
}

/**
 * How far apart the clips actually are on this movement, at its worst.
 *
 * Two clips holding a movement at the same value do not visibly fight, so a
 * caller that wants to warn only about surprises can raise `minimumDivergence`.
 * Sampled at sub-interval midpoints: the endpoints belong to whichever clip is
 * arriving or leaving, and are not part of the overlap.
 */
function divergence(parameter, writers, start, end, samples = 8) {
  const span = Number.isFinite(end) ? end - start : Math.max(...writers.map((writer) => finite(writer.clip.duration, 0)));
  let worst = 0;
  for (let step = 0; step < samples; step += 1) {
    const values = writers.map((writer) => valueAt(writer, parameter, start + span * ((step + 0.5) / samples)));
    worst = Math.max(worst, Math.max(...values) - Math.min(...values));
  }
  return worst;
}

/** `tailSwish` → `Tail swish`. Mirrors how control-catalog names a hand pose it was never told about. */
const humanise = (id) => {
  const words = String(id).replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : String(id);
};

/**
 * The author's words for a movement — never the parameter id, not even for a
 * parameter the catalog has never heard of.
 *
 * @returns {{movement: string, group: string|null, part: string|null}}
 */
export function movementLabel(parameter) {
  const meta = controlMeta(parameter);
  const known = meta.label !== parameter;
  return {
    movement: known ? meta.label : humanise(parameter),
    // 'Other' is the catalog's "no idea" bucket. "on the other" helps nobody.
    group: known && meta.group && meta.group !== 'Other' ? meta.group : null,
    part: meta.part || null
  };
}

const secondsText = (value) => `${Number(value.toFixed(2))} s`;
const spanText = (start, end) => Number.isFinite(end) ? `from ${secondsText(start)} to ${secondsText(end)}` : `from ${secondsText(start)} on`;

/**
 * One line an author can act on. Names the movement and the clips; the
 * parameter id never appears, whatever the catalog knows about it.
 */
export function conflictMessage(conflict) {
  const names = conflict.clips.map((clip, index, all) =>
    all.some((other, at) => at !== index && other.name === clip.name) ? `${clip.name} (${secondsText(clip.start)})` : clip.name);
  const list = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const where = conflict.group ? ` on the ${conflict.group.toLowerCase()}` : '';
  return `${list} ${names.length === 2 ? 'both change' : 'all change'} "${conflict.movement}"${where}, ${spanText(conflict.start, conflict.end)}.`;
}

const withMessage = (conflict) => ({ ...conflict, message: conflictMessage(conflict) });

/**
 * @typedef {object} ClipConflict
 * @property {string} parameter the raw id — for the caller's plumbing, never for display
 * @property {string} movement the author's word for it
 * @property {string|null} group the body part it belongs to, when the catalog knows one
 * @property {string|null} part the catalog's part key, for a panel that wants to select it
 * @property {{id: string, name: string, start: number, end: number}[]} clips in start order; the last one wins today
 * @property {number} start seconds, on the shared clock
 * @property {number} end seconds, or Infinity while a looping clip keeps playing
 * @property {number} divergence the widest gap between the clips over that span
 * @property {readonly string[]} resolutions the ids a panel may honestly offer
 * @property {string} message one line, in the author's words
 */

/**
 * Every movement two or more clips write at the same time.
 *
 * Clips that write the same movement but never play together are not in
 * conflict; a tenth of a second together is. One conflict per stretch with a
 * fixed set of clips, so a third clip joining halfway is its own line — call
 * `mergeClipConflicts` for the one-warning-per-movement form.
 *
 * @param {object|object[]} source project document, or the clips themselves
 * @param {{placements?: object[], minimumOverlap?: number, minimumDivergence?: number}} [options]
 *   `placements` says what plays when (see `clipPlacements`); `minimumOverlap`
 *   is in seconds and exclusive, so 0 reports any real overlap;
 *   `minimumDivergence` drops clips that agree on the value anyway.
 * @returns {ClipConflict[]} in time order
 */
export function findClipConflicts(source, options = {}) {
  const { placements, minimumOverlap = 0, minimumDivergence = 0 } = options;
  const writersByParameter = new Map();
  for (const placement of clipPlacements(source, placements)) {
    for (const parameter of clipParameters(placement.clip)) {
      if (!writersByParameter.has(parameter)) writersByParameter.set(parameter, []);
      writersByParameter.get(parameter).push(placement);
    }
  }
  const conflicts = [];
  for (const [parameter, writers] of writersByParameter) {
    // One clip cannot fight itself: a placement is only ever compared with the
    // other placements, so a lone clip writing a movement is simply the author.
    if (writers.length < 2) continue;
    const label = movementLabel(parameter);
    for (const segment of overlapSegments(writers, Math.max(0, finite(minimumOverlap, 0)))) {
      const spread = divergence(parameter, segment.writers, segment.start, segment.end);
      if (spread < finite(minimumDivergence, 0)) continue;
      conflicts.push(withMessage({
        parameter, ...label,
        clips: segment.writers.map((writer) => ({ id: writer.id, name: writer.name, start: writer.start, end: writer.end })),
        start: segment.start, end: segment.end, divergence: spread, resolutions: SUPPORTED_RESOLUTIONS
      }));
    }
  }
  return conflicts.sort((a, b) => a.start - b.start || a.end - b.end || a.parameter.localeCompare(b.parameter));
}

/**
 * One warning per movement instead of one per stretch.
 *
 * The precise segments are the truth, but a panel usually wants the roadmap's
 * single line: every clip that touches the movement, over the whole span they
 * were in each other's way.
 *
 * @param {ClipConflict[]} conflicts
 * @returns {ClipConflict[]}
 */
export function mergeClipConflicts(conflicts = []) {
  const merged = new Map();
  for (const conflict of conflicts) {
    const existing = merged.get(conflict.parameter);
    if (!existing) { merged.set(conflict.parameter, { ...conflict, clips: [...conflict.clips] }); continue; }
    for (const clip of conflict.clips) if (!existing.clips.some((item) => item.id === clip.id && item.start === clip.start)) existing.clips.push(clip);
    existing.clips.sort((a, b) => a.start - b.start);
    existing.start = Math.min(existing.start, conflict.start);
    existing.end = Math.max(existing.end, conflict.end);
    existing.divergence = Math.max(existing.divergence, conflict.divergence);
  }
  return [...merged.values()].map(withMessage).sort((a, b) => a.start - b.start || a.parameter.localeCompare(b.parameter));
}
