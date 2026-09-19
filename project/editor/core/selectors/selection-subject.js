/**
 * What is in hand — one answer, for every panel that wants to be contextual
 * (UX-50 PR 1, docs/UX50_ROADMAP.md).
 *
 * The session has held the selection in two halves for a long time:
 *
 * ```text
 * artwork    selectedId / selectedIds     a shape on the canvas
 * semantic   activeSemanticPartId         a part of the face
 * ```
 *
 * They met in exactly one place — a side effect inside `rig-panel.js`'s own
 * `render()` — so every other panel was blind to the canvas. The Movements
 * panel showed all twenty-six movements whatever was picked, and the parts
 * library opened on Eyes and stayed there while the author had a mouth
 * selected. Both are the same bug: a panel that cannot see the selection has
 * no choice but to show everything.
 *
 * This is the derivation they were missing. It is **pure** — document and
 * session in, a plain object out — it writes nothing, and it is not a store.
 * There is still one selection; this only reads it.
 *
 * ## Which half wins
 *
 * Three readings, in this order, and the order is the whole design:
 *
 * ```text
 * 1  the piece in hand IS a part      a role of one, or the group a library
 *                                     drawing was installed as → that part
 * 2  a part is active                                          → that part
 * 3  the piece in hand is drawn INSIDE a part                   → that part
 * ```
 *
 * The asset root belongs in the first reading and not the third, because
 * containment only looks *downwards*: it asks whether the piece is inside one
 * of a part's roles, and a library drawing's root is the group those roles are
 * inside. Installing a pair of eyes selects that root, and without this the
 * answer fell through to the active part — so choosing new eyes left the
 * library showing heads.
 *
 * **1 before 2** because clicking the mouth is the most direct thing an author
 * can do, and `activeSemanticPartId` is a derived value that lags a click by a
 * render — so a panel reading the active part alone would still be showing the
 * eyes after the mouth was picked.
 *
 * **2 before 3** because containment is generous to the point of being useless
 * on its own: everything drawn on a face is inside the head's group, so a
 * decoration, a highlight or a piece nobody has assigned yet all answer "the
 * head". Letting that outrank the active part would mean clicking a cloud
 * throws away the mouth you were working on. Below the active part it is
 * exactly right — it is the only answer available when there is no other.
 *
 * ## Nothing selected is an answer
 *
 * All three readings need something in hand. `activeSemanticPartId` on its own
 * is **not** a selection: `rig-panel.js` writes its own fallback back into the
 * session so its navigator has a row to highlight, which is why a freshly
 * loaded template reports `head` while the author has touched nothing at all.
 * A panel that trusted it showed the head's movements, and the parts library
 * opened on heads, in answer to a choice nobody made.
 *
 * So the active part counts only while the session *has* a selection —
 * `selectedId` is what every deliberate pick writes, from the canvas, the
 * navigator, the role checklist and the family strip alike. With none, this
 * answers `null`, and the panels show what they show when nothing is picked:
 * the families, and the library's own landing. Which is right: with nothing
 * selected, there is nothing to be contextual about.
 */
import { findSemanticPartByElement, findSemanticPartByRole } from '../../rig-editor/semantic-parts/part-model.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { BASIC_MOVEMENTS, MOVEMENT_BANDS } from '../../rig-editor/semantic-parts/face-movements.js';
import { FACE_PART_CATEGORIES } from '../face-library/face-part-model.js';

/**
 * The band a part of the face is filed under, for the panels that group by
 * what the face is *doing* rather than by which part carries it (UIR-08).
 *
 * Derived from the movement table, so a part that gains a movement is filed the
 * day it does. The parts with no movement at all — teeth, the mouth cavity, an
 * iris — are not absent from the face, so they take the band of the part they
 * are drawn inside rather than falling to Extra, where nobody would look.
 */
