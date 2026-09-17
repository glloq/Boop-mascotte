/**
 * Graphical correctives for the eyes and the mouth (docs/FACE_SVG_STATES.md).
 *
 * ```text
 *   eyeOpen 0        already a shut eye, geometrically
 *      +
 *   closed corrective 1   the arc that makes it a *nice* shut eye
 * ```
 *
 * A corrective is **an additive shape key and nothing else** — the same record,
 * the same driver, the same stage of the pipeline (evaluation order 14,
 * docs/FACE_CONTROL_RIG.md §14). There is no corrective engine here: this
 * module is a *vocabulary* of slots plus the authoring operations that write
 * ordinary shape keys into them, so a panel has somewhere to put "capture this
 * shut eye" that the runtime already knows how to play back.
 *
 * ## A slot is a sentence about the controls, not a state
 *
 * The obvious design is one corrective per named state — one for `closed`, one
 * for `happyClosed`, one for `AE`, one for `OO`. It does not work, because a
 * viseme reaches the rig as *weighted deltas on the mouth's own movements*
 * (docs/VISEME_SYSTEM.md): by the time the artwork is posed there is no
 * "how much AE" left to read, and adding a parameter per viseme would be nine
 * new movements to buy what the mouth already says.
 *
 * So a slot carries an **activation sentence** over the semantic controls, and
 * corrects the geometry of *that combination* however it was reached — by a
 * viseme, by an expression, or by an author dragging the slider. `OO` and a
 * hand-puckered mouth get the same correction because they are the same mouth.
 *
 * The sentences are chosen to be **independent**: each is a distinct monomial
 * in the controls, so two correctives can never double-count the same shape.
 * `closed` is linear in `eyeOpen`, `closedCurve` is the `eyeCurve × eyeOpen`
 * cross-term, and a face carrying both is corrected once.
 *
 * Every one is 0 at rest, so a project with no correctives renders exactly as
 * it did — which is a property of the arithmetic rather than of a migration.
 */
import { createShapeKey, removeShapeKey, upsertShapeKey } from '../shape-keys/shape-key-model.js';
import { canParsePath, evaluateExpression, parsePath } from '../../../runtime/runtime.js';
import { VISEME_PRESETS, visemeKey } from './face-states.js';

/** Which side a corrective is for, spelled the way the rig spells it. */
const SIDES = Object.freeze({ left: 'Left', right: 'Right' });

/**
 * `sided` says the slot's sentence folds in a per-side offset. A mouth is one
 * closed path and has no sides to fold in — its two corners disagree through
 * pins instead (docs/FACE_CONTROL_RIG.md §12).
 */
const slot = (kind, id, name, hint, sentence, { sided = false } = {}) =>
  Object.freeze({ kind, id, name, hint, sentence, sided });

/**
 * What an eye's shape can be corrected along.
 *
 * Five sentences, five independent terms. The named states are combinations of
 * them rather than entries of their own:
 *
 * | State | Corrected by |
 * | --- | --- |
 * | `closed` | `closed` |
 * | `happyClosed` | `closed` + `closedCurve` |
 * | `squint` | `squint` |
 * | `tired` | `squint` + `curve` (negative) |
 * | `wide` | `wide` |
 *
 * `curve` and `closedCurve` are **signed**: the delta captured for an upward
 * arc is applied in reverse when the curve goes the other way, so one capture
 * serves a happy eye and a drooping one. That is the additive model doing what
 * it does with the template's own Smile and Frown keys.
 */
export const EYE_CORRECTIVE_SLOTS = Object.freeze([
  slot('eye', 'closed', 'Closed', 'The shape of the shut seam.', (side) => `1 - eyeOpen${side ? ` - eyeOpen${side}` : ''}`, { sided: true }),
  slot('eye', 'squint', 'Narrowed', 'The lid narrowed from below.', (side) => `eyeSquint${side ? ` + eyeSquint${side}` : ''}`, { sided: true }),
  slot('eye', 'curve', 'Lid curve', 'The lid arcing up, or drooping down.', (side) => `eyeCurve${side ? ` + eyeCurve${side}` : ''}`, { sided: true }),
  slot('eye', 'closedCurve', 'Closed curve', 'The arc of a *shut* eye — a happy squeeze.',
    (side) => (side ? `(eyeCurve + eyeCurve${side}) * (1 - eyeOpen - eyeOpen${side})` : 'eyeCurve * (1 - eyeOpen)'), { sided: true }),
  // The lids pulling back as the pupils dilate. `eyeOpen` rests at its maximum
  // and the drawing *is* that maximum, so there is no room above it for a
  // "wider than open" sentence; what widens a cartoon eye is the pupil.
  slot('eye', 'wide', 'Wide', 'The lids pulled back as the pupils dilate.',
    (side) => (side ? `pupilScale + pupilScale${side} - 1` : 'pupilScale - 1'), { sided: true })
]);

