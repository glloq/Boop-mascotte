/**
 * Face Setup sections (docs/GUIDED_JOURNEY.md).
 *
 * The panel holds six things — face parts, movements, head pose, hands, warp
 * and the part tree. Stacked, they were three screens tall, and the two V2
 * features lived below the fold where nobody found them. As collapsible
 * sections each one needs a heading that says, without opening it, whether
 * there is anything inside.
 *
 * Pure: reads the document, returns the headings.
 */
import { deriveFaceRoleChecklist } from '../../rig-editor/semantic-parts/face-roles.js';
import { deriveMovementChecklist } from '../../rig-editor/semantic-parts/face-movements.js';
import { gazeSolverSettings } from '../rig/gaze-rig.js';

/** `open` is the default state; the editor remembers what the author changed. */
export const SETUP_SECTIONS = Object.freeze([
  Object.freeze({ id: 'face-parts', panel: 'face-setup-checklist', label: 'Face parts', open: true }),
  Object.freeze({ id: 'movements', panel: 'face-movements', label: 'Movements', open: false }),
  Object.freeze({ id: 'gaze', panel: 'gaze-panel', label: 'Gaze', open: false }),
  Object.freeze({ id: 'head-pose', panel: 'head-pose', label: 'Head pose', open: false }),
  Object.freeze({ id: 'hands', panel: 'hand-setup', label: 'Hands', open: false }),
  Object.freeze({ id: 'handles', panel: 'handle-board', label: 'Controls', open: false }),
  Object.freeze({ id: 'holding', panel: 'holding-panel', label: 'Pins & holding', open: false, advanced: true }),
  Object.freeze({ id: 'warp', panel: 'warp-panel', label: 'Warp', open: false, advanced: true }),
  Object.freeze({ id: 'all-parts', panel: 'rig-parts', label: 'All parts', open: false })
]);

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * @returns {{id,label,panel,summary,state,advanced}[]}
 *          `state` is `ready` | `partial` | `empty`, for the heading's mark.
 */
export function deriveSetupSections(document = {}) {
  const roles = deriveFaceRoleChecklist(document);
  const moves = deriveMovementChecklist(document);
  const headPose = (document.keyforms || []).filter((item) => String(item.id).startsWith('headPose:'));
  const posedCells = new Set(headPose.flatMap((item) => (item.keyforms || []).map((cell) => cell.at.join(','))));
  const hands = ['left', 'right'].filter((side) => document.hands?.[side]?.element);
  const warps = (document.warps || []).length;
  const pins = (document.rigPins || []).length;
  const holds = (document.rigHolds || []).length;
  const rules = (document.rigConstraints || []).length;
  const parts = Object.keys(document.semanticParts || {}).length;
  // Deliberately not `resolveRigHandles`: this runs on every Face Setup render,
  // and resolving the whole handle set to write four words in a heading is a
  // movement checklist and a hand-reach measurement nobody asked for.
  const authored = (document.rigHandles || []).length;
  const gaze = gazeSolverSettings(document);

  // Short enough to read at a glance in a collapsed heading: the panel itself
  // explains what the section is for, and the heading only grades it.
  const summaries = {
    'face-parts': roles.assigned
      ? { summary: `${roles.assigned} / ${roles.total}`, state: roles.complete ? 'ready' : 'partial' }
      : { summary: 'none yet', state: 'empty' },
    movements: !moves.available
      ? { summary: 'parts first', state: 'empty' }
      : moves.enabled
        ? { summary: `${moves.enabled} on · ${moves.calibrated} set`, state: moves.calibrated ? 'ready' : 'partial' }
        : { summary: 'none on', state: 'empty' },
    // The gaze solver is optional and off until asked for, so an empty section
    // says "optional" rather than "unfinished" (docs/FACE_CONTROL_RIG.md).
    gaze: gaze.enabled
      ? { summary: `head follows ${Math.round(gaze.headFollow * 100)}%`, state: 'ready' }
      : { summary: 'optional', state: 'empty' },
    'head-pose': posedCells.size
      ? { summary: plural(posedCells.size, 'position'), state: posedCells.size > 1 ? 'ready' : 'partial' }
      : { summary: 'optional', state: 'empty' },
    hands: hands.length
      ? { summary: hands.length === 2 ? 'both' : `${hands[0]} only`, state: hands.length === 2 ? 'ready' : 'partial' }
      : { summary: 'optional', state: 'empty' },
    handles: moves.enabled
      ? { summary: authored ? plural(authored, 'change') : 'generated', state: 'ready' }
      : { summary: 'none yet', state: 'empty' },
    // Pins hold artwork by a point, relationships say what must stay true while
    // anything moves, and holds put one point on another. All three are
    // advanced, and all three are optional (docs/FACE_CONTROL_RIG.md).
    holding: pins || rules || holds
      ? { summary: [pins ? plural(pins, 'pin') : '', rules ? plural(rules, 'rule') : '', holds ? plural(holds, 'hold') : ''].filter(Boolean).join(' · '), state: 'ready' }
      : { summary: 'advanced', state: 'empty' },
    warp: warps
      ? { summary: plural(warps, 'warp'), state: 'ready' }
      : { summary: 'advanced', state: 'empty' },
    'all-parts': parts
      ? { summary: plural(parts, 'part'), state: 'ready' }
      : { summary: 'none yet', state: 'empty' }
  };

  return SETUP_SECTIONS.map((section) => ({ ...section, ...summaries[section.id] }));
}
