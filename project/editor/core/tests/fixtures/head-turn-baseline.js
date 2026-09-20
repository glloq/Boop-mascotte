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
 *
 * **A hundred and seventeen moved in V6, and all of them by the same twenty-one
 * channels.** The mouth grew three shapes: a lower row of teeth, the tongue's
 * tip, and the crease down that tip -- the last two drawn in front of the lips,
 * because that is where a tongue hanging out is (docs/MOUTH_BUILD.md). All
 * three travel with the lip line -- an open mouth whose insides stayed put as
 * the head turned would come apart -- so the generator writes its seven
 * channels for each of them, and the template's 139 becomes 160. Every head,
 * every pair of eyes, every brow, nose, ear and head of hair moved by exactly
 * that, because none of them touches the mouth: what changed is the face they
 * are installed on.
 *
 * The fifteen that did **not** move are the fifteen that replace the mouth
 * with one of their own -- the animal ω, the six beaks and the four grilles --
 * and none of those draws a row of teeth or a tongue. A pack that takes the
 * whole mouth away is unaffected by the mouth growing, which is the mechanism
 * working rather than a gap in it.
 *
 * **And a hundred and seventeen moved again, by seven more**, when the mouth
 * grew a uvula: the drop at the back of a shouting mouth, which hangs from the
 * upper lip and therefore travels with it like every other inside
 * (docs/MOUTH_BUILD.md, "The uvula"). The template's 160 becomes 167. The same
 * fifteen did not move, for the same reason, and no other number in this file
 * changed -- which is the check that says one element was added and nothing was
 * re-proportioned on the way.
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
export const TEMPLATE_HEAD_TURN = '167:2819fd6c5fcd8a1a';

/**
 * One word per built-in asset, installed on the template face.
 *
 * Several of them are the template's own word, and that is the point: a head
 * asset is a skull inside the group that turns, and facial hair and the
 * accessories are in no turn at all yet, so installing one leaves the grid
 * exactly as the template shipped it.
 */
