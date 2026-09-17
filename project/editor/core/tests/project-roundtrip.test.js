import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { applyProjectSnapshot, createProjectSnapshot, prepareProjectSnapshot } from '../state/project-snapshot.js';
import { PROJECT_VERSION } from '../state/project-version.js';
import { createCleanProjectState } from '../state/store.js';
import { compileFrame } from '../preview-runtime/frame-compiler.js';
import { resolveStateParams } from '../../../runtime/runtime.js';

/**
 * Real projects, frozen, opened and saved again.
 *
 * The V4 program changes the project format underneath every one of these
 * files (docs/V4_ROADMAP.md, Phase 0). What must not change is what they
 * draw, so the invariant is the compiled frame -- the transforms, paths,
 * opacities and matrices the runtime hands the artwork -- and not the bytes
 * around it. A format is allowed to move; a mascot is not.
 *
 * **Two anchors, because a round trip alone proves less than it looks.**
 * Comparing a reloaded project against the same project in memory is
 * symmetric: a reader that quietly drops a whole domain drops it on both
 * sides and the comparison still passes. (Tried: emptying `keyforms` on the
 * way in passes every relative check.) So the frames are also measured
 * against a frozen digest, and the domains against frozen counts -- the
 * counts so a failure reads as "keyforms went from 157 to 0", the digest so
 * nothing at all can move unnoticed.
 *
 * **The fixtures.** `template-face.json` is the built-in face as the editor
 * saves it today: 130 elements, 70 parameters, three states, shape keys, pins,
 * clips, expressions and reactions. `legacy-face.json` is the same mascot
 * reduced to what the first format could express -- no editor block and none
 * of the rig domains added since -- which is the file the reader has been
 * absorbing by accident and now migrates on purpose. With no shape keys it
 * has no smile, so its `idle` and `happy` draw alike; that is the format
 * being honest, not the fixture being wrong.
 *
 * **What this corpus does not cover:** warps, deformers and hands are empty
 * in both files. Those domains have their own tests, but no *project* here
 * carries one, so a format change could break them without failing this
 * file. The place to close that is V4-060 and V4-070, which are when those
 * domains change.
 *
 * Frozen on 2026-09-17. They are data, not output: nothing regenerates them,
 * and a diff here is a finding, not a rebuild.
 */
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/projects/${name}.json`, import.meta.url), 'utf8'));

/** What each fixture holds, and what it draws, as measured when it was frozen. */
const FROZEN = Object.freeze({
  'template-face': {
    counts: { elements: 130, params: 70, keyforms: 157, shapeKeys: 13, clips: 45, semanticParts: 11, expressions: 27, reactions: 21, rigPins: 7 },
    frames: { idle: '54ca2c2dc946f6dc', happy: '5da59da5c406c811', surprised: '58aabe525efc3317' }
  },
  'legacy-face': {
    counts: { elements: 130, params: 70, keyforms: 0, shapeKeys: 0, clips: 0, semanticParts: 0, expressions: 0, reactions: 0, rigPins: 0 },
    frames: { idle: 'e1d7e6e2ba062793', happy: 'e1d7e6e2ba062793', surprised: '2f84cda538feef25' }
  }
});
const FIXTURES = Object.keys(FROZEN);

/** Key order and float noise are not the mascot; six decimals of a number are. */
const canonical = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : String(value);
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const digest = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex').slice(0, 16);

const deformers = (state) => ({
  keyforms: state.keyforms, shapeKeys: state.shapeKeys, warps: state.warps, rigPins: state.rigPins,
  rigConstraints: state.rigConstraints, rigAttachments: state.rigAttachments, rigHolds: state.rigHolds,
  hands: state.hands, deformers: state.deformers, parallax: state.parallax
});

/** What the artwork is drawn from, in every state the project has. */
const framesOf = (state) => Object.fromEntries(Object.keys(state.states || {}).map((name) => [name, compileFrame(
  state.elements, resolveStateParams(state.params, state.states[name]),
  state.globalConstraints, state.stateConstraints?.[name], deformers(state)
)]));

const countsOf = (state) => ({
  elements: Object.keys(state.elements).length, params: Object.keys(state.params).length,
  keyforms: state.keyforms.length, shapeKeys: state.shapeKeys.length, clips: state.animationClips.length,
  semanticParts: Object.keys(state.semanticParts).length, expressions: state.expressions.length,
  reactions: state.reactions.length, rigPins: state.rigPins.length
});

const open = (snapshot) => {
  const prepared = prepareProjectSnapshot(structuredClone(snapshot), (svg) => svg);
  const state = createCleanProjectState();
  applyProjectSnapshot(state, prepared);
  return { state, prepared };
};

const saved = (state) => { const { capturedAt, ...rest } = createProjectSnapshot(state); return rest; };

for (const name of FIXTURES) test(`${name}: opens carrying what it was frozen with`,()=>{
  const { state } = open(fixture(name));
  assert.deepEqual(countsOf(state),FROZEN[name].counts,'a domain changed size on the way in');
});

for (const name of FIXTURES) test(`${name}: draws what it was frozen drawing`,()=>{
  const { state } = open(fixture(name));
  const frames = Object.fromEntries(Object.entries(framesOf(state)).map(([id, frame]) => [id, digest(frame)]));
  assert.deepEqual(frames,FROZEN[name].frames,
    'this mascot draws differently than when it was frozen. If that is deliberate, move the digest here in the same commit and say what changed; if it is not, something in the format or the rig moved it.');
});

for (const name of FIXTURES) test(`${name}: open, save, reload draws exactly the same frame`,()=>{
  const { state } = open(fixture(name));
  const before = framesOf(state);
  const { state: reloaded } = open(saved(state));
  assert.deepEqual(framesOf(reloaded),before);
  assert.deepEqual(countsOf(reloaded),FROZEN[name].counts);
});

for (const name of FIXTURES) test(`${name}: open, edit, save, reload keeps the edit and what it draws`,()=>{
  const { state } = open(fixture(name));
  // An edit of each kind the rig has: a posed value, a new state, a new
  // transition, a constraint, and a renamed piece of artwork.
  state.states.happy = { ...state.states.happy, headX: 0.42 };
  state.states.peering = { ...state.states.idle, headX: -1, headY: 0.3 };
  state.transitions = { ...state.transitions, idle: [...(state.transitions.idle || []), 'peering'] };
  state.stateConstraints.peering = { translate: 0.5, rotate: 1, scale: 1 };
  state.layerMetadata = { ...state.layerMetadata, faceRoot: { name: 'The whole face' } };

  const edited = framesOf(state);
  const { state: reloaded } = open(saved(state));
  assert.equal(reloaded.states.happy.headX,0.42);
  assert.deepEqual(reloaded.stateConstraints.peering,{ translate: 0.5, rotate: 1, scale: 1 });
  assert.deepEqual(reloaded.layerMetadata.faceRoot,{ name: 'The whole face' });
  assert.ok(reloaded.transitions.idle.includes('peering'));
  assert.deepEqual(framesOf(reloaded),edited);
  // The edit is visible, not merely stored.
  assert.notEqual(digest(edited.happy),FROZEN[name].frames.happy);
});

for (const name of FIXTURES) test(`${name}: saving twice is a fixed point`,()=>{
  const { state } = open(fixture(name));
  const once = saved(state);
  const { state: reloaded } = open(once);
  assert.deepEqual(saved(reloaded),once);
});

test('a project from the first format arrives at the current one, and says so',()=>{
  const { prepared, state } = open(fixture('legacy-face'));
  assert.equal(prepared.version,PROJECT_VERSION);
  assert.equal(prepared.migratedFrom.version,1);
  // The domains it predates read as empty rather than missing.
  for (const domain of ['keyforms','shapeKeys','warps','rigPins','rigConstraints','rigAttachments','rigHolds','followers','behaviors'])
    assert.deepEqual(state[domain],[],`${domain} should read as empty, not missing`);
});
