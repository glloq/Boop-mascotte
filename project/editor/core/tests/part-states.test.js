import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PART_STATES_REQUIREMENT, applyPartStatesToDom, describePartState, normalizePartState,
  normalizePartStateSet, normalizePartStates, primePartStates, stateElements, stateFor
} from '../../../runtime/part-states.js';
import { RUNTIME_FEATURES, rigRequirements, unsupportedRequirements } from '../../../runtime/runtime.js';

/**
 * A piece that is several drawings, one of which is showing
 * (V5-01, docs/V5_MASCOTTE_IMAGES_ETUDE.md).
 *
 * The generalisation of what hands already did. Two rules decide everything:
 *
 * 1. **A drawing replaces a drawing.** Nothing interpolates between two
 *    pictures, because there is no honest interpolation between two
 *    photographs — the same rule `hand-sprite.js` states and keeps.
 * 2. **Which one shows is a rule, not an index.** Indexing drawings with a
 *    number makes the author count and makes `eyeOpen` mean something
 *    different on every mascot, so a state carries the conditions a reaction
 *    carries.
 */

const state = (id, element, when = []) => ({ id, element, name: id, when });
const gate = (parameter, operator, value) => ({ kind: 'parameter', parameter, operator, value });

const mouth = () => normalizePartStateSet({
  target: 'mouth',
  fallback: 'closed',
  states: [
    state('wide', 'mouthWide', [gate('mouthOpen', '>=', .85)]),
    state('open', 'mouthOpen', [gate('mouthOpen', '>=', .5)]),
    state('smile', 'mouthSmile', [gate('smile', '>=', .4)]),
    state('closed', 'mouthClosed')
  ]
});

test('a state is read or dropped, never repaired', () => {
  assert.deepEqual(normalizePartState(state('open', 'mouthOpen')), { id: 'open', element: 'mouthOpen', name: 'open', when: [] });
  // The id defaults to the drawing it names, which is the only other thing it
  // could honestly be.
  assert.equal(normalizePartState({ element: 'mouthOpen' }).id, 'mouthOpen');
  for (const junk of [null, 'open', {}, { id: 'open' }, { element: '   ' }]) {
    assert.equal(normalizePartState(junk), null, `${JSON.stringify(junk)} names no drawing`);
  }
});

test('a set of one is a piece, not a set', () => {
  // One drawing that is always showing needs no swap — and a rig that kept it
  // would ask for `part:states` for a feature it does not use.
  assert.equal(normalizePartStateSet({ target: 'mouth', states: [state('a', 'mouthA')] }), null);
  assert.equal(normalizePartStateSet({ target: '', states: [state('a', 'x'), state('b', 'y')] }), null);
  assert.equal(normalizePartStateSet(null), null);

  // Two states on one drawing is a set that cannot say which is showing.
  const doubled = normalizePartStateSet({ target: 'mouth', states: [state('a', 'same'), state('b', 'same'), state('c', 'other')] });
  assert.deepEqual(stateElements(doubled), ['same', 'other']);

  // The fallback is a state it has, or the last one — which is where an
  // unconditional state belongs anyway.
  assert.equal(mouth().fallback, 'closed');
  assert.equal(normalizePartStateSet({ target: 'm', fallback: 'ghost', states: [state('a', 'x'), state('b', 'y')] }).fallback, 'b');
  assert.equal(normalizePartStateSet({ target: 'm', states: [state('a', 'x'), state('b', 'y')] }).id, 'states-m');
});

test('one set per piece, because two would each hide what the other shows', () => {
  const sets = normalizePartStates({ partStates: [
    { target: 'mouth', states: [state('a', 'x'), state('b', 'y')] },
    { target: 'mouth', states: [state('c', 'p'), state('d', 'q')] },
    { target: 'eyeLeft', states: [state('open', 'o'), state('shut', 's')] },
    'junk', null
  ] });
  assert.deepEqual(sets.map((set) => set.target), ['mouth', 'eyeLeft']);
  assert.deepEqual(normalizePartStates({}), []);
});

