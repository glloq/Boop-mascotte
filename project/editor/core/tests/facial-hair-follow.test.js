import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { artworkIds, describeFacePartCapabilities } from '../face-library/face-part-model.js';
import { BEARD, SIDEBURNS } from '../face-library/builtin/facial-hair.js';
import { assignSemanticRole, createSemanticPart, enableSemanticControl, removeSemanticPart } from '../../rig-editor/semantic-parts/part-model.js';
import { validateElementRig, validateRig } from '../validation/rig-validator.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * Facial hair is carried by the face it grows on (docs/FACE_PART_LIBRARY.md,
 * "Carried by the face under it").
 *
 * The complaint this answers, in the words it arrived in: *"barbe et
 * moustache ne suivent pas les mouvements de la bouche ni de la mâchoire"*.
 * They did not follow because `facialHair` was a part with **no movements at
 * all** and every drawing claimed none, so nothing drove them: opening the
 * mouth stretched the chin seventeen units down through the head's own jaw
 * shape key and left the beard drawn across the middle of the face.
 *
 * Why it is a binding and not a parent. A host (V3-03) parents artwork inside
 * the shape that plays a role, and SVG then composes that shape's
 * **transform** onto it for nothing -- which is the right answer for an
 * earring on an ear, and no answer at all here: the mouth and the jaw of this
 * face move by *deforming*, a shape key on the lip and a shape key on the
 * silhouette, and a deformation does not travel down a transform. There is
 * nothing to parent into either -- both are `<path>`, and a path has no
 * inside -- so a `rigConstraints` `parent` would copy a transform that never
 * changes. What does reach a shape-keyed face is the sentence that drives it:
 * the hair reads `mouthOpen + jawOpen`, exactly as the chin does.
 */

function dress(...assetIds) {
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const drawn = {};
  for (const asset of library.list()) Object.assign(drawn, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => drawn[id] || drawn[id.replace(/-\d+$/, '')] || null });
  const commands = createFacePartCommands(store, history, canvas, { library });
  const worn = {};
  for (const assetId of assetIds) {
    const summary = commands.replace('facialHair', assetId);
    assert.equal(summary.ok, true, `${assetId}: ${summary.reason}`);
    worn[assetId] = store.getDocument().semanticParts[summary.partId];
  }
  return { store, commands, worn, document: () => store.getDocument() };
}

const frameOf = (document, values) => compileRigFrame(document.elements, { ...document.params, ...values }, document.globalConstraints, document.stateConstraints?.[document.activeState], {
  keyforms: document.keyforms, shapeKeys: document.shapeKeys, warps: document.warps, rigPins: document.rigPins, hands: document.hands, deformers: document.deformers, parallax: document.parallax
});

/** How far a piece of artwork travels down the page between two poses. */
const travel = (document, elementId, values) =>
  Math.round((frameOf(document, values)[elementId].transform.y - frameOf(document, {})[elementId].transform.y) * 1000) / 1000;

/**
 * How far the chin goes, read off the silhouette the frame compiled.
 *
 * The head is one closed outline built from `M` and `C` alone, so every other
 * number in it is a `y`, and the largest of them is the bottom of the chin --
 * which is the thing a beard has to stay on.
 */
