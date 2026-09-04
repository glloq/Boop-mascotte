import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportService } from '../../app/services/export-service.js';

const issue = (id, fix = null, severity = 'error', message = `${id} needs attention.`) => ({ id, severity, domain: 'rig', message, fix, blocking: severity === 'error' });

// One ordered event log behind every collaborator: the flows are mostly about
// what happens in which order (Back to Export before the navigation, the panel
// opened before the status line), so ordering has to be observable.
const createHarness = ({ issues = [], readiness = { order: [] } } = {}) => {
  const events = [];
  const record = (kind) => (...args) => { events.push([kind, ...args]); };
  // Distinct objects so a test can tell which store reading the cache was given.
  const document = { kind: 'document' }, state = { kind: 'state' };
  let exporterConfig = null;
  const service = createExportService({
    store: { getDocument: () => document, getState: () => state },
    exporter: {
      configure: (next) => { exporterConfig = next; },
      render: record('render'),
      open: record('open')
    },
    validationCache: { run: (input) => { events.push(['validated', input]); return issues; } },
    readiness: () => readiness,
    navigate: record('navigate'),
    updateContext: record('context'),
    setStatus: (message, tone) => events.push(['status', [message, tone]]),
    showProblems: (...args) => events.push(['problems', args]),
    setReturnToExport: record('return-to-export')
  });
  return {
    service, document, state, readiness, issues,
    config: () => exporterConfig,
    kinds: () => events.map(([kind]) => kind),
    of: (kind) => events.filter(([name]) => name === kind).map(([, value]) => value)
  };
};

test('opening Export with a blocking issue still opens the panel and says what blocks it', () => {
  const harness = createHarness({ issues: [issue('artwork.missing', null, 'error', 'Add or import SVG artwork.'), issue('rig.broken', null, 'error', 'The rig is broken.')] });
  harness.service.openExport();
  // Back to Export cleared first, the panel rendered and opened, then the first blocker.
  assert.deepEqual(harness.kinds(), ['return-to-export', 'validated', 'render', 'open', 'status']);
  assert.deepEqual(harness.of('return-to-export'), [false]);
  assert.deepEqual(harness.of('status'), [['Cannot export yet: Add or import SVG artwork.', 'error']]);
  assert.deepEqual(harness.of('validated'), [harness.state]);
});

test('opening Export with nothing blocking opens the panel and says nothing', () => {
  const harness = createHarness({ issues: [issue('reaction.x.empty', null, 'warning', 'Reaction "x" does nothing yet.'), issue('rig.note', null, 'info', 'Nothing to do.')] });
  harness.service.openExport();
  assert.deepEqual(harness.kinds(), ['return-to-export', 'validated', 'render', 'open']);
  assert.deepEqual(harness.of('status'), []);
});

test('a readiness item with no route does nothing at all', () => {
  const harness = createHarness({ issues: [issue('rig.eyes', { workspace: 'face-setup', activeSemanticPartId: 'eyes' })] });
  harness.service.goToReadiness({ id: 'export', label: 'Export', issueId: 'rig.eyes' });
  harness.service.goToReadiness(null);
  // Not even the validation cache: with nowhere to go there is no reason to run it.
  assert.deepEqual(harness.kinds(), []);
});

test('a readiness item naming an issue applies that issue fix context as well as its route', () => {
  const harness = createHarness({ issues: [issue('other', { workspace: 'artwork', activeSemanticPartId: 'mouth' }), issue('rig.eyes', { workspace: 'face-setup', activeSemanticPartId: 'eyes', rigTask: 'setup' })] });
  harness.service.goToReadiness({ id: 'faceSetup', route: { task: 'face-setup', focus: 'face-setup-checklist' }, issueId: 'rig.eyes' });
  assert.deepEqual(harness.kinds(), ['navigate', 'validated', 'context']);
  assert.deepEqual(harness.of('navigate'), [{ task: 'face-setup', focus: 'face-setup-checklist' }]);
  // The section's own route wins; `workspace` is a route, so it never lands in the context.
  assert.deepEqual(harness.of('context'), [{ activeSemanticPartId: 'eyes', rigTask: 'setup' }]);
  assert.deepEqual(harness.of('validated'), [harness.document]);
});

