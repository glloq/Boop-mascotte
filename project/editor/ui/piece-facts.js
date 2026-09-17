/**
 * What deleting a piece would cost (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §4.2).
 *
 * Delete is safe to do without asking, because a button takes it back --
 * except when it takes movements with it. A pair of eyes carries eight roles
 * across three parts, and taking that off the face is not the same act as
 * taking off a pair of glasses, so one is asked about and the other is not
 * (`ui/piece-actions.js`, `deleteConfirmation`).
 *
 * Counting that was the Character Builder's, which knew it from the face
 * library's visual rows. It is neither a library question nor a screen's
 * (V5-07): it is asked of every piece of every mascot, on every surface that
 * offers Delete, and it is answered from the document alone.
 */

/** An element and everything drawn inside it, from the layer tree. */
export function pieceSubtree(layers = [], id) {
  const inside = new Set();
  const gather = (item) => { inside.add(item.id); for (const child of item.children || []) gather(child); };
  const walk = (items) => { for (const item of items || []) { if (item.id === id) gather(item); else walk(item.children); } };
  walk(layers);
  // A piece with no row in the tree is still a piece: the artwork may hold it
  // without the document's copy of the tree having caught up.
  if (!inside.size && id) inside.add(id);
  return inside;
}

/**
 * How much of the rig stops working if this piece goes.
 *
 * Every role, in every part, that names this piece **or anything drawn inside
 * it** -- the roles live on the shapes, not on the group around them, so
 * reading only the piece's own id would answer zero for a pair of eyes.
 */
export function rolesOn(document = {}, id) {
  if (!id) return 0;
  const inside = pieceSubtree(document.layers, id);
  let roles = 0;
  for (const part of Object.values(document.semanticParts || {})) {
    for (const element of Object.values(part.roles || {})) if (element && inside.has(element)) roles += 1;
  }
  return roles;
}

/**
 * What hangs *on* this piece: a badge on a hood, a lens in a frame
 * (docs/FACE_PART_LIBRARY.md, "Hosted on a part"). It comes off with it.
 */
export function hostedOn(document = {}, id) {
  if (!id) return 0;
  const inside = pieceSubtree(document.layers, id);
  const parts = Object.entries(document.semanticParts || {});
  const hosts = new Set(parts.filter(([, part]) => part?.assetRoot && inside.has(part.assetRoot)).map(([partId]) => partId));
  if (!hosts.size) return 0;
  return parts.filter(([, part]) => part?.assetHost?.partId && hosts.has(part.assetHost.partId)).length;
}
