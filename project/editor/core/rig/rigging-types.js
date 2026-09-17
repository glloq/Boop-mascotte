/**
 * How a piece moves, chosen when the piece is added
 * (V5-02, docs/V5_MASCOTTE_IMAGES_ETUDE.md).
 *
 * The editor already had this choice and kept it in the wrong place: a
 * `<select>` per movement, under Rig ▸ Advanced, offered *after* the piece was
 * assigned a role and a driver — `definition.strategies[control]` written by
 * `setMethod` (`rig-editor/semantic-parts/rig-panel.js`). That is the right
 * mechanism asked at the wrong moment, in the wrong words, about one movement
 * at a time.
 *
 * This is the same decision made once, about the piece, in the sentence an
 * author already has in their head when they drop a file: *what is this, and
 * how should it move?*
 *
 * Five, and not more. Each is one sentence that says nothing about shape keys,
 * bindings or meshes, because an author adding a picture of an arm should not
 * have to learn any of those to say "it swings".
 *
 * ```text
 * fixed    nothing        a shadow, a background
 * rigid    a transform    a body, a head, an arm
 * bend     a mesh         an ear, a cheek, a tail
 * states   a swap         eyelids, mouths, hands
 * outline  shape keys     eyes and mouths drawn as lines  (vector only)
 * ```
 *
 * Nothing here is new engine work: the first four are the transform bindings,
 * the Phase 7 mesh, the V5-01 state swap and the absence of a binding. Only
 * the *question* is new.
 */

/**
 * A picture's shape is its pixels, so nothing can reshape its outline — it has
 * none. Every other type works on both, because moving, bending and swapping
 * ask nothing of what a piece is drawn with.
 */
export const RIGGING_TYPES = Object.freeze([
  Object.freeze({ id: 'fixed', label: 'Does not move', hint: 'Drawn once and left there.', use: 'A shadow, a background, a badge.', raster: true, vector: true }),
  Object.freeze({ id: 'rigid', label: 'Moves as one piece', hint: 'Slides, turns, grows and fades, all in one.', use: 'A body, a head, an arm, an accessory.', raster: true, vector: true }),
  Object.freeze({ id: 'bend', label: 'Bends', hint: 'A grid of points over it that you pull.', use: 'A soft ear, a cheek, a tail, a mouth that stretches.', raster: true, vector: true }),
  Object.freeze({ id: 'states', label: 'Several drawings', hint: 'One shows at a time, and you say when.', use: 'Eyelids, mouth shapes, hand poses.', raster: true, vector: true }),
  Object.freeze({ id: 'outline', label: 'Its outline reshapes', hint: 'The line itself is redrawn between two shapes.', use: 'Eyes and mouths drawn as lines.', raster: false, vector: true })
]);

export const RIGGING_IDS = Object.freeze(RIGGING_TYPES.map((type) => type.id));
export const DEFAULT_RIGGING = 'rigid';

export const riggingType = (id) => RIGGING_TYPES.find((type) => type.id === id) || null;

/** Whether a picture can be rigged this way, and the reason when it cannot. */
export function riggingRefusal(id, nodeType = 'path') {
  const type = riggingType(id);
  if (!type) return `"${id}" is not a way a piece can move.`;
  if (nodeType === 'image' && !type.raster) return 'A picture has no outline to reshape — its shape is its pixels.';
  return '';
}

/**
 * What to offer for this piece, with the ones it cannot have marked rather
 * than dropped.
 *
 * An option that is absent reads as an option that is missing; an option that
 * is present with its reason reads as an answer. That is the same rule the
 * Inspector already follows for a `<select>` whose only entry would be
 * "nothing".
 */
export const riggingChoices = (nodeType = 'path') =>
  RIGGING_TYPES.map((type) => ({ ...type, allowed: !riggingRefusal(type.id, nodeType), refusal: riggingRefusal(type.id, nodeType) }));

/**
 * What a role usually wants, so the flow arrives with an answer rather than a
 * question.
 *
 * A proposal, never a decision: every one of these is a `<select>` the author
 * can change in the same breath. The roles are the registry's own
 * (`semantic-parts/part-registry.js`), so a piece named `oeil-gauche.png`
 * arrives with its role *and* its movement already filled in.
 */
const BY_ROLE = Object.freeze({
  mouth: 'states', leftEye: 'states', rightEye: 'states',
  leftUpper: 'states', leftLower: 'states', rightUpper: 'states', rightLower: 'states',
  leftPupil: 'rigid', rightPupil: 'rigid',
  hair: 'bend', hairTop: 'bend', hairBack: 'bend', leftEar: 'bend', rightEar: 'bend',
  head: 'rigid', jaw: 'rigid', nose: 'rigid', leftBrow: 'rigid', rightBrow: 'rigid'
});

export function suggestedRigging(role = '', nodeType = 'path') {
  const wanted = BY_ROLE[role] || DEFAULT_RIGGING;
  // A picture offered an outline it cannot have falls back to the nearest
  // thing that is true of it rather than to an error.
  return riggingRefusal(wanted, nodeType) ? DEFAULT_RIGGING : wanted;
}

/**
 * The rigging a piece ends up with: the one asked for when the piece can have
 * it, and the default when it cannot.
 *
 * Never throws and never leaves it unset. A piece with no answer is a piece
 * nothing knows how to move, and every element in a document has to be
 * movable — even if the answer is "not at all".
 */
export function normalizeRigging(value, nodeType = 'path') {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) return DEFAULT_RIGGING;
  return riggingRefusal(id, nodeType) ? DEFAULT_RIGGING : id;
}

/**
 * Where a piece's rigging and the rest of the document disagree.
 *
 * Reported, never repaired — the habit of every other model here. A piece that
 * says "several drawings" and has none is half-finished work, not a broken
 * file, and silently rewriting it to `rigid` would throw away the answer its
 * author already gave.
 *
 * Note what is deliberately **not** an issue: a piece whose rigging is
 * `states` is not also given a transform binding to remove. A state set reads
 * the parameters itself and chooses a drawing; nothing has to be unbound for
 * that to work, and the two compose — a mouth may swap its drawing *and* be
 * carried by a head that turns.
 *
 * @returns {{id: string, kind: string, detail: string}[]}
 */
export function riggingIssues(document = {}) {
  const issues = [];
  const elements = document?.elements || {};
  const sets = Array.isArray(document?.partStates) ? document.partStates : [];
  const targeted = new Set(sets.map((set) => set?.target).filter(Boolean));

  for (const [id, element] of Object.entries(elements)) {
    const rigging = element?.rigging;
    if (rigging === 'states' && !targeted.has(id)) {
      issues.push({ id, kind: 'states-without-drawings', detail: 'This piece is set to several drawings and has none yet.' });
    }
    if (rigging && riggingRefusal(rigging, element?.meta?.nodeType)) {
      issues.push({ id, kind: 'rigging-impossible', detail: riggingRefusal(rigging, element?.meta?.nodeType) });
    }
  }
  for (const set of sets) {
    if (!set?.target) continue;
    if (!elements[set.target]) { issues.push({ id: set.target, kind: 'drawings-without-piece', detail: 'These drawings belong to a piece that is no longer in the artwork.' }); continue; }
    if (elements[set.target].rigging !== 'states') {
      issues.push({ id: set.target, kind: 'drawings-not-used', detail: 'This piece has several drawings but is not set to use them.' });
    }
  }
  return issues;
}
