// Simple Motion presets: named movements over time described over basic
// semantic controls. A preset compiles deterministically to an ordinary
// animation clip (keyframe tracks); the clip keeps its preset settings so the
// Motion Inspector can change amplitude, duration and repeats without the
// Timeline (docs/ADR_MOTIONS.md). Presets are data; nothing is authored
// until the user adds one.
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';
import { controlMeta } from '../../ui/control-catalog.js';

const shape = (...keys) => Object.freeze(keys.map(([t, v, easing = 'easeInOut']) => Object.freeze({ t, v, easing })));
/**
 * One slot of a preset: the movement it wants, the movements it will settle
 * for, and the shape it draws on whichever it gets.
 *
 * `pose` marks a slot that wants a **hand**, not a quantity. A hand made of
 * drawings has no `handRPoint` to raise: it has one `handRPose` whose value is
 * a choice, so the slot resolves to that parameter and compiles to a step
 * track at the chosen hand's own place in it (docs/HANDS_2D.md). The control
 * keeps the pose-specific name so a mascot that cannot point yet is told it
 * needs a Point rather than "a pose".
 */
const slot = (control, fallbacks, keys, { pose = null } = {}) => Object.freeze({ control, fallbacks: Object.freeze(fallbacks), shape: keys, ...(pose ? { pose } : {}) });

/** The parameter that chooses a hand by name, and where that hand sits in it. */
function poseParameter(params = {}, pose = '') {
  for (const [name, param] of Object.entries(params)) {
    const index = Array.isArray(param?.options) ? param.options.indexOf(pose) : -1;
    if (index >= 0) return { name, index };
  }
  return null;
}

/** Group order, used by the catalogue UI. The first one opens by default. */
export const MOTION_PRESET_GROUPS = Object.freeze(['Head', 'Eyes', 'Face', 'Hands']);

const motion = (group, id, name, description, slots, defaults) => Object.freeze({ id, name, description, group, slots, defaults: Object.freeze(defaults) });

/**
 * The catalogue.
 *
 * It was written against the movements a face had before the control rig
 * (docs/FACE_CONTROL_RIG.md) gave it any others: head, gaze, `eyeOpen`,
 * `browRaise`, `smile`, `mouthOpen`. Everything the rig added since — a jaw
 * that drops on its own, a brow whose two ends disagree, one eye that closes
 * without the other, pupils that dilate, a tongue, a lock that keeps the lips
 * together while the jaw works — was reachable only key by key in the
 * Timeline, which is the timeline these presets exist to avoid.
 *
 * So the presets below use them. Some of it is *depth* on motions that already
 * existed: a gasp dilates the pupils and drops the jaw, a yawn is a jaw and a
 * tongue rather than a wide `mouthOpen`, a laugh shows teeth, a sigh lifts the
 * inner brows. The rest are motions that could not be built at all before —
 * a wink, a smirk, a raised eyebrow, crossed eyes, chewing with the mouth shut.
 */
