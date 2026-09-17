/**
 * Turning `asset:<id>` into something a browser can paint, once per asset.
 *
 * It lives in the runtime rather than in the editor because both sides need
 * exactly this and the dependency only runs one way: the editor imports the
 * runtime, never the reverse. One resolver means the mascot in the editor and
 * the mascot in an export cannot disagree about what a reference points at
 * (docs/V4_ROADMAP.md, V4-015).
 *
 * **The paint path is synchronous, and that shapes the whole interface.**
 * Reading bytes out of a store is asynchronous; reconciling a canvas is not,
 * and cannot become so without making every frame a promise. So resolving is
 * split: `prime` is awaited before a frame is drawn, and `urlFor` is the
 * lookup the drawing itself does -- no await, no store, just a map. A miss at
 * paint time is answered with null rather than a promise, because null is
 * something the canvas can draw (nothing, or a placeholder) and a promise is
 * not.
 *
 * Every URL created is held exactly once and revoked on release. An object URL
 * that is never revoked is a copy of the picture kept alive for the life of
 * the document, which for a mascot's worth of assets is real memory.
 */
import { parseAssetRef } from './asset-reference.js';

export function createAssetResolver({
  store,
  createObjectURL = globalThis.URL?.createObjectURL?.bind(globalThis.URL),
  revokeObjectURL = globalThis.URL?.revokeObjectURL?.bind(globalThis.URL)
} = {}) {
  /** id -> object URL, for as long as something may paint it. */
  const held = new Map();
  /** Ids asked for that the store does not have: reported, not retried in a loop. */
  const absent = new Set();
  let hits = 0, misses = 0;

  const release = (id) => {
    const url = held.get(id);
    if (url === undefined) return false;
    held.delete(id);
    absent.delete(id);
    if (url !== null) revokeObjectURL?.(url);
    return true;
  };

  return {
    /**
     * Make these ids paintable. Awaited before a frame, never during one.
     *
     * Ids already held are not fetched again, and an id the store does not
     * have is remembered as absent so a canvas redrawing sixty times a second
     * does not ask sixty times a second.
     *
     * @returns {Promise<{ready: string[], missing: string[]}>}
     */
    async prime(ids = []) {
      const wanted = [...new Set([...ids].map((value) => parseAssetRef(value) ?? value).filter(Boolean))];
      const missing = [];
      await Promise.all(wanted.map(async (id) => {
        if (held.has(id)) { if (held.get(id) === null) missing.push(id); return; }
        const blob = await store?.get(id);
        if (!blob) { held.set(id, null); absent.add(id); missing.push(id); return; }
        held.set(id, createObjectURL ? createObjectURL(blob) : null);
      }));
      return { ready: wanted.filter((id) => held.get(id)), missing };
    },

    /**
     * What to paint for this reference, right now. Never waits.
     *
     * Takes either an id or a whole `asset:` reference, so a caller holding
     * an attribute value does not have to parse it first.
     */
    urlFor(reference) {
      const id = parseAssetRef(reference) ?? reference;
      const url = held.get(id) ?? null;
      if (url) hits += 1; else misses += 1;
      return url;
    },

    /** Whether this reference has been asked for and the store did not have it. */
    isMissing: (reference) => absent.has(parseAssetRef(reference) ?? reference),

    release,
    releaseAll() { for (const id of [...held.keys()]) release(id); },

    /**
     * Release everything the given references no longer mention.
     *
     * The counterpart to `prime`, and what keeps a long editing session from
     * holding a URL for every picture that was ever on the canvas.
     */
    retain(references = []) {
      const keep = new Set([...references].map((value) => parseAssetRef(value) ?? value));
      const dropped = [];
      for (const id of [...held.keys()]) if (!keep.has(id) && release(id)) dropped.push(id);
      return dropped;
    },

    stats: () => ({ held: held.size, missing: absent.size, hits, misses })
  };
}
