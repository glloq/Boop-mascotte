import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFacePart, partArtworkMarkup, partRenderer, pictureNodeId } from '../face-library/face-part-model.js';
import { validateFacePart } from '../face-library/face-part-validation.js';
import { assetRef, parseAssetRef } from '../../../runtime/asset-reference.js';

const ID = '7f3c9a1b2c3d4e5f';
const drawnPart = (over = {}) => ({
  id: 'mouth.grin', category: 'mouth', name: 'Grin',
  artwork: '<g id="mouth"><path d="M0 0 L10 0"/></g>', roles: { mouth: 'mouth' }, ...over
});
const picturePart = (over = {}) => drawnPart({ artwork: '', picture: { assetId: ID, width: 64, height: 32 }, ...over });

test('a part is drawn by markup or by a picture, and says which',()=>{
  assert.equal(partRenderer(normalizeFacePart(drawnPart())),'svg');
  assert.equal(partRenderer(normalizeFacePart(picturePart())),'image');
  // Added beside `artwork`, not by widening it: the installer, the validator,
  // the scanner and the pack reader all still read a string.
  assert.equal(typeof normalizeFacePart(picturePart()).artwork,'string');
  assert.deepEqual(normalizeFacePart(picturePart()).picture,{ assetId: ID, width: 64, height: 32 });
});

test('a picture that cannot be addressed is refused rather than repaired',()=>{
  // A part whose picture has no usable id would install as a hole.
  for (const picture of [
    { assetId: 'nope', width: 8, height: 8 }, { assetId: '', width: 8, height: 8 },
    { assetId: 'asset:../../etc/passwd', width: 8, height: 8 },
    { assetId: ID, width: 0, height: 8 }, { assetId: ID, width: 8 }, null, 'asset:' + ID
  ]) assert.equal(normalizeFacePart(picturePart({ picture })).picture,null,JSON.stringify(picture));
  // A whole reference or a bare hash, either way.
  assert.equal(normalizeFacePart(picturePart({ picture: { assetId: assetRef(ID), width: 8, height: 8 } })).picture.assetId,ID);
  assert.equal(normalizeFacePart(picturePart({ picture: { assetId: ID.toUpperCase(), width: 8, height: 8 } })).picture.assetId,ID);
});

test('a picture part installs as one image, at the size it was authored against',()=>{
  const part = normalizeFacePart(picturePart({ referenceBox: { x: 10, y: 20, width: 80, height: 40 } }));
  const markup = partArtworkMarkup(part);
  assert.match(markup,/^<image id="mouth" href="asset:7f3c9a1b2c3d4e5f" x="10" y="20" width="80" height="40"/);
  assert.match(markup,/preserveAspectRatio="xMidYMid meet"/);
  assert.ok(parseAssetRef(/href="([^"]+)"/.exec(markup)[1]),'and through a reference the cleaner keeps');
  // No reference box: its own pixels.
  assert.match(partArtworkMarkup(normalizeFacePart(picturePart())),/x="0" y="0" width="64" height="32"/);
  // A markup part is unchanged by any of this.
  assert.equal(partArtworkMarkup(normalizeFacePart(drawnPart())),'<g id="mouth"><path d="M0 0 L10 0"/></g>');
});

test('a picture is one rectangle, so it plays one role',()=>{
  assert.equal(pictureNodeId(normalizeFacePart(picturePart())),'mouth');
  // A drawing that has to be an upper lid *and* a lower one is a drawing.
  const twoRoles = normalizeFacePart(picturePart({ roles: { upperLid: 'lidUpper', lowerLid: 'lidLower' } }));
  assert.equal(pictureNodeId(twoRoles),'');
  assert.equal(partArtworkMarkup(twoRoles),'');
  assert.ok(validateFacePart(picturePart({ roles: { upperLid: 'lidUpper', lowerLid: 'lidLower' } })).issues.some((issue) => issue.code === 'picture-roles'));
  // And two roles pointing at one element is still one element.
  assert.equal(pictureNodeId(normalizeFacePart(picturePart({ roles: { mouth: 'mouth', lips: 'mouth' } }))),'mouth');
});