export const MOTION_PRESETS = Object.freeze([
  // Head: the movements a whole mascot makes.
  motion('Head', 'nod', 'Nod', 'The head dips and comes back.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.5, 1], [1, 0]))], { amplitude: .5, duration: .8, repeats: 1 }),
  motion('Head', 'shake', 'Shake', 'The head turns left, right and back.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.25, -1], [.75, 1], [1, 0]))], { amplitude: .5, duration: .8, repeats: 2 }),
  motion('Head', 'bounce', 'Bounce', 'The head hops up and settles.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.55, 0, 'easeIn'], [.75, -.35, 'easeOut'], [1, 0, 'easeIn']))], { amplitude: .6, duration: .7, repeats: 1 }),
  // The brows lean a beat after the head. `browTilt` leans both the same way,
  // which is the one thing it is good for and the one thing nothing used it for.
  motion('Head', 'tilt', 'Tilt', 'The head leans to one side, the brows lean with it, and both return.', [slot('headTilt', [], shape([0, 0, 'linear'], [.35, 1, 'easeOut'], [.65, 1, 'linear'], [1, 0])), slot('browTilt', [], shape([0, 0, 'linear'], [.45, 1, 'easeOut'], [.7, .9, 'linear'], [1, 0]))], { amplitude: .5, duration: 1, repeats: 1 }),
  // The pop is a beat of surprise, so the eyes do what surprised eyes do: the
  // pupils open. `pupilScale` is the whole reason this reads as a reaction now
  // and not as a head moving up and down.
  motion('Head', 'head-pop', 'Head Pop', 'The head jumps up, the mouth opens and the eyes go wide.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.2, -1, 'easeOut'], [.5, 0, 'easeIn'], [1, 0, 'linear'])), slot('mouthOpen', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.6, 0, 'easeIn'], [1, 0, 'linear'])), slot('pupilScale', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.55, .5, 'linear'], [1, 0]))], { amplitude: .7, duration: .6, repeats: 1 }),
  // A full circle: the clearest way to show a 2.5D head turn off.
  motion('Head', 'head-roll', 'Head Roll', 'The head rolls all the way around, once.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.25, 1], [.5, 0], [.75, -1], [1, 0])), slot('headY', [], shape([0, 0, 'linear'], [.125, -1], [.375, 0], [.625, 1], [.875, 0], [1, 0]))], { amplitude: .5, duration: 1.6, repeats: 1 }),
  // The eyes get there first. A double take is a head catching up with a look,
  // and giving the gaze its own lead is what makes it read as one.
  motion('Head', 'double-take', 'Double Take', 'A glance away, then a sharp look back with the eyes leading.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.15, .6, 'easeOut'], [.3, 0, 'easeIn'], [.45, -1, 'easeOut'], [.7, -.9, 'linear'], [1, 0])), slot('lookX', [], shape([0, 0, 'linear'], [.1, .8, 'easeOut'], [.28, 0, 'easeIn'], [.4, -1, 'easeOut'], [.7, -.8, 'linear'], [1, 0])), slot('pupilScale', [], shape([0, 0, 'linear'], [.4, 0, 'linear'], [.5, 1, 'easeOut'], [.8, .3, 'linear'], [1, 0]))], { amplitude: .7, duration: 1, repeats: 1 }),
  motion('Head', 'wobble', 'Wobble', 'The head rocks side to side and settles.', [slot('headTilt', ['headX'], shape([0, 0, 'linear'], [.2, 1], [.45, -.7], [.7, .4], [1, 0]))], { amplitude: .5, duration: .9, repeats: 1 }),
  motion('Head', 'peek', 'Peek', 'The eyes go first, then the head leans out to look.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.7, 1, 'linear'], [1, 0])), slot('lookX', [], shape([0, 0, 'linear'], [.12, 1, 'easeOut'], [.75, 1, 'linear'], [1, 0]))], { amplitude: .8, duration: 1.4, repeats: 1 }),
  motion('Head', 'shiver', 'Shiver', 'A fast little tremble, with the brows drawn up in the middle.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.15, 1, 'linear'], [.35, -1, 'linear'], [.55, 1, 'linear'], [.75, -1, 'linear'], [1, 0, 'linear'])), slot('browInner', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.8, 1, 'linear'], [1, 0]))], { amplitude: .12, duration: .5, repeats: 3 }),
  // Two movements a face has always had and no motion has ever used.
  motion('Head', 'ear-perk', 'Ears Perk', 'The ears flick up and settle, like something was heard.', [slot('earWiggle', [], shape([0, 0, 'linear'], [.18, 1, 'easeOut'], [.45, .3, 'easeIn'], [.65, .6, 'easeOut'], [1, 0])), slot('headTilt', [], shape([0, 0, 'linear'], [.25, .4, 'easeOut'], [.7, .35, 'linear'], [1, 0]))], { amplitude: .8, duration: .8, repeats: 1 }),
  motion('Head', 'hair-toss', 'Hair Toss', 'The head turns and the hair follows it a beat later.', [slot('hairSway', [], shape([0, 0, 'linear'], [.4, -1, 'easeOut'], [.72, .4, 'easeInOut'], [1, 0])), slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.3, -1, 'easeOut'], [.6, .3, 'easeInOut'], [1, 0])), slot('hairLift', [], shape([0, 0, 'linear'], [.35, 1, 'easeOut'], [.75, -.2, 'easeInOut'], [1, 0]))], { amplitude: .7, duration: 1.1, repeats: 1 }),

  // Eyes: gaze and lids only, so they layer over anything the head is doing.
  motion('Eyes', 'look-around', 'Look Around', 'The eyes sweep left, then right, glancing up.', [slot('lookX', [], shape([0, 0, 'linear'], [.2, -1], [.5, -1, 'linear'], [.7, 1], [1, 0])), slot('lookY', [], shape([0, 0, 'linear'], [.35, -.5], [.65, -.5, 'linear'], [1, 0]))], { amplitude: .8, duration: 2, repeats: 1 }),
  motion('Eyes', 'eye-dart', 'Eye Dart', 'A quick glance to the side and back.', [slot('lookX', ['lookY'], shape([0, 0, 'linear'], [.12, 1, 'easeOut'], [.4, 1, 'linear'], [.52, 0, 'easeOut'], [1, 0, 'linear']))], { amplitude: .9, duration: .6, repeats: 1 }),
  motion('Eyes', 'look-up', 'Look Up', 'The eyes go up, the brows go with them, and both come back.', [slot('lookY', ['lookX'], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.7, -1, 'linear'], [1, 0])), slot('browRaise', [], shape([0, 0, 'linear'], [.25, .7, 'easeOut'], [.7, .6, 'linear'], [1, 0]))], { amplitude: .8, duration: 1.2, repeats: 1 }),
  motion('Eyes', 'blink', 'Blink', 'The eyes close and open again.', [slot('eyeOpen', [], shape([0, 0, 'linear'], [.3, -1, 'easeIn'], [.5, -1, 'linear'], [.8, 0, 'easeOut'], [1, 0, 'linear']))], { amplitude: 1, duration: .35, repeats: 1 }),
  // One eye. The eyelids have carried a per-side offset since the control rig
  // went in and nothing had ever asked for it.
  motion('Eyes', 'wink', 'Wink', 'One eye closes and the mouth pulls up on that side.', [slot('eyeOpenLeft', ['eyeOpenRight'], shape([0, 0, 'linear'], [.28, -1, 'easeIn'], [.55, -1, 'linear'], [.85, 0, 'easeOut'], [1, 0, 'linear'])), slot('smileLeft', ['smile'], shape([0, 0, 'linear'], [.28, .5, 'easeOut'], [.7, .45, 'linear'], [1, 0]))], { amplitude: .9, duration: .7, repeats: 1 }),
  motion('Eyes', 'squint', 'Squint', 'The lids come halfway down and the brows draw in.', [slot('eyeOpen', [], shape([0, 0, 'linear'], [.25, -.55, 'easeOut'], [.7, -.55, 'linear'], [1, 0])), slot('browInner', [], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.7, -1, 'linear'], [1, 0]))], { amplitude: .8, duration: 1, repeats: 1 }),
  // Wide eyes are not a wider `eyeOpen` -- the lids are already off the eye at
  // rest. They are the pupils opening, which is what `pupilScale` is for.
  motion('Eyes', 'wide-eyes', 'Wide Eyes', 'The pupils open and the brows go up: something just happened.', [slot('pupilScale', [], shape([0, 0, 'linear'], [.18, 1, 'easeOut'], [.65, .85, 'linear'], [1, 0])), slot('browRaise', [], shape([0, 0, 'linear'], [.18, 1, 'easeOut'], [.65, .9, 'linear'], [1, 0]))], { amplitude: .8, duration: .9, repeats: 1 }),
  motion('Eyes', 'cross-eyes', 'Cross Eyes', 'The two eyes look at each other, then straighten out.', [slot('lookXLeft', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.7, 1, 'linear'], [1, 0])), slot('lookXRight', [], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.7, -1, 'linear'], [1, 0]))], { amplitude: .55, duration: 1.1, repeats: 1 }),
  // Dizzy is the two eyes disagreeing, which is a thing a face with one `lookY`
  // simply cannot do -- hence the per-eye offsets as the lead, and no fallback.
  motion('Eyes', 'dizzy', 'Dizzy', 'The eyes roll out of step and one pupil swells: seeing stars.', [slot('lookYLeft', [], shape([0, 0, 'linear'], [.25, -1], [.5, 0], [.75, 1], [1, 0])), slot('lookYRight', [], shape([0, 0, 'linear'], [.25, 1], [.5, 0], [.75, -1], [1, 0])), slot('lookX', [], shape([0, 0, 'linear'], [.25, .6], [.5, 0], [.75, -.6], [1, 0])), slot('pupilScaleLeft', ['pupilScale'], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.7, .3, 'linear'], [1, 0]))], { amplitude: .45, duration: 1.3, repeats: 2 }),

  // Face: brows and mouth, the small beats that sell a reaction.
  motion('Face', 'brow-flash', 'Brow Flash', 'The brows jump up and drop back: hello, or surprise.', [slot('browRaise', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.55, 1, 'linear'], [1, 0]))], { amplitude: .8, duration: .5, repeats: 1 }),
  motion('Face', 'smile-flash', 'Smile', 'A smile grows, holds, and relaxes.', [slot('smile', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.6, 1, 'linear'], [1, 0]))], { amplitude: .9, duration: 1.2, repeats: 1 }),
  motion('Face', 'gasp', 'Gasp', 'The jaw drops, the pupils open and the brows shoot up as the head pulls back.', [slot('mouthOpen', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.6, .8, 'linear'], [1, 0])), slot('jawOpen', [], shape([0, 0, 'linear'], [.15, .7, 'easeOut'], [.6, .55, 'linear'], [1, 0])), slot('browRaise', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.6, .9, 'linear'], [1, 0])), slot('pupilScale', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.6, .7, 'linear'], [1, 0])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.15, -.35, 'easeOut'], [.6, -.3, 'linear'], [1, 0]))], { amplitude: .9, duration: .8, repeats: 1 }),
  // A yawn is a jaw, not a wide mouth: the lower face lengthens, the tongue
  // shows, and the eyes shut on the way.
  motion('Face', 'yawn', 'Yawn', 'The jaw drops wide with the eyes shut and the head rolling back.', [slot('mouthOpen', [], shape([0, 0, 'linear'], [.3, .8, 'easeOut'], [.6, .8, 'linear'], [1, 0])), slot('jawOpen', [], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.6, 1, 'linear'], [1, 0])), slot('tongue', [], shape([0, 0, 'linear'], [.35, .7, 'easeOut'], [.6, .6, 'linear'], [1, 0])), slot('eyeOpen', [], shape([0, 0, 'linear'], [.3, -1], [.7, -1, 'linear'], [1, 0])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.3, -.6], [.7, .3], [1, 0]))], { amplitude: .9, duration: 2, repeats: 1 }),
  motion('Face', 'laugh', 'Laugh', 'The jaw pulses open on a wide smile while the head bobs.', [slot('mouthOpen', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.5, .2, 'easeIn'], [.75, .9, 'easeOut'], [1, 0, 'easeIn'])), slot('jawOpen', [], shape([0, 0, 'linear'], [.2, .8, 'easeOut'], [.5, .15, 'easeIn'], [.75, .7, 'easeOut'], [1, 0, 'easeIn'])), slot('smile', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.85, .9, 'linear'], [1, 0])), slot('teeth', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.85, .9, 'linear'], [1, 0])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.5, 0, 'easeIn'], [.75, -.6, 'easeOut'], [1, 0, 'easeIn']))], { amplitude: .7, duration: .9, repeats: 2 }),
  motion('Face', 'sigh', 'Sigh', 'A breath in, then the head drops and the inner brows go up.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.25, -.4, 'easeOut'], [.7, .6, 'easeIn'], [1, 0])), slot('mouthOpen', [], shape([0, 0, 'linear'], [.25, .5, 'easeOut'], [.7, 0, 'easeIn'], [1, 0, 'linear'])), slot('browInner', [], shape([0, 0, 'linear'], [.3, 1], [.75, .8, 'linear'], [1, 0])), slot('browRaise', [], shape([0, 0, 'linear'], [.3, -.6], [.75, -.3, 'linear'], [1, 0]))], { amplitude: .6, duration: 1.8, repeats: 1 }),
  // Everything below is a motion the face could not make until the control rig
  // gave its brows two ends, its mouth two corners and its jaw a lock.
  motion('Face', 'smirk', 'Smirk', 'One corner of the mouth pulls up, and only one.', [slot('smileRight', ['smileLeft'], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.75, .9, 'linear'], [1, 0])), slot('browRaiseRight', ['browRaise'], shape([0, 0, 'linear'], [.3, .5, 'easeOut'], [.75, .45, 'linear'], [1, 0]))], { amplitude: .5, duration: 1.1, repeats: 1 }),
  motion('Face', 'skeptic', 'Raised Eyebrow', 'One brow goes up, the other down: not convinced.', [slot('browRaiseLeft', ['browRaise'], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.8, .95, 'linear'], [1, 0])), slot('browRaiseRight', [], shape([0, 0, 'linear'], [.3, -.6, 'easeOut'], [.8, -.55, 'linear'], [1, 0])), slot('smile', [], shape([0, 0, 'linear'], [.3, -.3], [.8, -.3, 'linear'], [1, 0]))], { amplitude: .55, duration: 1.2, repeats: 1 }),
  motion('Face', 'worry', 'Worry', 'The inner brows climb, the outer ends fall, and the mouth turns down.', [slot('browInner', [], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.75, .95, 'linear'], [1, 0])), slot('browOuter', [], shape([0, 0, 'linear'], [.3, -1, 'easeOut'], [.75, -.9, 'linear'], [1, 0])), slot('smile', [], shape([0, 0, 'linear'], [.3, -.6], [.75, -.6, 'linear'], [1, 0]))], { amplitude: .8, duration: 1.4, repeats: 1 }),
  motion('Face', 'glower', 'Glower', 'The inner brows drop, the lids come down, the mouth tightens.', [slot('browInner', [], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.8, -1, 'linear'], [1, 0])), slot('eyeOpen', [], shape([0, 0, 'linear'], [.25, -.4, 'easeOut'], [.8, -.4, 'linear'], [1, 0])), slot('mouthWidth', [], shape([0, 0, 'linear'], [.25, -.7, 'easeOut'], [.8, -.7, 'linear'], [1, 0]))], { amplitude: .8, duration: 1.3, repeats: 1 }),
  // The lock is the whole point: the jaw works and the lips stay together,
  // which is chewing rather than a mouth opening and closing.
  motion('Face', 'chew', 'Chew', 'The jaw works with the lips held shut.', [slot('jawOpen', [], shape([0, 0, 'linear'], [.3, 1, 'easeInOut'], [.7, .1, 'easeInOut'], [1, 0, 'easeInOut'])), slot('mouthLock', [], shape([0, 1, 'linear'], [1, 1, 'linear']))], { amplitude: .5, duration: .45, repeats: 4 }),
  motion('Face', 'talk', 'Talk', 'The jaw and the lips move together, the way speech looks.', [slot('mouthOpen', [], shape([0, 0, 'linear'], [.25, .9, 'easeOut'], [.5, .05, 'easeIn'], [.75, .6, 'easeOut'], [1, 0, 'easeIn'])), slot('jawOpen', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.5, .1, 'easeIn'], [.75, .7, 'easeOut'], [1, 0, 'easeIn']))], { amplitude: .7, duration: 1, repeats: 2 }),
  motion('Face', 'tongue-out', 'Tongue Out', 'A grin, and the tongue comes out and wags.', [slot('tongue', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.75, 1, 'linear'], [1, 0])), slot('mouthOpen', [], shape([0, 0, 'linear'], [.2, .6, 'easeOut'], [.75, .55, 'linear'], [1, 0])), slot('tongueOut', [], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.75, .9, 'linear'], [1, 0])), slot('tongueX', [], shape([0, 0, 'linear'], [.4, 1], [.6, -1], [.8, .5], [1, 0])), slot('smile', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.75, .9, 'linear'], [1, 0]))], { amplitude: .8, duration: 1.2, repeats: 1 }),
  motion('Face', 'sniff', 'Sniff', 'The nose wrinkles, twice.', [slot('noseScrunch', [], shape([0, 0, 'linear'], [.35, 1, 'easeOut'], [.7, .1, 'easeIn'], [1, 0, 'linear'])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.35, -.25, 'easeOut'], [.7, 0, 'easeIn'], [1, 0, 'linear']))], { amplitude: .8, duration: .4, repeats: 2 }),

  /* ── Hands ────────────────────────────────────────────────────────────────
   *
   * A mascot with floating hands had nothing in this catalogue: the pair came
   * with a Wave and a Hands up written out as clips, and everything else was
   * the Timeline. The lead of each is a hand control, so a face with no hands
   * is not offered a hand motion at all rather than being offered one that
   * quietly animates its head instead (`motionLead`).
   *
   * Four of them are **holds** (docs/HAND_RIGGING.md, "Held to the face"): one
   * number that puts the hand on a named place at the right angle, which is a
   * thing three sliders could reach and no author would find. A hold does not
   * bring the hand out from behind the head, so each raises `handLShow` too --
   * the two are separate questions and both are this motion's to answer.
   */
  // A hand rests fingers *down* beside the mascot (`HAND_REST_TILT`, half a
  // turn), so every pose drawn fingers-up arrives upside down: a thumbs up is a
  // thumbs down until something turns the hand back. A full `handLRotation` is
  // half a turn (`REACH_ROTATION`), so `1` on the left and `-1` on the right is
  // the hand upright — which is where a wave, a point and a thumb belong, and
  // is the first thing each of these does.
  motion('Hands', 'wave-hello', 'Wave hello', 'A hand comes up, waves and goes back down.', [slot('handLRotation', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.38, .62], [.54, 1], [.7, .62], [.84, 1], [1, 0, 'easeIn'])), slot('handLShow', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.8, 1, 'linear'], [1, 0, 'easeIn'])), slot('handLY', [], shape([0, 0, 'linear'], [.18, -.8, 'easeOut'], [.8, -.75, 'linear'], [1, 0, 'easeIn'])), slot('handLSpread', [], shape([0, 0, 'linear'], [.18, 1, 'easeOut'], [.8, 1, 'linear'], [1, 0, 'easeIn']))], { amplitude: .9, duration: 1.6, repeats: 1 }),
  motion('Hands', 'clap', 'Clap', 'Both hands come up and meet, three times.', [slot('handLX', [], shape([0, 0, 'linear'], [.35, 1, 'easeOut'], [.7, .2, 'easeIn'], [1, 0, 'linear'])), slot('handRX', [], shape([0, 0, 'linear'], [.35, -1, 'easeOut'], [.7, -.2, 'easeIn'], [1, 0, 'linear'])), slot('handLShow', [], shape([0, 0, 'linear'], [.12, 1, 'easeOut'], [.9, 1, 'linear'], [1, 0, 'easeIn'])), slot('handRShow', [], shape([0, 0, 'linear'], [.12, 1, 'easeOut'], [.9, 1, 'linear'], [1, 0, 'easeIn'])), slot('handLRotation', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.9, 1, 'linear'], [1, 0, 'easeIn'])), slot('handRRotation', [], shape([0, 0, 'linear'], [.15, -1, 'easeOut'], [.9, -1, 'linear'], [1, 0, 'easeIn'])), slot('handLY', [], shape([0, 0, 'linear'], [.2, -.6, 'easeOut'], [.9, -.6, 'linear'], [1, 0, 'easeIn'])), slot('handRY', [], shape([0, 0, 'linear'], [.2, -.6, 'easeOut'], [.9, -.6, 'linear'], [1, 0, 'easeIn']))], { amplitude: .9, duration: 1.5, repeats: 1 }),
  motion('Hands', 'point-at', 'Point', 'A hand comes up and points, then drops.', [slot('handRPoint', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.8, 1, 'linear'], [1, 0, 'easeIn']), { pose: 'point' }), slot('handRShow', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.85, 1, 'linear'], [1, 0, 'easeIn'])), slot('handRRotation', [], shape([0, 0, 'linear'], [.2, -1, 'easeOut'], [.85, -1, 'linear'], [1, 0, 'easeIn'])), slot('handRY', [], shape([0, 0, 'linear'], [.25, -.5, 'easeOut'], [.85, -.45, 'linear'], [1, 0, 'easeIn'])), slot('handRX', [], shape([0, 0, 'linear'], [.25, .5, 'easeOut'], [.85, .45, 'linear'], [1, 0, 'easeIn']))], { amplitude: .9, duration: 1.4, repeats: 1 }),
  motion('Hands', 'approve', 'Thumbs up', 'A thumb comes up, with a little bounce.', [slot('handRThumbsUp', [], shape([0, 0, 'linear'], [.22, 1, 'easeOut'], [.85, 1, 'linear'], [1, 0, 'easeIn']), { pose: 'thumbsUp' }), slot('handRShow', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.85, 1, 'linear'], [1, 0, 'easeIn'])), slot('handRRotation', [], shape([0, 0, 'linear'], [.2, -1, 'easeOut'], [.85, -1, 'linear'], [1, 0, 'easeIn'])), slot('handRY', [], shape([0, 0, 'linear'], [.22, -.7, 'easeOut'], [.4, -.5, 'easeIn'], [.6, -.7, 'easeOut'], [.85, -.6, 'linear'], [1, 0, 'easeIn'])), slot('smile', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.85, .9, 'linear'], [1, 0]))], { amplitude: .9, duration: 1.3, repeats: 1 }),
  motion('Hands', 'ponder', 'Hand on the chin', 'The hand comes up to the chin and the eyes go up with it.', [slot('handROnChin', ['handLOnChin'], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.8, 1, 'linear'], [1, 0, 'easeIn'])), slot('handRShow', ['handLShow'], shape([0, 0, 'linear'], [.18, 1, 'easeOut'], [.85, 1, 'linear'], [1, 0, 'easeIn'])), slot('lookY', [], shape([0, 0, 'linear'], [.35, -.7, 'easeOut'], [.8, -.6, 'linear'], [1, 0])), slot('headTilt', [], shape([0, 0, 'linear'], [.35, .3, 'easeOut'], [.8, .3, 'linear'], [1, 0]))], { amplitude: .9, duration: 2, repeats: 1 }),
  motion('Hands', 'bashful', 'Hand on the cheek', 'A hand cups the cheek and the head leans into it.', [slot('handROnCheek', ['handLOnCheek'], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.8, 1, 'linear'], [1, 0, 'easeIn'])), slot('handRShow', ['handLShow'], shape([0, 0, 'linear'], [.18, 1, 'easeOut'], [.85, 1, 'linear'], [1, 0, 'easeIn'])), slot('headTilt', [], shape([0, 0, 'linear'], [.35, -.5, 'easeOut'], [.8, -.45, 'linear'], [1, 0])), slot('smile', [], shape([0, 0, 'linear'], [.3, .7, 'easeOut'], [.8, .6, 'linear'], [1, 0]))], { amplitude: .9, duration: 1.8, repeats: 1 }),
  motion('Hands', 'giggle', 'Hand over the mouth', 'A hand goes up over the mouth, and the shoulders go with it.', [slot('handROnMouth', ['handLOnMouth'], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.85, 1, 'linear'], [1, 0, 'easeIn'])), slot('handRShow', ['handLShow'], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.9, 1, 'linear'], [1, 0, 'easeIn'])), slot('smile', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.85, .9, 'linear'], [1, 0])), slot('eyeOpen', [], shape([0, 0, 'linear'], [.3, -.5, 'easeOut'], [.85, -.45, 'linear'], [1, 0])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.35, -.4], [.5, -.1], [.65, -.35], [.85, -.2], [1, 0]))], { amplitude: .9, duration: 1.6, repeats: 1 }),
  motion('Hands', 'facepalm', 'Facepalm', 'The hand lands on the forehead and the head drops into it.', [slot('handLOnForehead', ['handROnForehead'], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.85, 1, 'linear'], [1, 0, 'easeIn'])), slot('handLShow', ['handRShow'], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.9, 1, 'linear'], [1, 0, 'easeIn'])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.3, .6, 'easeOut'], [.85, .55, 'linear'], [1, 0])), slot('eyeOpen', [], shape([0, 0, 'linear'], [.3, -.85, 'easeOut'], [.85, -.8, 'linear'], [1, 0])), slot('browInner', [], shape([0, 0, 'linear'], [.3, -.6], [.85, -.5, 'linear'], [1, 0]))], { amplitude: .95, duration: 2, repeats: 1 })
]);

