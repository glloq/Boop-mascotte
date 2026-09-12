import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_HAND_LOOK, HAND_LOOKS, HAND_PART_LABELS, HAND_STYLE_IDS, HAND_STYLE_PIVOT, HAND_STYLE_RADIUS,
  HAND_STYLE_SHAPES, HAND_STYLE_SPRITE_SCALE, HAND_STYLE_VIEW_BOX_ATTRIBUTE,
  handLook, handStyleAnchors, handStyleDocument, handStyleElementId, handStyleLibrary, handStyleManifest,
  handStyleMarkup, handStylePath, handStyleSetMarkup, handStyleShapes, handStyleThumbnail
} from '../hands/hand-style-art.js';
import { parsePath } from '../../../runtime/path-vector.js';

const at = { x: 0, y: 0 };
const points = (d) => {
  const { values } = parsePath(d);
  return Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
};
const shapesOf = (style, options = {}) => handStyleShapes(style, { at, scale: 1, ...options });

/* ── PHASE 6: nothing inside a drawing moves ───────────────────────────────── */

test('a style is a list of literal nodes, with nothing that could animate one', () => {
  const tables = JSON.stringify(HAND_STYLE_SHAPES);
  for (const gone of ['curl', 'bend', 'view', 'facing', 'morph', 'shapeKey', 'anim', 'perspective', 'pivotX']) {
    assert.doesNotMatch(tables, new RegExp(gone, 'i'), `no ${gone} anywhere in a drawing`);
  }
  for (const [id, drawing] of Object.entries(HAND_STYLE_SHAPES)) {
    assert.ok(HAND_STYLE_IDS.includes(id), `${id} is a style the registry names`);
    assert.ok(drawing.nodes.length >= 6, `${id} is a rim of points`);
    for (const node of drawing.nodes) {
      assert.ok(['corner', 'digit'].includes(node.kind), `${id} walks ${node.kind}`);
      if (node.kind === 'digit') assert.ok(HAND_PART_LABELS[node.part], `${id} names its ${node.part}`);
    }
  }
});

/* ── One drawing, one layer ────────────────────────────────────────────────── */

test('a drawing is a single closed outline, so a hand is one layer and not a stack', () => {
  for (const id of HAND_STYLE_IDS) {
    const shapes = shapesOf(id);
    assert.equal(shapes.length, 1, `${id} is one shape`);
    assert.equal(shapes[0].part, 'hand', `${id} is the whole hand`);
    // One subpath, closed -- except the OK sign, whose ring encloses a hole.
    const subpaths = (shapes[0].d.match(/M/g) || []).length;
    assert.equal(subpaths, id === 'ok' ? 2 : 1, `${id} draws ${subpaths} subpath(s)`);
    assert.equal((shapes[0].d.match(/Z/g) || []).length, subpaths, `${id} closes every subpath`);
  }
  // The markup is that path and nothing else: no group, no children, nothing
  // inside a drawing to select by mistake.
  const markup = handStyleMarkup('left', 'open', { at, scale: 1 });
  assert.doesNotMatch(markup, /<g\b/, 'a drawing is not wrapped in a group');
  assert.equal((markup.match(/<path/g) || []).length, 1, 'one path is the whole drawing');
  assert.match(markup, /id="handLeftStyle-open"/, 'the path carries the drawing\'s own id');
  // `evenodd` is what makes the OK sign's ring a hole rather than a disc.
  assert.match(handStyleMarkup('left', 'ok', { at, scale: 1 }), /fill-rule="evenodd"/);
});

test('every drawing is only M, C, L and Z — every number a coordinate', () => {
  for (const id of HAND_STYLE_IDS) {
    for (const shape of shapesOf(id)) {
      const { commands } = parsePath(shape.d);
      for (const command of commands) assert.ok('MCLZ'.includes(command), `${id} ${shape.part} draws with "${command}"`);
    }
  }
});

/* ── PHASE 13/14: one convention, one pivot ────────────────────────────────── */

