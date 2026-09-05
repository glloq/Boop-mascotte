/**
 * Several clips, arranged in time (VNX-29, docs/VNEXT_ROADMAP.md).
 *
 * The runtime has layered motions since V2: `playMotion(id, { layer: true })`
 * runs a clip alongside whatever is already playing, and the mixer resolves
 * them in start order. What was missing was any way to *see* that, or to author
 * it — the Timeline showed one clip's keys and nothing else, so the only way to
 * put a wave over a nod was to call the runtime from a page.
 *
 * An arrangement is therefore **editor-side authoring state and nothing more**.
 * It adds no runtime concept, no `rig.json` field and no schema bump: playing
 * one means starting each clip through the motion layer that already exists, at
 * the time the author put it. That is why it lives beside `semanticParts` and
 * `rigHandles` in the editor half of a snapshot, and why `vnext-contracts.test.js`
 * keeps proving the exported rig is byte-identical without it.
 *
 * Pure. It holds placements and answers questions about them; the timeline
 * draws them and the preview plays them.
 */

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 1000) / 1000;

/** A placement is a clip and the second it starts at. Nothing else is stored. */
export function normalizePlacement(candidate, index = 0) {
  const clipId = typeof candidate?.clipId === 'string' ? candidate.clipId.trim() : '';
  if (!clipId) return null;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `${clipId}@${index}`;
  return { id, clipId, start: Math.max(0, round(candidate.start)) };
}

/**
 * @param {object} candidate a document, or anything shaped like one
 * @returns {{placements: object[]}} always an object, never null: an empty
 *   arrangement and no arrangement are the same thing to everything downstream.
 */
export function normalizeArrangement(candidate = {}) {
  const source = candidate?.arrangement ?? candidate;
  const list = Array.isArray(source?.placements) ? source.placements : [];
  const seen = new Set();
  const placements = [];
  for (const [index, entry] of list.entries()) {
    const placement = normalizePlacement(entry, index);
    // Two placements of the same clip at the same second are one placement;
    // an author cannot see the difference and the runtime cannot either.
    const key = placement && `${placement.clipId}@${placement.start}`;
    if (!placement || seen.has(key)) continue;
    seen.add(key);
    placements.push(placement);
  }
  return { placements: placements.sort((a, b) => a.start - b.start || a.clipId.localeCompare(b.clipId)) };
}

/** Placements that still name a clip the project has, with their end times. */
export function arrangementPlacements(document = {}) {
  const clips = new Map((document.animationClips || []).map((clip) => [clip.id, clip]));
  return normalizeArrangement(document).placements
    .filter((placement) => clips.has(placement.clipId))
    .map((placement) => {
      const clip = clips.get(placement.clipId);
      return {
        ...placement,
        name: clip.name || clip.id,
        duration: number(clip.duration, 0),
        loop: Boolean(clip.loop),
        // A looping clip has no end: it runs until something stops it, which is
        // what the conflict model means by an open span.
        end: clip.loop ? Infinity : round(placement.start + number(clip.duration, 0))
      };
    });
}

/** How long the whole arrangement runs, ignoring loops, for a ruler. */
export function arrangementDuration(document = {}) {
  const ends = arrangementPlacements(document)
    .map((placement) => (placement.loop ? placement.start + placement.duration : placement.end));
  return ends.length ? round(Math.max(...ends)) : 0;
}