/**
 * What a mouth's shape can be corrected along.
 *
 * Eight sentences, and the visemes map onto them: `AE` is `open` and the
 * `openWide` cross-term, `OO` is `round`, `OH` is `round` and `openRound`,
 * `EE` is `openWide`, `MBP` is `lock`, `FV` is `lipTeeth`, `L` is
 * `tongueTeeth`. None of them names a viseme, which is exactly why a mouth
 * puckered by hand comes out as round as one puckered by `OO`.
 *
 * `smile` and `wide` are signed, so one capture corrects a grin and a grimace.
 */
export const MOUTH_CORRECTIVE_SLOTS = Object.freeze([
  slot('mouth', 'open', 'Open', 'The cavity of an open mouth.', () => 'mouthOpen'),
  slot('mouth', 'round', 'Round', 'The aperture puckered into an O.', () => 'mouthRound'),
  slot('mouth', 'smile', 'Smile', 'The lip line of a smile, or a frown.', () => 'smile'),
  slot('mouth', 'wide', 'Wide', 'The lip line stretched, or drawn in.', () => 'mouthWidth'),
  slot('mouth', 'openRound', 'Open and round', 'An O that is also open — the two together.', () => 'mouthOpen * mouthRound'),
  slot('mouth', 'openWide', 'Open and wide', 'A wide opening — the two together.', () => 'mouthOpen * mouthWidth'),
  slot('mouth', 'lock', 'Lips pressed', 'Lips held together against the jaw.', () => 'mouthLock'),
  // The teeth showing while the lips are nearly shut, which is what an `f` is.
  slot('mouth', 'lipTeeth', 'Lip on teeth', 'The lower lip tucked under the upper teeth.', () => 'teeth - teeth * mouthOpen'),
  // The tongue up rather than merely out: `tongueY` is negative upwards.
  slot('mouth', 'tongueTeeth', 'Tongue at the teeth', 'The tongue raised against the upper teeth.', () => '0 - tongue * tongueY')
]);

export const FACE_CORRECTIVE_SLOTS = Object.freeze([...EYE_CORRECTIVE_SLOTS, ...MOUTH_CORRECTIVE_SLOTS]);

/** One slot by kind and id, or `null`. */
export const correctiveSlot = (kind, id) => FACE_CORRECTIVE_SLOTS.find((item) => item.kind === kind && item.id === id) || null;

/** The slots of one kind, in catalogue order. */
export const correctiveSlotsFor = (kind) => FACE_CORRECTIVE_SLOTS.filter((item) => item.kind === kind);

function requiredSlot(kind, id) {
  const found = correctiveSlot(kind, id);
  if (!found) throw new Error(`Unknown ${kind} corrective "${id}".`);
  return found;
}

/**
 * The id of the shape key that carries one corrective.
 *
 * Prefixed and colon-separated like the head pose's own generated keyforms
 * (`headPose:…`), so a corrective is findable by name and can never collide
 * with a shape key an author made.
 */
export function faceCorrectiveId({ kind, slot: slotId, side = null, target = null } = {}) {
  const parts = ['faceState', kind, slotId];
  if (side) parts.push(side);
  // Several elements can carry the same slot -- an eye has two lids -- so the
  // target is part of the identity rather than a collision.
  if (target) parts.push(target);
  return parts.join(':');
}

/** The sentence one slot is driven by, on one side. */
export function correctiveExpression(kind, slotId, side = null) {
  const found = requiredSlot(kind, slotId);
  return found.sentence(found.sided && side ? SIDES[side] || null : null);
}

/**
 * How strongly one slot is switched on by a set of control values.
 *
 * The slot's own sentence, evaluated — so a panel can say which correctives a
 * viseme or an expression actually reaches, instead of listing all nine and
 * leaving an author to work it out. Reads the runtime's evaluator, not a copy
 * of it, which is why an unknown control reads 0 here exactly as it does in a
 * frame.
 */
export const correctiveActivation = (kind, slotId, values = {}, side = null) =>
  evaluateExpression(correctiveExpression(kind, slotId, side), values);

/** The slots one set of control values reaches, strongest first. */
export function activeCorrectiveSlots(kind, values = {}, { side = null, epsilon = 1e-3 } = {}) {
  return correctiveSlotsFor(kind)
    .map((item) => ({ ...item, activation: correctiveActivation(kind, item.id, values, side) }))
    .filter((item) => Math.abs(item.activation) > epsilon)
    .sort((a, b) => Math.abs(b.activation) - Math.abs(a.activation));
}

