/**
 * The turn every built-in asset generates, as one word each.
 *
 * V3-01 moved the decision of what takes part in the 2.5D turn off the role
 * table and onto the asset (docs/HEAD_POSE_2_5D.md, "Which parts turn"). The
 * one thing that change was not allowed to do was move a single sample: a
 * generated turn is a whole grid of tuned constants, and a mechanism that
 * quietly re-proportions them on its way past is a look change nobody asked
 * for.
 *
 * Ten of these words moved once, in V3-02, and deliberately: the five facial
 * hairs and the five accessories each went from 139 keyforms -- the template's
 * own turn, to which they contributed nothing -- to 146, which is those 139
 * plus the seven channels the generator writes for one more element. Every
 * other word is the one captured before any of this existed, which is what
 * makes re-signing a handful of them safe to do.
 *
 * One moved again in V3-03, and for the opposite reason: the earring is drawn
 * *inside* the ear now, so the ear's turn is already on it and what it writes
 * for itself is what it adds to the ear, which is nothing. Its seven channels
 * are still there and sit at rest -- a part that is carried has nothing to
 * carry itself -- and the right earring, being the same nothing on the other
 * side, signs as the same word.
 *
 * **Nothing moved when facial hair started following the mouth and the jaw.**
 * What carries it is a *binding* -- the drawing reads `mouthOpen + jawOpen`,
 * the sentence the chin is stretched by (docs/FACE_PART_LIBRARY.md, "Carried
 * by the face under it") -- and a binding is not a keyform. The generated turn
 * is a grid of poses over the head-pose axes and reads no binding on its way
 * past, so every word below is still the one it was, the five facial hairs
 * included. That is the check, not a footnote to it: a follow that had needed
 * a re-signing would have been a follow that re-proportioned the turn.
 *
 * So the turn is signed. Each word is the number of head-pose keyforms the
 * face carries and a digest of them exactly as they are written -- ids, axes,
 * cells, values, in the order the generator wrote them -- captured from the
 * code as it stood before the profiles existed. Install the asset on the
 * template, read the keyforms back, and the word must be the one below.
 *
 * A word only changes when the *look* changes. Recapturing one is therefore a
 * deliberate act: run the test, read the word it says it found, and put it
 * here in the same commit as the change that earned it.
 *
 * **Not one word moved when the lids, the hat, the spiky hair and the artboard
 * changed**, and that is the interesting half of it. The eyelids are drawn
 * eight units lower and six units higher, the top hat's crown is back to the 78
 * a top hat has, the spiky hair stands two units above the origin again, and
 * the page grew sixty units upwards over the head -- and none of it is anything
 * the turn reads. A drawing changing while the turn does not is exactly what
 * these words are here to say out loud.
 */
import { createHash } from 'node:crypto';
import { isHeadPoseKeyform } from '../../head-pose/head-pose-model.js';

/**
 * How many head-pose keyforms a face carries, and what they say.
 *
 * The whole keyform is in the word, not a summary of it: a digest over what
 * is actually stored catches a field nobody thought to compare as readily as
 * a value that moved in the fourth decimal.
 */
export function headTurnWord(keyforms = []) {
  const turn = (keyforms || []).filter(isHeadPoseKeyform);
  return `${turn.length}:${createHash('sha256').update(JSON.stringify(turn)).digest('hex').slice(0, 16)}`;
}

/** The template's own shipped turn, before anything is installed on it. */
export const TEMPLATE_HEAD_TURN = '139:9ae6b641b1d414e9';

/**
 * One word per built-in asset, installed on the template face.
 *
 * Several of them are the template's own word, and that is the point: a head
 * asset is a skull inside the group that turns, and facial hair and the
 * accessories are in no turn at all yet, so installing one leaves the grid
 * exactly as the template shipped it.
 */
export const BUILTIN_HEAD_TURNS = Object.freeze({
  'head.round': '139:9ae6b641b1d414e9',
  'head.oval': '139:9ae6b641b1d414e9',
  'head.wide': '139:9ae6b641b1d414e9',
  'head.narrow': '139:9ae6b641b1d414e9',
  'head.square-soft': '139:9ae6b641b1d414e9',
  'head.pear': '139:9ae6b641b1d414e9',
  'head.chin': '139:9ae6b641b1d414e9',
  'head.heart': '139:9ae6b641b1d414e9',
  'eyes.round-large': '139:620f5cafd8c98fa2',
  'eyes.round-small': '139:620f5cafd8c98fa2',
  'eyes.sleepy': '139:620f5cafd8c98fa2',
  'eyes.cartoon': '139:620f5cafd8c98fa2',
  'eyes.minimal': '139:620f5cafd8c98fa2',
  'eyebrows.thin': '139:e0f8bbe9e363dfa3',
  'eyebrows.normal': '139:e0f8bbe9e363dfa3',
  'eyebrows.thick': '139:e0f8bbe9e363dfa3',
  'eyebrows.flat': '139:e0f8bbe9e363dfa3',
  'eyebrows.expressive': '139:e0f8bbe9e363dfa3',
  'nose.dot': '139:24c56466f3ede337',
  'nose.hook': '139:24c56466f3ede337',
  'nose.soft': '139:24c56466f3ede337',
  'nose.cartoon': '139:24c56466f3ede337',
  'mouth.simple': '125:1f5e3e299cb93ba4',
  'mouth.wide': '132:f365832ec36a453a',
  'mouth.small': '125:1f5e3e299cb93ba4',
  'mouth.cartoon': '139:2f2375adaccd78f8',
  'mouth.expressive': '125:1f5e3e299cb93ba4',
  'ears.round': '139:2037322dbede7c5e',
  'ears.large': '139:2037322dbede7c5e',
  'ears.small': '139:2037322dbede7c5e',
  'hair.short': '132:079f6f1e6c58ee43',
  'hair.spiky': '125:863348d608d9f359',
  'hair.curly': '132:079f6f1e6c58ee43',
  'hair.long': '139:ce7097364ac0b456',
  'hair.balding': '132:079f6f1e6c58ee43',
  'hair.bald': '125:863348d608d9f359',
  'facialhair.moustache': '146:736918798eca32c1',
  'facialhair.large-moustache': '146:736918798eca32c1',
  'facialhair.goatee': '146:4bccaf8818b87571',
  'facialhair.beard': '146:13137637a8780b25',
  'facialhair.sideburns': '146:096ed1ca82b113a7',
  'accessory.glasses': '146:b60a1e459dded90a',
  'accessory.square-glasses': '146:b60a1e459dded90a',
  'accessory.hat': '146:72e5cf657d1abd1d',
  'accessory.earring': '146:59629a7f1b4bf6fa',
  'accessory.earring-right': '146:59629a7f1b4bf6fa',
  'accessory.bow-tie': '146:2e0f14946f924b9c'
});
