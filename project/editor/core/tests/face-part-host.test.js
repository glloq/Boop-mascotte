import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { artworkIds } from '../face-library/face-part-model.js';
import { layerParents } from '../face-library/face-layout.js';
import { assignSemanticRole } from '../../rig-editor/semantic-parts/part-model.js';
import { validateRig } from '../validation/rig-validator.js';
import { instanceIsCustom } from '../../ui/character-builder/character-model.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * An accessory that belongs to a part (V3-03; docs/FACE_PART_LIBRARY.md,
 * "Hosted on a part").
 *
 * A mount point is an anchor, resolved once when the asset is fitted: the
 * earring used to be dropped beside the ear at the place the template's ear
 * happened to be, and choosing another pair of ears left it hanging in the
 * air. A host is a *parent*. The install draws the accessory inside the shape
 * that plays the host's role, and from then on it is carried by whatever
 * carries that shape -- the wiggle, the head turn, a follower's lag -- because
 * the runtime writes a transform per node and SVG composes the nesting.
 *
 * The rule under test: **the earring is on the ear, whichever ear that is.**
 */

/** Each pair of ears as the canvas measures its two sides, which the assets' own reference box (both ears at once) cannot say. */
const EAR_BOXES = Object.freeze({
  'ears.round': { earLeft: { x: 12, y: 103, width: 30, height: 30 }, earRight: { x: 198, y: 103, width: 30, height: 30 } },
  'ears.large': { earLeft: { x: 10, y: 91, width: 34, height: 54 }, earRight: { x: 196, y: 91, width: 34, height: 54 } },
  'ears.small': { earLeft: { x: 20, y: 104, width: 20, height: 28 }, earRight: { x: 200, y: 104, width: 20, height: 28 } }
});