/** Which correctives a viseme reaches, for the authoring panel's readout. */
export const visemeCorrectiveSlots = (key) => {
  const preset = VISEME_PRESETS.find((item) => item.id === visemeKey(key));
  return preset ? activeCorrectiveSlots('mouth', preset.controls) : [];
};

/* ── Reading what a project has ───────────────────────────────────────────── */

/** Every corrective in a project, newest last, as the shape keys they are. */
export const faceCorrectives = (document = {}) =>
  (document?.shapeKeys || []).filter((key) => key?.faceState && correctiveSlot(key.faceState.kind, key.faceState.slot));

/** The correctives of one slot — one per element it was captured on. */
export const faceCorrectivesForSlot = (document = {}, { kind, slot: slotId, side = null } = {}) =>
  faceCorrectives(document).filter((key) => key.faceState.kind === kind && key.faceState.slot === slotId
    && (key.faceState.side || null) === (side || null));

/** One corrective by its full identity, or `null`. */
export const findFaceCorrective = (document = {}, identity = {}) =>
  faceCorrectives(document).find((key) => key.id === faceCorrectiveId(identity)) || null;

/* ── Authoring ────────────────────────────────────────────────────────────── */

/**
 * Capture a corrective from a posed outline.
 *
 * Refuses rather than throws, and refuses **before touching the project**: the
 * delta is built by `createShapeKey`, which compares the two paths' command
 * layouts and reports a mismatch (docs/SHAPE_KEYS.md). The original `d` is
 * never written anywhere by this function, so a refused capture leaves the
 * base artwork byte for byte as it was.
 *
 * @param {object} document the project, mutated only on success
 * @param {object} options
 * @param {'eye'|'mouth'} options.kind
 * @param {string} options.slot one of the kind's slots
 * @param {'left'|'right'|null} [options.side] for an eye's own lid
 * @param {string} options.target the element the corrective deforms
 * @param {string} options.restPath the element's authored outline
 * @param {string} options.posePath the outline as the author shaped it
 * @param {number} [options.weight] 0 → off, 1 → the capture in full
 * @param {string} [options.name] what to call it in the shape key list
 * @returns {{ok: true, shapeKey: object} | {ok: false, reason: string, message: string}}
 */
export function captureFaceCorrective(document, {
  kind, slot: slotId, side = null, target, restPath, posePath, weight = 1, name = null
} = {}) {
  const found = correctiveSlot(kind, slotId);
  if (!found) return { ok: false, reason: 'unknown-slot', message: `There is no ${kind} corrective called "${slotId}".` };
  if (!target) return { ok: false, reason: 'missing-target', message: 'Choose the artwork this corrective reshapes.' };
  if (side && !SIDES[side]) return { ok: false, reason: 'unknown-side', message: `"${side}" is not a side of the face.` };
  const base = typeof restPath === 'string' && restPath.trim() ? restPath : document?.elements?.[target]?.restPath;
  if (!canParsePath(base)) {
    return { ok: false, reason: 'unparsable-rest', message: 'The base shape is not an outline this editor can deform. Convert it to a path first.' };
  }
  if (!canParsePath(posePath)) {
    return { ok: false, reason: 'unparsable-pose', message: 'Corrective geometry is incompatible with the base path topology.' };
  }
  const id = faceCorrectiveId({ kind, slot: slotId, side, target });
  const created = createShapeKey({
    id, target, name: name || `${found.name}${side ? ` · ${side}` : ''}`,
    restPath: base, posePath,
    driver: {
      mode: 'expression', expression: correctiveExpression(kind, slotId, side), curve: 'linear',
      amplitude: correctiveWeight(weight), offset: 0
    }
  });
  if (!created.ok) {
    // One message for both ways a capture can be the wrong shape, because they
    // are one problem to whoever is holding the mouse: the outline they posed
    // is not the outline that is there.
    return created.reason === 'topology-mismatch'
      ? { ok: false, reason: 'topology-mismatch', message: 'Corrective geometry is incompatible with the base path topology. Move the existing points instead of adding or removing any, then capture again.' }
      : created;
  }
  const shapeKey = { ...created.shapeKey, faceState: { kind, slot: slotId, ...(side ? { side } : {}) } };
  document.shapeKeys = upsertShapeKey(document.shapeKeys || [], shapeKey);
  // The base outline is *recorded*, not replaced: a shape key needs its
  // element's rest path to add a delta to, and an element that has never
  // carried one has nothing to be corrected from.
  if (document.elements?.[target] && !document.elements[target].restPath) document.elements[target].restPath = base;
  return { ok: true, shapeKey: findFaceCorrective(document, { kind, slot: slotId, side, target }) || shapeKey };
}

const correctiveWeight = (value) => {
  const number = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(number) ? number : 1));
};

