import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionController, normalizeReactions, handPoseParameterName } from '../../../runtime/runtime.js';
import { reactionIssues } from '../reactions/reaction-model.js';
import { validateProject } from '../validation/validate-project.js';
import { handPoseParameter } from '../hands/hand-model.js';
import { createSampleProject } from '../state/store.js';

const wave = (over = {}) => ({
  id: 'hello', name: 'Hello', enabled: true, trigger: { type: 'click' },
  expression: { id: 'happy', weight: 1 },
  motion: { clipId: 'body-bounce' },
  gestures: [{ side: 'right', pose: 'wave' }],
  timing: { attack: 0.2, hold: 1, release: 0.4 },
  ...over
});

const controllerFor = (reactions, clips = []) => createReactionController({ reactions: normalizeReactions({ reactions }), clips });

test('a hand pose is named the same way everywhere', () => {
  assert.equal(handPoseParameterName('right', 'wave'), 'handRWave');
  assert.equal(handPoseParameterName('left', 'thumbsUp'), 'handLThumbsUp');
  assert.equal(handPoseParameter('right', 'wave'), handPoseParameterName('right', 'wave'));
});

test('gestures normalize per side, with a weight, and rubbish is dropped', () => {
  const [reaction] = normalizeReactions({ reactions: [wave({ gestures: [
    { side: 'right', pose: 'wave' },
    { side: 'left', pose: 'point', weight: 0.5 },
    { side: 'foot', pose: 'kick' },
    { side: 'right', pose: '' },
    'junk'
  ] })] });
  assert.deepEqual(reaction.gestures, [{ side: 'right', pose: 'wave', weight: 1 }, { side: 'left', pose: 'point', weight: 0.5 }]);
});

test('a reaction raises its gesture parameter while it runs and lets it go after', () => {
  const controller = controllerFor([wave()]);
  controller.fire('hello', 0);
  // Attack: rising, not yet full.
  const rising = controller.evaluate(0.1, {}).params.handRWave;
  assert.ok(rising > 0 && rising < 1, `rising (${rising})`);
  assert.equal(controller.evaluate(0.6, {}).params.handRWave, 1, 'held');
  const releasing = controller.evaluate(1.4, {}).params.handRWave;
  assert.ok(releasing > 0 && releasing < 1, `releasing (${releasing})`);
  assert.equal(controller.evaluate(3, {}).params.handRWave, undefined, 'let go');
});

test('a gesture follows the same envelope as the expression it travels with', () => {
  const controller = controllerFor([wave()]);
  controller.fire('hello', 0);
  for (const time of [0.05, 0.1, 0.15, 0.6, 1.3, 1.5]) {
    const { params, expressions } = controller.evaluate(time, {});
    const gesture = params.handRWave ?? 0;
    const expression = expressions.happy ?? 0;
    assert.ok(Math.abs(gesture - expression) < 1e-9, `same weight at ${time}: ${gesture} vs ${expression}`);
  }
});

test('a gesture at a partial weight never exceeds it', () => {
  const controller = controllerFor([wave({ gestures: [{ side: 'right', pose: 'wave', weight: 0.4 }] })]);
  controller.fire('hello', 0);
  let peak = 0;
  for (let time = 0; time < 2; time += 0.05) peak = Math.max(peak, controller.evaluate(time, {}).params.handRWave ?? 0);
  assert.ok(Math.abs(peak - 0.4) < 1e-9, `peak ${peak}`);
});

test('a gesture that stays keeps the hand posed after the reaction ends', () => {
  const controller = controllerFor([wave({ after: 'stay' })]);
  controller.fire('hello', 0);
  controller.evaluate(0.6, {});
  assert.equal(controller.evaluate(5, {}).params.handRWave, 1, 'still posed');
  assert.equal(controller.evaluate(9, {}).params.handRWave, 1, 'and stays posed');
  controller.clearStayed();
  assert.equal(controller.evaluate(10, {}).params.handRWave, undefined);
});

