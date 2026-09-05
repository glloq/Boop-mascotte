/**
 * Authoring an arrangement (VNX-29, docs/VNEXT_ROADMAP.md).
 *
 * `arrangement.js` decides what an arrangement *is*; this decides what an
 * author may do to one. Atomic, like every other command boundary here
 * (`core/puppet/handle-commands.js` is the pattern): one `history.snapshot()`
 * and one `store.execute` over the `arrangement` domain per gesture, so a drag
 * that ends is one undo step — and a gesture that changes nothing is none,
 * because Undo is a list of changes, not of attempts.
 *
 * A command that cannot name what it would change refuses with a reason and
 * touches neither the store nor the history: placing a clip the project no
 * longer has is a mistake to report to the author, not an empty Undo entry.
 *
 * The record still has the last word. Every command hands a list of candidates
 * to `normalizeArrangement` and keeps what comes back, so rounding, ordering,
 * and the rule that one clip cannot sit at one second twice are decided in one
 * place whether the placements came from a file or from a drag.
 */
import { normalizeArrangement, normalizePlacement } from './arrangement.js';

const samePlacements = (a, b) => a.length === b.length
  && a.every((item, index) => item.id === b[index].id && item.clipId === b[index].clipId && item.start === b[index].start);

/**
 * A readable id for a new placement, unique against the ones there.
 *
 * Deliberately the shape the record generates for a placement that arrives
 * without an id (`clipId@n`), so ids read the same whichever made them. The
 * record's own is positional, which is fine for a file read once and not for a
 * list an author keeps editing: `n` is the first free slot, so removing a
 * placement can never hand its id to the next one placed while it is still on
 * the timeline.
 */
export function arrangementPlacementId(clipId, taken = []) {
  const used = new Set(taken.map((item) => (typeof item === 'string' ? item : item?.id)));
  // One of `used.size + 1` candidates is always free.
  for (let index = 0; index <= used.size; index += 1) if (!used.has(`${clipId}@${index}`)) return `${clipId}@${index}`;
  return `${clipId}@${Date.now()}`;
}

export function createArrangementCommands(store, history) {
  const placementsOf = (document) => normalizeArrangement(document).placements;

  /**
   * One gesture: read, rewrite, normalize, and only then touch history.
   * @returns {boolean} whether anything actually changed
   */
  const commit = (type, change) => {
    const before = placementsOf(store.getDocument());
    const next = normalizeArrangement({ placements: change(before) });
    if (samePlacements(before, next.placements)) return false;
    history?.snapshot();
    store.execute({ type, domains: ['arrangement'], source: 'arrangement', apply: (document) => { document.arrangement = next; } });
    return true;
  };

  return {
    /**
     * Put a clip on the timeline at `start` seconds.
     * @returns {{ok: true, id: string, changed: boolean}|{ok: false, reason: string, message: string}}
     */
    place(clipId, start = 0) {
      const document = store.getDocument();
      const clip = (document.animationClips || []).find((item) => item?.id === clipId);
      // The same refusal shape as `handleCommands.create`: a reason for the
      // caller, a sentence for the author, and nothing written either way.
      if (!clip) return { ok: false, reason: 'no-clip', message: 'That motion is not in the project.' };
      const current = placementsOf(document);
      // Rounding and clamping are the record's, never a second copy of them.
      const candidate = normalizePlacement({ clipId, start });
      const existing = current.find((item) => item.clipId === candidate.clipId && item.start === candidate.start);
      // The record dedupes: the same clip at the same second is one placement,
      // because an author cannot see the difference. The command says so and
      // names the placement that is already there, rather than pretending.
      if (existing) return { ok: true, id: existing.id, changed: false };
      const id = arrangementPlacementId(candidate.clipId, current);
      commit('arrangement/place', (placements) => [...placements, { ...candidate, id }]);
      return { ok: true, id, changed: true };
    },

    /**
     * Drag one placement to another second. Dropped onto another placement of
     * the same clip at the same second, the two collapse into one — the record
     * says so — and the one the author dragged is the survivor, which is why it
     * goes to the front of the list the dedupe reads.
     */
    move(placementId, start) {
      const placement = placementsOf(store.getDocument()).find((item) => item.id === placementId);
      if (!placement) return { ok: false, reason: 'no-placement', message: 'That clip is no longer on the timeline.' };
      const moved = normalizePlacement({ ...placement, start });
      const changed = commit('arrangement/move', (placements) => [moved, ...placements.filter((item) => item.id !== placementId)]);
      return { ok: true, id: placementId, changed };
    },

    /** Take one placement off the timeline. The clip itself is untouched. */
    remove(placementId) {
      if (!placementsOf(store.getDocument()).some((item) => item.id === placementId)) {
        return { ok: false, reason: 'no-placement', message: 'That clip is no longer on the timeline.' };
      }
      commit('arrangement/remove', (placements) => placements.filter((item) => item.id !== placementId));
      return { ok: true, id: placementId, changed: true };
    },

    /** Empty the timeline in one gesture, and therefore in one undo step. */
    clear() {
      const removed = placementsOf(store.getDocument()).length;
      if (!removed) return { ok: false, reason: 'empty', message: 'There is nothing arranged yet.' };
      commit('arrangement/clear', () => []);
      return { ok: true, removed, changed: true };
    }
  };
}