export const BUILTIN_HEAD_TURNS = Object.freeze({
  'head.round': '167:2819fd6c5fcd8a1a',
  'head.oval': '167:2819fd6c5fcd8a1a',
  'head.wide': '167:2819fd6c5fcd8a1a',
  'head.narrow': '167:2819fd6c5fcd8a1a',
  'head.square-soft': '167:2819fd6c5fcd8a1a',
  'head.pear': '167:2819fd6c5fcd8a1a',
  'head.chin': '167:2819fd6c5fcd8a1a',
  'head.heart': '167:2819fd6c5fcd8a1a',
  /* The three builds (docs/EYE_BUILDS.md) replaced seventeen drawings that were
   * one construction at different radii, and **the word did not move**: a
   * `simple` eye and an `iris` eye sign exactly what `eyes.round-large` signed,
   * socket and sliding lids and all. That is the check worth having here. A
   * turn is generated from roles and profiles, never from path data, so
   * rebuilding an eye out of an ellipse scaled about its rim instead of a path
   * parked outside a mask is a drawing change and not a look change -- and if
   * it had re-proportioned a single sample, this line would say so.
   *
   * The dot is its own word, and has to be: it draws a pupil and nothing else,
   * so there is no white, no outline and no pair of lids for the generator to
   * write channels for. Twenty-eight fewer channels, which is four elements'
   * worth -- exactly the four a dot does not draw, twice over for two eyes. */
  'eyes.dot': '139:0de40f5842d29859',
  'eyes.simple': '167:14154a05b523b325',
  'eyes.iris': '167:14154a05b523b325',
  'eyebrows.thin': '167:389c3a9cb976caa1',
  'eyebrows.normal': '167:389c3a9cb976caa1',
  'eyebrows.thick': '167:389c3a9cb976caa1',
  'eyebrows.flat': '167:389c3a9cb976caa1',
  'eyebrows.expressive': '167:389c3a9cb976caa1',
  'nose.dot': '167:cda33fadcdcfda43',
  'nose.hook': '167:cda33fadcdcfda43',
  'nose.soft': '167:cda33fadcdcfda43',
  'nose.cartoon': '167:cda33fadcdcfda43',
  /* One mouth where there were five, and it signs the template's own word: the
   * card draws the same five shapes the template does -- the lips, two rows of
   * teeth, the tongue and its tip -- so installing it over the template writes
   * the same grid back (docs/MOUTH_BUILD.md). It was 139 before V6, which was
   * the template's own 125 plus the seven channels for each of the two shapes
   * a mouth then drew inside its lips. The five it replaced differed by a
   * radius, a fill and whether the teeth were drawn -- a size, a palette and a
   * movement -- and not one of them could pucker, which is the control the
   * vowels turn on. */
  'mouth.full': '167:b804bf192cb9f6c7',
  'ears.round': '167:9a5da4aa19e3da6c',
  'ears.large': '167:9a5da4aa19e3da6c',
  'ears.small': '167:9a5da4aa19e3da6c',
  'hair.short': '160:58cb3331c48b42b5',
  'hair.spiky': '153:157a4827eb34d968',
  'hair.curly': '160:58cb3331c48b42b5',
  'hair.long': '167:402816edab0df9bb',
  'hair.balding': '160:58cb3331c48b42b5',
  'hair.bald': '153:157a4827eb34d968',
  'facialhair.moustache': '174:4b8df66ab35c2076',
  'facialhair.large-moustache': '174:4b8df66ab35c2076',
  'facialhair.goatee': '174:940a19d9168779ca',
  'facialhair.beard': '174:ecb07de33b7af153',
  'facialhair.sideburns': '174:71af7ad6881ffc5c',
  'accessory.glasses': '174:420f3bce43deabca',
  'accessory.square-glasses': '174:420f3bce43deabca',
  'accessory.hat': '174:8b1eafaa9c872264',
  'accessory.earring': '174:7f71bc091ea0b315',
  'accessory.earring-right': '174:7f71bc091ea0b315',
  'accessory.bow-tie': '174:2bf15feacdaa8615',

  /* ── The animal pack (MASC-10B) ────────────────────────────────────────
   * Thirty drawings arriving at once, and every word below is one of the
   * words this library already generated:
   *
   * ```text
   * head.animal-*      the template's own, as every human skull's is
   * eyebrows.*         eyebrows.thin's
   * nose.*             nose.dot's
   * mouth.animal-*     mouth.small's, and the open one mouth.wide's shape of it
   * ```
   *
   * A turn is generated from roles and profiles, never from path data, so a
   * new drawing in an old category signs as that category: all forty-five of
   * these carry one of six words, and five of the six are words the human
   * library already had. The two that are genuinely new are the ones that had
   * to be: the **ears**, which declare a profile where the three shipped pairs
   * declare none — an ear on top of a skull sweeps round, an ear at the side of
   * one does not — and the **muzzles and whiskers**, which are accessories and
   * so write the seven channels of one more element, exactly as the glasses and
   * the hat do.
   *
   * The pack's six eyes are not here because the pack no longer has any: all
   * six were the shipped construction at other radii, and the three builds
   * above serve a muzzle exactly as they serve a face.
   */
  'head.animal-round': '167:2819fd6c5fcd8a1a',
  'head.animal-narrow': '167:2819fd6c5fcd8a1a',
  'head.animal-wide': '167:2819fd6c5fcd8a1a',
  'head.animal-square': '167:2819fd6c5fcd8a1a',
  'head.animal-small': '167:2819fd6c5fcd8a1a',
  'head.animal-chubby': '167:2819fd6c5fcd8a1a',
  'eyebrows.animal-thin-soft': '167:389c3a9cb976caa1',
  'eyebrows.animal-firm': '167:389c3a9cb976caa1',
  'eyebrows.animal-thick': '167:389c3a9cb976caa1',
  'eyebrows.animal-friendly-raised': '167:389c3a9cb976caa1',
  'eyebrows.animal-worried': '167:389c3a9cb976caa1',
  'ears.cat-pointed': '167:1e82cb84fcf6bae5',
  'ears.fox-large-pointed': '167:1e82cb84fcf6bae5',
  'ears.wolf-pointed': '167:1e82cb84fcf6bae5',
  'ears.dog-folded': '167:1e82cb84fcf6bae5',
  'ears.bear-round': '167:1e82cb84fcf6bae5',
  'ears.rabbit-long': '167:1e82cb84fcf6bae5',
  'ears.small-round': '167:1e82cb84fcf6bae5',
  'ears.tufted': '167:1e82cb84fcf6bae5',
  'accessory.muzzle-feline-short': '174:607c6441d8154261',
  'accessory.muzzle-feline-rounded': '174:607c6441d8154261',
  'accessory.muzzle-canine-medium': '174:607c6441d8154261',
  'accessory.muzzle-canine-narrow': '174:607c6441d8154261',
  'accessory.muzzle-bear-broad': '174:607c6441d8154261',
  'accessory.muzzle-rodent-small': '174:607c6441d8154261',
  'nose.triangle-small': '167:cda33fadcdcfda43',
  'nose.bear-broad': '167:cda33fadcdcfda43',
  'nose.button-tiny': '167:cda33fadcdcfda43',
  'nose.oval-soft': '167:cda33fadcdcfda43',
  'nose.animal-rounded': '167:cda33fadcdcfda43',
  'mouth.animal-smile': '125:1f5e3e299cb93ba4',
  'mouth.animal-neutral': '125:1f5e3e299cb93ba4',
  'mouth.animal-open-friendly': '132:a759af09698359d4',
  'mouth.animal-small-smile': '125:1f5e3e299cb93ba4',
  'mouth.animal-happy-curve': '125:1f5e3e299cb93ba4',
  'accessory.whiskers-three-straight': '174:ee219a92b5247edd',
  'accessory.whiskers-two-soft': '174:ee219a92b5247edd',
  'accessory.whiskers-long-curved': '174:ee219a92b5247edd',
  'accessory.whiskers-subtle-short': '174:ee219a92b5247edd',

  /**
   * The Soft Cartoon robot pack (MASC-11B), and the shortest reading in this
   * file: twenty-eight drawings, six words, and **four of the six are words the
   * library already had**.
   *
   * The shells sign as `head.round`, the eyes as `eyes.round-large`, the visors
   * as `eyebrows.thin`, the speakers as `mouth.small` — a turn is generated from
   * roles and profiles, never from path data, so a new drawing in an old
   * category signs as that category however little it looks like one.
   *
   * The side modules are the interesting line. They sign as `ears.round`,
   * *exactly*, because they say nothing about the turn and sit where a person's
   * ears sit — which is MASC-11A's mapping decision confirming itself: a module
   * where an ear goes really does behave as an ear, and calling it one bought
   * `earWiggle` for the price of a slot name.
   *
   * So only the antennae and the panels are new, and they had to be: an
   * accessory that says nothing does not turn at all, and these are the first
   * drawings either slot has ever had. An antenna stands well off the crown and
   * sweeps (`depth 0.35`); a panel is flush with the shell and barely moves
   * against it (`0.08`). Two profiles, two words.
   */
  'head.robot-screen-rounded': '167:2819fd6c5fcd8a1a',
  'head.robot-retro-square': '167:2819fd6c5fcd8a1a',
  'head.robot-industrial-plate': '167:2819fd6c5fcd8a1a',
  'head.robot-toy-round': '167:2819fd6c5fcd8a1a',
  'ears.robot-screen-round': '167:9a5da4aa19e3da6c',
  'ears.robot-retro-round': '167:9a5da4aa19e3da6c',
  'ears.robot-industrial-bolt': '167:9a5da4aa19e3da6c',
  'ears.robot-toy-colorful': '167:9a5da4aa19e3da6c',
  'eyes.robot-display-friendly': '167:14154a05b523b325',
  'eyes.robot-retro-led': '167:14154a05b523b325',
  'eyes.robot-industrial-led': '167:14154a05b523b325',
  'eyes.robot-toy-expressive': '167:14154a05b523b325',
  'eyebrows.robot-screen-simple': '167:389c3a9cb976caa1',
  'eyebrows.robot-retro-plate': '167:389c3a9cb976caa1',
  'eyebrows.robot-industrial-visor': '167:389c3a9cb976caa1',
  'eyebrows.robot-toy-cute': '167:389c3a9cb976caa1',
  'mouth.robot-display': '125:1f5e3e299cb93ba4',
  'mouth.robot-retro-grille': '125:1f5e3e299cb93ba4',
  'mouth.robot-industrial-vent': '125:1f5e3e299cb93ba4',
  'mouth.robot-toy-simple': '132:a759af09698359d4',
  'accessory.antenna-single-short': '174:18ba9674bd94ff1d',
  'accessory.antenna-retro-multi': '174:18ba9674bd94ff1d',
  'accessory.antenna-industrial-robust': '174:18ba9674bd94ff1d',
  'accessory.antenna-toy-fun': '174:18ba9674bd94ff1d',
  'accessory.panels-light-panel': '174:5688402dc599079a',
  'accessory.panels-retro-buttons': '174:5688402dc599079a',
  'accessory.panels-warning-stripe': '174:5688402dc599079a',
  'accessory.panels-toy-buttons': '174:5688402dc599079a',

  /**
   * The Soft Cartoon bird pack (MASC-12B), and the one row in this file that
   * does not behave.
   *
   * The heads, the eyes and the brows sign as their categories do, as every
   * pack's have: one word each, and all three of those words were already here.
   * The crests take the word the robot antennae take, which is right and worth
   * noticing -- the two slots are different, but both are accessories standing
   * off the crown at `head.top` declaring the same `depth: 0.35`, so the turn
   * they generate is the same turn. The monocle is its own word, being the only
   * accessory in the library anchored to `eye.right`.
   *
   * **The beaks sign five words between six drawings**, and nothing else in the
   * library does that inside one row. What is recorded here is the observation,
   * not a mechanism: a beak is the only part in the pack whose role names a `<g>`
   * of two paths rather than a single shape, and the six sit at six different
   * heights on the face -- well above the lip line, because a beak takes the
   * middle of a bird's face where a mouth sits low on a person's. Two of them
   * (`beak-crow` and `beak-small`) share a word and their reference boxes share
   * a centre; the other four differ in both. That is as far as the evidence
   * goes, and the baseline's job is to notice if any of it changes, not to
   * explain it.
   */
  'head.bird-owl': '167:2819fd6c5fcd8a1a',
  'head.bird-duck': '167:2819fd6c5fcd8a1a',
  'head.bird-parrot': '167:2819fd6c5fcd8a1a',
  'head.bird-crow': '167:2819fd6c5fcd8a1a',
  'head.bird-cute': '167:2819fd6c5fcd8a1a',
  'head.bird-slim': '167:2819fd6c5fcd8a1a',
  'eyebrows.bird-angry': '167:389c3a9cb976caa1',
  'eyebrows.bird-curious': '167:389c3a9cb976caa1',
  'eyebrows.bird-relaxed': '167:389c3a9cb976caa1',
  'eyebrows.bird-happy': '167:389c3a9cb976caa1',
  'eyebrows.bird-sharp': '167:389c3a9cb976caa1',
  'mouth.beak-owl': '125:0d2371fb57715b8f',
  'mouth.beak-duck': '125:8c5e01f47dbb97d5',
  'mouth.beak-parrot': '125:ea54b64639c451a0',
  'mouth.beak-crow': '125:38c8fde69a9378dc',
  'mouth.beak-small': '125:38c8fde69a9378dc',
  'mouth.beak-wide': '125:1f5e3e299cb93ba4',
  'accessory.crest-owl-tufts': '174:18ba9674bd94ff1d',
  'accessory.crest-simple': '174:18ba9674bd94ff1d',
  'accessory.crest-messy-tuft': '174:18ba9674bd94ff1d',
  'accessory.crest-smooth-feather': '174:18ba9674bd94ff1d',
  'accessory.crest-parrot-tall': '174:18ba9674bd94ff1d',
  'accessory.crest-round-tuft': '174:18ba9674bd94ff1d',
  'accessory.monocle': '174:200f26fb9b960aa4'
});
