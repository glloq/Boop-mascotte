import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SLOT_ANCHOR_ALTERNATIVES, SLOT_ANCHOR_CANDIDATES, VARIANT_GEOMETRY_TOLERANCE,
  assetGeometryIssues, assetReview, fitOnHead, referenceCentre, reviewAssets, reviewWarnings, variantGeometryIssues
} from '../face-library/face-asset-review.js';
import { FACE_PART_LIBRARY, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { HEAD_NARROW, HEAD_OVAL, HEAD_ROUND, HEAD_SQUARE_SOFT, HEAD_WIDE } from '../face-library/builtin/heads.js';
import { TEMPLATE_FACE_LAYOUT } from '../face-library/face-layout.js';
import { FACE_MOUNT_POINTS } from '../face-library/face-part-model.js';
import { FACE_SLOTS, faceSlot } from '../face-library/face-morphologies.js';
import {
  MATRIX_HEADS, MEASURED_GEOMETRY_TOLERANCE, assetSheetMarkup, assetContactSheet,
  measuredIssues, parseSheetArgs, writeAssetSheet
} from '../../../../scripts/face-asset-sheet.mjs';

/**
 * MASC-09 — what the layout engine makes of a drawing, before there are fifty.
 *
 * The seven visual slots of MASC-08 have no drawings yet, and the first person
 * to draw one has no way to see where the engine thinks its centre, its anchor
 * and its size are. This is the model that answers, and the sheet that draws
 * the answer. Nothing here writes a document, touches the runtime, or adds a
 * second validator: the numeric checks are the ones `validateFacePart` does not
 * make, and every placement comes from `face-layout.js`.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace(/\./g, '-');
  const role = { mouth: 'mouth', accessory: 'element', head: 'head', nose: 'nose' }[category] || 'element';
  return {
    id, category, name: id.split('.')[1], origin: 'custom',
    artwork: `<g id="${root}"><path id="${root}-a" d="M100 140 L140 140 L140 160 L100 160 Z"/></g>`,
    roles: { [role]: `${root}-a` }, referenceBox: { x: 100, y: 140, width: 40, height: 20 }, ...extra
  };
};

/* ── The review model ──────────────────────────────────────────────────── */

test('a built-in drawing reviews as what the engine sees, and the shipped library is clean', () => {
  const review = assetReview(FACE_PART_LIBRARY.get('accessory.hat'));
  assert.equal(review.id, 'accessory.hat');
  assert.equal(review.category, 'accessory');
  assert.equal(review.slot, 'accessory', 'a drawing that names no slot is offered under its category');
  assert.equal(review.mountPoint, 'head.top');
  assert.equal(review.fittedMountPoint, 'head.top', 'and the fit really used it');
  assert.deepEqual(review.referenceBox, { x: 40, y: -42, width: 160, height: 84 });
  assert.deepEqual(review.referenceCentre, { x: 120, y: 0 }, 'the centre is the pivot a fit scales about');
  assert.deepEqual(review.morphologies, ['human', 'muzzle', 'beak', 'robot', 'monster'], 'saying nothing is every kind');
  assert.deepEqual(review.declaredMorphologies, [], 'and saying nothing is preserved as saying nothing');
  assert.equal(review.baseAssetId, 'accessory.hat');
  assert.equal(review.style, '');
  assert.deepEqual(review.geometryIssues, []);

  // The whole shipped library places: this is the invariant the seven new slots
  // will be held to, and it holds today.
  const all = reviewAssets();
  assert.equal(all.length, FACE_PART_LIBRARY.list().length, 'every drawing, its styles among them');
  assert.deepEqual(reviewWarnings(all), [], 'nothing the engine cannot place, and nothing suspect');
  for (const review of all) {
    assert.ok(review.referenceBox.width > 0 && review.referenceBox.height > 0, `${review.id} has a box with a size`);
    assert.ok(FACE_MOUNT_POINTS.includes(review.mountPoint), `${review.id} mounts somewhere a face has`);
    assert.ok(review.referenceCentre, `${review.id} has a centre`);
    assert.ok(review.fit.scaleX > 0 && review.fit.scaleY > 0, `${review.id} fits at a real size`);
  }
});

test('the centre of a reference box is its pivot, and a box that is not one has none', () => {
  assert.deepEqual(referenceCentre({ x: 100, y: 140, width: 40, height: 20 }), { x: 120, y: 150 });
  for (const bad of [null, undefined, {}, { x: 0, y: 0, width: 0, height: 10 }, { x: NaN, y: 0, width: 4, height: 4 }]) {
    assert.equal(referenceCentre(bad), null);
  }
});

test('a drawing the engine cannot place says so, and never silently', () => {
  const codes = (asset) => assetGeometryIssues(asset).map((item) => item.code);
  assert.deepEqual(codes({ id: 'x.y', category: 'accessory', mountPoint: 'head.center' }), ['box-missing']);
  assert.deepEqual(codes({ id: 'x.y', category: 'accessory', mountPoint: 'head.center', referenceBox: { x: 0, y: 0, width: 0, height: 10 } }), ['box-missing']);
  // An anchor no face has: the fit falls back to the centre of the head, which
  // is a silent answer to a question the author got wrong.
  const wrong = { id: 'x.y', category: 'accessory', mountPoint: 'nose.tip', referenceBox: { x: 100, y: 140, width: 40, height: 20 } };
  assert.deepEqual(codes(wrong), ['mount-unknown']);
  assert.equal(assetReview(wrong).fittedMountPoint, 'head.center', 'and the review says which anchor was really used');
  assert.deepEqual(codes(FACE_PART_LIBRARY.get('nose.dot')), []);
});

/* ── The fit, on the template and on five skulls ───────────────────────── */

test('a drawing lands on the template where it was drawn, because that is the frame it was drawn in', () => {
  for (const id of ['nose.dot', 'mouth.wide', 'accessory.glasses']) {
    const { fit } = assetReview(FACE_PART_LIBRARY.get(id));
    assert.equal(fit.scaleX, 1, `${id} is not resized on the face it was drawn for`);
    assert.ok(Math.abs(fit.x) < 1 && Math.abs(fit.y) < 1, `${id} is not moved either (${fit.x}, ${fit.y})`);
  }
});

test('the fit matrix is the engine on five skulls, and nothing is nudged', () => {
  const hat = FACE_PART_LIBRARY.get('accessory.hat');
  const heads = [HEAD_ROUND, HEAD_OVAL, HEAD_WIDE, HEAD_NARROW, HEAD_SQUARE_SOFT];
  assert.deepEqual(MATRIX_HEADS.map((head) => head.id), heads.map((head) => head.id));
  const fits = heads.map((head) => ({ head: head.id, ...fitOnHead(hat, head.referenceBox).fit }));
  for (const fit of fits) {
    assert.ok(Number.isFinite(fit.x) && Number.isFinite(fit.y), `${fit.head} places the hat somewhere real`);
    assert.ok(fit.scaleX > 0, `${fit.head} places it at a real size`);
    assert.equal(fit.mountPoint, 'head.top');
  }
  // The scale is the head's width over the template's, which is the whole of
  // the similarity: a narrow skull wears a narrower hat, and a wide one a wider.
  const by = Object.fromEntries(fits.map((fit) => [fit.head, fit.scaleX]));
  assert.ok(Math.abs(by['head.round'] - 1) < 0.01, `the round head is the template (${by['head.round']})`);
  assert.ok(by['head.narrow'] < by['head.round'] && by['head.round'] < by['head.wide'], `narrow ${by['head.narrow']} < round 1 < wide ${by['head.wide']}`);
  // And a head with no other part measured still answers for every anchor: the
  // template's proportions, applied to that skull.
  const { layout } = fitOnHead(hat, HEAD_NARROW.referenceBox);
  for (const name of FACE_MOUNT_POINTS) assert.ok(Number.isFinite(layout.anchors[name].x), `${name} resolves on a bare head`);
  assert.equal(layout.anchors['head.center'].measured, true);
  assert.equal(layout.anchors['nose.center'].measured, false, 'a face with no nose keeps the nose where the template keeps it');
});

/* ── A style is the same piece in another language ─────────────────────── */

const world = (variantExtra = {}) => {
  const library = createFacePartRegistry();
  library.registerMany([
    part('accessory.muzzle-short', 'accessory', { slot: 'muzzle', mountPoint: 'nose.center', morphologies: ['muzzle'], tags: ['cat'] }),
    part('accessory.muzzle-short-flat', 'accessory', { mountPoint: 'nose.center', variant: { of: 'accessory.muzzle-short', style: 'flat' }, ...variantExtra })
  ]);
  return library;
};

test('a style that is the same piece in another language says nothing and is warned about nothing', () => {
  const library = world();
  const base = library.get('accessory.muzzle-short'), variant = library.get('accessory.muzzle-short-flat');
  assert.deepEqual(variantGeometryIssues(base, variant), []);
  // It repeats neither its slot, its kinds of face nor its tags, and it does
  // not have to: the canonical base answers for all three (MASC-08B).
  assert.deepEqual([variant.slot, [...variant.morphologies], [...variant.tags]], ['', [], []]);
  const review = assetReview(variant, { library });
  assert.deepEqual([review.slot, review.baseAssetId, review.style], ['muzzle', 'accessory.muzzle-short', 'flat']);
  assert.deepEqual(review.geometryIssues, []);
});

test('a style that would move the piece is suspect, and says which way', () => {
  const codes = (extra) => variantGeometryIssues(world(extra).get('accessory.muzzle-short'), world(extra).get('accessory.muzzle-short-flat')).map((item) => item.code);
  assert.deepEqual(codes({ mountPoint: 'mouth.center' }), ['variant-mount']);
  assert.deepEqual(codes({ host: { part: 'ears', role: 'leftEar' } }), ['variant-host']);
  assert.deepEqual(codes({ slot: 'whiskers' }), ['variant-slot'], 'a stated disagreement, unlike silence');
  // The centre may drift by 6% of the base box's longer side: 40 × 0.06 is 2.4.
  assert.deepEqual(codes({ referenceBox: { x: 102, y: 140, width: 40, height: 20 } }), [], 'two units is a thicker outline');
  assert.deepEqual(codes({ referenceBox: { x: 112, y: 140, width: 40, height: 20 } }), ['variant-centre'], 'twelve is another place');
  // And the size by 15% either way.
  assert.deepEqual(codes({ referenceBox: { x: 100, y: 140, width: 44, height: 20 } }), [], 'a tenth wider is a heavier stroke');
  assert.deepEqual(codes({ referenceBox: { x: 100, y: 140, width: 60, height: 30 } }), ['variant-centre', 'variant-size', 'variant-size'], 'half again is another drawing');
  assert.deepEqual(Object.keys(VARIANT_GEOMETRY_TOLERANCE), ['centre', 'size']);
  // Nothing here refuses anything: the library registered every one of them.
  assert.ok(world({ mountPoint: 'mouth.center' }).get('accessory.muzzle-short-flat'));
});

test('reviewing narrows the way the sheet narrows, and a style brings the drawing it restyles', () => {
  const library = world();
  assert.deepEqual(reviewAssets({ library }).map((item) => item.id), ['accessory.muzzle-short', 'accessory.muzzle-short-flat']);
  assert.deepEqual(reviewAssets({ library, slot: 'muzzle' }).map((item) => item.id), ['accessory.muzzle-short', 'accessory.muzzle-short-flat']);
  assert.deepEqual(reviewAssets({ library, slot: 'accessory' }).map((item) => item.id), []);
  assert.deepEqual(reviewAssets({ library, morphology: 'muzzle' }).map((item) => item.id).length, 2);
  assert.deepEqual(reviewAssets({ library, morphology: 'human' }).map((item) => item.id), [], 'a cat\'s muzzle is not offered to people');
  assert.deepEqual(reviewAssets({ library, asset: 'accessory.muzzle-short-flat' }).map((item) => item.id), ['accessory.muzzle-short', 'accessory.muzzle-short-flat'], 'asking about a style asks about its base too');
  assert.deepEqual(reviewAssets({ library, style: 'flat' }).map((item) => item.id), ['accessory.muzzle-short', 'accessory.muzzle-short-flat']);
  assert.deepEqual(reviewAssets({ library, style: 'retro' }).map((item) => item.id), []);
  assert.throws(() => reviewAssets({ library, slot: 'nope' }), /no slot called "nope"/);
});

/* ── The anchors the seven new slots propose ───────────────────────────── */

test('every candidate anchor is one the template really has, and every new slot has one', () => {
  const dedicated = Object.values(FACE_SLOTS).filter((slot) => slot.id !== slot.category).map((slot) => slot.id);
  assert.deepEqual(Object.keys(SLOT_ANCHOR_CANDIDATES).sort(), [...dedicated].sort(), 'the seven, and only the seven');
  for (const [id, anchor] of Object.entries({ ...SLOT_ANCHOR_CANDIDATES, ...SLOT_ANCHOR_ALTERNATIVES })) {
    assert.ok(faceSlot(id), `${id} is a slot`);
    assert.ok(FACE_MOUNT_POINTS.includes(anchor), `${anchor} is a mount point that already exists`);
    assert.ok(TEMPLATE_FACE_LAYOUT.anchors[anchor], `${anchor} resolves on the template`);
  }
  // A candidate is a proposal on a QA sheet and nothing the editor reads: what
  // the engine fits to is still the asset's own `mountPoint`.
  const muzzle = part('accessory.muzzle-short', 'accessory', { slot: 'muzzle', mountPoint: 'head.top' });
  assert.equal(assetReview(muzzle).fittedMountPoint, 'head.top', 'the asset decides, not the table');
});

/* ── The sheet, without a browser ──────────────────────────────────────── */

test('the sheet draws every drawing it was given, through the engine and not around it', () => {
  const reviews = reviewAssets({ asset: 'accessory.hat' });
  const html = assetSheetMarkup(reviews, { title: 'Face assets' });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<b>1<\/b> drawing reviewed/);
  assert.match(html, /<b>0<\/b> geometry warnings/);
  assert.match(html, /id="asset-accessory-hat"/);
  // The three views: alone, on the reference face, and the matrix.
  assert.match(html, /alone<small>box · pivot · anchor<\/small>/);
  assert.match(html, /auto-fitted<small>on the reference face<\/small>/);
  assert.match(html, /Fit matrix — 5 skulls/);
  for (const head of MATRIX_HEADS) assert.ok(html.includes(`>${head.name}<`), `${head.name} is in the matrix`);
  // The metadata a reader would otherwise dig out of the source.
  for (const text of ['slot → category', 'works with', 'mount point', 'reference box', 'centre / pivot', 'head.top', '40 -42 160 × 84']) {
    assert.ok(html.includes(text), `the sheet says "${text}"`);
  }
  // The slot reference, with the candidates named as candidates.
  assert.match(html, /id="slot-reference"/);
  assert.match(html, /These anchors are <b>candidates<\/b>, not rules/);
  for (const [id, anchor] of Object.entries(SLOT_ANCHOR_CANDIDATES)) {
    assert.ok(html.includes(`<code>${id}</code>`), `${id} is on the slot sheet`);
    assert.ok(html.includes(`<code>${anchor}</code>`), `${anchor} is on the slot sheet`);
  }
  // And the placement is the runtime's own transform, about the fit's pivot.
  const fit = reviews[0].fit;
  assert.ok(html.includes(`translate(${fit.x} ${fit.y}) translate(${fit.pivotX} ${fit.pivotY}) scale(${fit.scaleX} ${fit.scaleY})`), 'the fit, written as the runtime writes it');
});

