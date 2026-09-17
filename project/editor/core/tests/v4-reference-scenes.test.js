import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRigFrame, resolveStateParams } from '../../../runtime/runtime.js';
import { applyProjectSnapshot, prepareProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { DEFORMING_NODES, RIGID_NODES, fewDeformingNodes, manyRigidNodes, sceneOptions, sceneParams } from './fixtures/reference-scenes.js';

/**
 * The baseline the raster program is measured against (docs/V4_ROADMAP.md,
 * V4-004).
 *
 * Following what this repo already decided about performance
 * (docs/RUNTIME_PERFORMANCE.md): the load-bearing assertions are *structural*
 * and hold on any machine, and there is one generous wall-clock ceiling per
 * scene whose only job is to catch an order-of-magnitude regression. A
 * timing here is evidence, not a gate on a millisecond.
 *
 * **What the first measurement found, and why it shapes the plan.** Two
 * hundred nodes that only move cost about the same per frame as a hundred and
 * thirty that deform: ~7 µs a node against ~11 µs a node. Deformation is not
 * where the money goes -- node count is. So the scene to watch through Phase 2
 * is the rigid one, and the rule for V4-022 is that it must not add per-node
 * work to the compile; the mesh work in Phase 7 starts with far more headroom
 * than it looks like it should.
 */

const template = () => {
  const snapshot = JSON.parse(readFileSync(new URL('./fixtures/projects/template-face.json', import.meta.url), 'utf8'));
  const state = createCleanProjectState();
  applyProjectSnapshot(state, prepareProjectSnapshot(snapshot, (svg) => svg));
  return {
    elements: state.elements,
    options: { keyforms: state.keyforms, shapeKeys: state.shapeKeys, warps: state.warps, rigPins: state.rigPins, rigConstraints: state.rigConstraints, rigAttachments: state.rigAttachments, rigHolds: state.rigHolds, hands: state.hands, deformers: state.deformers, parallax: state.parallax },
    params: resolveStateParams(state.params, state.states.idle),
    constraints: [state.globalConstraints, state.stateConstraints?.idle]
  };
};

/**
 * The three shapes a mascot comes in, and what each is allowed to cost.
 *
 * `nodes` is the count that must come back compiled -- a scene that quietly
 * stops drawing half of itself would otherwise look like a speed-up. `ceiling`
 * is roughly four times what the scene measured when it was frozen, and well
 * under the 16.6 ms of a 60 fps frame, since a mascot is one thing on a page.
 */
const SCENES = [
  { name: 'rigid raster: many nodes that only move', nodes: RIGID_NODES, ceiling: 6, frozen: 1.41, build: () => manyRigidNodes() },
  { name: 'mesh: few nodes whose shape is rebuilt', nodes: DEFORMING_NODES, ceiling: 1, frozen: 0.06, build: () => fewDeformingNodes() },
  { name: "vector: today's built-in face", nodes: 130, ceiling: 6, frozen: 1.45, build: null }
];

const compileScene = (scene, phase) => (scene.build
  ? (() => { const built = scene.built ??= scene.build(); return compileRigFrame(built.elements, sceneParams(phase), {}, {}, sceneOptions(built)); })()
  : (() => { const built = scene.built ??= template(); return compileRigFrame(built.elements, { ...built.params, headX: Math.sin(phase / 20), smile: (phase % 7) / 7 }, ...built.constraints, built.options); })());

for (const scene of SCENES) test(`${scene.name}: every node compiles, and none of them is a live reference`,()=>{
  const frame = compileScene(scene, 0);
  assert.equal(Object.keys(frame).length,scene.nodes,'a node stopped compiling');
  for (const [id, item] of Object.entries(frame)) {
    assert.equal(typeof item.opacity,'number',`${id} opacity`);
    assert.ok(item.transform && typeof item.transform === 'object',`${id} transform`);
    if (item.path) assert.equal(typeof item.path,'string',`${id} path`);
  }
});

for (const scene of SCENES) test(`${scene.name}: an unchanged frame rebuilds nothing`,()=>{
  const first = compileScene(scene, 3), second = compileScene(scene, 3);
  assert.deepEqual(second,first);
  // Identity, not equality: a path that did not change is the same string
  // back, so nothing was rebuilt to produce it.
  for (const [id, item] of Object.entries(first)) if (item.path) assert.ok(Object.is(second[id].path, item.path),`${id} rebuilt its path`);
});

for (const scene of SCENES) test(`${scene.name}: a frame stays well inside its budget`,()=>{
  compileScene(scene, 0);
  const samples = 200, started = performance.now();
  for (let phase = 0; phase < samples; phase += 1) compileScene(scene, phase);
  const perFrame = (performance.now() - started) / samples;
  // Directional only: the ceiling is roughly four times what this measured
  // when it was frozen, which still catches an order of magnitude on any
  // machine that can run the suite at all.
  assert.ok(perFrame < scene.ceiling,`${perFrame.toFixed(3)} ms per frame, frozen at ${scene.frozen}, ceiling ${scene.ceiling}`);
});

test('node count is the cost, not deformation',()=>{
  // The finding this baseline exists to protect: if a later phase makes a
  // deforming node dramatically more expensive than a rigid one, the mesh
  // plan's assumptions stop holding and this is where it shows.
  const rigid = manyRigidNodes(), mesh = fewDeformingNodes();
  const per = (scene, count) => {
    compileRigFrame(scene.elements, sceneParams(0), {}, {}, sceneOptions(scene));
    const samples = 200, started = performance.now();
    for (let phase = 0; phase < samples; phase += 1) compileRigFrame(scene.elements, sceneParams(phase), {}, {}, sceneOptions(scene));
    return (performance.now() - started) / samples / count;
  };
  const perRigid = per(rigid, RIGID_NODES), perMesh = per(mesh, DEFORMING_NODES);
  assert.ok(perMesh < perRigid * 12,`a deforming node costs ${(perMesh / perRigid).toFixed(1)}x a rigid one; it was about 1.1x when this was frozen`);
});