/* ── Making one, when no ready-made motion covers the movement (VNX-27) ──────
 *
 * The catalogue above is head, eyes and face. A mascot that wiggles its ears,
 * sways its hair, or has a hand pose its author invented has **nothing** in it
 * — and the reason is structural rather than an oversight: a hand's controls
 * are generated (`handLGrip`, `handRThumbsUp`), so no fixed table can name
 * them (VNX-34). Those movements were reachable only through the Timeline,
 * key by key, which is exactly the timeline this item exists to avoid.
 *
 * So the *shapes* the presets are built from become a vocabulary of their own.
 * Pick a movement, pick a shape, and the pair compiles through the same
 * deterministic compiler a preset does — same amplitude, duration and repeats,
 * same "edit a key in the Timeline and it becomes custom" rule, same reset.
 * Nothing downstream knows the difference, which is the point: this adds a way
 * to *name* a motion, not a second kind of motion.
 *
 * Every shape here is one already proven in a shipped preset, which is why
 * there are seven and not twenty. A vocabulary an author has to read twice is
 * a timeline with extra steps.
 */
export const MOTION_SHAPES = Object.freeze([
  Object.freeze({ id: 'dip', name: 'Dip', description: 'Goes one way and comes back.', shape: shape([0, 0, 'linear'], [.5, 1], [1, 0]), defaults: Object.freeze({ amplitude: .5, duration: .8, repeats: 1 }) }),
  Object.freeze({ id: 'rise', name: 'Rise', description: 'Goes the other way and comes back.', shape: shape([0, 0, 'linear'], [.5, -1], [1, 0]), defaults: Object.freeze({ amplitude: .5, duration: .8, repeats: 1 }) }),
  Object.freeze({ id: 'sweep', name: 'Sweep', description: 'Goes both ways, then returns.', shape: shape([0, 0, 'linear'], [.25, -1], [.75, 1], [1, 0]), defaults: Object.freeze({ amplitude: .5, duration: .8, repeats: 2 }) }),
  Object.freeze({ id: 'hold', name: 'Hold', description: 'Moves out, stays there, comes back.', shape: shape([0, 0, 'linear'], [.35, 1, 'easeOut'], [.65, 1, 'linear'], [1, 0]), defaults: Object.freeze({ amplitude: .6, duration: 1.2, repeats: 1 }) }),
  Object.freeze({ id: 'pulse', name: 'Pulse', description: 'Two beats, the second smaller.', shape: shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.5, .2, 'easeIn'], [.75, .9, 'easeOut'], [1, 0, 'easeIn']), defaults: Object.freeze({ amplitude: .7, duration: .9, repeats: 1 }) }),
  Object.freeze({ id: 'settle', name: 'Settle', description: 'Overshoots, rocks back, settles.', shape: shape([0, 0, 'linear'], [.2, 1], [.45, -.7], [.7, .4], [1, 0]), defaults: Object.freeze({ amplitude: .5, duration: .9, repeats: 1 }) }),
  Object.freeze({ id: 'tremble', name: 'Tremble', description: 'A fast little shake.', shape: shape([0, 0, 'linear'], [.15, 1, 'linear'], [.35, -1, 'linear'], [.55, 1, 'linear'], [.75, -1, 'linear'], [1, 0, 'linear']), defaults: Object.freeze({ amplitude: .15, duration: .5, repeats: 3 }) })
]);