function harness({ assets = [], boxes = {} } = {}) {
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const library = createFacePartRegistry();
  library.registerMany([...BUILTIN_FACE_PARTS, ...assets]);
  const drawn = {};
  for (const asset of library.list()) Object.assign(drawn, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  // Which ears are on, so each side is measured as the side it is rather than
  // as the pair's reference box.
  let wearing = null;
  const installed = (id) => (wearing && EAR_BOXES[wearing]?.[id.replace(/Shape$/, '')]) || drawn[id] || drawn[id.replace(/-\d+$/, '')] || null;
  const canvas = createFakeFaceCanvas(store, { boxes: { ...templateBoxes(), ...boxes }, installed });
  const commands = createFacePartCommands(store, history, canvas, { library });
  return { store, history, canvas, commands, library, wear: (id) => { wearing = id; return commands.replace('ears', id); } };
}

const document_ = (ui) => ui.store.getDocument();
const parentOf = (document, id) => layerParents(document.layers)[id] ?? null;
const partOf = (document, type) => Object.values(document.semanticParts).find((part) => part.type === type);

const frameOf = (document, values) => compileRigFrame(document.elements, { ...document.params, ...values }, document.globalConstraints, document.stateConstraints?.[document.activeState], {
  keyforms: document.keyforms, shapeKeys: document.shapeKeys, warps: document.warps, rigPins: document.rigPins, hands: document.hands, deformers: document.deformers, parallax: document.parallax
});
const seen = (frame, id) => JSON.stringify({ t: frame[id]?.transform, o: frame[id]?.opacity });

/**
 * What carries a piece when a movement is driven: the first thing at or above
 * it whose frame changes. For a part drawn inside its host that is the host
 * itself, and nothing has to be written on the part for it to be true.
 */
function carriedBy(document, id, values) {
  const parents = layerParents(document.layers);
  const rest = frameOf(document, {}), driven = frameOf(document, values);
  for (let at = id; at; at = parents[at]) if (seen(rest, at) !== seen(driven, at)) return at;
  return null;
}

test('an earring hangs on the ear, and is still on it after the ears are swapped three times', () => {
  const ui = harness();
  const earring = ui.commands.replace('accessory', 'accessory.earring');
  assert.equal(earring.ok, true, earring.reason);
  assert.deepEqual(earring.hosted, { partId: 'ears', role: 'leftEar', element: 'earLeft', inside: true }, 'drawn inside the ear, not beside it');
  assert.equal(parentOf(document_(ui), earring.rootId), 'earLeft');
  assert.deepEqual(document_(ui).semanticParts[earring.partId].assetHost, { partId: 'ears', role: 'leftEar' }, 'the document says what it hangs on');
  assert.equal(carriedBy(document_(ui), earring.rootId, { earWiggle: 1 }), 'earLeft', 'the ear wiggles and takes it along');

  // Three pairs of ears, each a different shape in a different place. The
  // earring is on each of them in turn: lifted out of the ear that is going,
  // put inside the one that arrives, and fitted to it.
  for (const [assetId, centre] of [['ears.round', 27], ['ears.large', 27], ['ears.small', 30], ['ears.round', 27]]) {
    const swap = ui.wear(assetId);
    assert.equal(swap.ok, true, `${assetId}: ${swap.reason}`);
    const document = document_(ui);
    const ear = partOf(document, 'ears').roles.leftEar;
    assert.deepEqual(swap.rehomed, [{ partId: earring.partId, role: 'leftEar', host: ear }], `${assetId} re-homes the earring rather than severing it`);
    assert.ok(document.elements[earring.rootId], `${assetId} keeps the earring's drawing`);
    assert.equal(parentOf(document, earring.rootId), ear, `${assetId}: the earring is inside the ear`);
    assert.equal(document.semanticParts[earring.partId].roles.element, 'accessory', `${assetId}: it is still the part it was`);
    assert.equal(carriedBy(document, earring.rootId, { earWiggle: 1 }), ear, `${assetId}: it still wiggles with the ear`);
    // And it is *on* that ear: the fit follows the side's own middle, so the
    // pair whose left ear is drawn three units further in takes it three
    // units further in.
    const at = document.elements[earring.rootId].baseTransform;
    assert.equal(Math.round((at.pivotX + at.x) * 10) / 10, centre + 0.1, `${assetId}: fitted to the ear it now hangs on`);
    // The ears are still the library's ears. A part signs as the shapes it
    // draws and the signature reads the root's whole subtree, which now holds
    // the earring: counting it would mark the ears custom the moment one went
    // on, take the *Current* badge off their card and stop the migration
    // recognising them in a project saved and opened again.
    assert.equal(instanceIsCustom(document, document.semanticParts[swap.partId]), false, `${assetId}: not a drawing somebody reshaped`);
    assert.equal(instanceIsCustom(document, document.semanticParts[earring.partId]), false, `${assetId}: and the earring signs for itself`);
    assert.deepEqual(validateRig(document), [], `${assetId}: the rig is whole`);
  }
  // Nothing was left holding it to a shape that has gone: the nesting is the
  // whole of the link where the host is a group.
  assert.deepEqual(document_(ui).rigConstraints, []);
});

test('a left and a right earring are two slots on one face, and each comes off alone', () => {
  const ui = harness();
  ui.wear('ears.round');
  const left = ui.commands.replace('accessory', 'accessory.earring');
  const right = ui.commands.replace('accessory', 'accessory.earring-right');
  assert.equal(right.ok, true, right.reason);
  assert.notEqual(right.partId, left.partId, 'the right ear is not the left ear\'s slot');
  const document = document_(ui);
  assert.deepEqual(Object.values(document.semanticParts).filter((part) => part.type === 'accessory').map((part) => [part.assetId, part.assetHost.role]),
    [['accessory.earring', 'leftEar'], ['accessory.earring-right', 'rightEar']]);
  assert.deepEqual([parentOf(document, left.rootId), parentOf(document, right.rootId)], ['earLeft', 'earRight'], 'one on each ear');
  assert.equal(carriedBy(document, right.rootId, { earWiggle: 1 }), 'earRight');
  // The same slot replaces: the left earring again is the left earring.
  const again = ui.commands.replace('accessory', 'accessory.earring');
  assert.equal(again.partId, left.partId);
  assert.equal(Object.values(document_(ui).semanticParts).filter((part) => part.type === 'accessory').length, 2);
  // And one comes off without the other.
  const off = ui.commands.remove(right.partId);
  assert.equal(off.ok, true, off.reason);
  assert.deepEqual(off.hosted, [], 'nothing was hanging on the earring itself');
  assert.equal(Object.values(document_(ui).semanticParts).filter((part) => part.type === 'accessory').length, 1);
  assert.ok(document_(ui).elements[again.rootId], 'the left earring stays');
  assert.deepEqual(validateRig(document_(ui)), []);
});

test('a face with one ear still puts the earring on the ear it has', () => {
  // `ear.left` is read from the two ears together -- one ear's box would put a
  // pair over one ear -- so a face missing an ear has no measured anchor
  // there at all. The earring named which ear it hangs on, and that is an
  // answer the pair does not have to give.
  const ui = harness({ boxes: { earLeft: { x: 12.9, y: 117, width: 28, height: 42.05 } } });
  const document = ui.store.getDocument();
  const ears = partOf(document, 'ears');
  ui.store.execute({ type: 'test/one-ear', domains: ['semanticRig'], source: 'test', apply: (draft) => assignSemanticRole(draft, ears.id, 'rightEar', null) });
  const earring = ui.commands.replace('accessory', 'accessory.earring');
  assert.equal(earring.ok, true, earring.reason);
  assert.equal(parentOf(document_(ui), earring.rootId), 'earLeft');
  // Twenty units below where the template keeps its ear, which is where this
  // face keeps its one ear.
  assert.equal(document_(ui).elements[earring.rootId].baseTransform.y, 20);
});

/* ── A host that cannot hold a drawing ───────────────────────────────────── */

/** A pair of ears drawn as two bare shapes, as the library's own were before V3-03: there is nothing to draw an earring inside. */
const BARE_EARS = Object.freeze({
  id: 'ears.bare', category: 'ears', name: 'Bare', origin: 'custom',
  artwork: '<g id="ears-bare" data-name="Ears"><circle id="earLeft" data-name="Left ear" cx="27" cy="118" r="15" fill="#f9d9b0" /><circle id="earRight" data-name="Right ear" cx="213" cy="118" r="15" fill="#f9d9b0" /></g>',
  roles: Object.freeze({ leftEar: 'earLeft', rightEar: 'earRight' }),
  capabilities: Object.freeze(['earWiggle']),
  referenceBox: Object.freeze({ x: 12, y: 103, width: 216, height: 30 }),
  mountPoint: 'ears'
});

test('a host with no inside is followed by a constraint, and the follow moves to the next host', () => {
  const ui = harness({ assets: [BARE_EARS] });
  ui.wear('ears.bare');
  const earring = ui.commands.replace('accessory', 'accessory.earring');
  assert.equal(earring.ok, true, earring.reason);
  assert.deepEqual(earring.hosted, { partId: 'ears', role: 'leftEar', element: 'earLeft', inside: false }, 'a shape has no inside');
  assert.equal(parentOf(document_(ui), earring.rootId), 'faceRoot', 'so it is drawn beside the face, as any accessory is');
  const held = document_(ui).rigConstraints.filter((item) => item.target === earring.rootId);
  assert.deepEqual(held.map((item) => [item.type, item.source]), [['parent', 'earLeft']], 'and follows the ear instead');
  assert.deepEqual(validateRig(document_(ui)), []);

  // The ears are replaced by a pair that *can* hold it: the constraint goes,
  // because nesting is the better link and two links would move it twice.
  const swap = ui.wear('ears.round');
  assert.equal(swap.ok, true, swap.reason);
  assert.deepEqual(swap.rehomed, [{ partId: earring.partId, role: 'leftEar', host: 'earLeft' }]);
  assert.equal(parentOf(document_(ui), earring.rootId), 'earLeft');
  assert.deepEqual(document_(ui).rigConstraints, [], 'the constraint that stood in for the nesting is gone');
  assert.equal(carriedBy(document_(ui), earring.rootId, { earWiggle: 1 }), 'earLeft');
  assert.deepEqual(validateRig(document_(ui)), []);
});

/* ── Taking the host off ─────────────────────────────────────────────────── */

/** Facial hair drawn as a group, and a badge that hangs on it: a host a face can take off again. */
const HOOD = Object.freeze({
  id: 'facialhair.hood', category: 'facialHair', name: 'Hood', origin: 'custom',
  artwork: '<g id="hood" data-name="Hood"><path id="facialHair" data-name="Hood" d="M90 200 L150 200 L150 220 L90 220 Z" fill="#33424f" /></g>',
  roles: Object.freeze({ facialHair: 'hood' }),
  capabilities: Object.freeze([]),
  referenceBox: Object.freeze({ x: 90, y: 200, width: 60, height: 20 }),
  mountPoint: 'mouth.center'
});
const BADGE = Object.freeze({
  id: 'accessory.badge', category: 'accessory', name: 'Badge', origin: 'custom',
  artwork: '<g id="accessory-badge" data-name="Badge"><circle id="accessory" data-name="Badge" cx="120" cy="210" r="5" fill="#c8a24a" /></g>',
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  referenceBox: Object.freeze({ x: 115, y: 205, width: 10, height: 10 }),
  mountPoint: 'mouth.center',
  host: Object.freeze({ part: 'facialHair', role: 'facialHair' })
});

test('what hangs on a part comes off with it, because a part whose drawing has gone is not a part', () => {
  const ui = harness({ assets: [HOOD, BADGE] });
  const hood = ui.commands.replace('facialHair', 'facialhair.hood');
  const badge = ui.commands.replace('accessory', 'accessory.badge');
  assert.equal(badge.ok, true, badge.reason);
  assert.equal(parentOf(document_(ui), badge.rootId), 'hood');
  const off = ui.commands.remove(hood.partId);
  assert.equal(off.ok, true, off.reason);
  assert.deepEqual(off.hosted, [badge.partId], 'the badge was inside the hood');
  const document = document_(ui);
  assert.deepEqual([document.semanticParts[hood.partId], document.semanticParts[badge.partId]], [undefined, undefined]);
  assert.equal(badge.rootId in document.elements, false);
  assert.deepEqual(validateRig(document), []);
});