function chin(document, values) {
  const path = String(frameOf(document, values).head.path || '');
  const numbers = (path.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return Math.max(...numbers.filter((_, index) => index % 2 === 1));
}

const hairOf = (worn, assetId) => worn[assetId].roles.facialHair;

test('a beard travels with the jaw, a moustache rides the mouth the other way, and sideburns stay on the temples', () => {
  const ui = dress('facialhair.beard', 'facialhair.moustache', 'facialhair.goatee', 'facialhair.sideburns');
  const document = ui.document();
  assert.deepEqual(validateRig(document), [], 'the rig is whole');

  const beard = hairOf(ui.worn, 'facialhair.beard');
  const moustache = hairOf(ui.worn, 'facialhair.moustache');
  const goatee = hairOf(ui.worn, 'facialhair.goatee');
  const sideburns = hairOf(ui.worn, 'facialhair.sideburns');

  // Opening the mouth. The chin lengthens, and what grows on it goes with it.
  assert.deepEqual(
    [travel(document, beard, { mouthOpen: 1 }), travel(document, goatee, { mouthOpen: 1 }), travel(document, moustache, { mouthOpen: 1 }), travel(document, sideburns, { mouthOpen: 1 })],
    [15, 18, -3, 0],
    'down with the chin, furthest for the tuft between the lip and it, up a little for the moustache over the opening, and not at all on the temples'
  );

  // And the beard is on the chin, not near it: the outline it hangs from
  // travels seventeen, and the drawing travels fifteen of them.
  const dropped = chin(document, { mouthOpen: 1 }) - chin(document, {});
  assert.ok(dropped > 16 && dropped < 18, `the chin drops ${dropped}`);
  assert.ok(travel(document, beard, { mouthOpen: 1 }) > dropped * 0.8, 'the beard stays on the chin rather than floating in the middle of the face');

  // Dropping the jaw on its own does the same: an author can open the jaw
  // without opening the mouth, and the hair on it still has to move.
  assert.deepEqual(
    [travel(document, beard, { jawOpen: 1 }), travel(document, moustache, { jawOpen: 1 }), travel(document, sideburns, { jawOpen: 1 })],
    [15, -3, 0]
  );

  // The two add, because the hair reads the same sentence the chin is
  // stretched by -- so a yawn (both at once) carries the beard exactly twice
  // as far, as it carries the chin exactly twice as far.
  assert.equal(travel(document, beard, { mouthOpen: 1, jawOpen: 1 }), 30);
  assert.equal(travel(document, goatee, { mouthOpen: 1, jawOpen: 1 }), 36);
  assert.ok(Math.abs((chin(document, { mouthOpen: 1, jawOpen: 1 }) - chin(document, {})) - dropped * 2) < 0.01);
});

test('what nothing carries claims nothing: sideburns are Limited animation rather than a movement that does not move', () => {
  // The part has a movement now, so declining it *means* something: the card
  // says Limited animation, which is the honest answer for hair on a temple.
  assert.deepEqual(describeFacePartCapabilities(SIDEBURNS), { controls: ['jawOpen'], supported: [], missing: ['jawOpen'], unsupported: [], complete: false });
  assert.deepEqual(describeFacePartCapabilities(BEARD).supported, ['jawOpen']);

  const ui = dress('facialhair.sideburns', 'facialhair.beard');
  const document = ui.document();
  const temples = ui.worn['facialhair.sideburns'], chinful = ui.worn['facialhair.beard'];
  assert.deepEqual([temples.controls, chinful.controls], [[], ['jawOpen']]);
  assert.deepEqual(document.elements[temples.roles.facialHair].bindings || {}, {}, 'nothing on the drawing either');
  assert.equal(document.elements[chinful.roles.facialHair].bindings.translateY.expression, 'mouthOpen + jawOpen');
});

test('the words a movement is driven by are parameters of the rig, whether or not the face has the part that owns them', () => {
  const rig = {
    elements: { whiskers: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 120, pivotY: 190 }, bindings: {}, meta: { nodeType: 'path' } } },
    params: {}, states: { neutral: {} }, activeState: 'neutral', semanticParts: {}
  };
  const part = createSemanticPart(rig, 'facialHair');
  assignSemanticRole(rig, part.id, 'facialHair', 'whiskers');
  enableSemanticControl(rig, part.id, 'jawOpen', { amplitude: 15 });

  const binding = rig.elements.whiskers.bindings.translateY;
  assert.equal(binding.expression, 'mouthOpen + jawOpen', 'the hair reads what the chin reads');
  assert.deepEqual(Object.keys(rig.params).sort(), ['jawOpen', 'mouthOpen'], 'both words exist, on a face with neither a mouth nor a jaw');
  assert.deepEqual(rig.states.neutral, { jawOpen: 0, mouthOpen: 0 }, 'and both rest at closed in every pose');
  assert.deepEqual(validateElementRig(rig.elements.whiskers, 'whiskers', rig.params), [], 'so the binding names nothing the rig has not got');

  // And they leave with it: a word this part was the only one saying is not a
  // parameter anybody can key once the part is gone.
  removeSemanticPart(rig, part.id);
  assert.deepEqual(Object.keys(rig.params), []);
});
