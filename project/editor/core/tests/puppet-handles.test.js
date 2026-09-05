import test from 'node:test';
import assert from 'node:assert/strict';
import { PUPPET_HANDLES, puppetDragValues, puppetHandles, puppetPartLabel, puppetReadout, puppetRestValues } from '../puppet/puppet-handles.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 });

/** A rigged face: the parts exist, and the movements are turned on. */
function project({ controls = { gaze: ['lookX', 'lookY'], eyes: ['eyeOpen'], mouth: ['mouthOpen', 'smile'], head: ['headX', 'headY'] } } = {}) {
  const ids = ['face', 'eyeL', 'eyeR', 'pupilL', 'pupilR', 'mouth'];
  return {
    svgMarkup: '<svg/>',
    elements: Object.fromEntries(ids.map((id) => [id, element()])),
    layers: ids.map((id) => ({ id, name: id, type: 'path', visible: true, children: [] })),
    semanticParts: {
      head: { id: 'head', type: 'head', roles: { head: 'face' }, controls: controls.head || [] },
      eyes: { id: 'eyes', type: 'eyes', roles: { leftEye: 'eyeL', rightEye: 'eyeR' }, controls: controls.eyes || [] },
      gaze: { id: 'gaze', type: 'gaze', roles: { leftPupil: 'pupilL', rightPupil: 'pupilR' }, controls: controls.gaze || [] },
      mouth: { id: 'mouth', type: 'mouth', roles: { mouth: 'mouth' }, controls: controls.mouth || [] }
    },
    params: { lookX: number(-1, 1), lookY: number(-1, 1), eyeOpen: number(0, 1, 1), mouthOpen: number(0, 1), smile: number(-1, 1), headX: number(-1, 1), headY: number(-1, 1) }
  };
}
const byId = (document) => Object.fromEntries(puppetHandles(document).map((handle) => [handle.id, handle]));

test('a handle is a movement the project actually has, on the artwork that moves', () => {
  const handles = byId(project());
  assert.deepEqual(Object.keys(handles), ['gaze', 'eyes', 'mouth', 'head']);
  assert.deepEqual(handles.gaze.elements, ['pupilL', 'pupilR'], 'both pupils move together');
  assert.equal(handles.gaze.x.control, 'lookX');
  assert.equal(handles.gaze.y.control, 'lookY');
  assert.equal(handles.eyes.x, null, 'an eye opens and closes, it does not slide sideways');
  assert.equal(handles.eyes.y.control, 'eyeOpen');
  assert.equal(handles.head.anchor, 'face');
  assert.equal(puppetPartLabel(handles.gaze), 'Pupils / Gaze');

  // No eyebrows in this project, so no eyebrow handle — and nothing at all in
  // an unrigged one, rather than controls that do nothing.
  assert.equal('eyebrows' in handles, false);
  assert.deepEqual(puppetHandles({}), []);
  assert.deepEqual(puppetHandles({ semanticParts: { gaze: { id: 'gaze', type: 'gaze', roles: {}, controls: ['lookX'] } } }), []);
});

test('a movement that is off, or has no parameter, is not grabbable', () => {
  assert.equal('gaze' in byId(project({ controls: { gaze: [], mouth: ['smile'] } })), false, 'gaze is turned off');
  const noParams = project();
  delete noParams.params.lookY;
  const gaze = byId(noParams).gaze;
  assert.equal(gaze.y, null, 'half a handle is still a handle');
  assert.equal(gaze.x.control, 'lookX');
});

test('a drag becomes parameter values, scaled to the part and clamped to its range', () => {
  const gaze = byId(project()).gaze;
  // The throw is a fraction of the part's own size, so the same gesture works
  // on a small pupil and on a huge one.
  const small = puppetDragValues(gaze, { dx: 9, dy: 0 }, { size: 18 });
  const large = puppetDragValues(gaze, { dx: 90, dy: 0 }, { size: 180 });
  assert.equal(small.lookX, large.lookX, 'the same fraction of the part is the same value');
  assert.equal(small.lookX, 1);

  // Half the throw is half the range, from wherever the drag started.
  assert.deepEqual(puppetDragValues(gaze, { dx: 4.5, dy: 0 }, { size: 18 }), { lookX: 0.5, lookY: 0 });
  assert.deepEqual(puppetDragValues(gaze, { dx: 4.5, dy: 0 }, { size: 18, start: { lookX: 0.5, lookY: -0.25 } }), { lookX: 1, lookY: -0.25 });
  // And it stops at the ends rather than running away.
  assert.deepEqual(puppetDragValues(gaze, { dx: 900, dy: -900 }, { size: 18 }), { lookX: 1, lookY: -1 });
  assert.deepEqual(puppetDragValues(gaze, { dx: -900, dy: 900 }, { size: 18 }), { lookX: -1, lookY: 1 });
  assert.deepEqual(puppetDragValues(null, { dx: 10, dy: 10 }), {});
  assert.deepEqual(puppetDragValues(gaze, { dx: NaN, dy: undefined }, { size: 18 }), { lookX: 0, lookY: 0 }, 'a pointer that reported nothing moves nothing');
});

test('up is up: an eye closes downwards and a brow rises upwards', () => {
  const handles = byId(project());
  // `eyeOpen` rests at 1 and drops as the pointer goes down.
  const closing = puppetDragValues(handles.eyes, { dx: 0, dy: 20 }, { size: 40, start: { eyeOpen: 1 } });
  assert.ok(closing.eyeOpen < 1 && closing.eyeOpen >= 0);
  assert.equal(puppetDragValues(handles.eyes, { dx: 0, dy: -20 }, { size: 40, start: { eyeOpen: 1 } }).eyeOpen, 1, 'already wide open');

  // `mouthOpen` and `headY` grow downwards, like every vertical parameter in
  // the rig, so their handles are not inverted.
  assert.ok(puppetDragValues(handles.mouth, { dx: 0, dy: 20 }, { size: 40 }).mouthOpen > 0);
  assert.ok(puppetDragValues(handles.head, { dx: 0, dy: 20 }, { size: 200 }).headY > 0);
  // Everything that reads as "up" on the mascot: a lid, a brow, a scrunched
  // nose, lifted hair. Everything else grows downwards, like the rig does.
  // A ring is dragged outwards to grow, and on a vertical drag outwards is up:
  // the pupil handles read the same way a lid and a brow do.
  assert.deepEqual(PUPPET_HANDLES.filter((item) => item.invertY).map((item) => item.id),
    ['eyes', 'eyebrows', 'nose', 'hair', 'pupilScale', 'pupilLeft', 'pupilRight', 'eyeLeft', 'eyeRight', 'browLeft', 'browRight'],
    'and the same again for one side on its own');
});

test('a handle can be put back, and says where it is in words', () => {
  const gaze = byId(project()).gaze, eyes = byId(project()).eyes;
  assert.deepEqual(puppetRestValues(gaze), { lookX: 0, lookY: 0 });
  assert.deepEqual(puppetRestValues(eyes), { eyeOpen: 1 }, 'an eye rests open');

  assert.equal(puppetReadout(gaze, {}), 'at rest');
  assert.equal(puppetReadout(gaze, { lookX: 0.5, lookY: 0 }), 'look left / right +0.5');
  assert.equal(puppetReadout(gaze, { lookX: -0.42, lookY: 0.3 }), 'look left / right -0.42 · look up / down +0.3');
  assert.equal(puppetReadout(eyes, { eyeOpen: 1 }), 'at rest', 'resting is resting, whatever the number');
  assert.equal(puppetReadout(eyes, { eyeOpen: 0 }), 'open / close 0');
});
