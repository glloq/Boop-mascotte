/**
 * Everything that opens, replaces or writes out a project (VNX-02,
 * docs/VNEXT_ROADMAP.md): SVG import, templates, presets, the generated face,
 * snapshot files and the restore behind local recovery.
 *
 * These six paths do the same five things in the same order — ask before
 * destroying unsaved work, stop playback, swap the document, clear undo,
 * establish a new saved baseline — and they used to be six closures over
 * `main.js` module variables. That made the two parts that matter most
 * untestable: whether a refused replacement really touches nothing, and
 * whether a load that fails halfway really puts the previous document back.
 *
 * Every collaborator is injected — store, canvas, preview, timeline, history,
 * autosave, narrow shell callbacks and the download itself — so a load, a
 * refusal and a failed commit all run in Node. Nothing here reaches for
 * `window`, `document`, `Blob` or `URL`.
 *
 * The service decides *what happens to the project*, never what the shell
 * looks like: it reports through the callbacks it was given, and `main.js`
 * keeps the bindings.
 */
import { createCleanProjectState } from '../../core/state/store.js';
import { createProjectDocument } from '../../core/state/project-document.js';
import { createEditorSession } from '../../core/state/editor-session.js';
import { applyProjectSnapshot, createProjectSnapshot, hasValidProjectDocument, prepareProjectSnapshot } from '../../core/state/project-snapshot.js';
import { commitProjectReplacement } from '../../core/state/project-replacement.js';
import { PROJECT_TEMPLATES } from '../../core/sample/templates/index.js';
import { loadProjectTemplate } from '../../core/sample/template-loader.js';
import { PRESET_LIBRARY } from '../../core/assets/preset-library.js';
import { buildFaceProjectTemplate } from '../../core/assets/face-builder.js';
import { validateRig } from '../../core/validation/rig-validator.js';
import { applyImportedRig } from '../../core/state/import-rig.js';

/** Every domain `applyImportedRig` can write, so every panel that shows one redraws. */
const RIG_IMPORT_DOMAINS = Object.freeze(['artwork', 'rig', 'stateMachine', 'keyforms', 'constraints', 'hands', 'hierarchy']);

/**
 * The only browser step in the file, and the reason it is one injected
 * function rather than four: a save needs `Blob`, `URL`, an `<a>` and a timer,
 * and a fake that records `(name, text)` is a better test seam than four DOM
 * shims. The globals are read when a download happens, never at import time.
 */
const browserDownload = (name, text) => {
  const blob = new globalThis.Blob([text], { type: 'application/json' });
  const link = globalThis.document.createElement('a');
  link.href = globalThis.URL.createObjectURL(blob);
  link.download = name;
  link.click();
  // Revoked on the next tick, not straight away: the click has to have read it.
  globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(link.href), 0);
};

