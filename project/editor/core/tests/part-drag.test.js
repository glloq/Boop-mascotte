import test from 'node:test';
import assert from 'node:assert/strict';
import { PART_DRAG_TYPE, carriesPart, parsePartDrag, partDragPayload, readPartDrag, writePartDrag } from '../../ui/character-builder/part-drag.js';

/**
 * The string a card writes on a drag and the canvas reads on the drop
 * (docs/CHARACTER_BUILDER.md, "Drag & drop"): both ends of it, from one
 * module, so they cannot drift apart.
 */
function transfer() {
  const data = new Map();
  return { types: [], effectAllowed: 'uninitialized', setData(type, value) { data.set(type, String(value)); if (!this.types.includes(type)) this.types.push(type); }, getData: (type) => data.get(type) ?? '' };
}

test('a face part and a hand drawing round-trip through the payload', () => {
  assert.equal(partDragPayload('face-part', 'eyes.cartoon'), 'face-part:eyes.cartoon');
  assert.deepEqual(parsePartDrag('face-part:eyes.cartoon'), { kind: 'face-part', id: 'eyes.cartoon' });
  assert.deepEqual(parsePartDrag(partDragPayload('hand-style', 'left:fist')), { kind: 'hand-style', id: 'left:fist', side: 'left', style: 'fist' });
});

test('what is not a card parses to nothing', () => {
  for (const text of ['', null, undefined, 'eyes.cartoon', 'file:///tmp/x.svg', 'sticker:eyes.cartoon', 'hand-style:middle:fist', 'hand-style:left', 'hand-style:left:fist:extra', 'face-part:']) {
    assert.equal(parsePartDrag(text), null, JSON.stringify(text));
  }
});

test('a card written on a transfer is read back from it, and is a copy; a drop of anything else reads as nothing', () => {
  const drag = transfer();
  assert.equal(writePartDrag(drag, 'face-part:hair.balding'), true);
  assert.equal(drag.effectAllowed, 'copy');
  assert.deepEqual(drag.types, [PART_DRAG_TYPE, 'text/plain'], 'its own type first, plain text for anywhere else');
  assert.equal(drag.getData('text/plain'), 'face-part:hair.balding');
  assert.equal(carriesPart(drag), true);
  assert.deepEqual(readPartDrag(drag), { kind: 'face-part', id: 'hair.balding' });

  const file = { types: ['Files'], getData: () => '' };
  assert.equal(carriesPart(file), false);
  assert.equal(readPartDrag(file), null);
  assert.equal(readPartDrag(null), null);
  assert.equal(carriesPart(undefined), false);
});

test('a payload that is not a card is not written: the drag has nothing to carry', () => {
  const drag = transfer();
  assert.equal(writePartDrag(drag, 'nonsense'), false);
  assert.deepEqual(drag.types, []);
  assert.equal(writePartDrag(null, 'face-part:eyes.cartoon'), false);
});