test('the first rule that holds wins, and a state with no rule is the otherwise', () => {
  const set = mouth();
  const at = (params) => stateFor(set, { params }).id;
  assert.equal(at({ mouthOpen: 0, smile: 0 }), 'closed', 'nothing said, so the last one');
  assert.equal(at({ mouthOpen: 0, smile: .6 }), 'smile');
  assert.equal(at({ mouthOpen: .6, smile: 0 }), 'open');
  assert.equal(at({ mouthOpen: 1, smile: 0 }), 'wide');
  // Order is the author's: wide is listed first, so a wide-open smile is wide.
  assert.equal(at({ mouthOpen: 1, smile: 1 }), 'wide');

  // A state can also ask about the state the mascot is in, because it is the
  // same vocabulary a reaction uses.
  const sleepy = normalizePartStateSet({ target: 'eyeLeft', states: [
    state('shut', 'eyeShut', [{ kind: 'state', state: 'sleeping' }]),
    state('open', 'eyeOpen')
  ] });
  assert.equal(stateFor(sleepy, { state: 'sleeping' }).id, 'shut');
  assert.equal(stateFor(sleepy, { state: 'idle' }).id, 'open');
  assert.equal(stateFor(null, {}), null);
});

test('a set says what it is in words', () => {
  const set = mouth();
  assert.equal(describePartState(set.states[1]), 'open — when mouthOpen is at least 0.5');
  assert.equal(describePartState(set.states[3]), 'closed — otherwise');
  assert.equal(describePartState(null), '');
});

// ---------------------------------------------------------------------------
// What it writes on a document
// ---------------------------------------------------------------------------

/** The four properties the swap touches, on a document it can query. */
function fakeRoot(ids) {
  const nodes = new Map(ids.map((id) => [id, { id, style: {} }]));
  return { nodes, querySelector: (selector) => nodes.get(selector.replace(/^#/, '')) || null };
}
const shown = (root) => [...root.nodes.values()].filter((node) => node.style.display !== 'none').map((node) => node.id);

test('one drawing shows and the rest are not painted at all', () => {
  const set = mouth();
  const root = fakeRoot(['mouthWide', 'mouthOpen', 'mouthSmile', 'mouthClosed']);
  const showing = new Map();

  assert.equal(applyPartStatesToDom(root, [set], { params: { mouthOpen: 1 } }, showing), 1);
  assert.deepEqual(shown(root), ['mouthWide']);
  // `display`, not `opacity`: a hidden drawing must not be clickable, must not
  // be measured and must not be painted.
  assert.equal(root.nodes.get('mouthClosed').style.display, 'none');

  // Nothing changed, so nothing is written: the whole point of a swap is that
  // keeping the same drawing on screen costs nothing.
  assert.equal(applyPartStatesToDom(root, [set], { params: { mouthOpen: 1 } }, showing), 0);
  assert.equal(applyPartStatesToDom(root, [set], { params: { mouthOpen: 0 } }, showing), 1);
  assert.deepEqual(shown(root), ['mouthClosed']);
});

test('the first paint shows the fallback, so a static viewer is not five mouths', () => {
  // Without this every drawing is visible at once until the first frame runs —
  // and in a viewer that never runs one, for ever.
  const root = fakeRoot(['mouthWide', 'mouthOpen', 'mouthSmile', 'mouthClosed']);
  primePartStates(root, [mouth()]);
  assert.deepEqual(shown(root), ['mouthClosed']);
});

test('a set whose drawings are not in the document is left alone', () => {
  const root = fakeRoot(['somethingElse']);
  const showing = new Map();
  assert.equal(applyPartStatesToDom(root, [mouth()], { params: {} }, showing), 0);
  assert.equal(showing.size, 0, 'and it is not remembered as shown, so it retries when the artwork arrives');
  assert.equal(applyPartStatesToDom(null, [mouth()], {}), 0);
});

// ---------------------------------------------------------------------------
// Declining beats drawing five mouths at once
// ---------------------------------------------------------------------------

test('a rig with states asks for them by name', () => {
  assert.ok(RUNTIME_FEATURES.includes(PART_STATES_REQUIREMENT), 'this build has them');
  assert.deepEqual(rigRequirements({ partStates: [] }), []);
  assert.deepEqual(rigRequirements({ partStates: [{ target: 'mouth', states: [state('a', 'x'), state('b', 'y')] }] }), [PART_STATES_REQUIREMENT]);
  // A set nobody can read is not a set, so it is not a requirement either.
  assert.deepEqual(rigRequirements({ partStates: [{ target: 'mouth', states: [state('a', 'x')] }] }), []);
  assert.deepEqual(unsupportedRequirements({ requires: [PART_STATES_REQUIREMENT] }), []);
});
