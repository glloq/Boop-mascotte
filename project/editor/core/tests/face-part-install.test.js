import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { FACE_PART_DOMAINS, FACE_PART_FIELDS, applyFacePartRemoval, applyFacePartReplacement, planFacePartRemoval, planFacePartReplacement, scrubRemovedArtwork } from '../face-library/face-part-install.js';
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
  const behind = plan.behind ? { ids: plan.behind.ids.map((id) => remapped.renamed[id] ?? id), before: plan.behind.before } : null;
  const artwork = canvas.replaceArtwork(plan.removeIds, remapped.markup, { mountPoint: plan.mountPoint, before: plan.before, behind });
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

test('a part drawn around other parts is refused, and says which; the skull is what a head asset replaces', () => {
  const state = createTemplateProjectState();
  // The template's head is the whole face, so a head asset goes on its skull: the shape the jaw moves, inside the group that keeps turning.
  const head = planFacePartReplacement(state, 'head', asset({ id: 'head.round', category: 'head', name: 'Round', artwork: '<g id="head-round"><path id="skull"/></g>', roles: { head: 'skull' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } }));
  assert.equal(head.ok, true, head.reason);
  assert.deepEqual([head.skull, head.removeIds, head.mountPoint, head.before, head.previousRoot, head.partId], [true, ['head'], 'faceRoot', 'faceShading', 'head', 'head']);
  // A face whose head is a group with no jaw shape inside it has no skull to replace.
  const jawless = createTemplateProjectState();
  delete jawless.semanticParts.jaw;
  assert.match(planFacePartReplacement(jawless, 'head', asset({ id: 'head.round', category: 'head', name: 'Round', artwork: '<g id="head-round"><path id="skull"/></g>', roles: { head: 'skull' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } })).reason, /no skull of its own to replace/);
  const eyes = planFacePartReplacement(state, 'eyes', asset({ id: 'eyes.dots', category: 'eyes', name: 'Dots', artwork: '<g id="eyes-dots"><circle id="l"/><circle id="r"/></g>', roles: { leftEye: 'l', rightEye: 'r' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } }));
  assert.match(eyes.reason, /^Eyes is drawn around other parts \(Pupils \/ Gaze \(leftPupil\), Pupils \/ Gaze \(rightPupil\), Eyelids/);
  // Unless the asset draws those parts itself.
  const drawn = planFacePartReplacement(state, 'eyes', asset({ id: 'eyes.dots', category: 'eyes', name: 'Dots', artwork: '<g id="eyes-dots"><g id="l"><circle id="pl"/><path id="ul"/><path id="ll"/></g><g id="r"><circle id="pr"/><path id="ur"/><path id="lr"/></g></g>', roles: { leftEye: 'l', rightEye: 'r' }, parts: { gaze: { roles: { leftPupil: 'pl', rightPupil: 'pr' } }, eyelids: { roles: { leftUpper: 'ul', leftLower: 'll', rightUpper: 'ur', rightLower: 'lr' } } }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } }));
  assert.equal(drawn.ok, true, drawn.reason);
  assert.deepEqual(drawn.removeIds.slice(0, 2), ['eyeLeft', 'eyeWhiteLeft']);
  assert.ok(drawn.removeIds.includes('lidLowerRight'));
  // A hand drawn inside a part counts the same way.
  const around = createTemplateProjectState();
  around.hands.left.element = 'mouth';
  assert.match(planFacePartReplacement(around, 'mouth', asset(MOUTH_SIMPLE)).reason, /the left hand/);
});