const BAND_BY_PART = Object.freeze({
  ...Object.fromEntries(BASIC_MOVEMENTS.map((entry) => [entry.part, entry.band])),
  // Artwork a movement never names, filed with the part it is drawn into.
  teeth: 'Mouth', mouthCavity: 'Mouth', lips: 'Mouth',
  leftIris: 'Eyes', rightIris: 'Eyes', iris: 'Eyes',
  accessory: 'Extra'
});

/** Which band a part of the face belongs to. Unknown parts are Extra. */
export const partBand = (partType) => BAND_BY_PART[partType] || 'Extra';

/** The library category that dresses a part of the face, or `null` for one it has no drawings for. */
export const partCategory = (partType) => FACE_PART_CATEGORIES.find((category) => category.part === partType)?.id || null;

/** What the registry calls a part, for a heading written about it. */
export const partLabel = (partType) => SEMANTIC_PART_REGISTRY[partType]?.displayName || partType || '';

/**
 * The parts of the face that share one band, so a band is a subject too: an
 * author who has an eyelid in hand is working on the eyes.
 */
export const partsInBand = (band) => Object.keys(BAND_BY_PART).filter((part) => BAND_BY_PART[part] === band);

/**
 * What the author has in hand.
 *
 * @param {object} document  ProjectDocument
 * @param {object} session   EditorSession
 * @returns {{
 *   kind: 'part',
 *   partId: string, partType: string, label: string, band: string,
 *   category: string|null, elementId: string|null, control: string|null,
 *   via: 'role'|'part'|'inside'
 * } | null}
 *   `null` when nothing in the selection names a part of the face. A caller
 *   that gets `null` should show its subject-less state — the families, the
 *   empty line — and never an inventory of everything.
 */
export function selectionSubject(document = {}, session = {}) {
  const parts = document?.semanticParts || {};
  const elementId = typeof session?.selectedId === 'string' && session.selectedId ? session.selectedId : null;
  // Nothing in hand, so nothing to be contextual about — whatever the rig
  // panel last wrote into `activeSemanticPartId` to give itself a default row.
  if (!elementId) return null;
  const real = (candidate) => (candidate && parts[candidate.id] ? parts[candidate.id] : null);
  // Only parts that still exist: a `selectedId` left over from a piece somebody
  // deleted, or an `activeSemanticPartId` from a project since replaced,
  // answers nothing rather than answering wrongly.
  const byRole = real(findSemanticPartByRole(document, elementId))
    || Object.values(parts).find((part) => part?.assetRoot === elementId) || null;
  const active = typeof session?.activeSemanticPartId === 'string' ? parts[session.activeSemanticPartId] || null : null;
  const inside = !byRole && !active ? real(findSemanticPartByElement(document, elementId)) : null;
  const part = byRole || active || inside;
  if (!part) return null;
  const control = typeof session?.activeControl === 'string' && session.activeControl ? session.activeControl : null;
  return {
    kind: 'part',
    partId: part.id,
    partType: part.type,
    label: part.name || partLabel(part.type),
    band: partBand(part.type),
    category: partCategory(part.type),
    elementId,
    // A movement only belongs to the subject when the subject is the part that
    // carries it. Selecting a mouth while the Inspector still held `browRaise`
    // would otherwise report a brow movement of the mouth.
    control: control && (part.controls || []).includes(control) ? control : null,
    via: byRole ? 'role' : active ? 'part' : 'inside'
  };
}

/**
 * The band in hand, for a panel that groups by band rather than by part.
 *
 * Separate from `selectionSubject` because it is the coarser question and some
 * panels only ever ask that one — and because it has an answer the subject does
 * not: `MOVEMENT_BANDS` is the closed set a band may be, and a caller filtering
 * by band wants to know it is filtering by a real one.
 */
export function selectionBand(document = {}, session = {}) {
  const subject = selectionSubject(document, session);
  return subject && MOVEMENT_BANDS.includes(subject.band) ? subject.band : null;
}
