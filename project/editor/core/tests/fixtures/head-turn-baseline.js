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
 * So the turn is signed. Each word is the number of head-pose keyforms the
 * face carries and a digest of them exactly as they are written -- ids, axes,
 * cells, values, in the order the generator wrote them -- captured from the
 * code as it stood before the profiles existed. Install the asset on the
 * template, read the keyforms back, and the word must be the one below.
 *
 * A word only changes when the *look* changes. Recapturing one is therefore a
 * deliberate act: run the test, read the word it says it found, and put it
 * here in the same commit as the change that earned it.
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
  'head.square-soft': '139:9ae6b641b1d414e9',
  'head.narrow': '139:9ae6b641b1d414e9',
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
  'facialhair.moustache': '139:9ae6b641b1d414e9',
  'facialhair.large-moustache': '139:9ae6b641b1d414e9',
  'facialhair.goatee': '139:9ae6b641b1d414e9',
  'facialhair.beard': '139:9ae6b641b1d414e9',
  'facialhair.sideburns': '139:9ae6b641b1d414e9',
  'accessory.glasses': '139:9ae6b641b1d414e9',
  'accessory.square-glasses': '139:9ae6b641b1d414e9',
  'accessory.hat': '139:9ae6b641b1d414e9',
  'accessory.earring': '139:9ae6b641b1d414e9',
  'accessory.bow-tie': '139:9ae6b641b1d414e9'
});