export const shapeById = (id) => MOTION_SHAPES.find((form) => form.id === id) || null;

/**
 * `shape:dip:earWiggle`. One string, because that is what a clip already
 * stores for its preset — a composed motion needs no new field in the
 * document, and a project written before this reads back unchanged.
 */
export const composedMotionId = (shapeId, control) => `shape:${shapeId}:${control}`;

const COMPOSED = /^shape:([a-z]+):(.+)$/;

/** The synthetic preset behind a composed id, or `null` if it is not one. */
export function composedMotion(id) {
  const match = COMPOSED.exec(String(id ?? ''));
  const form = match && shapeById(match[1]);
  if (!form) return null;
  const control = match[2];
  const meta = controlMeta(control);
  // No fallbacks: the author picked this movement by name, and quietly
  // animating a different one because theirs is off would be a lie.
  return motion(meta.group, id, `${meta.group} ${form.name.toLowerCase()}`, `${form.description} · ${meta.label}`,
    [slot(control, [], form.shape)], form.defaults);
}

/** A catalogue preset or a composed one; everything downstream takes either. */
export const resolveMotionPreset = (id) => presetById(id) || composedMotion(id);

/** The movements a composed motion can be made from, grouped for a picker. */
export function composableMovements(document = {}) {
  const groups = new Map();
  for (const id of Object.keys(document?.params || {})) {
    const meta = controlMeta(id);
    if (!groups.has(meta.group)) groups.set(meta.group, []);
    groups.get(meta.group).push({ id, label: meta.label });
  }
  return [...groups].map(([group, movements]) => ({ group, movements }));
}

