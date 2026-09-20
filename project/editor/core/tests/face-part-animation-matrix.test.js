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

/**
 * Every parameter one movement is driven by, the movement itself included.
 *
 * Usually just the movement's own name. A movement driven by a *sentence* about
 * other movements needs every word of it: a mouth's teeth read
 * `mouthOpen * teeth`, a product, so closed lips have nothing behind them to
 * show (docs/MOUTH_BUILD.md).
 *
 * Only words that are **movements some part declares**. A side offset is a word
 * too — `eyeOpen + eyeOpenLeft` is what a wink is — and it rests at 0 on purpose:
 * driving it would take the sum back to where the drawing rests and read a
 * working blink as a movement that does nothing. No part declares one, so none
 * is driven here.
 *
 * Any part's, not only this one's: a gate often belongs to the part that draws
 * the shape rather than to the part that moves it. The tongue's tip comes out
 * on `tongue * tongueOut` — the mouth says there is a tongue at all, and the
 * tongue part says how far — and a beard follows `mouthOpen + jawOpen`, which
 * is the sentence the chin under it is stretched by.
 */
function sentence(document, part, control) {
  const names = new Set([control]);
  const own = new Set(Object.values(SEMANTIC_PART_REGISTRY).flatMap((definition) => definition.controls || []));
  const expressions = [
    ...Object.values(document.elements || {}).flatMap((element) => Object.values(element.bindings || {})
      .filter((binding) => binding.generatedBy?.semanticPart === part.id && binding.generatedBy?.control === control)
      .map((binding) => binding.expression)),
    ...(document.shapeKeys || []).filter((key) => key.generatedBy?.semanticPart === part.id && key.generatedBy?.control === control)
      .map((key) => key.driver?.expression)
  ];
  for (const expression of expressions) {
    for (const word of String(expression || '').match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) {
      if (own.has(word) && document.params[word]) names.add(word);
    }
  }
  return [...names];
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
      // Every word the movement is driven by, not only the one it is named
      // after. A band inside a mouth is honestly gated on the mouth being open
      // -- `mouthOpen * teeth`, a product, so closed lips have nothing behind
      // them to show (docs/MOUTH_BUILD.md) -- and driving `teeth` alone would
      // read that correct gate as a movement that does nothing.
      const pose = Object.fromEntries(sentence(document, part, control)
        .map((name) => [name, drivenValue(document.params[name])]));
      const driven = frameOf(document, pose);
      const moved = watched(document, part, control).some((id) => {
        for (let node = id; node; node = parents[node]) if (seen(rest, node) !== seen(driven, node)) return true;
        return false;
      });
      assert.ok(moved, `${asset.id}: ${control} moves what ${part.type} draws`);
    }
  });
}
