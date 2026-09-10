import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { FACE_PART_DOMAINS, FACE_PART_FIELDS, applyFacePartReplacement, planFacePartReplacement, scrubRemovedArtwork } from '../face-library/face-part-install.js';
import { remapArtworkIds } from '../face-library/face-part-artwork.js';
import { artworkIds, normalizeFacePart } from '../face-library/face-part-model.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';
import { MOUTH_WIDE } from '../face-library/builtin/mouth-wide.js';
import { NOSE_DOT } from '../face-library/builtin/nose-dot.js';
import { validateRig } from '../validation/rig-validator.js';
import { isHeadPoseKeyform } from '../head-pose/head-pose-model.js';
import { PROJECT_DOMAINS } from '../state/project-document.js';

/**
 * Putting a library asset onto the template face (docs/FACE_PART_LIBRARY.md,
 * "Installing"; roadmap phase 4).
 *
 * The rule under test: **changing a mouth never takes `smile` away.** The
 * plan says what goes and refuses a part drawn around other parts; the
 * application keeps every movement the new drawing can carry on a fresh
 * driver, keeps a parameter an expression still names, takes every
 * reference to the old shapes with them, and leaves a rig the validator has
 * nothing to say about.
 */
const asset = (definition) => normalizeFacePart(definition);
const part = (document, type) => Object.values(document.semanticParts).find((item) => item.type === type);
const layerChildren = (document, id) => { const find = (items) => { for (const item of items) { if (item.id === id) return item.children.map((child) => child.id); const found = find(item.children || []); if (found) return found; } return null; }; return find(document.layers); };
const headPoseTargets = (document) => new Set(document.keyforms.filter(isHeadPoseKeyform).map((keyform) => keyform.target.id));

/** The template, a store over it, and a canvas that measures every shape from the assets' own boxes. */
function fixture(state = createTemplateProjectState()) {
  const store = createEditorStore(state);
  // The face's own boxes; an asset's pieces are measured from its reference box once it is in.
  const boxes = templateBoxes(), assets = {};
  const canvas = createFakeFaceCanvas(store, { boxes, installed: (id) => assets[id] || null });
  return { store, canvas, boxes, assets };
}

/** The pure halves around the fake canvas, the way the command holds them. */
function install(fixtureOf, categoryId, definition, { fit = null } = {}) {
  const { store, canvas } = fixtureOf;
  const before = store.getDocument();
  const plan = planFacePartReplacement(before, categoryId, asset(definition));
  assert.equal(plan.ok, true, plan.reason);
  const remapped = remapArtworkIds(definition.artwork, { taken: (id) => !plan.removeIds.includes(id) && Object.hasOwn(before.elements, id) });
  Object.assign(fixtureOf.assets, boxesFromReferenceBox(definition, artworkIds(definition.artwork), remapped.renamed));
  const artwork = canvas.replaceArtwork(plan.removeIds, remapped.markup, { mountPoint: plan.mountPoint, before: plan.before });
  const candidate = structuredClone(before);
  const summary = applyFacePartReplacement(candidate, plan, { asset: asset(definition), artwork, renamed: remapped.renamed, ids: artworkIds(remapped.markup), measure: (id) => canvas.measureElement(id), fit });
  store.execute({ type: 'test/install', domains: [...FACE_PART_DOMAINS], source: 'test', apply: (document) => { for (const field of FACE_PART_FIELDS) document[field] = structuredClone(candidate[field]); } });
  return { plan, summary, document: store.getDocument() };
}