export const MOTION_SETTING_LIMITS = Object.freeze({
  amplitude: Object.freeze({ min: 0, max: 1, step: .05 }),
  duration: Object.freeze({ min: .1, max: 10, step: .1 }),
  repeats: Object.freeze({ min: 1, max: 10, step: 1 })
});

export const presetById = (id) => MOTION_PRESETS.find((preset) => preset.id === id) || null;

const round = (value) => Number(Number(value).toFixed(4));
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
/**
 * A movement's name, for the "turn this on first" message.
 *
 * `BASIC_MOVEMENTS` is the list a Face Part declares; the presets also reach
 * into the control rig's own parameters -- a brow's inner end, one eye's lid,
 * a mouth corner, the lip lock -- and those are named by the control catalogue
 * rather than by a part. Falling through to it means a missing movement is
 * still reported as "Eyebrows · Inner end" and never as a parameter id.
 */
const movementLabel = (control) => {
  const entry = BASIC_MOVEMENTS.find((item) => item.id === control);
  if (entry) return `${entry.group} · ${entry.label}`;
  const meta = controlMeta(control);
  return meta.group && meta.group !== 'Other' ? `${meta.group} · ${meta.label}` : control;
};

/** Clamp settings to their limits; missing values fall back to the preset defaults. */
export function normalizeMotionSettings(preset, settings = {}) {
  const pick = (key) => { const limit = MOTION_SETTING_LIMITS[key]; const value = finite(settings[key], preset.defaults[key]); return Math.max(limit.min, Math.min(limit.max, value)); };
  return { amplitude: round(pick('amplitude')), duration: round(pick('duration')), repeats: Math.round(pick('repeats')) };
}