test('every style sits on the same wrist, so a swap never moves the hand', () => {
  const bottom = (id) => Math.max(...points(shapesOf(id)[0].d).map((point) => point.y));
  const rest = HAND_STYLE_SHAPES.relaxed.nodes;
  for (const id of HAND_STYLE_IDS) {
    assert.equal(bottom(id), bottom('relaxed'), `${id} meets the arm where every other drawing does`);
    // Not merely at the same height: the wrist and the far side are the same
    // objects in every table, shared rather than copied into each.
    const nodes = HAND_STYLE_SHAPES[id].nodes;
    assert.equal(nodes[0], rest[0], `${id} starts on the shared wrist`);
    assert.equal(nodes.at(-1), rest.at(-1), `${id} comes back down the shared far side`);
    assert.equal(nodes.at(-2), rest.at(-2), `${id} is as wide as every other drawing`);
  }
});

test('every style fits the same radius around that pivot, so a swap never resizes the hand', () => {
  const reach = {};
  for (const id of HAND_STYLE_IDS) {
    let radius = 0;
    for (const shape of shapesOf(id)) for (const point of points(shape.d)) radius = Math.max(radius, Math.hypot(point.x, point.y));
    reach[id] = radius;
    assert.ok(radius <= HAND_STYLE_RADIUS, `${id} reaches ${radius.toFixed(1)} of ${HAND_STYLE_RADIUS}`);
  }
  // Not merely inside it: the drawings are the same apparent size as each
  // other, so a change of style is not a change of scale.
  const sizes = Object.values(reach);
  assert.ok(Math.min(...sizes) / Math.max(...sizes) > 0.6, `the drawings are ${JSON.stringify(reach)}`);
});

test('a drawing at 2× fits the shared 200 box with room round it', () => {
  const half = HAND_STYLE_VIEW_BOX_ATTRIBUTE.split(' ')[2] / 2;
  assert.equal(HAND_STYLE_PIVOT[0], half);
  assert.equal(HAND_STYLE_PIVOT[1], half);
  const margin = half - HAND_STYLE_RADIUS * HAND_STYLE_SPRITE_SCALE;
  assert.ok(margin > 5, `${margin} units of margin round the widest drawing`);
});

/* ── PHASE 39: a snapshot for every style ──────────────────────────────────── */

test('each style has a standalone file, and the shipped set is what the library draws', () => {
  const dir = fileURLToPath(new URL('../../../assets/hands/defaultCartoon/', import.meta.url));
  const manifest = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));
  assert.deepEqual(manifest.styles.map((style) => style.id), [...HAND_STYLE_IDS]);
  assert.equal(manifest.viewBox, HAND_STYLE_VIEW_BOX_ATTRIBUTE);
  assert.deepEqual(manifest.pivot, [...HAND_STYLE_PIVOT]);
  assert.equal(manifest.fallback, 'relaxed');
  for (const style of manifest.styles) {
    // One file per style, not one per side: every shipped style is mirrorable.
    assert.equal(style.mirrorable, true, `${style.id} is drawn once for both hands`);
    assert.equal(style.src, handStylePath('defaultCartoon', style.id));
    const file = readFileSync(`${dir}${style.src.replace('defaultCartoon/', '')}`, 'utf8');
    assert.equal(file, handStyleDocument(style.id), `${style.id}.svg is what the library draws — run npm run hands:styles`);
    assert.match(file, new RegExp(`viewBox="${HAND_STYLE_VIEW_BOX_ATTRIBUTE}"`));
    assert.match(file, /data-hand-pivot="100 100"/);
    assert.doesNotMatch(file, /<(?:animate|filter|linearGradient|radialGradient|mask|use)\b/, 'a drawing is paths and nothing else');
  }
});

/* ── PHASE 11: mirroring ───────────────────────────────────────────────────── */

