/**
 * An arrangement read as subjects (VNX-29, docs/VNEXT_ROADMAP.md).
 *
 * The roadmap does not sketch a list of clips, it sketches rows:
 *
 * ```text
 *            0       1       2       3 sec
 * FACE       |- happy --------|
 * HEAD            |- nod -|
 * HAND R          |---- wave -----|
 * ```
 *
 * A row is a **subject** — the part of the mascot a clip is about — and no clip
 * declares one. So it is derived from what the clip actually writes: the
 * evaluator says which movements (`clipParameters`), and the catalogue says
 * whose they are (`controlMeta(parameter).group` — the author's own word for
 * the subject, the same word the timeline groups tracks by and the same one a
 * conflict is phrased in). Neither is re-derived here.
 *
 * WHY a sibling module rather than more of `arrangement.js`: that file is on
 * the document path — `createProjectDocument` calls `normalizeArrangement` for
 * every document there is — while lanes need the clip evaluator and the
 * presentation catalogue. Keeping them apart keeps normalization free of the
 * timeline's dependencies. `arrangement.js` is about the record; this is about
 * how the record is read.
 *
 * Pure, no DOM.
 */
import { arrangementPlacements } from './arrangement.js';
import { clipParameters } from './clip-conflicts.js';
import { CONTROL_CATALOG, controlMeta } from '../../ui/control-catalog.js';

/**
 * The catalogue's "no idea" bucket, asked for rather than spelled out: a
 * parameter with no id can never be in the table, so what comes back is the
 * fallback itself, and its group is whatever word the catalogue uses.
 */
const UNKNOWN = { group: controlMeta('').group, part: null };

/**
 * Down the body, in the catalogue's own declaration order, then the two hands
 * — whose groups are generated from the naming convention rather than declared
 * (VNX-34), so they are asked for here too instead of typed out.
 */
const SPINE = [...new Set([
  ...Object.values(CONTROL_CATALOG).map((meta) => meta.group),
  ...['handLX', 'handRX'].map((parameter) => controlMeta(parameter).group)
])];

/**
 * Where a subject sits among the lanes.
 *
 * A subject the catalogue declares keeps the catalogue's order; one it has
 * never heard of follows the spine, and the unknown bucket is always last,
 * because it is the one lane that says nothing about the mascot.
 */
export function laneRank(group) {
  const index = SPINE.indexOf(group);
  if (index > -1) return index;
  return group === UNKNOWN.group ? SPINE.length + 1 : SPINE.length;
}

const byLane = (a, b) => laneRank(a) - laneRank(b) || String(a).localeCompare(String(b));

/**
 * @typedef {object} ClipSubject
 * @property {string} group the author's word for the subject
 * @property {string|null} part the catalogue's part key, when it knows one
 * @property {string[]} parameters the movements the clip writes on it
 */

/**
 * The subjects a clip is about, the one it is most about first.
 *
 * Counted in movements, not in track keys: `clipParameters` asks the evaluator,
 * so a track with no keys counts exactly like a keyed one — it pins the
 * movement just as hard (see the header of `clip-conflicts.js`).
 *
 * TIE-BREAK — a clip that writes as much of one subject as of another: the
 * counts have said nothing, and nothing else about the clip is allowed to
 * decide, so the lane order does. Two reasons over the obvious alternative,
 * which is the clip's own track order: that order is something no author ever
 * sees (and the evaluator floats empty tracks to the front of it, so it is not
 * even the order the clip was written in), and it would let the unknown bucket
 * win a tie against a named subject. The lane order cannot, because the unknown
 * bucket is last — a clip is only ever filed under "Other" when nothing the
 * catalogue knows was tied with it.
 *
 * @param {object} clip
 * @returns {ClipSubject[]} never empty
 */
export function clipSubjects(clip) {
  const subjects = new Map();
  for (const parameter of clipParameters(clip)) {
    const meta = controlMeta(parameter);
    if (!subjects.has(meta.group)) subjects.set(meta.group, { group: meta.group, part: meta.part || null, parameters: [] });
    subjects.get(meta.group).parameters.push(parameter);
  }
  // A clip that writes nothing at all — no tracks, or no length for the
  // evaluator to read them over — is still something the author placed, so it
  // gets the unknown lane rather than disappearing from the arrangement.
  if (!subjects.size) return [{ ...UNKNOWN, parameters: [] }];
  return [...subjects.values()]
    .sort((a, b) => b.parameters.length - a.parameters.length || byLane(a.group, b.group));
}

/** `Left hand` → `left-hand`: a stable key for a row, not a label. */
const laneId = (group) => String(group).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lane';

/**
 * @typedef {object} ArrangementLane
 * @property {string} id stable row key: `head`, `left-hand`, `other`
 * @property {string} label the author's word for the subject — never a parameter id
 * @property {string|null} part the catalogue's part key, so a lane and the
 *   timeline's part filter (VNX-33) cannot disagree about what they mean
 * @property {object[]} placements what `arrangementPlacements` gives, in start
 *   order, each with the `subjects` its clip touches — `subjects[0]` is this
 *   lane, and a longer list means the clip reaches outside the row it is drawn on
 */

/**
 * The arrangement as rows, in a stable order, with nothing dropped.
 *
 * One lane per subject that has something in it: an arrangement of two face
 * clips is one row, not eight empty ones. A placement naming a clip the project
 * no longer has is already gone by here — `arrangementPlacements` filters it —
 * and everything that survives lands on exactly one lane.
 *
 * @param {object} document
 * @returns {ArrangementLane[]}
 */
export function arrangementLanes(document = {}) {
  const clips = new Map((document.animationClips || []).map((clip) => [clip?.id, clip]));
  const lanes = new Map();
  for (const placement of arrangementPlacements(document)) {
    const subjects = clipSubjects(clips.get(placement.clipId));
    const [lane] = subjects;
    if (!lanes.has(lane.group)) lanes.set(lane.group, { id: laneId(lane.group), label: lane.group, part: lane.part, placements: [] });
    lanes.get(lane.group).placements.push({ ...placement, subjects });
  }
  return [...lanes.values()].sort((a, b) => byLane(a.label, b.label));
}
