import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportReadinessModel } from '../export/export-readiness.js';
import { describeFix, summarizeIssues } from '../validation/issue-guidance.js';
import { validateProject } from '../validation/validate-project.js';
import { deriveTaskReadiness } from '../validation/task-readiness.js';

const issue = (id, severity, domain, message, fix = null, target = null) => ({ id, severity, domain, message, fix, target, blocking: severity === 'error' });

test('every issue gets guidance: a deep link with its destination, or an explicit explanation', () => {
  assert.deepEqual(describeFix(issue('artwork.missing', 'error', 'artwork', 'Add artwork.', { workspace: 'create' })), { available: true, label: 'Fix', where: 'Artwork', precise: false, explanation: 'Opens Artwork.' });
  const part = describeFix(issue('rig.eyes.x', 'error', 'rig', 'Semantic part "eyes" is broken.', { workspace: 'rig', activeSemanticPartId: 'eyes', rigTask: 'setup' }, { entity: 'eyes' }));
  assert.deepEqual([part.where, part.precise, part.explanation], ['Face Setup', true, 'Opens Face Setup on the item to fix.']);
  const state = describeFix(issue('states.happy.x', 'error', 'states', 'State "happy" is broken.', { workspace: 'animate', authorMode: 'states' }, { entity: 'happy' }));
  assert.deepEqual([state.where, state.precise, state.explanation], ['Animate → States', false, 'Opens Animate → States; find “happy” there.']);
  const none = describeFix(issue('x', 'error', 'rig', 'Something odd.'));
  assert.deepEqual([none.available, none.label, none.explanation], [false, 'No automatic fix', 'Nothing to open automatically: Something odd..']);
  assert.deepEqual(summarizeIssues([issue('a', 'error', 'rig', 'a'), issue('b', 'warning', 'rig', 'b'), issue('c', 'info', 'rig', 'c')]).counts, { errors: 1, warnings: 1, info: 1 });
});

test('export readiness model is blocked by errors, warns on warnings and stays pure', () => {
  const blank = {};
  const blankIssues = validateProject(blank), blankReadiness = deriveTaskReadiness(blank, blankIssues);
  const blocked = createExportReadinessModel(blankReadiness, blankIssues, { available: false });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.canExport, false);
  assert.equal(blocked.blockers[0].id, 'artwork.missing');
  assert.equal(blocked.blockers[0].fix.where, 'Artwork');
  assert.match(blocked.headline, /Export is blocked: Add or import SVG artwork/);
  assert.deepEqual(blocked.sections.map((section) => section.id), [...blankReadiness.order]);

  const ready = createExportReadinessModel(blankReadiness, [], { available: true });
  assert.deepEqual([ready.status, ready.canExport, ready.headline, ready.counts], ['ready', true, 'Ready to export', { errors: 0, warnings: 0, info: 0 }]);
  const warned = createExportReadinessModel(blankReadiness, [issue('reaction.x.empty', 'warning', 'reactions', 'Reaction "x" does nothing yet.', { workspace: 'reactions', activeReactionId: 'x' })]);
  assert.deepEqual([warned.status, warned.canExport, warned.headline], ['warnings', true, 'Ready to export · 1 warning worth a look']);
  assert.equal(warned.warnings[0].fix.precise, true);
  assert.throws(() => { warned.status = 'x'; }, TypeError, 'the model is frozen');
  assert.deepEqual(createExportReadinessModel(blankReadiness, blankIssues, { available: false }), blocked, 'deterministic for the same inputs');
});
