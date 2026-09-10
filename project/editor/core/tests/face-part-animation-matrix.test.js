import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { artworkIds, facePartCategory } from '../face-library/face-part-model.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { validateRig } from '../validation/rig-validator.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * Animation compatibility, one row per built-in asset (roadmap phase 25;
 * docs/FACE_PART_LIBRARY.md, "Installing"): every movement an asset claims
 * is switched on when it goes on the template face, and driving the
 * movement's parameter through the runtime's own frame compiler moves the
 * drawing -- the shape, its transform, its opacity, or the group above it.
 * "Every variant uses the same controls" is the whole point of the library,
 * and this is where it is held to.
 */
function dress(category, assetId) {
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const boxes = {};
  for (const asset of library.list()) Object.assign(boxes, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => boxes[id] || boxes[id.replace(/-\d+$/, '')] || null });
  const commands = createFacePartCommands(store, history, canvas, { library });
  const summary = commands.replace(category, assetId);
  assert.equal(summary.ok, true, `${assetId}: ${summary.reason}`);
  return { document: store.getDocument(), summary };
}

/** Layer id → the layer it sits in. */
function parentsOf(layers, parent = null, out = {}) {
  for (const layer of layers || []) { out[layer.id] = parent; parentsOf(layer.children, layer.id, out); }
  return out;
}

const frameOf = (document, values) => compileRigFrame(document.elements, { ...document.params, ...values }, document.globalConstraints, document.stateConstraints?.[document.activeState], {
  keyforms: document.keyforms, shapeKeys: document.shapeKeys, warps: document.warps, rigPins: document.rigPins, hands: document.hands, deformers: document.deformers, parallax: document.parallax
});
const seen = (frame, id) => JSON.stringify({ t: frame[id]?.transform, o: frame[id]?.opacity, p: frame[id]?.path, m: frame[id]?.morph });

/** A value of the parameter that is not its rest: the far end of its range. */
function drivenValue(parameter) {
  if (!parameter) return 1;
  const { min = -1, max = 1, default: rest = 0 } = parameter;
  return rest === max ? min : max;
}

/** The elements a control moves: the roles its part binds it to, or the whole part when it is a keyform or a pin. */
function watched(document, part, control) {
  const definition = SEMANTIC_PART_REGISTRY[part.type];
  const roles = Object.keys(definition?.bindings || {}).filter((role) => definition.bindings[role]?.[control]);
  const named = roles.map((role) => part.roles?.[role]).filter((id) => document.elements[id]);
  return named.length ? named : Object.values(part.roles || {}).filter((id) => document.elements[id]);
}

for (const asset of BUILTIN_FACE_PARTS) {
  const category = facePartCategory(asset.category);
  test(`${asset.id}: every movement it claims is on, and moves the drawing`, () => {
    const { document, summary } = dress(category.id, asset.id);
    assert.deepEqual(validateRig(document), [], 'the rig is whole');
    const claimed = [
      ...asset.capabilities.map((control) => ({ partId: summary.partId, control })),
      ...Object.entries(asset.parts || {}).flatMap(([type, drawn]) => (drawn.capabilities || []).map((control) => ({ partId: summary.parts?.[type]?.partId, control })))
    ];
    for (const { partId, control } of claimed) {
      const part = document.semanticParts[partId];
      assert.ok(part, `${asset.id} claims ${control} on a part that exists`);
      assert.ok(part.controls.includes(control), `${asset.id}: ${control} is on for ${part.type}`);
    }
    const parents = parentsOf(document.layers);
    const rest = frameOf(document, {});
    for (const { partId, control } of claimed) {
      const part = document.semanticParts[partId];
      const driven = frameOf(document, { [control]: drivenValue(document.params[control]) });
      const moved = watched(document, part, control).some((id) => {
        for (let node = id; node; node = parents[node]) if (seen(rest, node) !== seen(driven, node)) return true;
        return false;
      });
      assert.ok(moved, `${asset.id}: ${control} moves what ${part.type} draws`);
    }
  });
}