export function createProjectService({
  store, history, canvas, preview, timeline, autosave,
  // The shell, as the four things this service actually asks of it.
  setStatus = () => {}, setProjectLoaded = () => {}, closeHome = () => {},
  navigate = () => {},
  // `false` is the answer `commitProjectReplacement` reads as "cancel", so a
  // service wired without a dialog refuses to destroy work rather than
  // destroying it silently.
  confirmReplacement = () => false,
  resetContext = () => {},
  // Leaving preview is partly the editor's own state and partly a class on the
  // app root; neither belongs here, both must happen before the swap.
  exitPreviewMode = () => {},
  createDownload = browserDownload,
  // Destructured under another name on purpose, as in autosave-service.js:
  // `requestAnimationFrame = requestAnimationFrame` would be a temporal-dead-zone
  // self reference, and the DOM timer needs the global as its receiver.
  requestAnimationFrame: afterPaint = (callback) => globalThis.requestAnimationFrame(callback)
} = {}) {
  /**
   * The one destructive path. `commit` prepares nothing and validates nothing:
   * whatever can fail must have failed before this is called, so a bad file
   * costs the author a status line rather than the project on screen.
   *
   * `keepRecovery` is for the restore path, where the local record being
   * restored from has to survive the baseline that restore establishes.
   */
  const replaceProject = (commit, { keepRecovery = false } = {}) => commitProjectReplacement({
    hasUnsavedChanges: () => autosave.isDirty(),
    confirmReplacement: () => confirmReplacement(),
    saveProject: () => saveProject(),
    stop: () => { timeline.reset(); preview.stop(); preview.reset(); exitPreviewMode(); },
    resetContext: () => resetContext(),
    captureRollback: () => ({ document: structuredClone(store.getDocument()), session: structuredClone(store.getSession()), markup: hasValidProjectDocument(store.getDocument()) ? canvas.serializeCurrentSvg() : '' }),
    commit,
    rollback: async (previous) => { if (previous.markup) await canvas.loadSvgFromText(previous.markup, previous.document.layerMetadata, { recordHistory: false, updateStore: false }); store.replaceProject(previous.document, previous.session, { source: 'rollback' }); preview.apply(); },
    clearHistory: () => history.clear(), establishBaseline: () => autosave.markSaved({ keepRecovery })
  });

  const downloadJson = (name, data) => createDownload(name, JSON.stringify(data, null, 2));

  const saveProject = () => {
    // Serialized from the canvas rather than from `svgMarkup`: the store copy
    // lags behind whatever the author has just drawn.
    if (!hasValidProjectDocument(store.getState(), () => canvas.serializeCurrentSvg())) { setStatus('Add valid SVG artwork before saving.', 'warn'); return false; }
    const snapshot = createProjectSnapshot(store.getState(), () => canvas.serializeCurrentSvg());
    downloadJson('mascot-project.json', snapshot);
    setStatus('Project snapshot exported.');
    autosave.markSaved();
    return true;
  };

  /** The tail shared by every path that puts a new project on the canvas. */
  const openProject = () => {
    setProjectLoaded(true);
    navigate('artwork');
    closeHome();
    // Fitting needs the artwork laid out, which has not happened yet.
    afterPaint(() => canvas.fitToCanvas());
  };

  /**
   * A snapshot back into the editor. `sourceLabel` is the only difference
   * between a project file and a local draft; `recovered` is the difference
   * between the two of them and a saved project.
   */
  const restoreSnapshot = async (snapshot, sourceLabel, { recovered = false } = {}) => {
    const committed = await replaceProject(async () => {
      await canvas.loadSvgFromText(snapshot.document.svgMarkup, snapshot.document.layerMetadata, { recordHistory: false, updateStore: false });
      const nextState = createCleanProjectState(); applyProjectSnapshot(nextState, snapshot);
      const nextDocument = createProjectDocument(nextState), nextSession = createEditorSession(nextState);
      store.replaceProject(nextDocument, nextSession, { source: 'project-snapshot' });
      preview.setClip(nextSession.animationEditor.activeClipId);
      preview.seek(nextSession.animationEditor.playhead);
      preview.apply();
    }, { keepRecovery: recovered });
    if (!committed) return false;
    navigate('artwork');
    setProjectLoaded(true);
    closeHome();
    setStatus(`${sourceLabel} restored.`);
    // A recovered draft matches the record it came from, so the version token
    // would call it clean — yet the author has never saved it anywhere.
    if (recovered) { autosave.markDirty(); setStatus('Recovered local copy — unsaved changes.', 'warn'); }
    return true;
  };

  const loadSvgFile = async (file) => {
    try {
      // Read and sanitized before the confirm dialog: an unreadable file must
      // not cost the author the project that is open.
      const prepared = canvas.prepareSvgImport(await file.text());
      const committed = await replaceProject(async () => {
        const artwork = await canvas.loadSvgFromText(prepared, {}, { recordHistory: false, updateStore: false });
        const candidate = Object.assign(createCleanProjectState(), artwork);
        store.replaceProject(createProjectDocument(candidate), createEditorSession(candidate), { source: 'svg-import' });
        preview.apply();
      });
      if (!committed) return false;
      openProject();
      setStatus(`Loaded SVG: ${file.name}`);
      return true;
    } catch {
      // Covers the rollback path too: the previous document is already back,
      // and the author is told the file was the problem.
      setStatus(`Invalid or unsupported SVG: ${file.name}`, 'error');
      return false;
    }
  };

  const loadTemplate = async (kind) => {
    const template = PROJECT_TEMPLATES[kind] || PROJECT_TEMPLATES.basic;
    const committed = await replaceProject(() => loadProjectTemplate(template, { store, canvas, history, preview, validate: validateRig }));
    if (!committed) return false;
    openProject();
    setStatus(`${template.name || 'Mascot'} created.`);
    return true;
  };

  // The face builder produces a template, so generation and templates are the
  // same path. It does not fit the canvas: the builder already sizes the face.
  const generateFace = async (options) => {
    const committed = await replaceProject(() => loadProjectTemplate(buildFaceProjectTemplate(options), { store, canvas, history, preview, validate: validateRig }));
    if (committed) { setProjectLoaded(true); setStatus('Generated face from builder options.'); }
    return committed;
  };

  const applyPreset = async (presetId) => {
    const preset = PRESET_LIBRARY[presetId];
    if (!preset) return false;
    const prepared = canvas.prepareSvgImport(preset.svg);
    const committed = await replaceProject(async () => {
      const artwork = await canvas.loadSvgFromText(prepared, {}, { recordHistory: false, updateStore: false });
      const candidate = Object.assign(createCleanProjectState(), artwork);
      store.replaceProject(createProjectDocument(candidate), createEditorSession(candidate), { source: 'preset' });
    });
    if (committed) setStatus(`Preset loaded: ${preset.label}`);
    return committed;
  };

  const loadProjectFile = async (file) => {
    try {
      const imported = JSON.parse(await file.text());
      // Parsed, versioned and normalized against a throwaway state first, so an
      // unsupported snapshot never reaches the live store.
      const prepared = prepareProjectSnapshot(imported, (svg) => canvas.prepareSvgImport(svg));
      return await restoreSnapshot(prepared, `Project ${file.name}`);
    } catch {
      setStatus(`Invalid project snapshot: ${file.name}`, 'error');
      return false;
    }
  };

  /**
   * Import an exported `rig.json` over the current artwork.
   *
   * Parameters, states, behaviors, bindings, keyforms, shape keys, warps and
   * hands land on the elements the artwork already has; anything naming an
   * element that is not there is left out. The importer has existed since the
   * schema-v1 migrations and the docs promised it; this is the first button
   * that reaches it. One undo step.
   */
  const importRigFile = async (file) => {
    if (!hasValidProjectDocument(store.getState())) { setStatus('Import or create artwork first: a rig is applied onto artwork.', 'error'); return false; }
    let imported;
    try {
      imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('A rig file is a JSON object.');
      if (imported.document && imported.version) throw new Error('This is a project file: use Open Project for it.');
    } catch (error) {
      setStatus(`Invalid rig file: ${file.name}. ${error.message}`, 'error');
      return false;
    }
    try {
      preview.stop?.();
      history.snapshot();
      store.execute({ type: 'rig/import', domains: RIG_IMPORT_DOMAINS, source: 'import', apply: (document) => applyImportedRig(document, imported) });
      preview.apply?.();
      setStatus(`Rig imported from ${file.name}. Undo puts the previous rig back.`);
      return true;
    } catch (error) {
      history.undo();
      setStatus(`Could not import the rig: ${error.message}`, 'error');
      return false;
    }
  };

  return { replaceProject, restoreSnapshot, saveProject, downloadJson, loadSvgFile, loadTemplate, generateFace, applyPreset, loadProjectFile, importRigFile };
}
