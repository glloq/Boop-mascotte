import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_HAND_LOOK, HAND_LOOKS, HAND_STYLE_PIVOT, HAND_STYLE_RADIUS, HAND_STYLE_SPRITE_SCALE,
  defaultHandStyle, handLook, handSetInfo, handStyleAnchors, handStyleElementId, handStyleIds,
  handStyleLibrary, handStyleMarkup, handStyleSetMarkup, handStyleShapeId, handStyleShapes,
  handStyleThumbnail, handStyleViewBox
} from '../hands/hand-style-art.js';
import { HAND_SET_LIBRARY, gestureFragment, gestureLayers, normalizeHandSet, validateHandSet } from '../hands/hand-set.js';
import { parsePath } from '../../../runtime/path-vector.js';

const DIR = fileURLToPath(new URL('../../../assets/hands/defaultCartoon/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${DIR}manifest.json`, 'utf8'));
const file = (src) => readFileSync(`${DIR}${src}`, 'utf8');

const at = { x: 0, y: 0 };
const points = (d) => {
  const { values } = parsePath(d);
  return Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
};
const shapesOf = (style, options = {}) => handStyleShapes(style, { at, scale: 1, ...options });
const ids = () => handStyleIds();

/* ── The drawings come from the files, not from this code ──────────────────── */

test('the library is the set on disk: the manifest names the gestures, the files draw them', () => {
  assert.deepEqual(ids(), manifest.gestures.map((gesture) => gesture.id));
  assert.equal(handSetInfo().set, manifest.set);
  assert.equal(handSetInfo().name, manifest.name);
  assert.equal(defaultHandStyle(), manifest.fallback);
  assert.equal(HAND_STYLE_RADIUS(), manifest.radius);
  assert.deepEqual([...HAND_STYLE_PIVOT()], manifest.pivot);
  assert.equal(HAND_STYLE_SPRITE_SCALE(), manifest.scale);
  assert.equal(handStyleViewBox(), manifest.viewBox);
  for (const gesture of manifest.gestures) {
    // One file per gesture, not one per side: every shipped gesture is mirrorable.
    assert.equal(gesture.mirrorable, true, `${gesture.id} is drawn once for both hands`);
    const source = file(gesture.src);
    assert.match(source, new RegExp(`viewBox="${manifest.viewBox}"`), `${gesture.src} uses the set's box`);
    assert.match(source, new RegExp(`data-hand-pivot="${manifest.pivot.join(' ')}"`));
    assert.match(source, new RegExp(`<g id="hand-${gesture.id}"`), `${gesture.src} draws one named group`);
    assert.doesNotMatch(source, /<(?:animate|script|filter|linearGradient|radialGradient|mask|use)\b/,
      'a drawing is paths and nothing else');
    // The registry drew what the file draws, layer for layer.
    const drawn = gestureLayers({ artwork: gestureFragment(source) }).map((layer) => layer.part);
    assert.deepEqual(gestureLayers(HAND_SET_LIBRARY.get(gesture.id)).map((layer) => layer.part), drawn,
      `${gesture.id} installs the layers ${gesture.src} draws — run npm run hands:sets`);
  }
});

test('a set is validated whole, and refused whole', () => {
  const files = Object.fromEntries(manifest.gestures.map((gesture) => [gesture.src, file(gesture.src)]));
  const set = normalizeHandSet(manifest, files);
  const check = validateHandSet(set);
  assert.deepEqual(check.errors, [], `the shipped set is valid: ${JSON.stringify(check.errors)}`);
  assert.equal(check.ok, true);
  // And the rules bite: a gesture whose file never arrived takes the set down
  // with it rather than installing a hand with a gap in its library.
  const missing = validateHandSet(normalizeHandSet(manifest, { ...files, [manifest.gestures[1].src]: '' }));
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((issue) => issue.code === 'artwork-missing'), JSON.stringify(missing.errors));
});

/* ── A drawing is layers, in paint order ───────────────────────────────────── */

test('a drawing is a group of named layers, and the order is the paint order', () => {
  for (const id of ids()) {
    const shapes = shapesOf(id);
    assert.ok(shapes.length >= 1, `${id} draws at least one layer`);
    const gesture = HAND_SET_LIBRARY.get(id);
    // Every layer is nameable: that is what the layer tree and Edit Shape need.
    for (const shape of shapes) {
      assert.ok(shape.part, `${id} names every layer it draws`);
      assert.ok(gesture.roles[shape.part], `${id} calls its ${shape.part} something`);
    }
    assert.equal(new Set(shapes.map((shape) => shape.part)).size, shapes.length, `${id} draws each layer once`);
  }
  // The order is the whole reason a gesture is more than one shape. A fist
  // paints its palm first and folds the fingers onto it; an open hand paints
  // the fingers first and the palm grows out of them.
  assert.deepEqual(shapesOf('fist').map((shape) => shape.part), ['palm', 'index', 'middle', 'ring', 'thumb']);
  assert.deepEqual(shapesOf('open').map((shape) => shape.part), ['index', 'middle', 'ring', 'thumb', 'palm']);
  assert.equal(shapesOf('nonsense'), null, 'a gesture nobody drew is not invented');
});

test('every drawing is only M, C, L and Z — every number a coordinate', () => {
  for (const id of ids()) {
    for (const shape of shapesOf(id)) {
      const { commands } = parsePath(shape.d);
      for (const command of commands) assert.ok('MCLZ'.includes(command), `${id} ${shape.part} draws with "${command}"`);
    }
  }
});

/* ── One pivot, one radius, so a swap never moves or resizes the hand ──────── */

test('every gesture fits the set radius around the same pivot', () => {
  const reach = {};
  for (const id of ids()) {
    let radius = 0;
    for (const shape of shapesOf(id)) for (const point of points(shape.d)) radius = Math.max(radius, Math.hypot(point.x, point.y));
    reach[id] = Math.round(radius * 10) / 10;
    assert.ok(radius <= HAND_STYLE_RADIUS(), `${id} reaches ${radius.toFixed(1)} of ${HAND_STYLE_RADIUS()}`);
  }
  // Not merely inside it: the drawings are the same apparent size as each
  // other, so a change of gesture is not a change of scale.
  const sizes = Object.values(reach);
  assert.ok(Math.min(...sizes) / Math.max(...sizes) > 0.6, `the drawings are ${JSON.stringify(reach)}`);
});

test("a drawing at the set's scale fits the set's box with room round it", () => {
  const half = Number(handStyleViewBox().split(' ')[2]) / 2;
  assert.equal(HAND_STYLE_PIVOT()[0], half);
  assert.equal(HAND_STYLE_PIVOT()[1], half);
  const margin = half - HAND_STYLE_RADIUS() * HAND_STYLE_SPRITE_SCALE();
  assert.ok(margin > 5, `${margin} units of margin round the widest drawing`);
});

/* ── Mirroring ─────────────────────────────────────────────────────────────── */

test('the right hand is the same drawing with its x negated', () => {
  for (const id of ids()) {
    const left = shapesOf(id), right = shapesOf(id, { flip: true });
    assert.equal(left.length, right.length, `${id} keeps its layers`);
    for (let index = 0; index < left.length; index += 1) {
      assert.equal(right[index].part, left[index].part, `${id} keeps its paint order`);
      const a = points(left[index].d), b = points(right[index].d);
      assert.equal(a.length, b.length, `${id} ${left[index].part} keeps its layout`);
      for (let k = 0; k < a.length; k += 1) {
        assert.equal(b[k].x, -a[k].x === 0 ? 0 : -a[k].x, `${id} ${left[index].part} mirrors x`);
        assert.equal(b[k].y, a[k].y, `${id} ${left[index].part} keeps y`);
      }
    }
  }
});

test('markup for either hand names that hand, and mirrors only for the right one', () => {
  const left = handStyleMarkup('left', 'point', { at: { x: 100, y: 100 }, scale: 2 });
  const right = handStyleMarkup('right', 'point', { at: { x: 100, y: 100 }, scale: 2 });
  assert.match(left, /id="handLeftStyle-point"/);
  assert.match(right, /id="handRightStyle-point"/);
  assert.notEqual(left.replace(/handLeft/g, 'handRight'), right, 'the right hand is not the left one renamed');
  // No transform attribute anywhere: the flip is in the geometry, so the
  // artwork measures and exports like any other path.
  assert.doesNotMatch(right, /transform=/);
});

/* ── Element ids, libraries and thumbnails ─────────────────────────────────── */

test('a drawing is one named group of named layers, and nothing in it is rigged', () => {
  const markup = handStyleMarkup('left', 'open', { at: { x: 100, y: 100 }, scale: 2 });
  assert.equal(handStyleElementId('left', 'open'), 'handLeftStyle-open');
  assert.equal(handStyleShapeId('left', 'open', 'palm'), 'handLeftStyle-open-palm');
  assert.equal((markup.match(/<g\b/g) || []).length, 1, 'one group is the whole drawing');
  assert.equal((markup.match(/<path/g) || []).length, shapesOf('open').length, 'one path per layer');
  assert.match(markup, /data-name="Open"/, 'the group reads as the drawing it is');
  assert.match(markup, /<path id="handLeftStyle-open-palm" data-name="Palm"/, 'and every layer as the part it is');
  assert.doesNotMatch(markup, /\sopacity=/, 'the drawing a hand starts on is not hidden');
  // Nothing inside a drawing animates: the hand's own group carries the
  // transform, and the runtime swaps whole drawings by one opacity.
  for (const gone of ['transform=', 'data-key', 'data-param', 'data-shape-key']) {
    assert.ok(!markup.includes(gone), `no ${gone} inside a drawing`);
  }
  // The opacity sits on the group, so hiding a drawing is one attribute
  // however many layers it has.
  const hidden = handStyleMarkup('left', 'open', { at, scale: 1, hidden: true });
  assert.match(hidden, /^<g id="handLeftStyle-open"[^>]*opacity="0"/);
  assert.equal((hidden.match(/opacity="0"/g) || []).length, 1, 'one opacity hides the whole drawing');
  assert.equal(handStyleMarkup('left', 'nonsense', { at, scale: 1 }), '', 'a gesture nobody drew is not invented');
  // `evenodd` is what makes the OK sign's ring a hole rather than a disc, and
  // it comes off the file rather than being decided here.
  assert.match(handStyleMarkup('left', 'ok', { at, scale: 1 }), /fill-rule="evenodd"/);
});

test('a whole set is every drawing in one place, one of them showing', () => {
  const markup = handStyleSetMarkup('left', { styles: ids(), showing: 'fist', at, scale: 1 });
  for (const id of ids()) assert.ok(markup.includes(`id="handLeftStyle-${id}"`), `${id} is drawn`);
  // One group per drawing: the set is as many groups as there are gestures.
  assert.equal((markup.match(/<g id="handLeftStyle-/g) || []).length, ids().length);
  const hidden = [...markup.matchAll(/<g id="handLeftStyle-([a-zA-Z]+)"[^>]*opacity="0"/g)].map((match) => match[1]);
  assert.deepEqual(hidden.sort(), ids().filter((id) => id !== 'fist').sort());
});

test('every layer of every drawing has an id of its own, said once in the document', () => {
  const document = handStyleSetMarkup('left', { at, scale: 1 }) + handStyleSetMarkup('right', { at, scale: 1 });
  const seen = [...document.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(seen.filter((id, index) => seen.indexOf(id) !== index), [], 'a pair of hands draws no id twice');
  const layers = ids().reduce((total, id) => total + shapesOf(id).length, 0);
  assert.equal(seen.length, 2 * (ids().length + layers), 'every group and every layer is named');
});

test("a hand's library is its drawings, in the set's order, said once each", () => {
  const library = handStyleLibrary('right', { styles: ['fist', 'open', 'fist', 'nonsense'] });
  assert.deepEqual(library.map((entry) => entry.id), ['fist', 'open']);
  assert.deepEqual(library[0], { id: 'fist', label: 'Fist', element: 'handRightStyle-fist', mirrored: true });
  assert.equal(handStyleLibrary('left', { styles: ['fist'] })[0].mirrored, false);
  // A hand drawn with the whole set is the whole set, in the manifest's order.
  assert.deepEqual(handStyleLibrary('left').map((entry) => entry.id), ids());
});

test('a thumbnail is the same layers without the ids', () => {
  const thumb = handStyleThumbnail('left', 'peace', { at: { x: 20, y: 20 }, size: 40 });
  assert.doesNotMatch(thumb, / id=/, 'two nodes with one id is one node to anything looking for it');
  assert.equal((thumb.match(/<path /g) || []).length, shapesOf('peace').length, 'every layer is in the thumbnail too');
  assert.equal(handStyleThumbnail('left', 'nonsense', {}), '');
});

/* ── The palette ───────────────────────────────────────────────────────────── */

test('a look is two colours and a line width, and no shading of any kind', () => {
  for (const look of Object.values(HAND_LOOKS)) {
    assert.deepEqual(Object.keys(look).sort(), ['fill', 'id', 'line', 'name', 'width']);
  }
  // The face's own palette, so a hand beside a warm face is not a white glove.
  assert.equal(HAND_LOOKS.skin.fill, '#f9d9b0');
  assert.equal(HAND_LOOKS.skin.line, '#a4674a');
  assert.equal(handLook('nonsense').id, DEFAULT_HAND_LOOK);
  assert.equal(handLook({ fill: '#123456' }).fill, '#123456', 'a mascot may hand in its own palette whole');
  const markup = handStyleMarkup('left', 'open', { at, scale: 1, look: 'skin' });
  assert.match(markup, /fill="#f9d9b0"/);
  assert.doesNotMatch(markup, /gradient|filter|opacity="0\./i);
  // Every layer is painted, not just the first one.
  assert.equal((markup.match(/fill="#f9d9b0"/g) || []).length, shapesOf('open').length);
});

/* ── Anchors come off the set, because only the drawing knows ──────────────── */

test('the points something can be held by are the set’s own, and only for what it draws', () => {
  const open = handStyleAnchors('open');
  assert.deepEqual(Object.keys(open).sort(), ['index', 'middle', 'palm', 'ring', 'thumb', 'wrist']);
  assert.deepEqual(open.palm, { x: 0, y: 0 }, 'the pivot is the middle of the palm');
  assert.ok(open.middle.y < open.palm.y, 'a fingertip is above the palm');
  assert.ok(open.wrist.y > open.palm.y, 'and the wrist below it');
  // Declared, not derived: the anchors are what the manifest says they are.
  for (const gesture of manifest.gestures) {
    const anchors = handStyleAnchors(gesture.id);
    for (const [part, where] of Object.entries(gesture.anchors)) {
      assert.deepEqual(anchors[part], { x: where[0], y: where[1] }, `${gesture.id} holds its ${part} where the set says`);
    }
    assert.deepEqual(Object.keys(anchors).sort(), [...Object.keys(gesture.anchors), 'palm', 'wrist'].sort());
  }
  // A fist folds its fingers away, so a knuckle is all there is to hold on to.
  assert.ok(handStyleAnchors('fist').index.y > open.index.y, 'the fist keeps its knuckles much lower');
  // Seen side on there is no finger at all, and the drawing says so rather
  // than inventing a tip behind itself.
  assert.deepEqual(Object.keys(handStyleAnchors('sideFist')).sort(), ['fingers', 'palm', 'thumb', 'wrist']);
  assert.equal(handStyleAnchors('nonsense'), null);
});
