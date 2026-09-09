/**
 * Atomic V2 commands for the two floating hands (docs/HAND_RIGGING.md,
 * docs/HAND_STYLES.md).
 *
 * Assigning a hand also creates the parameters it needs, in the same undo step:
 * a hand that exists but cannot be moved would be a trap.
 */
import {
  assignHand, removeHand, setHandAnchor, setHandParent, setHandRestOffset, setHandReach,
  setHandDepth, setHandSoftness, setHandInertia, setHandStyles, mirrorHand, handParameters
} from './hand-model.js';
import { handFrame, handHiddenPoint, handPlacement, setHandHidden } from '../sample/hand-feature.js';

export function createHandCommands(store, history) {
  const run = (type, domains, operation, fields = ['hands', 'params', 'states']) => {
    const draft = structuredClone(store.getDocument());
    if (operation(draft) === false) return false;
    history?.snapshot();
    store.execute({ type, source: 'hands', domains, apply: (document) => { for (const key of fields) document[key] = draft[key]; } });
    return true;
  };
  const HIDE_FIELDS = ['hands', 'params', 'states', 'keyforms', 'animationClips', 'expressions'];
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
    /** Which style a hand rests on, and how it swaps (docs/HAND_STYLES.md). */
    setStyles: edit('hands/set-styles', setHandStyles),
    /**
     * Rest behind the head, or in the open (docs/HAND_RIGGING.md, "Behind the
     * head"). Hiding needs to know where the hand rests and where it can hide:
     * the group's pivot for a hand the editor drew, the measured artwork
     * otherwise.
     */
    setHidden(side, hidden, { measure = null } = {}) {
      return run('hands/set-hidden', ['hands', 'rig', 'keyforms', 'stateMachine', 'expressions'], (document) => {
        const hand = document.hands?.[side];
        if (!hand?.element) return false;
        if (!hidden) return setHandHidden(document, side, false);
        const frame = handFrame(document, side, measure);
        const box = typeof measure === 'function' ? measure(hand.element) : null;
        const at = frame?.at || (box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null);
        if (!at) return false;
        const placement = handPlacement(document, { measure, parent: hand.parent || null });
        return setHandHidden(document, side, true, { at, hidden: handHiddenPoint(side, placement) });
      }, HIDE_FIELDS);
    },
    mirror(from, options) {
      return run('hands/mirror', ['hands', 'rig', 'stateMachine'], (document) => {
        if (!document.hands?.[from]) return false;
        const to = from === 'left' ? 'right' : 'left';
        document.hands = mirrorHand(document.hands, from, options);
        ensureParameters(document, handParameters(to));
      });
    }
  };
}
