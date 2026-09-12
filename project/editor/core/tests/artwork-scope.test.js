import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { artworkScopeMarkup, describeArtworkScope } from '../../ui/artwork-scope.js';
import { handStateElementId } from '../hands/hand-state-model.js';

/**
 * What the vector tools are open on (UIR-06).
 *
 * A scope is derived from the element the canvas is limited to, never stored:
 * there is no third place holding "what am I editing" to come apart from the
 * canvas and the document.
 */

test('no scope is the whole drawing, and says nothing over the canvas', () => {
  const scope = describeArtworkScope(createTemplateProjectState(), null);
  assert.equal(scope.kind, 'face');
  assert.equal(scope.back, null);
  assert.equal(artworkScopeMarkup(scope), '', 'a breadcrumb over an unscoped canvas is noise');
});

test('one state of one hand names the hand, the state, and the way back to Hands', () => {
  const document = createTemplateProjectState();
  const scope = describeArtworkScope(document, handStateElementId('left', 'point'));
  assert.equal(scope.kind, 'hand-state');
  assert.deepEqual([scope.side, scope.stateId], ['left', 'point']);
  assert.deepEqual(scope.crumbs, ['Design', 'Hands', 'Left hand', 'Point']);
  // Reached from Hands and nowhere else, so that is the way out -- not the
  // workspace the vector tools happen to live in.
  assert.deepEqual(scope.back, { mode: 'design.hands', label: 'Back to Hands' });
  const markup = artworkScopeMarkup(scope);
  assert.match(markup, /Editing:/);
  assert.match(markup, /data-artwork-scope-back="design\.hands"/);
  assert.match(markup, /data-artwork-crumb-last[^>]*>Point</);
});

test('the right hand is its own scope, at the same state id', () => {
  const document = createTemplateProjectState();
  const left = describeArtworkScope(document, handStateElementId('left', 'fist'));
  const right = describeArtworkScope(document, handStateElementId('right', 'fist'));
  assert.deepEqual([left.side, right.side], ['left', 'right']);
  assert.notDeepEqual(left.crumbs, right.crumbs, 'two hands are never one place');
});

test('a piece of the face names itself and goes back to Face', () => {
  const document = createTemplateProjectState();
  const scope = describeArtworkScope(document, 'mouth');
  assert.equal(scope.kind, 'element');
  assert.equal(scope.back.mode, 'design.face');
  assert.equal(scope.crumbs[0], 'Design');
  assert.equal(scope.crumbs.at(-1), document.layerMetadata?.mouth?.name || 'mouth');
});

test('a state an author made is scoped by its own id, not by the set\'s', () => {
  // The case the element-id helper exists for: a duplicated state is not in the
  // shipped set, and resolving its id through the set would name another state.
  const document = createTemplateProjectState();
  document.hands.left.styles.library = [...document.hands.left.styles.library, { id: 'jab', label: 'Jab', element: 'handLeftStyle-jab', mirrored: false }];
  const scope = describeArtworkScope(document, 'handLeftStyle-jab');
  assert.deepEqual([scope.kind, scope.stateId, scope.crumbs.at(-1)], ['hand-state', 'jab', 'Jab']);
});
