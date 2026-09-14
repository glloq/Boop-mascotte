import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { deriveProjectReadiness, exportBlockingIssues, validateProject } from '../validation/validate-project.js';

test('canonical validation is pure and reports missing artwork as export blocking', () => {
  const state = createCleanProjectState();
  const before = structuredClone(state);
  const issues = validateProject(state);
  assert.deepEqual(state, before);
  assert.equal(issues.find(({ id }) => id === 'artwork.missing')?.severity, 'error');
  assert.ok(exportBlockingIssues(issues).length);
  assert.equal(deriveProjectReadiness(state, issues).export.status, 'error');
});

test('optional animation and behavior guidance never blocks a minimalist project', () => {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="face"/></svg>';
  state.states = { Neutral: {} };
  state.activeState = 'Neutral';
  const issues = validateProject(state);
  assert.equal(issues.find(({ id }) => id === 'animation.optional.empty')?.severity, 'info');
  assert.equal(issues.find(({ id }) => id === 'behaviors.optional.empty')?.severity, 'info');
  assert.equal(exportBlockingIssues(issues).length, 0);
  assert.equal(deriveProjectReadiness(state, issues).export.status, 'ready');
});

/**
 * A role whose drawing was deleted (audit §4.2).
 *
 * The schema validator said `Semantic part "eyes": role "leftEye" references
 * missing element "eyeLeft".` — true, unactionable, and written for somebody
 * reading the schema rather than building a mascot. And there was nothing to
 * press: the only way out was to find Clear on the right role in Rig ▸ Assign.
 */
test('a part that has lost its drawing says so in words, and carries the repair', () => {
  const state = {
    ...createCleanProjectState(),
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="eyeRight"/></svg>',
    elements: { eyeRight: { baseTransform: {} } },
    semanticParts: { eyes: { id: 'eyes', type: 'eyes', name: 'Eyes', roles: { leftEye: 'eyeLeft', rightEye: 'eyeRight' }, controls: [] } }
  };
  const issue = validateProject(state).find(({ id }) => id.includes('orphan-role'));

  assert.ok(issue, 'the lost drawing is reported');
  assert.equal(issue.message, 'Eyes: nothing is drawn for its left eye any more. Pick another drawing for it, or take the role off.');
  assert.doesNotMatch(issue.message, /Semantic part|references missing element|leftEye|eyeLeft/, 'no schema words reach the author');
  // The part and the role, so the repair is a thing rather than a place.
  assert.deepEqual(issue.remedy, { kind: 'clear-role', partId: 'eyes', role: 'leftEye', roleLabel: 'left eye', label: 'Take the left eye role off' });
  // And the Fix still opens the screen where another drawing could be picked.
  assert.deepEqual(issue.fix, { workspace: 'rig', rigTask: 'setup', activeSemanticPartId: 'eyes' });

  // A role that still has its drawing is not reported, and neither is an empty one.
  assert.equal(validateProject({ ...state, elements: { eyeLeft: { baseTransform: {} }, eyeRight: { baseTransform: {} } } }).filter(({ id }) => id.includes('orphan-role')).length, 0);
  assert.equal(validateProject({ ...state, semanticParts: { eyes: { ...state.semanticParts.eyes, roles: { leftEye: null, rightEye: 'eyeRight' } } } }).filter(({ id }) => id.includes('orphan-role')).length, 0);
});