test('validation accepts a picture part and still refuses a part with neither or both',()=>{
  const codes = (part) => validateFacePart(part).issues.map((issue) => issue.code);
  assert.ok(!codes(picturePart()).includes('artwork-missing'));
  assert.ok(!codes(picturePart()).some((code) => code.startsWith('artwork-')));
  assert.ok(codes(drawnPart({ artwork: '', picture: null })).includes('artwork-missing'));
  assert.ok(codes(picturePart({ artwork: '<g id="mouth"/>' })).includes('artwork-doubled'));
});

test('a picture part goes through the install machinery like any other',async()=>{
  const { remapArtworkIds } = await import('../face-library/face-part-artwork.js');
  const { artworkIds } = await import('../face-library/face-part-model.js');
  const part = normalizeFacePart(picturePart({ referenceBox: { x: 0, y: 0, width: 64, height: 32 } }));
  const markup = partArtworkMarkup(part);

  // The installer renames ids to keep them unique; a picture has exactly one
  // and it renames like any other.
  const { markup: remapped, renamed } = remapArtworkIds(markup, { rename: (id) => `pv-${id}` });
  assert.deepEqual(renamed,{ mouth: 'pv-mouth' });
  assert.match(remapped,/id="pv-mouth"/);
  assert.match(remapped,new RegExp(`href="${assetRef(ID)}"`),'and the reference rides through untouched');
  assert.deepEqual(artworkIds(markup),['mouth']);

  // A drawing part is byte-for-byte what it always was through the same path:
  // the helper is only a question, not a rewrite.
  const drawn = normalizeFacePart(drawnPart());
  assert.equal(partArtworkMarkup(drawn),drawn.artwork);
});

test('every category the library installs can be a picture, not just a mouth',async()=>{
  // The exit this phase was written for: any standard part swaps a drawing
  // for a photograph without anything else in the system caring. Asserted
  // across the whole category table rather than on one example, so a category
  // that quietly could not would be a failure rather than a thing nobody
  // tried.
  const { FACE_PART_CATEGORIES } = await import('../face-library/face-part-model.js');
  const installable = FACE_PART_CATEGORIES.filter((category) => category.installable);
  assert.ok(installable.length >= 11,`${installable.length} categories`);

  for (const category of installable) {
    const id = `${category.id.toLowerCase()}.snapshot`;
    const part = {
      id, category: category.id, name: `${category.label} picture`,
      artwork: '', picture: { assetId: ID, width: 64, height: 32 },
      roles: { [category.part]: category.part }
    };
    const normalized = normalizeFacePart(part);
    assert.equal(partRenderer(normalized),'image',id);
    assert.match(partArtworkMarkup(normalized),new RegExp(`^<image id="${category.part}" href="asset:`),id);

    const { issues } = validateFacePart(part);
    const blocking = issues.filter((issue) => issue.level !== 'warning' && (issue.field === 'artwork' || issue.field === 'picture'));
    assert.deepEqual(blocking,[],`${id}: ${blocking.map((issue) => issue.message).join('; ')}`);
  }
});

test('a picture and a drawing of the same part are interchangeable to everything downstream',async()=>{
  const { remapArtworkIds } = await import('../face-library/face-part-artwork.js');
  // Same id, same category, same role: only what draws it differs, and the
  // install path cannot tell them apart beyond the markup it is handed.
  const asDrawing = normalizeFacePart(drawnPart());
  const asPicture = normalizeFacePart(picturePart());
  for (const key of ['id', 'category', 'name', 'mountPoint', 'depth', 'host', 'variant']) assert.deepEqual(asPicture[key],asDrawing[key],key);
  assert.deepEqual(asPicture.roles,asDrawing.roles);

  for (const part of [asDrawing, asPicture]) {
    const { renamed } = remapArtworkIds(partArtworkMarkup(part), { rename: (nodeId) => `x-${nodeId}` });
    assert.deepEqual(renamed,{ mouth: 'x-mouth' },partRenderer(part));
  }
});
