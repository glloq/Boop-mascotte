import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectService } from '../../app/services/project-service.js';
import { createCleanProjectState } from '../state/store.js';

const OPEN_SVG = '<svg><circle id="head" r="10"/></svg>';
const NEXT_SVG = '<svg><rect id="body" width="4" height="4"/></svg>';

/** The smallest snapshot `prepareProjectSnapshot` and `applyProjectSnapshot` both accept. */
const snapshotOf = (svgMarkup) => ({
  version: 3,
  document: { svgMarkup, layers: ['head'], layerMetadata: { head: { name: 'Head' } }, rig: { params: {}, states: {}, elements: {} }, editor: {} }
});

/**
 * Fakes for the four collaborators the service mutates, and recorders for
 * everything it reports. `loadFails` turns the canvas into a document that
 * cannot be parsed *after* the swap has started, which is the only way to
 * reach the rollback path.
 */
const createHarness = ({ dirty = false, confirmReplacement = () => false, loadFails = () => false, ...overrides } = {}) => {
  const shell = { status: [], projectLoaded: [], routes: [], closedHome: 0, contextResets: 0, previewExits: 0 };
  const calls = [], downloads = [], loads = [];
  let projectDocument = { ...createCleanProjectState(), svgMarkup: OPEN_SVG, layers: ['head'], layerMetadata: { head: { name: 'Head' } } };
  let projectSession = { selectedId: 'head', animationEditor: { activeClipId: null, playhead: 0, panel: 'preview' } };

  const service = createProjectService({
    store: {
      getDocument: () => projectDocument,
      getSession: () => projectSession,
      getState: () => ({ ...projectDocument, ...projectSession }),
      replaceProject: (document, session, { source } = {}) => { projectDocument = document; projectSession = session; calls.push(`replace:${source}`); }
    },
    history: { clear: () => calls.push('clear-history') },
    canvas: {
      prepareSvgImport: (svg) => `prepared(${svg})`,
      loadSvgFromText: async (markup, layerMetadata, options) => {
        loads.push({ markup, layerMetadata, options });
        if (loadFails(markup)) throw new Error('Unparseable artwork');
        return { svgMarkup: markup, layers: ['body'], layerMetadata: layerMetadata || {}, elements: {} };
      },
      serializeCurrentSvg: () => projectDocument.svgMarkup,
      fitToCanvas: () => calls.push('fit')
    },
    preview: { stop: () => calls.push('stop'), reset: () => calls.push('reset-preview'), apply: () => calls.push('apply'), setClip: () => {}, seek: () => {} },
    timeline: { reset: () => calls.push('reset-timeline') },
    autosave: {
      isDirty: () => dirty,
      markSaved: (options = {}) => calls.push(`saved:${options.keepRecovery === true}`),
      markDirty: () => calls.push('dirty')
    },
    setStatus: (message, tone) => shell.status.push([message, tone]),
    setProjectLoaded: (loaded) => shell.projectLoaded.push(loaded),
    closeHome: () => { shell.closedHome += 1; },
    navigate: (route) => shell.routes.push(route),
    confirmReplacement,
    resetContext: () => { shell.contextResets += 1; },
    exitPreviewMode: () => { shell.previewExits += 1; },
    createDownload: (name, text) => downloads.push({ name, data: JSON.parse(text) }),
    requestAnimationFrame: (callback) => callback(),
    ...overrides
  });

  return { service, shell, calls, downloads, loads, document: () => projectDocument, session: () => projectSession };
};

/** A file the shell would hand to a bind handler, without a DOM File. */
const fileOf = (name, text) => ({ name, text: async () => text });

test('a save writes the snapshot out and establishes a new saved baseline', () => {
  const harness = createHarness();
  assert.equal(harness.service.saveProject(), true);
  assert.equal(harness.downloads.length, 1);
  assert.equal(harness.downloads[0].name, 'mascot-project.json');
  assert.equal(harness.downloads[0].data.version, 3);
  assert.equal(harness.downloads[0].data.document.svgMarkup, OPEN_SVG);
  assert.deepEqual(harness.shell.status, [['Project snapshot exported.', undefined]]);
  // No keepRecovery: a saved project makes the local draft redundant.
  assert.deepEqual(harness.calls, ['saved:false']);
});