test('the plan names what goes, where the new drawing lands, and what the author had moved', () => {
  const state = createTemplateProjectState();
  state.elements.mouth.baseTransform = { ...state.elements.mouth.baseTransform, x: 4, y: -2, rotation: 5, scaleX: 1.2, scaleY: 1.2 };
  const plan = planFacePartReplacement(state, 'mouth', asset(MOUTH_SIMPLE));
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.removeIds, ['mouth', 'teeth', 'tongue'], 'every role of the part, and nothing drawn inside them because nothing is');
  assert.equal(plan.partId, 'mouth');
  assert.equal(plan.mountPoint, 'faceRoot', 'the group the old mouth sat in');
  assert.equal(plan.before, 'eyeLeft', 'painted behind the sibling that followed the old part');
  assert.equal(plan.previousRoot, 'mouth');
  assert.deepEqual(plan.previousTransform, { x: 4, y: -2, rotation: 5, scaleX: 1.2, scaleY: 1.2 });
  assert.equal(plan.category.id, 'mouth');
  assert.deepEqual([...plan.definition.controls], ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue']);

  const nose = planFacePartReplacement(state, 'nose', asset(NOSE_DOT));
  assert.deepEqual([nose.removeIds, nose.mountPoint, nose.before, nose.previousTransform.x], [['nose'], 'faceRoot', 'hairTop', 0]);

  // A category with no part yet gets one: nothing goes, the fragment lands in the face group at the end.
  const accessory = planFacePartReplacement(state, 'accessory', asset({ id: 'accessory.hat', category: 'accessory', name: 'Hat', artwork: '<g id="hat"><rect id="brim"/></g>', roles: { element: 'brim' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } }));
  assert.equal(accessory.ok, true);
  assert.deepEqual([accessory.partId, accessory.removeIds, accessory.mountPoint, accessory.before, accessory.previousRoot, accessory.previousTransform], [null, [], 'faceRoot', null, null, null]);
});

