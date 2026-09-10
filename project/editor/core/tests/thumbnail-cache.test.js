import test from 'node:test';
import assert from 'node:assert/strict';
import { facePartThumbnail, thumbnailStats } from '../face-library/face-part-artwork.js';
import { FACE_STYLE_PRESETS, createFacePresetRegistry, presetThumbnail, presetThumbnailStats } from '../face-library/face-presets.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { MOUTH_WIDE } from '../face-library/builtin/mouth-wide.js';

/**
 * A card's picture is drawn once (docs/PERFORMANCE_BUDGETS.md, "Character
 * Builder"; roadmap phase 32): a registered asset or preset is one frozen
 * object for its life, so the picture is read back on every redraw, and
 * drawn again only when what it is made of is another object.
 */
test('a part\'s thumbnail is drawn once per frozen asset and size; an object that is not frozen is drawn every time', () => {
  const before = thumbnailStats.parts;
  const first = facePartThumbnail(MOUTH_WIDE);
  const drawn = thumbnailStats.parts - before;
  assert.ok(drawn <= 1, 'drawn at most once (another test may have drawn it already)');
  assert.equal(facePartThumbnail(MOUTH_WIDE), first);
  assert.equal(facePartThumbnail(MOUTH_WIDE), first);
  assert.equal(thumbnailStats.parts - before, drawn, 'read back, not drawn');
  facePartThumbnail(MOUTH_WIDE, { size: 40 });
  assert.equal(thumbnailStats.parts - before, drawn + 1, 'another size is another picture');
  const loose = { ...MOUTH_WIDE };
  facePartThumbnail(loose);
  facePartThumbnail(loose);
  assert.equal(thumbnailStats.parts - before, drawn + 3, 'a plain object is not a key');
});

test('a preset\'s picture is read back while the same assets answer to its ids, and drawn again when one of them is another object', () => {
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const presets = createFacePresetRegistry({ library });
  const robot = presets.register(FACE_STYLE_PRESETS.find((item) => item.id === 'robot'));
  const before = presetThumbnailStats.presets;
  const first = presetThumbnail(robot, library);
  assert.equal(presetThumbnailStats.presets - before, 1);
  assert.equal(presetThumbnail(robot, library), first);
  assert.equal(presetThumbnail(robot, library), first);
  assert.equal(presetThumbnailStats.presets - before, 1, 'read back on every redraw');
  // The same preset over another library: the assets are other objects, so the picture is drawn for them.
  const other = createFacePartRegistry();
  other.registerMany(BUILTIN_FACE_PARTS.map((asset) => ({ ...asset })));
  assert.equal(presetThumbnail(robot, other), first, 'the same drawing, from the same artwork');
  assert.equal(presetThumbnailStats.presets - before, 2);
  // A part of the preset forgotten and registered again under its id: a new object, a new picture.
  const head = robot.parts.head;
  const kept = library.get(head);
  library.remove(head);
  library.register({ ...kept });
  presetThumbnail(robot, library);
  assert.equal(presetThumbnailStats.presets - before, 3);
  presetThumbnail(robot, library);
  assert.equal(presetThumbnailStats.presets - before, 3, 'and read back again');
});