test('a drawing the engine cannot place is flagged on the sheet rather than skipped', () => {
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const reviews = [{ ...assetReview(FACE_PART_LIBRARY.get('nose.dot')), geometryIssues: [{ severity: 'warning', code: 'made-up', message: 'Something to say.', field: 'referenceBox' }] }];
  const html = assetSheetMarkup(reviews, { library });
  assert.match(html, /<b>1<\/b> geometry warning\b/);
  assert.match(html, /class="asset flagged"/);
  assert.match(html, /<code>made-up<\/code> Something to say\./);
});

test('the contact sheet is one SVG of the drawings alone, with the box and the pivot on each', () => {
  const svg = assetContactSheet(reviewAssets({ asset: 'accessory.hat' }));
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /accessory\.hat/);
  assert.match(svg, /stroke-dasharray="4 3"/, 'the reference box');
  assert.match(svg, /<circle cx="120" cy="0" r="2\.6"/, 'the pivot');
});

test('the flags are read without a framework, and a slot nobody drew for makes an empty sheet rather than an error', () => {
  assert.deepEqual(parseSheetArgs([]), { slot: null, morphology: null, asset: null, style: null, measure: false, out: 'out/face-assets' });
  assert.deepEqual(parseSheetArgs(['--slot', 'muzzle', '--measure', 'out/mine']), { slot: 'muzzle', morphology: null, asset: null, style: null, measure: true, out: 'out/mine' });
  assert.deepEqual(parseSheetArgs(['--morphology', 'beak', '--style', 'flat']).morphology, 'beak');
  const html = assetSheetMarkup(reviewAssets({ slot: 'muzzle' }), { filters: { slot: 'muzzle' } });
  assert.match(html, /<b>0<\/b> drawings reviewed · slot muzzle/, 'nothing is drawn for a muzzle yet, and the sheet says so');
});

