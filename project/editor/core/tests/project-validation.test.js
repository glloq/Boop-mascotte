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
