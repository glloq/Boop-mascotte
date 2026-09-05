/**
 * Naming the places one thing can hold another (docs/FACE_CONTROL_RIG.md, CR-35).
 *
 * The runtime knows how to resolve a named point through the deformation and
 * how to put one on another (`runtime/rig-attachments.js`). What it cannot do
 * is *decide where the points are*: a nose is on the nose, a cheek is a
 * fraction of the way across a head, a fingertip is where the hand generator
 * drew it.
 *
 * So this proposes them, from the parts the project already has, and an author
 * accepts, moves or ignores each one. Nothing is generated behind their back:
 * a rig full of points nobody chose is a rig nobody can read.
 */
import { normalizeRigAttachments, normalizeRigHolds } from '../../../runtime/runtime.js';
import { HAND_SIDES } from '../../../runtime/runtime.js';
import { HAND_DIGITS, handDigitTip } from '../sample/hand-artwork.js';

/**
 * Where a face is usually held, as fractions of the part's own box.
 *
 * A cheek is not a piece of artwork on this mascot — it is a place on the head
 * — so the spots that have their own drawing name it, and the rest are a `u`
 * and a `v` on whatever the head is.
 */
export const FACE_ATTACHMENT_SPOTS = Object.freeze([
  Object.freeze({ id: 'face.nose', part: 'nose', role: 'nose', u: 0.5, v: 0.5, label: 'Nose' }),
  Object.freeze({ id: 'face.cheek.left', part: 'head', role: 'head', u: 0.2, v: 0.62, label: 'Left cheek' }),
  Object.freeze({ id: 'face.cheek.right', part: 'head', role: 'head', u: 0.8, v: 0.62, label: 'Right cheek' }),
  Object.freeze({ id: 'face.chin', part: 'head', role: 'head', u: 0.5, v: 0.94, label: 'Chin' }),
  Object.freeze({ id: 'face.forehead', part: 'head', role: 'head', u: 0.5, v: 0.16, label: 'Forehead' }),
  Object.freeze({ id: 'mouth.corner.left', part: 'mouth', role: 'mouth', u: 0, v: 0.5, label: 'Left mouth corner' }),
  Object.freeze({ id: 'mouth.corner.right', part: 'mouth', role: 'mouth', u: 1, v: 0.5, label: 'Right mouth corner' })
]);

const round = (value) => Math.round(Number(value) * 100) / 100;

/**
 * The points this project's face can offer, given a way to measure artwork.
 *
 * `box` is handed in rather than measured here: the editor asks the canvas,
 * the template knows its own numbers, and a test can say what it likes.
 *
 * @param {object} document
 * @param {(elementId: string) => ({x,y,width,height}|null)} box
 */
export function suggestFaceAttachments(document = {}, box = () => null) {
  const parts = Object.values(document.semanticParts || {});
  const points = [];
  for (const spot of FACE_ATTACHMENT_SPOTS) {
    const part = parts.find((item) => item.type === spot.part);
    const target = part?.roles?.[spot.role];
    const measured = target && document.elements?.[target] ? box(target) : null;
    if (!measured?.width) continue;
    points.push({
      id: spot.id, target, label: spot.label, space: 'head',
      point: { x: round(measured.x + measured.width * spot.u), y: round(measured.y + measured.height * spot.v) }
    });
  }
  return points;
}

/**
 * The points a pair of hands can offer.
 *
 * A fingertip comes from the same function that draws the finger, placed where
 * the outline was placed, so the point is on the finger at every pose rather
 * than near it (`core/puppet/hand-handles.js`).
 */
export function suggestHandAttachments(document = {}, box = () => null) {
  const points = [];
  for (const side of HAND_SIDES) {
    const hand = document.hands?.[side];
    if (!hand?.element || !document.elements?.[hand.element]) continue;
    const measured = box(hand.element);
    if (!measured?.width) continue;
    const at = { x: measured.x + measured.width / 2, y: measured.y + measured.height / 2 };
    points.push({ id: `hand.${side}.palm`, target: hand.element, label: `${side === 'left' ? 'Left' : 'Right'} palm`, space: 'hand', point: { x: round(at.x), y: round(at.y) } });
    for (const digit of HAND_DIGITS) {
      const tip = handDigitTip(side, digit.id, { at, box: measured });
      if (!tip) continue;
      points.push({
        id: `hand.${side}.${digit.id}Tip`, target: hand.element, space: 'hand',
        label: `${side === 'left' ? 'Left' : 'Right'} ${String(digit.name || digit.id).toLowerCase()} tip`,
        point: { x: round(tip.x), y: round(tip.y) }
      });
    }
  }
  return points;
}