/** How far a corrective is turned up, 0 … 1. */
export const faceCorrectiveWeight = (shapeKey) => correctiveWeight(shapeKey?.driver?.amplitude ?? 1);

/** Turn one corrective up or down without recapturing it. */
export function setFaceCorrectiveWeight(document, identity = {}, weight = 1) {
  const existing = findFaceCorrective(document, identity);
  if (!existing) throw new Error('That corrective has not been captured yet.');
  document.shapeKeys = upsertShapeKey(document.shapeKeys, {
    ...existing, driver: { ...existing.driver, amplitude: correctiveWeight(weight) }
  });
  return findFaceCorrective(document, identity);
}

/**
 * Forget one corrective.
 *
 * The element keeps its `restPath`, because that is the artwork as drawn and
 * other keys may be adding to it; what goes is the delta and its driver, so
 * the state falls back to the plain composition of its controls.
 */
export function removeFaceCorrective(document, identity = {}) {
  const id = faceCorrectiveId(identity);
  const before = (document.shapeKeys || []).length;
  document.shapeKeys = removeShapeKey(document.shapeKeys || [], id);
  return (document.shapeKeys || []).length !== before;
}

/** Every corrective of one slot, gone in one step. */
export function clearFaceCorrectives(document, { kind, slot: slotId, side = null } = {}) {
  const wanted = faceCorrectivesForSlot(document, { kind, slot: slotId, side }).map((key) => key.id);
  if (!wanted.length) return 0;
  document.shapeKeys = (document.shapeKeys || []).filter((key) => !wanted.includes(key.id));
  return wanted.length;
}

/**
 * Copy an eye's correctives onto the other eye.
 *
 * `peer` says which element the other side draws with, because only the
 * project knows that — an eye's upper lid is `lidUpperLeft` on one side and
 * `lidUpperRight` on the other, and no rule this module could hold would know
 * that for a mascot somebody else drew.
 *
 * The delta is copied as it is rather than reflected: two eyelids drawn as
 * mirrors of each other take the same delta, and `mirror: true` is for the
 * case where they are not (see `mirrorFaceCorrective`).
 *
 * @returns {{copied: number, skipped: {id: string, reason: string}[]}}
 */
export function copyFaceCorrectives(document, { kind = 'eye', from, to, peer = (target) => target, mirror = false } = {}) {
  if (!SIDES[from] || !SIDES[to]) throw new Error('Copying a corrective needs a side to copy from and one to copy to.');
  if (from === to) throw new Error('That is the same side.');
  const copied = [];
  const skipped = [];
  for (const source of faceCorrectives(document).filter((key) => key.faceState.kind === kind && key.faceState.side === from)) {
    const target = peer(source.target) || source.target;
    if (!document.elements?.[target]) { skipped.push({ id: source.id, reason: 'no-peer' }); continue; }
    const rest = document.elements[target].restPath;
    if (!canParsePath(rest)) { skipped.push({ id: source.id, reason: 'missing-rest' }); continue; }
    // The two outlines have to be the same shape of outline, or the delta
    // means nothing on the other eye: the same refusal the capture makes, made
    // before anything is written.
    if (source.delta.length !== pathValueCount(rest)) { skipped.push({ id: source.id, reason: 'topology-mismatch' }); continue; }
    const id = faceCorrectiveId({ kind, slot: source.faceState.slot, side: to, target });
    document.shapeKeys = upsertShapeKey(document.shapeKeys || [], {
      ...source, id, target,
      name: source.name.replace(new RegExp(`${from}$`), to),
      faceState: { ...source.faceState, side: to },
      driver: { ...source.driver, expression: correctiveExpression(kind, source.faceState.slot, to) },
      delta: mirror ? mirrorDelta(source.delta) : [...source.delta]
    });
    copied.push(id);
  }
  return { copied: copied.length, ids: copied, skipped };
}

/**
 * How many numbers a path's outline is made of, which is what a delta has to
 * match. Measured by the runtime's own parser rather than by a second table of
 * SVG command arities, so "the same shape of outline" means the same thing in
 * an editor and in a frame.
 */
function pathValueCount(path) {
  try { return parsePath(path).values.length; } catch { return -1; }
}

/** Flip a delta about the vertical axis: every `x` component turns around. */
const mirrorDelta = (delta) => Array.from(delta, (value, index) => (index % 2 === 0 ? -value : value));

/**
 * Mirror one eye's corrective onto the other, reflecting it.
 *
 * For artwork whose two sides are drawn as mirror images this is wrong and
 * `copyFaceCorrectives` is right — the delta is already in each eye's own
 * coordinates. It is here for the case where the two lids were drawn from one
 * shape translated across the face, where a sideways delta has to turn around.
 */
export const mirrorFaceCorrectives = (document, options = {}) => copyFaceCorrectives(document, { ...options, mirror: true });