/**
 * Map each preset slot to a parameter the project has (the slot control or
 * one of its fallbacks). `pinned` keeps a previously stored mapping stable.
 */
export function resolveMotionControls(preset, params = {}, pinned = {}) {
  const controls = {}, missing = [];
  for (const item of preset.slots) {
    // A slot that wants a hand takes the parameter that names that hand among
    // its choices. A hand that still deforms has no such parameter -- it has
    // one weight per pose -- so the ordinary lookup is what it falls through
    // to, and both kinds of hand keep the motion.
    const chosen = item.pose ? poseParameter(params, item.pose)?.name : null;
    const name = pinned[item.control] || chosen || [item.control, ...item.fallbacks].find((candidate) => params[candidate]);
    if (name) controls[item.control] = name;
    else {
      missing.push({
        control: item.control, label: movementLabel(item.control),
        part: BASIC_MOVEMENTS.find((entry) => entry.id === item.control)?.part || null,
        // A hand is drawn, not switched on: "turn the movement on in Face
        // Setup" is the wrong sentence for a motion that wants a hand nobody
        // has drawn, and the picker beside the face is one press.
        ...(item.pose ? { hint: 'Draw this hand first: press it beside the face on the canvas, or in Hands.' } : {})
      });
    }
  }
  return { controls, missing };
}

