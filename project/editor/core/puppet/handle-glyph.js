/**
 * A control that looks like the thing it moves (docs/FACE_CONTROL_RIG.md).
 *
 * Every control on the mascot was the same blue dot with a different `title`
 * on it. Twenty-eight identical dots is a rig you read by hovering, one at a
 * time, and the one word that would have told you which is the tongue's and
 * which is the teeth's is the one word a pointer has to sit still to show.
 *
 * So a control carries a **picture of its own sub-part**, drawn from two
 * things it already has and no new schema:
 *
 * ```text
 *   role         what the picture is of   leftBrow → a brow, teeth → teeth
 *   controller   how the picture moves    a target aims it, a ring sizes it
 * ```
 *
 * Both are vocabularies the rig already speaks — roles come from the semantic
 * part registry and the controller is derived from the axes
 * (`handle-model.js`) — so nothing here recognizes a control by its id, and a
 * mascot whose mouth is called something else still gets a mouth.
 *
 * The picture is **live**: it is posed by the very axes the control drives, so
 * an eye's control shuts as the eye shuts and the teeth show on the button
 * that shows the teeth. That is the whole of the idea — a control that
 * demonstrates itself is a control nobody has to be told about.
 *
 * Pure: it reads a resolved handle and the live values and reports what to
 * draw; `ui/rig-controls/part-glyph.js` draws it.
 */
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// `|| 0` so that a movement sitting exactly at rest reads as 0 and never as
// -0, which is the same number and a different string in every assertion.
const round = (value) => (Math.round(number(value) * 100) / 100) || 0;

/**
 * Which picture each role of artwork gets.
 *
 * Keyed on the **role** the control sits on, which is the registry's own word
 * for what a piece of a face is (`part-registry.js`) — so the two sides of a
 * pair share one picture, an eyelid is drawn as the eye it covers, and a part
 * nobody has a picture for simply has none rather than a wrong one.
 */
export const GLYPH_FOR_ROLE = Object.freeze({
  head: 'head',
  leftEye: 'eye', rightEye: 'eye', leftUpper: 'eye', leftLower: 'eye', rightUpper: 'eye', rightLower: 'eye',
  leftPupil: 'pupil', rightPupil: 'pupil',
  leftBrow: 'brow', rightBrow: 'brow',
  nose: 'nose',
  mouth: 'mouth', cavity: 'mouth',
  teeth: 'teeth',
  tongue: 'tongue',
  jaw: 'jaw',
  hair: 'hair', hairTop: 'hair', hairBack: 'hair',
  leftEar: 'ear', rightEar: 'ear'
});

/** Every picture there is, for a surface that wants to offer the set. */
export const GLYPH_KINDS = Object.freeze([...new Set(Object.values(GLYPH_FOR_ROLE))]);

/**
 * How far one axis has been taken from rest, towards whichever end it went.
 *
 * Rest is the middle of the picture whatever the numbers are, so a movement
 * that runs 0 → 1 and one that runs 0.4 → 1.6 both read as "all the way" at
 * their own far end, and neither has to say what its range means.
 */
function toward(axis, values) {
  if (!axis) return 0;
  const value = clamp(number(values?.[axis.control], axis.rest), axis.min, axis.max);
  const span = value >= axis.rest ? axis.max - axis.rest : axis.rest - axis.min;
  return span > 0 ? clamp((value - axis.rest) / span, -1, 1) : 0;
}

/**
 * The picture this control should be drawn as, or `null` when it has none.
 *
 * `x`, `y` and `orbit` are **screen-wards**: they say how far the control has
 * been dragged right, down and round, not what the parameter reads. That is
 * what makes one picture serve every rig — a lid that closes on a drag down
 * closes on a drag down whether its movement counts up or down, and
 * `invertY` is the handle's own word for which of those it is.
 *
 * @param {object} handle a resolved handle (`resolveRigHandles`)
 * @param {Record<string, number>} [values] the live parameters
 * @returns {{kind, controller, x, y, orbit}|null}
 */
export function handleGlyph(handle, values = {}) {
  const kind = GLYPH_FOR_ROLE[handle?.role];
  if (!kind) return null;
  const y = toward(handle.y, values);
  return {
    kind,
    // How the control is operated decides what its picture does with the drag:
    // a target aims the part, a ring sizes it, everything else moves it.
    controller: handle.widget?.controller || handle.controller || null,
    x: round(toward(handle.x, values)),
    y: round(handle.invertY ? -y : y),
    orbit: round(toward(handle.orbit, values))
  };
}
