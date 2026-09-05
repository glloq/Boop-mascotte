/**
 * Naming points and holding them (docs/FACE_CONTROL_RIG.md, CR-35 … CR-38).
 *
 * Atomic, like every other command boundary here: one `history.snapshot()`,
 * one `store.execute` over the `constraints` domain.
 */
import { createRigAttachment, createRigHold, moveRigAttachment, removeRigAttachment, removeRigHold, suggestAttachments } from '../../core/rig/attachment-model.js';
import { normalizeRigHolds } from '../../../runtime/runtime.js';
import { enableMouthRig } from '../../core/rig/mouth-rig.js';
import { enableBrowRig } from '../../core/rig/brow-rig.js';
import { findFacePartByType } from '../semantic-parts/face-roles.js';

export function createHoldingCommands(store, history, { measure = () => null } = {}) {
  const run = (type, apply) => {
    history?.snapshot();
    return store.execute({ type, source: 'holding', domains: ['constraints', 'rig', 'stateMachine', 'keyforms'], apply });
  };
  const guarded = (type, apply) => {
    try { run(type, apply); return { ok: true }; }
    catch (error) { return { ok: false, message: error.message }; }
  };
  return {
    /** Accept one of the points the project's own parts suggest. */
    addPoint: (id) => guarded('holding/add-point', (document) => {
      const suggestion = suggestAttachments(document, measure).find((item) => item.id === id);
      if (!suggestion) throw new Error(`Nothing on this mascot is called “${id}”.`);
      createRigAttachment(document, suggestion);
    }),
    /**
     * A point of an author's own, wherever they put it.
     *
     * The suggestions cover a face and a pair of hands; a mascot with a snout,
     * a tail or a hat has places to be held that no list could have guessed. It
     * starts at the middle of the artwork it is on, because that is a place the
     * editor can find and the author can then move it from.
     */
    createPoint: (id, target, point, space) => guarded('holding/create-point', (document) => {
      const box = point || measure(target);
      if (!box) throw new Error(`“${target}” has nothing to measure, so there is nowhere to put a point on it.`);
      createRigAttachment(document, {
        id,
        target,
        point: Number.isFinite(box.x) && box.width === undefined
          ? { x: box.x, y: box.y }
          : { x: Math.round((box.x + box.width / 2) * 100) / 100, y: Math.round((box.y + box.height / 2) * 100) / 100 },
        space
      });
    }),
    /** Nudge one. A suggestion is a starting place, not a decision. */
    movePoint: (id, point) => guarded('holding/move-point', (document) => { moveRigAttachment(document, id, point); }),
    removePoint: (id) => guarded('holding/remove-point', (document) => { removeRigAttachment(document, id); }),
    /**
     * Put one point on another.
     *
     * The weight parameter is created with it, so an author has something to
     * key the moment the hold exists: approach, contact, hold, release.
     */
    hold: (hold, to, weight) => guarded('holding/hold', (document) => {
      if (hold === to) throw new Error('A point cannot hold itself.');
      createRigHold(document, { hold, to, weight: weight || defaultWeight(document, hold, to) });
    }),
    configureHold: (id, changes) => guarded('holding/configure-hold', (document) => {
      const holds = normalizeRigHolds(document);
      document.rigHolds = normalizeRigHolds({ rigHolds: holds.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
      const weight = document.rigHolds.find((item) => item.id === id)?.weight;
      if (!weight) return;
      document.params ||= {};
      if (!document.params[weight]) document.params[weight] = { type: 'number', min: 0, max: 1, default: 0, value: 0 };
      for (const pose of Object.values(document.states || {})) if (!(weight in pose)) pose[weight] = 0;
    }),
    removeHold: (id) => guarded('holding/remove-hold', (document) => { removeRigHold(document, id); }),
    /**
     * The pins the face template ships with, generated again: the corners and
     * the lower lip of the mouth, the two ends of each brow. For a mouth or a
     * pair of brows that never had them, or had them deleted, the same rig.
     */
    restorePins: (which) => {
      let made = 0;
      const result = guarded(`holding/restore-${which}-pins`, (document) => {
        if (which === 'mouth') {
          const mouth = findFacePartByType(document, 'mouth');
          const target = mouth?.roles?.mouth;
          if (!target) throw new Error('Assign the mouth in Face parts first: the pins go on it.');
          made = enableMouthRig(document, { target, box: measure(target) }).filter((pin) => pin.id.startsWith('mouth-')).length;
        } else {
          const brows = findFacePartByType(document, 'eyebrows');
          const left = brows?.roles?.leftBrow, right = brows?.roles?.rightBrow;
          if (!left || !right) throw new Error('Assign both eyebrows in Face parts first: the pins go on them.');
          made = enableBrowRig(document, { left: { target: left, box: measure(left) }, right: { target: right, box: measure(right) } }).filter((pin) => pin.id.startsWith('brow-')).length;
        }
      });
      return result.ok ? { ok: true, count: made } : result;
    }
  };
}

/**
 * `contactIndexTipNose` — a name an animator can find on a timeline.
 *
 * Built from the last word of each point rather than from their whole ids: a
 * track called `contactHandLeftIndexTipFaceNose` is a track nobody reads.
 */
function defaultWeight(document, hold, to) {
  const word = (id) => String(id).split('.').at(-1).replace(/[^A-Za-z0-9]/g, '');
  const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const name = `contact${capital(word(hold))}${capital(word(to))}`;
  if (!document.params?.[name]) return name;
  for (let index = 2; index < 99; index += 1) if (!document.params[`${name}${index}`]) return `${name}${index}`;
  return `${name}${Date.now()}`;
}