test('firing a returning reaction again clears a previously stayed gesture', () => {
  const controller = controllerFor([wave({ after: 'stay' })]);
  controller.fire('hello', 0);
  controller.evaluate(5, {});
  assert.equal(controller.evaluate(6, {}).params.handRWave, 1);
  const returning = controllerFor([wave({ after: 'return' })]);
  returning.fire('hello', 0);
  assert.equal(returning.evaluate(9, {}).params.handRWave, undefined);
});

test('both hands can gesture at once, independently', () => {
  const controller = controllerFor([wave({ gestures: [{ side: 'right', pose: 'wave' }, { side: 'left', pose: 'point', weight: 0.6 }] })]);
  controller.fire('hello', 0);
  const { params } = controller.evaluate(0.6, {});
  assert.equal(params.handRWave, 1);
  assert.equal(params.handLPoint, 0.6);
});

test('a reaction with only a gesture is not empty', () => {
  const document = {
    reactions: normalizeReactions({ reactions: [wave({ expression: null, motion: null })] }),
    expressions: [], animationClips: [],
    hands: { right: { poses: [{ id: 'wave' }] } }
  };
  assert.deepEqual(reactionIssues(document), []);
});

test('a gesture pointing at a pose the hand no longer has is reported', () => {
  const document = {
    reactions: normalizeReactions({ reactions: [wave({ expression: null, motion: null, gestures: [{ side: 'right', pose: 'peace' }] })] }),
    expressions: [], animationClips: [],
    hands: { right: { poses: [{ id: 'wave' }] } }
  };
  const [issue] = reactionIssues(document);
  assert.deepEqual(issue.missingGesture, { side: 'right', pose: 'peace', weight: 1 });
  const state = { ...createSampleProject(), svgMarkup: '<svg><g id="a"/></svg>', ...document };
  const reported = validateProject(state).find((item) => item.id === 'reaction.hello.missing-gesture');
  assert.ok(reported);
  assert.equal(reported.severity, 'warning');
  assert.match(reported.message, /right hand, peace/);
});

test('a reaction with nothing at all still says what to add', () => {
  const document = { reactions: normalizeReactions({ reactions: [wave({ expression: null, motion: null, gestures: [] })] }), expressions: [], animationClips: [] };
  const state = { ...createSampleProject(), svgMarkup: '<svg><g id="a"/></svg>', ...document };
  const reported = validateProject(state).find((item) => item.id === 'reaction.hello.empty');
  assert.match(reported.message, /choose an expression, a motion or a hand gesture/);
});

test('a reaction can only name a hand pose that exists', async () => {
  const { createReaction, updateReaction } = await import('../reactions/reaction-model.js');
  const document = { reactions: [], expressions: [], animationClips: [], hands: { right: { poses: [{ id: 'wave', name: 'Wave' }] } } };
  const reaction = createReaction(document, { name: 'Hello', gestures: [{ side: 'right', pose: 'wave' }] });
  assert.deepEqual(reaction.gestures, [{ side: 'right', pose: 'wave', weight: 1 }]);
  assert.throws(() => updateReaction(document, reaction.id, { gestures: [{ side: 'right', pose: 'peace' }] }), /has no "peace" pose\. Add it in Hands first/);
  assert.throws(() => createReaction(document, { name: 'Nope', gestures: [{ side: 'left', pose: 'wave' }] }), /left hand has no "wave" pose/);
  assert.deepEqual(document.reactions.map((item) => item.id), ['hello']);
});

test('clearing a gesture leaves the reaction intact', async () => {
  const { createReaction, updateReaction } = await import('../reactions/reaction-model.js');
  const document = { reactions: [], expressions: [{ id: 'happy' }], animationClips: [], hands: { right: { poses: [{ id: 'wave' }] } } };
  const reaction = createReaction(document, { name: 'Hello', expressionId: 'happy', gestures: [{ side: 'right', pose: 'wave' }] });
  const cleared = updateReaction(document, reaction.id, { gestures: [] });
  assert.deepEqual(cleared.gestures, []);
  assert.deepEqual(cleared.expression, { id: 'happy', weight: 1 });
});
