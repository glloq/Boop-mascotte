/**
 * What a dropped file is, and how it should move
 * (V5-03, docs/V5_MASCOTTE_IMAGES_ETUDE.md).
 *
 * Two questions, asked once, with an answer already in both boxes:
 *
 * ```text
 *   oeil-gauche.png              64 × 64
 *
 *   What is it?      [ Left eye          ▾ ]   ← from the file name
 *   How does it move?[ Several drawings  ▾ ]   ← from the role
 * ```
 *
 * The editor already knew how to read the first one and never used it for
 * this. `rig-editor/semantic-parts/face-role-detection.js` tokenises a name,
 * understands `eye`, `brow`, `pupil`, `mouth` and `head`, and reads sides from
 * `left`, `l`, `gauche`, `1` — which is why it was possible to import
 * `eye-left.png` and be told, three screens later in Rig ▸ Assign, that every
 * role was still missing. The name was the lever all along and nobody was told
 * it existed.
 *
 * So this is not new cleverness. It is the reading that already happens,
 * happening at the moment the file arrives, where it can fill in a form
 * instead of being rediscovered.
 *
 * Nothing here decides anything: it *proposes*, both boxes are `<select>`s,
 * and a file called `IMG_2043.png` proposes nothing and moves as one piece,
 * exactly as it should.
 *
 * In the UI layer on purpose: it reads the role vocabulary from the rig editor
 * and the movement vocabulary from core, and a form that needs both belongs
 * above both.
 */
import { FACE_ROLE_CHECKLIST } from '../rig-editor/semantic-parts/face-roles.js';
import { FACE_ROLE_VOCABULARY } from '../rig-editor/semantic-parts/face-role-vocabulary.js';
import { tokenize } from '../rig-editor/semantic-parts/face-role-detection.js';
import { DEFAULT_RIGGING, riggingChoices, suggestedRigging } from '../core/rig/rigging-types.js';

/** The role a name points at, or `''`. The same words the checklist is written in. */
const FEATURES = Object.freeze([
  ['pupil', ['pupil', 'pupils', 'iris'], ['leftPupil', 'rightPupil']],
  ['brow', ['brow', 'brows', 'eyebrow', 'eyebrows', 'sourcil', 'sourcils'], ['leftBrow', 'rightBrow']],
  // The lids before the eyes, and the pupils before both: `eyelid-left.png`
  // says "eye" too, and the longest thing a name says is what it is.
  ['lid', ['lid', 'lids', 'eyelid', 'eyelids', 'paupiere', 'paupieres'], ['leftUpper', 'rightUpper']],
  ['eye', ['eye', 'eyes', 'oeil', 'yeux'], ['leftEye', 'rightEye']],
  // Everything inside a mouth, before the mouth: `teeth.png` and `tongue.png`
  // are not mouths, and a name that says both is still the part it names.
  // The lower row and the tip before the two they are part of, and for the same
  // reason: `teeth-lower.png` says "teeth" too.
  ['teethLower', ['teethlower', 'lowerteeth', 'dentsbas', 'basdents'], ['teethLower']],
  ['tongueTip', ['tonguetip', 'tiptongue', 'pointelangue', 'languepointe'], ['tongueTip']],
  ['tongueGroove', ['tonguegroove', 'groovetongue', 'rainurelangue', 'languerainure'], ['tongueGroove']],
  ['uvula', ['uvula', 'luette', 'glotte'], ['uvula']],
  ['teeth', ['teeth', 'tooth', 'dents', 'dent'], ['teeth']],
  ['tongue', ['tongue', 'langue'], ['tongue']],
  ['cavity', ['cavity', 'cavite', 'inside'], ['cavity']],
  ['mouth', ['mouth', 'lips', 'lip', 'bouche', 'levres'], ['mouth']],
  ['jaw', ['jaw', 'chin', 'machoire', 'menton'], ['jaw']],
  ['nose', ['nose', 'snout', 'muzzle', 'beak', 'nez', 'museau', 'bec'], ['nose']],
  ['ear', ['ear', 'ears', 'oreille', 'oreilles'], ['leftEar', 'rightEar']],
  // Hair before the head: `hair.png` says neither "head" nor "face", but
  // `cheveux-arriere.png` and `hair-back.png` have to reach the right one of
  // the three pieces a head of hair can be.
  ['hairBack', ['hairback', 'backhair', 'arriere'], ['hairBack']],
  ['hairTop', ['hairtop', 'tophair', 'crown', 'dessus'], ['hairTop']],
  ['hair', ['hair', 'fringe', 'bangs', 'cheveux', 'cheveu', 'frange'], ['hair']],
  ['facialHair', ['beard', 'moustache', 'goatee', 'sideburns', 'barbe', 'bouc', 'favoris'], ['facialHair']],
  ['head', ['head', 'face', 'skull', 'tete', 'visage'], ['head']]
]);
// The detector's own side words, plus the ones a French file name uses.
const SIDES = Object.freeze({ left: ['left', 'l', 'lft', 'gauche', 'g', '1'], right: ['right', 'r', 'rgt', 'droite', 'd', '2'] });

