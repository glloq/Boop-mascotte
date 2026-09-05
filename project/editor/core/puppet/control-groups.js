/**
 * Composite controls: cages, and what is inside them (docs/FACE_CONTROL_RIG.md).
 *
 * A face rig is not a flat list of twenty dots. It is a handful of *things you
 * pose* — the eyes, the brows, the mouth, the head — each of which opens into
 * the controls that refine it:
 *
 * ```text
 * Simple                          Detailed
 *  ╭──────── EYES ────────╮        ┃◆                  ◆┃
 *  │          ●           │        ┃    ◉    ●    ◉     ┃
 *  ╰──────────────────────╯        ╰─────── ○ ──────────╯
 * ```
 *
 * The mechanism for "inside" already existed: a handle names a `group`, and
 * the canvas folds its members away until asked. What was missing is the thing
 * an animator actually looks at — the **cage**: a frame that says *these
 * controls are one part of the face*, drawn around them, named, and openable.
 *
 * `visualParent` is how a control says which cage it belongs to. It is
 * presentation and nothing else: it changes no parameter, no binding and no
 * evaluation order, and a runtime never hears about it. That is deliberate —
 * a visual hierarchy that quietly became a transform hierarchy would be a
 * second, competing parent system next to the deformers (docs/DEFORMER_MODEL.md).
 *
 * Pure: it reads the document and reports groups; a panel draws them.
 */
import { handleBoardModel } from './handle-model.js';
import { rigLinkModel } from './control-links.js';

/**
 * The cages a face is posed through, in the order they are read.
 *
 * Top down, the way a face is read: what the head is doing, then the eyes,
 * then the brows, then the mouth. The hands come last because they are not
 * part of the face at all.
 */
export const RIG_CONTROL_GROUPS = Object.freeze([
  Object.freeze({ id: 'head-rig', label: 'Head', hint: 'Where the head is pointed, and how far it is tilted.' }),
  Object.freeze({ id: 'eye-rig', label: 'Eyes', hint: 'What the character is looking at, and what the eyes are doing about it.' }),
  Object.freeze({ id: 'brow-rig', label: 'Eyebrows', hint: 'One controller per brow: the centre moves it, the arc turns it.' }),
  Object.freeze({ id: 'mouth-rig', label: 'Mouth', hint: 'The mouth, its width and the jaw under it.' }),
  Object.freeze({ id: 'hand-rig', label: 'Hands', hint: 'Where each hand is, and what it is doing.' })
]);

/**
 * The two states every cage has (CR-04).
 *
 * A face covered in twenty controls is not a rig, it is a minefield: the
 * common ones are the ones used every shot, and the rest are there for the one
 * shot that needs them. `simple` is the cage's own controls; `detailed` adds
 * the members that refine them.
 */
export const RIG_CONTROL_DETAIL = Object.freeze(['simple', 'detailed']);

/**
 * The four ways an author works, named once so panels agree (CR-01).
 *
 * | Mode | What it is for | What is on screen |
 * | --- | --- | --- |
 * | `simple` | posing quickly | one control per part |
 * | `detailed` | posing precisely | every control the part has |
 * | `rig` | building the rig | limits, locks, links, cages |
 * | `animate` | keys and time | the controls, plus the timeline they write to |
 */
export const RIG_CONTROL_MODES = Object.freeze([
  Object.freeze({ id: 'simple', label: 'Simple', hint: 'One control per part of the face.' }),
  Object.freeze({ id: 'detailed', label: 'Detailed', hint: 'Every control each part has, including one side at a time.' }),
  Object.freeze({ id: 'rig', label: 'Rig', hint: 'How far each control may go, what is locked, and what moves together.' }),
  Object.freeze({ id: 'animate', label: 'Animate', hint: 'The same controls, writing keys as you move them.' })
]);

const GROUP_IDS = new Set(RIG_CONTROL_GROUPS.map((group) => group.id));

/** Everything that is not in a cage: the nose, the hair, the ears, an author's own. */
export const LOOSE_CONTROL_GROUP = Object.freeze({ id: 'loose', label: 'Everything else', hint: 'Controls that belong to no group of their own.' });

/**
 * The control rig, as composites.
 *
 * Each cage carries its own controls (Simple), the members that refine them
 * (Detailed), and the links that decide whether its two sides move together.
 * A cage with nothing in it is not reported, so a mascot with no eyebrows has
 * no eyebrow cage rather than an empty frame.
 *
 * @param {object} document
 * @param {Record<string, number>} values what each movement is set to now
 * @returns {{id,label,hint,controls,detail,links,count}[]}
 */
export function rigControlGroups(document = {}, values = {}) {
  const board = handleBoardModel(document, values);
  const rows = board.layers.flatMap((layer) => layer.items);
  const links = rigLinkModel(document);
  const inGroup = (row, id) => row.visualParent === id;
  const groups = RIG_CONTROL_GROUPS.map((group) => build(group, rows.filter((row) => inGroup(row, group.id)), links.filter((link) => link.group === group.id)));
  // A hand names no cage of its own, so the hands' own layer becomes one: it
  // is what an author means by "the hands" whatever the registry calls them.
  const hands = groups.find((group) => group.id === 'hand-rig');
  if (hands && !hands.count) {
    const handRows = (board.layers.find((layer) => layer.name === 'hands')?.items) || [];
    Object.assign(hands, build(RIG_CONTROL_GROUPS[4], handRows, []));
  }
  const claimed = new Set(groups.flatMap((group) => [...group.controls, ...group.detail]).map((row) => row.id));
  const loose = rows.filter((row) => !claimed.has(row.id) && (!row.visualParent || !GROUP_IDS.has(row.visualParent)));
  return [...groups, build(LOOSE_CONTROL_GROUP, loose, [])].filter((group) => group.count > 0);
}

function build(group, rows, links) {
  const detail = rows.flatMap((row) => row.members || []);
  return {
    id: group.id, label: group.label, hint: group.hint,
    // Simple is the cage's own controls; Detailed is those plus their members.
    controls: rows.map((row) => ({ ...row, members: undefined, detail: (row.members || []).length })),
    detail, links,
    count: rows.length + detail.length
  };
}

/**
 * One line saying what a cage is set to, for a collapsed frame to show.
 *
 * A collapsed group that says nothing is a group an author has to open to find
 * out whether it matters. "at rest" is as useful an answer as any other.
 */
export function rigControlSummary(group) {
  const moved = [...group.controls, ...group.detail]
    .flatMap((row) => row.axes.map((axis) => ({ ...axis, label: axis.label })))
    .filter((axis) => Math.abs(Number(axis.value) - Number(axis.rest)) > 0.005);
  if (!moved.length) return 'at rest';
  return moved.slice(0, 3).map((axis) => `${axis.label.toLowerCase()} ${Number(axis.value) > Number(axis.rest) ? '+' : ''}${Math.round((axis.value - axis.rest) * 100) / 100}`).join(' · ')
    + (moved.length > 3 ? ` · +${moved.length - 3} more` : '');
}
