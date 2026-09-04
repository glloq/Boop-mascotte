// VNX-32 — two clips fighting over the same movement.
// The premise is pinned first: the module only earns its place because the
// motion layer resolves a shared parameter silently (docs/ADR_MOTION_LAYERING.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionLayer, mixParameters } from '../../../runtime/runtime.js';
import { CONFLICT_RESOLUTIONS, SUPPORTED_RESOLUTIONS, clipParameters, clipPlacements, findClipConflicts, mergeClipConflicts, movementLabel } from '../animation/clip-conflicts.js';

/** A clip that moves one parameter from `from` to `to` over its whole length. */
const ramp = (id, name, parameter, from, to, duration = 2) => ({
  id, name, duration, loop: false,
  tracks: { [parameter]: [{ time: 0, value: from, easing: 'linear' }, { time: duration, value: to, easing: 'linear' }] }
});

const wave = ramp('wave', 'Wave', 'handRX', -1, 1, 2);
const point = ramp('point', 'Point', 'handRX', 0.6, 0.6, 1);
const reach = ramp('reach', 'Reach', 'handRX', 0.2, -0.4, 1.1);
const blink = ramp('blink', 'Blink', 'eyeOpen', 1, 0, 1);
const project = { animationClips: [wave, point, reach, blink] };

const at = (clipId, start) => ({ clipId, start });

test('the mixer really does drop the older clip, which is what there is to warn about', () => {
  // Both clips write handRX. Layered, they are emitted in start order and mixed
  // as weightedOverride, so at a settled weight of 1 the later one is the value.
  const layer = createMotionLayer({ blend: { duration: 0, easing: 'linear' }, clips: [wave, point] });
  layer.play('wave', 0);
  layer.play('point', 0, { layer: true });
  const layers = layer.layers(1, { handRX: 0 });
  assert.deepEqual(layers.map((item) => [item.mode, item.weight]), [['weightedOverride', 1], ['weightedOverride', 1]]);
  assert.equal(mixParameters({ handRX: 0 }, layers, {}).handRX, 0.6, 'the clip started last wins outright; Wave contributes nothing');

  // And that is exactly the collision the report describes.
  const [conflict] = findClipConflicts(project, { placements: [at('wave', 0), at('point', 0)] });
  assert.equal(conflict.parameter, 'handRX');
  assert.deepEqual(conflict.clips.map((clip) => clip.name), ['Wave', 'Point']);
});

test('two clips that overlap on one movement are one conflict, over the span they share', () => {
  const conflicts = findClipConflicts(project, { placements: [at('wave', 0), at('point', 0.4)] });
  assert.equal(conflicts.length, 1);
  const [conflict] = conflicts;
  assert.equal(conflict.parameter, 'handRX');
  assert.equal(conflict.start, 0.4);
  assert.equal(conflict.end, 1.4, 'the overlap ends where Point does, not where Wave does');
  assert.deepEqual(conflict.clips.map((clip) => clip.name), ['Wave', 'Point']);
  assert.ok(conflict.divergence > 0, 'they hold the movement at different values');
  assert.deepEqual(conflict.resolutions, SUPPORTED_RESOLUTIONS);
});

test('a tenth of a second together is a conflict; touching ends and moving apart are not', () => {
  assert.equal(findClipConflicts(project, { placements: [at('wave', 0), at('point', 1.9)] }).length, 1, '0.1 s of overlap still fights');
  assert.equal(findClipConflicts(project, { placements: [at('wave', 0), at('point', 1.9)] })[0].end, 2);

  assert.deepEqual(findClipConflicts(project, { placements: [at('wave', 0), at('point', 2)] }), [], 'clips that only touch at an instant never play together');
  assert.deepEqual(findClipConflicts(project, { placements: [at('wave', 0), at('point', 2.5)] }), [], 'the same two clips, moved apart, are not in conflict');
});

test('three clips on one movement report each stretch, and merge to one warning', () => {
  const conflicts = findClipConflicts(project, { placements: [at('wave', 0), at('point', 0.4), at('reach', 0.5)] });
  assert.deepEqual(conflicts.map((item) => [item.start, item.end, item.clips.map((clip) => clip.name)]), [
    [0.4, 0.5, ['Wave', 'Point']],
    [0.5, 1.4, ['Wave', 'Point', 'Reach']],
    [1.4, 1.6, ['Wave', 'Reach']]
  ]);
  assert.match(conflicts[1].message, /^Wave, Point and Reach all change /);

  const [merged] = mergeClipConflicts(conflicts);
  assert.equal(mergeClipConflicts(conflicts).length, 1, 'one warning per movement');
  assert.deepEqual(merged.clips.map((clip) => clip.name), ['Wave', 'Point', 'Reach']);
  assert.deepEqual([merged.start, merged.end], [0.4, 1.6]);
});

