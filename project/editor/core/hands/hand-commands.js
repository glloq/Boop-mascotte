/**
 * Atomic V2 commands for the two floating hands (docs/HAND_RIGGING.md).
 *
 * Assigning a hand also creates the parameters it needs, in the same undo step:
 * a hand that exists but cannot be moved would be a trap.
 */
import {
  assignHand, removeHand, setHandAnchor, setHandParent, setHandRestOffset, setHandReach,
  setHandDepth, setHandSoftness, setHandInertia, addHandPose, removeHandPose, mirrorHand,
  handParameters, handPoseParameter
} from './hand-model.js';
import { capturePoseKeys, removePoseKeys } from '../sample/hand-feature.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

export function createHandCommands(store, history) {
  const run = (type, domains, operation, fields = ['hands', 'params', 'states']) => {
    const draft = structuredClone(store.getDocument());
    if (operation(draft) === false) return false;
    history?.snapshot();
    store.execute({ type, source: 'hands', domains, apply: (document) => { for (const key of fields) document[key] = draft[key]; } });
    return true;
  };
  const POSE_FIELDS = ['hands', 'params', 'states', 'shapeKeys', 'keyforms'];
  const ensureParameters = (document, parameters) => {
    document.params ||= {};
    for (const [name, param] of Object.entries(parameters)) {
      if (!document.params[name]) document.params[name] = structuredClone(param);
      for (const state of Object.values(document.states || {})) if (!(name in state)) state[name] = param.default;
    }
  };
  const edit = (type, apply) => (side, ...args) => run(type, ['hands'], (document) => {
    if (!document.hands?.[side]) return false;
    document.hands = apply(document.hands, side, ...args);
  });

  return {
    assign(side, options) {
      return run('hands/assign', ['hands', 'rig', 'stateMachine'], (document) => {
        const result = assignHand(document.hands, side, options);
        if (!result.ok) return false;
        document.hands = result.hands;
        ensureParameters(document, result.parameters);
      });
    },
    remove(side) { return run('hands/remove', ['hands'], (document) => { document.hands = removeHand(document.hands, side); }); },
    setAnchor: edit('hands/set-anchor', setHandAnchor),
    setParent: edit('hands/set-parent', setHandParent),
    setRestOffset: edit('hands/set-rest', setHandRestOffset),
    setReach: edit('hands/set-reach', setHandReach),
    setDepth: edit('hands/set-depth', setHandDepth),
    setSoftness: edit('hands/set-softness', setHandSoftness),
    setInertia: edit('hands/set-inertia', setHandInertia),
    removePose: edit('hands/remove-pose', removeHandPose),
    addPose(side, pose) {
      return run('hands/add-pose', ['hands', 'rig', 'stateMachine'], (document) => {
        if (!document.hands?.[side]) return false;
        document.hands = addHandPose(document.hands, side, pose);
        const name = handPoseParameter(side, pose?.id || '');
        if (name) ensureParameters(document, { [name]: number(0, 1, 0) });
      });
    },
    /**
     * A pose from its table (docs/HAND_REPRESENTATIONS_STUDY.md, stage 3): the
     * keys on every part it moves, its parameter, and the record that keeps the
     * numbers -- one command, one undo step. Returns what was captured, or null.
     */
    capturePose(side, options) {
      let captured = null;
      const done = run('hands/capture-pose', ['hands', 'rig', 'keyforms', 'stateMachine'], (document) => {
        if (!document.hands?.[side]) return false;
        const result = capturePoseKeys(document, side, options);
        if (!result.ok) return false;
        captured = result;
      }, POSE_FIELDS);
      return done ? captured : null;
    },
    /** A pose and everything a capture wrote for it, gone together. */
    dropPose(side, poseId) {
      return run('hands/drop-pose', ['hands', 'rig', 'keyforms'], (document) => {
        if (!document.hands?.[side]?.poses.some((pose) => pose.id === poseId)) return false;
        removePoseKeys(document, side, poseId);
        document.hands = removeHandPose(document.hands, side, poseId);
      }, POSE_FIELDS);
    },
    mirror(from, options) {
      return run('hands/mirror', ['hands', 'rig', 'stateMachine'], (document) => {
        if (!document.hands?.[from]) return false;
        const to = from === 'left' ? 'right' : 'left';
        document.hands = mirrorHand(document.hands, from, options);
        ensureParameters(document, handParameters(to));
        for (const pose of document.hands[to].poses) ensureParameters(document, { [pose.parameter]: number(0, 1, 0) });
      });
    }
  };
}