/** Everything this project could name, face and hands together. */
export const suggestAttachments = (document = {}, box = () => null) =>
  [...suggestFaceAttachments(document, box), ...suggestHandAttachments(document, box)];

/**
 * What a panel needs: the points the project has, the ones it could add, and
 * what is currently holding on to what.
 */
export function attachmentRigModel(document = {}, box = () => null) {
  const points = normalizeRigAttachments(document);
  const have = new Set(points.map((item) => item.id));
  const holds = normalizeRigHolds(document);
  return {
    points: points.map((item) => ({ ...item, missing: !document.elements?.[item.target] })),
    available: suggestAttachments(document, box).filter((item) => !have.has(item.id)),
    holds: holds.map((hold) => ({
      ...hold,
      // A hold whose points the project has lost is still listed: it is a
      // relationship an author set up, and hiding it makes the loss silent.
      ready: have.has(hold.hold) && have.has(hold.to)
    }))
  };
}

/** Put a named point on a piece of artwork. */
export function createRigAttachment(rig, { id, target, point, space = 'world' } = {}) {
  if (!id) throw new Error('An attachment needs a name.');
  if (!rig?.elements?.[target]) throw new Error(`There is no artwork called "${target}".`);
  const list = normalizeRigAttachments(rig);
  if (list.some((item) => item.id === id)) throw new Error(`A point called "${id}" already exists.`);
  rig.rigAttachments = normalizeRigAttachments({ rigAttachments: [...list, { id, target, point, space }] });
  return rig.rigAttachments.at(-1);
}

export function moveRigAttachment(rig, id, point) {
  const list = normalizeRigAttachments(rig);
  if (!list.some((item) => item.id === id)) throw new Error(`There is no point called "${id}".`);
  rig.rigAttachments = normalizeRigAttachments({ rigAttachments: list.map((item) => (item.id === id ? { ...item, point } : item)) });
  return rig.rigAttachments.find((item) => item.id === id);
}

export function removeRigAttachment(rig, id) {
  const before = normalizeRigAttachments(rig);
  rig.rigAttachments = before.filter((item) => item.id !== id);
  // A hold whose point has gone is not a hold: it would silently do nothing.
  rig.rigHolds = normalizeRigHolds(rig).filter((hold) => hold.hold !== id && hold.to !== id);
  return rig.rigAttachments.length < before.length;
}

/**
 * Hold one point on another.
 *
 * `weight` names the parameter that fades the contact — approach, contact,
 * hold, release — and it is created here if the project has not got it, so an
 * author has something to key the moment the hold exists (CR-38).
 */
export function createRigHold(rig, { id, hold, to, weight = null, offset, orient } = {}) {
  const points = normalizeRigAttachments(rig);
  if (!points.some((item) => item.id === hold)) throw new Error(`There is no point called "${hold}".`);
  if (!points.some((item) => item.id === to)) throw new Error(`There is no point called "${to}".`);
  const list = normalizeRigHolds(rig);
  const name = id || `hold-${hold}-on-${to}`.replace(/[^A-Za-z0-9-]+/g, '-');
  if (list.some((item) => item.id === name)) throw new Error(`A hold called "${name}" already exists.`);
  if (weight) {
    rig.params ||= {};
    if (!rig.params[weight]) rig.params[weight] = { type: 'number', min: 0, max: 1, default: 0, value: 0 };
    for (const pose of Object.values(rig.states || {})) if (!(weight in pose)) pose[weight] = 0;
  }
  rig.rigHolds = normalizeRigHolds({ rigHolds: [...list, { id: name, hold, to, weight, offset, orient }] });
  return rig.rigHolds.at(-1);
}

export function removeRigHold(rig, id) {
  const before = normalizeRigHolds(rig);
  rig.rigHolds = before.filter((item) => item.id !== id);
  return rig.rigHolds.length < before.length;
}