/**
 * The role a file name points at, or `''` when it points at none.
 *
 * Deliberately conservative. `head.png` is a head; `background-head-shadow.png`
 * is not, because it says two other things as well and a wrong role costs more
 * than a missing one — a missing role is a `<select>` an author uses, a wrong
 * one is a piece silently rigged as something it is not.
 */
export function roleForName(name = '') {
  const tokens = tokenize(String(name).replace(/\.[a-z0-9]+$/i, ''));
  if (!tokens.length) return '';
  // The tokens, and every adjacent pair of them joined: `hair-back.png`,
  // `hairback.png` and `back-hair.png` are the same piece said three ways, and
  // the tokeniser splits the first into two words neither of which is it.
  const words = new Set(tokens);
  for (let i = 1; i < tokens.length; i += 1) {
    words.add(`${tokens[i - 1]}${tokens[i]}`);
    words.add(`${tokens[i]}${tokens[i - 1]}`);
  }
  const found = FEATURES.find(([, vocabulary]) => vocabulary.some((word) => words.has(word)));
  if (!found) return '';
  const [, , roles] = found;
  if (roles.length === 1) return roles[0];
  const left = tokens.some((token) => SIDES.left.includes(token));
  const right = tokens.some((token) => SIDES.right.includes(token));
  // A pair needs a side. "eyes.png" is both eyes in one drawing, which is a
  // piece with no single role rather than a guess at one of the two.
  if (left === right) return '';
  return left ? roles[0] : roles[1];
}

/**
 * Every role the two boxes offer, plus the one that means "it is just a piece".
 *
 * The eight of the checklist and then everything else the registry knows
 * (`semantic-parts/face-role-vocabulary.js`), because a form that reads
 * `cheveux.png` correctly and then has no *Hair* to offer is worse than one
 * that reads nothing.
 *
 * Keyed by the **bare** role name, which is what `suggestedRigging` is keyed
 * by (`core/rig/rigging-types.js`): that table already knows that hair bends,
 * an ear bends, a lid is several drawings and a nose is rigid, and matching it
 * is what makes the second box's answer right. One name for one role, so the
 * tongue -- a role of the mouth *and* a part of its own -- appears once.
 */
export const INTAKE_ROLES = Object.freeze([
  Object.freeze({ id: '', label: 'Just a piece', hint: 'It moves with the rest and has no job of its own.' }),
  ...(() => {
    const seen = new Set();
    const rows = [];
    for (const entry of [...FACE_ROLE_CHECKLIST, ...FACE_ROLE_VOCABULARY]) {
      if (entry.role === 'hand' || entry.role === 'element' || seen.has(entry.role)) continue;
      seen.add(entry.role);
      rows.push(Object.freeze({ id: entry.role, label: entry.label, hint: entry.hint }));
    }
    return rows;
  })()
]);

/**
 * The whole form, filled in, for one file about to become a piece.
 *
 * @param {string} name the file's name
 * @param {{nodeType?: string, role?: string, rigging?: string}} options
 */
export function intakeFor(name = '', { nodeType = 'image', role, rigging } = {}) {
  const detected = roleForName(name);
  const chosen = role === undefined ? detected : String(role || '');
  const move = rigging === undefined ? suggestedRigging(chosen, nodeType) : rigging;
  return {
    name: String(name || ''),
    role: chosen,
    detected,
    rigging: move,
    roles: INTAKE_ROLES,
    riggings: riggingChoices(nodeType)
  };
}

/** Said back in one line, because two `<select>`s are not a sentence. */
export function describeIntake(intake) {
  if (!intake) return '';
  const role = INTAKE_ROLES.find((entry) => entry.id === intake.role)?.label || 'Just a piece';
  const move = intake.riggings.find((entry) => entry.id === intake.rigging)?.label || DEFAULT_RIGGING;
  return `${role} · ${move.toLowerCase()}`;
}