test('a save with no valid artwork warns and writes nothing', () => {
  const harness = createHarness();
  harness.document().svgMarkup = '<svg></svg>';
  assert.equal(harness.service.saveProject(), false);
  assert.deepEqual(harness.downloads, []);
  assert.deepEqual(harness.shell.status, [['Add valid SVG artwork before saving.', 'warn']]);
  assert.deepEqual(harness.calls, []);
});

test('a load that fails halfway rolls the previous document back and says which file was at fault', async () => {
  const harness = createHarness({ loadFails: (markup) => markup.startsWith('prepared(') });
  const before = harness.document();

  assert.equal(await harness.service.loadSvgFile(fileOf('broken.svg', NEXT_SVG)), false);
  assert.deepEqual(harness.shell.status, [['Invalid or unsupported SVG: broken.svg', 'error']]);
  // The rollback reloaded the markup that was on the canvas and put the same
  // document and session objects back.
  assert.deepEqual(harness.loads.map(entry => entry.markup), [`prepared(${NEXT_SVG})`, OPEN_SVG]);
  assert.deepEqual(harness.loads[1].layerMetadata, before.layerMetadata);
  assert.deepEqual(harness.document(), before);
  assert.equal(harness.session().selectedId, 'head');
  assert.deepEqual(harness.calls, ['reset-timeline', 'stop', 'reset-preview', 'replace:rollback', 'apply']);
  // A failed replacement is not a save and not a fresh project.
  assert.deepEqual(harness.shell.projectLoaded, []);
  assert.equal(harness.shell.closedHome, 0);
});

test('a replacement the author refuses leaves the open project untouched', async () => {
  const refusals = [];
  const harness = createHarness({ dirty: true, confirmReplacement: () => { refusals.push('asked'); return 'cancel'; } });
  const before = harness.document();

  assert.equal(await harness.service.loadTemplate('basic'), false);
  assert.deepEqual(refusals, ['asked']);
  assert.deepEqual(harness.document(), before);
  // Nothing stopped, nothing reset, no history cleared, no message.
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.shell.previewExits, 0);
  assert.equal(harness.shell.contextResets, 0);
  assert.deepEqual(harness.shell.status, []);
  assert.deepEqual(harness.shell.routes, []);
});

test('a project file is restored, announced by name and treated as saved', async () => {
  const harness = createHarness();
  assert.equal(await harness.service.loadProjectFile(fileOf('mascot.json', JSON.stringify(snapshotOf(NEXT_SVG)))), true);
  assert.deepEqual(harness.shell.status, [['Project mascot.json restored.', undefined]]);
  assert.deepEqual(harness.shell.routes, ['artwork']);
  assert.deepEqual(harness.shell.projectLoaded, [true]);
  assert.equal(harness.shell.closedHome, 1);
  assert.equal(harness.shell.previewExits, 1);
  assert.equal(harness.shell.contextResets, 1);
  assert.equal(harness.document().svgMarkup, `prepared(${NEXT_SVG})`);
  assert.deepEqual(harness.calls, ['reset-timeline', 'stop', 'reset-preview', 'replace:project-snapshot', 'apply', 'clear-history', 'saved:false']);
});

test('a restored recovery snapshot keeps its record and is marked dirty rather than clean', async () => {
  const harness = createHarness();
  assert.equal(await harness.service.restoreSnapshot(snapshotOf(NEXT_SVG), 'Local draft', { recovered: true }), true);
  // keepRecovery: the record being restored from must survive the baseline.
  assert.equal(harness.calls.at(-2), 'saved:true');
  assert.equal(harness.calls.at(-1), 'dirty');
  assert.deepEqual(harness.shell.status, [['Local draft restored.', undefined], ['Recovered local copy — unsaved changes.', 'warn']]);
});