/**
 * Deterministic compiler: one cycle of each slot shape is tiled `repeats`
 * times across `duration`; normalized values scale by `amplitude` within the
 * parameter range around its neutral value. Keys at cycle boundaries keep the
 * easing that arrives at them.
 */
export function compileMotionTracks(preset, settings, controls, params = {}) {
  const { amplitude, duration, repeats } = normalizeMotionSettings(preset, settings);
  const tracks = {};
  for (const item of preset.slots) {
    const name = controls[item.control];
    if (!name) continue;
    const param = params[name] || {}, min = finite(param.min, -1), max = finite(param.max, 1), neutral = Math.max(min, Math.min(max, finite(param.default, 0)));
    // A hand is chosen, never blended halfway into: the shape says *when* the
    // hand is struck, and the track steps between that hand and the resting
    // one. Amplitude has nothing to scale -- half a Point is not a hand.
    // Only when the parameter it landed on is the one that names hands: a
    // hand that still deforms takes the weight it always did.
    const picked = item.pose ? poseParameter(params, item.pose) : null;
    const chosen = picked && picked.name === name ? picked : null;
    const frames = [];
    for (let cycle = 0; cycle < repeats; cycle++) {
      for (const key of item.shape) {
        const time = round(((cycle + key.t) / repeats) * duration);
        if (frames.some((frame) => Math.abs(frame.time - time) < 1e-6)) continue;
        if (chosen) {
          frames.push({ time, value: key.v >= 0.5 ? chosen.index : neutral, easing: 'step' });
          continue;
        }
        const value = round(key.v >= 0 ? neutral + key.v * amplitude * (max - neutral) : neutral + key.v * amplitude * (neutral - min));
        frames.push({ time, value, easing: key.easing });
      }
    }
    tracks[name] = frames.sort((a, b) => a.time - b.time);
  }
  return tracks;
}