test('clips that share no movement are not in conflict, and no clip conflicts with itself', () => {
  assert.deepEqual(findClipConflicts(project, { placements: [at('wave', 0), at('blink', 0)] }), [], 'a hand clip and an eye clip simply coexist');
  assert.deepEqual(findClipConflicts(project, { placements: [at('wave', 0)] }), [], 'one clip writing a movement is the author, not a conflict');
  assert.deepEqual(findClipConflicts({ animationClips: [wave] }), [], 'nor is it a conflict when it is the only clip in the project');

  // The same clip placed twice is two placements, so it is reported -- and named
  // in a way that tells the two apart.
  const twice = findClipConflicts(project, { placements: [at('wave', 0), at('wave', 1)] });
  assert.equal(twice.length, 1);
  assert.match(twice[0].message, /Wave \(0 s\) and Wave \(1 s\) both change/);
});

test('a conflict is phrased in the author words: the movement and the clip names, never a parameter id', () => {
  const [conflict] = findClipConflicts(project, { placements: [at('wave', 0), at('point', 0.4)] });
  assert.equal(conflict.movement, 'Move left / right');
  assert.equal(conflict.group, 'Right hand');
  assert.equal(conflict.message, 'Wave and Point both change "Move left / right" on the right hand, from 0.4 s to 1.4 s.');
  assert.ok(!conflict.message.includes('handRX'), 'the parameter id never reaches the sentence');
  assert.ok(conflict.message.includes('Wave') && conflict.message.includes('Point'), 'and the clips are named');
  assert.equal(conflict.parameter, 'handRX', 'the id is still there for the caller, just not for the reader');

  // A parameter the catalog has never heard of is still spelled out, not shown raw.
  const custom = ramp('a', 'Swish', 'tailSwish', 0, 1), other = ramp('b', 'Flick', 'tailSwish', 1, 0);
  const [unknown] = findClipConflicts([custom, other]);
  assert.equal(unknown.movement, 'Tail swish');
  assert.equal(unknown.group, null);
  assert.equal(unknown.message, 'Swish and Flick both change "Tail swish", from 0 s to 2 s.');
  assert.deepEqual(movementLabel('handRX'), { movement: 'Move left / right', group: 'Right hand', part: 'hand-right' });
});

test('a looping clip fights for as long as it plays, and clips that agree can be filtered out', () => {
  const forever = { ...ramp('idle', 'Idle sway', 'handRX', 0, 0.6, 2), loop: true };
  const [conflict] = findClipConflicts([forever, point], { placements: [at('idle', 0), at('point', 0.5)] });
  assert.equal(conflict.end, 1.5, 'the shorter clip closes the overlap');

  const [open] = findClipConflicts([forever, { ...point, loop: true }], { placements: [at('idle', 0), at('point', 0.5)] });
  assert.equal(open.end, Infinity, 'two looping clips are never released, so the overlap has no end');
  assert.match(open.message, /from 0.5 s on\.$/);

  // Two clips holding the movement at the same value do not visibly fight.
  const same = ramp('same', 'Echo', 'handRX', 0.6, 0.6, 1);
  assert.equal(findClipConflicts([point, same], { placements: [at('point', 0), at('same', 0)] })[0].divergence, 0);
  assert.deepEqual(findClipConflicts([point, same], { placements: [at('point', 0), at('same', 0)], minimumDivergence: 1e-6 }), []);
});

test('placement and parameter reading follow the evaluator, not a second copy of it', () => {
  assert.deepEqual(clipParameters(wave), ['handRX']);
  // An empty track still writes the value underneath it, which is why the
  // parameters come from the evaluator rather than from Object.keys(tracks).
  assert.deepEqual(clipParameters({ duration: 1, tracks: { handRX: [], eyeOpen: [{ time: 0, value: 1, easing: 'linear' }] } }), ['handRX', 'eyeOpen']);

  assert.deepEqual(clipPlacements(project).map((item) => [item.id, item.start, item.end]), [['wave', 0, 2], ['point', 0, 1], ['reach', 0, 1.1], ['blink', 0, 1]]);
  assert.deepEqual(clipPlacements(project, [at('nope', 0), at('point', 3)]).map((item) => [item.id, item.start, item.end]), [['point', 3, 4]], 'a placement of a clip that is gone places nothing');
  assert.deepEqual(clipPlacements([{ id: 'empty', name: 'Empty', duration: 0, tracks: {} }]), [], 'a clip with no length writes nothing and can fight over nothing');
});

test('only the resolutions the runtime can honour are offered', () => {
  assert.deepEqual(CONFLICT_RESOLUTIONS.map((item) => item.id), ['override', 'add', 'blend', 'priority']);
  // Change this only when the runtime changes. Today the motion layer emits
  // every clip as weightedOverride at weight 1, in start order: overriding is
  // the only rule it knows, and nothing declares a priority.
  assert.deepEqual(SUPPORTED_RESOLUTIONS, ['override']);
  assert.ok(CONFLICT_RESOLUTIONS.every((item) => item.summary && item.detail), 'each one says what it means, and why it is or is not available');
});