test('an unreadable project file is reported without touching the open project', async () => {
  const harness = createHarness();
  const before = harness.document();
  assert.equal(await harness.service.loadProjectFile(fileOf('notes.json', 'not json at all')), false);
  assert.deepEqual(harness.shell.status, [['Invalid project snapshot: notes.json', 'error']]);
  assert.deepEqual(harness.document(), before);
  assert.deepEqual(harness.calls, []);
});

test('an SVG import opens the project, fits the canvas and names the file', async () => {
  const harness = createHarness();
  assert.equal(await harness.service.loadSvgFile(fileOf('mascot.svg', NEXT_SVG)), true);
  assert.deepEqual(harness.shell.status, [['Loaded SVG: mascot.svg', undefined]]);
  assert.deepEqual(harness.shell.projectLoaded, [true]);
  assert.deepEqual(harness.shell.routes, ['artwork']);
  assert.equal(harness.shell.closedHome, 1);
  assert.equal(harness.document().svgMarkup, `prepared(${NEXT_SVG})`);
  assert.deepEqual(harness.calls, ['reset-timeline', 'stop', 'reset-preview', 'replace:svg-import', 'apply', 'clear-history', 'saved:false', 'fit']);
});

test('an unknown preset id is ignored instead of replacing the project', async () => {
  const harness = createHarness();
  assert.equal(await harness.service.applyPreset('no-such-preset'), false);
  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.shell.status, []);
});

test('a save requested from inside a replacement lets the replacement continue', async () => {
  const harness = createHarness({ dirty: true, confirmReplacement: () => 'save' });
  assert.equal(await harness.service.restoreSnapshot(snapshotOf(NEXT_SVG), 'Project mascot.json'), true);
  // The dialog's save runs first, and its own baseline precedes the swap.
  assert.deepEqual(harness.calls, ['saved:false', 'reset-timeline', 'stop', 'reset-preview', 'replace:project-snapshot', 'apply', 'clear-history', 'saved:false']);
  assert.equal(harness.downloads.length, 1);
});

test('a rig.json lands on the current artwork as one undo step, and a project file is refused there', async () => {
  const executed = [], marks = [];
  let document_ = { ...createCleanProjectState(), svgMarkup: OPEN_SVG, layers: ['head'], layerMetadata: { head: { name: 'Head' } }, elements: { head: { baseTransform: {}, bindings: {}, constraints: {}, morph: {} } } };
  const harness = createHarness({
    history: { clear: () => {}, snapshot: () => marks.push('snapshot'), undo: () => marks.push('undo') },
    store: {
      getDocument: () => document_, getSession: () => ({}), getState: () => document_,
      execute: ({ type, domains, apply }) => { executed.push({ type, domains }); apply(document_); return document_; }
    }
  });
  assert.equal(await harness.service.importRigFile(fileOf('rig.json', JSON.stringify({ schemaVersion: 3, params: { headX: 0.5 }, elements: { head: { constraints: { rotate: false } }, nowhere: { x: 1 } } }))), true);
  assert.deepEqual(marks, ['snapshot'], 'one undo step');
  assert.equal(executed.length, 1);
  assert.equal(executed[0].type, 'rig/import');
  assert.ok(executed[0].domains.includes('rig') && executed[0].domains.includes('stateMachine') && executed[0].domains.includes('keyforms'), 'every domain the importer writes is notified');
  assert.equal(document_.params.headX.value, 0.5);
  assert.equal(document_.elements.head.constraints.rotate, false);
  assert.equal(document_.elements.nowhere, undefined, 'a rig entry for artwork that is not there is left out');
  assert.match(harness.shell.status.at(-1)[0], /Rig imported/);

  assert.equal(await harness.service.importRigFile(fileOf('mascot-project.json', JSON.stringify({ version: 3, document: {} }))), false);
  assert.match(harness.shell.status.at(-1)[0], /project file/);
  assert.equal(await harness.service.importRigFile(fileOf('broken.json', '{')), false);
  assert.equal(executed.length, 1, 'a refused file never reaches the store');

  document_ = { ...createCleanProjectState() };
  assert.equal(await harness.service.importRigFile(fileOf('rig.json', '{}')), false, 'a rig needs artwork to land on');
  assert.match(harness.shell.status.at(-1)[0], /artwork first/);
});