test('a readiness item with no issue, or an issue with no fix, navigates and leaves the context alone', () => {
  const harness = createHarness({ issues: [issue('rig.odd')] });
  harness.service.goToReadiness({ id: 'preview', route: { task: 'preview' } });
  harness.service.goToReadiness({ id: 'export', route: { task: 'artwork' }, issueId: 'rig.odd' });
  harness.service.goToReadiness({ id: 'export', route: { task: 'artwork' }, issueId: 'gone' });
  assert.deepEqual(harness.of('navigate'), [{ task: 'preview' }, { task: 'artwork' }, { task: 'artwork' }]);
  assert.deepEqual(harness.of('context'), []);
});

test('fixProblem navigates with a diagnostic target and falls back to artwork when the issue names no workspace', () => {
  const harness = createHarness();
  harness.service.fixProblem(issue('reaction.x.empty', { workspace: 'reactions', activeReactionId: 'x' }, 'warning'));
  harness.service.fixProblem(issue('artwork.missing', { activeSemanticPartId: null }));
  assert.deepEqual(harness.of('navigate'), [
    { task: 'reactions', target: { kind: 'diagnostic', diagnosticId: 'reaction.x.empty' } },
    { task: 'artwork', target: { kind: 'diagnostic', diagnosticId: 'artwork.missing' } }
  ]);
  assert.deepEqual(harness.of('context'), [{ activeReactionId: 'x' }, { activeSemanticPartId: null }]);
  // An issue with no fix has no destination, so nothing moves.
  harness.service.fixProblem(issue('rig.odd'));
  harness.service.fixProblem(null);
  assert.deepEqual(harness.of('navigate').length, 2);
});

test('the Problems panel gets the current readiness, the current issues and both deep links', () => {
  const readiness = { order: ['export'], export: { id: 'export', route: { task: 'preview' } } };
  const harness = createHarness({ issues: [issue('rig.eyes', { workspace: 'face-setup', activeSemanticPartId: 'eyes' })], readiness });
  harness.service.showProblems();
  const [model, issues, onFix, onGo] = harness.of('problems')[0];
  assert.equal(model, readiness);
  assert.deepEqual(issues, harness.issues);
  assert.deepEqual(harness.of('validated'), [harness.state]);

  onFix(harness.issues[0]);
  onGo(readiness.export);
  assert.deepEqual(harness.of('navigate'), [{ task: 'face-setup', target: { kind: 'diagnostic', diagnosticId: 'rig.eyes' } }, { task: 'preview' }]);
  // Problems is not Export: neither deep link arms Back to Export.
  assert.deepEqual(harness.of('return-to-export'), []);
});

test('the configured export panel deep links raise Back to Export before they navigate', () => {
  const readiness = { order: ['export'], export: { id: 'export', route: { task: 'artwork' }, issueId: 'artwork.missing' } };
  const harness = createHarness({ issues: [issue('artwork.missing', { workspace: 'artwork' }, 'error', 'Add or import SVG artwork.')], readiness });
  harness.service.configure();
  const config = harness.config();
  assert.equal(config.readiness(), readiness);
  assert.deepEqual(config.issues(), harness.issues);
  assert.deepEqual(harness.of('validated'), [harness.document]);

  config.onFix(harness.issues[0]);
  config.onGo(readiness.export);
  assert.deepEqual(harness.of('return-to-export'), [true, true]);
  assert.deepEqual(harness.kinds(), ['validated', 'return-to-export', 'navigate', 'context', 'return-to-export', 'navigate', 'validated', 'context']);
  assert.deepEqual(harness.of('navigate'), [{ task: 'artwork', target: { kind: 'diagnostic', diagnosticId: 'artwork.missing' } }, { task: 'artwork' }]);
});