test('the measured reading is a question about the box, and a clipped drawing is not asked it', () => {
  const declared = { x: 100, y: 140, width: 40, height: 20 };
  assert.deepEqual(measuredIssues(declared, { x: 100, y: 140, width: 40, height: 20 }), []);
  assert.deepEqual(measuredIssues(declared, { x: 90, y: 140, width: 60, height: 20 }).map((item) => item.code), ['artwork-overflow']);
  assert.deepEqual(measuredIssues(declared, { x: 90, y: 140, width: 60, height: 20 }, { clipped: true }).map((item) => item.code), [],
    'a clip is not geometry: `getBBox` measures the lids parked outside the socket, and the socket is the right box');
  assert.deepEqual(measuredIssues(declared, { x: 110, y: 145, width: 20, height: 6 }).map((item) => item.code), ['box-slack', 'box-slack']);
  assert.deepEqual(Object.keys(MEASURED_GEOMETRY_TOLERANCE), ['overflow', 'slack']);
});

test('the sheet writes a page and a contact sheet, and nothing else', () => {
  const out = mkdtempSync(join(tmpdir(), 'face-assets-'));
  try {
    const written = writeAssetSheet({ out, asset: 'accessory.hat' });
    assert.deepEqual(written.files, [`${out}/index.html`, `${out}/assets.svg`]);
    assert.equal(written.reviews.length, 1);
    assert.deepEqual(written.warnings, []);
    assert.match(readFileSync(`${out}/index.html`, 'utf8'), /id="asset-accessory-hat"/);
    assert.match(readFileSync(`${out}/assets.svg`, 'utf8'), /^<svg /);
    // A measurement taken elsewhere rides into the page rather than being re-taken here.
    const measured = new Map([['accessory.hat', { issues: [{ severity: 'warning', code: 'box-slack', message: 'Roomy.', field: 'referenceBox' }] }]]);
    assert.equal(writeAssetSheet({ out, asset: 'accessory.hat', measured }).warnings.length, 1);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

/* ── The mount point survives an edit (MASC-09 §5) ─────────────────────── */

test('a drawing that mounts at the nose is saved again mounting at the nose', async () => {
  const { installStubDom } = await import('./helpers/stub-dom.js');
  installStubDom();
  const { createCharacterBuilder } = await import('../../ui/character-builder/character-builder.js');
  const { createEditorStore } = await import('../state/editor-store.js');
  const { createHistory } = await import('../undo/history.js');
  const { createTemplateProjectState } = await import('../sample/templates/template-export.js');
  const { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } = await import('./helpers/fake-face-canvas.js');
  const { createFacePartCommands } = await import('../face-library/face-part-commands.js');
  const { loadCustomParts } = await import('../face-library/face-part-registry.js');
  const { artworkIds } = await import('../face-library/face-part-model.js');
  const { assetSlot } = await import('../face-library/face-morphologies.js');

  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  library.register(part('accessory.pack-muzzle', 'accessory', { slot: 'muzzle', mountPoint: 'nose.center', morphologies: ['muzzle'], tags: ['cat'], pack: 'Cats' }));
  const inspectorHost = document.createElementNS('', 'div');
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const assets = {};
  for (const asset of library.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = {
    ...createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || assets[id.replace(/-\d+$/, '')] || null }),
    applyElementTransform: () => {}, elementKind: () => null, describePaints: () => [], setAppearance: () => true
  };
  const stored = new Map();
  const partStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  const commands = createFacePartCommands(store, history, canvas, { library, partStorage });
  const builder = createCharacterBuilder({
    browserHost: document.createElementNS('', 'div'), inspectorHost,
    store, history, canvas, facePartCommands: commands
  });
  builder.render();
  builder.useStyle('accessory.pack-muzzle');
  const root = Object.values(store.getDocument().semanticParts).find((item) => item.assetId === 'accessory.pack-muzzle').assetRoot;
  builder.selectPiece(root);

  // The form opens on the anchor the drawing already uses, not its category's:
  // a muzzle anchored at the nose that came back anchored at the centre of the
  // head would be a piece the author has to re-place after every edit.
  assert.match(inspectorHost.innerHTML, /<option value="nose\.center" selected>nose\.center<\/option>/);
  assert.equal(/<option value="head\.center" selected>/.test(inspectorHost.innerHTML), false);
  const saved = commands.saveAsPart({ rootId: root, slot: 'muzzle', name: 'My muzzle', roles: { element: root }, mountPoint: 'nose.center', morphologies: ['muzzle'], tags: ['cat'] });
  assert.equal(saved.ok, true, saved.reason);
  assert.equal(saved.asset.mountPoint, 'nose.center', 'and not head.center, which is what the accessory category would have given it');

  // Through storage and back: the geometry contract survives the session.
  const again = createFacePartRegistry();
  again.registerMany(BUILTIN_FACE_PARTS);
  loadCustomParts(partStorage, again);
  const back = again.get('accessory.my-muzzle');
  assert.deepEqual([back.category, back.slot, back.mountPoint, [...back.morphologies], [...back.tags]], ['accessory', 'muzzle', 'nose.center', ['muzzle'], ['cat']]);
  assert.equal(assetSlot(back), 'muzzle');
  // The copy's box is its own drawing's, recalculated: an author who reshaped
  // the piece gets the box of what they drew, not the box of what it came from.
  assert.ok(back.referenceBox.width > 0 && back.referenceBox.height > 0);
  assert.deepEqual(assetReview(back, { library: again }).geometryIssues, []);
});