test('the right hand is the same drawing with its x negated', () => {
  for (const id of HAND_STYLE_IDS) {
    const left = shapesOf(id), right = shapesOf(id, { flip: true });
    assert.equal(left.length, right.length);
    for (let index = 0; index < left.length; index += 1) {
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

test('a style is one named, inert path', () => {
  const markup = handStyleMarkup('left', 'open', { at: { x: 100, y: 100 }, scale: 2 });
  assert.equal(handStyleElementId('left', 'open'), 'handLeftStyle-open');
  assert.match(markup, /data-name="Open"/, 'the layer reads as the drawing it is');
  assert.doesNotMatch(markup, /opacity=/, 'the drawing a hand starts on is not hidden');
  assert.match(handStyleMarkup('left', 'open', { at, scale: 1, hidden: true }), /opacity="0"/);
  assert.equal(handStyleMarkup('left', 'nonsense', { at, scale: 1 }), '', 'a style nobody drew is not invented');
});

test('a whole set is every drawing in one place, one of them showing', () => {
  const markup = handStyleSetMarkup('left', { styles: HAND_STYLE_IDS, showing: 'fist', at, scale: 1 });
  for (const id of HAND_STYLE_IDS) assert.ok(markup.includes(`id="handLeftStyle-${id}"`), `${id} is drawn`);
  // One layer per drawing: the set is as many paths as there are styles.
  assert.equal((markup.match(/<path/g) || []).length, HAND_STYLE_IDS.length);
  const hidden = [...markup.matchAll(/<path id="handLeftStyle-([a-zA-Z]+)"[^>]*opacity="0"/g)].map((match) => match[1]);
  assert.deepEqual(hidden.sort(), HAND_STYLE_IDS.filter((id) => id !== 'fist').sort());
});

test("a hand's library is its drawings, in the registry's order, said once each", () => {
  const library = handStyleLibrary('right', { styles: ['fist', 'open', 'fist', 'nonsense'] });
  assert.deepEqual(library.map((entry) => entry.id), ['fist', 'open']);
  assert.deepEqual(library[0], { id: 'fist', label: 'Fist', element: 'handRightStyle-fist', mirrored: true });
  assert.equal(handStyleLibrary('left', { styles: ['fist'] })[0].mirrored, false);
});

test('a thumbnail is the same drawing without an id', () => {
  const thumb = handStyleThumbnail('left', 'peace', { at: { x: 20, y: 20 }, size: 40 });
  assert.doesNotMatch(thumb, / id=/);
  assert.equal((thumb.match(/<path /g) || []).length, 1, 'a drawing is one path, in a thumbnail too');
  assert.equal(handStyleThumbnail('left', 'nonsense', {}), '');
});

/* ── PHASE 24: the palette ─────────────────────────────────────────────────── */

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
});

/* ── PHASE 15/23: anchors on a static drawing ──────────────────────────────── */

test('the points something can be held by are fixed, and only for digits a style draws', () => {
  const open = handStyleAnchors('open');
  assert.deepEqual(Object.keys(open).sort(), ['index', 'middle', 'palm', 'pinky', 'ring', 'thumb', 'wrist']);
  assert.deepEqual(open.palm, { x: 0, y: 0 }, 'the pivot is the middle of the palm');
  assert.ok(open.middle.y < open.palm.y, 'a fingertip is above the palm');
  assert.ok(open.wrist.y > open.palm.y, 'and the wrist below it');
  // A fist folds its fingers away, so a knuckle is all there is to hold on to.
  const fist = handStyleAnchors('fist');
  assert.ok(fist.index.y > open.index.y, 'the fist keeps its knuckles much lower');
  // Seen side on there is no finger at all, and the drawing says so rather
  // than inventing a tip behind itself.
  assert.deepEqual(Object.keys(handStyleAnchors('sideFist')).sort(), ['palm', 'thumb', 'wrist']);
  assert.equal(handStyleAnchors('nonsense'), null);
});

test('the manifest is enough on its own to rig a hand from', () => {
  const manifest = handStyleManifest({ set: 'custom', styles: ['open', 'fist'] });
  assert.equal(manifest.set, 'custom');
  assert.equal(manifest.radius, HAND_STYLE_RADIUS);
  assert.deepEqual(manifest.styles.map((style) => style.src), ['custom/open.svg', 'custom/fist.svg']);
});