test('the plan refuses what cannot be planned, in words', () => {
  const state = createTemplateProjectState();
  assert.equal(planFacePartReplacement(state, 'nope', asset(MOUTH_SIMPLE)).reason, 'Unknown category "nope".');
  assert.equal(planFacePartReplacement(state, 'facialHair', asset(MOUTH_SIMPLE)).reason, '"mouth.simple" is not a facial hair asset.');
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
  assert.deepEqual(summary, { partId: 'mouth', rootId: 'mouth-simple', ids: ['mouth-simple', 'mouth'], roles: { mouth: 'mouth' }, parts: {}, detached: [], enabled: ['mouthOpen', 'smile', 'mouthWidth'], disabled: ['teeth', 'tongue'], pinned: true, turned: true, fitted: false, skull: false, rehomed: [], hosted: null, removed: ['mouth', 'teeth', 'tongue'] });
  assert.equal(fx.canvas.calls.replace.length, 1);
  assert.deepEqual(fx.canvas.calls.replace[0], { removeIds: ['mouth', 'teeth', 'tongue'], fragment: MOUTH_SIMPLE.artwork, mountPoint: 'faceRoot', before: 'eyeLeft', behind: null, rehome: [] });

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
  assert.deepEqual(part(document, 'nose').assetFit, { x: -30, y: -37.5, scaleX: 0.5, scaleY: 0.5 }, 'the place and size the fit gave it, for the next replacement to tell the author\'s move and size from');
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

test('every lid rests where it is drawn: its own amplitude, its own offset, hinted or not', async () => {
  const { EYES_ROUND_LARGE } = await import('../face-library/builtin/eyes.js');
  const lids = (definition) => {
    const document = install(fixture(), 'eyes', definition).document;
    return Object.fromEntries(['lidUpperLeft', 'lidLowerLeft'].map((id) => {
      const binding = document.elements[id].bindings.translateY;
      // `eyeOpen` rests at 1, so `atRest` is where the lid sits with the eye
      // open; `shut` is where it goes at 0, and for an upper lid that has to be
      // *downwards* -- a lid that retracts as the eye closes is a blink played
      // backwards, which is what the registry's generic `+8` used to give.
      return [id, { amplitude: binding.amplitude, atRest: binding.amplitude * 1 + binding.offset, shut: binding.offset }];
    }));
  };
  const eyelids = (over) => ({ ...EYES_ROUND_LARGE, id: 'eyes.test', parts: { ...EYES_ROUND_LARGE.parts, eyelids: { ...EYES_ROUND_LARGE.parts.eyelids, ...over } } });

  // A side that travels its own distance and leaves the offset out: the rest
  // offset is the one *that* amplitude needs, not the one the shared amplitude
  // needed, or the lower lid sits 78px down the face with the eye wide open.
  assert.deepEqual(lids(eyelids({ drivers: { eyeOpen: { property: 'translateY', amplitude: -38, roles: { leftLower: { amplitude: 40 }, rightLower: { amplitude: 40 } } } } })),
    { lidUpperLeft: { amplitude: -38, atRest: 0, shut: 38 }, lidLowerLeft: { amplitude: 40, atRest: 0, shut: -40 } });

  // And a part that claims the movement without saying how it carries it: the
  // registry's own driver has to rest as drawn *and* shut the right way. A lid
  // is the one control that rests at its maximum, so its amplitude is negative.
  const { drivers, ...hintless } = EYES_ROUND_LARGE.parts.eyelids;
  assert.deepEqual(lids({ ...EYES_ROUND_LARGE, id: 'eyes.test2', parts: { ...EYES_ROUND_LARGE.parts, eyelids: hintless } }),
    { lidUpperLeft: { amplitude: -8, atRest: 0, shut: 8 }, lidLowerLeft: { amplitude: -8, atRest: 0, shut: 8 } });

  // A hint that gives both keeps both, untouched: the built-in eyes are drawn open.
  assert.deepEqual(lids(EYES_ROUND_LARGE), { lidUpperLeft: { amplitude: -38.5, atRest: 0, shut: 38.5 }, lidLowerLeft: { amplitude: 36.5, atRest: 0, shut: -36.5 } });
});

test('what a replacement writes is covered by the domains it notifies', () => {
  const covered = new Set(FACE_PART_DOMAINS.flatMap((domain) => PROJECT_DOMAINS[domain]));
  for (const field of FACE_PART_FIELDS) assert.ok(covered.has(field), `${field} notifies`);
});

test('a pair of eyes is three parts: the eyes, the pupils and the lids take their roles on the new shapes, movements kept', async () => {
  const { EYES_ROUND_LARGE } = await import('../face-library/builtin/eyes.js');
  const fx = fixture();
  const original = structuredClone(fx.store.getDocument());
  const { plan, summary, document } = install(fx, 'eyes', EYES_ROUND_LARGE);
  assert.equal(plan.skull, false);
  assert.ok(plan.removeIds.includes('eyeLeft') && plan.removeIds.includes('pupilRight') && plan.removeIds.includes('lidLowerLeft'), 'the eye groups go, pupils and lids inside them');
  assert.deepEqual([summary.rootId, summary.roles], ['eyes-round-large', { leftEye: 'eyeLeft', rightEye: 'eyeRight' }]);
  assert.deepEqual(summary.parts, { gaze: { partId: 'gaze', roles: { leftPupil: 'pupilLeft', rightPupil: 'pupilRight' } }, eyelids: { partId: 'eyelids', roles: { leftUpper: 'lidUpperLeft', leftLower: 'lidLowerLeft', rightUpper: 'lidUpperRight', rightLower: 'lidLowerRight' } } });
  assert.deepEqual(summary.enabled, ['eyeOpen', 'lookX', 'lookY', 'pupilScale', 'eyeOpen'], 'the eyes\' own, then the pupils\', then the lids\'');
  assert.deepEqual(summary.disabled, []);
  // The eyes: the same part, on the new groups, a gentle squash as the lids do the closing.
  const eyes = part(document, 'eyes');
  assert.deepEqual([eyes.roles, eyes.controls, eyes.assetId, eyes.assetRoot], [{ leftEye: 'eyeLeft', rightEye: 'eyeRight' }, ['eyeOpen'], 'eyes.round-large', 'eyes-round-large']);
  assert.deepEqual(document.elements.eyeLeft.bindings.scaleY, { enabled: true, mode: 'simple', expression: 'eyeOpen + eyeOpenLeft', curve: 'linear', amplitude: 0.12, offset: 0.88, generatedBy: { semanticPart: 'eyes', control: 'eyeOpen' } }, 'a side of its own, as before');
  // The pupils: the gaze part on the new pupils, looking with both axes and scaling on both.
  const gaze = part(document, 'gaze');
  assert.deepEqual([gaze.roles, gaze.controls], [{ leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }, ['lookX', 'lookY', 'pupilScale']]);
  assert.equal(document.elements.pupilLeft.bindings.translateX.expression, 'lookX + lookXLeft');
  assert.equal(document.elements.pupilRight.bindings.translateY.expression, 'lookY + lookYRight');
  assert.deepEqual([document.elements.pupilLeft.bindings.scaleX?.expression, document.elements.pupilLeft.bindings.scaleY?.expression], ['pupilScale + pupilScaleLeft', 'pupilScale + pupilScaleLeft'], 'a pupil scales on both axes');
  assert.equal(gaze.assetId, undefined, 'the eyes are the asset; the pupils are drawn by it');
  // The lids: drawn open, the upper coming down and the lower coming up as the eye shuts, each side its own.
  const lids = part(document, 'eyelids');
  assert.deepEqual(lids.roles, { leftUpper: 'lidUpperLeft', leftLower: 'lidLowerLeft', rightUpper: 'lidUpperRight', rightLower: 'lidLowerRight' });
  const upper = document.elements.lidUpperRight.bindings.translateY, lower = document.elements.lidLowerRight.bindings.translateY;
  assert.deepEqual([upper.expression, upper.amplitude, upper.offset], ['eyeOpen + eyeOpenRight', -38.5, 38.5]);
  assert.deepEqual([lower.expression, lower.amplitude, lower.offset], ['eyeOpen + eyeOpenRight', 36.5, -36.5], 'the lower lid closes upwards');
  assert.equal(lids.controlDrivers.eyeOpen.property, 'translateY');
  // The parameters the face had, sides included, are all still there; the old eyes' poses are gone, the new ones turn.
  for (const name of ['eyeOpen', 'eyeOpenLeft', 'eyeOpenRight', 'lookX', 'lookXLeft', 'pupilScale', 'pupilScaleRight']) assert.ok(document.params[name], `${name} is still a parameter`);
  assert.deepEqual(document.expressions.find((item) => item.id === 'wink')?.controls ?? original.animationClips.find((clip) => clip.id === 'wink').tracks.eyeOpenLeft, original.animationClips.find((clip) => clip.id === 'wink').tracks.eyeOpenLeft);
  const targets = headPoseTargets(document);
  assert.ok(targets.has('eyeLeft') && targets.has('pupilLeft'), 'the new eyes and pupils turn with the head');
  assert.ok(!document.keyforms.some((keyform) => keyform.target?.id === 'glintLeft' && !isHeadPoseKeyform(keyform)));
  assert.match(document.svgMarkup, /<clipPath id="socketLeft">/, 'the sockets come with the drawing');
  assert.match(document.svgMarkup, /<g id="eyeLeft" data-name="Left eye" clip-path="url\(#socketLeft\)">/);
  assert.deepEqual(validateRig(document), []);
});

test('a head asset on the template goes on the skull: the face keeps turning, the jaw takes the new shape', async () => {
  const { HEAD_ROUND } = await import('../face-library/builtin/heads.js');
  const fx = fixture();
  const original = structuredClone(fx.store.getDocument());
  const { plan, summary, document } = install(fx, 'head', HEAD_ROUND);
  assert.equal(plan.skull, true);
  assert.deepEqual([summary.skull, summary.rootId, summary.roles, summary.removed], [true, 'head-round', { head: 'skull' }, ['head']]);
  assert.deepEqual(summary.enabled, ['jawOpen'], 'the jaw takes the skull, and the pose the skull ships');
  assert.deepEqual(summary.disabled, []);
  assert.deepEqual(summary.parts, { jaw: { partId: 'jaw', roles: { jaw: 'skull' } } });
  const key = document.shapeKeys.find((item) => item.target === 'skull');
  assert.ok(key, 'a shape key on the skull');
  assert.deepEqual([key.id, key.generatedBy, key.driver.expression], ['skull-jaw', { semanticPart: 'jaw', control: 'jawOpen' }, 'mouthOpen + jawOpen']);
  assert.equal(document.elements.skull.restPath, HEAD_ROUND.artwork.match(/\sd="([^"]*)"/)[1], 'the rest shape is what the skull is drawn with');
  assert.equal(document.shapeKeys.some((item) => item.target === 'head'), false, 'the template\'s own jaw key went with its skull');
  const head = part(document, 'head');
  assert.deepEqual([head.roles, head.controls, head.assetId, head.assetRoot], [{ head: 'faceRoot' }, ['headX', 'headY', 'headTilt'], 'head.round', 'head-round'], 'the head that turns is still the whole face');
  assert.deepEqual(document.elements.faceRoot.bindings, original.elements.faceRoot.bindings, 'and turns as it did');
  assert.deepEqual(part(document, 'jaw').roles, { jaw: 'skull' });
  assert.deepEqual(part(document, 'jaw').controls, ['jawOpen']);
  assert.deepEqual(part(document, 'jaw').controlDrivers.jawOpen.method, 'shapeKey');
  assert.ok(document.params.jawOpen, 'the jaw parameter stays: the expressions name it');
  assert.equal('head' in document.elements, false);
  assert.deepEqual(layerChildren(document, 'faceRoot').slice(3, 5), ['head-round', 'faceShading'], 'where the skull was, behind the shading');
  assert.equal(document.shapeKeys.some((key) => key.id === 'head-jaw'), false, 'the skull\'s own jaw shape went with it');
  assert.ok(part(document, 'eyes').roles.leftEye === 'eyeLeft' && part(document, 'mouth').roles.mouth === 'mouth', 'every other part is where it was');
  assert.deepEqual(validateRig(document), []);
  // And again: the root the first install left is what goes.
  const again = install(fx, 'head', HEAD_ROUND);
  assert.deepEqual([again.plan.skull, again.plan.removeIds], [true, ['head-round', 'skull']], 'the skull rule holds: the face is still the head that turns');
  assert.deepEqual(part(again.document, 'jaw').roles, { jaw: 'skull' }, 'the jaw follows the skull again');
  assert.deepEqual(part(again.document, 'head').roles, { head: 'faceRoot' });
  assert.deepEqual(validateRig(again.document), []);
});

test('on a face whose head is a shape, a head asset is the head, and its movements move the new skull', async () => {
  const { HEAD_OVAL } = await import('../face-library/builtin/heads.js');
  const state = createTemplateProjectState();
  // The head that turns is the skull itself, as on a face somebody drew; the jaw part is not there.
  state.semanticParts.head.roles.head = 'head';
  delete state.semanticParts.jaw;
  state.shapeKeys = state.shapeKeys.filter((key) => key.id !== 'head-jaw');
  for (const [name, part] of Object.entries(state.semanticParts)) if (part.type === 'head') { for (const element of Object.values(state.elements)) for (const property of Object.keys(element.bindings || {})) if (element.bindings[property].generatedBy?.semanticPart === name) delete element.bindings[property]; }
  const { assignSemanticRole } = await import('../../rig-editor/semantic-parts/part-model.js');
  assignSemanticRole(state, 'head', 'head', 'head');
  const fx = fixture(state);
  const { plan, summary, document } = install(fx, 'head', HEAD_OVAL);
  assert.equal(plan.skull, false);
  assert.deepEqual([summary.roles, summary.enabled, summary.disabled], [{ head: 'skull' }, ['headX', 'headY', 'headTilt', 'jawOpen'], []]);
  assert.deepEqual(part(document, 'head').roles, { head: 'skull' });
  assert.equal(document.elements.skull.bindings.translateX.expression, 'headX');
  // A face with no jaw gets one: the skull's own pose, on a jaw part made for it.
  assert.deepEqual(summary.parts, { jaw: { partId: part(document, 'jaw').id, roles: { jaw: 'skull' } } });
  assert.deepEqual([part(document, 'jaw').controls, document.shapeKeys.find((key) => key.target === 'skull')?.driver.expression], [['jawOpen'], 'mouthOpen + jawOpen']);
  assert.deepEqual(validateRig(document), []);
});

test('every built-in asset installs on the template, and the rig it leaves is sound', async () => {
  const { BUILTIN_FACE_PARTS } = await import('../face-library/builtin/index.js');
  for (const definition of BUILTIN_FACE_PARTS) {
    const fx = fixture();
    const { summary, document } = install(fx, definition.category, definition);
    assert.equal(summary.rootId, artworkIds(definition.artwork)[0], definition.id);
    assert.deepEqual(validateRig(document), [], definition.id);
    const own = part(document, facePartCategoryOf(definition));
    assert.equal(own.assetId, definition.id);
    for (const control of definition.capabilities) assert.ok(own.controls.includes(control) || definition.category === 'head', `${definition.id} carries ${control}`);
  }
});

const facePartCategoryOf = (definition) => ({ head: 'head', eyes: 'eyes', pupils: 'gaze', eyelids: 'eyelids', eyebrows: 'eyebrows', nose: 'nose', mouth: 'mouth', ears: 'ears', hair: 'hair', facialHair: 'facialHair', accessory: 'accessory' })[definition.category];

test('a head of hair is one part with three roles, its back painted behind the face', async () => {
  const { HAIR_LONG, HAIR_SHORT } = await import('../face-library/builtin/hair.js');
  const fx = fixture();
  const { plan, summary, document } = install(fx, 'hair', HAIR_LONG);
  // What goes: the fringe with the clipped group it sat alone in, the crown and the back.
  assert.deepEqual(plan.removeIds.sort(), ['hair', 'hairBack', 'hairFront', 'hairTop']);
  assert.deepEqual([plan.mountPoint, plan.before], ['faceRoot', null], 'the fringe\'s group was the last child: the new hair goes on top');
  assert.deepEqual(plan.behind, { ids: ['hairBack'], before: 'earLeft' }, 'the back goes where the old back was: behind the ears');
  assert.deepEqual(fx.canvas.calls.replace[0].behind, { ids: ['hairBack'], before: 'earLeft' });
  assert.deepEqual([summary.rootId, summary.detached, summary.roles], ['hair-long', ['hairBack'], { hair: 'hair', hairTop: 'hairTop', hairBack: 'hairBack' }]);
  assert.deepEqual(summary.enabled, ['hairSway', 'hairLift']);
  const children = layerChildren(document, 'faceRoot');
  assert.equal(children[0], 'hairBack', 'first in the face group: behind everything');
  assert.equal(children.at(-1), 'hair-long', 'the root on top');
  assert.deepEqual(layerChildren(document, 'hair-long'), ['hair', 'hairTop'], 'the back is no longer inside the root');
  assert.equal(children.includes('hairFront'), false, 'the empty shell went with the fringe');
  const hair = part(document, 'hair');
  assert.deepEqual([hair.roles, hair.controls, hair.assetId, hair.assetRoot, hair.assetDetached], [{ hair: 'hair', hairTop: 'hairTop', hairBack: 'hairBack' }, ['hairSway', 'hairLift'], 'hair.long', 'hair-long', ['hairBack']]);
  for (const id of ['hair', 'hairTop', 'hairBack']) {
    assert.deepEqual([document.elements[id].bindings.rotation.expression, document.elements[id].bindings.rotation.amplitude], ['hairSway', -4], `${id} sways, gently`);
    assert.deepEqual([document.elements[id].bindings.translateY.expression, document.elements[id].bindings.translateY.amplitude], ['hairLift', -5]);
  }
  // Root and back share one pivot and one transform: one rigid drawing.
  const root = document.elements['hair-long'].baseTransform, back = document.elements.hairBack.baseTransform;
  assert.deepEqual([back.pivotX, back.pivotY, back.x, back.y, back.scaleX], [root.pivotX, root.pivotY, root.x, root.y, root.scaleX]);
  assert.deepEqual(validateRig(document), []);
  // The next style takes the back out with the root, and its own has no back: the roles say so.
  const next = install(fx, 'hair', HAIR_SHORT);
  assert.deepEqual(next.plan.removeIds.sort(), ['hair', 'hair-long', 'hairBack', 'hairTop']);
  assert.equal(next.plan.behind, null);
  assert.deepEqual(part(next.document, 'hair').roles, { hair: 'hair', hairTop: 'hairTop' });
  assert.equal(part(next.document, 'hair').assetDetached, undefined);
  assert.equal(layerChildren(next.document, 'faceRoot')[0], 'earLeft', 'nothing behind the ears any more');
  assert.equal('hairBack' in next.document.elements, false);
  assert.deepEqual(validateRig(next.document), []);
});

test('a face wears several accessories, one per mount point; the same mount replaces, another joins; each comes off alone', async () => {
  const { GLASSES, HAT, EARRING } = await import('../face-library/builtin/accessories.js');
  const { MOUSTACHE, BEARD } = await import('../face-library/builtin/facial-hair.js');
  const fx = fixture();
  const glasses = install(fx, 'accessory', GLASSES);
  assert.deepEqual([glasses.plan.partId, glasses.summary.partId, glasses.summary.rootId], [null, 'accessory', 'accessory-glasses']);
  // Glasses turn with the head now (V3-02), and a drawing that turns declares
  // no parallax depth: the stand-in and the real rotation would displace it twice.
  assert.equal(glasses.document.elements['accessory-glasses'].depth, undefined, 'no parallax depth: it turns instead');
  assert.deepEqual(glasses.document.semanticParts.accessory.assetTurn, { element: { depth: 0.7, side: null, narrow: true } }, 'the install records how the drawing said it turns');
  const hat = install(fx, 'accessory', HAT);
  assert.deepEqual([hat.plan.partId, hat.plan.removeIds, hat.summary.partId], [null, [], 'accessory-2'], 'another mount point: a second part, nothing taken away');
  const parts = Object.values(hat.document.semanticParts).filter((item) => item.type === 'accessory');
  assert.deepEqual(parts.map((item) => [item.id, item.assetId, item.assetMount, item.roles.element]), [['accessory', 'accessory.glasses', 'eyes', 'accessory'], ['accessory-2', 'accessory.hat', 'head.top', 'accessory-2']], 'the hat\'s shape was renamed past the glasses\'');
  assert.equal(layerChildren(hat.document, 'faceRoot').at(-1), 'accessory-hat', 'on top');
  const again = install(fx, 'accessory', GLASSES);
  assert.deepEqual([again.plan.partId, again.plan.removeIds.sort()], ['accessory', ['accessory', 'accessory-glasses']], 'the same mount point: the old glasses go');
  assert.equal(Object.values(again.document.semanticParts).filter((item) => item.type === 'accessory').length, 2);
  assert.deepEqual(validateRig(again.document), []);
  // Off, one at a time.
  const plan = planFacePartRemoval(again.document, 'accessory-2');
  assert.deepEqual([plan.ok, plan.removeIds.sort()], [true, ['accessory-2', 'accessory-hat']]);
  const artwork = fx.canvas.replaceArtwork(plan.removeIds, '', {});
  const candidate = structuredClone(again.document);
  const summary = applyFacePartRemoval(candidate, plan, { artwork });
  assert.deepEqual(summary, { partId: 'accessory-2', hosted: [], removed: plan.removeIds });
  assert.equal('accessory-2' in candidate.semanticParts, false);
  assert.equal('accessory-hat' in candidate.elements, false);
  assert.ok(candidate.semanticParts.accessory && candidate.elements['accessory-glasses'], 'the glasses stay');
  assert.deepEqual(validateRig(candidate), []);
  // The canvas took the hat out; the store takes the document that says so, as the command would.
  fx.store.execute({ type: 'test/remove', domains: [...FACE_PART_DOMAINS], source: 'test', apply: (document) => { for (const field of FACE_PART_FIELDS) document[field] = structuredClone(candidate[field]); } });
  assert.match(planFacePartRemoval(candidate, 'nose').reason, /not a part a face wears several of/);
  assert.match(planFacePartRemoval(candidate, 'nope').reason, /no part called/);
  const drawn = structuredClone(candidate); drawn.semanticParts.accessory.assetRoot = 'gone';
  assert.match(planFacePartRemoval(drawn, 'accessory').reason, /did not come from the library/);
  // Facial hair the same way: a moustache under the nose and a beard on the chin, together.
  const moustache = install(fx, 'facialHair', MOUSTACHE);
  assert.deepEqual([moustache.summary.partId, moustache.summary.roles], ['facialHair', { facialHair: 'facialHair' }]);
  const beard = install(fx, 'facialHair', BEARD);
  assert.deepEqual([beard.plan.partId, beard.summary.partId], [null, 'facialHair-2']);
  assert.deepEqual(part(beard.document, 'facialHair').roles, { facialHair: 'facialHair' });
  assert.deepEqual(validateRig(beard.document), []);
  const earring = install(fx, 'accessory', EARRING);
  assert.deepEqual([earring.summary.rootId, earring.summary.partId], ['accessory-earring', 'accessory-2'], 'another accessory, at the ear, in the id the hat gave back');
  assert.deepEqual(validateRig(earring.document), []);
});

/* ── Review fixes (PR 29) ────────────────────────────────────────────────── */

test('a role pointing at artwork outside the old part, which the new asset does not draw, stays with that artwork', () => {
  const fx = fixture();
  install(fx, 'mouth', MOUTH_SIMPLE);
  // A tongue drawn by hand beside the library mouth: the nose stands in for it.
  fx.store.execute({ type: 'test/role', domains: ['semanticRig'], source: 'test', apply: (document) => { part(document, 'mouth').roles.tongue = 'nose'; } });
  const { plan, document } = install(fx, 'mouth', MOUTH_WIDE);
  assert.equal(plan.removeIds.includes('nose'), false, 'not the part\'s root: it stays on the canvas');
  assert.ok(document.elements.nose);
  assert.equal(part(document, 'mouth').roles.tongue, 'nose', 'and keeps its role rather than being orphaned');
  assert.deepEqual(part(document, 'mouth').roles.mouth, 'mouth', 'the asset\'s own roles are the new drawing\'s');
});

test('a piece painted behind the face that plays no role goes with the root on the next replacement', async () => {
  const { HAIR_SHORT } = await import('../face-library/builtin/hair.js');
  const shadowed = { id: 'hair.shadowed', category: 'hair', name: 'Shadowed', artwork: '<g id="hair-shadowed" data-name="Hair"><path id="shadow" data-name="Shadow" d="M40 40 L200 40 L200 120 L40 120 Z" fill="#222"/><path id="fringe" data-name="Fringe" d="M50 50 Q120 10 190 50 L190 70 Q120 40 50 70 Z" fill="#5b3a1e"/></g>', roles: { hair: 'fringe' }, behind: ['shadow'], referenceBox: { x: 40, y: 10, width: 160, height: 110 } };
  const fx = fixture();
  const first = install(fx, 'hair', shadowed);
  assert.deepEqual(part(first.document, 'hair').assetDetached, ['shadow'], 'the back piece is remembered as detached');
  assert.equal(layerChildren(first.document, 'hair-shadowed').includes('shadow'), false, 'and sits outside the root');
  const second = install(fx, 'hair', HAIR_SHORT);
  assert.ok(second.plan.removeIds.includes('shadow'), `the shadow goes with the root: ${second.plan.removeIds.join(', ')}`);
  assert.equal('shadow' in second.document.elements, false);
});

test('a skull that is not a path cannot take the jaw pose: the movement is off, not promised', async () => {
  const { HEAD_ROUND } = await import('../face-library/builtin/heads.js');
  const blob = { ...HEAD_ROUND, id: 'head.blob', name: 'Blob', artwork: '<g id="head-blob" data-name="Head"><ellipse id="skull" data-name="Skull" cx="120" cy="120" rx="80" ry="90" fill="#f9d9b0"/></g>' };
  const fx = fixture();
  const { summary, document } = install(fx, 'head', blob);
  assert.deepEqual(summary.enabled, []);
  assert.deepEqual(summary.disabled, ['jawOpen']);
  assert.equal(document.shapeKeys.some((item) => item.target === 'skull'), false, 'no shape key was made');
  assert.deepEqual(part(document, 'jaw').controls, [], 'the jaw does not claim a movement it has not got');
  assert.deepEqual(part(document, 'jaw').roles, { jaw: 'skull' }, 'though it holds the skull, for the next head that ships a pose');
});

test('a driver hint without an offset leaves the binding at the property\'s own rest: 1 for a scale, so the shape is whole at rest', () => {
  const fx = fixture();
  // The registry's noseScrunch is a translation: a hint that makes it a scale must rest at 1, not at the registry's 0.
  const scrunch = { ...NOSE_DOT, drivers: { noseScrunch: { property: 'scaleY', amplitude: -0.3 } } };
  const nose = install(fx, 'nose', scrunch);
  assert.ok(nose.summary.enabled.includes('noseScrunch'));
  const scaled = nose.document.elements[part(nose.document, 'nose').roles.nose].bindings.scaleY;
  assert.deepEqual([scaled.amplitude, scaled.offset], [-0.3, 1], 'a scale rests at 1');
  // And the reverse: the registry's mouthWidth is a scale; a hint that makes it a translation rests at 0.
  const shifted = { ...MOUTH_SIMPLE, drivers: { mouthWidth: { property: 'translateX', amplitude: 4 } } };
  const mouth = install(fx, 'mouth', shifted);
  assert.ok(mouth.summary.enabled.includes('mouthWidth'));
  const moved = mouth.document.elements.mouth.bindings.translateX;
  assert.deepEqual([moved.amplitude, moved.offset], [4, 0], 'a translation rests at 0');
});

test('a jaw pose that cannot become a shape key leaves a parameter an expression still names', async () => {
  const { HEAD_ROUND } = await import('../face-library/builtin/heads.js');
  const blob = { ...HEAD_ROUND, id: 'head.blob', name: 'Blob', artwork: '<g id="head-blob" data-name="Head"><ellipse id="skull" data-name="Skull" cx="120" cy="120" rx="80" ry="90" fill="#f9d9b0"/></g>' };
  const fx = fixture();
  fx.store.execute({ type: 'test/expression', domains: ['expressions'], source: 'test', apply: (document) => { document.expressions = [{ id: 'gasp', name: 'Gasp', controls: { jawOpen: 1 } }]; } });
  const { summary, document } = install(fx, 'head', blob);
  assert.deepEqual(summary.disabled, ['jawOpen']);
  assert.ok(document.params.jawOpen, 'the expression still names it, so the parameter stays');
  assert.ok(Object.values(document.states || {}).every((pose) => 'jawOpen' in pose), 'and every state keeps a value for it');
});

test('an offset left out puts the drawing at rest as drawn when the movement sits at its default: a scale with a default of one rests at one, an opacity rests at one', async () => {
  const { EYES_CARTOON } = await import('../face-library/builtin/eyes.js');
  const fx = fixture();
  // eyeOpen defaults to 1 (open): amplitude 1 on scaleY needs offset 0 to rest at 1, not the 2 a bare "1 for a scale" would give.
  const eyes = { ...EYES_CARTOON, drivers: { ...EYES_CARTOON.drivers, eyeOpen: { property: 'scaleY', amplitude: 1 } } };
  const { document } = install(fx, 'eyes', eyes);
  const lid = document.elements[part(document, 'eyes').roles.leftEye].bindings.scaleY;
  assert.deepEqual([lid.amplitude, lid.offset], [1, 0]);
  // teeth default to 0: an opacity that fades as the movement rises rests at 1.
  const teeth = { ...MOUTH_WIDE, drivers: { ...MOUTH_WIDE.drivers, teeth: { property: 'opacity', amplitude: -1 } } };
  const mouth = install(fx, 'mouth', teeth);
  const shown = mouth.document.elements[part(mouth.document, 'mouth').roles.teeth].bindings.opacity;
  assert.deepEqual([shown.amplitude, shown.offset], [-1, 1]);
});