test('a part drawn around other parts is refused, and says which', () => {
  const state = createTemplateProjectState();
  const head = planFacePartReplacement(state, 'head', asset({ id: 'head.round', category: 'head', name: 'Round', artwork: '<g id="head-round"><path id="skull"/></g>', roles: { head: 'skull' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } }));
  assert.equal(head.ok, false);
  assert.match(head.reason, /^Head is drawn around other parts \(Eyes \(leftEye\), .*Mouth \(mouth\).*\): replacing it would take them away too\.$/);
  const eyes = planFacePartReplacement(state, 'eyes', asset({ id: 'eyes.dots', category: 'eyes', name: 'Dots', artwork: '<g id="eyes-dots"><circle id="l"/><circle id="r"/></g>', roles: { leftEye: 'l', rightEye: 'r' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } }));
  assert.match(eyes.reason, /^Eyes is drawn around other parts \(Pupils \/ Gaze \(leftPupil\), Pupils \/ Gaze \(rightPupil\), Eyelids/);
  // A hand drawn inside a part counts the same way.
  const around = createTemplateProjectState();
  around.hands.left.element = 'mouth';
  assert.match(planFacePartReplacement(around, 'mouth', asset(MOUTH_SIMPLE)).reason, /the left hand/);
});

test('the plan refuses what cannot be planned, in words', () => {
  const state = createTemplateProjectState();
  assert.equal(planFacePartReplacement(state, 'nope', asset(MOUTH_SIMPLE)).reason, 'Unknown category "nope".');
  assert.equal(planFacePartReplacement(state, 'facialHair', asset(MOUTH_SIMPLE)).reason, 'Facial Hair has no semantic part yet, so nothing can be installed there.');
  assert.equal(planFacePartReplacement(state, 'nose', asset(MOUTH_SIMPLE)).reason, '"mouth.simple" is not a nose asset.');
  assert.equal(planFacePartReplacement(state, 'nose', null).reason, '"?" is not a nose asset.');
  assert.equal(planFacePartReplacement({}, 'mouth', asset(MOUTH_SIMPLE)).reason, 'Start from a face, or import artwork, before choosing a part.');
  assert.throws(() => applyFacePartReplacement({}, planFacePartReplacement({}, 'mouth', asset(MOUTH_SIMPLE)), {}), /Start from a face/);
});

test('scrubbing takes every reference to the old shapes with them', () => {
  const state = createTemplateProjectState();
  state.elements.nose.symmetryPeer = 'mouth';
  state.rigAttachments = [{ id: 'lip-point', target: 'mouth', point: { x: 0, y: 0 }, space: 'world' }, { id: 'chin-point', target: 'head', point: { x: 0, y: 0 }, space: 'world' }];
  state.rigHolds = [{ id: 'hold-lip', hold: 'chin-point', to: 'lip-point' }, { id: 'hold-chin', hold: 'chin-point', to: 'chin-point' }];
  state.rigHandles = [{ id: 'mouth-handle', authored: true, elements: ['mouth', 'teeth'] }, { id: 'face-handle', authored: true, elements: ['mouth', 'nose'] }, { id: 'generated', elements: ['mouth'] }];
  state.followers = [{ element: 'tongue' }, { element: 'nose' }];
  state.warps = [{ id: 'mouth-warp', target: 'mouth', grid: { columns: 2, rows: 2, points: [] } }];
  const mouthPins = state.rigPins.filter((pin) => pin.target === 'mouth').length, browPins = state.rigPins.length - mouthPins;
  const cleared = scrubRemovedArtwork(state, ['mouth', 'teeth', 'tongue']);
  assert.deepEqual(cleared, [{ partId: 'mouth', role: 'mouth' }, { partId: 'mouth', role: 'teeth' }, { partId: 'mouth', role: 'tongue' }, { partId: 'tongue', role: 'tongue' }], 'the tongue part shared the tongue');
  assert.deepEqual(part(state, 'mouth').roles, {});
  assert.deepEqual(part(state, 'tongue').roles, {});
  assert.equal('mouth' in state.elements, false);
  assert.equal(state.elements.nose.symmetryPeer, null);
  assert.deepEqual(state.shapeKeys.map((key) => key.id), ['head-jaw'], 'only the jaw\'s key, on the head, stays');
  assert.equal(state.keyforms.some((keyform) => ['mouth', 'teeth', 'tongue'].includes(keyform.target?.id)), false);
  assert.equal(state.rigPins.length, browPins, 'the brows keep their pins');
  assert.deepEqual(state.warps, []);
  assert.deepEqual(state.rigAttachments.map((item) => item.id), ['chin-point']);
  assert.deepEqual(state.rigHolds.map((item) => item.id), ['hold-chin'], 'a hold on a point that is gone is gone');
  assert.deepEqual(state.rigHandles, [{ id: 'face-handle', authored: true, elements: ['nose'] }, { id: 'generated', elements: [] }], 'an authored handle with nothing left goes; a generated one is regenerated anyway');
  assert.deepEqual(state.followers.map((item) => item.element), ['nose']);
  assert.ok(state.params.mouthOpen && state.params.smile, 'scrubbing artwork touches no parameter');
});

test('a simple mouth over the template: the movements stay, on drivers the new drawing can carry', () => {
  const fx = fixture();
  const original = structuredClone(fx.store.getDocument());
  fx.store.execute({ type: 'test/move', domains: ['artwork'], source: 'test', apply: (document) => { document.elements.mouth.baseTransform.x = 5; document.elements.mouth.baseTransform.rotation = 3; } });
  const { summary, document } = install(fx, 'mouth', MOUTH_SIMPLE);
  assert.deepEqual(summary, { partId: 'mouth', rootId: 'mouth-simple', ids: ['mouth-simple', 'mouth'], roles: { mouth: 'mouth' }, enabled: ['mouthOpen', 'smile', 'mouthWidth'], disabled: ['teeth', 'tongue'], pinned: true, turned: true, fitted: false, removed: ['mouth', 'teeth', 'tongue'] });
  assert.equal(fx.canvas.calls.replace.length, 1);
  assert.deepEqual(fx.canvas.calls.replace[0], { removeIds: ['mouth', 'teeth', 'tongue'], fragment: MOUTH_SIMPLE.artwork, mountPoint: 'faceRoot', before: 'eyeLeft' });

  // The drawing: the fragment where the mouth was, the old three gone.
  assert.deepEqual(layerChildren(document, 'faceRoot'), ['hairBack', 'earLeft', 'earRight', 'head', 'faceShading', 'mouth-simple', 'eyeLeft', 'eyeRight', 'eyebrows', 'nose', 'hairTop', 'hairFront']);
  assert.deepEqual(layerChildren(document, 'mouth-simple'), ['mouth']);
  assert.equal('tongue' in document.elements, false);
  assert.equal('teeth' in document.elements, false);
  assert.match(document.svgMarkup, /<g id="mouth-simple" data-name="Mouth">/);
  assert.equal(document.svgMarkup.includes('id="tongue"'), false);

  // The part: the same part, its roles on the new shapes, and its asset recorded.
  const mouth = part(document, 'mouth');
  assert.deepEqual(mouth.roles, { mouth: 'mouth' });
  assert.deepEqual(mouth.controls, ['mouthOpen', 'smile', 'mouthWidth']);
  assert.deepEqual(mouth.controlDrivers, {
    mouthOpen: { method: 'transform', property: 'scaleY', roles: ['mouth'] },
    smile: { method: 'transform', property: 'translateY', roles: ['mouth'] },
    mouthWidth: { method: 'transform', property: 'scaleX', roles: ['mouth'] }
  }, 'the shape keys deformed a shape that is gone; the registry\'s transform strategies move the new one');
  assert.deepEqual(mouth.calibration, {});
  assert.deepEqual([mouth.assetId, mouth.assetRoot], ['mouth.simple', 'mouth-simple']);
  assert.deepEqual(Object.keys(document.elements.mouth.bindings).sort(), ['scaleX', 'scaleY', 'translateY']);
  assert.equal(document.elements.mouth.bindings.translateY.expression, 'smile');
  assert.deepEqual(document.elements.mouth.bindings.translateY.generatedBy, { semanticPart: 'mouth', control: 'smile' });
  assert.equal(document.elements.mouth.restPath, undefined, 'a fresh record: nothing of the old mouth\'s shape keys rides along');

  // What was moved stays moved, on the root; every new piece pivots about its middle.
  assert.deepEqual(document.elements['mouth-simple'].baseTransform, { x: 5, y: 0, rotation: 3, scaleX: 1, scaleY: 1, pivotX: 120, pivotY: 176.5 });
  assert.deepEqual([document.elements.mouth.baseTransform.pivotX, document.elements.mouth.baseTransform.pivotY], [120, 176.5]);

  // The parameters: nothing the face meant is lost. `teeth` and `tongue`
  // have nothing to move, and the expressions that name them keep naming them.
  for (const name of ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue', 'tongueX', 'smileLeft', 'mouthLock']) assert.ok(document.params[name], `${name} is still a parameter`);
  assert.deepEqual(document.params.tongue, original.params.tongue);
  for (const [name, pose] of Object.entries(document.states)) assert.deepEqual([pose.teeth, pose.tongue], [original.states[name].teeth, original.states[name].tongue], `${name} keeps its teeth and tongue values`);
  assert.deepEqual(document.expressions.map((item) => item.id), original.expressions.map((item) => item.id));
  assert.deepEqual(document.expressions.find((item) => item.id === 'cheeky').controls.tongue, original.expressions.find((item) => item.id === 'cheeky').controls.tongue);
  assert.deepEqual(document.animationClips.map((clip) => clip.id), original.animationClips.map((clip) => clip.id));
  assert.deepEqual(part(document, 'tongue').roles, {}, 'the tongue part has nothing to play until a mouth draws one');
  assert.deepEqual(part(document, 'tongue').controls, ['tongueX', 'tongueY', 'tongueOut', 'tongueCurl'], 'and keeps its movements for when one does');

  // The geometry measured for the old artwork, measured again.
  assert.deepEqual(document.shapeKeys.map((key) => key.id), ['head-jaw']);
  const pins = document.rigPins.filter((pin) => pin.target === 'mouth').map((pin) => pin.id);
  assert.deepEqual(pins, ['mouth-corner-left', 'mouth-corner-right', 'mouth-lower-lip'], 'the corners and the lip are pinned on the new mouth');
  assert.ok(document.rigPins.some((pin) => pin.target === 'browLeft'), 'the brows keep theirs');
  const targets = headPoseTargets(document);
  assert.equal(targets.has('mouth'), true, 'the new mouth turns with the head');
  for (const id of ['teeth', 'tongue', 'mouth-simple']) assert.equal(targets.has(id), false, `${id} has no pose`);
  assert.equal(document.keyforms.filter(isHeadPoseKeyform).length, original.keyforms.filter(isHeadPoseKeyform).length - 21 + 7, 'three old shapes\' poses gone, one new shape\'s poses made');
  assert.equal(document.keyforms.filter((keyform) => isHeadPoseKeyform(keyform) && keyform.target.id === 'eyeLeft').length, original.keyforms.filter((keyform) => isHeadPoseKeyform(keyform) && keyform.target.id === 'eyeLeft').length, 'the eyes\' poses are exactly as they were');
  assert.deepEqual(validateRig(document), []);
});

test('a fit lands the root where this face is, and the author\'s adjustments ride on top of it', () => {
  const fx = fixture();
  fx.store.execute({ type: 'test/move', domains: ['artwork'], source: 'test', apply: (document) => { document.elements.nose.baseTransform.x = 4; document.elements.nose.baseTransform.scaleX = 1.5; document.elements.nose.baseTransform.scaleY = 1.5; } });
  const fit = { x: -30, y: -37.5, rotation: 0, scaleX: 0.5, scaleY: 0.5, pivotX: 120, pivotY: 148, mountPoint: 'nose.center', anchor: { x: 90, y: 110.5, measured: false } };
  const { summary, document } = install(fx, 'nose', NOSE_DOT, { fit });
  assert.equal(summary.fitted, true);
  assert.deepEqual(document.elements['nose-dot'].baseTransform, { x: -30, y: -37.5, rotation: 0, scaleX: 0.75, scaleY: 0.75, pivotX: 120, pivotY: 148 }, 'the fit\'s place, at the size the author had given the old nose');
  assert.deepEqual(part(document, 'nose').assetFit, { scaleX: 0.5, scaleY: 0.5 }, 'the size the fit gave it, for the next replacement to tell the author\'s size from');
  const plan = planFacePartReplacement(document, 'nose', asset(NOSE_DOT));
  assert.deepEqual([plan.previousFitted, plan.previousTransform.scaleX, plan.previousTransform.scaleY, plan.previousTransform.x], [true, 1.5, 1.5, -30], 'which it does');
  assert.deepEqual([document.elements.nose.baseTransform.pivotX, document.elements.nose.baseTransform.pivotY], [120, 148], 'the piece inside pivots about its own middle, unmoved');
  assert.deepEqual(validateRig(document), []);
});

test('a wide mouth after the simple one: the teeth come back as a drawn movement, the tongue part waits', () => {
  const fx = fixture();
  install(fx, 'mouth', MOUTH_SIMPLE);
  const { plan, summary, document } = install(fx, 'mouth', MOUTH_WIDE);
  assert.deepEqual(plan.removeIds, ['mouth-simple', 'mouth'], 'the asset root the last install left, with what it drew');
  assert.deepEqual([plan.mountPoint, plan.before], ['faceRoot', 'eyeLeft']);
  assert.deepEqual(summary.enabled, ['mouthOpen', 'smile', 'mouthWidth'], 'the movements the part had');
  assert.deepEqual(summary.disabled, [], 'teeth was already off, so nothing is switched off');
  const mouth = part(document, 'mouth');
  assert.deepEqual(mouth.roles, { mouth: 'mouth', teeth: 'teeth' });
  assert.deepEqual(mouth.controls, ['mouthOpen', 'smile', 'mouthWidth'], 'a movement switched off by the last replacement stays off: switching it on is Face Setup\'s');
  assert.deepEqual(layerChildren(document, 'mouth-wide'), ['mouth', 'teeth']);
  assert.equal(Object.keys(document.elements).filter((id) => /^mouth/.test(id)).join(','), 'mouth-wide,mouth');
  assert.deepEqual(validateRig(document), []);
});

test('a wide mouth straight over the template: the teeth show by opacity, on the piece the asset draws', () => {
  const fx = fixture();
  const { summary, document } = install(fx, 'mouth', MOUTH_WIDE);
  assert.deepEqual(summary.enabled, ['mouthOpen', 'smile', 'mouthWidth', 'teeth']);
  assert.deepEqual(summary.disabled, ['tongue']);
  const mouth = part(document, 'mouth');
  assert.deepEqual(mouth.controlDrivers.teeth, { method: 'transform', property: 'opacity', roles: ['teeth'] });
  assert.deepEqual(document.elements.teeth.bindings, { opacity: { enabled: true, mode: 'simple', expression: 'teeth', curve: 'linear', amplitude: 1, offset: 0, generatedBy: { semanticPart: 'mouth', control: 'teeth' } } }, 'hidden at 0, drawn at 1, nothing to capture');
  assert.deepEqual(document.elements['mouth-wide'].baseTransform, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 120, pivotY: 179 });
  assert.deepEqual(validateRig(document), []);
});

test('a parameter nothing else names goes with its movement', () => {
  const state = createTemplateProjectState();
  for (const expression of state.expressions) delete expression.controls.tongue;
  for (const clip of state.animationClips) delete clip.tracks.tongue;
  const { document } = install(fixture(state), 'mouth', MOUTH_SIMPLE);
  assert.equal('tongue' in document.params, false, 'the tongue movement is off and nobody asks for it');
  assert.ok(document.params.teeth, 'the teeth are still named by an expression, so the parameter stays');
  assert.equal('tongue' in document.states.idle, false);
  assert.deepEqual(validateRig(document), []);
});

test('a nose, and a category with no part yet', () => {
  const fx = fixture();
  const { summary, document } = install(fx, 'nose', NOSE_DOT);
  assert.deepEqual([summary.rootId, summary.enabled, summary.disabled, summary.pinned, summary.turned], ['nose-dot', ['noseScrunch'], [], false, true]);
  assert.deepEqual(part(document, 'nose').roles, { nose: 'nose' });
  assert.equal(document.elements.nose.meta.nodeType, 'circle');
  const children = layerChildren(document, 'faceRoot');
  assert.deepEqual(children.slice(children.indexOf('eyebrows')), ['eyebrows', 'nose-dot', 'hairTop', 'hairFront'], 'where the nose was');
  assert.deepEqual(validateRig(document), []);

  const hat = { id: 'accessory.hat', category: 'accessory', name: 'Hat', artwork: '<g id="hat" data-name="Hat"><rect id="brim" data-name="Brim" x="40" y="10" width="160" height="20" fill="#333"/></g>', roles: { element: 'brim' }, referenceBox: { x: 40, y: 10, width: 160, height: 20 } };
  const accessory = install(fx, 'accessory', hat);
  assert.deepEqual([accessory.summary.partId, accessory.summary.rootId, accessory.summary.roles], ['accessory', 'hat', { element: 'brim' }]);
  const created = part(accessory.document, 'accessory');
  assert.deepEqual([created.roles, created.controls, created.assetId, created.assetRoot], [{ element: 'brim' }, [], 'accessory.hat', 'hat']);
  assert.equal(layerChildren(accessory.document, 'faceRoot').at(-1), 'hat', 'in the face group, on top');
  assert.deepEqual(validateRig(accessory.document), []);
});

test('the application refuses a canvas that drew nothing for a role', () => {
  const fx = fixture();
  const before = fx.store.getDocument();
  const plan = planFacePartReplacement(before, 'mouth', asset(MOUTH_SIMPLE));
  const artwork = fx.canvas.replaceArtwork(plan.removeIds, MOUTH_SIMPLE.artwork, { mountPoint: plan.mountPoint, before: plan.before });
  const missing = { ...artwork, elements: Object.fromEntries(Object.entries(artwork.elements).filter(([id]) => id !== 'mouth')) };
  assert.throws(() => applyFacePartReplacement(structuredClone(before), plan, { asset: asset(MOUTH_SIMPLE), artwork: missing, ids: ['mouth-simple', 'mouth'] }), /names "mouth" for its mouth, and the canvas did not draw it/);
  const nothing = { ...artwork, elements: Object.fromEntries(Object.entries(artwork.elements).filter(([id]) => !['mouth', 'mouth-simple'].includes(id))) };
  assert.throws(() => applyFacePartReplacement(structuredClone(before), plan, { asset: asset(MOUTH_SIMPLE), artwork: nothing, ids: ['mouth-simple', 'mouth'] }), /drew nothing/);
});

test('what a replacement writes is covered by the domains it notifies', () => {
  const covered = new Set(FACE_PART_DOMAINS.flatMap((domain) => PROJECT_DOMAINS[domain]));
  for (const field of FACE_PART_FIELDS) assert.ok(covered.has(field), `${field} notifies`);
});