/**
 * The movement a motion **is**, as opposed to the ones that dress it.
 *
 * Written as the first slot, so a preset does not need a flag. Usability used
 * to be "any slot resolved at all", which is right for a Head Pop on a face
 * with no mouth -- still a head popping -- and wrong the moment the catalogue
 * grew motions named after a part: a face with no ears was offered *Ears Perk*
 * and got a head tilt, because the tilt was the slot that happened to resolve.
 */
export const motionLead = (preset) => preset?.slots?.[0]?.control || null;

/** Availability of every preset for the current project (for the catalogue UI). */
export function motionAvailability(document) {
  return MOTION_PRESETS.map((preset) => {
    const { controls, missing } = resolveMotionControls(preset, document?.params || {});
    return { id: preset.id, name: preset.name, description: preset.description, group: preset.group || MOTION_PRESET_GROUPS[0], defaults: preset.defaults, controls, missing, usable: Boolean(controls[motionLead(preset)]) };
  });
}

/** The same availability, bucketed in catalogue order; empty groups are dropped. */
export function motionAvailabilityGroups(document) {
  const resolved = motionAvailability(document);
  return MOTION_PRESET_GROUPS.map((group) => ({ group, presets: resolved.filter((item) => item.group === group) })).filter((entry) => entry.presets.length);
}
