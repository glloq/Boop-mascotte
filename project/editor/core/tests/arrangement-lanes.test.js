// VNX-29 — an arrangement drawn as subjects rather than as a list of clips.
// The roadmap's sketch has rows (FACE, HEAD, EYES, HAND R), and no clip
// declares which row it belongs to: the row is derived from what the clip
// writes, through the same catalogue everything else names movements with.
import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangementLanes, clipSubjects, laneRank } from '../animation/arrangement-lanes.js';

const ramp = (duration) => [{ time: 0, value: 0, easing: 'linear' }, { time: duration, value: 1, easing: 'linear' }];
/** A clip that writes exactly `parameters`, from 0 to 1, over its whole length. */
const clip = (id, name, parameters, duration = 2) =>
  ({ id, name, duration, loop: false, tracks: Object.fromEntries(parameters.map((parameter) => [parameter, ramp(duration)])) });

const happy = clip('happy', 'Happy', ['smile', 'mouthOpen']);
const nod = clip('nod', 'Nod', ['headY', 'headTilt']);
const blink = clip('blink', 'Blink', ['eyeOpen'], 1);
const wave = clip('wave', 'Wave', ['handRX', 'handRRotation']);
const greet = clip('greet', 'Greet', ['smile', 'handRX']);
const reach = clip('reach', 'Reach', ['handRX', 'handRRotation', 'smile']);
const swish = clip('swish', 'Swish', ['tailSwish', 'tailFlick']);
const guess = clip('guess', 'Guess', ['smile', 'tailSwish']);
const silent = { id: 'silent', name: 'Silent', duration: 2, loop: false, tracks: {} };

const CLIPS = [happy, nod, blink, wave, greet, reach, swish, guess, silent];
const project = (...placements) => ({ animationClips: CLIPS, arrangement: { placements } });
const at = (clipId, start) => ({ id: `${clipId}@${start}`, clipId, start });
const rows = (document) => arrangementLanes(document).map((lane) => [lane.id, lane.placements.map((placement) => placement.clipId)]);

test('a clip that writes one subject lands on that subject, in the author words', () => {
  const [face] = arrangementLanes(project(at('happy', 0)));
  assert.deepEqual([face.id, face.label, face.part], ['mouth', 'Mouth', 'mouth']);
  assert.deepEqual(face.placements.map((placement) => [placement.clipId, placement.start, placement.end]), [['happy', 0, 2]]);
  // The lane carries the catalogue's part key, so the row and the timeline's
  // part filter (VNX-33) cannot end up meaning different things.
  assert.equal(face.placements[0].subjects[0].part, 'mouth');
  assert.equal(face.placements[0].name, 'Happy', 'and the placement still knows the clip it draws');

  const [hand] = arrangementLanes(project(at('wave', 0)));
  assert.deepEqual([hand.id, hand.label, hand.part], ['right-hand', 'Right hand', 'hand-right']);
  assert.deepEqual(hand.placements[0].subjects.map((subject) => subject.parameters), [['handRX', 'handRRotation']]);
});

test('a clip across two subjects belongs to the one it writes most of', () => {
  // Reach writes two hand movements and one mouth movement: it is a hand clip
  // that happens to smile, so it is drawn on the hand row.
  assert.deepEqual(clipSubjects(reach).map((subject) => [subject.group, subject.parameters.length]), [['Right hand', 2], ['Mouth', 1]]);
  assert.deepEqual(rows(project(at('reach', 0))), [['right-hand', ['reach']]]);

  // And the row it is not on is still reported, so a panel can mark a clip that
  // reaches outside the lane it is drawn on rather than hiding it.
  const [placement] = arrangementLanes(project(at('reach', 0)))[0].placements;
  assert.deepEqual(placement.subjects.map((subject) => subject.group), ['Right hand', 'Mouth']);
});

test('a tie is broken by the lane order, and the unknown bucket can never win one', () => {
  // Greet writes one mouth movement and one hand movement. The counts have said
  // nothing, so the order the author already reads the arrangement in decides:
  // the mouth is above the hands. Deciding by the clip's own track order would
  // hand the choice to something no author ever sees.
  assert.deepEqual(clipSubjects(greet).map((subject) => subject.group), ['Mouth', 'Right hand']);
  assert.deepEqual(rows(project(at('greet', 0))), [['mouth', ['greet']]]);
  assert.deepEqual(clipSubjects(clip('x', 'X', ['handRX', 'smile'])).map((subject) => subject.group), ['Mouth', 'Right hand'],
    'and writing the tracks the other way round does not move the clip');

  // The consequence that makes this tie-break the right one: a clip tied
  // between a subject the catalogue knows and one it does not is filed under
  // the subject, never under Other, because Other is the last lane.
  assert.deepEqual(clipSubjects(guess).map((subject) => subject.group), ['Mouth', 'Other']);
  assert.deepEqual(rows(project(at('guess', 0))), [['mouth', ['guess']]]);
});

test('a clip the catalogue knows nothing about still gets a lane', () => {
  const lanes = arrangementLanes(project(at('swish', 0)));
  assert.deepEqual(lanes.map((lane) => [lane.id, lane.label, lane.part]), [['other', 'Other', null]]);
  assert.deepEqual(lanes[0].placements.map((placement) => placement.clipId), ['swish']);

  // Even a clip that writes nothing at all: the author placed it, so it is on
  // screen somewhere rather than silently missing from the arrangement.
  assert.deepEqual(clipSubjects(silent), [{ group: 'Other', part: null, parameters: [] }]);
  assert.deepEqual(rows(project(at('silent', 0))), [['other', ['silent']]]);
});

test('lanes come back in a stable order however the placements arrive', () => {
  const scattered = project(at('swish', 3), at('wave', 1), at('blink', 2), at('nod', 1), at('happy', 0));
  assert.deepEqual(arrangementLanes(scattered).map((lane) => lane.id), ['head', 'eyes', 'mouth', 'right-hand', 'other'],
    'the catalogue declaration order, then the hands, then the bucket that names nothing');

  // The same set placed in another order is the same set of rows.
  const shuffled = project(at('happy', 0), at('nod', 1), at('blink', 2), at('wave', 1), at('swish', 3));
  assert.deepEqual(arrangementLanes(shuffled).map((lane) => lane.id), arrangementLanes(scattered).map((lane) => lane.id));

  // The rule behind that order, stated on its own: a subject the catalogue
  // declares keeps the catalogue's place, one it has never heard of follows,
  // and the unknown bucket is always last.
  assert.ok(laneRank('Head') < laneRank('Mouth'));
  assert.ok(laneRank('Mouth') < laneRank('Left hand'));
  assert.ok(laneRank('Left hand') < laneRank('Right hand'));
  assert.ok(laneRank('Right hand') < laneRank('Antennae'));
  assert.ok(laneRank('Antennae') < laneRank('Other'));
});

test('a lane holds every placement on it, in start order, and an empty arrangement has no lanes', () => {
  const document = project(at('wave', 2), at('wave', 0), at('happy', 1));
  assert.deepEqual(rows(document), [['mouth', ['happy']], ['right-hand', ['wave', 'wave']]]);
  assert.deepEqual(arrangementLanes(document)[1].placements.map((placement) => placement.start), [0, 2],
    'the same clip placed twice is two clips on one row');

  assert.deepEqual(arrangementLanes(project()), [], 'nothing arranged is no rows, not a sheet of empty ones');
  assert.deepEqual(arrangementLanes({}), []);
  assert.deepEqual(arrangementLanes(project(at('gone', 0))), [], 'a placement of a clip the project no longer has draws nothing');
});
